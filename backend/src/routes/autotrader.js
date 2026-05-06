const express = require("express")
const auth = require("../middleware/auth")
const { PrismaClient } = require("@prisma/client")
const notificationService = require("../services/notificationService")

const router = express.Router()
const prisma = new PrismaClient()
const dashboardBaseUrl = process.env.FRONTEND_URL || "https://stocks.quadrawebs.com"

async function sendAutoTraderSetupNotification(userId, activity, channels = null) {
  try {
    const [user, notificationSettings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.notificationSettings.findUnique({ where: { userId } })
    ])

    if (!user || !notificationSettings) return
    await notificationService.sendActivityNotification(user, activity, notificationSettings, channels)
  } catch (error) {
    console.error("Auto-trader setup notification error:", error.message)
  }
}

/**
 * @route   GET /autotrader
 * @desc    Get all auto-trader rules for current user
 * @access  Private
 */
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id

    const autoTraders = await prisma.autoTrader.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    })

    res.json(autoTraders)
  } catch (error) {
    console.error("Error fetching auto-traders:", error)
    res.status(500).json({ error: "Failed to fetch auto-trader rules" })
  }
})

/**
 * @route   GET /autotrader/:id
 * @desc    Get specific auto-trader rule
 * @access  Private
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const traderId = parseInt(req.params.id)

    const trader = await prisma.autoTrader.findFirst({
      where: {
        id: traderId,
        userId
      }
    })

    if (!trader) {
      return res.status(404).json({ error: "Auto-trader rule not found" })
    }

    res.json(trader)
  } catch (error) {
    console.error("Error fetching auto-trader:", error)
    res.status(500).json({ error: "Failed to fetch auto-trader rule" })
  }
})

/**
 * @route   POST /autotrader
 * @desc    Create new auto-trader rule
 * @access  Private
 */
