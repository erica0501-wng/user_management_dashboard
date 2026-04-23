const express = require("express")
const router = express.Router()
const prisma = require("../prisma")
const authenticate = require("../middleware/auth")
const notificationService = require("../services/notificationService")
const polymarketDataArchiver = require("../services/polymarketDataArchiver")

const dashboardBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173"
const CALENDAR_BACKTEST_MATCH_WINDOW_DAYS = 120
const CALENDAR_EVENTS_CACHE_TTL_MS = parsePositiveInt(process.env.CALENDAR_EVENTS_CACHE_TTL_MS, 5 * 60 * 1000)
const calendarEventsCache = new Map()

function isBacktestDemoFallbackEnabled() {
  return String(process.env.ENABLE_BACKTEST_DEMO_FALLBACK || "false").toLowerCase() === "true"
}

const DEMO_BACKTEST_GROUPS = [
  {
    id: 710001,
    name: "Sports",
    description: "Sports event prediction markets",
    pattern: "sports",
    markets: ["550694", "550708", "551010", "551022"],
    _count: { backtests: 3 }
  },
  {
    id: 710002,
    name: "Crypto",
    description: "Crypto and token event markets",
    pattern: "crypto",
    markets: ["640001", "640002", "640003"],
    _count: { backtests: 2 }
  },
  {
    id: 710003,
    name: "Technology",
    description: "Technology and AI markets",
    pattern: "technology",
    markets: ["770101", "770102"],
    _count: { backtests: 1 }
  }
]

const DEMO_BACKTEST_RESULTS = [
  {
    id: 810011,
    groupName: "Sports",
    strategyName: "volatility",
    marketId: "550694",
    marketQuestion: "Will Italy qualify for FIFA World Cup 2026?",
    marketCategory: "Sports",
    startTime: "2026-03-01T00:00:00.000Z",
    endTime: "2026-04-01T00:00:00.000Z",
    initialCapital: 10000,
    finalValue: 8780,
    pnl: -1220,
    roi: -12.2,
    winRate: 41.67,
    totalTrades: 24,
    winningTrades: 10,
    losingTrades: 14,
    maxDrawdown: 18.3,
    params: { spreadThreshold: 0.05, positionSize: 1000 },
    createdAt: "2026-04-08T20:07:00.000Z",
    group: { name: "Sports" }
  },
  {
    id: 810012,
    groupName: "Sports",
    strategyName: "meanReversion",
    marketId: "550708",
    marketQuestion: "Will England qualify for FIFA World Cup 2026?",
    marketCategory: "Sports",
    startTime: "2026-03-01T00:00:00.000Z",
    endTime: "2026-04-01T00:00:00.000Z",
    initialCapital: 10000,
    finalValue: 12180,
    pnl: 2180,
    roi: 21.8,
    winRate: 70.83,
    totalTrades: 24,
    winningTrades: 17,
    losingTrades: 7,
    maxDrawdown: 7.1,
    params: { period: 20, buyThreshold: 0.3, sellThreshold: 0.7, positionSize: 1000 },
    createdAt: "2026-04-08T20:07:00.000Z",
    group: { name: "Sports" }
  },
  {
    id: 810013,
    groupName: "Sports",
    strategyName: "momentum",
    marketId: "551010",
    marketQuestion: "Will France qualify for FIFA World Cup 2026?",
    marketCategory: "Sports",
    startTime: "2026-03-01T00:00:00.000Z",
    endTime: "2026-04-01T00:00:00.000Z",
    initialCapital: 10000,
    finalValue: 9540,
    pnl: -460,
    roi: -4.6,
    winRate: 45.83,
    totalTrades: 24,
    winningTrades: 11,
    losingTrades: 13,
    maxDrawdown: 12.4,
    params: { buyThreshold: 0.02, sellThreshold: 0.02, positionSize: 1000 },
    createdAt: "2026-04-08T20:07:00.000Z",
    group: { name: "Sports" }
  },
  {
    id: 810021,
    groupName: "Crypto",
    strategyName: "meanReversion",
    marketId: "640001",
    marketQuestion: "Will MegaETH perform an airdrop by June 30?",
    marketCategory: "Crypto",
    startTime: "2026-01-15T00:00:00.000Z",
    endTime: "2026-02-05T00:00:00.000Z",
    initialCapital: 10000,
    finalValue: 10210,
    pnl: 210,
    roi: 2.1,
    winRate: 91.3,
    totalTrades: 23,
    winningTrades: 21,
    losingTrades: 2,
    maxDrawdown: 3.2,
    params: { period: 20, buyThreshold: 0.2, sellThreshold: 0.8, positionSize: 1000 },
    createdAt: "2026-02-01T08:05:00.000Z",
    group: { name: "Crypto" }
  }
]

function getDemoBacktestsForGroup(groupName, limit = 10) {
  return DEMO_BACKTEST_RESULTS
    .filter((item) => item.groupName.toLowerCase() === String(groupName || "").toLowerCase())
    .slice(0, limit)
}

function getDemoBacktestsByCategory(eventCategory) {
  const normalized = String(eventCategory || "").toLowerCase()
  return DEMO_BACKTEST_RESULTS.filter((item) => item.groupName.toLowerCase() === normalized)
}

function buildDemoTrades(totalTrades, marketId, marketQuestion) {
  const trades = []
  const baseTime = new Date("2026-01-10T00:00:00.000Z").getTime()

  for (let index = 0; index < totalTrades; index += 1) {
    const isBuy = index % 2 === 0
    const price = Number((0.42 + (index % 5) * 0.03).toFixed(4))
    const amount = 1000
    const profit = isBuy ? null : Number((index % 4 === 0 ? -28.5 : 61.2).toFixed(2))

    trades.push({
      index: index + 1,
      time: new Date(baseTime + index * 6 * 60 * 60 * 1000).toISOString(),
      action: isBuy ? "BUY" : "SELL",
      marketId,
      marketQuestion,
      marketCategory: "crypto",
      price,
      amount,
      shares: Number((amount / price).toFixed(2)),
      profit,
      signal: isBuy ? "Lower percentile entry" : "Upper percentile exit",
      cashBalance: Number((10000 + (profit || 0)).toFixed(2)),
      positionShares: isBuy ? Number((amount / price).toFixed(2)) : 0
    })
  }

  return trades
}

function buildDemoMarketCard(marketId, question, category) {
  const label = String(question || category || `Market ${marketId}`).trim().slice(0, 80)

  return {
    marketId,
    question,
    category,
    image: `https://via.placeholder.com/1200x400.png?text=${encodeURIComponent(label || "Polymarket Market")}`,
    intervalStart: new Date().toISOString()
  }
}

function getDemoBacktestReport(backtestId) {
  const targetId = Number(backtestId)
  const selected = DEMO_BACKTEST_RESULTS.find((item) => item.id === targetId) || DEMO_BACKTEST_RESULTS[0]

  if (!selected) {
    return null
  }

  const marketId = selected.groupName === "Crypto" ? "640001" : "550694"
  const marketQuestion =
    selected.groupName === "Crypto"
      ? "Will MegaETH perform an airdrop by June 30?"
      : "Will Italy qualify for FIFA World Cup 2026?"
  const marketCategory = selected.groupName.toLowerCase()

  const trades = buildDemoTrades(selected.totalTrades, marketId, marketQuestion)
  const buyCount = trades.filter((trade) => trade.action === "BUY").length
  const sellCount = trades.filter((trade) => trade.action === "SELL").length
  const winningSellCount = trades.filter((trade) => trade.action === "SELL" && Number(trade.profit || 0) > 0).length
  const losingSellCount = trades.filter((trade) => trade.action === "SELL" && Number(trade.profit || 0) <= 0).length

  return {
    backtest: {
      id: selected.id,
      createdAt: selected.createdAt,
      strategyName: selected.strategyName,
      groupName: selected.groupName,
      startTime: selected.startTime,
      endTime: selected.endTime,
      initialCapital: selected.initialCapital,
      finalValue: selected.finalValue,
      pnl: selected.pnl,
      roi: selected.roi,
      winRate: selected.winRate,
      maxDrawdown: selected.maxDrawdown,
      params: selected.params,
      totalTrades: selected.totalTrades,
      winningTrades: selected.winningTrades,
      losingTrades: selected.losingTrades
    },
    summary: {
      transactionCount: trades.length,
      buyCount,
      sellCount,
      winningSellCount,
      losingSellCount,
      uniqueMarkets: 1
    },
    markets: [
      {
        ...buildDemoMarketCard(marketId, marketQuestion, marketCategory),
        intervalStart: selected.endTime
      }
    ],
    trades
  }
}

function createUnavailableBacktestReport(backtestId) {
  const nowIso = new Date().toISOString()
  const numericId = Number(backtestId)

  return {
    backtest: {
      id: Number.isFinite(numericId) ? numericId : 0,
      createdAt: nowIso,
      strategyName: "unknown",
      groupName: "Unavailable",
      startTime: nowIso,
      endTime: nowIso,
      initialCapital: 0,
      finalValue: 0,
      pnl: 0,
      roi: 0,
      winRate: 0,
      maxDrawdown: 0,
      params: {},
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
    },
    summary: {
      transactionCount: 0,
      buyCount: 0,
      sellCount: 0,
      winningSellCount: 0,
      losingSellCount: 0,
      uniqueMarkets: 0,
    },
    markets: [],
    marketPriceSeries: {},
    trades: [],
  }
}

function isDatabaseUnavailableError(error) {
  const message = String(error?.message || "").toLowerCase()
  const code = String(error?.code || "")

  return (
    message.includes("data transfer quota") ||
    message.includes("connection") ||
    message.includes("database server") ||
    message.includes("can't reach database server") ||
    message.includes("too many database connections") ||
    message.includes("connection pool timeout") ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P2024"
  )
}

function isMissingBacktestSchemaError(error) {
  const code = String(error?.code || "")
  const table = String(error?.meta?.table || "").toLowerCase()
  const message = String(error?.message || "").toLowerCase()

  if (code === "P2021") {
    return (
      table.includes("marketgroup") ||
      table.includes("backtest") ||
      message.includes("marketgroup") ||
      message.includes("backtest")
    )
  }

  return false
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function parseHistoryWindowDays(value, fallback = 90) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) {
    return fallback
  }

  if (normalized === "all") {
    return null
  }

  const parsed = parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function getCalendarCacheKey({ categories, includePast, upcomingLimit, pastLimit }) {
  const normalizedCategories = Array.isArray(categories) ? [...categories].sort().join(",") : ""
  return `${normalizedCategories}|${includePast}|${upcomingLimit}|${pastLimit}`
}

function getCachedCalendarResponse(cacheKey) {
  const cached = calendarEventsCache.get(cacheKey)
  if (!cached) {
    return null
  }

  if (Date.now() > cached.expiresAt) {
    calendarEventsCache.delete(cacheKey)
    return null
  }

  return cached.payload
}

