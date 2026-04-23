const fs = require("fs")
const path = require("path")
const prisma = require("./src/prisma")

const STRICT_SPORTS_PATTERN = /\b(nba|nfl|nhl|mlb|soccer|football|basketball|tennis|hockey|baseball|world cup|premier league|championship|olympics|fifa)\b/i

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function formatPct(numerator, denominator) {
  if (!denominator) return 0
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function toIso(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function ensureReportsDir() {
  const reportsDir = path.join(__dirname, "reports")
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }
  return reportsDir
}

function isSportsMarket(market) {
  const question = String(market?.question || "")
  const category = String(market?.category || "").toLowerCase()
  const events = Array.isArray(market?.events) ? market.events : []

  if (category.includes("sport")) {
    return true
  }

  for (const event of events) {
    const eventCategory = String(event?.category || "").toLowerCase()
    if (eventCategory.includes("sport")) {
      return true
    }
  }

  return STRICT_SPORTS_PATTERN.test(question)
}

async function fetchClosedSportsMarkets(sampleSize) {
  const results = []
  let offset = 0
  const pageSize = 200
  const maxPages = 10

  for (let page = 0; page < maxPages && results.length < sampleSize; page += 1) {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=${pageSize}&offset=${offset}&closed=true`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json"
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch closed markets: ${response.status}`)
    }

    const payload = await response.json()
    if (!Array.isArray(payload) || payload.length === 0) {
      break
    }

    for (const market of payload) {
      if (isSportsMarket(market)) {
        results.push(market)
        if (results.length >= sampleSize) {
          break
        }
      }
    }

    offset += pageSize
  }

  return results
}

function renderMarkdownReport(summary, rows, generatedAt) {
  const usesArchive = summary.dataSource === "archive"
  const lines = []
  lines.push("# Sports Active Period Data Audit")
  lines.push("")
  lines.push(`Generated at: ${generatedAt}`)
  lines.push("")
  lines.push("## Scope")
  lines.push("")
  lines.push(`- Data source used: ${summary.dataSource}`)
  lines.push(`- Requested sample size: ${summary.requestedSampleSize}`)
  lines.push(`- Sampled sports markets (ended): ${summary.sampledMarkets}`)
  lines.push(`- Ended sports candidates found: ${summary.totalEndedSportsMarkets}`)
  lines.push("")
  lines.push("## Field Definition (Phase 1)")
  lines.push("")
  lines.push("- market_id: Polymarket market identifier")
  lines.push("- market_question: latest stored question")
  lines.push(
    usesArchive
      ? "- market_open_at_proxy: earliest archived snapshot time (proxy, not true listing time)"
      : "- market_open_at_proxy: source market createdAt (proxy for listing time)"
  )
  lines.push(
    usesArchive
      ? "- game_start_at: not stored in current archive schema"
      : "- game_start_at: sourced from events[0].startDate when available"
  )
  lines.push(
    usesArchive
      ? "- game_end_at: not stored in current archive schema"
      : "- game_end_at: sourced from events[0].endDate when available"
  )
  lines.push("- market_close_at: latest known market endDate")
  lines.push(
    usesArchive
      ? "- market_resolved_at: not stored in current archive schema"
      : "- market_resolved_at: sourced from closedTime"
  )
  lines.push(
    usesArchive
      ? "- activity_series_available: has 2+ archived snapshots for this market"
      : "- activity_series_available: false in API fallback mode because no local snapshot series is loaded"
  )
  lines.push("")
  lines.push("## Completeness")
  lines.push("")
  lines.push("| Field | Present | Missing | Completeness |")
  lines.push("| --- | ---: | ---: | ---: |")

  for (const metric of summary.completeness) {
    lines.push(
      `| ${metric.field} | ${metric.present} | ${metric.missing} | ${metric.completenessPct}% |`
    )
  }

  lines.push("")
  lines.push("## Sample Rows (first 15)")
  lines.push("")
  lines.push("| market_id | question | market_open_at_proxy | market_close_at | snapshots |")
  lines.push("| --- | --- | --- | --- | ---: |")

  for (const row of rows.slice(0, 15)) {
    lines.push(
      `| ${row.marketId} | ${(row.question || "").replace(/\|/g, " ")} | ${row.marketOpenAtProxy || ""} | ${row.marketCloseAt || ""} | ${row.snapshotCount} |`
    )
  }

  lines.push("")
  lines.push("## Notes")
  lines.push("")
  lines.push("- game_start_at/game_end_at are required for true sports active period analytics.")
  if (usesArchive) {
    lines.push("- Current archive supports activity curve analysis around market_close_at, but not exact in-game windows.")
    lines.push("- Recommended next data enhancement: persist eventStartAt/eventEndAt from Polymarket source payload.")
  } else {
    lines.push("- API fallback confirms timing fields exist for most historical sports markets.")
    lines.push("- To visualize activity windows, archive closed markets and retain event timestamps in DB.")
  }

  return lines.join("\n")
}

