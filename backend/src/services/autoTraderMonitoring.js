const { PrismaClient } = require("@prisma/client")
const notificationService = require("./notificationService")

const prisma = new PrismaClient()

/**
 * Auto-Trader Monitoring Service
 * Periodically checks market conditions and executes trades automatically
 * based on user-defined rules (price targets, moving averages, etc.)
 */

class AutoTraderMonitoringService {
  constructor() {
    this.isRunning = false
    this.checkInterval = 60000 // Check every 60 seconds
    this.intervalId = null
    this.priceHistory = new Map() // Store price history for moving average calculations
  }

  /**
   * Start the monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log("⚠️ Auto-trader monitoring service is already running")
      return
    }

    console.log("🤖 Starting auto-trader monitoring service...")
    this.isRunning = true
    
    // Run initial check
    this.checkAutoTraders()

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAutoTraders()
    }, this.checkInterval)

    console.log(`✅ Auto-trader monitoring service started (checking every ${this.checkInterval / 1000}s)`)
  }

  /**
   * Stop the monitoring service
   */
  stop() {
    if (!this.isRunning) {
      console.log("⚠️ Auto-trader monitoring service is not running")
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    console.log("🛑 Auto-trader monitoring service stopped")
  }

  /**
   * Main auto-trader checking function
   */
  async checkAutoTraders() {
    try {
      // Get all active auto-trader rules
      // We'll filter execution count in the evaluateTraderRule method
      const autoTraders = await prisma.autoTrader.findMany({
        where: {
          isActive: true
        }
      })

      if (autoTraders.length === 0) {
        console.log("🤖 No active auto-trader rules to check")
        return
      }

      console.log(`🔍 Checking ${autoTraders.length} auto-trader rules...`)

      // Group by market ID for efficient API calls
      const marketGroups = {}
      for (const trader of autoTraders) {
        if (!marketGroups[trader.marketId]) {
          marketGroups[trader.marketId] = []
        }
        marketGroups[trader.marketId].push(trader)
      }

      // Check each market
      for (const [marketId, traders] of Object.entries(marketGroups)) {
        await this.checkMarketTraders(marketId, traders)
      }

      console.log("✅ Auto-trader check completed")
    } catch (error) {
      console.error("❌ Error checking auto-traders:", error)
    }
  }

  /**
   * Check auto-trader rules for a specific market
   */
  async checkMarketTraders(marketId, traders) {
    try {
      // Fetch market data
      const marketData = await this.fetchMarketData(marketId)

      if (!marketData) {
        console.log(`⚠️ Could not fetch data for market ${marketId}`)
        return
      }

      // Update price history for moving average calculations
      this.updatePriceHistory(marketId, marketData)

      // Check each trader rule
      for (const trader of traders) {
        await this.evaluateTraderRule(trader, marketData)
        
        // Update last checked timestamp
        await prisma.autoTrader.update({
          where: { id: trader.id },
          data: { lastCheckedAt: new Date() }
        })
      }
    } catch (error) {
      console.error(`❌ Error checking traders for market ${marketId}:`, error)
    }
  }

  /**
   * Evaluate a single trader rule and execute if conditions are met
   */
  async evaluateTraderRule(trader, marketData) {
    try {
      // Check if max executions reached
      if (trader.maxExecutions > 0 && trader.executionCount >= trader.maxExecutions) {
        console.log(`⏸️ Auto-trader ${trader.id} has reached max executions (${trader.maxExecutions})`)
        await prisma.autoTrader.update({
          where: { id: trader.id },
          data: { isActive: false }
        })
        return
      }

      const currentPrice = this.getCurrentPrice(marketData, trader.outcome)
      if (currentPrice === null) {
        console.log(`⚠️ Could not get price for trader ${trader.id}`)
        return
      }

      let shouldExecute = false
      let triggerDetails = { currentPrice }

      switch (trader.strategyType) {
        case "PriceTarget":
          shouldExecute = this.checkPriceTarget(trader, currentPrice)
          triggerDetails.targetPrice = trader.targetPrice
          break

        case "MovingAverage":
          const movingAvg = this.calculateMovingAverage(trader.marketId, trader.movingAvgPeriod)
          shouldExecute = this.checkMovingAverage(trader, currentPrice, movingAvg)
          triggerDetails.movingAverage = movingAvg
          break

        case "PriceChange":
          // TODO: Implement price change percentage strategy
          console.log("⚠️ PriceChange strategy not yet implemented")
          break
      }

      if (shouldExecute) {
        await this.executeTrade(trader, triggerDetails)
      }
    } catch (error) {
      console.error(`❌ Error evaluating trader rule ${trader.id}:`, error)
    }
  }

  /**
   * Check if price target condition is met
   */
  checkPriceTarget(trader, currentPrice) {
    const { triggerCondition, targetPrice } = trader

    switch (triggerCondition) {
      case "Above":
        return currentPrice >= targetPrice
      case "Below":
        return currentPrice <= targetPrice
      default:
        return false
    }
  }

  /**
   * Check if moving average condition is met
   */
  checkMovingAverage(trader, currentPrice, movingAvg) {
    if (movingAvg === null) {
      console.log(`⚠️ Not enough price history for moving average calculation`)
      return false
    }

    const { triggerCondition } = trader

    switch (triggerCondition) {
      case "CrossAbove":
        return currentPrice > movingAvg
      case "CrossBelow":
        return currentPrice < movingAvg
      default:
        return false
    }
  }

  /**
   * Execute trade automatically
   */
  async executeTrade(trader, triggerDetails) {
    try {
      console.log(`🤖 Executing auto-trade for rule ${trader.id}...`)
      console.log(`  Market: ${trader.question}`)
      console.log(`  Action: ${trader.action} ${trader.quantity} shares`)
      console.log(`  Trigger: ${JSON.stringify(triggerDetails)}`)

      // Get user's account balance
      const accountBalance = await prisma.accountBalance.findUnique({
        where: { userId: trader.userId }
      })

      if (!accountBalance) {
        throw new Error(`No account balance found for user ${trader.userId}`)
      }

      const currentPrice = triggerDetails.currentPrice
      const totalCost = trader.quantity * currentPrice

      // Check if user has enough funds for buy orders
      if (trader.action === "Buy" && accountBalance.availableCash < totalCost) {
        console.log(`⚠️ Insufficient funds for auto-trade ${trader.id}. Required: $${totalCost}, Available: $${accountBalance.availableCash}`)
        
        // Send notification about failed execution
        await this.sendFailureNotification(trader, "Insufficient funds", triggerDetails)
        return
      }

      // Execute the trade based on action
      if (trader.action === "Buy") {
        await this.executeBuy(trader, currentPrice, totalCost)
      } else if (trader.action === "Sell") {
        await this.executeSell(trader, currentPrice)
      }

      // Update execution count
      await prisma.autoTrader.update({
        where: { id: trader.id },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date()
        }
      })

      // Send success notification
      if (trader.notifyOnExecution) {
        await this.sendExecutionNotification(trader, triggerDetails, true)
      }

      console.log(`✅ Auto-trade executed successfully for rule ${trader.id}`)
    } catch (error) {
      console.error(`❌ Error executing trade for rule ${trader.id}:`, error)
      await this.sendFailureNotification(trader, error.message, triggerDetails)
    }
  }

