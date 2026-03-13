const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const authenticate = require("../middleware/auth")
const notificationService = require("../services/notificationService")

const prisma = new PrismaClient()
const dashboardBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173"

async function sendPolymarketActivityNotification(userId, activity, channels = null) {
  try {
    const [user, notificationSettings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.notificationSettings.findUnique({ where: { userId } })
    ])

    if (!user || !notificationSettings) return
    await notificationService.sendActivityNotification(user, activity, notificationSettings, channels)
  } catch (error) {
    console.error("Polymarket notification error:", error.message)
  }
}

/**
 * GET /polymarket/markets
 * 获取 Polymarket 预测市场列表
 */
router.get("/markets", async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query
    
    // Try to call Polymarket API first
    console.log("📡 Attempting to fetch from Polymarket API...")
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=${offset}&closed=false`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    )
    
    if (!response.ok) {
      console.log(`⚠️ Polymarket API returned status: ${response.status}`)
      throw new Error(`Polymarket API error: ${response.status}`)
    }
    
    const data = await response.json()
    console.log(`✅ Successfully fetched ${Array.isArray(data) ? data.length : 'data'} markets from Polymarket API`)
    
    // 格式化返回数据 - 确保数据格式一致
    const markets = (Array.isArray(data) ? data : []).map(market => {
      // Parse outcomes if it's a string
      let outcomes = market.outcomes
      if (typeof outcomes === 'string') {
        try {
          outcomes = JSON.parse(outcomes)
        } catch (e) {
          outcomes = ["Yes", "No"]
        }
      } else if (!Array.isArray(outcomes)) {
        outcomes = ["Yes", "No"]
      }
      
      // Parse outcomePrices if it's a string
      let outcomePrices = market.outcomePrices
      if (typeof outcomePrices === 'string') {
        try {
          outcomePrices = JSON.parse(outcomePrices)
        } catch (e) {
          outcomePrices = outcomes.map(() => "0.5")
        }
      } else if (!Array.isArray(outcomePrices)) {
        outcomePrices = outcomes.map(() => "0.5")
      }
      
      // Parse clobTokenIds if it's a string
      let tokenIds = []
      if (market.clobTokenIds) {
        try {
          tokenIds = typeof market.clobTokenIds === 'string' 
            ? JSON.parse(market.clobTokenIds) 
            : market.clobTokenIds
        } catch (e) {
          console.log('Failed to parse clobTokenIds:', e)
        }
      }
      
      // Create tokens array mapping outcomes to token IDs
      const tokens = outcomes.map((outcome, index) => ({
        outcome,
        tokenId: tokenIds[index] || null
      }))
      
      return {
        id: market.id || market.condition_id || `market-${Date.now()}`,
        question: market.question || market.title || "Unknown Market",
        description: market.description || "",
        image: market.image || market.icon || "https://via.placeholder.com/400x200?text=Market",
        outcomes: outcomes,
        outcomePrices: outcomePrices,
        tokens: tokens, // Add tokens array with outcome-to-tokenId mapping
        volume: market.volume || market.volume24hr || "0",
        liquidity: market.liquidity || "0",
        endDate: market.endDate || market.end_date_iso || market.closesAt || null,
        active: market.active !== undefined ? market.active : !market.closed,
        createdAt: market.createdAt || market.created_at || new Date().toISOString()
      }
    })
    
    res.json({
      success: true,
      count: markets.length,
      markets,
      source: "polymarket-api"
    })
  } catch (error) {
    console.error("❌ Polymarket API Error:", error.message)
    
    // 如果 API 失败，返回模拟数据
    const mockMarkets = [
      {
        id: "mock-1",
        question: "Will Bitcoin reach $100k by end of 2026?",
        description: "This market will resolve to 'Yes' if Bitcoin (BTC) trades at or above $100,000 USD on any major exchange before December 31, 2026.",
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.65", "0.35"],
        tokens: [
          { outcome: "Yes", tokenId: "mock-1-yes-token" },
          { outcome: "No", tokenId: "mock-1-no-token" }
        ],
        volume: "1234567.89",
        liquidity: "234567.89",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-01T00:00:00Z"
      },
      {
        id: "mock-2",
        question: "Will there be a recession in 2026?",
        description: "This market resolves to 'Yes' if the US economy enters a recession (two consecutive quarters of negative GDP growth) in 2026.",
        image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.42", "0.58"],
        tokens: [
          { outcome: "Yes", tokenId: "mock-2-yes-token" },
          { outcome: "No", tokenId: "mock-2-no-token" }
        ],
        volume: "987654.32",
        liquidity: "123456.78",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-01T00:00:00Z"
      },
      {
        id: "mock-3",
        question: "Will AI surpass human performance in coding by 2027?",
        description: "This market will resolve to 'Yes' if an AI system can independently complete complex software projects better than the average professional developer.",
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.58", "0.42"],
        volume: "567890.12",
        liquidity: "89012.34",
        endDate: "2027-01-01T23:59:59Z",
        active: true,
        createdAt: "2026-01-15T00:00:00Z"
      },
      {
        id: "mock-4",
        question: "Will Ethereum ETF launch before July 2026?",
        description: "This market will resolve to 'Yes' if a spot Ethereum ETF is approved and begins trading in the US before July 1, 2026.",
        image: "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.72", "0.28"],
        volume: "856432.10",
        liquidity: "156789.23",
        endDate: "2026-07-01T00:00:00Z",
        active: true,
        createdAt: "2026-02-01T00:00:00Z"
      },
      {
        id: "mock-5",
        question: "Will Trump win the 2028 US Presidential Election?",
        description: "This market resolves to 'Yes' if Donald Trump wins the 2028 US Presidential Election.",
        image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.38", "0.62"],
        volume: "2456789.45",
        liquidity: "456123.89",
        endDate: "2028-11-08T00:00:00Z",
        active: true,
        createdAt: "2026-01-20T00:00:00Z"
      },
      {
        id: "mock-6",
        question: "Will Lakers win NBA Championship 2026?",
        description: "This market will resolve to 'Yes' if the Los Angeles Lakers win the 2026 NBA Championship.",
        image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.25", "0.75"],
        volume: "345678.90",
        liquidity: "78901.23",
        endDate: "2026-06-30T23:59:59Z",
        active: true,
        createdAt: "2026-01-10T00:00:00Z"
      },
      {
        id: "mock-7",
        question: "Will Apple announce AR glasses in 2026?",
        description: "This market resolves to 'Yes' if Apple officially announces augmented reality glasses for consumer release in 2026.",
        image: "https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.48", "0.52"],
        volume: "678912.34",
        liquidity: "123456.78",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-05T00:00:00Z"
      },
      {
        id: "mock-8",
        question: "Will stock market hit new all-time high in Q2 2026?",
        description: "This market resolves to 'Yes' if the S&P 500 reaches a new all-time high during Q2 2026 (April-June).",
        image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.62", "0.38"],
        volume: "1123456.78",
        liquidity: "234567.89",
        endDate: "2026-06-30T23:59:59Z",
        active: true,
        createdAt: "2026-01-01T00:00:00Z"
      },
      {
        id: "mock-9",
        question: "Will any movie gross $2B worldwide in 2026?",
        description: "This market resolves to 'Yes' if at least one movie reaches $2 billion in worldwide box office revenue in 2026.",
        image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.55", "0.45"],
        volume: "234567.89",
        liquidity: "56789.12",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-12T00:00:00Z"
      },
      {
        id: "mock-10",
        question: "Will DeFi TVL exceed $200B by end of 2026?",
        description: "This market will resolve to 'Yes' if Total Value Locked in DeFi protocols exceeds $200 billion by December 31, 2026.",
        image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.45", "0.55"],
        volume: "456789.12",
        liquidity: "89012.34",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-02-01T00:00:00Z"
      },
      {
        id: "mock-11",
        question: "Will US Fed cut interest rates by 1% in 2026?",
        description: "This market resolves to 'Yes' if the Federal Reserve cuts interest rates by at least 1 percentage point cumulatively in 2026.",
        image: "https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.52", "0.48"],
        volume: "789123.45",
        liquidity: "145678.90",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-15T00:00:00Z"
      },
      {
        id: "mock-12",
        question: "Will Manchester City win Premier League 2025-26?",
        description: "This market resolves to 'Yes' if Manchester City wins the 2025-26 Premier League season.",
        image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.68", "0.32"],
        volume: "567890.23",
        liquidity: "98765.43",
        endDate: "2026-05-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-08T00:00:00Z"
      },
      {
        id: "mock-13",
        question: "Will global temperature rise by 1.5°C by 2030?",
        description: "This market resolves to 'Yes' if global average temperature increases by 1.5°C above pre-industrial levels by 2030.",
        image: "https://images.unsplash.com/photo-1569163139394-de4798aa62b6?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.54", "0.46"],
        volume: "345678.90",
        liquidity: "67890.12",
        endDate: "2030-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-18T00:00:00Z"
      },
      {
        id: "mock-14",
        question: "Will there be a major volcanic eruption in 2026?",
        description: "This market resolves to 'Yes' if a volcanic eruption with VEI 5 or higher occurs anywhere in the world in 2026.",
        image: "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.15", "0.85"],
        volume: "123456.78",
        liquidity: "23456.78",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-25T00:00:00Z"
      },
      {
        id: "mock-15",
        question: "Will SpaceX successfully land humans on Mars by 2030?",
        description: "This market resolves to 'Yes' if SpaceX successfully lands human astronauts on Mars before 2030.",
        image: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.22", "0.78"],
        volume: "987654.32",
        liquidity: "187654.32",
        endDate: "2030-01-01T00:00:00Z",
        active: true,
        createdAt: "2026-02-10T00:00:00Z"
      },
      {
        id: "mock-16",
        question: "Will Taylor Swift have a new album in 2026?",
        description: "This market resolves to 'Yes' if Taylor Swift releases a new studio album in 2026.",
        image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.78", "0.22"],
        volume: "345678.90",
        liquidity: "67890.12",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-02-05T00:00:00Z"
      },
      {
        id: "mock-17",
        question: "Will Netflix gain 50M subscribers in 2026?",
        description: "This market resolves to 'Yes' if Netflix adds at least 50 million new subscribers in 2026.",
        image: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.44", "0.56"],
        volume: "456789.12",
        liquidity: "89012.34",
        endDate: "2026-12-31T23:59:59Z",
        active: true,
        createdAt: "2026-01-22T00:00:00Z"
      }
    ]
    console.log("📦 Using mock data as fallback")
    res.json({
      success: true,
      count: mockMarkets.length,
      markets: mockMarkets,
      source: "mock-data",
      note: "Using mock data - Polymarket API unavailable or blocked",
      reason: "Using mock data due to API unavailability",
      error: error.message
    })
  }
})

/**
 * GET /polymarket/markets/:id
 * 获取单个市场详情
 */
router.get("/markets/:id", async (req, res) => {
  try {
    const { id } = req.params
    
    const response = await fetch(`https://gamma-api.polymarket.com/markets/${id}`)
    
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`)
    }
    
    const market = await response.json()
    
    res.json({
      success: true,
      market
    })
  } catch (error) {
    console.error("❌ Polymarket API Error:", error)
    
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/trending
 * 获取热门市场
 */
router.get("/trending", async (req, res) => {
  try {
    const response = await fetch(
      "https://gamma-api.polymarket.com/markets?limit=10&offset=0&closed=false&order=volume&ascending=false"
    )
    
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    res.json({
      success: true,
      count: data.length,
      markets: data
    })
  } catch (error) {
    console.error("❌ Polymarket Trending Error:", error)
    
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /polymarket/trade
 * 执行预测市场交易
 */
router.post("/trade", authenticate, async (req, res) => {
  try {
    const { marketId, question, outcome, shares, price } = req.body
    const userId = req.user.id

    // Validate inputs
    if (!marketId || !question || !outcome || !shares || !price) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      })
    }

    const sharesNum = parseFloat(shares)
    const priceNum = parseFloat(price)

    if (isNaN(sharesNum) || sharesNum <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid shares amount"
      })
    }

    if (isNaN(priceNum) || priceNum <= 0 || priceNum > 1) {
      return res.status(400).json({
        success: false,
        error: "Invalid price (must be between 0 and 1)"
      })
    }

    const totalCost = sharesNum * priceNum

    // Check user balance - create if doesn't exist
    let balance = await prisma.accountBalance.findUnique({
      where: { userId }
    })

    // If user doesn't have a balance record, create one with default $100,000
    if (!balance) {
      balance = await prisma.accountBalance.create({
        data: {
          userId,
          availableCash: 100000,
          totalInvested: 0
        }
      })
    }

    if (balance.availableCash < totalCost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient funds. Required: $${totalCost.toFixed(2)}, Available: $${balance.availableCash.toFixed(2)}`
      })
    }

    // Check if position already exists for this market and outcome
    const existingPosition = await prisma.polymarketPosition.findFirst({
      where: {
        userId,
        marketId,
        outcome,
        status: "Open"
      }
    })

    let position
    if (existingPosition) {
      // Update existing position (average price calculation)
      const newTotalShares = existingPosition.shares + sharesNum
      const newTotalCost = existingPosition.totalCost + totalCost
      const newAvgPrice = newTotalCost / newTotalShares

      position = await prisma.polymarketPosition.update({
        where: { id: existingPosition.id },
        data: {
          shares: newTotalShares,
          totalCost: newTotalCost,
          avgPrice: newAvgPrice,
          currentPrice: priceNum
        }
      })
    } else {
      // Create new position
      position = await prisma.polymarketPosition.create({
        data: {
          userId,
          marketId,
          question,
          outcome,
          shares: sharesNum,
          avgPrice: priceNum,
          totalCost,
          currentPrice: priceNum,
          status: "Open"
        }
      })
    }

    // Deduct from user balance and increase invested amount
    await prisma.accountBalance.update({
      where: { userId },
      data: {
        availableCash: { decrement: totalCost },
        totalInvested: { increment: totalCost }
      }
    })

    // Create order record for transaction history
    const order = await prisma.order.create({
      data: {
        userId,
        symbol: marketId,
        name: `${question} - ${outcome}`,
        direction: "Buy",
        price: priceNum,
        quantity: Math.floor(sharesNum),
        orderType: "Market",
        status: "Filled"
      }
    })

    await sendPolymarketActivityNotification(userId, {
      subject: `🎯 Bet Placed: ${outcome}`,
      title: "Polymarket Bet Placed",
      description: `You placed a bet on \"${question}\".`,
      details: {
        Market: question,
        Outcome: outcome,
        Shares: sharesNum.toFixed(2),
        Price: `$${priceNum.toFixed(4)}`,
        Cost: `$${totalCost.toFixed(2)}`,
        Action: "Buy"
      },
      actionLabel: "View Market",
      actionUrl: `${dashboardBaseUrl}/polymarket/details/${marketId}`,
      color: 0x2563EB
    })

    res.json({
      success: true,
      position,
      order,
      message: `Successfully purchased ${sharesNum} shares of "${outcome}" for $${totalCost.toFixed(2)}`
    })
  } catch (error) {
    console.error("❌ Polymarket Trade Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/positions
 * 获取用户的预测市场持仓
 */
router.get("/positions", authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    const positions = await prisma.polymarketPosition.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    })

    // Calculate total stats
    const totalInvested = positions.reduce((sum, p) => sum + p.totalCost, 0)
    const totalShares = positions.reduce((sum, p) => sum + p.shares, 0)
    
    // Calculate current value (if currentPrice is available)
    const currentValue = positions.reduce((sum, p) => {
      return sum + (p.currentPrice ? p.shares * p.currentPrice : p.totalCost)
    }, 0)

    const totalPnL = currentValue - totalInvested
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

    res.json({
      success: true,
      positions,
      stats: {
        totalPositions: positions.length,
        totalInvested,
        totalShares,
        currentValue,
        totalPnL,
        totalPnLPercent
      }
    })
  } catch (error) {
    console.error("❌ Polymarket Positions Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /polymarket/positions/:id/close
 * 平仓预测市场持仓
 */
router.post("/positions/:id/close", authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const { closePrice } = req.body
    const userId = req.user.id

    if (!closePrice || isNaN(parseFloat(closePrice))) {
      return res.status(400).json({
        success: false,
        error: "Invalid close price"
      })
    }

    const closePriceNum = parseFloat(closePrice)

    // Find position
    const position = await prisma.polymarketPosition.findFirst({
      where: {
        id: parseInt(id),
        userId,
        status: "Open"
      }
    })

    if (!position) {
      return res.status(404).json({
        success: false,
        error: "Position not found or already closed"
      })
    }

    // Calculate returns
    const proceeds = position.shares * closePriceNum
    const pnl = proceeds - position.totalCost
    const pnlPercent = (pnl / position.totalCost) * 100

    // Update position status
    await prisma.polymarketPosition.update({
      where: { id: parseInt(id) },
      data: {
        status: "Closed",
        currentPrice: closePriceNum
      }
    })

    // Return funds to user
    await prisma.accountBalance.update({
      where: { userId },
      data: {
        availableCash: { increment: proceeds },
        totalInvested: { decrement: position.totalCost }
      }
    })

    // Create order record for sell transaction
    const order = await prisma.order.create({
      data: {
        userId,
        symbol: position.marketId,
        name: `${position.question} - ${position.outcome}`,
        direction: "Sell",
        price: closePriceNum,
        quantity: Math.floor(position.shares),
        orderType: "Market",
        status: "Filled"
      }
    })

    await sendPolymarketActivityNotification(userId, {
      subject: `💰 Position Closed: ${position.outcome}`,
      title: "Polymarket Position Closed",
      description: `Your position has been closed for \"${position.question}\".`,
      details: {
        Market: position.question,
        Outcome: position.outcome,
        Shares: position.shares.toFixed(2),
        "Close Price": `$${closePriceNum.toFixed(4)}`,
        Proceeds: `$${proceeds.toFixed(2)}`,
        "P&L": `$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`
      },
      actionLabel: "View Positions",
      actionUrl: `${dashboardBaseUrl}/polymarket`,
      color: pnl >= 0 ? 0x10B981 : 0xEF4444
    })

    res.json({
      success: true,
      message: `Position closed. P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`,
      proceeds,
      pnl,
      pnlPercent,
      order
    })
  } catch (error) {
    console.error("❌ Polymarket Close Position Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/orderbook/:tokenId
 * Get order book data for a specific market outcome
 * Polymarket uses CLOB (Central Limit Order Book) API
 */
router.get("/orderbook/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params
    
    console.log(`📊 Attempting to fetch order book for token: ${tokenId}`)
    
    // Check if tokenId is valid (should be a long number string or contains 'mock')
    if (!tokenId || tokenId === 'null' || tokenId === 'undefined') {
      throw new Error(`Invalid token ID: ${tokenId}`)
    }
    
    // If it's a mock token, return mock data immediately
    if (tokenId.includes('mock') || tokenId.includes('token')) {
      console.log('📦 Detected mock token ID, returning mock data without API call')
      throw new Error('Mock token ID detected - using mock data')
    }
    
    // Try to fetch from Polymarket CLOB API
    const url = `https://clob.polymarket.com/book?token_id=${tokenId}`
    console.log(`📊 Fetching from: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    })
    
    console.log(`📊 CLOB API Response Status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log(`📊 CLOB API Error Response: ${errorText}`)
      throw new Error(`Polymarket CLOB API error: ${response.status} - ${errorText}`)
    }
    
    const orderBook = await response.json()
    console.log(`✅ Successfully fetched order book from CLOB API - Bids: ${orderBook.bids?.length}, Asks: ${orderBook.asks?.length}`)
    
    // Calculate order book depth metrics
    const bids = orderBook.bids || []
    const asks = orderBook.asks || []
    
    const bidVolume = bids.reduce((sum, bid) => sum + parseFloat(bid.size || 0), 0)
    const askVolume = asks.reduce((sum, ask) => sum + parseFloat(ask.size || 0), 0)
    const totalVolume = bidVolume + askVolume
    
    // Calculate spread
    const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : 0
    const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : 0
    const spread = bestAsk - bestBid
    const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0
    
    res.json({
      success: true,
      source: "clob-api",
      tokenId,
      timestamp: orderBook.timestamp || new Date().toISOString(),
      bids: bids.slice(0, 20), // Top 20 bids
      asks: asks.slice(0, 20), // Top 20 asks
      metrics: {
        bidVolume,
        askVolume,
        totalVolume,
        bestBid,
        bestAsk,
        spread,
        spreadPercent,
        depth: {
          bids: bids.length,
          asks: asks.length
        }
      }
    })
  } catch (error) {
    console.error("❌ Polymarket Order Book Error:", error.message)
    
    // Return mock order book data if API fails
    const mockOrderBook = {
      success: true,
      source: "mock-data",
      tokenId: req.params.tokenId,
      timestamp: new Date().toISOString(),
      bids: [
        { price: "0.65", size: "1250", total: "812.50" },
        { price: "0.64", size: "2100", total: "1344.00" },
        { price: "0.63", size: "890", total: "560.70" },
        { price: "0.62", size: "1500", total: "930.00" },
        { price: "0.61", size: "3200", total: "1952.00" },
        { price: "0.60", size: "1800", total: "1080.00" },
        { price: "0.59", size: "950", total: "560.50" },
        { price: "0.58", size: "1200", total: "696.00" },
        { price: "0.57", size: "2400", total: "1368.00" },
        { price: "0.56", size: "1650", total: "924.00" }
      ],
      asks: [
        { price: "0.66", size: "980", total: "646.80" },
        { price: "0.67", size: "1450", total: "971.50" },
        { price: "0.68", size: "2200", total: "1496.00" },
        { price: "0.69", size: "1100", total: "759.00" },
        { price: "0.70", size: "1900", total: "1330.00" },
        { price: "0.71", size: "850", total: "603.50" },
        { price: "0.72", size: "1600", total: "1152.00" },
        { price: "0.73", size: "1300", total: "949.00" },
        { price: "0.74", size: "2100", total: "1554.00" },
        { price: "0.75", size: "1750", total: "1312.50" }
      ],
      metrics: {
        bidVolume: 17940,
        askVolume: 15230,
        totalVolume: 33170,
        bestBid: 0.65,
        bestAsk: 0.66,
        spread: 0.01,
        spreadPercent: 1.54,
        depth: {
          bids: 10,
          asks: 10
        }
      },
      note: "Using mock data - CLOB API unavailable or requires authentication",
      reason: error.message
    }
    
    console.log('📦 Returning mock order book data')
    res.json(mockOrderBook)
  }
})

/**
 * GET /polymarket/market/:marketId/orderbooks
 * Get order books for all outcomes of a market
 */
router.get("/market/:marketId/orderbooks", async (req, res) => {
  try {
    const { marketId } = req.params
    
    // In a real implementation, you would:
    // 1. Fetch market details to get token IDs for each outcome
    // 2. Fetch order book for each token ID
    // 3. Aggregate and return
    
    // For now, return mock data structure
    res.json({
      success: true,
      marketId,
      orderBooks: {
        "Yes": {
          tokenId: `${marketId}-yes`,
          bestBid: 0.65,
          bestAsk: 0.66,
          bidVolume: 17940,
          askVolume: 15230,
          totalVolume: 33170
        },
        "No": {
          tokenId: `${marketId}-no`,
          bestBid: 0.34,
          bestAsk: 0.35,
          bidVolume: 15230,
          askVolume: 17940,
          totalVolume: 33170
        }
      },
      note: "Simplified order book summary for market outcomes"
    })
  } catch (error) {
    console.error("❌ Polymarket Market Order Books Error:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router