function setCachedCalendarResponse(cacheKey, payload) {
  calendarEventsCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + CALENDAR_EVENTS_CACHE_TTL_MS
  })
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

const archiveResponseCache = new Map()

function buildArchiveCacheKey(endpoint, params = {}) {
  const sortedEntries = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]])

  return `${endpoint}:${JSON.stringify(sortedEntries)}`
}

function getArchiveCache(key) {
  const entry = archiveResponseCache.get(key)
  if (!entry) {
    return null
  }

  if (entry.expiresAt <= Date.now()) {
    archiveResponseCache.delete(key)
    return null
  }

  return entry.value
}

function setArchiveCache(key, value, ttlMs) {
  archiveResponseCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  })
}

function clearArchiveCache() {
  archiveResponseCache.clear()
}

const SPORTS_MARKET_PATTERN =
  /\b(nba|nfl|nhl|mlb|soccer|football|basketball|tennis|hockey|baseball|world cup|premier league|championship|olympics|fifa|ufc|boxing|indy|f1|grand prix|copa america|euro|stanley cup)\b/i

function isSportsMarketRecord({ question, category }) {
  const safeQuestion = String(question || "")
  const safeCategory = String(category || "").toLowerCase()

  if (safeCategory.includes("sport")) {
    return true
  }

  return SPORTS_MARKET_PATTERN.test(safeQuestion)
}

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase()
}

const CATEGORY_GROUP_PATTERNS = {
  crypto: /bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/i,
  politics: /election|president|presidential|vote|voting|congress|senate|political|government|campaign|xi jinping|taiwan|china invade|geopolit/i,
  sports: /sport|football|basketball|soccer|hockey|nba|nfl|nhl|championship|tennis|premier league|olympics|world cup|fifa|baseball|cricket|rugby|stanley cup|relegated?|goal scorer|bundesliga|la liga|serie a|ligue 1|champions league/i,
  technology: /\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/i,
  finance: /stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/i,
  entertainment: /movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress|gta/i
}

function classifyCategoryGroup({ question, description, category }) {
  const text = `${String(question || "")} ${String(description || "")} ${String(category || "")}`.toLowerCase()

  if (CATEGORY_GROUP_PATTERNS.entertainment.test(text)) return "entertainment"
  if (CATEGORY_GROUP_PATTERNS.crypto.test(text)) return "crypto"
  if (CATEGORY_GROUP_PATTERNS.politics.test(text)) return "politics"
  if (CATEGORY_GROUP_PATTERNS.sports.test(text)) return "sports"
  if (CATEGORY_GROUP_PATTERNS.technology.test(text)) return "technology"
  if (CATEGORY_GROUP_PATTERNS.finance.test(text)) return "finance"

  return "other"
}

function matchesCategoryFilter({ question, category, categoryFilter }) {
  const normalizedFilter = normalizeCategory(categoryFilter)
  if (!normalizedFilter) {
    return true
  }

  if (Object.prototype.hasOwnProperty.call(CATEGORY_GROUP_PATTERNS, normalizedFilter) || normalizedFilter === "other") {
    return classifyCategoryGroup({ question, category }) === normalizedFilter
  }

  return normalizeCategory(category) === normalizedFilter
}

function toCategoryOptions(rawCategories) {
  const map = new Map()

  for (const raw of rawCategories || []) {
    const normalized = normalizeCategory(raw)
    if (!normalized) {
      continue
    }

    if (!map.has(normalized)) {
      map.set(normalized, String(raw).trim())
    }
  }

  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }))
}

const CALENDAR_CATEGORY_VALUES = [
  "crypto",
  "politics",
  "sports",
  "technology",
  "finance",
  "entertainment",
  "other"
]

function classifyCalendarCategory({ question, description, category }) {
  return classifyCategoryGroup({ question, description, category })
}

function parseCategoryFilter(value) {
  const raw = String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  if (raw.includes("all")) {
    return CALENDAR_CATEGORY_VALUES
  }

  const valid = raw.filter((item) => CALENDAR_CATEGORY_VALUES.includes(item))
  return valid.length > 0 ? valid : CALENDAR_CATEGORY_VALUES
}

function toDateOrNull(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    const parsed = new Date(candidate)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return null
}

function mapCalendarEvent(market, status) {
  const eventDate = toDateOrNull(
    market?.endDate,
    market?.end_date_iso,
    market?.closesAt,
    market?.eventEndDate,
    market?.eventStartDate,
    market?.startDate,
    market?.createdAt,
    market?.created_at
  )

  if (!eventDate) {
    return null
  }

  const outcomes = parseJsonArray(market?.outcomes, ["Yes", "No"])
  const outcomePrices = parseJsonArray(market?.outcomePrices, [])
  const prices = outcomePrices.map((price) => Number.parseFloat(price)).filter(Number.isFinite)
  const topProbability = prices.length > 0 ? Math.max(...prices) : null
  const topIndex = topProbability === null ? -1 : prices.indexOf(topProbability)

  const calendarCategory = classifyCalendarCategory({
    question: market?.question,
    description: market?.description,
    category: market?.category
  })

  const marketId = String(market?.id || market?.condition_id || "")

  return {
    id: marketId || `calendar-${Date.now()}`,
    question: market?.question || market?.title || "Unknown Market",
    description: market?.description || "",
    category: calendarCategory,
    status,
    eventDate: eventDate.toISOString(),
    endDate: toIsoOrNull(market?.endDate || market?.end_date_iso || market?.closesAt),
    startDate: toIsoOrNull(market?.eventStartDate || market?.startDate || market?.createdAt || market?.created_at),
    image: market?.image || market?.icon || null,
    volume: market?.volume || market?.volume24hr || "0",
    liquidity: market?.liquidity || "0",
    topOutcome: topIndex >= 0 ? String(outcomes[topIndex] || "Yes") : null,
    topProbability: topProbability !== null ? Number((topProbability * 100).toFixed(2)) : null,
    analysisPath: marketId ? `/polymarket/details/${marketId}` : "/polymarket"
  }
}

function isMissingPolymarketEventColumnsError(error) {
  const code = String(error?.code || "")
  const message = String(error?.message || "").toLowerCase()
  const column = String(error?.meta?.column || "").toLowerCase()

  if (code !== "P2022") {
    return false
  }

  return (
    column.includes("eventstartat") ||
    column.includes("eventendat") ||
    column.includes("closedtime") ||
    column.includes("sourcecreatedat") ||
    column.includes("category") ||
    column.includes("closed") ||
    message.includes("eventstartat") ||
    message.includes("eventendat") ||
    message.includes("closedtime") ||
    message.includes("sourcecreatedat") ||
    message.includes("\"category\"") ||
    message.includes("\"closed\"")
  )
}

