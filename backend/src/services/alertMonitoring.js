const { PrismaClient } = require("@prisma/client")
const notificationService = require("./notificationService")

const prisma = new PrismaClient()

/**
 * Alert Monitoring Service
 * Periodically checks market prices and order books to trigger user alerts
 */

class AlertMonitoringService {
  constructor() {
    this.isRunning = false
    this.checkInterval = 60000 // Check every 60 seconds
    this.intervalId = null
  }

  /**
   * Start the monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log("⚠️ Alert monitoring service is already running")
      return
    }

    console.log("🚀 Starting alert monitoring service...")
    this.isRunning = true
    
    // Run initial check
    this.checkAlerts()

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAlerts()
    }, this.checkInterval)

    console.log(`✅ Alert monitoring service started (checking every ${this.checkInterval / 1000}s)`)
  }

  /**
   * Stop the monitoring service
   */
  stop() {
    if (!this.isRunning) {
      console.log("⚠️ Alert monitoring service is not running")
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    console.log("🛑 Alert monitoring service stopped")
  }

  /**
   * Main alert checking function
   */
  async checkAlerts() {
    try {
      // Get all active alerts
      const alerts = await prisma.alert.findMany({
        where: {
          isActive: true,
          isTriggered: false
        }
      })

      if (alerts.length === 0) {
        console.log("📭 No active alerts to check")
        return
      }

      console.log(`🔍 Checking ${alerts.length} active alerts...`)

      // Group alerts by market ID for efficient API calls
      const marketGroups = {}
      for (const alert of alerts) {
        if (!marketGroups[alert.marketId]) {
          marketGroups[alert.marketId] = []
        }
        marketGroups[alert.marketId].push(alert)
      }

      // Check each market
      for (const [marketId, marketAlerts] of Object.entries(marketGroups)) {
        await this.checkMarketAlerts(marketId, marketAlerts)
      }

      console.log("✅ Alert check completed")
    } catch (error) {
      console.error("❌ Error checking alerts:", error)
    }
  }

  /**
   * Check alerts for a specific market
   */
  async checkMarketAlerts(marketId, alerts) {
    try {
      // Fetch market data from Polymarket API
      const marketData = await this.fetchMarketData(marketId)

      if (!marketData) {
        console.log(`⚠️ Could not fetch data for market ${marketId}`)
        return
      }

      // Check each alert for this market
      for (const alert of alerts) {
        if (alert.alertType === "Price") {
          await this.checkPriceAlert(alert, marketData)
        } else if (alert.alertType === "OrderBook") {
          await this.checkOrderBookAlert(alert, marketData)
        }
      }
    } catch (error) {
      console.error(`❌ Error checking alerts for market ${marketId}:`, error)
    }
  }

  /**
   * Check if a price alert should be triggered
   */
  async checkPriceAlert(alert, marketData) {
    try {
      // Find the current price for the specific outcome
      const currentPrice = this.getCurrentPrice(marketData, alert.outcome)

      if (currentPrice === null) {
        console.log(`⚠️ Could not find price for outcome "${alert.outcome}" in market ${alert.marketId}`)
        return
      }

      const targetPrice = alert.targetPrice
      const condition = alert.condition

      let shouldTrigger = false

      if (condition === "Above" && currentPrice >= targetPrice) {
        shouldTrigger = true
      } else if (condition === "Below" && currentPrice <= targetPrice) {
        shouldTrigger = true
      }

      if (shouldTrigger) {
        await this.triggerAlert(alert, {
          currentPrice,
          targetPrice,
          condition
        })
        console.log(`🔔 Price alert triggered! Market: ${alert.question}, Outcome: ${alert.outcome}, Price: ${currentPrice} (target: ${condition} ${targetPrice})`)
      }
    } catch (error) {
      console.error(`❌ Error checking price alert ${alert.id}:`, error)
    }
  }

  /**
   * Check if an order book alert should be triggered
   */
  async checkOrderBookAlert(alert, marketData) {
    try {
      // Fetch order book data for the specific outcome
      const orderBookData = await this.fetchOrderBookData(alert.marketId, alert.outcome)

      if (!orderBookData) {
        console.log(`⚠️ Could not fetch order book for market ${alert.marketId}, outcome ${alert.outcome}`)
        return
      }

      const totalVolume = orderBookData.metrics?.totalVolume || 0
      const threshold = alert.orderBookThreshold

      if (totalVolume >= threshold) {
        await this.triggerAlert(alert, {
          totalVolume,
          threshold,
          bidVolume: orderBookData.metrics?.bidVolume || 0,
          askVolume: orderBookData.metrics?.askVolume || 0
        })
        console.log(`🔔 Order book alert triggered! Market: ${alert.question}, Volume: ${totalVolume} (threshold: ${threshold})`)
      }
    } catch (error) {
      console.error(`❌ Error checking order book alert ${alert.id}:`, error)
    }
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(alert, triggerData) {
    try {
      // Update alert status
      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          isTriggered: true,
          triggeredAt: new Date()
        }
      })

      // Fetch user and notification settings
      const user = await prisma.user.findUnique({
        where: { id: alert.userId }
      })

      const notificationSettings = await prisma.notificationSettings.findUnique({
        where: { userId: alert.userId }
      })

      // Send notifications
      if (user && notificationSettings) {
        try {
          const results = await notificationService.sendAlertNotification(
            user,
            alert,
            triggerData,
            notificationSettings
          )
          console.log(`📧 Notifications sent:`, results)
        } catch (notificationError) {
          console.error(`❌ Error sending notifications for alert ${alert.id}:`, notificationError)
          // Don't fail the entire alert trigger if notifications fail
        }
      } else {
        console.log(`⚠️ No notification settings found for user ${alert.userId}, skipping notifications`)
      }

      console.log(`✅ Alert ${alert.id} triggered and saved`)
    } catch (error) {
      console.error(`❌ Error triggering alert ${alert.id}:`, error)
    }
  }

  /**
   * Fetch market data from Polymarket API
   */
  async fetchMarketData(marketId) {
    try {
      const response = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Error fetching market ${marketId}:`, error)
      return null
    }
  }

  /**
   * Get current price for a specific outcome
   */
  getCurrentPrice(marketData, outcome) {
    try {
      if (!marketData.outcomes || !marketData.outcomePrices) {
        return null
      }

      const outcomeIndex = marketData.outcomes.indexOf(outcome)
      if (outcomeIndex === -1) {
        return null
      }

      const price = parseFloat(marketData.outcomePrices[outcomeIndex])
      return isNaN(price) ? null : price
    } catch (error) {
      console.error("Error getting current price:", error)
      return null
    }
  }

  /**
   * Fetch order book data
   */
  async fetchOrderBookData(marketId, outcome) {
    try {
      // In a real implementation, you would:
      // 1. Get the token ID for this market/outcome combination
      // 2. Fetch order book from CLOB API
      
      // For now, return mock data
      return {
        metrics: {
          totalVolume: Math.random() * 50000 + 10000, // Random volume between 10k-60k
          bidVolume: Math.random() * 25000 + 5000,
          askVolume: Math.random() * 25000 + 5000
        }
      }
    } catch (error) {
      console.error(`Error fetching order book for market ${marketId}:`, error)
      return null
    }
  }
}

// Create singleton instance
const alertMonitoringService = new AlertMonitoringService()

module.exports = alertMonitoringService
