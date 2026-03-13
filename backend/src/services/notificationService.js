const nodemailer = require("nodemailer")

/**
 * Notification Service
 * Handles sending notifications via email, Telegram, and Discord
 */

class NotificationService {
  constructor() {
    // Initialize email transporter (using environment variables for config)
    this.emailTransporter = null
    const smtpHost = (process.env.SMTP_HOST || "").trim()
    const smtpPort = (process.env.SMTP_PORT || "587").trim()
    const smtpSecure = (process.env.SMTP_SECURE || "false").trim()
    const smtpUser = (process.env.SMTP_USER || "").trim()
    const smtpPass = (process.env.SMTP_PASS || "").trim()

    if (smtpHost && smtpUser && smtpPass) {
      this.emailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpSecure === "true",
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      })
    }
  }

  getFromAddress() {
    return ((process.env.SMTP_FROM || process.env.SMTP_USER || "").trim())
  }

  /**
   * Send notification to all enabled channels
   */
  async sendAlertNotification(user, alert, triggerData, notificationSettings) {
    const notifications = []

    // Determine which channels to use
    const channels = alert.notificationChannels && alert.notificationChannels.length > 0
      ? alert.notificationChannels
      : notificationSettings?.defaultChannels || ["email"]

    // Prepare notification content
    const notificationContent = this.formatAlertNotification(alert, triggerData)

    // Send to each enabled channel
    for (const channel of channels) {
      try {
        if (channel === "email" && notificationSettings?.emailEnabled) {
          await this.sendEmailNotification(user.email, notificationContent)
          notifications.push({ channel: "email", success: true })
        } else if (channel === "discord" && notificationSettings?.discordEnabled && notificationSettings?.discordWebhookUrl) {
          await this.sendDiscordNotification(notificationSettings.discordWebhookUrl, notificationContent)
          notifications.push({ channel: "discord", success: true })
        }
      } catch (error) {
        console.error(`❌ Error sending ${channel} notification:`, error)
        notifications.push({ channel, success: false, error: error.message })
      }
    }

    return notifications
  }

  /**
   * Format alert notification content
   */
  formatAlertNotification(alert, triggerData) {
    const marketUrl = `https://polymarket.com/event/${alert.marketId}`
    
    let content = {
      subject: `🔔 Alert Triggered: ${alert.question}`,
      title: alert.question,
      outcome: alert.outcome,
      marketId: alert.marketId,
      marketUrl,
      triggerDetails: {}
    }

    if (alert.alertType === "Price") {
      content.triggerDetails = {
        type: "Price Alert",
        message: `Price ${alert.condition?.toLowerCase()} target`,
        currentPrice: triggerData.currentPrice?.toFixed(4) || "N/A",
        targetPrice: triggerData.targetPrice?.toFixed(4) || "N/A",
        condition: alert.condition
      }
    } else if (alert.alertType === "OrderBook") {
      content.triggerDetails = {
        type: "Order Book Alert",
        message: "Large order book detected",
        totalVolume: triggerData.totalVolume?.toFixed(2) || "N/A",
        threshold: triggerData.threshold?.toFixed(2) || "N/A",
        bidVolume: triggerData.bidVolume?.toFixed(2) || "N/A",
        askVolume: triggerData.askVolume?.toFixed(2) || "N/A"
      }
    }

    return content
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(email, content) {
    if (!this.emailTransporter) {
      console.log("⚠️ Email transporter not configured, skipping email notification")
      return
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">🔔 Alert Triggered</h2>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${content.title}</h3>
          <p><strong>Outcome:</strong> ${content.outcome}</p>
          <p><strong>${content.triggerDetails.type}</strong></p>
          <p>${content.triggerDetails.message}</p>
          ${Object.entries(content.triggerDetails)
            .filter(([key]) => !["type", "message"].includes(key))
            .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
            .join("\n")}
        </div>
        <div style="margin: 20px 0;">
          <a href="${content.marketUrl}" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            View Market & Trade
          </a>
        </div>
        <p style="color: #6B7280; font-size: 14px;">
          This is an automated alert from your Polymarket Alert System.
        </p>
      </div>
    `

    const textContent = `
🔔 Alert Triggered

${content.title}
Outcome: ${content.outcome}

${content.triggerDetails.type}
${content.triggerDetails.message}

${Object.entries(content.triggerDetails)
  .filter(([key]) => !["type", "message"].includes(key))
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}

View Market & Trade: ${content.marketUrl}

This is an automated alert from your Polymarket Alert System.
    `

    await this.emailTransporter.sendMail({
      from: this.getFromAddress(),
      to: email,
      subject: content.subject,
      text: textContent,
      html: htmlContent
    })

    console.log(`✅ Email notification sent to ${email}`)
  }

  /**
   * Send Discord notification
   */
  async sendDiscordNotification(webhookUrl, content) {
    const embed = {
      title: "🔔 Alert Triggered",
      description: content.title,
      color: 0x4F46E5, // Purple color
      fields: [
        {
          name: "Outcome",
          value: content.outcome,
          inline: false
        },
        {
          name: content.triggerDetails.type,
          value: content.triggerDetails.message,
          inline: false
        },
        ...Object.entries(content.triggerDetails)
          .filter(([key]) => !["type", "message"].includes(key))
          .map(([key, value]) => ({
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1"),
            value: value.toString(),
            inline: true
          }))
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "Polymarket Alert System"
      }
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [embed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: "View Market & Trade",
                url: content.marketUrl
              }
            ]
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Discord webhook error: ${error}`)
    }

    console.log(`✅ Discord notification sent`)
  }

  /**
   * Send auto-trade notification
   */
  async sendAutoTradeNotification(user, message, channels, notificationSettings) {
    const notifications = []

    // Prepare notification content
    const notificationContent = this.formatAutoTradeNotification(message)

    // Send to each enabled channel
    for (const channel of channels) {
      try {
        if (channel === "email" && notificationSettings?.emailEnabled) {
          await this.sendAutoTradeEmail(user.email, notificationContent)
          notifications.push({ channel: "email", success: true })
        } else if (channel === "discord" && notificationSettings?.discordEnabled && notificationSettings?.discordWebhookUrl) {
          await this.sendAutoTradeDiscord(notificationSettings.discordWebhookUrl, notificationContent)
          notifications.push({ channel: "discord", success: true })
        }
      } catch (error) {
        console.error(`❌ Error sending ${channel} notification:`, error)
        notifications.push({ channel, success: false, error: error.message })
      }
    }

    return notifications
  }

  /**
   * Format auto-trade notification content
   */
  formatAutoTradeNotification(message) {
    const isSuccess = !message.error
    const icon = isSuccess ? "🤖✅" : "🤖❌"
    
    return {
      subject: message.subject,
      icon,
      isSuccess,
      action: message.action,
      market: message.market,
      outcome: message.outcome,
      quantity: message.quantity,
      price: message.price,
      strategy: message.strategy,
      error: message.error,
      triggerDetails: message.triggerDetails
    }
  }

  /**
   * Send auto-trade email notification
   */
  async sendAutoTradeEmail(email, content) {
    if (!this.emailTransporter) {
      console.log("⚠️ Email transporter not configured, skipping email notification")
      return
    }

    const statusColor = content.isSuccess ? "#10B981" : "#EF4444"
    const statusBg = content.isSuccess ? "#D1FAE5" : "#FEE2E2"

    let detailsHtml = ""
    if (content.isSuccess) {
      detailsHtml = `
        <p><strong>Action:</strong> ${content.action}</p>
        <p><strong>Quantity:</strong> ${content.quantity} shares</p>
        <p><strong>Price:</strong> $${content.price?.toFixed(4) || "N/A"}</p>
        <p><strong>Total:</strong> $${(content.quantity * (content.price || 0)).toFixed(2)}</p>
        <p><strong>Strategy:</strong> ${content.strategy}</p>
      `
      
      if (content.triggerDetails) {
        if (content.triggerDetails.movingAverage) {
          detailsHtml += `<p><strong>Moving Average:</strong> $${content.triggerDetails.movingAverage.toFixed(4)}</p>`
        }
        if (content.triggerDetails.targetPrice) {
          detailsHtml += `<p><strong>Target Price:</strong> $${content.triggerDetails.targetPrice.toFixed(4)}</p>`
        }
      }
    } else {
      detailsHtml = `
        <div style="background-color: ${statusBg}; padding: 12px; border-radius: 6px; border-left: 4px solid ${statusColor};">
          <p style="margin: 0; color: ${statusColor};"><strong>Error:</strong> ${content.error}</p>
        </div>
        <p style="margin-top: 16px;"><strong>Attempted Action:</strong> ${content.action} ${content.quantity} shares</p>
      `
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${statusColor};">${content.icon} Auto-Trade ${content.isSuccess ? "Executed" : "Failed"}</h2>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${content.market}</h3>
          <p><strong>Outcome:</strong> ${content.outcome}</p>
          ${detailsHtml}
        </div>
        <p style="color: #6B7280; font-size: 14px;">
          This is an automated notification from your Auto-Trader System.
        </p>
      </div>
    `

    const textContent = `
${content.icon} Auto-Trade ${content.isSuccess ? "Executed" : "Failed"}

${content.market}
Outcome: ${content.outcome}
${content.isSuccess ? `
Action: ${content.action}
Quantity: ${content.quantity} shares
Price: $${content.price?.toFixed(4) || "N/A"}
Total: $${(content.quantity * (content.price || 0)).toFixed(2)}
Strategy: ${content.strategy}
` : `
Error: ${content.error}
Attempted Action: ${content.action} ${content.quantity} shares
`}

This is an automated notification from your Auto-Trader System.
    `

    await this.emailTransporter.sendMail({
      from: this.getFromAddress(),
      to: email,
      subject: content.subject,
      text: textContent,
      html: htmlContent
    })

    console.log(`✅ Auto-trade email sent to ${email}`)
  }

  /**
   * Send auto-trade Discord notification
   */
  async sendAutoTradeDiscord(webhookUrl, content) {
    const color = content.isSuccess ? 0x10B981 : 0xEF4444 // Green or Red

    const fields = [
      {
        name: "Market",
        value: content.market,
        inline: false
      },
      {
        name: "Outcome",
        value: content.outcome,
        inline: true
      }
    ]

    if (content.isSuccess) {
      fields.push(
        {
          name: "Action",
          value: content.action,
          inline: true
        },
        {
          name: "Quantity",
          value: `${content.quantity} shares`,
          inline: true
        },
        {
          name: "Price",
          value: `$${content.price?.toFixed(4) || "N/A"}`,
          inline: true
        },
        {
          name: "Total",
          value: `$${(content.quantity * (content.price || 0)).toFixed(2)}`,
          inline: true
        },
        {
          name: "Strategy",
          value: content.strategy,
          inline: true
        }
      )
    } else {
      fields.push({
        name: "❌ Error",
        value: content.error,
        inline: false
      })
    }

    const embed = {
      title: `${content.icon} Auto-Trade ${content.isSuccess ? "Executed" : "Failed"}`,
      color,
      fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: "Auto-Trader System"
      }
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Discord webhook error: ${error}`)
    }

    console.log(`✅ Auto-trade Discord notification sent`)
  }

  /**
   * Send generic activity notification for user actions (buy/sell/bet/rule updates)
   */
  async sendActivityNotification(user, activity, notificationSettings, channels = null) {
    const notifications = []
    const selectedChannels = channels && channels.length > 0
      ? channels
      : ["email", "discord"]

    const content = this.formatActivityNotification(activity)

    for (const channel of selectedChannels) {
      try {
        if (channel === "email" && notificationSettings?.emailEnabled) {
          await this.sendActivityEmail(user.email, content)
          notifications.push({ channel: "email", success: true })
        } else if (channel === "discord" && notificationSettings?.discordEnabled && notificationSettings?.discordWebhookUrl) {
          await this.sendActivityDiscord(notificationSettings.discordWebhookUrl, content)
          notifications.push({ channel: "discord", success: true })
        }
      } catch (error) {
        console.error(`❌ Error sending ${channel} activity notification:`, error)
        notifications.push({ channel, success: false, error: error.message })
      }
    }

    return notifications
  }

  /**
   * Normalize user activity payload
   */
  formatActivityNotification(activity) {
    return {
      subject: activity.subject || "Account Activity Update",
      title: activity.title || "Account Activity",
      description: activity.description || "A new account activity was detected.",
      details: activity.details || {},
      actionLabel: activity.actionLabel || "Open Dashboard",
      actionUrl: activity.actionUrl || "http://localhost:5173",
      color: activity.color || 0x2563EB
    }
  }

  /**
   * Send activity email notification
   */
  async sendActivityEmail(email, content) {
    if (!this.emailTransporter) {
      console.log("⚠️ Email transporter not configured, skipping email notification")
      return
    }

    const detailRows = Object.entries(content.details)
      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
      .join("\n")

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563EB;">🔔 ${content.title}</h2>
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>${content.description}</p>
          ${detailRows}
        </div>
        <div style="margin: 20px 0;">
          <a href="${content.actionUrl}" 
             style="background-color: #2563EB; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            ${content.actionLabel}
          </a>
        </div>
        <p style="color: #6B7280; font-size: 14px;">
          This is an automated notification from your trading dashboard.
        </p>
      </div>
    `

    const textDetails = Object.entries(content.details)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    const textContent = `
${content.title}

${content.description}

${textDetails}

${content.actionLabel}: ${content.actionUrl}

This is an automated notification from your trading dashboard.
    `

    await this.emailTransporter.sendMail({
      from: this.getFromAddress(),
      to: email,
      subject: content.subject,
      text: textContent,
      html: htmlContent
    })

    console.log(`✅ Activity email sent to ${email}`)
  }

  /**
   * Send activity Discord notification
   */
  async sendActivityDiscord(webhookUrl, content) {
    const fields = Object.entries(content.details).map(([key, value]) => ({
      name: key,
      value: String(value),
      inline: true
    }))

    const embed = {
      title: `🔔 ${content.title}`,
      description: content.description,
      color: content.color,
      fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: "Trading Dashboard"
      }
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [embed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: content.actionLabel,
                url: content.actionUrl
              }
            ]
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Discord webhook error: ${error}`)
    }

    console.log("✅ Activity Discord notification sent")
  }
}

module.exports = new NotificationService()