function parseDateSafe(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toIsoOrNull(value) {
  const parsed = parseDateSafe(value)
  return parsed ? parsed.toISOString() : null
}

function getDurationHours(startValue, endValue) {
  const start = parseDateSafe(startValue)
  const end = parseDateSafe(endValue)

  if (!start || !end || end <= start) {
    return null
  }

  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

function classifySportsMarketRecurrence({ question, marketOpenAtProxy, marketCloseAt }) {
  const text = String(question || "").toLowerCase()
  const lifecycleHours = getDurationHours(marketOpenAtProxy, marketCloseAt)

  if (/daily|today|tonight/.test(text)) {
    return { recurrenceBucket: "daily", recurrenceRank: 0 }
  }

  if (/weekly|this week|week \d+|gameweek|matchweek/.test(text)) {
    return { recurrenceBucket: "weekly", recurrenceRank: 1 }
  }

  if (/monthly|this month/.test(text)) {
    return { recurrenceBucket: "monthly", recurrenceRank: 2 }
  }

  if (/season|playoffs|championship|tournament/.test(text)) {
    return { recurrenceBucket: "seasonal", recurrenceRank: 4 }
  }

  if (/olympics|world cup|euro cup|copa america/.test(text)) {
    return { recurrenceBucket: "rare-major-event", recurrenceRank: 7 }
  }

  if (/\b(19|20)\d{2}\b/.test(text) && /win|winner|champion/.test(text)) {
    return { recurrenceBucket: "annual", recurrenceRank: 5 }
  }

  if (lifecycleHours !== null) {
    if (lifecycleHours <= 24 * 14) {
      return { recurrenceBucket: "weekly", recurrenceRank: 1 }
    }

    if (lifecycleHours <= 24 * 45) {
      return { recurrenceBucket: "monthly", recurrenceRank: 2 }
    }

    if (lifecycleHours <= 24 * 200) {
      return { recurrenceBucket: "seasonal", recurrenceRank: 4 }
    }

    if (lifecycleHours <= 24 * 500) {
      return { recurrenceBucket: "annual", recurrenceRank: 5 }
    }

    return { recurrenceBucket: "multi-year", recurrenceRank: 6 }
  }

  return { recurrenceBucket: "unknown", recurrenceRank: 3 }
}

function sortSportsActiveRowsByPriority(rows) {
  return [...rows].sort((a, b) => {
    const rankDiff = (a.recurrenceRank || 999) - (b.recurrenceRank || 999)
    if (rankDiff !== 0) {
      return rankDiff
    }

    const aStart = parseDateSafe(a.activeStartAt || a.marketOpenAtProxy)
    const bStart = parseDateSafe(b.activeStartAt || b.marketOpenAtProxy)
    const aTime = aStart ? aStart.getTime() : 0
    const bTime = bStart ? bStart.getTime() : 0
    return bTime - aTime
  })
}

function enrichSportsActiveRow(row) {
  const recurrence = classifySportsMarketRecurrence({
    question: row.question,
    marketOpenAtProxy: row.marketOpenAtProxy,
    marketCloseAt: row.marketCloseAt
  })

  return {
    ...row,
    activeDurationHours: getDurationHours(row.activeStartAt, row.activeEndAt),
    lifecycleDurationHours: getDurationHours(row.marketOpenAtProxy, row.marketCloseAt),
    recurrenceBucket: recurrence.recurrenceBucket,
    recurrenceRank: recurrence.recurrenceRank
  }
}

function resolveSportsLifecycleWindow(row) {
  const start =
    parseDateSafe(row.marketOpenAtProxy) ||
    parseDateSafe(row.activeStartAt) ||
    parseDateSafe(row.activeEndAt) ||
    parseDateSafe(row.marketCloseAt) ||
    parseDateSafe(row.marketResolvedAt)
  const end =
    parseDateSafe(row.marketCloseAt) ||
    parseDateSafe(row.marketResolvedAt) ||
    parseDateSafe(row.activeEndAt) ||
    parseDateSafe(row.activeStartAt)

  if (!start || !end || end <= start) {
    return null
  }

  return { start, end }
}

function buildMarketTradeActivityProfile(row, trades, binCount = 36) {
  const lifecycle = resolveSportsLifecycleWindow(row)
  if (!lifecycle) {
    return null
  }

  const safeBinCount = Math.max(8, Math.min(binCount, 120))
  const totalMs = lifecycle.end.getTime() - lifecycle.start.getTime()
  if (totalMs <= 0) {
    return null
  }

  const binSizeMs = totalMs / safeBinCount
  const bins = Array.from({ length: safeBinCount }, (_, index) => ({
    index,
    trades: 0,
    uniqueTraderIds: new Set(),
    relativeStartPct: Number(((index / safeBinCount) * 100).toFixed(4)),
    relativeEndPct: Number(((((index + 1) / safeBinCount) * 100)).toFixed(4)),
    startAt: new Date(lifecycle.start.getTime() + index * binSizeMs),
    endAt: new Date(lifecycle.start.getTime() + (index + 1) * binSizeMs)
  }))

  const totalUniqueTraders = new Set()

  for (const trade of trades) {
    const createdAt = parseDateSafe(trade.createdAt)
    if (!createdAt) {
      continue
    }

    const createdAtMs = createdAt.getTime()
    if (createdAtMs < lifecycle.start.getTime() || createdAtMs > lifecycle.end.getTime()) {
      continue
    }

    const binIndex = Math.min(
      safeBinCount - 1,
      Math.max(0, Math.floor((createdAtMs - lifecycle.start.getTime()) / binSizeMs))
    )
    const bin = bins[binIndex]
    bin.trades += 1

    if (trade.userId !== null && trade.userId !== undefined) {
      bin.uniqueTraderIds.add(trade.userId)
      totalUniqueTraders.add(trade.userId)
    }
  }

  const normalizedBins = bins.map((bin) => ({
    index: bin.index,
    trades: bin.trades,
    uniqueTraders: bin.uniqueTraderIds.size,
    relativeStartPct: bin.relativeStartPct,
    relativeEndPct: bin.relativeEndPct,
    startAt: toIsoOrNull(bin.startAt),
    endAt: toIsoOrNull(bin.endAt)
  }))

  return {
    binCount: safeBinCount,
    totalTrades: normalizedBins.reduce((sum, bin) => sum + bin.trades, 0),
    totalUniqueTraders: totalUniqueTraders.size,
    maxTradesInBin: normalizedBins.reduce((max, bin) => Math.max(max, bin.trades), 0),
    maxUniqueTradersInBin: normalizedBins.reduce((max, bin) => Math.max(max, bin.uniqueTraders), 0),
    bins: normalizedBins
  }
}

async function fetchClosedMarketsFromGamma(
  limit,
  { sportsOnly = true, keyword = "", category = "", historyWindowDays = 90 } = {}
) {
  const results = []
  let offset = 0
  const pageSize = Math.max(limit, 100)
  const maxPages = 10
  const normalizedKeyword = String(keyword || "").trim().toLowerCase()
  const normalizedCategory = normalizeCategory(category)
  const cutoffDate = historyWindowDays === null ? null : new Date(Date.now() - historyWindowDays * 24 * 60 * 60 * 1000)

  for (let page = 0; page < maxPages && results.length < limit; page += 1) {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${pageSize}&offset=${offset}&closed=true`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch closed sports markets from Gamma: ${response.status}`)
    }

    const payload = await response.json()
    if (!Array.isArray(payload) || payload.length === 0) {
      break
    }

    for (const market of payload) {
      const category = market?.category
      const question = market?.question
      const events = Array.isArray(market?.events) ? market.events : []
      const eventCategory = events[0]?.category

      if (cutoffDate) {
        const closedAnchor = parseDateSafe(
          market?.closedTime || market?.endDate || events[0]?.closedTime || events[0]?.endDate
        )
        if (!closedAnchor || closedAnchor < cutoffDate) {
          continue
        }
      }

      if (sportsOnly && !isSportsMarketRecord({ question, category: category || eventCategory })) {
        continue
      }

      if (normalizedKeyword) {
        const text = `${question || ""} ${category || eventCategory || ""}`.toLowerCase()
        if (!text.includes(normalizedKeyword)) {
          continue
        }
      }

      if (normalizedCategory) {
        if (!matchesCategoryFilter({ question, category: category || eventCategory, categoryFilter: normalizedCategory })) {
          continue
        }
      }

      results.push(market)
      if (results.length >= limit) {
        break
      }
    }

    offset += pageSize
  }

  return results.slice(0, limit)
}

async function fetchClosedSportsFromGamma(limit) {
  return fetchClosedMarketsFromGamma(limit, { sportsOnly: true })
}

async function buildSportsActivePeriodsFromArchive(
  limit,
  keyword,
  { sportsOnly = true, category = "", historyWindowDays = 90 } = {}
) {
  const now = new Date()
  const normalizedCategory = normalizeCategory(category)
  const cutoffDate = historyWindowDays === null ? null : new Date(Date.now() - historyWindowDays * 24 * 60 * 60 * 1000)
  const latestRows = await prisma.polymarketMarketSnapshot.findMany({
    where: {
      OR: [
        {
          eventEndAt: {
            not: null,
            lte: now
          }
        },
        {
          closed: true,
          endDate: {
            not: null,
            lte: now
          }
        }
      ]
    },
    orderBy: [{ marketId: "asc" }, { intervalStart: "desc" }],
    distinct: ["marketId"],
    take: limit * 3,
    select: {
      marketId: true,
      question: true,
      category: true,
      intervalStart: true,
      endDate: true,
      closed: true,
      closedTime: true,
      eventStartAt: true,
      eventEndAt: true,
      sourceCreatedAt: true
    }
  })

  const sportsRows = latestRows
    .filter((row) => {
      if (!sportsOnly) {
        return true
      }

      return isSportsMarketRecord({ question: row.question, category: row.category })
    })
    .filter((row) => {
      if (!keyword) {
        return true
      }

      const text = `${row.question || ""} ${row.category || ""}`.toLowerCase()
      return text.includes(keyword)
    })
    .filter((row) => matchesCategoryFilter({ question: row.question, category: row.category, categoryFilter: normalizedCategory }))
    .filter((row) => {
      if (!cutoffDate) {
        return true
      }

      const closedAnchor =
        parseDateSafe(row.closedTime) ||
        parseDateSafe(row.endDate) ||
        parseDateSafe(row.eventEndAt)

      return Boolean(closedAnchor && closedAnchor >= cutoffDate)
    })
    .slice(0, limit)

  if (sportsRows.length === 0) {
    return []
  }

  const marketIds = sportsRows.map((row) => row.marketId)
  const [snapshotSummary, orderbookSummary] = await Promise.all([
    prisma.polymarketMarketSnapshot.groupBy({
      by: ["marketId"],
      where: {
        marketId: {
          in: marketIds
        }
      },
      _count: {
        _all: true
      },
      _min: {
        intervalStart: true
      },
      _max: {
        intervalStart: true
      }
    }),
    prisma.polymarketOrderBookSnapshot.groupBy({
      by: ["marketId"],
      where: {
        marketId: {
          in: marketIds
        }
      },
      _sum: {
        totalVolume: true
      },
      _count: {
        _all: true
      }
    })
  ])

  const snapshotMap = new Map(snapshotSummary.map((row) => [row.marketId, row]))
  const orderbookMap = new Map(orderbookSummary.map((row) => [row.marketId, row]))

  const normalizedRows = sportsRows.map((row) => {
    const snapshots = snapshotMap.get(row.marketId)
    const orderbooks = orderbookMap.get(row.marketId)

    return {
      marketId: row.marketId,
      question: row.question,
      category: row.category,
      marketOpenAtProxy: toIsoOrNull(row.sourceCreatedAt || snapshots?._min?.intervalStart),
      activeStartAt: toIsoOrNull(row.eventStartAt),
      activeEndAt: toIsoOrNull(row.eventEndAt),
      marketCloseAt: toIsoOrNull(row.endDate),
      marketResolvedAt: toIsoOrNull(row.closedTime),
      latestSnapshotAt: toIsoOrNull(snapshots?._max?.intervalStart),
      snapshotCount: snapshots?._count?._all || 0,
      orderbookSnapshotCount: orderbooks?._count?._all || 0,
      cumulativeOrderbookVolume: orderbooks?._sum?.totalVolume || 0
    }
  })

  const rowsWithLifecycle = normalizedRows.filter((row) => resolveSportsLifecycleWindow(row))
  if (rowsWithLifecycle.length === 0) {
    return sortSportsActiveRowsByPriority(normalizedRows.map((row) => enrichSportsActiveRow(row)))
  }

  const lifecycleWindows = rowsWithLifecycle.map((row) => ({
    marketId: row.marketId,
    lifecycle: resolveSportsLifecycleWindow(row)
  }))

  const globalStartMs = Math.min(...lifecycleWindows.map((item) => item.lifecycle.start.getTime()))
  const globalEndMs = Math.max(...lifecycleWindows.map((item) => item.lifecycle.end.getTime()))

  const marketTrades = await prisma.order.findMany({
    where: {
      symbol: {
        in: marketIds
      },
      createdAt: {
        gte: new Date(globalStartMs),
        lte: new Date(globalEndMs)
      }
    },
    select: {
      symbol: true,
      userId: true,
      createdAt: true
    }
  })

  const tradesByMarket = new Map()
  for (const trade of marketTrades) {
    const symbol = String(trade.symbol || "")
    if (!symbol) {
      continue
    }

    const list = tradesByMarket.get(symbol)
    if (list) {
      list.push(trade)
    } else {
      tradesByMarket.set(symbol, [trade])
    }
  }

  const withActivityProfiles = normalizedRows.map((row) => ({
    ...row,
    activityProfile: buildMarketTradeActivityProfile(row, tradesByMarket.get(row.marketId) || [])
  }))

  return sortSportsActiveRowsByPriority(withActivityProfiles.map((row) => enrichSportsActiveRow(row)))
}

function buildSportsActivePeriodsFromGammaRows(rows) {
  const normalizedRows = rows.map((market) => {
    const event = Array.isArray(market?.events) && market.events.length > 0 ? market.events[0] : null

    return {
      marketId: String(market?.id || ""),
      question: market?.question || null,
      category: market?.category || event?.category || null,
      marketOpenAtProxy: toIsoOrNull(market?.createdAt || event?.createdAt || event?.creationDate),
      activeStartAt: toIsoOrNull(event?.startDate),
      activeEndAt: toIsoOrNull(event?.endDate),
      marketCloseAt: toIsoOrNull(market?.endDate || event?.endDate),
      marketResolvedAt: toIsoOrNull(market?.closedTime || event?.closedTime),
      latestSnapshotAt: null,
      snapshotCount: 0,
      orderbookSnapshotCount: 0,
      cumulativeOrderbookVolume: 0,
      activityProfile: null
    }
  })

  return sortSportsActiveRowsByPriority(normalizedRows.map((row) => enrichSportsActiveRow(row)))
}