router.post("/", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const {
      marketId,
      question,
      outcome,
      strategyType,
      triggerCondition,
      targetPrice,
      movingAvgPeriod,
      action,
      quantity,
      maxExecutions,
      notifyOnExecution,
      notificationChannels
    } = req.body

    console.log("📥 Received auto-trader request:", {
      userId,
      marketId,
      marketIdType: typeof marketId,
      question: question?.substring(0, 50),
      outcome,
      strategyType,
      triggerCondition,
      action,
      quantity
    })

    // Validation
    if (!marketId || !question || !strategyType || !triggerCondition || !action || !quantity) {
      return res.status(400).json({
        error: "Missing required fields: marketId, question, strategyType, triggerCondition, action, quantity"
      })
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" })
    }

    // Validate strategy-specific fields
    if (strategyType === "PriceTarget" && !targetPrice) {
      return res.status(400).json({ error: "targetPrice is required for PriceTarget strategy" })
    }

    if (strategyType === "MovingAverage" && !movingAvgPeriod) {
      return res.status(400).json({ error: "movingAvgPeriod is required for MovingAverage strategy" })
    }

    // Validate trigger condition matches strategy
    if (strategyType === "PriceTarget" && !["Above", "Below"].includes(triggerCondition)) {
      return res.status(400).json({ error: "Invalid trigger condition for PriceTarget strategy" })
    }

    if (strategyType === "MovingAverage" && !["CrossAbove", "CrossBelow"].includes(triggerCondition)) {
      return res.status(400).json({ error: "Invalid trigger condition for MovingAverage strategy" })
    }

    // Prevent duplicate active rules that would trigger repeated executions/notifications
    const duplicateRule = await prisma.autoTrader.findFirst({
      where: {
        userId,
        marketId: String(marketId),
        outcome: outcome || null,
        strategyType,
        triggerCondition,
        action,
        quantity: parseFloat(quantity),
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        movingAvgPeriod: movingAvgPeriod ? parseInt(movingAvgPeriod) : null,
        isActive: true
      }
    })

    if (duplicateRule) {
      return res.status(409).json({
        error: "A matching active auto-trader rule already exists",
        existingRuleId: duplicateRule.id
      })
    }

    // Log the data being sent to Prisma
    console.log("🔍 Creating auto-trader with data:", {
      userId,
      marketId,
      question: question?.substring(0, 50),
      outcome,
      strategyType,
      triggerCondition,
      targetPrice,
      movingAvgPeriod,
      action,
      quantity,
      maxExecutions
    })

    // Create auto-trader rule
    const autoTrader = await prisma.autoTrader.create({
      data: {
        userId,
        marketId: String(marketId), // Ensure it's a string
        question,
        outcome: outcome || null,
        strategyType,
        triggerCondition,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        movingAvgPeriod: movingAvgPeriod ? parseInt(movingAvgPeriod) : null,
        action,
        quantity: parseFloat(quantity),
        maxExecutions: maxExecutions ? parseInt(maxExecutions) : 1,
        notifyOnExecution: notifyOnExecution !== undefined ? notifyOnExecution : true,
        notificationChannels: notificationChannels || ["email"],
        isActive: true
      }
    })

    await sendAutoTraderSetupNotification(userId, {
      subject: `🤖 Rule Created: ${strategyType}`,
      title: "Auto-Trader Rule Created",
      description: "Your auto-trader rule has been created and activated.",
      details: {
        Market: question,
        Outcome: outcome || "Any",
        Strategy: strategyType,
        Trigger: triggerCondition,
        Action: action,
        Quantity: parseFloat(quantity),
        "Max Executions": maxExecutions ? parseInt(maxExecutions) : 1,
        Status: "Active"
      },
      actionLabel: "View Auto-Trader",
      actionUrl: `${dashboardBaseUrl}/portfolio`,
      color: 0x2563EB
    })

    console.log("✅ Auto-trader created successfully:", autoTrader.id)

    res.json({
      success: true,
      autoTrader,
      message: "Auto-trader rule created successfully"
    })
  } catch (error) {
    console.error("❌ Error creating auto-trader:", error)
    console.error("Error details:", error.message)
    console.error("Error stack:", error.stack)
    res.status(500).json({ 
      error: "Failed to create auto-trader rule",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * @route   PUT /autotrader/:id
 * @desc    Update auto-trader rule
 * @access  Private
 */
router.put("/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const traderId = parseInt(req.params.id)

    // Check if trader exists and belongs to user
    const existingTrader = await prisma.autoTrader.findFirst({
      where: {
        id: traderId,
        userId
      }
    })

    if (!existingTrader) {
      return res.status(404).json({ error: "Auto-trader rule not found" })
    }

    const {
      targetPrice,
      movingAvgPeriod,
      quantity,
      maxExecutions,
      notifyOnExecution,
      notificationChannels,
      isActive
    } = req.body

    // Build update data
    const updateData = {}
    if (targetPrice !== undefined) updateData.targetPrice = parseFloat(targetPrice)
    if (movingAvgPeriod !== undefined) updateData.movingAvgPeriod = parseInt(movingAvgPeriod)
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity)
    if (maxExecutions !== undefined) updateData.maxExecutions = parseInt(maxExecutions)
    if (notifyOnExecution !== undefined) updateData.notifyOnExecution = notifyOnExecution
    if (notificationChannels !== undefined) updateData.notificationChannels = notificationChannels
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedTrader = await prisma.autoTrader.update({
      where: { id: traderId },
      data: updateData
    })

    await sendAutoTraderSetupNotification(userId, {
      subject: `🛠️ Rule Updated: ${updatedTrader.strategyType}`,
      title: "Auto-Trader Rule Updated",
      description: "Your auto-trader rule settings were updated.",
      details: {
        Market: updatedTrader.question,
        Strategy: updatedTrader.strategyType,
        Trigger: updatedTrader.triggerCondition,
        Action: updatedTrader.action,
        Quantity: updatedTrader.quantity,
        Active: updatedTrader.isActive ? "Yes" : "No"
      },
      actionLabel: "View Auto-Trader",
      actionUrl: `${dashboardBaseUrl}/portfolio`,
      color: 0xF59E0B
    })

    res.json({
      success: true,
      autoTrader: updatedTrader,
      message: "Auto-trader rule updated successfully"
    })
  } catch (error) {
    console.error("Error updating auto-trader:", error)
    res.status(500).json({ error: "Failed to update auto-trader rule" })
  }
})