  /**
   * Execute buy trade
   */
  async executeBuy(trader, currentPrice, totalCost) {
    // Check if position already exists
    let position = await prisma.polymarketPosition.findFirst({
      where: {
        userId: trader.userId,
        marketId: trader.marketId,
        outcome: trader.outcome,
        status: "Open"
      }
    })

    if (position) {
      // Update existing position
      const newShares = position.shares + trader.quantity
      const newTotalCost = position.totalCost + totalCost
      const newAvgPrice = newTotalCost / newShares

      position = await prisma.polymarketPosition.update({
        where: { id: position.id },
        data: {
          shares: newShares,
          totalCost: newTotalCost,
          avgPrice: newAvgPrice,
          currentPrice: currentPrice
        }
      })
    } else {
      // Create new position
      position = await prisma.polymarketPosition.create({
        data: {
          userId: trader.userId,
          marketId: trader.marketId,
          question: trader.question,
          outcome: trader.outcome,
          shares: trader.quantity,
          avgPrice: currentPrice,
          totalCost: totalCost,
          currentPrice: currentPrice,
          status: "Open"
        }
      })
    }

    // Update account balance
    await prisma.accountBalance.update({
      where: { userId: trader.userId },
      data: {
        availableCash: { decrement: totalCost },
        totalInvested: { increment: totalCost }
      }
    })

    // Create order record
    await prisma.order.create({
      data: {
        userId: trader.userId,
        symbol: trader.marketId,
        name: `${trader.question} - ${trader.outcome} (Auto)`,
        direction: "Buy",
        price: currentPrice,
        quantity: Math.floor(trader.quantity),
        orderType: "Market",
        status: "Filled"
      }
    })
  }