async function buildSportsKickoffActivityProxyFromGammaRows({
  rows,
  preHours,
  postHours,
  binMinutes
}) {
  const normalizedRows = buildSportsActivePeriodsFromGammaRows(rows)
  const markets = normalizedRows.filter((row) => row.activeStartAt)

  if (markets.length === 0) {
    return {
      marketsCount: 0,
      bins: [],
      summary: {
        totalVolume: 0,
        preGameVolume: 0,
        inGameVolume: 0,
        postGameVolume: 0,
        uniqueTradersTotal: 0,
        uniqueTradersByPeriodAvailable: true,
        preGamePct: 0,
        inGamePct: 0,
        postGamePct: 0
      }
    }
  }

  const binHours = Math.max(binMinutes, 5) / 60
  const binCount = Math.max(1, Math.ceil((preHours + postHours) / binHours))
  const bins = Array.from({ length: binCount }, (_, index) => {
    const startHour = -preHours + index * binHours
    const endHour = startHour + binHours
    return {
      index,
      startHour: Number(startHour.toFixed(2)),
      endHour: Number(endHour.toFixed(2)),
      label: `${startHour.toFixed(1)}h to ${endHour.toFixed(1)}h`,
      totalVolume: 0,
      snapshotCount: 0,
      marketIds: new Set(),
      traderIds: new Set()
    }
  })

  const hourMs = 60 * 60 * 1000
  const marketMeta = new Map(
    markets.map((market) => {
      const activeStartMs = new Date(market.activeStartAt).getTime()
      return [market.marketId, { activeStartMs }]
    })
  )

  const windowStartMs = Math.min(
    ...markets.map((market) => new Date(market.activeStartAt).getTime() - preHours * hourMs)
  )
  const windowEndMs = Math.max(
    ...markets.map((market) => new Date(market.activeStartAt).getTime() + postHours * hourMs)
  )

  const localTrades = await prisma.order.findMany({
    where: {
      symbol: {
        in: markets.map((market) => market.marketId)
      },
      createdAt: {
        gte: new Date(windowStartMs),
        lte: new Date(windowEndMs)
      }
    },
    select: {
      symbol: true,
      userId: true,
      createdAt: true
    }
  })

  const uniqueTraderIds = new Set()

  let totalVolume = 0
  let preGameVolume = 0
  let inGameVolume = 0
  let postGameVolume = 0

  for (const market of markets) {
    const activeStartMs = new Date(market.activeStartAt).getTime()
    const activeEndMs = market.activeEndAt ? new Date(market.activeEndAt).getTime() : null

    const inferredDurationHours = activeEndMs
      ? Math.max(0.5, (activeEndMs - activeStartMs) / (1000 * 60 * 60))
      : 2

    for (const bin of bins) {
      const centerHour = (bin.startHour + bin.endHour) / 2
      let proxyVolume = 0

      if (centerHour < 0) {
        // Pre-game usually ramps into kickoff.
        proxyVolume = Math.max(0.2, 1 - Math.abs(centerHour) / preHours)
        preGameVolume += proxyVolume
      } else if (centerHour <= inferredDurationHours) {
        // In-game activity tends to be denser.
        proxyVolume = 1.4
        inGameVolume += proxyVolume
      } else {
        // Post-game activity decays quickly.
        const postRelative = Math.min(1, (centerHour - inferredDurationHours) / Math.max(postHours, 1))
        proxyVolume = Math.max(0.15, 0.8 * (1 - postRelative))
        postGameVolume += proxyVolume
      }

      bin.totalVolume += proxyVolume
      bin.snapshotCount += 1
      bin.marketIds.add(market.marketId)
      totalVolume += proxyVolume
    }
  }

  for (const trade of localTrades) {
    const meta = marketMeta.get(trade.symbol)
    if (!meta) {
      continue
    }

    const tradeMs = new Date(trade.createdAt).getTime()
    const relativeHours = (tradeMs - meta.activeStartMs) / hourMs
    if (relativeHours < -preHours || relativeHours > postHours) {
      continue
    }

    const binIndex = Math.min(
      binCount - 1,
      Math.max(0, Math.floor((relativeHours + preHours) / binHours))
    )

    const bin = bins[binIndex]
    bin.traderIds.add(trade.userId)
    uniqueTraderIds.add(trade.userId)
  }

  const binsNormalized = bins.map((bin) => ({
    index: bin.index,
    startHour: bin.startHour,
    endHour: bin.endHour,
    label: bin.label,
    totalVolume: Number(bin.totalVolume.toFixed(4)),
    snapshotCount: bin.snapshotCount,
    uniqueTraders: bin.traderIds.size,
    marketCoveragePct: Number(((bin.marketIds.size / markets.length) * 100).toFixed(2)),
    avgVolumePerSnapshot:
      bin.snapshotCount > 0 ? Number((bin.totalVolume / bin.snapshotCount).toFixed(4)) : 0
  }))

  const toPct = (value) => (totalVolume > 0 ? Number(((value / totalVolume) * 100).toFixed(2)) : 0)

  return {
    marketsCount: markets.length,
    bins: binsNormalized,
    summary: {
      totalVolume: Number(totalVolume.toFixed(4)),
      preGameVolume: Number(preGameVolume.toFixed(4)),
      inGameVolume: Number(inGameVolume.toFixed(4)),
      postGameVolume: Number(postGameVolume.toFixed(4)),
      uniqueTradersTotal: uniqueTraderIds.size,
      uniqueTradersByPeriodAvailable: true,
      preGamePct: toPct(preGameVolume),
      inGamePct: toPct(inGameVolume),
      postGamePct: toPct(postGameVolume)
    }
  }
}

async function buildSportsKickoffActivityFromArchive({
  marketLimit,
  preHours,
  postHours,
  binMinutes,
  keyword,
  category,
  sportsOnly = true,
  historyWindowDays = 90
}) {
  const now = new Date()
  const normalizedCategory = normalizeCategory(category)
  const cutoffDate = historyWindowDays === null ? null : new Date(Date.now() - historyWindowDays * 24 * 60 * 60 * 1000)
  // Fetch all sports markets, including those with null eventStartAt
  const latestRows = await prisma.polymarketMarketSnapshot.findMany({
    where: {
      OR: [
        {
          eventStartAt: {
            not: null,
            lte: now
          }
        },
        {
          eventStartAt: null
        }
      ]
    },
    orderBy: [{ marketId: "asc" }, { intervalStart: "desc" }],
    distinct: ["marketId"],
    take: marketLimit * 4,
    select: {
      marketId: true,
      question: true,
      category: true,
      eventStartAt: true,
      eventEndAt: true,
      endDate: true,
      closedTime: true,
      sourceCreatedAt: true
    }
  })

  const markets = latestRows
    .filter((row) => {
      if (!sportsOnly) {
        return true
      }

      return isSportsMarketRecord({ question: row.question, category: row.category })
    })
    .filter((row) => {
      if (!keyword) {
        return true
      }

      const text = `${row.question || ""} ${row.category || ""}`.toLowerCase()
      return text.includes(keyword)
    })
    .filter((row) => matchesCategoryFilter({ question: row.question, category: row.category, categoryFilter: normalizedCategory }))
    .filter((row) => {
      if (!cutoffDate) {
        return true
      }

      const closedAnchor =
        parseDateSafe(row.eventEndAt) ||
        parseDateSafe(row.endDate) ||
        parseDateSafe(row.closedTime) ||
        parseDateSafe(row.sourceCreatedAt) ||
        parseDateSafe(row.eventStartAt)

      return Boolean(closedAnchor && closedAnchor >= cutoffDate)
    })
    .slice(0, marketLimit)

  if (markets.length === 0) {
    return {
      marketsCount: 0,
      bins: [],
      summary: {
        totalVolume: 0,
        preGameVolume: 0,
        inGameVolume: 0,
        postGameVolume: 0,
        uniqueTradersTotal: 0,
        uniqueTradersByPeriodAvailable: true,
        preGamePct: 0,
        inGamePct: 0,
        postGamePct: 0
      }
    }
  }

  const hourMs = 60 * 60 * 1000
  
  // For markets with eventStartAt, use it. For others, will infer from order timestamps
  const marketsWithEventTime = markets.filter(
    (market) => market.eventStartAt || market.sourceCreatedAt || market.endDate || market.closedTime
  )
  
  let windowStartMs, windowEndMs
  if (marketsWithEventTime.length > 0) {
    const resolveAnchorStart = (market) =>
      new Date(
        market.eventStartAt ||
          market.sourceCreatedAt ||
          market.endDate ||
          market.closedTime
      ).getTime()

    const resolveAnchorEnd = (market) =>
      new Date(
        market.eventEndAt ||
          market.endDate ||
          market.closedTime ||
          market.eventStartAt ||
          market.sourceCreatedAt
      ).getTime()

    windowStartMs = Math.min(
      ...marketsWithEventTime.map((market) => resolveAnchorStart(market) - preHours * hourMs)
    )
    windowEndMs = Math.max(
      ...marketsWithEventTime.map((market) => resolveAnchorEnd(market) + postHours * hourMs)
    )
  } else {
    // No markets with eventStartAt; use a wide window for orders
    const now = new Date()
    windowEndMs = now.getTime()
    windowStartMs = windowEndMs - (preHours + postHours) * hourMs * 2 // generous window
  }

  const orderbookRows = await prisma.polymarketOrderBookSnapshot.findMany({
    where: {
      marketId: {
        in: markets.map((market) => market.marketId)
      },
      intervalStart: {
        gte: new Date(windowStartMs),
        lte: new Date(windowEndMs)
      }
    },
    select: {
      marketId: true,
      intervalStart: true,
      totalVolume: true
    }
  })

  const marketMeta = new Map(
    markets.map((market) => {
      const activeStartMs = market.eventStartAt
        ? new Date(market.eventStartAt).getTime()
        : market.sourceCreatedAt
          ? new Date(market.sourceCreatedAt).getTime()
          : market.endDate
            ? new Date(market.endDate).getTime()
            : market.closedTime
              ? new Date(market.closedTime).getTime()
              : null
      const activeEndMs = market.eventEndAt
        ? new Date(market.eventEndAt).getTime()
        : market.endDate
          ? new Date(market.endDate).getTime()
          : market.closedTime
            ? new Date(market.closedTime).getTime()
            : null
      return [market.marketId, { activeStartMs, activeEndMs }]
    })
  )

  const binHours = Math.max(binMinutes, 5) / 60
  const binCount = Math.max(1, Math.ceil((preHours + postHours) / binHours))
  const bins = Array.from({ length: binCount }, (_, index) => {
    const startHour = -preHours + index * binHours
    const endHour = startHour + binHours
    return {
      index,
      startHour: Number(startHour.toFixed(2)),
      endHour: Number(endHour.toFixed(2)),
      label: `${startHour.toFixed(1)}h to ${endHour.toFixed(1)}h`,
      totalVolume: 0,
      snapshotCount: 0,
      marketIds: new Set(),
      traderIds: new Set()
    }
  })

  const localTrades = await prisma.order.findMany({
    where: {
      symbol: {
        in: markets.map((market) => market.marketId)
      },
      createdAt: {
        gte: new Date(windowStartMs),
        lte: new Date(windowEndMs)
      }
    },
    select: {
      symbol: true,
      userId: true,
      createdAt: true
    }
  })

  // For markets without eventStartAt, infer from their earliest order
  const marketsNeedingInference = Array.from(marketMeta.entries())
    .filter(([, meta]) => meta.activeStartMs === null)
    .map(([id]) => id)

  if (marketsNeedingInference.length > 0) {
    const ordersForInference = await prisma.order.findMany({
      where: {
        symbol: { in: marketsNeedingInference }
      },
      orderBy: { createdAt: 'asc' },
      take: marketsNeedingInference.length,
      select: { symbol: true, createdAt: true },
      distinct: ['symbol']
    })

    for (const order of ordersForInference) {
      const meta = marketMeta.get(order.symbol)
      if (meta && meta.activeStartMs === null) {
        meta.activeStartMs = new Date(order.createdAt).getTime()
      }
    }
  }

  const uniqueTraderIds = new Set()
  for (const trade of localTrades) {
    const meta = marketMeta.get(trade.symbol)
    if (!meta || meta.activeStartMs === null) {
      continue
    }

    const tradeMs = new Date(trade.createdAt).getTime()
    const relativeHours = (tradeMs - meta.activeStartMs) / hourMs
    if (relativeHours < -preHours || relativeHours > postHours) {
      continue
    }

    const binIndex = Math.min(
      binCount - 1,
      Math.max(0, Math.floor((relativeHours + preHours) / binHours))
    )

    const bin = bins[binIndex]
    bin.traderIds.add(trade.userId)
    uniqueTraderIds.add(trade.userId)
  }

  let totalVolume = 0
  let preGameVolume = 0
  let inGameVolume = 0
  let postGameVolume = 0

  for (const row of orderbookRows) {
    const meta = marketMeta.get(row.marketId)
    if (!meta || meta.activeStartMs === null) {
      continue
    }

    const snapshotMs = new Date(row.intervalStart).getTime()
    const relativeHours = (snapshotMs - meta.activeStartMs) / hourMs
    if (relativeHours < -preHours || relativeHours > postHours) {
      continue
    }

    const volume = Number(row.totalVolume || 0)
    totalVolume += volume

    if (snapshotMs < meta.activeStartMs) {
      preGameVolume += volume
    } else if (meta.activeEndMs && snapshotMs <= meta.activeEndMs) {
      inGameVolume += volume
    } else {
      postGameVolume += volume
    }

    const binIndex = Math.min(
      binCount - 1,
      Math.max(0, Math.floor((relativeHours + preHours) / binHours))
    )

    const bin = bins[binIndex]
    bin.totalVolume += volume
    bin.snapshotCount += 1
    bin.marketIds.add(row.marketId)
  }

  const binsNormalized = bins.map((bin) => ({
    index: bin.index,
    startHour: bin.startHour,
    endHour: bin.endHour,
    label: bin.label,
    totalVolume: Number(bin.totalVolume.toFixed(4)),
    snapshotCount: bin.snapshotCount,
    uniqueTraders: bin.traderIds.size,
    marketCoveragePct: Number(((bin.marketIds.size / markets.length) * 100).toFixed(2)),
    avgVolumePerSnapshot:
      bin.snapshotCount > 0 ? Number((bin.totalVolume / bin.snapshotCount).toFixed(4)) : 0
  }))

  const toPct = (value) => (totalVolume > 0 ? Number(((value / totalVolume) * 100).toFixed(2)) : 0)

  return {
    marketsCount: markets.length,
    bins: binsNormalized,
    summary: {
      totalVolume: Number(totalVolume.toFixed(4)),
      preGameVolume: Number(preGameVolume.toFixed(4)),
      inGameVolume: Number(inGameVolume.toFixed(4)),
      postGameVolume: Number(postGameVolume.toFixed(4)),
      uniqueTradersTotal: uniqueTraderIds.size,
      uniqueTradersByPeriodAvailable: true,
      preGamePct: toPct(preGameVolume),
      inGamePct: toPct(inGameVolume),
      postGamePct: toPct(postGameVolume)
    }
  }
}

