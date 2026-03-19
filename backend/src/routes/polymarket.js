const express = require("express")
const router = express.Router()
const { PrismaClient } = require("@prisma/client")
const authenticate = require("../middleware/auth")
const notificationService = require("../services/notificationService")
const polymarketDataArchiver = require("../services/polymarketDataArchiver")

const prisma = new PrismaClient()
const dashboardBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173"

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function isMockFallbackEnabled() {
  return process.env.POLYMARKET_ENABLE_MOCK_FALLBACK === "true"
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }

  return fallback
}

function buildOutcomeTokens(market) {
  const outcomes = parseJsonArray(market?.outcomes, ["Yes", "No"])
  const tokenIds = parseJsonArray(market?.clobTokenIds, [])

  return outcomes.map((outcome, index) => ({
    outcome: String(outcome),
    tokenId: tokenIds[index] ? String(tokenIds[index]) : null
  }))
}

async function fetchOrderBookFromClob(tokenId) {
  const normalizedTokenId = String(tokenId || "").trim()

  if (!normalizedTokenId || normalizedTokenId === "null" || normalizedTokenId === "undefined") {
    throw new Error(`Invalid token ID: ${tokenId}`)
  }

  const url = `https://clob.polymarket.com/book?token_id=${normalizedTokenId}`
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json"
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Polymarket CLOB API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

function buildOrderBookMetrics(orderBook) {
  const bids = Array.isArray(orderBook?.bids) ? orderBook.bids : []
  const asks = Array.isArray(orderBook?.asks) ? orderBook.asks : []

  const bidVolume = bids.reduce((sum, bid) => {
    const size = parseFloat(bid.size || 0)
    return sum + (Number.isFinite(size) ? size : 0)
  }, 0)

  const askVolume = asks.reduce((sum, ask) => {
    const size = parseFloat(ask.size || 0)
    return sum + (Number.isFinite(size) ? size : 0)
  }, 0)

  const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : 0
  const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : 0
  const spread = bestAsk - bestBid
  const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0

  return {
    bids,
    asks,
    metrics: {
      bidVolume,
      askVolume,
      totalVolume: bidVolume + askVolume,
      bestBid,
      bestAsk,
      spread,
      spreadPercent,
      depth: {
        bids: bids.length,
        asks: asks.length
      }
    }
  }
}

function buildMockOrderBookPayload(tokenId, reason) {
  return {
    success: true,
    source: "mock-data",
    tokenId,
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
    reason
  }
}

function toPercent(numerator, denominator) {
  if (!denominator || denominator <= 0) {
    return 0
  }
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function getArchiveIntervalMs() {
  return parsePositiveInt(process.env.POLYMARKET_ARCHIVE_INTERVAL_MS, 5 * 60 * 1000)
}

function alignToInterval(date, intervalMs) {
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs)
}

function buildExpectedIntervals(windowStart, now, intervalMs) {
  const startAligned = alignToInterval(windowStart, intervalMs).getTime()
  const nowAligned = alignToInterval(now, intervalMs).getTime()
  const expected = []

  for (let time = startAligned; time <= nowAligned; time += intervalMs) {
    expected.push(time)
  }

  return expected
}

function findMissingIntervalsByKey(records, keyField, expectedIntervals, maxMissingPerKey = 50) {
  const intervalSets = new Map()
  const metadata = new Map()
  const expectedSet = new Set(expectedIntervals)

  for (const record of records) {
    const key = String(record[keyField])
    const current = intervalSets.get(key) || new Set()
    current.add(new Date(record.intervalStart).getTime())
    intervalSets.set(key, current)

    if (!metadata.has(key)) {
      metadata.set(key, record)
    }
  }

  const expectedCount = expectedIntervals.length
  const gaps = []

  for (const [key, presentIntervals] of intervalSets.entries()) {
    const missingIntervals = []
    let presentWithinExpected = 0

    for (const time of expectedIntervals) {
      if (!presentIntervals.has(time)) {
        missingIntervals.push(new Date(time).toISOString())
      } else {
        presentWithinExpected += 1
      }
    }

    // Ignore out-of-horizon rows when computing coverage; only expected buckets count.
    if (presentWithinExpected === 0 && expectedSet.size > 0) {
      continue
    }

    if (missingIntervals.length === 0) {
      continue
    }

    const meta = metadata.get(key) || {}
    gaps.push({
      key,
      marketId: meta.marketId || null,
      tokenId: meta.tokenId || null,
      outcome: meta.outcome || null,
      question: meta.question || null,
      expectedIntervals: expectedCount,
      presentIntervals: presentWithinExpected,
      missingIntervalsCount: missingIntervals.length,
      coveragePct: toPercent(presentWithinExpected, expectedCount),
      missingIntervals: missingIntervals.slice(0, maxMissingPerKey)
    })
  }

  return gaps.sort((a, b) => b.missingIntervalsCount - a.missingIntervalsCount)
}

function buildCoverageByInterval(records, keyField) {
  const byInterval = new Map()

  for (const record of records) {
    const intervalMs = new Date(record.intervalStart).getTime()
    const key = String(record[keyField])
    const setForInterval = byInterval.get(intervalMs) || new Set()
    setForInterval.add(key)
    byInterval.set(intervalMs, setForInterval)
  }

  return byInterval
}

function buildReplayWindows(expectedIntervals, timeline) {
  const windows = []
  let currentWindow = null

  for (const intervalMs of expectedIntervals) {
    const entry = timeline.get(intervalMs)

    if (entry && entry.isReplayable) {
      if (!currentWindow) {
        currentWindow = {
          startMs: intervalMs,
          endMs: intervalMs,
          buckets: 1,
          minMarketCoveragePct: entry.marketCoveragePct,
          minOrderBookCoveragePct: entry.orderBookCoveragePct
        }
      } else {
        currentWindow.endMs = intervalMs
        currentWindow.buckets += 1
        currentWindow.minMarketCoveragePct = Math.min(
          currentWindow.minMarketCoveragePct,
          entry.marketCoveragePct
        )
        currentWindow.minOrderBookCoveragePct = Math.min(
          currentWindow.minOrderBookCoveragePct,
          entry.orderBookCoveragePct
        )
      }
    } else if (currentWindow) {
      windows.push({
        start: new Date(currentWindow.startMs).toISOString(),
        end: new Date(currentWindow.endMs).toISOString(),
        buckets: currentWindow.buckets,
        minMarketCoveragePct: Number(currentWindow.minMarketCoveragePct.toFixed(2)),
        minOrderBookCoveragePct: Number(currentWindow.minOrderBookCoveragePct.toFixed(2))
      })
      currentWindow = null
    }
  }

  if (currentWindow) {
    windows.push({
      start: new Date(currentWindow.startMs).toISOString(),
      end: new Date(currentWindow.endMs).toISOString(),
      buckets: currentWindow.buckets,
      minMarketCoveragePct: Number(currentWindow.minMarketCoveragePct.toFixed(2)),
      minOrderBookCoveragePct: Number(currentWindow.minOrderBookCoveragePct.toFixed(2))
    })
  }

  return windows
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback
  }

  if (typeof value === "boolean") {
    return value
  }

  const normalized = String(value).trim().toLowerCase()
  if (["true", "1", "yes"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false
  }

  return fallback
}

function parseDateInput(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getArchiveIngestSecret() {
  return process.env.ARCHIVE_CRON_SECRET || process.env.CRON_SECRET || ""
}

function isArchiveIngestAuthorized(req) {
  const secret = getArchiveIngestSecret()

  if (!secret) {
    return process.env.NODE_ENV !== "production"
  }

  const authHeader = String(req.headers.authorization || "").trim()
  if (authHeader === `Bearer ${secret}`) {
    return true
  }

  const querySecret = req.query?.secret ? String(req.query.secret) : ""
  if (querySecret && querySecret === secret) {
    return true
  }

  return false
}

async function createArchiveQualityReport(windowHours) {
  const intervalMs = getArchiveIntervalMs()
  const intervalMinutes = Math.max(1, Math.floor(intervalMs / 60000))
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000)
  const expectedIntervals = buildExpectedIntervals(windowStart, now, intervalMs).length

  const [
    totalMarketSnapshots,
    totalOrderBookSnapshots,
    distinctMarketRows,
    distinctTokenRows,
    latestMarketSnapshot,
    latestOrderBookSnapshot
  ] = await Promise.all([
    prisma.polymarketMarketSnapshot.count({
      where: {
        intervalStart: {
          gte: windowStart
        }
      }
    }),
    prisma.polymarketOrderBookSnapshot.count({
      where: {
        intervalStart: {
          gte: windowStart
        }
      }
    }),
    prisma.polymarketMarketSnapshot.findMany({
      where: {
        intervalStart: {
          gte: windowStart
        }
      },
      distinct: ["marketId"],
      select: {
        marketId: true
      }
    }),
    prisma.polymarketOrderBookSnapshot.findMany({
      where: {
        intervalStart: {
          gte: windowStart
        }
      },
      distinct: ["tokenId"],
      select: {
        tokenId: true
      }
    }),
    prisma.polymarketMarketSnapshot.findFirst({
      where: {
        intervalStart: {
          gte: windowStart
        }
      },
      orderBy: {
        intervalStart: "desc"
      },
      select: {
        intervalStart: true
      }
    }),
    prisma.polymarketOrderBookSnapshot.findFirst({
      where: {
        intervalStart: {
          gte: windowStart
        }
      },
      orderBy: {
        intervalStart: "desc"
      },
      select: {
        intervalStart: true
      }
    })
  ])

  const distinctMarkets = distinctMarketRows.length
  const distinctTokens = distinctTokenRows.length

  const expectedMarketSnapshots = distinctMarkets * expectedIntervals
  const expectedOrderBookSnapshots = distinctTokens * expectedIntervals

  const marketCoveragePct = toPercent(totalMarketSnapshots, expectedMarketSnapshots)
  const orderBookCoveragePct = toPercent(totalOrderBookSnapshots, expectedOrderBookSnapshots)

  const latestSnapshotTime = [
    latestMarketSnapshot?.intervalStart || null,
    latestOrderBookSnapshot?.intervalStart || null
  ].filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] || null

  const staleMinutes = latestSnapshotTime
    ? Math.max(0, Math.floor((now.getTime() - latestSnapshotTime.getTime()) / 60000))
    : null

  const notes =
    staleMinutes !== null && staleMinutes > intervalMinutes * 2
      ? "Latest snapshot appears stale relative to configured archive interval"
      : null

  return prisma.polymarketDataQualityReport.create({
    data: {
      windowHours,
      intervalMinutes,
      expectedIntervals,
      distinctMarkets,
      distinctTokens,
      totalMarketSnapshots,
      totalOrderBookSnapshots,
      marketCoveragePct,
      orderBookCoveragePct,
      staleMinutes,
      notes
    }
  })
}

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

    if (!isMockFallbackEnabled()) {
      return res.status(502).json({
        success: false,
        source: "polymarket-api",
        error: "Failed to fetch markets from Polymarket API",
        detail: error.message,
        hint: "Set POLYMARKET_ENABLE_MOCK_FALLBACK=true to allow mock fallback responses"
      })
    }
    
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

    const orderBook = await fetchOrderBookFromClob(tokenId)
    console.log(`✅ Successfully fetched order book from CLOB API - Bids: ${orderBook.bids?.length}, Asks: ${orderBook.asks?.length}`)

    const normalized = buildOrderBookMetrics(orderBook)
    
    res.json({
      success: true,
      source: "clob-api",
      tokenId,
      timestamp: orderBook.timestamp || new Date().toISOString(),
      bids: normalized.bids.slice(0, 20),
      asks: normalized.asks.slice(0, 20),
      metrics: normalized.metrics
    })
  } catch (error) {
    console.error("❌ Polymarket Order Book Error:", error.message)

    if (!isMockFallbackEnabled()) {
      return res.status(502).json({
        success: false,
        source: "clob-api",
        tokenId: req.params.tokenId,
        error: "Failed to fetch order book from Polymarket CLOB API",
        detail: error.message,
        hint: "Set POLYMARKET_ENABLE_MOCK_FALLBACK=true to allow mock fallback responses"
      })
    }

    const mockOrderBook = buildMockOrderBookPayload(req.params.tokenId, error.message)
    
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

    const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json"
      }
    })

    if (!marketResponse.ok) {
      const errorText = await marketResponse.text()
      throw new Error(`Polymarket market details API error: ${marketResponse.status} - ${errorText}`)
    }

    const market = await marketResponse.json()
    const outcomeTokens = buildOutcomeTokens(market).filter((entry) => Boolean(entry.tokenId))

    if (outcomeTokens.length === 0) {
      return res.status(404).json({
        success: false,
        marketId,
        error: "No CLOB token IDs found for this market"
      })
    }

    const settledBooks = await Promise.allSettled(
      outcomeTokens.map(async (entry) => {
        const rawBook = await fetchOrderBookFromClob(entry.tokenId)
        const normalized = buildOrderBookMetrics(rawBook)

        return {
          outcome: entry.outcome,
          tokenId: entry.tokenId,
          bestBid: normalized.metrics.bestBid,
          bestAsk: normalized.metrics.bestAsk,
          bidVolume: normalized.metrics.bidVolume,
          askVolume: normalized.metrics.askVolume,
          totalVolume: normalized.metrics.totalVolume,
          spread: normalized.metrics.spread,
          spreadPercent: normalized.metrics.spreadPercent,
          bidDepth: normalized.metrics.depth.bids,
          askDepth: normalized.metrics.depth.asks,
          bids: normalized.bids.slice(0, 20),
          asks: normalized.asks.slice(0, 20),
          timestamp: rawBook.timestamp || new Date().toISOString()
        }
      })
    )

    const orderBooks = {}
    const failures = []

    settledBooks.forEach((result, index) => {
      const entry = outcomeTokens[index]
      const label = entry.outcome || `Outcome ${index + 1}`

      if (result.status === "fulfilled") {
        orderBooks[label] = result.value
        return
      }

      failures.push({
        outcome: label,
        tokenId: entry.tokenId,
        error: result.reason?.message || "Unknown failure"
      })
    })

    if (Object.keys(orderBooks).length === 0) {
      const detail = failures.map((failure) => `${failure.outcome}: ${failure.error}`).join(" | ")

      if (!isMockFallbackEnabled()) {
        return res.status(502).json({
          success: false,
          marketId,
          source: "clob-api",
          error: "Failed to fetch order books for all market outcomes",
          detail,
          hint: "Set POLYMARKET_ENABLE_MOCK_FALLBACK=true to allow mock fallback responses"
        })
      }

      const fallbackOrderBooks = {}
      for (const entry of outcomeTokens) {
        const fallback = buildMockOrderBookPayload(entry.tokenId, detail)
        fallbackOrderBooks[entry.outcome] = {
          tokenId: entry.tokenId,
          bestBid: fallback.metrics.bestBid,
          bestAsk: fallback.metrics.bestAsk,
          bidVolume: fallback.metrics.bidVolume,
          askVolume: fallback.metrics.askVolume,
          totalVolume: fallback.metrics.totalVolume,
          spread: fallback.metrics.spread,
          spreadPercent: fallback.metrics.spreadPercent,
          bidDepth: fallback.metrics.depth.bids,
          askDepth: fallback.metrics.depth.asks,
          bids: fallback.bids,
          asks: fallback.asks,
          source: "mock-data",
          reason: detail
        }
      }

      return res.json({
        success: true,
        marketId,
        source: "mock-data",
        orderBooks: fallbackOrderBooks,
        failures,
        note: "Using mock order books because all CLOB requests failed"
      })
    }

    res.json({
      success: true,
      marketId,
      source: "clob-api",
      count: Object.keys(orderBooks).length,
      failedOutcomes: failures.length,
      failures,
      orderBooks
    })
  } catch (error) {
    console.error("❌ Polymarket Market Order Books Error:", error)

    if (!isMockFallbackEnabled()) {
      return res.status(502).json({
        success: false,
        source: "polymarket-api",
        error: "Failed to fetch market order books",
        detail: error.message,
        hint: "Set POLYMARKET_ENABLE_MOCK_FALLBACK=true to allow mock fallback responses"
      })
    }

    const fallbackOrderBooks = {
      Yes: {
        tokenId: `${req.params.marketId}-yes`,
        bestBid: 0.65,
        bestAsk: 0.66,
        bidVolume: 17940,
        askVolume: 15230,
        totalVolume: 33170,
        source: "mock-data"
      },
      No: {
        tokenId: `${req.params.marketId}-no`,
        bestBid: 0.34,
        bestAsk: 0.35,
        bidVolume: 15230,
        askVolume: 17940,
        totalVolume: 33170,
        source: "mock-data"
      }
    }

    res.json({
      success: true,
      marketId: req.params.marketId,
      source: "mock-data",
      orderBooks: fallbackOrderBooks,
      note: "Using mock data because upstream market/orderbook APIs are unavailable",
      reason: error.message
    })
  }
})

