const prisma = require("../prisma")

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

  normalizeMarket(rawMarket) {
    const outcomes = this.normalizeArray(rawMarket.outcomes, ["Yes", "No"])
    const outcomePrices = this.normalizeArray(rawMarket.outcomePrices, outcomes.map(() => "0.5"))
    const tokenIds = this.normalizeArray(rawMarket.clobTokenIds, [])

    return {
      id: String(rawMarket.id || rawMarket.condition_id || ""),
      question: rawMarket.question || rawMarket.title || "Unknown market",
      outcomes,
      outcomePrices,
      tokenIds,
      volume: this.toNumberOrNull(rawMarket.volume || rawMarket.volume24hr),
      liquidity: this.toNumberOrNull(rawMarket.liquidity),
      endDate: this.toDateOrNull(rawMarket.endDate || rawMarket.end_date_iso || rawMarket.closesAt)
    }
  }

  async fetchOpenMarkets(limit) {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=0&closed=false`,
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

    try {
      const rawMarkets = await this.fetchOpenMarkets(this.marketLimit)

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

        await prisma.polymarketMarketSnapshot.upsert({
          where: {
            marketId_intervalStart: {
              marketId: market.id,
              intervalStart
            }
          },
          update: {
            question: market.question,
            outcomes: market.outcomes,
            outcomePrices: market.outcomePrices,
            tokenIds: market.tokenIds,
            volume: market.volume,
            liquidity: market.liquidity,
            endDate: market.endDate
          },
          create: {
            marketId: market.id,
            question: market.question,
            outcomes: market.outcomes,
            outcomePrices: market.outcomePrices,
            tokenIds: market.tokenIds,
            volume: market.volume,
            liquidity: market.liquidity,
            endDate: market.endDate,
            intervalStart
          }
        })

        archivedMarkets += 1

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

      return {
        success: true,
        skipped: false,
        archivedMarkets,
        archivedOrderBooks,
        elapsedMs,
        intervalStart: intervalStart.toISOString(),
        startedAt: runStartedAt.toISOString(),
        completedAt: new Date().toISOString()
      }
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