/**
 * @route   PATCH /autotrader/:id/toggle
 * @desc    Toggle auto-trader rule active status
 * @access  Private
 */
router.patch("/:id/toggle", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const traderId = parseInt(req.params.id)

    const trader = await prisma.autoTrader.findFirst({
      where: {
        id: traderId,
        userId
      }
    })

    if (!trader) {
      return res.status(404).json({ error: "Auto-trader rule not found" })
    }

    const updatedTrader = await prisma.autoTrader.update({
      where: { id: traderId },
      data: {
        isActive: !trader.isActive
      }
    })

    await sendAutoTraderSetupNotification(userId, {
      subject: `${updatedTrader.isActive ? "▶️" : "⏸️"} Rule ${updatedTrader.isActive ? "Activated" : "Paused"}`,
      title: `Auto-Trader ${updatedTrader.isActive ? "Activated" : "Paused"}`,
      description: "Your auto-trader rule status has changed.",
      details: {
        Market: updatedTrader.question,
        Strategy: updatedTrader.strategyType,
        Action: updatedTrader.action,
        Status: updatedTrader.isActive ? "Active" : "Paused"
      },
      actionLabel: "View Auto-Trader",
      actionUrl: `${dashboardBaseUrl}/portfolio`,
      color: updatedTrader.isActive ? 0x10B981 : 0xEF4444
    })

    res.json({
      success: true,
      autoTrader: updatedTrader,
      message: `Auto-trader rule ${updatedTrader.isActive ? "activated" : "paused"}`
    })
  } catch (error) {
    console.error("Error toggling auto-trader:", error)
    res.status(500).json({ error: "Failed to toggle auto-trader rule" })
  }
})

/**
 * @route   DELETE /autotrader/:id
 * @desc    Delete auto-trader rule
 * @access  Private
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const traderId = parseInt(req.params.id)

    // Check if trader exists and belongs to user
    const trader = await prisma.autoTrader.findFirst({
      where: {
        id: traderId,
        userId
      }
    })

    if (!trader) {
      return res.status(404).json({ error: "Auto-trader rule not found" })
    }

    await prisma.autoTrader.delete({
      where: { id: traderId }
    })

    res.json({
      success: true,
      message: "Auto-trader rule deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting auto-trader:", error)
    res.status(500).json({ error: "Failed to delete auto-trader rule" })
  }
})

/**
 * @route   POST /autotrader/:id/reset
 * @desc    Reset execution count for auto-trader rule
 * @access  Private
 */
router.post("/:id/reset", auth, async (req, res) => {
  try {
    const userId = req.user.id
    const traderId = parseInt(req.params.id)

    const trader = await prisma.autoTrader.findFirst({
      where: {
        id: traderId,
        userId
      }
    })

    if (!trader) {
      return res.status(404).json({ error: "Auto-trader rule not found" })
    }

    const updatedTrader = await prisma.autoTrader.update({
      where: { id: traderId },
      data: {
        executionCount: 0,
        isActive: true
      }
    })

    res.json({
      success: true,
      autoTrader: updatedTrader,
      message: "Execution count reset successfully"
    })
  } catch (error) {
    console.error("Error resetting auto-trader:", error)
    res.status(500).json({ error: "Failed to reset auto-trader rule" })
  }
})

/**
 * @route   GET /autotrader/stats/summary
 * @desc    Get auto-trader statistics summary
 * @access  Private
 */
router.get("/stats/summary", auth, async (req, res) => {
  try {
    const userId = req.user.id

    const [total, active, triggered, totalExecutions] = await Promise.all([
      prisma.autoTrader.count({ where: { userId } }),
      prisma.autoTrader.count({ where: { userId, isActive: true } }),
      prisma.autoTrader.count({
        where: {
          userId,
          executionCount: { gt: 0 }
        }
      }),
      prisma.autoTrader.aggregate({
        where: { userId },
        _sum: { executionCount: true }
      })
    ])

    res.json({
      total,
      active,
      paused: total - active,
      triggered,
      totalExecutions: totalExecutions._sum.executionCount || 0
    })
  } catch (error) {
    console.error("Error fetching auto-trader stats:", error)
    res.status(500).json({ error: "Failed to fetch statistics" })
  }
})

module.exports = router
