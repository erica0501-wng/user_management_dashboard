const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const authenticate = require("../middleware/auth")

const prisma = new PrismaClient()

/**
 * GET /alerts
 * Get all alerts for the authenticated user
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    const alerts = await prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    })

    res.json({
      success: true,
      count: alerts.length,
      alerts
    })
  } catch (error) {
    console.error("❌ Get Alerts Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /alerts
 * Create a new alert
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const {
      marketId,
      question,
      outcome,
      alertType,
      targetPrice,
      condition,
      orderBookThreshold
    } = req.body

    // Validate required fields
    if (!marketId || !question || !outcome || !alertType) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: marketId, question, outcome, alertType"
      })
    }

    // Validate alert type specific fields
    if (alertType === "Price") {
      if (targetPrice === undefined || targetPrice === null) {
        return res.status(400).json({
          success: false,
          error: "targetPrice is required for Price alerts"
        })
      }
      if (!condition || !["Above", "Below"].includes(condition)) {
        return res.status(400).json({
          success: false,
          error: "condition must be 'Above' or 'Below' for Price alerts"
        })
      }
      if (targetPrice < 0 || targetPrice > 1) {
        return res.status(400).json({
          success: false,
          error: "targetPrice must be between 0 and 1"
        })
      }
    } else if (alertType === "OrderBook") {
      if (orderBookThreshold === undefined || orderBookThreshold === null) {
        return res.status(400).json({
          success: false,
          error: "orderBookThreshold is required for OrderBook alerts"
        })
      }
      if (orderBookThreshold <= 0) {
        return res.status(400).json({
          success: false,
          error: "orderBookThreshold must be greater than 0"
        })
      }
    } else {
      return res.status(400).json({
        success: false,
        error: "alertType must be 'Price' or 'OrderBook'"
      })
    }

    // Create alert
    const alert = await prisma.alert.create({
      data: {
        userId,
        marketId,
        question,
        outcome,
        alertType,
        targetPrice: alertType === "Price" ? targetPrice : null,
        condition: alertType === "Price" ? condition : null,
        orderBookThreshold: alertType === "OrderBook" ? orderBookThreshold : null,
        isActive: true,
        isTriggered: false
      }
    })

    res.json({
      success: true,
      alert,
      message: "Alert created successfully"
    })
  } catch (error) {
    console.error("❌ Create Alert Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PATCH /alerts/:id
 * Update an alert (toggle active status or update values)
 */
router.patch("/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const alertId = parseInt(req.params.id)
    const {
      isActive,
      targetPrice,
      condition,
      orderBookThreshold
    } = req.body

    // Check if alert exists and belongs to user
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        userId
      }
    })

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found"
      })
    }

    // Build update data
    const updateData = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (targetPrice !== undefined && existingAlert.alertType === "Price") {
      updateData.targetPrice = targetPrice
    }
    if (condition !== undefined && existingAlert.alertType === "Price") {
      updateData.condition = condition
    }
    if (orderBookThreshold !== undefined && existingAlert.alertType === "OrderBook") {
      updateData.orderBookThreshold = orderBookThreshold
    }

    // Update alert
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: updateData
    })

    res.json({
      success: true,
      alert,
      message: "Alert updated successfully"
    })
  } catch (error) {
    console.error("❌ Update Alert Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /alerts/:id
 * Delete an alert
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const alertId = parseInt(req.params.id)

    // Check if alert exists and belongs to user
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        userId
      }
    })

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found"
      })
    }

    // Delete alert
    await prisma.alert.delete({
      where: { id: alertId }
    })

    res.json({
      success: true,
      message: "Alert deleted successfully"
    })
  } catch (error) {
    console.error("❌ Delete Alert Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /alerts/triggered
 * Get triggered alerts for the authenticated user
 */
router.get("/triggered", authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    const alerts = await prisma.alert.findMany({
      where: {
        userId,
        isTriggered: true
      },
      orderBy: { triggeredAt: "desc" }
    })

    res.json({
      success: true,
      count: alerts.length,
      alerts
    })
  } catch (error) {
    console.error("❌ Get Triggered Alerts Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router