/**
 * GET /polymarket/archive/status
 * Summary of archive health in a recent time window
 */
router.get("/archive/status", async (req, res) => {
  try {
    const windowHours = parsePositiveInt(req.query.windowHours, 24)
    const intervalMs = getArchiveIntervalMs()
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

    const [
      marketSnapshotCount,
      orderBookSnapshotCount,
      distinctMarketRows,
      distinctTokenRows,
      latestMarketSnapshot,
      latestOrderBookSnapshot,
      latestReport
    ] = await Promise.all([
      prisma.polymarketMarketSnapshot.count({
        where: { intervalStart: { gte: windowStart } }
      }),
      prisma.polymarketOrderBookSnapshot.count({
        where: { intervalStart: { gte: windowStart } }
      }),
      prisma.polymarketMarketSnapshot.findMany({
        where: { intervalStart: { gte: windowStart } },
        distinct: ["marketId"],
        select: { marketId: true }
      }),
      prisma.polymarketOrderBookSnapshot.findMany({
        where: { intervalStart: { gte: windowStart } },
        distinct: ["tokenId"],
        select: { tokenId: true }
      }),
      prisma.polymarketMarketSnapshot.findFirst({
        where: { intervalStart: { gte: windowStart } },
        orderBy: { intervalStart: "desc" },
        select: { intervalStart: true }
      }),
      prisma.polymarketOrderBookSnapshot.findFirst({
        where: { intervalStart: { gte: windowStart } },
        orderBy: { intervalStart: "desc" },
        select: { intervalStart: true }
      }),
      prisma.polymarketDataQualityReport.findFirst({
        orderBy: { generatedAt: "desc" }
      })
    ])

    const expectedIntervals = buildExpectedIntervals(windowStart, now, intervalMs).length
    const distinctMarkets = distinctMarketRows.length
    const distinctTokens = distinctTokenRows.length
    const expectedMarketSnapshots = distinctMarkets * expectedIntervals
    const expectedOrderBookSnapshots = distinctTokens * expectedIntervals

    const marketCoveragePct = toPercent(marketSnapshotCount, expectedMarketSnapshots)
    const orderBookCoveragePct = toPercent(orderBookSnapshotCount, expectedOrderBookSnapshots)

    const latestSnapshotTime = [
      latestMarketSnapshot?.intervalStart || null,
      latestOrderBookSnapshot?.intervalStart || null
    ].filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] || null

    const staleMinutes = latestSnapshotTime
      ? Math.max(0, Math.floor((now.getTime() - latestSnapshotTime.getTime()) / 60000))
      : null

    res.json({
      success: true,
      windowHours,
      intervalMinutes: Math.floor(intervalMs / 60000),
      expectedIntervals,
      summary: {
        distinctMarkets,
        distinctTokens,
        marketSnapshotCount,
        orderBookSnapshotCount,
        marketCoveragePct,
        orderBookCoveragePct,
        staleMinutes,
        latestSnapshotAt: latestSnapshotTime ? latestSnapshotTime.toISOString() : null
      },
      latestQualityReport: latestReport
    })
  } catch (error) {
    console.error("[error] Polymarket archive status failed:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/archive/gaps
 * Missing interval details by marketId or tokenId
 */
router.get("/archive/gaps", async (req, res) => {
  try {
    const type = req.query.type === "orderbook" ? "orderbook" : "market"
    const windowHours = parsePositiveInt(req.query.windowHours, 24)
    const limit = Math.min(parsePositiveInt(req.query.limit, 30), 200)
    const maxMissingPerKey = Math.min(parsePositiveInt(req.query.maxMissingPerKey, 40), 300)
    const useObservedSpan = parseBoolean(req.query.useObservedSpan, true)
    const intervalMs = getArchiveIntervalMs()
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

    const records =
      type === "market"
        ? await prisma.polymarketMarketSnapshot.findMany({
            where: {
              intervalStart: {
                gte: windowStart,
                lte: now
              }
            },
            select: {
              marketId: true,
              question: true,
              intervalStart: true
            }
          })
        : await prisma.polymarketOrderBookSnapshot.findMany({
            where: {
              intervalStart: {
                gte: windowStart,
                lte: now
              }
            },
            select: {
              tokenId: true,
              marketId: true,
              outcome: true,
              intervalStart: true
            }
          })

    let analysisStart = windowStart
    let analysisEnd = now
    let analysisMode = "window"

    if (useObservedSpan && records.length > 0) {
      const intervalTimes = records
        .map((record) => new Date(record.intervalStart).getTime())
        .filter((value) => Number.isFinite(value))

      if (intervalTimes.length > 0) {
        const observedStart = new Date(Math.min(...intervalTimes))
        const observedEnd = new Date(Math.max(...intervalTimes))

        if (observedEnd >= observedStart) {
          analysisStart = new Date(Math.max(windowStart.getTime(), observedStart.getTime()))
          analysisEnd = new Date(Math.min(now.getTime(), observedEnd.getTime()))
          analysisMode = "observed-span"
        }
      }
    }

    const expectedIntervals = buildExpectedIntervals(analysisStart, analysisEnd, intervalMs)

    const keyField = type === "market" ? "marketId" : "tokenId"
    const allGaps = findMissingIntervalsByKey(
      records,
      keyField,
      expectedIntervals,
      maxMissingPerKey
    )

    res.json({
      success: true,
      type,
      windowHours,
      intervalMinutes: Math.floor(intervalMs / 60000),
      requestedWindow: {
        start: windowStart.toISOString(),
        end: now.toISOString()
      },
      analysisWindow: {
        start: analysisStart.toISOString(),
        end: analysisEnd.toISOString(),
        mode: analysisMode
      },
      expectedIntervals: expectedIntervals.length,
      keysWithData: new Set(records.map((record) => String(record[keyField]))).size,
      keysWithGaps: allGaps.length,
      gaps: allGaps.slice(0, limit)
    })
  } catch (error) {
    console.error("[error] Polymarket archive gap analysis failed:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/archive/replay-windows
 * Build contiguous time windows with enough coverage for archive replay
 */
router.get("/archive/replay-windows", async (req, res) => {
  try {
    const windowHours = parsePositiveInt(req.query.windowHours, 24)
    const minCoveragePct = Math.min(parsePositiveInt(req.query.minCoveragePct, 90), 100)
    const intervalMs = getArchiveIntervalMs()
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000)
    const expectedIntervals = buildExpectedIntervals(windowStart, now, intervalMs)

    const [marketRows, orderBookRows] = await Promise.all([
      prisma.polymarketMarketSnapshot.findMany({
        where: { intervalStart: { gte: windowStart } },
        select: {
          marketId: true,
          intervalStart: true
        }
      }),
      prisma.polymarketOrderBookSnapshot.findMany({
        where: { intervalStart: { gte: windowStart } },
        select: {
          tokenId: true,
          intervalStart: true
        }
      })
    ])

    const distinctMarkets = new Set(marketRows.map((row) => String(row.marketId))).size
    const distinctTokens = new Set(orderBookRows.map((row) => String(row.tokenId))).size

    const marketCoverageByInterval = buildCoverageByInterval(marketRows, "marketId")
    const orderBookCoverageByInterval = buildCoverageByInterval(orderBookRows, "tokenId")

    const timeline = new Map()
    let replayableIntervals = 0

    for (const intervalMsValue of expectedIntervals) {
      const marketCount = marketCoverageByInterval.get(intervalMsValue)?.size || 0
      const orderBookCount = orderBookCoverageByInterval.get(intervalMsValue)?.size || 0

      const marketCoveragePct = toPercent(marketCount, distinctMarkets)
      const orderBookCoveragePct =
        distinctTokens > 0 ? toPercent(orderBookCount, distinctTokens) : 100

      const isReplayable =
        marketCoveragePct >= minCoveragePct && orderBookCoveragePct >= minCoveragePct

      if (isReplayable) {
        replayableIntervals += 1
      }

      timeline.set(intervalMsValue, {
        marketCoveragePct,
        orderBookCoveragePct,
        isReplayable
      })
    }

    const replayWindows = buildReplayWindows(expectedIntervals, timeline)

    res.json({
      success: true,
      windowHours,
      intervalMinutes: Math.floor(intervalMs / 60000),
      minCoveragePct,
      summary: {
        distinctMarkets,
        distinctTokens,
        expectedIntervals: expectedIntervals.length,
        replayableIntervals,
        replayableCoveragePct: toPercent(replayableIntervals, expectedIntervals.length),
        replayWindowCount: replayWindows.length
      },
      replayWindows
    })
  } catch (error) {
    console.error("[error] Polymarket replay window analysis failed:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/archive/replay-slice
 * Return archived snapshots for a replayable window or an explicit time range
 */
router.get("/archive/replay-slice", async (req, res) => {
  try {
    const intervalMs = getArchiveIntervalMs()
    const windowHours = parsePositiveInt(req.query.windowHours, 24)
    const minCoveragePct = Math.min(parsePositiveInt(req.query.minCoveragePct, 90), 100)
    const maxIntervals = Math.min(parsePositiveInt(req.query.maxIntervals, 300), 2000)
    const includeMarkets = parseBoolean(req.query.includeMarkets, true)
    const includeOrderBooks = parseBoolean(req.query.includeOrderBooks, true)
    const marketIdFilter = req.query.marketId ? String(req.query.marketId) : null
    const tokenIdFilter = req.query.tokenId ? String(req.query.tokenId) : null
    const outcomeFilter = req.query.outcome ? String(req.query.outcome) : null

    let start = parseDateInput(req.query.start)
    let end = parseDateInput(req.query.end)
    let sourceWindow = "explicit"

    if ((start && !end) || (!start && end)) {
      return res.status(400).json({
        success: false,
        error: "start and end must be provided together"
      })
    }

    if (!start && !end) {
      sourceWindow = "latest-replay-window"
      const now = new Date()
      const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000)
      const expectedIntervals = buildExpectedIntervals(windowStart, now, intervalMs)

      const [marketRows, orderBookRows] = await Promise.all([
        prisma.polymarketMarketSnapshot.findMany({
          where: { intervalStart: { gte: windowStart } },
          select: {
            marketId: true,
            intervalStart: true
          }
        }),
        prisma.polymarketOrderBookSnapshot.findMany({
          where: { intervalStart: { gte: windowStart } },
          select: {
            tokenId: true,
            intervalStart: true
          }
        })
      ])

      const distinctMarkets = new Set(marketRows.map((row) => String(row.marketId))).size
      const distinctTokens = new Set(orderBookRows.map((row) => String(row.tokenId))).size
      const marketCoverageByInterval = buildCoverageByInterval(marketRows, "marketId")
      const orderBookCoverageByInterval = buildCoverageByInterval(orderBookRows, "tokenId")
      const timeline = new Map()

      for (const intervalMsValue of expectedIntervals) {
        const marketCount = marketCoverageByInterval.get(intervalMsValue)?.size || 0
        const orderBookCount = orderBookCoverageByInterval.get(intervalMsValue)?.size || 0

        const marketCoveragePct = toPercent(marketCount, distinctMarkets)
        const orderBookCoveragePct =
          distinctTokens > 0 ? toPercent(orderBookCount, distinctTokens) : 100

        timeline.set(intervalMsValue, {
          marketCoveragePct,
          orderBookCoveragePct,
          isReplayable:
            marketCoveragePct >= minCoveragePct && orderBookCoveragePct >= minCoveragePct
        })
      }

      const replayWindows = buildReplayWindows(expectedIntervals, timeline)
      const latestWindow = replayWindows[replayWindows.length - 1]

      if (!latestWindow) {
        return res.status(404).json({
          success: false,
          error: "No replayable window found yet for the requested coverage threshold"
        })
      }

      start = new Date(latestWindow.start)
      end = new Date(latestWindow.end)
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        error: "end must be greater than or equal to start"
      })
    }

    const alignedStart = alignToInterval(start, intervalMs)
    const alignedEnd = alignToInterval(end, intervalMs)
    const replayIntervals = buildExpectedIntervals(alignedStart, alignedEnd, intervalMs)

    if (replayIntervals.length > maxIntervals) {
      return res.status(400).json({
        success: false,
        error: `Requested interval count ${replayIntervals.length} exceeds maxIntervals ${maxIntervals}`
      })
    }

    const marketWhere = {
      intervalStart: {
        gte: alignedStart,
        lte: alignedEnd
      }
    }

    if (marketIdFilter) {
      marketWhere.marketId = marketIdFilter
    }

    const orderBookWhere = {
      intervalStart: {
        gte: alignedStart,
        lte: alignedEnd
      }
    }

    if (marketIdFilter) {
      orderBookWhere.marketId = marketIdFilter
    }

    if (tokenIdFilter) {
      orderBookWhere.tokenId = tokenIdFilter
    }

    if (outcomeFilter) {
      orderBookWhere.outcome = outcomeFilter
    }

    const [marketSnapshots, orderBookSnapshots] = await Promise.all([
      includeMarkets
        ? prisma.polymarketMarketSnapshot.findMany({
            where: marketWhere,
            orderBy: [{ intervalStart: "asc" }, { marketId: "asc" }]
          })
        : Promise.resolve([]),
      includeOrderBooks
        ? prisma.polymarketOrderBookSnapshot.findMany({
            where: orderBookWhere,
            orderBy: [{ intervalStart: "asc" }, { marketId: "asc" }, { tokenId: "asc" }]
          })
        : Promise.resolve([])
    ])

    const timeline = new Map(
      replayIntervals.map((intervalMsValue) => [
        intervalMsValue,
        {
          intervalStart: new Date(intervalMsValue).toISOString(),
          markets: [],
          orderBooks: []
        }
      ])
    )

    for (const snapshot of marketSnapshots) {
      const key = new Date(snapshot.intervalStart).getTime()
      if (timeline.has(key)) {
        timeline.get(key).markets.push(snapshot)
      }
    }

    for (const snapshot of orderBookSnapshots) {
      const key = new Date(snapshot.intervalStart).getTime()
      if (timeline.has(key)) {
        timeline.get(key).orderBooks.push(snapshot)
      }
    }

    const intervals = Array.from(timeline.values())
    const nonEmptyIntervals = intervals.filter(
      (interval) => interval.markets.length > 0 || interval.orderBooks.length > 0
    )

    res.json({
      success: true,
      sourceWindow,
      intervalMinutes: Math.floor(intervalMs / 60000),
      filters: {
        marketId: marketIdFilter,
        tokenId: tokenIdFilter,
        outcome: outcomeFilter,
        includeMarkets,
        includeOrderBooks,
        minCoveragePct
      },
      range: {
        start: alignedStart.toISOString(),
        end: alignedEnd.toISOString(),
        requestedIntervals: replayIntervals.length,
        populatedIntervals: nonEmptyIntervals.length
      },
      counts: {
        marketSnapshots: marketSnapshots.length,
        orderBookSnapshots: orderBookSnapshots.length
      },
      intervals
    })
  } catch (error) {
    console.error("[error] Polymarket replay slice failed:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/archive/quality-reports
 * Return recent archive quality reports
 */
router.get("/archive/quality-reports", async (req, res) => {
  try {
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 200)
    const windowHours = req.query.windowHours
      ? parsePositiveInt(req.query.windowHours, 24)
      : null

    const where = windowHours ? { windowHours } : undefined
    const reports = await prisma.polymarketDataQualityReport.findMany({
      where,
      orderBy: {
        generatedAt: "desc"
      },
      take: limit
    })

    res.json({
      success: true,
      count: reports.length,
      reports
    })
  } catch (error) {
    console.error("[error] Polymarket quality reports query failed:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

async function handleArchiveIngestRun(req, res) {
  try {
    if (!isArchiveIngestAuthorized(req)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized archive ingest trigger"
      })
    }

    const windowHours = parsePositiveInt(
      req.body?.windowHours || req.query.windowHours,
      24
    )
    const runQualityReport = parseBoolean(
      req.body?.runQualityReport ?? req.query.runQualityReport,
      false
    )

    const runResult = await polymarketDataArchiver.archiveSnapshots()
    if (!runResult?.success) {
      return res.status(500).json({
        success: false,
        error: runResult?.error || "Archive ingest failed",
        details: runResult || null
      })
    }

    let qualityReport = null
    if (runQualityReport) {
      qualityReport = await createArchiveQualityReport(windowHours)
    }

    return res.status(runResult.skipped ? 202 : 200).json({
      success: true,
      runType: runResult.skipped ? "skipped" : "executed",
      trigger: "manual-or-cron",
      run: runResult,
      qualityReport: qualityReport
        ? {
            id: qualityReport.id,
            generatedAt: qualityReport.generatedAt,
            windowHours: qualityReport.windowHours
          }
        : null
    })
  } catch (error) {
    console.error("[error] Polymarket archive ingest trigger failed:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * GET/POST /polymarket/archive/ingest/run
 * Trigger one archive snapshot ingestion cycle (for cron/manual operations)
 */
router.get("/archive/ingest/run", handleArchiveIngestRun)
router.post("/archive/ingest/run", handleArchiveIngestRun)

/**
 * POST /polymarket/archive/quality-report/run
 * Generate and persist a new archive quality report on demand
 */
router.post("/archive/quality-report/run", authenticate, async (req, res) => {
  try {
    const windowHours = parsePositiveInt(
      req.body?.windowHours || req.query.windowHours,
      24
    )
    const report = await createArchiveQualityReport(windowHours)

    res.status(201).json({
      success: true,
      report
    })
  } catch (error) {
    console.error("[error] Polymarket quality report generation failed:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// ============ BACKTEST ROUTES ============

/**
 * Initialize market groups with default patterns
 * POST /polymarket/market-groups/initialize
 */
router.post("/market-groups/initialize", authenticate, async (req, res) => {
  try {
    const marketGrouping = require("../services/marketGrouping")
    await marketGrouping.initializeDefaultGroups()
    const groups = await marketGrouping.getAllGroups()
    return res.json({
      success: true,
      message: "Market groups initialized",
      groups
    })
  } catch (error) {
    console.error("Market group initialization error:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Categorize all markets by matching questions against patterns
 * POST /polymarket/market-groups/categorize
 */
router.post("/market-groups/categorize", authenticate, async (req, res) => {
  try {
    const marketGrouping = require("../services/marketGrouping")
    await marketGrouping.categorizeAllMarkets()
    const groups = await marketGrouping.getAllGroups()
    return res.json({
      success: true,
      message: "Markets categorized successfully",
      groups
    })
  } catch (error) {
    console.error("Market categorization error:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Get all market groups
 * GET /polymarket/market-groups
 */
router.get("/market-groups", async (req, res) => {
  try {
    const marketGrouping = require("../services/marketGrouping")
    const groups = await marketGrouping.getAllGroups()
    return res.json({
      success: true,
      groups
    })
  } catch (error) {
    console.error("Error fetching market groups:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Create or update a market group with custom pattern
 * POST /polymarket/market-groups
 * Body: { name, pattern, description }
 */
router.post("/market-groups", authenticate, async (req, res) => {
  try {
    const { name, pattern, description } = req.body
    if (!name || !pattern) {
      return res.status(400).json({
        success: false,
        error: "name and pattern are required"
      })
    }

    const marketGrouping = require("../services/marketGrouping")
    const group = await marketGrouping.upsertMarketGroup(name, pattern, description)
    return res.json({
      success: true,
      message: "Market group created/updated",
      group
    })
  } catch (error) {
    console.error("Error upserting market group:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Run backtest on a market group
 * POST /polymarket/backtest/run
 * Body: { groupName, strategyName, params, options }
 */
router.post("/backtest/run", authenticate, async (req, res) => {
  try {
    const { groupName, strategyName = "momentum", params = {}, options = {} } = req.body
    if (!groupName) {
      return res.status(400).json({
        success: false,
        error: "groupName is required"
      })
    }

    const backtestEngine = require("../services/backtestEngine")
    const results = await backtestEngine.runBacktest(groupName, strategyName, params, options)
    
    return res.json({
      success: true,
      message: "Backtest completed successfully",
      results
    })
  } catch (error) {
    console.error("Backtest error:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Get backtest results for a group
 * GET /polymarket/backtest/results?groupName=Elon%20Tweets&limit=10
 */
router.get("/backtest/results", async (req, res) => {
  try {
    const { groupName, limit = 10 } = req.query
    if (!groupName) {
      return res.status(400).json({
        success: false,
        error: "groupName query parameter is required"
      })
    }

    const backtestEngine = require("../services/backtestEngine")
    const results = await backtestEngine.getBacktestResults(groupName, parseInt(limit))
    
    return res.json({
      success: true,
      results
    })
  } catch (error) {
    console.error("Error fetching backtest results:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Get best backtest for a group
 * GET /polymarket/backtest/best?groupName=Elon%20Tweets
 */
router.get("/backtest/best", async (req, res) => {
  try {
    const { groupName } = req.query
    if (!groupName) {
      return res.status(400).json({
        success: false,
        error: "groupName query parameter is required"
      })
    }

    const backtestEngine = require("../services/backtestEngine")
    const bestBacktest = await backtestEngine.getBestBacktest(groupName)
    
    return res.json({
      success: true,
      backtest: bestBacktest
    })
  } catch (error) {
    console.error("Error fetching best backtest:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Get available strategies
 * GET /polymarket/backtest/strategies
 */
router.get("/backtest/strategies", async (req, res) => {
  try {
    const backtestEngine = require("../services/backtestEngine")
    const strategies = Object.entries(backtestEngine.STRATEGIES).map(([key, strategy]) => ({
      key,
      name: strategy.name,
      description: strategy.description,
      defaultParams: strategy.defaultParams
    }))
    
    return res.json({
      success: true,
      strategies
    })
  } catch (error) {
    console.error("Error fetching strategies:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

module.exports = router