function isMissingQualityReportTableError(error) {
  const prismaCode = error?.code
  const tableName = String(error?.meta?.table || "").toLowerCase()
  const message = String(error?.message || "").toLowerCase()

  // Prisma P2021 => table does not exist.
  return (
    prismaCode === "P2021" &&
    (tableName.includes("polymarketdataqualityreport") ||
      message.includes("polymarketdataqualityreport"))
  )
}

async function findLatestQualityReportSafe() {
  try {
    return await prisma.polymarketDataQualityReport.findFirst({
      orderBy: { generatedAt: "desc" }
    })
  } catch (error) {
    if (isMissingQualityReportTableError(error)) {
      console.warn(
        "[warn] polymarketDataQualityReport table missing; continuing without quality report metadata"
      )
      return null
    }
    throw error
  }
}

async function findQualityReportsSafe({ where, take }) {
  try {
    return await prisma.polymarketDataQualityReport.findMany({
      where,
      orderBy: { generatedAt: "desc" },
      take
    })
  } catch (error) {
    if (isMissingQualityReportTableError(error)) {
      console.warn(
        "[warn] polymarketDataQualityReport table missing; returning empty quality report list"
      )
      return []
    }
    throw error
  }
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
// Polymarket Gamma API 的 category 信息只挂在 /events 端点的 tags 数组上，
// /markets 端点本身不返回 category。这里把 event 的 tag 标签映射到我们前端用的 7 大类目。
const EVENT_TAG_TO_CATEGORY = [
  { keys: ["crypto", "bitcoin", "ethereum", "blockchain", "defi", "nft"], category: "Crypto" },
  { keys: ["politics", "election", "geopolitics", "world", "trump", "biden", "congress", "senate"], category: "Politics" },
  { keys: ["sports", "nba", "nfl", "nhl", "mlb", "soccer", "football", "tennis", "fifa", "olympic"], category: "Sports" },
  { keys: ["tech", "technology", "ai", "artificial-intelligence", "openai", "apple", "google", "microsoft"], category: "Technology" },
  { keys: ["finance", "economy", "stocks", "fed", "inflation", "rates", "ipos", "business"], category: "Finance" },
  { keys: ["entertainment", "music", "movie", "film", "gaming", "celebrity", "tv"], category: "Entertainment" },
]

function categoryFromEventTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return null
  const haystack = tags
    .map((tag) => `${tag?.label || ""} ${tag?.slug || ""}`.toLowerCase())
    .join(" ")
  for (const rule of EVENT_TAG_TO_CATEGORY) {
    if (rule.keys.some((key) => haystack.includes(key))) {
      return rule.category
    }
  }
  return null
}

