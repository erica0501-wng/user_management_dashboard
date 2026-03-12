const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const authenticate = require("../middleware/auth")
const notificationService = require("../services/notificationService")

const prisma = new PrismaClient()

/**
 * GET /notifications/settings
 * Get notification settings for the authenticated user
 */
router.get("/settings", authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    console.log("📖 Get Settings for user:", userId)

    let settings = await prisma.notificationSettings.findUnique({
      where: { userId }
    })

    // Create default settings if they don't exist
    if (!settings) {
      console.log("✨ Creating default settings for user:", userId)
      settings = await prisma.notificationSettings.create({
        data: {
          userId,
          emailEnabled: true,
          discordEnabled: false,
          defaultChannels: ["email"]
        }
      })
    }

    console.log("✅ Settings found/created:", { userId, settingsId: settings.id })
    res.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error("❌ Get Notification Settings Error:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PUT /notifications/settings
 * Update notification settings for the authenticated user
 */
router.put("/settings", authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const {
      emailEnabled,
      discordEnabled,
      discordWebhookUrl,
      discordChannelName,
      defaultChannels
    } = req.body

    console.log("📝 Update Settings Request:", {
      userId,
      emailEnabled,
      discordEnabled,
      discordWebhookUrl: discordWebhookUrl ? "***" : null,
      discordChannelName,
      defaultChannels
    })

    // Validate default channels
    if (defaultChannels) {
      const validChannels = ["email", "discord"]
      const invalidChannels = defaultChannels.filter(c => !validChannels.includes(c))
      if (invalidChannels.length > 0) {
        console.error("❌ Invalid channels:", invalidChannels)
        return res.status(400).json({
          success: false,
          error: `Invalid channels: ${invalidChannels.join(", ")}`
        })
      }
    }

    // Validate Discord webhook URL format (only if provided and not empty)
    if (discordWebhookUrl && discordWebhookUrl.trim() !== "") {
      const isValidDiscordUrl = 
        discordWebhookUrl.startsWith("https://discord.com/api/webhooks/") ||
        discordWebhookUrl.startsWith("https://discordapp.com/api/webhooks/")
      
      if (!isValidDiscordUrl) {
        console.error("❌ Invalid Discord URL:", discordWebhookUrl)
        return res.status(400).json({
          success: false,
          error: "Invalid Discord webhook URL format"
        })
      }
    }

    // Prepare update data
    const updateData = {}
    if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled
    if (discordEnabled !== undefined) updateData.discordEnabled = discordEnabled
    if (discordWebhookUrl !== undefined) updateData.discordWebhookUrl = discordWebhookUrl
    if (discordChannelName !== undefined) updateData.discordChannelName = discordChannelName
    if (defaultChannels !== undefined) updateData.defaultChannels = defaultChannels

    // Upsert notification settings
    const settings = await prisma.notificationSettings.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        emailEnabled: emailEnabled ?? true,
        discordEnabled: discordEnabled ?? false,
        discordWebhookUrl,
        discordChannelName,
        defaultChannels: defaultChannels ?? ["email"]
      }
    })

    res.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error("❌ Update Notification Settings Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /notifications/discord/test
 * Test Discord webhook
 */
router.post("/discord/test", authenticate, async (req, res) => {
  try {
    const { webhookUrl } = req.body

    if (!webhookUrl) {
      return res.status(400).json({
        success: false,
        error: "webhookUrl is required"
      })
    }

    // Send test message
    const testContent = {
      title: "Test Alert",
      outcome: "Yes",
      marketId: "test",
      marketUrl: "https://polymarket.com",
      triggerDetails: {
        type: "Test Notification",
        message: "This is a test notification from your Polymarket Alert System"
      }
    }

    await notificationService.sendDiscordNotification(webhookUrl, testContent)

    res.json({
      success: true,
      message: "Test notification sent successfully"
    })
  } catch (error) {
    console.error("❌ Discord Test Error:", error)
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /notifications/test
 * Send test notification to all enabled channels
 */
router.post("/test", authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    // Get user and settings
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    const settings = await prisma.notificationSettings.findUnique({
      where: { userId }
    })

    if (!settings) {
      return res.status(400).json({
        success: false,
        error: "Notification settings not configured"
      })
    }

    // Create test alert data
    const testAlert = {
      question: "Will Bitcoin reach $100,000 by end of 2026?",
      outcome: "Yes",
      marketId: "test-market",
      alertType: "Price",
      condition: "Above",
      notificationChannels: settings.defaultChannels
    }

    const testTriggerData = {
      currentPrice: 0.75,
      targetPrice: 0.70,
      condition: "Above"
    }

    // Send test notification
    const results = await notificationService.sendAlertNotification(
      user,
      testAlert,
      testTriggerData,
      settings
    )

    res.json({
      success: true,
      message: "Test notifications sent",
      results
    })
  } catch (error) {
    console.error("❌ Test Notification Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /notifications/discord/disconnect
 * Disconnect Discord integration
 */
router.delete("/discord/disconnect", authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    const settings = await prisma.notificationSettings.update({
      where: { userId },
      data: {
        discordEnabled: false,
        discordWebhookUrl: null,
        discordChannelName: null
      }
    })

    res.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error("❌ Disconnect Discord Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router
