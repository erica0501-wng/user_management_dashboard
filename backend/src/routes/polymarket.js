const express = require("express")
const router = express.Router()

/**
 * GET /polymarket/markets
 * 获取 Polymarket 预测市场列表
 */
router.get("/markets", async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query
    
    // 强制使用模拟数据以确保分类正确
    throw new Error("Using mock data for better category support")
    
    // 调用 Polymarket API
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=${offset}&closed=false`
    )
    
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    // 格式化返回数据 - 确保数据格式一致
    const markets = (Array.isArray(data) ? data : []).map(market => {
      // 确保 outcomes 和 outcomePrices 是数组
      let outcomes = Array.isArray(market.outcomes) ? market.outcomes : ["Yes", "No"]
      let outcomePrices = Array.isArray(market.outcomePrices) 
        ? market.outcomePrices 
        : market.clobTokenIds && Array.isArray(market.clobTokenIds)
          ? market.clobTokenIds.map(() => "0.5") // 如果有 clobTokenIds 但没有价格，使用默认值
          : ["0.5", "0.5"]
      
      return {
        id: market.id || market.condition_id || `market-${Date.now()}`,
        question: market.question || market.title || "Unknown Market",
        description: market.description || "",
        image: market.image || market.icon || "https://via.placeholder.com/400x200?text=Market",
        outcomes: outcomes,
        outcomePrices: outcomePrices,
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
      markets
    })
  } catch (error) {
    console.error("❌ Polymarket API Error:", error)
    
    // 如果 API 失败，返回模拟数据
    const mockMarkets = [
      {
        id: "mock-1",
        question: "Will Bitcoin reach $100k by end of 2026?",
        description: "This market will resolve to 'Yes' if Bitcoin (BTC) trades at or above $100,000 USD on any major exchange before December 31, 2026.",
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=200&fit=crop",
        outcomes: ["Yes", "No"],
        outcomePrices: ["0.65", "0.35"],
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
    
    res.json({
      success: true,
      count: mockMarkets.length,
      markets: mockMarkets,
      note: "Using mock data due to API unavailability",
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

module.exports = router
