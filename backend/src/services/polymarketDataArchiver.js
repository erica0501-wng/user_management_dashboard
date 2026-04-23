const prisma = require("../prisma")
const discord = require("./discordNotifier")

class PolymarketDataArchiver {
  constructor() {
    this.isRunning = false
    this.isArchiving = false
    this.intervalId = null
    this.archiveIntervalMs = this.parsePositiveInt(
      process.env.POLYMARKET_ARCHIVE_INTERVAL_MS,
      5 * 60 * 1000
    )
    this.marketLimit = this.parsePositiveInt(
      process.env.POLYMARKET_ARCHIVE_MARKET_LIMIT,
      50
    )
    this.closedMarketLimit = this.parsePositiveInt(
      process.env.POLYMARKET_ARCHIVE_CLOSED_MARKET_LIMIT,
      50
    )
    this.closedLookbackHours = this.parsePositiveInt(
      process.env.POLYMARKET_ARCHIVE_CLOSED_LOOKBACK_HOURS,
      72
    )
    this.includeClosedMarkets =
      process.env.POLYMARKET_ARCHIVE_INCLUDE_CLOSED_MARKETS !== "false"
    this.closedSportsOnly = process.env.POLYMARKET_ARCHIVE_CLOSED_SPORTS_ONLY !== "false"
    this.warnedMissingEventColumns = false
  }

