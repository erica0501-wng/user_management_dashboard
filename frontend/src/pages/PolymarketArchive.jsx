import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import {
  getArchiveGaps,
  getArchiveQualityReports,
  getArchiveStatus,
  getSportsActivePeriodActivity,
  getSportsActivePeriods,
  getReplaySlice,
  getReplayWindows,
  runArchiveQualityReport,
} from "../services/polymarketArchive"

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`

const formatDateTime = (value) => {
  if (!value) return "N/A"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

const buildCoverageTone = (value) => {
  if (value >= 90) return "bg-emerald-500"
  if (value >= 60) return "bg-amber-500"
  return "bg-rose-500"
}

const formatCompactNumber = (value) => {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value || 0))
}

const formatMaybeNumber = (value) => {
  if (value === null || value === undefined) return "0"
  return Number(value).toLocaleString("en-US")
}

const HEATMAP_VOLUME_LABEL = "Order book depth (shares on book)"
const DEFAULT_ACTIVE_GAME_HOURS = 3
const ARCHIVE_MARKET_LIMIT = 20
const LIVE_MARKET_COVERAGE_LIMIT = 20

const HEATMAP_INTENSITY_STEPS = [
  "bg-slate-100",
  "bg-sky-200",
  "bg-cyan-400",
  "bg-blue-500",
  "bg-indigo-700"
]

const HEATMAP_BANDS = [
  { minRatio: 0, pctLabel: "0-20%", toneClass: HEATMAP_INTENSITY_STEPS[0] },
  { minRatio: 0.2, pctLabel: "20-40%", toneClass: HEATMAP_INTENSITY_STEPS[1] },
  { minRatio: 0.4, pctLabel: "40-60%", toneClass: HEATMAP_INTENSITY_STEPS[2] },
  { minRatio: 0.6, pctLabel: "60-80%", toneClass: HEATMAP_INTENSITY_STEPS[3] },
  { minRatio: 0.8, pctLabel: "80-100%", toneClass: HEATMAP_INTENSITY_STEPS[4] }
]

const getHeatBand = (value, max) => {
  if (!max || max <= 0 || value <= 0) {
    return HEATMAP_BANDS[0]
  }

  const ratio = value / max
  for (let index = HEATMAP_BANDS.length - 1; index >= 0; index -= 1) {
    if (ratio >= HEATMAP_BANDS[index].minRatio) {
      return HEATMAP_BANDS[index]
    }
  }

  return HEATMAP_BANDS[0]
}

const buildHeatTone = (value, max) => {
  return getHeatBand(value, max).toneClass
}

const buildHeatLegendBands = (maxVolume) => {
  const maxRatios = [0.2, 0.4, 0.6, 0.8, 1]

  return HEATMAP_BANDS.map((band, index) => ({
    toneClass: band.toneClass,
    pctLabel: band.pctLabel,
    minValue: maxVolume > 0 ? maxVolume * band.minRatio : 0,
    maxValue: maxVolume > 0 ? maxVolume * maxRatios[index] : 0
  }))
}

const inferActiveGameHours = (keywordInput) => {
  const keyword = String(keywordInput || "").trim().toLowerCase()

  if (!keyword) {
    return DEFAULT_ACTIVE_GAME_HOURS
  }

  if (/ufc|mma|boxing/.test(keyword)) {
    return 1
  }

  if (/soccer|football|fifa|premier league|champions league|euro|copa/.test(keyword)) {
    return 2
  }

  if (/nba|nfl|nhl|mlb|baseball|hockey|basketball/.test(keyword)) {
    return 3
  }

  if (/tennis/.test(keyword)) {
    return 2
  }

  return DEFAULT_ACTIVE_GAME_HOURS
}

const detectLiveCategory = (question, description) => {
  const text = `${question || ""} ${description || ""}`.toLowerCase()

  if (text.match(/movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress/)) return "entertainment"
  if (text.match(/bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/)) return "crypto"
  if (text.match(/election|president|presidential|政治|vote|voting|congress|senate|政府|political|government|campaign/)) return "politics"
  if (text.match(/sport|football|basketball|soccer|nba|nfl|championship|tennis|premier league|lakers|olympics|world cup|fifa|baseball|hockey/)) return "sports"
  if (text.match(/\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/)) return "technology"
  if (text.match(/stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/)) return "finance"

  return "other"
}

const classifyKickoffPeriod = (startHour, activeGameHours) => {
  if (startHour >= activeGameHours) {
    return {
      label: "Post-game",
      rowClassName: "bg-rose-50/70",
      dotClassName: "bg-pink-500"
    }
  }

  if (startHour >= 0) {
    return {
      label: "Active game",
      rowClassName: "bg-violet-100/70",
      dotClassName: "bg-violet-600"
    }
  }

  if (startHour >= -24) {
    return {
      label: "Within 1 day to kickoff",
      rowClassName: "bg-sky-100/70",
      dotClassName: "bg-sky-500"
    }
  }

  return {
    label: "Earlier than 1 day to kickoff",
    rowClassName: "bg-emerald-50/70",
    dotClassName: "bg-emerald-500"
  }
}

const SCOPE_CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "crypto", label: "Crypto" },
  { value: "politics", label: "Politics" },
  { value: "sports", label: "Sports" },
  { value: "technology", label: "Technology" },
  { value: "finance", label: "Finance" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" }
]

const HISTORY_WINDOW_OPTIONS = [
  { value: "30", label: "Recent 30d" },
  { value: "90", label: "Recent 90d" },
  { value: "all", label: "All history" }
]

const durationHours = (start, end) => {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
  const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
  return Number.isFinite(diff) && diff >= 0 ? diff : null
}

const buildSegmentStyle = (market) => {
  const openTime = new Date(market.marketOpenAtProxy || market.activeStartAt || market.marketCloseAt)
  const closeTime = new Date(market.marketCloseAt || market.marketResolvedAt || market.activeEndAt)
  const activeStart = market.activeStartAt ? new Date(market.activeStartAt) : null
  const activeEnd = market.activeEndAt ? new Date(market.activeEndAt) : null

  if (Number.isNaN(openTime.getTime()) || Number.isNaN(closeTime.getTime()) || closeTime <= openTime) {
    return {
      pre: { left: "0%", width: "0%" },
      active: { left: "0%", width: "0%" },
      post: { left: "0%", width: "100%" }
    }
  }

  const total = closeTime.getTime() - openTime.getTime()
  const safeActiveStart = activeStart && !Number.isNaN(activeStart.getTime()) ? activeStart : openTime
  const safeActiveEnd = activeEnd && !Number.isNaN(activeEnd.getTime()) ? activeEnd : closeTime

  const clampedStart = Math.max(openTime.getTime(), Math.min(safeActiveStart.getTime(), closeTime.getTime()))
  const clampedEnd = Math.max(clampedStart, Math.min(safeActiveEnd.getTime(), closeTime.getTime()))

  const prePct = ((clampedStart - openTime.getTime()) / total) * 100
  const activePct = ((clampedEnd - clampedStart) / total) * 100
  const postPct = Math.max(0, 100 - prePct - activePct)

  return {
    pre: { left: "0%", width: `${Math.max(0, prePct)}%` },
    active: { left: `${Math.max(0, prePct)}%`, width: `${Math.max(0, activePct)}%` },
    post: { left: `${Math.max(0, prePct + activePct)}%`, width: `${Math.max(0, postPct)}%` }
  }
}

const MIN_PHASE_VISUAL_PCT = 10

const buildVisualSegmentStyle = (segments) => {
  const pre = Number.parseFloat(segments?.pre?.width) || 0
  const active = Number.parseFloat(segments?.active?.width) || 0
  const post = Number.parseFloat(segments?.post?.width) || 0

  let nextPre = pre
  let nextActive = active
  let nextPost = post
  let visualAdjusted = false

  // If one phase visually swallows the full bar, reserve a small readable area
  // for the other phases while keeping exact timestamps below unchanged.
  if (active >= 99 && pre <= 0.1 && post <= 0.1) {
    nextPre = 15
    nextPost = 15
    nextActive = 70
    visualAdjusted = true
  } else {
    const needsPre = pre > 0 && pre < MIN_PHASE_VISUAL_PCT
    const needsPost = post > 0 && post < MIN_PHASE_VISUAL_PCT
    const needsActive = active > 0 && active < MIN_PHASE_VISUAL_PCT

    if (needsPre || needsPost || needsActive) {
      if (needsPre) {
        const add = MIN_PHASE_VISUAL_PCT - nextPre
        nextPre += add
        nextActive = Math.max(0, nextActive - add)
        visualAdjusted = true
      }

      if (needsPost) {
        const add = MIN_PHASE_VISUAL_PCT - nextPost
        nextPost += add
        nextActive = Math.max(0, nextActive - add)
        visualAdjusted = true
      }

      if (needsActive) {
        const add = MIN_PHASE_VISUAL_PCT - nextActive
        nextActive += add
        const preShare = nextPre + nextPost > 0 ? nextPre / (nextPre + nextPost) : 0.5
        nextPre = Math.max(0, nextPre - add * preShare)
        nextPost = Math.max(0, nextPost - add * (1 - preShare))
        visualAdjusted = true
      }
    }
  }

  const total = nextPre + nextActive + nextPost
  if (total <= 0) {
    return {
      pre: { left: "0%", width: "0%" },
      active: { left: "0%", width: "0%" },
      post: { left: "0%", width: "100%" },
      visualAdjusted
    }
  }

  const normalizedPre = (nextPre / total) * 100
  const normalizedActive = (nextActive / total) * 100
  const normalizedPost = Math.max(0, 100 - normalizedPre - normalizedActive)

  return {
    pre: { left: "0%", width: `${normalizedPre}%` },
    active: { left: `${normalizedPre}%`, width: `${normalizedActive}%` },
    post: { left: `${normalizedPre + normalizedActive}%`, width: `${normalizedPost}%` },
    visualAdjusted
  }
}

const buildEstimatedOverlayBins = (market, binCount = 40) => {
  const segments = buildSegmentStyle(market)
  const activeStartPct = Number.parseFloat(segments.pre.width) || 0
  const activeEndPct = Number.parseFloat(segments.post.left) || 100
  const activeWidthPct = Math.max(1, activeEndPct - activeStartPct)

  const safeBinCount = Math.max(20, Math.min(80, binCount))
  const marketKey = String(market.marketId || "")
  let hash = 0
  for (let i = 0; i < marketKey.length; i += 1) {
    hash = (hash * 31 + marketKey.charCodeAt(i)) % 997
  }

  const bins = Array.from({ length: safeBinCount }, (_, index) => {
    const centerPct = ((index + 0.5) / safeBinCount) * 100
    const inActive = centerPct >= activeStartPct && centerPct <= activeEndPct
    const distanceToActiveCenter =
      Math.abs(centerPct - (activeStartPct + activeWidthPct / 2)) / Math.max(activeWidthPct / 2, 1)

    // Estimated intensity profile: active window strongest, pre ramps, post decays.
    let base = 0
    if (inActive) {
      base = Math.max(0.5, 1.2 - distanceToActiveCenter * 0.6)
    } else if (centerPct < activeStartPct) {
      const preRatio = activeStartPct > 0 ? centerPct / activeStartPct : 0
      base = 0.2 + preRatio * 0.5
    } else {
      const postRatio = (centerPct - activeEndPct) / Math.max(100 - activeEndPct, 1)
      base = Math.max(0.15, 0.55 * (1 - postRatio))
    }

    const wave = (((index + hash) % 7) / 10) * 0.18
    const trades = Math.max(0, Math.round((base + wave) * 12))
    const uniqueTraders = Math.max(0, Math.round(trades * 0.45))

    return {
      index,
      trades,
      uniqueTraders,
      estimated: true
    }
  })

  return {
    bins,
    estimated: true,
    maxTradesInBin: bins.reduce((max, bin) => Math.max(max, bin.trades), 0),
    maxUniqueTradersInBin: bins.reduce((max, bin) => Math.max(max, bin.uniqueTraders), 0)
  }
}

const TRADE_INTENSITY_TONES = [
  "bg-sky-100",
  "bg-sky-200",
  "bg-blue-300",
  "bg-blue-500",
  "bg-blue-700"
]

const UNIQUE_TRADER_INTENSITY_TONES = [
  "bg-cyan-50",
  "bg-cyan-100",
  "bg-sky-200",
  "bg-sky-400",
  "bg-sky-600"
]

const getIntensityTone = (value, max, tones) => {
  if (!max || max <= 0 || value <= 0) {
    return tones[0]
  }

  const ratio = value / max
  if (ratio >= 0.8) return tones[4]
  if (ratio >= 0.6) return tones[3]
  if (ratio >= 0.4) return tones[2]
  if (ratio >= 0.2) return tones[1]
  return tones[0]
}

const getActiveDurationTone = (activeHours) => {
  if (activeHours === null || activeHours === undefined) {
    return {
      segmentClassName: "bg-slate-400",
      badgeClassName: "bg-slate-100 text-slate-700",
      label: "Unknown active duration"
    }
  }

  if (activeHours <= 2) {
    return {
      segmentClassName: "bg-emerald-500",
      badgeClassName: "bg-emerald-100 text-emerald-800",
      label: "Very short active window"
    }
  }

  if (activeHours <= 6) {
    return {
      segmentClassName: "bg-sky-500",
      badgeClassName: "bg-sky-100 text-sky-800",
      label: "Short active window"
    }
  }

  if (activeHours <= 24) {
    return {
      segmentClassName: "bg-amber-500",
      badgeClassName: "bg-amber-100 text-amber-800",
      label: "Extended active window"
    }
  }

  return {
    segmentClassName: "bg-rose-500",
    badgeClassName: "bg-rose-100 text-rose-800",
    label: "Long active window"
  }
}

const RECURRENCE_LABEL_BY_BUCKET = {
  daily: "Daily recurring",
  weekly: "Weekly recurring",
  monthly: "Monthly recurring",
  seasonal: "Seasonal",
  annual: "Annual",
  "multi-year": "Multi-year",
  "rare-major-event": "Rare major event",
  unknown: "Unknown cadence"
}

const formatRecurrenceLabel = (bucket) => {
  if (!bucket) {
    return RECURRENCE_LABEL_BY_BUCKET.unknown
  }

  return RECURRENCE_LABEL_BY_BUCKET[bucket] || RECURRENCE_LABEL_BY_BUCKET.unknown
}

const RECURRENCE_TONE_BY_BUCKET = {
  daily: "bg-emerald-100 text-emerald-800",
  weekly: "bg-cyan-100 text-cyan-800",
  monthly: "bg-blue-100 text-blue-800",
  seasonal: "bg-amber-100 text-amber-800",
  annual: "bg-orange-100 text-orange-800",
  "multi-year": "bg-rose-100 text-rose-800",
  "rare-major-event": "bg-fuchsia-100 text-fuchsia-800",
  unknown: "bg-slate-100 text-slate-700"
}

const getRecurrenceTone = (bucket) => {
  return RECURRENCE_TONE_BY_BUCKET[bucket] || RECURRENCE_TONE_BY_BUCKET.unknown
}

const metricCards = (status) => [
  {
    label: "Market coverage",
    value: formatPercent(status?.summary?.marketCoveragePct),
    helper: `${status?.summary?.marketSnapshotCount || 0} snapshots`,
  },
  {
    label: "Order book coverage",
    value: formatPercent(status?.summary?.orderBookCoveragePct),
    helper: `${status?.summary?.orderBookSnapshotCount || 0} snapshots`,
  },
  {
    label: "Tracked markets",
    value: status?.summary?.distinctMarkets || 0,
    helper: `${status?.summary?.distinctTokens || 0} tokens`,
  },
  {
    label: "Archive freshness",
    value:
      status?.summary?.staleMinutes === null || status?.summary?.staleMinutes === undefined
        ? "N/A"
        : `${status.summary.staleMinutes}m`,
    helper: status?.summary?.latestSnapshotAt
      ? `Latest ${formatDateTime(status.summary.latestSnapshotAt)}`
      : "No snapshots yet",
  },
]

export default function PolymarketArchive() {
  const [windowHours, setWindowHours] = useState(24)
  const [minCoveragePct, setMinCoveragePct] = useState(90)
  const [timelineViewMode, setTimelineViewMode] = useState("readable")
  const [gapType, setGapType] = useState("market")
  const [archiveApiAvailable, setArchiveApiAvailable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sportsLoading, setSportsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState(null)
  const [gaps, setGaps] = useState([])
  const [replayWindows, setReplayWindows] = useState([])
  const [replaySlice, setReplaySlice] = useState(null)
  const [qualityReports, setQualityReports] = useState([])
  const [sportsActivePeriods, setSportsActivePeriods] = useState([])
  const [sportsActiveSource, setSportsActiveSource] = useState("auto")
  const [sportsActivityHeatmap, setSportsActivityHeatmap] = useState(null)
  const [sportsActivitySource, setSportsActivitySource] = useState("auto")
  const [sportsActivityNote, setSportsActivityNote] = useState("")
  const [sportsInGameQuarterHeatmap, setSportsInGameQuarterHeatmap] = useState(null)
  const [sportsInGameQuarterSource, setSportsInGameQuarterSource] = useState("auto")
  const [sportsInGameQuarterNote, setSportsInGameQuarterNote] = useState("")
  const [sportsKeywordFilter, setSportsKeywordFilter] = useState("")
  const [debouncedSportsKeywordFilter, setDebouncedSportsKeywordFilter] = useState("")
  const [marketScope, setMarketScope] = useState("sports")
  const [marketHistoryWindow, setMarketHistoryWindow] = useState("90")
  const [scopeCoverageRows, setScopeCoverageRows] = useState([])
  const [scopeCoverageLoading, setScopeCoverageLoading] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSportsKeywordFilter(sportsKeywordFilter.trim())
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [sportsKeywordFilter])

  const downloadSportsHeatmapCsv = () => {
    const bins = sportsActivityHeatmap?.bins || []
    if (bins.length === 0) {
      return
    }

    const header = [
      "startHour",
      "endHour",
      "label",
      "orderBookDepthShares",
      "uniqueTraders",
      "snapshotCount",
      "marketCoveragePct"
    ]
    const rows = bins.map((bin) => [
      bin.startHour,
      bin.endHour,
      `"${String(bin.label || "").replace(/"/g, '""')}"`,
      bin.totalVolume,
      bin.uniqueTraders ?? "",
      bin.snapshotCount,
      bin.marketCoveragePct
    ])

    const csvText = [header.join(","), ...rows.map((row) => row.join(","))].join("\n")
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const scopeSuffix = marketScope === "all" ? "-all-markets" : `-${marketScope}`
    const keywordSuffix = sportsKeywordFilter ? `-${sportsKeywordFilter}` : ""
    link.setAttribute("href", url)
    link.setAttribute("download", `active-period-heatmap${scopeSuffix}${keywordSuffix}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const loadCoreArchiveHealth = useCallback(async ({ force = false } = {}) => {
    try {
      setLoading(true)
      setError("")

      if (archiveApiAvailable === false && !force) {
        return
      }

      const statusResult = await getArchiveStatus({ windowHours })
      setStatus(statusResult)
      setArchiveApiAvailable(true)

      const requests = [
        {
          key: "gaps",
          promise: getArchiveGaps({
            type: gapType,
            windowHours,
            limit: 8,
            maxMissingPerKey: 6,
            useObservedSpan: true,
          }),
        },
        {
          key: "windows",
          promise: getReplayWindows({ windowHours, minCoveragePct }),
        },
        {
          key: "slice",
          promise: getReplaySlice({ windowHours, minCoveragePct, maxIntervals: 300 }),
        },
        {
          key: "quality",
          promise: getArchiveQualityReports({ limit: 10, windowHours }),
        },
      ]

      const settled = await Promise.allSettled(requests.map((request) => request.promise))
      const failures = []

      settled.forEach((result, index) => {
        const requestKey = requests[index].key

        if (result.status === "fulfilled") {
          if (requestKey === "gaps") {
            setGaps(result.value.gaps || [])
          } else if (requestKey === "windows") {
            setReplayWindows(result.value.replayWindows || [])
          } else if (requestKey === "slice") {
            setReplaySlice(result.value)
          } else if (requestKey === "quality") {
            setQualityReports(result.value.reports || [])
          }
          return
        }

        const reason = result.reason
        if (requestKey === "slice" && reason?.status === 404) {
          setReplaySlice(null)
          return
        }

        failures.push(reason?.message || `${requestKey} load failed`)
      })

      if (failures.length > 0) {
        setError(failures.join(" | "))
      }
    } catch (loadError) {
      if (loadError?.status === 404) {
        setArchiveApiAvailable(false)
        setStatus(null)
        setGaps([])
        setReplayWindows([])
        setReplaySlice(null)
        setQualityReports([])
        setError(
          "Archive API is not available on the current backend deployment. Redeploy backend to include /polymarket/archive/* routes."
        )
      } else {
        setError(loadError.message || "Failed to load archive health")
      }
    } finally {
      setLoading(false)
    }
  }, [archiveApiAvailable, gapType, minCoveragePct, windowHours])

  const loadSportsArchiveHealth = useCallback(async () => {
    const requestMarketScope = marketScope === "sports" ? "sports" : "all"
    const requestCategory = marketScope === "all" ? undefined : marketScope
    const requestKeyword = marketScope === "sports" ? debouncedSportsKeywordFilter || undefined : undefined
    const requestHistoryWindowDays = marketHistoryWindow
    const requestedActiveGameHours =
      marketScope === "sports" ? inferActiveGameHours(debouncedSportsKeywordFilter) : DEFAULT_ACTIVE_GAME_HOURS

    const fetchSportsPayload = async ({ scope, category, keyword, historyWindowDays, activeGameHours }) => {
      const [activePeriods, activity, quarter] = await Promise.all([
        getSportsActivePeriods({
          limit: ARCHIVE_MARKET_LIMIT,
          source: "auto",
          marketScope: scope,
          category,
          keyword,
          historyWindowDays
        }),
        getSportsActivePeriodActivity({
          source: "auto",
          marketLimit: ARCHIVE_MARKET_LIMIT,
          preHours: 168,
          postHours: 6,
          binMinutes: 60,
          marketScope: scope,
          category,
          keyword,
          historyWindowDays
        }),
        getSportsActivePeriodActivity({
          source: "auto",
          marketLimit: ARCHIVE_MARKET_LIMIT,
          preHours: 0,
          postHours: activeGameHours,
          binMinutes: 15,
          marketScope: scope,
          category,
          keyword,
          historyWindowDays
        })
      ])

      return { activePeriods, activity, quarter }
    }

    try {
      setSportsLoading(true)
      let activityNote = ""

      let { activePeriods, activity, quarter } = await fetchSportsPayload({
        scope: requestMarketScope,
        category: requestCategory,
        keyword: requestKeyword,
        historyWindowDays: requestHistoryWindowDays,
        activeGameHours: requestedActiveGameHours
      })

      const activityBins = activity?.bins || []
      const hasActivitySignal =
        activity?.marketsCount > 0 &&
        activityBins.some((bin) => {
          const totalVolume = Number(bin?.totalVolume || 0)
          const snapshotCount = Number(bin?.snapshotCount || 0)
          const uniqueTraders = Number(bin?.uniqueTraders || 0)
          return totalVolume > 0 || snapshotCount > 0 || uniqueTraders > 0
        })

      if (
        marketScope !== "all" &&
        ((activePeriods?.rows || []).length === 0 || !hasActivitySignal)
      ) {
        activityNote =
          "No rows matched this category in the current window."
      }

      setSportsActivePeriods(activePeriods.rows || [])
      setSportsActiveSource(activePeriods.source || "auto")
      setSportsActivityHeatmap(activity)
      setSportsActivitySource(activity.source || "auto")
      setSportsActivityNote(activityNote || activity.note || "")
      setSportsInGameQuarterHeatmap(quarter)
      setSportsInGameQuarterSource(quarter.source || "auto")
      setSportsInGameQuarterNote(quarter.note || "")
    } catch (loadError) {
      setSportsActivePeriods([])
      setSportsActiveSource("unavailable")
      setSportsActivityHeatmap(null)
      setSportsActivitySource("unavailable")
      setSportsActivityNote("")
      setSportsInGameQuarterHeatmap(null)
      setSportsInGameQuarterSource("unavailable")
      setSportsInGameQuarterNote("")
      setError((prev) => {
        const current = prev ? `${prev} | ` : ""
        return `${current}${loadError.message || "Sports data load failed"}`
      })
    } finally {
      setSportsLoading(false)
    }
  }, [debouncedSportsKeywordFilter, marketHistoryWindow, marketScope])

  const loadScopeCoverage = useCallback(async () => {
    try {
      setScopeCoverageLoading(true)

      const token = localStorage.getItem("token")
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/polymarket/markets?limit=${LIVE_MARKET_COVERAGE_LIMIT}&offset=0`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      )

      if (!response.ok) {
        throw new Error("Failed to load live market coverage")
      }

      const payload = await response.json()
      const markets = Array.isArray(payload?.markets) ? payload.markets : []
      const sourceLabel = payload?.source || "polymarket-api"

      const coverageResults = SCOPE_CATEGORY_OPTIONS.map((option) => {
        const scopeValue = option.value

        if (scopeValue === "all") {
          return {
            value: scopeValue,
            label: option.label,
            count: markets.length,
            source: sourceLabel,
            failed: false
          }
        }

        const count = markets.filter((market) => {
          const detected = detectLiveCategory(market?.question, market?.description)
          return detected === scopeValue
        }).length

        return {
          value: scopeValue,
          label: option.label,
          count,
          source: sourceLabel,
          failed: false
        }
      })

      setScopeCoverageRows(coverageResults)
    } catch {
      setScopeCoverageRows(
        SCOPE_CATEGORY_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          count: 0,
          source: "unavailable",
          failed: true
        }))
      )
    } finally {
      setScopeCoverageLoading(false)
    }
  }, [])

  const loadArchiveHealth = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadCoreArchiveHealth(), loadSportsArchiveHealth()])
    } finally {
      setRefreshing(false)
    }
  }, [loadCoreArchiveHealth, loadSportsArchiveHealth])

  const handleRefreshCore = async () => {
    setRefreshing(true)
    try {
      await loadCoreArchiveHealth({ force: true })
    } finally {
      setRefreshing(false)
    }
  }

  const handleRefreshSports = async () => {
    setRefreshing(true)
    try {
      await loadSportsArchiveHealth()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadCoreArchiveHealth()
  }, [loadCoreArchiveHealth])

  useEffect(() => {
    loadSportsArchiveHealth()
  }, [loadSportsArchiveHealth])

  useEffect(() => {
    loadScopeCoverage()
  }, [loadScopeCoverage])

  const handleGenerateQualityReport = async () => {
    try {
      if (archiveApiAvailable === false) {
        setError(
          "Archive API is not available on the current backend deployment. Redeploy backend first."
        )
        return
      }

      setIsGeneratingReport(true)
      setError("")
      await runArchiveQualityReport(windowHours)
      await loadCoreArchiveHealth({ force: true })
    } catch (runError) {
      setError(runError.message || "Failed to generate quality report")
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const cards = metricCards(status)
  const heatmapBins = sportsActivityHeatmap?.bins || []
  const heatmapMaxVolume = heatmapBins.reduce(
    (max, bin) => Math.max(max, Number(bin.totalVolume || 0)),
    0
  )
  const heatmapLegendBands = buildHeatLegendBands(heatmapMaxVolume)
  const activeGameHours =
    marketScope === "sports" ? inferActiveGameHours(debouncedSportsKeywordFilter) : DEFAULT_ACTIVE_GAME_HOURS
  const activePeriodMapTitle = "Market active period map"
  const scopeLabelMap = new Map(SCOPE_CATEGORY_OPTIONS.map((option) => [option.value, option.label]))
  const historyLabelMap = new Map(HISTORY_WINDOW_OPTIONS.map((option) => [option.value, option.label]))
  const scopeTitle =
    marketScope === "all"
      ? "all markets"
      : marketScope === "sports"
        ? "sports markets"
        : `${scopeLabelMap.get(marketScope) || marketScope} category markets`
  const categoryFilterLabel =
    marketScope === "all"
      ? "all categories"
      : marketScope === "sports"
        ? "sports"
        : scopeLabelMap.get(marketScope) || marketScope
  const historyWindowLabel = historyLabelMap.get(marketHistoryWindow) || "Recent 90d"
  const visibleActivePeriods = sportsActivePeriods
  const inGameQuarterBins = (sportsInGameQuarterHeatmap?.bins || []).filter(
    (bin) => bin.startHour >= 0 && bin.endHour <= activeGameHours
  )
  const hasScopeCoverageData = scopeCoverageRows.length > 0
  const allScopeCoverageZero =
    hasScopeCoverageData && scopeCoverageRows.every((row) => Number(row.count || 0) === 0)

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="ml-64 flex-1 px-8 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
            <div className="grid gap-6 px-8 py-8 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  Polymarket archive health
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">
                    Replay readiness for your trading stack
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    This page turns the new backend archive endpoints into an operational view: freshness,
                    missing buckets, replayable windows, and the exact replay slice shape your archive pipeline emits.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/polymarket"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                  >
                    Back to markets
                  </Link>
                  <button
                    onClick={() => loadArchiveHealth()}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    {refreshing ? "Refreshing..." : "Refresh all"}
                  </button>
                  <button
                    onClick={handleRefreshCore}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    {loading ? "Refreshing core..." : "Refresh core"}
                  </button>
                  <button
                    onClick={handleRefreshSports}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    {sportsLoading ? "Refreshing sports..." : "Refresh sports"}
                  </button>
                  <button
                    onClick={handleGenerateQualityReport}
                    disabled={isGeneratingReport}
                    className="rounded-xl border border-cyan-300/50 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isGeneratingReport ? "Generating..." : "Run quality report"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                    Controls
                  </h2>
                  <span className="text-xs text-slate-400">Live from backend</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <label className="space-y-2 text-sm">
                    <span className="text-slate-300">Window hours</span>
                    <select
                      value={windowHours}
                      onChange={(event) => setWindowHours(Number(event.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    >
                      {[6, 12, 24, 48].map((value) => (
                        <option key={value} value={value}>
                          {value}h
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-slate-300">Replay threshold</span>
                    <select
                      value={minCoveragePct}
                      onChange={(event) => setMinCoveragePct(Number(event.target.value))}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    >
                      {[70, 80, 90, 100].map((value) => (
                        <option key={value} value={value}>
                          {value}%
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-slate-300">Gap lens</span>
                    <select
                      value={gapType}
                      onChange={(event) => setGapType(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="market">Market snapshots</option>
                      <option value="orderbook">Order books</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
              {error}
            </section>
          ) : null}

          {archiveApiAvailable === false ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm">
                  Backend is running but does not include Archive Health endpoints yet.
                </p>
                <button
                  onClick={() => loadCoreArchiveHealth({ force: true })}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                >
                  Retry detection
                </button>
              </div>
            </section>
          ) : null}

          {loading ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
              ))}
            </section>
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <article key={card.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-4 text-3xl font-bold text-slate-900">{card.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{card.helper}</p>
                </article>
              ))}
            </section>
          )}

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Coverage and freshness</h2>
                  <p className="text-sm text-slate-500">Snapshot completeness across the selected archive window</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {status?.intervalMinutes || 5} minute buckets
                </span>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Market coverage</span>
                    <span>{formatPercent(status?.summary?.marketCoveragePct)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full ${buildCoverageTone(status?.summary?.marketCoveragePct)}`}
                      style={{ width: `${Math.min(status?.summary?.marketCoveragePct || 0, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Order book coverage</span>
                    <span>{formatPercent(status?.summary?.orderBookCoveragePct)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full ${buildCoverageTone(status?.summary?.orderBookCoveragePct)}`}
                      style={{ width: `${Math.min(status?.summary?.orderBookCoveragePct || 0, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest snapshot</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {formatDateTime(status?.summary?.latestSnapshotAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest quality report</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {formatDateTime(status?.latestQualityReport?.generatedAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {status?.latestQualityReport?.notes || "No warnings in latest report"}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-slate-900">Replay slice preview</h2>
                <p className="text-sm text-slate-500">Exact payload shape emitted by archive replay slicing</p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Source window</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {replaySlice?.sourceWindow || "N/A"}
                    </p>
                    {!replaySlice ? (
                      <p className="mt-1 text-xs text-slate-500">No replayable slice for current threshold</p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Populated intervals</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {replaySlice?.range?.populatedIntervals || 0}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-950 p-4 text-slate-100">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Slice range</p>
                  <div className="mt-3 space-y-2 font-mono text-xs">
                    <div>start: {replaySlice?.range?.start || "N/A"}</div>
                    <div>end: {replaySlice?.range?.end || "N/A"}</div>
                    <div>marketSnapshots: {replaySlice?.counts?.marketSnapshots || 0}</div>
                    <div>orderBookSnapshots: {replaySlice?.counts?.orderBookSnapshots || 0}</div>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Largest current gaps</h2>
                  <p className="text-sm text-slate-500">The worst archive holes in the selected window</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {gapType}
                </span>
              </div>

              <div className="space-y-3">
                {gaps.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    No missing buckets detected for this filter.
                  </div>
                ) : (
                  gaps.map((gap) => (
                    <div key={gap.key} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {gapType === "orderbook"
                              ? gap.tokenId || gap.marketId || gap.key
                              : gap.question || gap.marketId || gap.tokenId}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {gapType === "orderbook"
                              ? `${gap.marketId ? `Market ${gap.marketId} • ` : ""}${gap.outcome || "Unknown outcome"}`
                              : `${gap.marketId ? `Market ${gap.marketId}` : gap.key}${gap.outcome ? ` • ${gap.outcome}` : ""}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-rose-600">{gap.missingIntervalsCount}</p>
                          <p className="text-xs text-slate-500">missing buckets</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <span>Coverage</span>
                        <span>{formatPercent(gap.coveragePct)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full ${buildCoverageTone(gap.coveragePct)}`}
                          style={{ width: `${Math.min(gap.coveragePct, 100)}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Sample missing intervals: {(gap.missingIntervals || []).join(", ") || "None"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-slate-900">Replay windows</h2>
                <p className="text-sm text-slate-500">Contiguous windows that already meet your coverage threshold</p>
              </div>

              <div className="space-y-3">
                {replayWindows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    No replayable window yet. Let the archiver run longer.
                  </div>
                ) : (
                  replayWindows.map((window) => (
                    <div key={`${window.start}-${window.end}`} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatDateTime(window.start)} to {formatDateTime(window.end)}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {window.buckets} buckets ready for replay
                          </p>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-slate-200">
                          <p className="text-xs text-slate-500">Min coverage</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatPercent(Math.min(window.minMarketCoveragePct, window.minOrderBookCoveragePct))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section>
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent quality reports</h2>
                  <p className="text-sm text-slate-500">Latest persisted health snapshots for this window</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {qualityReports.length} records
                </span>
              </div>

              {qualityReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No quality report yet. Click "Run quality report" to generate one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-3 py-3">Generated</th>
                        <th className="px-3 py-3">Window</th>
                        <th className="px-3 py-3">Market Coverage</th>
                        <th className="px-3 py-3">Order Book Coverage</th>
                        <th className="px-3 py-3">Freshness</th>
                        <th className="px-3 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualityReports.map((report) => (
                        <tr key={report.id} className="border-b border-slate-100 text-sm text-slate-700">
                          <td className="px-3 py-3">{formatDateTime(report.generatedAt)}</td>
                          <td className="px-3 py-3">{report.windowHours}h</td>
                          <td className="px-3 py-3">{formatPercent(report.marketCoveragePct)}</td>
                          <td className="px-3 py-3">{formatPercent(report.orderBookCoveragePct)}</td>
                          <td className="px-3 py-3">
                            {report.staleMinutes === null || report.staleMinutes === undefined
                              ? "N/A"
                              : `${report.staleMinutes}m`}
                          </td>
                          <td className="px-3 py-3">{report.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>

          <section>
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Kickoff-relative market activity heatmap</h2>
                  <p className="text-sm text-slate-500">
                    Hourly aggregation from T-7 days to T+6 hours around kickoff ({scopeTitle}, {categoryFilterLabel}, {historyWindowLabel})
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  source: {sportsActivitySource}{sportsLoading ? " · loading" : ""}
                </span>
              </div>

              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex w-full max-w-2xl flex-wrap items-center gap-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-slate-500">Scope</label>
                  <select
                    value={marketScope}
                    onChange={(event) => setMarketScope(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                  >
                    {SCOPE_CATEGORY_OPTIONS.map((option) => (
                      <option key={`heat-scope-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <label className="ml-2 text-xs uppercase tracking-[0.16em] text-slate-500">Time</label>
                  <select
                    value={marketHistoryWindow}
                    onChange={(event) => setMarketHistoryWindow(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                  >
                    {HISTORY_WINDOW_OPTIONS.map((option) => (
                      <option key={`heat-history-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={downloadSportsHeatmapCsv}
                    disabled={!sportsActivityHeatmap || (sportsActivityHeatmap.bins || []).length === 0}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Category Coverage (live markets)
                  </p>
                  <span className="text-[11px] text-slate-500">
                    {scopeCoverageLoading ? "checking..." : `${scopeCoverageRows.length} scopes`}
                  </span>
                </div>
                {allScopeCoverageZero ? (
                  <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-800">
                    Live category coverage is temporarily unavailable. Check backend connectivity or API source status.
                  </div>
                ) : null}
                <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                  {scopeCoverageRows.map((row) => (
                    <div key={`coverage-${row.value}`} className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                      <p className="truncate text-[10px] uppercase tracking-[0.12em] text-slate-500">{row.label}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{formatMaybeNumber(row.count)}</p>
                      <p className="text-[10px] text-slate-500">source: {row.source}</p>
                    </div>
                  ))}
                </div>
              </div>

              {sportsActivityNote ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {sportsActivityNote}
                </div>
              ) : null}

              {sportsLoading && !sportsActivityHeatmap ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  Loading kickoff-relative activity...
                </div>
              ) : !sportsActivityHeatmap || heatmapBins.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No aggregated kickoff-relative activity yet.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Markets</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {sportsActivityHeatmap.marketsCount || 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Unique traders</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatMaybeNumber(sportsActivityHeatmap.summary?.uniqueTradersTotal)}
                      </p>
                      <p className="text-xs text-slate-500">Local platform trades only</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pre-game depth</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatCompactNumber(sportsActivityHeatmap.summary?.preGameVolume)}
                      </p>
                      <p className="text-xs text-slate-500">{formatPercent(sportsActivityHeatmap.summary?.preGamePct)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">In-game depth</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatCompactNumber(sportsActivityHeatmap.summary?.inGameVolume)}
                      </p>
                      <p className="text-xs text-slate-500">{formatPercent(sportsActivityHeatmap.summary?.inGamePct)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Post-game depth</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatCompactNumber(sportsActivityHeatmap.summary?.postGameVolume)}
                      </p>
                      <p className="text-xs text-slate-500">{formatPercent(sportsActivityHeatmap.summary?.postGamePct)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                    <p>
                      Heatmap metric: <span className="font-semibold text-slate-800">{HEATMAP_VOLUME_LABEL}</span>.
                      This is not transacted volume. Unique trader bins are computed from local filled trades only
                      ({`order.symbol = marketId`}); they are not full-chain trader counts.
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>T-7d</span>
                      <span>Kickoff (T+0)</span>
                      <span>T+6h</span>
                    </div>
                    <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Lightest (lower activity)</span>
                      <div className="flex items-center gap-1">
                        {HEATMAP_INTENSITY_STEPS.map((toneClass, index) => (
                          <span key={`intensity-${index}`} className={`h-2.5 w-5 rounded-sm ${toneClass}`} />
                        ))}
                      </div>
                      <span>Darkest (most activity)</span>
                    </div>
                    <div className="mb-2 grid gap-1 md:grid-cols-5">
                      {heatmapLegendBands.map((band) => (
                        <div key={band.pctLabel} className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
                          <span className={`h-2.5 w-4 rounded-sm ${band.toneClass}`} />
                          <span>
                            {band.pctLabel} of peak ({formatCompactNumber(band.minValue)}-{formatCompactNumber(band.maxValue)})
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
                      {[
                        { label: "Active game", dotClassName: "bg-violet-600" },
                        { label: "Post-game", dotClassName: "bg-pink-500" },
                        { label: "Within 1 day to kickoff", dotClassName: "bg-sky-500" },
                        { label: "Earlier than 1 day to kickoff", dotClassName: "bg-emerald-500" }
                      ].map((item) => (
                        <span key={item.label} className="inline-flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${item.dotClassName}`} />
                          {item.label}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-58 gap-1">
                      {heatmapBins.map((bin) => {
                        const value = Number(bin.totalVolume || 0)
                        const band = getHeatBand(value, heatmapMaxVolume)
                        return (
                        <div
                          key={bin.index}
                          title={`${bin.label} | ${HEATMAP_VOLUME_LABEL.toLowerCase()}=${value.toFixed(2)} | band=${band.pctLabel} of peak | uniqueTraders=${bin.uniqueTraders ?? 0} | coverage=${formatPercent(bin.marketCoveragePct)}`}
                          className={`h-5 rounded-sm ${buildHeatTone(value, heatmapMaxVolume)}`}
                        />
                      )})}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-2 py-2">Relative hour</th>
                          <th className="px-2 py-2">Order book depth</th>
                          <th className="px-2 py-2">Unique traders</th>
                          <th className="px-2 py-2">Snapshots</th>
                          <th className="px-2 py-2">Market coverage</th>
                          <th className="px-2 py-2">Period</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapBins
                          .filter((bin) => bin.startHour >= -24 && bin.endHour <= 6)
                          .map((bin) => {
                            const period = classifyKickoffPeriod(Number(bin.startHour || 0), activeGameHours)
                            return (
                            <tr key={`table-${bin.index}`} className={`border-b border-slate-100 text-slate-700 ${period.rowClassName}`}>
                              <td className="px-2 py-2">{bin.label}</td>
                              <td className="px-2 py-2">{formatCompactNumber(bin.totalVolume)}</td>
                              <td className="px-2 py-2">{formatMaybeNumber(bin.uniqueTraders)}</td>
                              <td className="px-2 py-2">{bin.snapshotCount}</td>
                              <td className="px-2 py-2">{formatPercent(bin.marketCoveragePct)}</td>
                              <td className="px-2 py-2 text-xs text-slate-600">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className={`h-2.5 w-2.5 rounded-full ${period.dotClassName}`} />
                                  {period.label}
                                </span>
                              </td>
                            </tr>
                          )})}
                      </tbody>
                    </table>
                  </div>

                  {sportsInGameQuarterNote ? (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                      {sportsInGameQuarterNote}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">In-game 15-minute breakdown</h3>
                        <p className="text-xs text-slate-500">
                          Quarter-hour bins from kickoff to T+{activeGameHours}h
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        source: {sportsInGameQuarterSource}
                      </span>
                    </div>

                    {inGameQuarterBins.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500">
                        No 15-minute in-game bins available.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                              <th className="px-2 py-2">Relative window</th>
                              <th className="px-2 py-2">Order book depth</th>
                              <th className="px-2 py-2">Unique traders</th>
                              <th className="px-2 py-2">Snapshots</th>
                              <th className="px-2 py-2">Market coverage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inGameQuarterBins.map((bin) => (
                              <tr key={`quarter-${bin.index}`} className="border-b border-slate-100 bg-violet-50/70 text-slate-700">
                                <td className="px-2 py-2">{bin.label}</td>
                                <td className="px-2 py-2">{formatCompactNumber(bin.totalVolume)}</td>
                                <td className="px-2 py-2">{formatMaybeNumber(bin.uniqueTraders)}</td>
                                <td className="px-2 py-2">{bin.snapshotCount}</td>
                                <td className="px-2 py-2">{formatPercent(bin.marketCoveragePct)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          </section>

          <section>
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{activePeriodMapTitle}</h2>
                  <p className="text-sm text-slate-500">
                    Lifecycle timeline for ended {scopeTitle} in {categoryFilterLabel}, {historyWindowLabel} with phase colors (before game, active period, after game) and dual overlay blocks for trades and unique traders.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  source: {sportsActiveSource}{sportsLoading ? " · loading" : ""}
                </span>
              </div>

              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex w-full max-w-3xl flex-wrap items-center gap-2">
                  <label className="text-xs uppercase tracking-[0.16em] text-slate-500">Scope</label>
                  <select
                    value={marketScope}
                    onChange={(event) => setMarketScope(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                  >
                    {SCOPE_CATEGORY_OPTIONS.map((option) => (
                      <option key={`map-scope-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <label className="ml-2 text-xs uppercase tracking-[0.16em] text-slate-500">Time</label>
                  <select
                    value={marketHistoryWindow}
                    onChange={(event) => setMarketHistoryWindow(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                  >
                    {HISTORY_WINDOW_OPTIONS.map((option) => (
                      <option key={`map-history-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-3 text-xs text-slate-600">
                <div>
                  <span className="font-medium text-slate-700">Market lifecycle phases:</span>
                  <div className="mt-2 space-y-1.5 ml-2">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block h-3 w-6 rounded-sm bg-orange-500" />
                      <span>Before game (trading starts, low activity pre-event)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block h-3 w-6 rounded-sm bg-rose-500" />
                      <span className="font-medium">Active period (peak trading during event)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block h-3 w-6 rounded-sm bg-amber-400" />
                      <span>After game (post-event trading, market closing)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Timeline view:</span>
                  <span className="text-slate-500">Switch between strict duration and readability mode</span>
                </div>
                <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setTimelineViewMode("real")}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${timelineViewMode === "real"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Real mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineViewMode("readable")}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${timelineViewMode === "readable"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Readable mode
                  </button>
                </div>
              </div>

              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Trades intensity (light → dark):</span>
                </div>
                <div className="ml-2 flex items-center gap-1.5">
                  {TRADE_INTENSITY_TONES.map((tone, idx) => (
                    <div key={`trade-intensity-${idx}`} className="flex flex-col items-center gap-1">
                      <span className={`h-6 w-6 rounded-sm ${tone}`} />
                      <span className="text-[9px] text-slate-500">{Math.round((idx / (TRADE_INTENSITY_TONES.length - 1)) * 100)}%</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-2">
                  <span className="font-medium text-slate-700">Unique traders intensity (light → dark):</span>
                </div>
                <div className="ml-2 flex items-center gap-1.5">
                  {UNIQUE_TRADER_INTENSITY_TONES.map((tone, idx) => (
                    <div key={`unique-intensity-${idx}`} className="flex flex-col items-center gap-1">
                      <span className={`h-6 w-6 rounded-sm ${tone}`} />
                      <span className="text-[9px] text-slate-500">{Math.round((idx / (UNIQUE_TRADER_INTENSITY_TONES.length - 1)) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Recurrence priority (top to bottom):</span>
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-cyan-800">Weekly recurring</span>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">Monthly recurring</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Seasonal</span>
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-800">Annual</span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">Multi-year / rare events</span>
              </div>

              {visibleActivePeriods.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No active period rows yet for this scope.
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleActivePeriods.map((market) => {
                    const segments = buildSegmentStyle(market)
                    const visualSegments = buildVisualSegmentStyle(segments)
                    const activeHours =
                      market.activeDurationHours ?? durationHours(market.activeStartAt, market.activeEndAt)
                    const preHours = durationHours(market.marketOpenAtProxy, market.activeStartAt)
                    const postHours = durationHours(market.activeEndAt, market.marketCloseAt)
                    const activeTone = getActiveDurationTone(activeHours)
                    const recurrenceLabel = formatRecurrenceLabel(market.recurrenceBucket)
                    const recurrenceTone = getRecurrenceTone(market.recurrenceBucket)
                    const activityProfile = market.activityProfile || null
                    const estimatedOverlay = !activityProfile?.bins?.length
                      ? buildEstimatedOverlayBins(market)
                      : null
                    const activityBins = activityProfile?.bins?.length
                      ? activityProfile.bins
                      : estimatedOverlay?.bins || []
                    const estimatedTradesTotal = estimatedOverlay
                      ? estimatedOverlay.bins.reduce(
                          (sum, bin) => sum + Number(bin.trades || 0),
                          0
                        )
                      : 0
                    const estimatedUniqueTotal = estimatedOverlay
                      ? estimatedOverlay.bins.reduce(
                          (sum, bin) => sum + Number(bin.uniqueTraders || 0),
                          0
                        )
                      : 0
                    const displayTradesTotal = activityProfile?.totalTrades || estimatedTradesTotal
                    const displayUniqueTotal =
                      activityProfile?.totalUniqueTraders || estimatedUniqueTotal
                    const hasLocalTradeSignal =
                      Number(displayTradesTotal || 0) > 0 || Number(displayUniqueTotal || 0) > 0
                    const maxTradesInBin = Number(
                      activityProfile?.maxTradesInBin || estimatedOverlay?.maxTradesInBin || 0
                    )
                    const maxUniqueTradersInBin = Number(
                      activityProfile?.maxUniqueTradersInBin || estimatedOverlay?.maxUniqueTradersInBin || 0
                    )
                    const activeStartPct = Number.parseFloat(segments.pre.width) || 0
                    const activeEndPct = Number.parseFloat(segments.post.left) || 0
                    const collapsedRealTimeline =
                      Number.parseFloat(segments.pre.width) >= 99 &&
                      Number.parseFloat(segments.active.width) <= 0.5 &&
                      Number.parseFloat(segments.post.width) <= 0.5
                    const timelineTitle = timelineViewMode === "real"
                      ? `Real mode | pre ${preHours === null ? "N/A" : `${preHours.toFixed(1)}h`} | active ${activeHours === null ? "N/A" : `${activeHours.toFixed(1)}h`} | post ${postHours === null ? "N/A" : `${postHours.toFixed(1)}h`} | exact proportions only`
                      : `Readable mode | uses minimum visual widths for legibility | real pre ${preHours === null ? "N/A" : `${preHours.toFixed(1)}h`} | real active ${activeHours === null ? "N/A" : `${activeHours.toFixed(1)}h`} | real post ${postHours === null ? "N/A" : `${postHours.toFixed(1)}h`}`

                    return (
                      <div key={market.marketId} className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{market.question || market.marketId}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                              market {market.marketId} {market.category ? `• ${market.category}` : ""}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${activeTone.badgeClassName}`}>
                                {activeTone.label}
                              </span>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${recurrenceTone}`}>
                                {recurrenceLabel}
                              </span>
                            </div>
                          </div>
                          <div className="text-right text-[10px] leading-tight text-slate-400">
                            <div>pre {preHours === null ? "N/A" : `${preHours.toFixed(1)}h`}</div>
                            <div>active {activeHours === null ? "N/A" : `${activeHours.toFixed(1)}h`}</div>
                            <div>post {postHours === null ? "N/A" : `${postHours.toFixed(1)}h`}</div>
                            <div className="pt-0.5 text-slate-400">
                              trades {formatMaybeNumber(displayTradesTotal)}
                            </div>
                            <div className="text-slate-400">
                              uniq {formatMaybeNumber(displayUniqueTotal)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-lg border border-slate-200/90 bg-white p-3">
                          <div className="space-y-2.5">
                            {/* Timeline base with phase colors */}
                            <div title={timelineTitle}>
                              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">Timeline phases & activity</p>

                              {timelineViewMode === "real" ? (
                                <div>
                                  <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                                    <div className="absolute inset-y-0 rounded-l-full bg-orange-500" style={segments.pre} />
                                    <div className="absolute inset-y-0 bg-rose-500" style={segments.active} />
                                    <div className="absolute inset-y-0 rounded-r-full bg-amber-400" style={segments.post} />
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-400">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                      Strict duration
                                    </span>
                                    <span>Exact timing only; short phases may appear very small.</span>
                                  </div>
                                  {collapsedRealTimeline ? (
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-orange-700">
                                      <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 font-medium">
                                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                        Before game only
                                      </span>
                                      <span>
                                        Raw timing data collapses the other phases to near-zero in this market.
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-2.5">
                                  <div className="relative h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-200 shadow-inner">
                                    <div
                                      className="absolute inset-y-0 rounded-l-full bg-orange-500/85"
                                      style={visualSegments.pre}
                                      title={`Before game | real ${preHours === null ? "N/A" : `${preHours.toFixed(1)}h`} | displayed ${visualSegments.pre.width}`}
                                    />
                                    <div
                                      className="absolute inset-y-0 bg-rose-500/85"
                                      style={visualSegments.active}
                                      title={`Active period | real ${activeHours === null ? "N/A" : `${activeHours.toFixed(1)}h`} | displayed ${visualSegments.active.width}`}
                                    />
                                    <div
                                      className="absolute inset-y-0 rounded-r-full bg-amber-400/85"
                                      style={visualSegments.post}
                                      title={`After game | real ${postHours === null ? "N/A" : `${postHours.toFixed(1)}h`} | displayed ${visualSegments.post.width}`}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Trades layer */}
                            {activityBins.length > 0 ? (
                              <div>
                                <div className="mb-1 flex items-center justify-between">
                                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">📊 Trades intensity</p>
                                  <span className="text-[9px] text-slate-400">({formatMaybeNumber(displayTradesTotal)} total trades)</span>
                                </div>
                                <div className="relative h-2.5 overflow-hidden rounded-sm bg-slate-50 ring-1 ring-slate-200">
                                  <div className="absolute inset-x-0 top-0 grid h-full grid-flow-col gap-0.5 p-0.5">
                                    {activityBins.map((bin) => (
                                      <div
                                        key={`${market.marketId}-trades-${bin.index}`}
                                        title={`${formatDateTime(bin.startAt)} to ${formatDateTime(bin.endAt)} | trades: ${bin.trades}`}
                                        className={`rounded-[2px] ${getIntensityTone(
                                          Number(bin.trades || 0),
                                          maxTradesInBin,
                                          TRADE_INTENSITY_TONES
                                        )}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {/* Unique traders layer */}
                            {activityBins.length > 0 ? (
                              <div>
                                <div className="mb-1 flex items-center justify-between">
                                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">👥 Unique traders intensity</p>
                                  <span className="text-[9px] text-slate-400">({formatMaybeNumber(displayUniqueTotal)} unique traders)</span>
                                </div>
                                <div className="relative h-2.5 overflow-hidden rounded-sm bg-slate-50 ring-1 ring-slate-200">
                                  <div className="absolute inset-x-0 top-0 grid h-full grid-flow-col gap-0.5 p-0.5">
                                    {activityBins.map((bin) => (
                                      <div
                                        key={`${market.marketId}-uniq-${bin.index}`}
                                        title={`${formatDateTime(bin.startAt)} to ${formatDateTime(bin.endAt)} | unique traders: ${bin.uniqueTraders}`}
                                        className={`rounded-[2px] ${getIntensityTone(
                                          Number(bin.uniqueTraders || 0),
                                          maxUniqueTradersInBin,
                                          UNIQUE_TRADER_INTENSITY_TONES
                                        )}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {!hasLocalTradeSignal ? (
                              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-500">
                                No local fills found for this market in the current Order table, so trades/unique-traders intensity is 0.
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-medium text-slate-700">Legend:</span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1">
                            <span className="h-2 w-2 rounded-full bg-orange-500" />
                            Before game
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            Active period
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            After game
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-sky-300 bg-sky-50 px-2 py-1 text-sky-700">
                            <span className="text-[9px] font-semibold">i</span>
                            Readable mode = visual only
                          </span>
                        </div>

                        <div className="mt-2">
                          <div className="relative h-3">
                            <div className="absolute inset-x-0 top-1.5 h-px bg-slate-200" />

                            <span className="absolute top-0 h-2 w-2 rounded-full border border-slate-300 bg-white" style={{ left: "0%" }} />
                            <span
                              className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full border border-sky-300 bg-sky-100"
                              style={{ left: `${activeStartPct}%` }}
                            />
                            <span
                              className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full border border-emerald-300 bg-emerald-100"
                              style={{ left: `${activeEndPct}%` }}
                            />
                            <span className="absolute top-0 right-0 h-2 w-2 rounded-full border border-slate-300 bg-white" />
                          </div>

                          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 md:grid-cols-4">
                            <div className="min-w-0">
                              <span className="block uppercase tracking-[0.08em] text-slate-400">open</span>
                              <span className="block truncate">{formatDateTime(market.marketOpenAtProxy)}</span>
                            </div>
                            <div className="min-w-0 md:text-center">
                              <span className="block uppercase tracking-[0.08em] text-slate-400">active start</span>
                              <span className="block truncate">{formatDateTime(market.activeStartAt)}</span>
                            </div>
                            <div className="min-w-0 md:text-center">
                              <span className="block uppercase tracking-[0.08em] text-slate-400">active end</span>
                              <span className="block truncate">{formatDateTime(market.activeEndAt)}</span>
                            </div>
                            <div className="min-w-0 text-right">
                              <span className="block uppercase tracking-[0.08em] text-slate-400">close</span>
                              <span className="block truncate">{formatDateTime(market.marketCloseAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </article>
          </section>
        </div>
      </main>
    </div>
  )
}