router.get("/markets", async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query

    // 通过 /events 端点拉数据（自带 tags + 嵌套的 markets[]），这样才能拿到真实 category。
    console.log("📡 Attempting to fetch from Polymarket events API...")
    const eventsLimit = Math.min(Math.max(Number(limit) || 20, 100), 500)
    const response = await fetch(
      `https://gamma-api.polymarket.com/events?limit=${eventsLimit}&offset=${offset}&closed=false&active=true`,
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

    const events = await response.json()
    console.log(`✅ Fetched ${Array.isArray(events) ? events.length : 0} events from Polymarket API`)

    // 摊平：每个 event 下的 market 继承父 event 的 category（来自 tags）
    const data = []
    for (const event of Array.isArray(events) ? events : []) {
      const eventCategory = categoryFromEventTags(event?.tags)
      const eventMarkets = Array.isArray(event?.markets) ? event.markets : []
      for (const market of eventMarkets) {
        if (market?.closed === true || market?.archived === true) continue
        if (market?.active === false) continue
        data.push({
          ...market,
          _eventCategory: eventCategory,
          _eventTags: event?.tags || [],
        })
      }
    }
    console.log(`✅ Flattened to ${data.length} active markets`)
    
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
      
      // category 来自父 event 的 tags（已在上方挂到 _eventCategory 上）
      const eventCategory = market._eventCategory || null

      return {
        id: market.id || market.condition_id || `market-${Date.now()}`,
        question: market.question || market.title || "Unknown Market",
        description: market.description || "",
        category: market.category || market.subcategory || eventCategory || null,
        subcategory: market.subcategory || null,
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
 * Helper: Fetch backtests for a date range to enrich event data
 */
async function getBacktestsForDateRange(startDate, endDate) {
  try {
    const backtests = await prisma.backtest.findMany({
      where: {
        AND: [
          { startTime: { lte: endDate } },
          { endTime: { gte: startDate } }
        ]
      },
      include: {
        group: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return backtests
  } catch (error) {
    console.warn("Failed to fetch backtests for date range:", error.message)
    return []
  }
}

async function getLatestBacktestsForCategory(eventCategory, take = 40) {
  try {
    const latestBacktests = await prisma.backtest.findMany({
      include: {
        group: {
          select: { name: true, description: true, pattern: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    })

    return latestBacktests
      .filter((backtest) => inferBacktestCategoryFromGroup(backtest.group) === eventCategory)
      .slice(0, take)
  } catch (error) {
    console.warn("Failed to fetch latest category backtests:", error.message)
    if (isDatabaseUnavailableError(error) && isBacktestDemoFallbackEnabled()) {
      return getDemoBacktestsByCategory(eventCategory).slice(0, take)
    }
    return []
  }
}

function inferBacktestCategoryFromGroup(group) {
  const groupName = String(group?.name || "").trim().toLowerCase()

  // Prefer explicit mapping for known Polymarket category groups.
  if (groupName === "crypto" || groupName === "cryptocurrency" || groupName === "crypto events") return "crypto"
  if (groupName === "politics" || groupName === "geopolitics & conflict") return "politics"
  if (groupName === "sports" || groupName === "nhl stanley cup 2026" || groupName === "fifa world cup 2026") return "sports"
  if (groupName === "technology" || groupName === "technology & ai" || groupName === "tech product launches") return "technology"
  if (groupName === "finance" || groupName === "stock movements") return "finance"
  if (groupName === "entertainment" || groupName === "entertainment & gaming") return "entertainment"
  if (groupName === "other") return "other"

  return classifyCategoryGroup({
    question: group?.name || "",
    description: `${group?.description || ""} ${group?.pattern || ""}`,
    category: ""
  })
}

function aggregateBacktestMetrics(backtests) {
  if (!Array.isArray(backtests) || backtests.length === 0) {
    return null
  }

  return {
    totalBacktests: backtests.length,
    avgWinRate: backtests.reduce((sum, bt) => sum + bt.winRate, 0) / backtests.length,
    avgRoi: backtests.reduce((sum, bt) => sum + bt.roi, 0) / backtests.length,
    bestRoi: Math.max(...backtests.map((bt) => bt.roi)),
    worstRoi: Math.min(...backtests.map((bt) => bt.roi)),
    totalTrades: backtests.reduce((sum, bt) => sum + bt.totalTrades, 0),
    strategies: [...new Set(backtests.map((bt) => bt.strategyName))]
  }
}

function mapBacktestsToEventMetrics(backtests, source) {
  const metrics = aggregateBacktestMetrics(backtests)
  if (!metrics) {
    return null
  }

  const firstBacktest = backtests[0]

  return {
    ...metrics,
    source,
    matchedBacktestIds: backtests.map((backtest) => backtest.id),
    matchedGroupNames: [...new Set(backtests.map((backtest) => backtest.group?.name).filter(Boolean))],
    matchedStartTime: firstBacktest?.startTime || null,
    matchedEndTime: firstBacktest?.endTime || null
  }
}

function selectMeaningfulBacktests(backtests, maxCount = 6) {
  if (!Array.isArray(backtests) || backtests.length === 0) {
    return []
  }

  const categoryWithTrades = backtests.filter((backtest) => (backtest.totalTrades || 0) > 0)
  const pool = categoryWithTrades.length > 0 ? categoryWithTrades : backtests

  return pool.slice(0, maxCount)
}

async function getBacktestMetricsForEvent({ startDate, endDate, eventCategory }) {
  const rangeBacktests = await getBacktestsForDateRange(startDate, endDate)
  const rangeCategoryBacktests = rangeBacktests.filter((backtest) => {
    const backtestCategory = inferBacktestCategoryFromGroup(backtest.group)
    return backtestCategory === eventCategory
  })

  // Prefer category-matched backtests around the event date, prioritizing runs with trades.
  const selectedRangeBacktests = selectMeaningfulBacktests(rangeCategoryBacktests)
  if (selectedRangeBacktests.length > 0) {
    return mapBacktestsToEventMetrics(selectedRangeBacktests, "category-and-date")
  }

  // Fallback: use latest backtests from the same category when date overlap is missing.
  const latestCategoryBacktests = await getLatestBacktestsForCategory(eventCategory)
  const selectedFallbackBacktests = selectMeaningfulBacktests(latestCategoryBacktests)
  if (selectedFallbackBacktests.length > 0) {
    return mapBacktestsToEventMetrics(selectedFallbackBacktests, "category-fallback")
  }

  return null
}

/**
 * GET /polymarket/calendar-events
 * Calendar feed for upcoming + previous events with Polymarket category groups.
 */
router.get("/calendar-events", async (req, res) => {
  try {
    const categories = parseCategoryFilter(req.query.categories)
    const includePast = String(req.query.includePast ?? "true").toLowerCase() !== "false"
    const upcomingLimit = parsePositiveInt(req.query.upcomingLimit, 120)
    const pastLimit = parsePositiveInt(req.query.pastLimit, 120)
    const cacheKey = getCalendarCacheKey({ categories, includePast, upcomingLimit, pastLimit })

    const cachedResponse = getCachedCalendarResponse(cacheKey)
    if (cachedResponse) {
      return res.json({
        ...cachedResponse,
        cached: true
      })
    }

    const upcomingRequest = fetch(
      `https://gamma-api.polymarket.com/markets?limit=${upcomingLimit}&offset=0&closed=false`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }
    )

    const pastRequest = includePast
      ? fetch(
          `https://gamma-api.polymarket.com/markets?limit=${pastLimit}&offset=0&closed=true`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
          }
        )
      : Promise.resolve(null)

    const [upcomingResponse, pastResponse] = await Promise.all([upcomingRequest, pastRequest])

    if (!upcomingResponse?.ok) {
      throw new Error(`Polymarket API error for upcoming events: ${upcomingResponse?.status || "unknown"}`)
    }

    if (includePast && pastResponse && !pastResponse.ok) {
      throw new Error(`Polymarket API error for past events: ${pastResponse.status}`)
    }

    const [upcomingData, pastData] = await Promise.all([
      upcomingResponse.json(),
      includePast && pastResponse ? pastResponse.json() : Promise.resolve([])
    ])

    const now = Date.now()
    const upcomingEvents = (Array.isArray(upcomingData) ? upcomingData : [])
      .map((market) => mapCalendarEvent(market, "upcoming"))
      .filter(Boolean)

    const pastEvents = (Array.isArray(pastData) ? pastData : [])
      .map((market) => mapCalendarEvent(market, "past"))
      .filter(Boolean)

    const dedupedEvents = Array.from(
      new Map([...upcomingEvents, ...pastEvents].map((event) => [event.id, event])).values()
    )

    // Enrich past events with backtest data
    const eventPromises = dedupedEvents
      .filter((event) => categories.includes(event.category))
      .map(async (event) => {
        const eventTime = new Date(event.eventDate).getTime()
        const resolvedStatus = eventTime < now ? "past" : "upcoming"
        
        // For past events, try to find associated backtests
        let backtestMetrics = null
        if (resolvedStatus === "past") {
          const eventDate = new Date(event.eventDate)
          // Look for backtests run around the event date (within +/- CALENDAR_BACKTEST_MATCH_WINDOW_DAYS)
          const windowMs = CALENDAR_BACKTEST_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
          const rangeStart = new Date(eventDate.getTime() - windowMs)
          const rangeEnd = new Date(eventDate.getTime() + windowMs)
          backtestMetrics = await getBacktestMetricsForEvent({
            startDate: rangeStart,
            endDate: rangeEnd,
            eventCategory: event.category
          })
        }
        
        return {
          ...event,
          status: resolvedStatus,
          ...(backtestMetrics ? { backtestMetrics } : {})
        }
      })

    const filteredEvents = (await Promise.all(eventPromises))
      .sort((firstEvent, secondEvent) => {
        const firstTime = new Date(firstEvent.eventDate).getTime()
        const secondTime = new Date(secondEvent.eventDate).getTime()
        return firstTime - secondTime
      })

    const responsePayload = {
      success: true,
      source: "polymarket-api",
      categories,
      generatedAt: new Date().toISOString(),
      total: filteredEvents.length,
      upcomingCount: filteredEvents.filter((event) => event.status === "upcoming").length,
      pastCount: filteredEvents.filter((event) => event.status === "past").length,
      events: filteredEvents
    }

    setCachedCalendarResponse(cacheKey, responsePayload)

    res.json({
      ...responsePayload,
      cached: false
    })
  } catch (error) {
    console.error("❌ Calendar events API Error:", error.message)

    if (!isMockFallbackEnabled()) {
      return res.status(502).json({
        success: false,
        source: "polymarket-api",
        error: "Failed to fetch calendar events from Polymarket API",
        detail: error.message,
        hint: "Set POLYMARKET_ENABLE_MOCK_FALLBACK=true to allow mock fallback responses"
      })
    }

    const now = Date.now()
    const mockEvents = [
      {
        id: "mock-calendar-1",
        question: "Will Lakers win NBA championship this season?",
        description: "Sports event",
        category: "sports",
        status: "upcoming",
        eventDate: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
        analysisPath: "/polymarket/details/mock-calendar-1",
        topOutcome: "No",
        topProbability: 62
      },
      {
        id: "mock-calendar-2",
        question: "Will OpenAI release a major model this quarter?",
        description: "Technology event",
        category: "technology",
        status: "upcoming",
        eventDate: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
        analysisPath: "/polymarket/details/mock-calendar-2",
        topOutcome: "Yes",
        topProbability: 57
      },
      {
        id: "mock-calendar-3",
        question: "Will the Fed cut rates at next meeting?",
        description: "Finance event",
        category: "finance",
        status: "upcoming",
        eventDate: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString(),
        analysisPath: "/polymarket/details/mock-calendar-3",
        topOutcome: "Yes",
        topProbability: 54
      },
      {
        id: "mock-calendar-4",
        question: "Did Celtics win their previous playoff game?",
        description: "Historical sports event",
        category: "sports",
        status: "past",
        eventDate: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        analysisPath: "/polymarket/details/mock-calendar-4",
        topOutcome: "Yes",
        topProbability: 71
      }
    ]

    const categories = parseCategoryFilter(req.query.categories)
    const filteredMockEvents = mockEvents
      .filter((event) => categories.includes(event.category))
      .sort((firstEvent, secondEvent) =>
        new Date(firstEvent.eventDate).getTime() - new Date(secondEvent.eventDate).getTime()
      )

    res.json({
      success: true,
      source: "mock-data",
      categories,
      generatedAt: new Date().toISOString(),
      total: filteredMockEvents.length,
      upcomingCount: filteredMockEvents.filter((event) => event.status === "upcoming").length,
      pastCount: filteredMockEvents.filter((event) => event.status === "past").length,
      events: filteredMockEvents,
      note: "Using mock calendar data",
      reason: error.message
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
    const cacheKey = buildArchiveCacheKey("archive/status", { windowHours })
    const cached = getArchiveCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

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
      findLatestQualityReportSafe()
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

    const payload = {
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
    }

    setArchiveCache(cacheKey, payload, 30 * 1000)
    res.json(payload)
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      const windowHours = parsePositiveInt(req.query.windowHours, 24)
      const intervalMs = getArchiveIntervalMs()
      return res.json({
        success: true,
        fallback: true,
        source: "degraded-no-db",
        windowHours,
        intervalMinutes: Math.floor(intervalMs / 60000),
        expectedIntervals: 0,
        summary: {
          distinctMarkets: 0,
          distinctTokens: 0,
          marketSnapshotCount: 0,
          orderBookSnapshotCount: 0,
          marketCoveragePct: 0,
          orderBookCoveragePct: 0,
          staleMinutes: null,
          latestSnapshotAt: null
        },
        latestQualityReport: null,
        note: "Archive database is temporarily unavailable. Returning empty status payload."
      })
    }

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
    const cacheKey = buildArchiveCacheKey("archive/gaps", {
      type,
      windowHours,
      limit,
      maxMissingPerKey,
      useObservedSpan
    })
    const cached = getArchiveCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

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

    const payload = {
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
    }

    setArchiveCache(cacheKey, payload, 60 * 1000)
    res.json(payload)
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
    const cacheKey = buildArchiveCacheKey("archive/replay-windows", {
      windowHours,
      minCoveragePct
    })
    const cached = getArchiveCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

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

    const payload = {
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
    }

    setArchiveCache(cacheKey, payload, 60 * 1000)
    res.json(payload)
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
    const cacheKey = buildArchiveCacheKey("archive/replay-slice", {
      windowHours,
      minCoveragePct,
      maxIntervals,
      includeMarkets,
      includeOrderBooks,
      marketIdFilter,
      tokenIdFilter,
      outcomeFilter,
      start: req.query.start || null,
      end: req.query.end || null
    })
    const cached = getArchiveCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

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
        const payload = {
          success: true,
          sourceWindow,
          range: {
            start: null,
            end: null,
            intervalMinutes: Math.floor(intervalMs / 60000),
            populatedIntervals: 0,
            requestedIntervals: 0
          },
          counts: {
            marketSnapshots: 0,
            orderBookSnapshots: 0
          },
          filters: {
            marketId: marketIdFilter,
            tokenId: tokenIdFilter,
            outcome: outcomeFilter
          },
          marketSnapshots: [],
          orderBookSnapshots: [],
          warning: "No replayable window found yet for the requested coverage threshold"
        }

        setArchiveCache(cacheKey, payload, 60 * 1000)
        return res.json(payload)
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

    const payload = {
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
    }

    setArchiveCache(cacheKey, payload, 60 * 1000)
    res.json(payload)
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
    const cacheKey = buildArchiveCacheKey("archive/quality-reports", { limit, windowHours })
    const cached = getArchiveCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

    const where = windowHours ? { windowHours } : undefined
    const reports = await findQualityReportsSafe({
      where,
      take: limit
    })

    const payload = {
      success: true,
      count: reports.length,
      reports
    }

    setArchiveCache(cacheKey, payload, 60 * 1000)
    res.json(payload)
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

    clearArchiveCache()

    let qualityReport = null
    if (runQualityReport) {
      qualityReport = await createArchiveQualityReport(windowHours)
      clearArchiveCache()
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
    if (isMissingQualityReportTableError(error)) {
      return res.status(503).json({
        success: false,
        error:
          "Archive quality reports table is missing. Run Prisma migrations for polymarketDataQualityReport."
      })
    }
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
    clearArchiveCache()

    res.status(201).json({
      success: true,
      report
    })
  } catch (error) {
    if (isMissingQualityReportTableError(error)) {
      return res.status(503).json({
        success: false,
        error:
          "Archive quality reports table is missing. Run Prisma migrations for polymarketDataQualityReport."
      })
    }
    console.error("[error] Polymarket quality report generation failed:", error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/market-categories
 * Returns distinct category options from archived market snapshots.
 */
router.get("/market-categories", async (req, res) => {
  try {
    const cacheKey = buildArchiveCacheKey("market-categories")
    const cached = getArchiveCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

    const grouped = await prisma.polymarketMarketSnapshot.groupBy({
      by: ["category"],
      where: {
        category: {
          not: null
        }
      }
    })

    const categories = toCategoryOptions(grouped.map((row) => row.category))

    const payload = {
      success: true,
      count: categories.length,
      categories
    }

    setArchiveCache(cacheKey, payload, 60 * 60 * 1000)
    return res.json(payload)
  } catch (error) {
    console.error("[error] Market categories endpoint failed:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/sports/active-periods
 * Returns ended sports markets with inferred market lifecycle + active period windows.
 * Query: limit (default 100), source=archive|api|auto
 */
router.get("/sports/active-periods", async (req, res) => {
  const limit = Math.min(parsePositiveInt(req.query.limit, 100), 500)
  const source = String(req.query.source || "auto").toLowerCase()
  const keyword = String(req.query.keyword || "").trim().toLowerCase()
  const category = String(req.query.category || "").trim().toLowerCase()
  const historyWindowDays = parseHistoryWindowDays(req.query.historyWindowDays, 90)
  const marketScope = String(req.query.marketScope || "sports").toLowerCase()
  const sportsOnly = marketScope !== "all"
  const cacheKey = buildArchiveCacheKey("sports/active-periods", {
    limit,
    source,
    keyword,
    category,
    historyWindowDays,
    marketScope
  })
  const cached = getArchiveCache(cacheKey)
  if (cached) {
    return res.json(cached)
  }

  try {
    if (source === "api") {
      const rows = await fetchClosedMarketsFromGamma(limit * 3, { sportsOnly, keyword, category, historyWindowDays })
      const payload = {
        success: true,
        source: "gamma-closed-markets-api",
        marketScope: sportsOnly ? "sports" : "all",
        keyword: keyword || null,
        category: category || null,
        historyWindowDays,
        count: Math.min(limit, rows.length),
        rows: buildSportsActivePeriodsFromGammaRows(rows.slice(0, limit))
      }

      setArchiveCache(cacheKey, payload, 2 * 60 * 1000)
      return res.json(payload)
    }

    const archiveRows = await buildSportsActivePeriodsFromArchive(limit, keyword, {
      sportsOnly,
      category,
      historyWindowDays
    })
    const shouldReturnArchiveDirectly =
      source === "archive" ||
      // Sports-only view can rely on archive if it has at least some rows.
      (sportsOnly && archiveRows.length > 0) ||
      // All-categories view should only stick to archive when it is sufficiently populated.
      (!sportsOnly && archiveRows.length >= limit)

    if (shouldReturnArchiveDirectly) {
      const payload = {
        success: true,
        source: "archive",
        marketScope: sportsOnly ? "sports" : "all",
        keyword: keyword || null,
        category: category || null,
        historyWindowDays,
        count: archiveRows.length,
        rows: archiveRows
      }

      setArchiveCache(cacheKey, payload, 2 * 60 * 1000)
      return res.json(payload)
    }

    const rows = await fetchClosedMarketsFromGamma(limit * 3, { sportsOnly, keyword, category, historyWindowDays })
    const payload = {
      success: true,
      source: "gamma-closed-markets-api",
      marketScope: sportsOnly ? "sports" : "all",
      keyword: keyword || null,
      category: category || null,
      historyWindowDays,
      count: Math.min(limit, rows.length),
      rows: buildSportsActivePeriodsFromGammaRows(rows.slice(0, limit))
    }

    setArchiveCache(cacheKey, payload, 2 * 60 * 1000)
    return res.json(payload)
  } catch (error) {
    if (isMissingPolymarketEventColumnsError(error)) {
      return res.status(503).json({
        success: false,
        error:
          "Sports active period fields are not available yet. Run Prisma migration for PolymarketMarketSnapshot event columns, or query with source=api."
      })
    }

    console.error("[error] Sports active periods endpoint failed:", error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /polymarket/sports/active-period-activity
 * Kickoff-relative activity aggregation for heatmap/charting.
 * Query: marketLimit=120, preHours=168, postHours=6, binMinutes=60
 */
router.get("/sports/active-period-activity", async (req, res) => {
  const marketLimit = Math.min(parsePositiveInt(req.query.marketLimit, 120), 500)
  const preHours = Math.min(parsePositiveInt(req.query.preHours, 168), 24 * 30)
  const postHours = Math.min(parsePositiveInt(req.query.postHours, 6), 24 * 7)
  const binMinutes = Math.min(parsePositiveInt(req.query.binMinutes, 60), 24 * 60)
  const source = String(req.query.source || "auto").toLowerCase()
  const keyword = String(req.query.keyword || "").trim().toLowerCase()
  const category = String(req.query.category || "").trim().toLowerCase()
  const historyWindowDays = parseHistoryWindowDays(req.query.historyWindowDays, 90)
  const marketScope = String(req.query.marketScope || "sports").toLowerCase()
  const sportsOnly = marketScope !== "all"
  const cacheKey = buildArchiveCacheKey("sports/active-period-activity", {
    marketLimit,
    preHours,
    postHours,
    binMinutes,
    source,
    keyword,
    category,
    historyWindowDays,
    marketScope
  })
  const cached = getArchiveCache(cacheKey)
  if (cached) {
    return res.json(cached)
  }

  try {
    if (source === "api") {
      const rows = (await fetchClosedMarketsFromGamma(marketLimit * 3, {
        sportsOnly,
        keyword,
        category,
        historyWindowDays
      })).slice(
        0,
        marketLimit
      )

      const proxyData = await buildSportsKickoffActivityProxyFromGammaRows({
        rows,
        preHours,
        postHours,
        binMinutes
      })

      const payload = {
        success: true,
        source: "gamma-timing-proxy-activity",
        marketScope: sportsOnly ? "sports" : "all",
        keyword: keyword || null,
        category: category || null,
        historyWindowDays,
        ...proxyData,
        note: "Kickoff activity is generated from Gamma event timing metadata."
      }

      setArchiveCache(cacheKey, payload, 2 * 60 * 1000)
      return res.json(payload)
    }

    const archiveData = await buildSportsKickoffActivityFromArchive({
      marketLimit,
      preHours,
      postHours,
      binMinutes,
      keyword,
      category,
      sportsOnly,
      historyWindowDays
    })

    const archiveHasActivitySignal = Array.isArray(archiveData?.bins)
      ? archiveData.bins.some((bin) => {
          const volume = Number(bin?.totalVolume || 0)
          const snapshots = Number(bin?.snapshotCount || 0)
          const traders = Number(bin?.uniqueTraders || 0)
          return volume > 0 || snapshots > 0 || traders > 0
        })
      : false

    if (source === "archive" || archiveHasActivitySignal) {
      const payload = {
        success: true,
        source: "archive",
        marketScope: sportsOnly ? "sports" : "all",
        keyword: keyword || null,
        category: category || null,
        historyWindowDays,
        ...archiveData
      }

      setArchiveCache(cacheKey, payload, 2 * 60 * 1000)
      return res.json(payload)
    }

    const rows = (await fetchClosedMarketsFromGamma(marketLimit * 3, {
      sportsOnly,
      keyword,
      category,
      historyWindowDays
    })).slice(
      0,
      marketLimit
    )

    const proxyData = await buildSportsKickoffActivityProxyFromGammaRows({
      rows,
      preHours,
      postHours,
      binMinutes
    })

    const payload = {
      success: true,
      source: "gamma-timing-proxy-activity",
      marketScope: sportsOnly ? "sports" : "all",
      keyword: keyword || null,
      category: category || null,
      historyWindowDays,
      ...proxyData,
      note: archiveData.marketsCount > 0
        ? "Archive rows were found but had no usable activity signal yet, so kickoff activity is currently generated from Gamma event timing metadata."
        : "Kickoff activity is generated from Gamma event timing metadata."
    }

    setArchiveCache(cacheKey, payload, 2 * 60 * 1000)
    return res.json(payload)
  } catch (error) {
    if (isMissingPolymarketEventColumnsError(error)) {
      return res.status(503).json({
        success: false,
        error:
          "Sports activity aggregation needs event timing columns in PolymarketMarketSnapshot. Run Prisma migration first."
      })
    }

    if (isDatabaseUnavailableError(error)) {
      const binWindowHours = preHours + postHours
      const safeBinHours = Math.max(binMinutes, 5) / 60
      const binCount = Math.max(1, Math.ceil(binWindowHours / safeBinHours))
      const bins = Array.from({ length: binCount }, (_, index) => {
        const startHour = -preHours + index * safeBinHours
        const endHour = startHour + safeBinHours
        return {
          index,
          startHour: Number(startHour.toFixed(2)),
          endHour: Number(endHour.toFixed(2)),
          label: `${startHour.toFixed(1)}h to ${endHour.toFixed(1)}h`,
          totalVolume: 0,
          snapshotCount: 0,
          uniqueTraders: 0,
          marketCoveragePct: 0,
          avgVolumePerSnapshot: 0
        }
      })

      return res.json({
        success: true,
        fallback: true,
        source: "degraded-no-db",
        marketScope: sportsOnly ? "sports" : "all",
        keyword: keyword || null,
        category: category || null,
        historyWindowDays,
        marketsCount: 0,
        bins,
        summary: {
          totalVolume: 0,
          preGameVolume: 0,
          inGameVolume: 0,
          postGameVolume: 0,
          uniqueTradersTotal: 0,
          uniqueTradersByPeriodAvailable: true,
          preGamePct: 0,
          inGamePct: 0,
          postGamePct: 0
        },
        note: "Sports activity archive data is temporarily unavailable. Returning empty activity bins."
      })
    }

    console.error("[error] Sports active period activity endpoint failed:", error)
    return res.status(500).json({
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
 * Sync market groups from Polymarket page category logic
 * POST /polymarket/market-groups/sync-polymarket
 */
router.post("/market-groups/sync-polymarket", authenticate, async (req, res) => {
  try {
    const marketGrouping = require("../services/marketGrouping")
    const groups = await marketGrouping.syncGroupsFromPolymarketCategories()
    return res.json({
      success: true,
      message: "Polymarket category groups synchronized",
      groups
    })
  } catch (error) {
    console.error("Polymarket category group sync error:", error)

    if (isMissingBacktestSchemaError(error)) {
      return res.status(503).json({
        success: false,
        error: "Backtest database tables are not available yet. Please run Prisma migrations before syncing market groups."
      })
    }

    if (isDatabaseUnavailableError(error)) {
      if (!isBacktestDemoFallbackEnabled()) {
        return res.json({
          success: true,
          message: "Polymarket category groups unavailable due to database outage",
          groups: [],
          fallback: true,
        })
      }

      return res.json({
        success: true,
        message: "Polymarket category groups unavailable due to database outage; returned demo groups",
        groups: DEMO_BACKTEST_GROUPS,
        fallback: true,
      })
    }

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
    const mode = req.query.mode === "polymarket" ? "polymarket" : "all"
    const groups = await marketGrouping.getAllGroups({ mode })
    return res.json({
      success: true,
      groups
    })
  } catch (error) {
    console.error("Error fetching market groups:", error)

    if (isMissingBacktestSchemaError(error)) {
      return res.status(503).json({
        success: false,
        error: "Backtest database tables are not available yet. Please run Prisma migrations before loading market groups."
      })
    }

    if (isDatabaseUnavailableError(error)) {
      if (!isBacktestDemoFallbackEnabled()) {
        return res.json({
          success: true,
          message: "Market groups are unavailable because the database is offline or quota-limited.",
          groups: [],
          fallback: true,
        })
      }

      return res.json({
        success: true,
        message: "Database is temporarily unavailable. Showing demo backtest groups in fallback mode.",
        groups: DEMO_BACKTEST_GROUPS,
        fallback: true,
      })
    }

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
  const { groupName, strategyName = "momentum", params = {}, options = {}, marketId = null } = req.body || {}

  try {
    if (!groupName) {
      return res.status(400).json({
        success: false,
        error: "groupName is required"
      })
    }

    const normalizedMarketId = String(marketId || options?.marketId || "").trim()
    const effectiveOptions = normalizedMarketId
      ? { ...options, marketId: normalizedMarketId }
      : options

    const backtestEngine = require("../services/backtestEngine")
    const results = await backtestEngine.runBacktest(groupName, strategyName, params, effectiveOptions)
    
    return res.json({
      success: true,
      message: "Backtest completed successfully",
      results
    })
  } catch (error) {
    console.error("Backtest error:", error)

    const errorMessage = String(error?.message || "")

    if (errorMessage.includes("not found or has no markets")) {
      if (isBacktestDemoFallbackEnabled()) {
        return res.json({
          success: true,
          fallback: true,
          message: "Selected market group is empty in the live archive. Showing demo backtest output instead.",
          results: getDemoBacktestsForGroup(groupName, 1),
        })
      }

      return res.status(400).json({
        success: false,
        error: "Selected market group has no synced markets yet. Run group sync first or choose another group."
      })
    }

    if (errorMessage.includes("Insufficient data for backtest")) {
      if (isBacktestDemoFallbackEnabled()) {
        return res.json({
          success: true,
          fallback: true,
          message: "Backtest archive does not yet contain enough historical snapshots. Showing demo backtest output instead.",
          results: getDemoBacktestsForGroup(groupName, 1),
        })
      }

      return res.json({
        success: false,
        code: "INSUFFICIENT_BACKTEST_DATA",
        error: errorMessage,
        hint: "Collect Polymarket archive snapshots first, then rerun backtest."
      })
    }

    if (error?.code === "BACKTEST_NO_TRADES" || errorMessage.includes("Backtest produced 0 trades")) {
      return res.json({
        success: false,
        code: "BACKTEST_NO_TRADES",
        error: errorMessage,
        hint: "Pick a more volatile market, widen the time window, or lower the buy/sell threshold so the strategy can fire at least one trade."
      })
    }

    if (isDatabaseUnavailableError(error)) {
      return res.json({
        success: true,
        fallback: true,
        message: "Backtest engine is temporarily unavailable because database connectivity is degraded.",
        results: null
      })
    }

    if (isMissingBacktestSchemaError(error)) {
      return res.status(503).json({
        success: false,
        error: "Backtest database tables are not available yet. Please run Prisma migrations before running backtests."
      })
    }

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
  const groupName = String(req.query.groupName || "").trim() || null
  const limit = req.query.limit || 10

  try {
    const backtestEngine = require("../services/backtestEngine")
    const results = await backtestEngine.getBacktestResults(groupName, parseInt(limit, 10))

    if (results.length === 0 && isBacktestDemoFallbackEnabled()) {
      const demoResults = groupName
        ? getDemoBacktestsForGroup(groupName, parseInt(limit, 10))
        : DEMO_BACKTEST_RESULTS.slice(0, parseInt(limit, 10))

      return res.json({
        success: true,
        results: demoResults,
        fallback: true,
        message: groupName
          ? `No archived backtests exist yet for ${groupName}. Showing demo results.`
          : "No archived backtests exist yet. Showing demo results.",
      })
    }
    
    return res.json({
      success: true,
      results
    })
  } catch (error) {
    console.error("Error fetching backtest results:", error)

    if (isDatabaseUnavailableError(error)) {
      if (!isBacktestDemoFallbackEnabled()) {
        return res.json({
          success: true,
          results: [],
          fallback: true,
        })
      }

      const mockResults = getDemoBacktestsForGroup(groupName, parseInt(limit, 10))
      return res.json({
        success: true,
        results: mockResults,
        fallback: true,
      })
    }

    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Get a detailed backtest report with trade-level details
 * GET /polymarket/backtest/report/:id
 */
router.get("/backtest/report/:id", async (req, res) => {
  const id = req.params.id

  try {
    const backtestEngine = require("../services/backtestEngine")
    const report = await backtestEngine.getBacktestReport(id)

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Backtest report not found"
      })
    }

    return res.json({
      success: true,
      report
    })
  } catch (error) {
    console.error("Error fetching backtest report:", error)

    if (isDatabaseUnavailableError(error)) {
      const fallbackReport = isBacktestDemoFallbackEnabled()
        ? getDemoBacktestReport(id)
        : createUnavailableBacktestReport(id)

      return res.json({
        success: true,
        report: fallbackReport,
        fallback: true,
        message: "Database temporarily unavailable. Showing fallback backtest report.",
      })
    }

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
  const groupName = req.query.groupName

  try {
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

    if (isDatabaseUnavailableError(error)) {
      if (!isBacktestDemoFallbackEnabled()) {
        return res.json({
          success: true,
          backtest: null,
          fallback: true,
        })
      }

      const mockBest = getDemoBacktestsForGroup(groupName, 1)[0] || null
      return res.json({
        success: true,
        backtest: mockBest,
        fallback: true,
      })
    }

    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * Get markets within a group that have enough archive snapshots to backtest.
 * GET /polymarket/backtest/available-markets?groupName=Politics&minSnapshots=2
 */
router.get("/backtest/available-markets", async (req, res) => {
  try {
    const groupName = String(req.query.groupName || "").trim()
    if (!groupName) {
      return res.status(400).json({ success: false, error: "groupName is required" })
    }

    const minSnapshots = Math.max(
      2,
      Number.isFinite(parseInt(req.query.minSnapshots, 10))
        ? parseInt(req.query.minSnapshots, 10)
        : 2
    )

    const group = await prisma.marketGroup.findUnique({ where: { name: groupName } })
    if (!group) {
      return res.json({ success: true, groupName, markets: [], total: 0 })
    }

    if (!Array.isArray(group.markets) || group.markets.length === 0) {
      return res.json({ success: true, groupName, markets: [], total: 0 })
    }

    const grouped = await prisma.polymarketMarketSnapshot.groupBy({
      by: ["marketId"],
      where: { marketId: { in: group.markets } },
      _count: { _all: true },
      _max: { intervalStart: true }
    })

    const eligible = grouped.filter((row) => row._count._all >= minSnapshots)
    if (eligible.length === 0) {
      return res.json({ success: true, groupName, markets: [], total: 0 })
    }

    const eligibleIds = eligible.map((row) => row.marketId)

    const latestSnapshots = await prisma.polymarketMarketSnapshot.findMany({
      where: { marketId: { in: eligibleIds } },
      orderBy: { intervalStart: "desc" },
      distinct: ["marketId"],
      select: {
        marketId: true,
        question: true,
        outcomes: true,
        outcomePrices: true,
        category: true,
        endDate: true,
        volume: true,
        liquidity: true,
        closed: true
      }
    })

    const countById = new Map(eligible.map((row) => [row.marketId, row._count._all]))
    const latestById = new Map(eligible.map((row) => [row.marketId, row._max.intervalStart]))

    const markets = latestSnapshots
      .map((snap) => ({
        id: snap.marketId,
        question: snap.question,
        outcomes: snap.outcomes,
        outcomePrices: snap.outcomePrices,
        category: snap.category,
        endDate: snap.endDate,
        volume: snap.volume,
        liquidity: snap.liquidity,
        closed: snap.closed,
        snapshotCount: countById.get(snap.marketId) || 0,
        latestSnapshotAt: latestById.get(snap.marketId) || null
      }))
      .sort((a, b) => (b.snapshotCount || 0) - (a.snapshotCount || 0))

    return res.json({
      success: true,
      groupName,
      total: markets.length,
      markets
    })
  } catch (error) {
    console.error("Error loading backtest available markets:", error)
    return res.status(500).json({ success: false, error: error.message })
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