async function main() {
  const sampleSize = parsePositiveInt(process.env.SPORTS_SAMPLE_SIZE || process.argv[2], 200)
  const now = new Date()

  const latestEnded = await prisma.polymarketMarketSnapshot.findMany({
    where: {
      endDate: {
        not: null,
        lte: now
      }
    },
    distinct: ["marketId"],
    orderBy: [{ marketId: "asc" }, { intervalStart: "desc" }],
    select: {
      marketId: true,
      question: true,
      endDate: true,
      intervalStart: true
    }
  })

  const endedSportsMarkets = latestEnded.filter((market) => {
    return isSportsMarket(market)
  })

  const selectedMarkets = endedSportsMarkets.slice(0, sampleSize)
  const selectedIds = selectedMarkets.map((market) => market.marketId)

  let rows = []
  let totalEndedSportsMarkets = endedSportsMarkets.length
  let dataSource = "archive"

  if (selectedIds.length > 0) {
    const snapshots = await prisma.polymarketMarketSnapshot.findMany({
    where: {
      marketId: {
        in: selectedIds
      }
    },
    select: {
      marketId: true,
      question: true,
      endDate: true,
      intervalStart: true,
      createdAt: true
    },
    orderBy: [{ marketId: "asc" }, { intervalStart: "asc" }]
  })

    const byMarket = new Map()
    for (const row of snapshots) {
      if (!byMarket.has(row.marketId)) {
        byMarket.set(row.marketId, {
          marketId: row.marketId,
          question: row.question || null,
          marketOpenAtProxy: row.intervalStart,
          marketCloseAt: row.endDate || null,
          lastSeenAt: row.intervalStart,
          snapshotCount: 0,
          createdAtMin: row.createdAt || null
        })
      }

      const current = byMarket.get(row.marketId)
      current.snapshotCount += 1

      if (row.intervalStart < current.marketOpenAtProxy) {
        current.marketOpenAtProxy = row.intervalStart
      }

      if (row.intervalStart > current.lastSeenAt) {
        current.lastSeenAt = row.intervalStart
        current.question = row.question || current.question
      }

      if (row.endDate) {
        current.marketCloseAt = row.endDate
      }

      if (current.createdAtMin && row.createdAt && row.createdAt < current.createdAtMin) {
        current.createdAtMin = row.createdAt
      }
    }

    rows = Array.from(byMarket.values()).map((row) => ({
      marketId: row.marketId,
      question: row.question,
      marketOpenAtProxy: toIso(row.marketOpenAtProxy),
      gameStartAt: null,
      gameEndAt: null,
      marketCloseAt: toIso(row.marketCloseAt),
      marketResolvedAt: null,
      activitySeriesAvailable: row.snapshotCount >= 2,
      snapshotCount: row.snapshotCount,
      firstSnapshotCreatedAt: toIso(row.createdAtMin),
      lastSeenAt: toIso(row.lastSeenAt)
    }))
  } else {
    dataSource = "gamma-closed-markets-api"
    const apiMarkets = await fetchClosedSportsMarkets(sampleSize)
    totalEndedSportsMarkets = apiMarkets.length

    rows = apiMarkets.map((market) => {
      const event = Array.isArray(market.events) && market.events.length > 0 ? market.events[0] : null
      return {
        marketId: String(market.id || ""),
        question: market.question || null,
        marketOpenAtProxy: toIso(market.createdAt || event?.createdAt || event?.creationDate),
        gameStartAt: toIso(event?.startDate),
        gameEndAt: toIso(event?.endDate),
        marketCloseAt: toIso(market.endDate || event?.endDate),
        marketResolvedAt: toIso(market.closedTime || event?.closedTime),
        activitySeriesAvailable: false,
        snapshotCount: 0,
        firstSnapshotCreatedAt: null,
        lastSeenAt: null
      }
    })
  }

  const total = rows.length

  if (total === 0) {
    console.log("No ended sports markets found from either archive or external API.")
    return
  }

  const completeness = [
    {
      field: "market_id",
      present: rows.filter((r) => Boolean(r.marketId)).length
    },
    {
      field: "market_question",
      present: rows.filter((r) => Boolean(r.question)).length
    },
    {
      field: "market_open_at_proxy",
      present: rows.filter((r) => Boolean(r.marketOpenAtProxy)).length
    },
    {
      field: "game_start_at",
      present: rows.filter((r) => Boolean(r.gameStartAt)).length
    },
    {
      field: "game_end_at",
      present: rows.filter((r) => Boolean(r.gameEndAt)).length
    },
    {
      field: "market_close_at",
      present: rows.filter((r) => Boolean(r.marketCloseAt)).length
    },
    {
      field: "market_resolved_at",
      present: rows.filter((r) => Boolean(r.marketResolvedAt)).length
    },
    {
      field: "activity_series_available",
      present: rows.filter((r) => r.activitySeriesAvailable).length
    }
  ].map((entry) => {
    const missing = total - entry.present
    return {
      ...entry,
      missing,
      completenessPct: formatPct(entry.present, total)
    }
  })

  const summary = {
    dataSource,
    requestedSampleSize: sampleSize,
    sampledMarkets: total,
    totalEndedSportsMarkets,
    completeness
  }

  const generatedAt = new Date().toISOString()
  const reportsDir = ensureReportsDir()
  const jsonPath = path.join(reportsDir, "sports-active-period-audit.json")
  const markdownPath = path.join(reportsDir, "sports-active-period-audit.md")

  const payload = {
    generatedAt,
    summary,
    rows
  }

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8")
  fs.writeFileSync(markdownPath, renderMarkdownReport(summary, rows, generatedAt), "utf8")

  console.log("Sports active period data audit completed.")
  console.log(`Sampled markets: ${summary.sampledMarkets}`)
  console.log(`Ended sports candidates: ${summary.totalEndedSportsMarkets}`)
  console.log(`JSON report: ${jsonPath}`)
  console.log(`Markdown report: ${markdownPath}`)

  for (const metric of summary.completeness) {
    console.log(
      `${metric.field.padEnd(24)} present=${String(metric.present).padStart(4)} missing=${String(metric.missing).padStart(4)} completeness=${metric.completenessPct}%`
    )
  }
}

main()
  .catch((error) => {
    console.error("Audit failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