  /**
   * Execute sell trade
   */
  async executeSell(trader, currentPrice) {
    // Find position to sell
    const position = await prisma.polymarketPosition.findFirst({
      where: {
        userId: trader.userId,
        marketId: trader.marketId,
        outcome: trader.outcome,
        status: "Open"
      }
    })

    if (!position) {
      throw new Error("No open position found to sell")
    }

    if (position.shares < trader.quantity) {
      throw new Error(`Insufficient shares. Have ${position.shares}, trying to sell ${trader.quantity}`)
    }

    const saleProceeds = trader.quantity * currentPrice
    const costBasis = (position.totalCost / position.shares) * trader.quantity
    const profitLoss = saleProceeds - costBasis

    if (position.shares === trader.quantity) {
      // Close entire position
      await prisma.polymarketPosition.update({
        where: { id: position.id },
        data: {
          status: "Closed",
          currentPrice: currentPrice
        }
      })
    } else {
      // Partial sell
      const remainingShares = position.shares - trader.quantity
      const remainingCost = position.totalCost - costBasis

      await prisma.polymarketPosition.update({
        where: { id: position.id },
        data: {
          shares: remainingShares,
          totalCost: remainingCost,
          avgPrice: remainingCost / remainingShares,
          currentPrice: currentPrice
        }
      })
    }

    // Update account balance
    await prisma.accountBalance.update({
      where: { userId: trader.userId },
      data: {
        availableCash: { increment: saleProceeds },
        totalInvested: { decrement: costBasis }
      }
    })

    // Create order record
    await prisma.order.create({
      data: {
        userId: trader.userId,
        symbol: trader.marketId,
        name: `${trader.question} - ${trader.outcome} (Auto)`,
        direction: "Sell",
        price: currentPrice,
        quantity: Math.floor(trader.quantity),
        orderType: "Market",
        status: "Filled"
      }
    })
  }

  /**
   * Send notification about successful trade execution
   */
  async sendExecutionNotification(trader, triggerDetails, success) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: trader.userId }
      })

      const notificationSettings = await prisma.notificationSettings.findUnique({
        where: { userId: trader.userId }
      })

      if (!user || !notificationSettings) {
        return
      }

      const message = {
        subject: `🤖 Auto-Trade Executed: ${trader.action} ${trader.question}`,
        action: trader.action,
        market: trader.question,
        outcome: trader.outcome,
        quantity: trader.quantity,
        price: triggerDetails.currentPrice,
        strategy: trader.strategyType,
        triggerDetails
      }

      // Send to configured channels
      const channels = trader.notificationChannels
      const results = await notificationService.sendAutoTradeNotification(
        user,
        message,
        channels,
        notificationSettings
      )

      console.log(`📧 Auto-trade notifications sent:`, results)
    } catch (error) {
      console.error(`❌ Error sending execution notification:`, error)
    }
  }

  /**
   * Send notification about failed trade execution
   */
  async sendFailureNotification(trader, errorMessage, triggerDetails) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: trader.userId }
      })

      const notificationSettings = await prisma.notificationSettings.findUnique({
        where: { userId: trader.userId }
      })

      if (!user || !notificationSettings) {
        return
      }

      const message = {
        subject: `❌ Auto-Trade Failed: ${trader.action} ${trader.question}`,
        action: trader.action,
        market: trader.question,
        outcome: trader.outcome,
        quantity: trader.quantity,
        error: errorMessage,
        strategy: trader.strategyType,
        triggerDetails
      }

      const channels = trader.notificationChannels
      await notificationService.sendAutoTradeNotification(
        user,
        message,
        channels,
        notificationSettings
      )
    } catch (error) {
      console.error(`❌ Error sending failure notification:`, error)
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
   * Update price history for moving average calculations
   */
  updatePriceHistory(marketId, marketData) {
    try {
      if (!this.priceHistory.has(marketId)) {
        this.priceHistory.set(marketId, [])
      }

      const history = this.priceHistory.get(marketId)
      const timestamp = Date.now()

      // Store prices for all outcomes
      if (marketData.outcomes && marketData.outcomePrices) {
        marketData.outcomes.forEach((outcome, index) => {
          const price = parseFloat(marketData.outcomePrices[index])
          history.push({
            timestamp,
            outcome,
            price
          })
        })
      }

      // Keep only last 30 days of data
      const thirtyDaysAgo = timestamp - (30 * 24 * 60 * 60 * 1000)
      this.priceHistory.set(
        marketId,
        history.filter(entry => entry.timestamp > thirtyDaysAgo)
      )
    } catch (error) {
      console.error("Error updating price history:", error)
    }
  }

  /**
   * Calculate moving average for a market
   */
  calculateMovingAverage(marketId, period) {
    try {
      if (!this.priceHistory.has(marketId)) {
        return null
      }

      const history = this.priceHistory.get(marketId)
      
      // We need at least 'period' data points
      if (history.length < period) {
        return null
      }

      // Get last 'period' prices
      const recentPrices = history.slice(-period).map(entry => entry.price)
      const sum = recentPrices.reduce((acc, price) => acc + price, 0)
      
      return sum / recentPrices.length
    } catch (error) {
      console.error("Error calculating moving average:", error)
      return null
    }
  }
}

// Export singleton instance
module.exports = new AutoTraderMonitoringService()