  parsePositiveInt(value, fallback) {
    const parsed = parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback
    }
    return parsed
  }

  start() {
    if (this.isRunning) {
      console.log("[warn] Polymarket data archiver is already running")
      return
    }

    this.isRunning = true
    console.log(
      `[info] Starting Polymarket data archiver (interval ${this.archiveIntervalMs / 1000}s, market limit ${this.marketLimit})`
    )

    this.archiveSnapshots()
    this.intervalId = setInterval(() => {
      this.archiveSnapshots()
    }, this.archiveIntervalMs)
  }

  stop() {
    if (!this.isRunning) {
      console.log("[warn] Polymarket data archiver is not running")
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    console.log("[info] Polymarket data archiver stopped")
  }

  getIntervalStart(now = new Date()) {
    const bucketMs = Math.max(60000, this.archiveIntervalMs)
    return new Date(Math.floor(now.getTime() / bucketMs) * bucketMs)
  }

  normalizeArray(value, fallback = []) {
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

  toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") {
      return null
    }

    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  toDateOrNull(value) {
    if (!value) {
      return null
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  isSportsMarket(rawMarket) {
    const text = `${rawMarket?.question || ""} ${rawMarket?.description || ""}`.toLowerCase()
    const category = String(rawMarket?.category || "").toLowerCase()
    if (category.includes("sport")) {
      return true
    }

    const sportsPattern =
      /\b(nba|nfl|nhl|mlb|soccer|football|basketball|tennis|hockey|baseball|world cup|premier league|championship|olympics|fifa|ufc|boxing|indy|f1|grand prix|copa america|euro 2020)\b/i
    return sportsPattern.test(text)
  }

  isMissingEventColumnError(error) {
    const code = String(error?.code || "")
    const message = String(error?.message || "").toLowerCase()
    const metaColumn = String(error?.meta?.column || "").toLowerCase()

    if (code !== "P2022") {
      return false
    }

    return (
      metaColumn.includes("eventstartat") ||
      metaColumn.includes("eventendat") ||
      metaColumn.includes("closedtime") ||
      metaColumn.includes("sourcecreatedat") ||
      metaColumn.includes("category") ||
      metaColumn.includes("closed") ||
      message.includes("eventstartat") ||
      message.includes("eventendat") ||
      message.includes("closedtime") ||
      message.includes("sourcecreatedat") ||
      message.includes("\"category\"") ||
      message.includes("\"closed\"")
    )
  }

  normalizeMarket(rawMarket) {
    const events = this.normalizeArray(rawMarket.events, [])
    const primaryEvent = events.length > 0 ? events[0] : null
    const outcomes = this.normalizeArray(rawMarket.outcomes, ["Yes", "No"])
    const outcomePrices = this.normalizeArray(rawMarket.outcomePrices, outcomes.map(() => "0.5"))
    const tokenIds = this.normalizeArray(rawMarket.clobTokenIds, [])

    return {
      id: String(rawMarket.id || rawMarket.condition_id || ""),
      question: rawMarket.question || rawMarket.title || "Unknown market",
      category: rawMarket.category || primaryEvent?.category || null,
      closed: Boolean(rawMarket.closed),
      closedTime: this.toDateOrNull(rawMarket.closedTime || primaryEvent?.closedTime),
      eventStartAt: this.toDateOrNull(primaryEvent?.startDate),
      eventEndAt: this.toDateOrNull(primaryEvent?.endDate),
      sourceCreatedAt: this.toDateOrNull(rawMarket.createdAt || primaryEvent?.createdAt),
      outcomes,
      outcomePrices,
      tokenIds,
      volume: this.toNumberOrNull(rawMarket.volume || rawMarket.volume24hr),
      liquidity: this.toNumberOrNull(rawMarket.liquidity),
      endDate: this.toDateOrNull(rawMarket.endDate || rawMarket.end_date_iso || rawMarket.closesAt)
    }
  }

  async fetchMarkets({ limit, offset = 0, closed }) {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=${offset}&closed=${closed ? "true" : "false"}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status}`)
    }

    const payload = await response.json()
    return Array.isArray(payload) ? payload : []
  }

  filterRecentClosedMarkets(markets) {
    const now = Date.now()
    const lookbackMs = this.closedLookbackHours * 60 * 60 * 1000

    return markets.filter((market) => {
      const closedTime = this.toDateOrNull(market.closedTime)
      const endDate = this.toDateOrNull(market.endDate || market.end_date_iso || market.closesAt)
      const anchor = closedTime || endDate

      if (!anchor) {
        return false
      }

      const isRecent = now - anchor.getTime() <= lookbackMs
      if (!isRecent) {
        return false
      }

      if (!this.closedSportsOnly) {
        return true
      }

      return this.isSportsMarket(market)
    })
  }

  async fetchMarketsForArchive() {
    const openMarkets = await this.fetchMarkets({ limit: this.marketLimit, closed: false })

    const allMarkets = [...openMarkets]
    if (this.includeClosedMarkets) {
      const closedMarkets = await this.fetchMarkets({
        limit: this.closedMarketLimit,
        closed: true
      })
      allMarkets.push(...this.filterRecentClosedMarkets(closedMarkets))
    }

    const uniqueByMarketId = new Map()
    for (const market of allMarkets) {
      const marketId = String(market?.id || market?.condition_id || "")
      if (!marketId) {
        continue
      }

      if (!uniqueByMarketId.has(marketId)) {
        uniqueByMarketId.set(marketId, market)
      }
    }

    return Array.from(uniqueByMarketId.values())
  }

  async upsertMarketSnapshot(market, intervalStart) {
    const baseData = {
      question: market.question,
      outcomes: market.outcomes,
      outcomePrices: market.outcomePrices,
      tokenIds: market.tokenIds,
      volume: market.volume,
      liquidity: market.liquidity,
      endDate: market.endDate
    }

    const extendedData = {
      ...baseData,
      category: market.category,
      closed: market.closed,
      closedTime: market.closedTime,
      eventStartAt: market.eventStartAt,
      eventEndAt: market.eventEndAt,
      sourceCreatedAt: market.sourceCreatedAt
    }

    try {
      await prisma.polymarketMarketSnapshot.upsert({
        where: {
          marketId_intervalStart: {
            marketId: market.id,
            intervalStart
          }
        },
        update: extendedData,
        create: {
          marketId: market.id,
          ...extendedData,
          intervalStart
        }
      })
    } catch (error) {
      if (!this.isMissingEventColumnError(error)) {
        throw error
      }

      if (!this.warnedMissingEventColumns) {
        console.warn(
          "[warn] Event timing columns are missing in PolymarketMarketSnapshot. Run Prisma migration to persist eventStartAt/eventEndAt/closedTime/category/sourceCreatedAt. Falling back to legacy columns for now."
        )
        this.warnedMissingEventColumns = true
      }

      await prisma.polymarketMarketSnapshot.upsert({
        where: {
          marketId_intervalStart: {
            marketId: market.id,
            intervalStart
          }
        },
        update: baseData,
        create: {
          marketId: market.id,
          ...baseData,
          intervalStart
        }
      })
    }
  }

  async fetchOrderBook(tokenId) {
    const normalizedTokenId = String(tokenId || "")

    if (
      !normalizedTokenId ||
      normalizedTokenId === "null" ||
      normalizedTokenId === "undefined" ||
      normalizedTokenId.includes("mock")
    ) {
      return null
    }

    const response = await fetch(`https://clob.polymarket.com/book?token_id=${normalizedTokenId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json"
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch order book for ${normalizedTokenId}: ${response.status}`)
    }

    return response.json()
  }

  buildOrderBookMetrics(orderBook) {
    const bids = Array.isArray(orderBook.bids) ? orderBook.bids : []
    const asks = Array.isArray(orderBook.asks) ? orderBook.asks : []

    const bidVolume = bids.reduce((sum, bid) => {
      const size = parseFloat(bid.size || 0)
      return sum + (Number.isFinite(size) ? size : 0)
    }, 0)

    const askVolume = asks.reduce((sum, ask) => {
      const size = parseFloat(ask.size || 0)
      return sum + (Number.isFinite(size) ? size : 0)
    }, 0)

    const bestBid = bids.length > 0 ? this.toNumberOrNull(bids[0].price) : null
    const bestAsk = asks.length > 0 ? this.toNumberOrNull(asks[0].price) : null
    const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null
    const spreadPercent =
      spread !== null && bestBid !== null && bestBid > 0
        ? (spread / bestBid) * 100
        : null

    return {
      bids,
      asks,
      bidVolume,
      askVolume,
      totalVolume: bidVolume + askVolume,
      bestBid,
      bestAsk,
      spread,
      spreadPercent,
      bidDepth: bids.length,
      askDepth: asks.length
    }
  }

  async archiveSnapshots() {
    if (this.isArchiving) {
      console.log("[info] Polymarket archive run skipped because previous run is still active")
      return {
        success: true,
        skipped: true,
        reason: "run-in-progress"
      }
    }

    this.isArchiving = true
    const runStartedAt = new Date()
    const intervalStart = this.getIntervalStart(runStartedAt)

    let archivedMarkets = 0
    let archivedOrderBooks = 0
    const newlyArchivedClosed = []

    try {
      const rawMarkets = await this.fetchMarketsForArchive()

      if (rawMarkets.length === 0) {
        console.log("[info] No Polymarket markets returned for archival")
        return {
          success: true,
          skipped: true,
          reason: "no-open-markets",
          archivedMarkets: 0,
          archivedOrderBooks: 0,
          intervalStart: intervalStart.toISOString(),
          startedAt: runStartedAt.toISOString(),
          completedAt: new Date().toISOString()
        }
      }

      for (const rawMarket of rawMarkets) {
        const market = this.normalizeMarket(rawMarket)
        if (!market.id) {
          continue
        }

        // Detect first time we see this market closed (for past-event notification)
        let isFirstTimeClosed = false
        if (market.closed) {
          const existingClosed = await prisma.polymarketMarketSnapshot.findFirst({
            where: { marketId: market.id, closed: true },
            select: { id: true },
          }).catch(() => null)
          if (!existingClosed) {
            isFirstTimeClosed = true
          }
        }

        await this.upsertMarketSnapshot(market, intervalStart)

        archivedMarkets += 1

        if (isFirstTimeClosed) {
          newlyArchivedClosed.push({
            marketId: market.id,
            question: market.question,
            category: market.category,
            closedTime: market.closedTime,
            endDate: market.endDate,
          })
        }

        for (let i = 0; i < market.tokenIds.length; i += 1) {
          const tokenId = String(market.tokenIds[i] || "")
          const outcome = market.outcomes[i] || null

          if (!tokenId) {
            continue
          }

          try {
            const orderBook = await this.fetchOrderBook(tokenId)
            if (!orderBook) {
              continue
            }

            const metrics = this.buildOrderBookMetrics(orderBook)

            await prisma.polymarketOrderBookSnapshot.upsert({
              where: {
                tokenId_intervalStart: {
                  tokenId,
                  intervalStart
                }
              },
              update: {
                marketId: market.id,
                outcome,
                bidVolume: metrics.bidVolume,
                askVolume: metrics.askVolume,
                totalVolume: metrics.totalVolume,
                bestBid: metrics.bestBid,
                bestAsk: metrics.bestAsk,
                spread: metrics.spread,
                spreadPercent: metrics.spreadPercent,
                bidDepth: metrics.bidDepth,
                askDepth: metrics.askDepth,
                bids: metrics.bids,
                asks: metrics.asks
              },
              create: {
                marketId: market.id,
                tokenId,
                outcome,
                bidVolume: metrics.bidVolume,
                askVolume: metrics.askVolume,
                totalVolume: metrics.totalVolume,
                bestBid: metrics.bestBid,
                bestAsk: metrics.bestAsk,
                spread: metrics.spread,
                spreadPercent: metrics.spreadPercent,
                bidDepth: metrics.bidDepth,
                askDepth: metrics.askDepth,
                bids: metrics.bids,
                asks: metrics.asks,
                intervalStart
              }
            })

            archivedOrderBooks += 1
          } catch (orderBookError) {
            console.error(
              `[warn] Failed to archive order book for token ${tokenId} (${market.id}): ${orderBookError.message}`
            )
          }
        }
      }

      const elapsedMs = Date.now() - runStartedAt.getTime()
      console.log(
        `[ok] Polymarket archive run completed: ${archivedMarkets} market snapshots, ${archivedOrderBooks} order book snapshots (${elapsedMs}ms)`
      )

      const result = {
        success: true,
        skipped: false,
        archivedMarkets,
        archivedOrderBooks,
        newlyArchivedClosedCount: newlyArchivedClosed.length,
        elapsedMs,
        intervalStart: intervalStart.toISOString(),
        startedAt: runStartedAt.toISOString(),
        completedAt: new Date().toISOString()
      }

      // Fire-and-forget Discord notifications
      discord.notifyArchiveCompleted(result).catch(() => {})
      const maxPastEventNotifications = 10
      for (const past of newlyArchivedClosed.slice(0, maxPastEventNotifications)) {
        discord.notifyPastEventArchived(past).catch(() => {})
      }
      if (newlyArchivedClosed.length > maxPastEventNotifications) {
        console.log(`[info] ${newlyArchivedClosed.length - maxPastEventNotifications} additional past-event notifications suppressed (cap=${maxPastEventNotifications}).`)
      }

      return result
    } catch (error) {
      if (error && error.code === "P2021") {
        console.error(
          "[error] Polymarket archive tables do not exist yet. Run a Prisma migration, then re-enable the archiver."
        )
        this.stop()
      } else {
        console.error("[error] Polymarket archive run failed:", error.message)
      }

      return {
        success: false,
        skipped: false,
        error: error.message,
        code: error.code || null,
        intervalStart: intervalStart.toISOString(),
        startedAt: runStartedAt.toISOString(),
        completedAt: new Date().toISOString()
      }
    } finally {
      this.isArchiving = false
    }
  }
}

module.exports = new PolymarketDataArchiver()
