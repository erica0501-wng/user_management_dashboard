import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import { CATEGORY_FILTERS, getPolymarketCategoryMeta, getPolymarketMarketMeta, normalizePolymarketCategory } from "../utils/polymarketMarketMeta"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000"

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

const roiColor = (roi) => {
  if (roi > 5) return "text-emerald-600"
  if (roi > -10) return "text-amber-600"
  return "text-rose-600"
}

const winRateColor = (winRate) => {
  if (winRate >= 60) return "text-emerald-600"
  if (winRate >= 40) return "text-amber-600"
  return "text-rose-600"
}

const GROUP_DESCRIPTION_EN = {
  "NHL Stanley Cup 2026": "NHL championship and team performance markets",
  "FIFA World Cup 2026": "FIFA World Cup and national team performance markets",
  "Technology & AI": "Technology and AI product/event markets",
  "Legal & Sentencing": "Legal outcomes and sentencing markets",
  "Entertainment & Gaming": "Entertainment, gaming releases, and music markets",
  Cryptocurrency: "Cryptocurrency and blockchain event markets",
  "Geopolitics & Conflict": "Global conflict and geopolitical event markets"
}

const getGroupDescription = (group) => {
  if (GROUP_DESCRIPTION_EN[group?.name]) {
    return GROUP_DESCRIPTION_EN[group.name]
  }
  return group?.description || "No description"
}

const LIVE_GROUP_DESCRIPTION = "Synced from current Polymarket markets"

const buildGroupsFromLiveMarkets = (markets = []) => {
  const grouped = new Map()

  // Ensure all standard categories always exist even if 0 markets
  for (const filter of CATEGORY_FILTERS.filter(f => f.id !== "all")) {
    const categoryMeta = getPolymarketCategoryMeta(filter.id)
    grouped.set(categoryMeta.label, {
      id: `live-${categoryMeta.id}`,
      name: categoryMeta.label,
      description: LIVE_GROUP_DESCRIPTION,
      markets: [],
      _count: { backtests: 0 },
    })
  }

  for (const market of markets) {
    const categoryId = getPolymarketMarketMeta(market).categoryId
    const categoryMeta = getPolymarketCategoryMeta(categoryId)
    const groupName = categoryMeta.label

    if (!grouped.has(groupName)) {
      grouped.set(groupName, {
        id: `live-${categoryMeta.id}`,
        name: groupName,
        description: LIVE_GROUP_DESCRIPTION,
        markets: [],
        _count: { backtests: 0 },
      })
    }

    grouped.get(groupName).markets.push(String(market.id))
  }

  const preferredOrder = CATEGORY_FILTERS
    .filter((item) => item.id !== "all")
    .map((item) => getPolymarketCategoryMeta(item.id).label)

  return Array.from(grouped.values()).sort(
    (left, right) => preferredOrder.indexOf(left.name) - preferredOrder.indexOf(right.name)
  )
}

const parseBacktestParams = (params) => {
  if (!params) return {}

  if (typeof params === "string") {
    try {
      const parsed = JSON.parse(params)
      return typeof parsed === "object" && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }

  return typeof params === "object" ? params : {}
}

const inferCategoryFromGroup = (groupName = "") => {
  const text = String(groupName || "").toLowerCase()
  if (!text) return ""

  if (/sports|nhl|nba|nfl|mlb|fifa|world cup/.test(text)) return "Sports"
  if (/crypto|bitcoin|ethereum|blockchain/.test(text)) return "Crypto"
  if (/technology|tech|ai/.test(text)) return "Technology & AI"
  if (/legal|sentencing|court/.test(text)) return "Legal"
  if (/entertainment|gaming|movie|music|box office/.test(text)) return "Entertainment"
  if (/geopolitics|conflict|war|international/.test(text)) return "Geopolitics"
  if (/finance|rates|macro|economy/.test(text)) return "Macro / Rates"

  return ""
}

const getGroupCategory = (groupName = "") => {
  const name = String(groupName || "").toLowerCase()
  if (name.includes("crypto")) return "crypto"
  if (name.includes("politics")) return "politics"
  if (name.includes("sports") || name.includes("nhl") || name.includes("nba") || name.includes("nfl") || name.includes("fifa")) return "sports"
  // entertainment 必须放在 technology 之前判断，否则 "entertAInment" 会被 includes("ai") 误判成 technology
  if (name.includes("entertainment") || name.includes("movie") || name.includes("gaming")) return "entertainment"
  if (name.includes("technology") || name.includes("tech") || /\bai\b/.test(name)) return "technology"
  if (name.includes("finance") || name.includes("stock") || name.includes("macro")) return "finance"
  return "other"
}

const getBacktestMarketContext = (backtest, markets = []) => {
  const params = parseBacktestParams(backtest?.params)
  const marketId = String(backtest?.marketId || params.marketId || "").trim()
  const matchingMarket = marketId
    ? markets.find((market) => String(market?.id) === marketId)
    : null

  const marketMeta = getPolymarketMarketMeta(
    {
      question: backtest?.marketQuestion || matchingMarket?.question,
      title: matchingMarket?.title,
      description: matchingMarket?.description,
      category: backtest?.marketCategory || matchingMarket?.category || matchingMarket?.subcategory,
      image: matchingMarket?.image,
      imageUrl: matchingMarket?.image,
      icon: matchingMarket?.icon,
      marketQuestion: backtest?.marketQuestion,
      marketTitle: matchingMarket?.title,
    },
    marketId ? `Market ${marketId}` : `${backtest?.group?.name || "Backtest"} market`
  )

  return {
    marketId,
    marketTitle: marketMeta.displayName,
    marketCategory: marketMeta.categoryLabel,
    marketCategoryId: marketMeta.categoryId,
  }
}

export default function BacktestDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [fallbackNotice, setFallbackNotice] = useState("")
  const [groups, setGroups] = useState([])
  const [rawBacktests, setRawBacktests] = useState([])
  const [backtests, setBacktests] = useState([])
  const [liveMarkets, setLiveMarkets] = useState([])
  const [availableMarkets, setAvailableMarkets] = useState([])
  const [availableMarketsLoading, setAvailableMarketsLoading] = useState(false)
  const [availableMarketsGroupTotal, setAvailableMarketsGroupTotal] = useState(0)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedMarketId, setSelectedMarketId] = useState("")
  const [selectedStrategy, setSelectedStrategy] = useState("momentum")
  const [strategies, setStrategies] = useState([])
  const [resultStrategyFilter, setResultStrategyFilter] = useState("all")
  const [resultScope, setResultScope] = useState("all")
  const [latestOnly, setLatestOnly] = useState(false)
  const [hideZeroTradeRuns, setHideZeroTradeRuns] = useState(false)
  const [running, setRunning] = useState(false)
  const [params, setParams] = useState({
    // Momentum & Volatility params
    buyThreshold: 0.005,
    sellThreshold: 0.005,
    spreadThreshold: 0.002,
    // Mean Reversion params
    period: 10,
    meanReversionBuyThreshold: 0.4,
    meanReversionSellThreshold: 0.6,
    positionSize: 1000,
  })
  const [tab, setTab] = useState("groups") // groups, backtests, run

  // 加载市场分组
  const loadGroups = async () => {
    try {
      setFallbackNotice("")
      const token = localStorage.getItem("token")
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
      let syncFallback = false

      const loadPolymarketGroups = async () => {
        const response = await fetch(`${API_BASE}/polymarket/market-groups?mode=polymarket`)
        if (!response.ok) throw new Error("Failed to load market groups")
        return response.json()
      }

      if (token) {
        const syncResponse = await fetch(`${API_BASE}/polymarket/market-groups/sync-polymarket`, {
          method: "POST",
          headers: authHeaders,
        })

        if (syncResponse.ok) {
          const syncData = await syncResponse.json()
          if (syncData?.fallback) {
            syncFallback = true
          }
        }
      }

      const data = await loadPolymarketGroups()

      if (data?.fallback) {
        setFallbackNotice(
          data?.message ||
            "Database is temporarily unavailable. Backtest groups are currently running in fallback mode for demo stability."
        )
      } else if (syncFallback) {
        setFallbackNotice(
          "Market group sync is temporarily unavailable. Showing the latest saved groups from the real database."
        )
      }
    } catch (err) {
      setError(err.message)
    }
  }

  // 加载策略
  const loadStrategies = async () => {
    try {
      const response = await fetch(`${API_BASE}/polymarket/backtest/strategies`)
      if (!response.ok) throw new Error("Failed to load strategies")
      const data = await response.json()
      setStrategies(data.strategies || [])
    } catch (err) {
      console.error(err)
    }
  }

  const loadLiveMarkets = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE}/polymarket/markets?limit=300&offset=0`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error("Failed to load Polymarket markets")
      const data = await response.json()
      const markets = Array.isArray(data?.markets) ? data.markets : []
      setLiveMarkets(markets)
      if (markets.length > 0 && !selectedMarketId) {
        setSelectedMarketId(String(markets[0].id))
      }
    } catch (err) {
      console.error(err)
      setLiveMarkets([])
    }
  }

  // Load markets that actually have archive snapshots for the selected group.
  // These are the only markets that backtest can run against.
  const loadAvailableMarkets = async (groupName) => {
    if (!groupName) {
      setAvailableMarkets([])
      setAvailableMarketsGroupTotal(0)
      return
    }
    try {
      setAvailableMarketsLoading(true)
      const url = `${API_BASE}/polymarket/backtest/available-markets?groupName=${encodeURIComponent(groupName)}`
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to load backtest-available markets")
      const data = await response.json()
      const markets = Array.isArray(data?.markets) ? data.markets : []
      setAvailableMarkets(markets)
      setAvailableMarketsGroupTotal(Number(data?.groupTotal) || markets.length)
    } catch (err) {
      console.error("loadAvailableMarkets error:", err)
      setAvailableMarkets([])
      setAvailableMarketsGroupTotal(0)
    } finally {
      setAvailableMarketsLoading(false)
    }
  }

  // 加载回测结果
  const applyResultFilters = (results) => {
    const filteredByTrades = hideZeroTradeRuns
      ? results.filter((item) => Number(item?.totalTrades || 0) > 0)
      : results

    const filteredByStrategy =
      resultStrategyFilter === "all"
        ? filteredByTrades
        : filteredByTrades.filter((item) => item.strategyName === resultStrategyFilter)

    if (!latestOnly) {
      return filteredByStrategy
    }

    if (resultStrategyFilter !== "all") {
      return filteredByStrategy.slice(0, 1)
    }

    const seenStrategies = new Set()
    return filteredByStrategy.filter((item) => {
      if (seenStrategies.has(item.strategyName)) {
        return false
      }
      seenStrategies.add(item.strategyName)
      return true
    })
  }

  const loadBacktests = async () => {
    if (resultScope === "selected" && !selectedGroup) return
    try {
      const query = new URLSearchParams({ limit: "100" })
      if (resultScope === "selected" && selectedGroup) {
        query.set("groupName", selectedGroup)
      }

      const response = await fetch(`${API_BASE}/polymarket/backtest/results?${query.toString()}`)
      if (!response.ok) throw new Error("Failed to load backtests")
      const data = await response.json()
      const results = data.results || []

      if (data?.fallback) {
        setFallbackNotice(
          data?.message ||
            "No archived backtests are available yet. Showing demo results until the archive is populated."
        )
      }

      setRawBacktests(results)
      setBacktests(applyResultFilters(results))
    } catch (err) {
      console.error(err)
    }
  }

  // 运行回测
  const runBacktest = async () => {
    if (!selectedGroup) {
      setError("Please select a market group")
      return
    }

    if (!selectedMarketId) {
      setError("Please select a Polymarket market")
      return
    }

    setRunning(true)
    setError("")
    try {
      const normalizedParams = { ...params }

      if (selectedStrategy === "meanReversion") {
        const meanBuy = Number(params.meanReversionBuyThreshold ?? params.buyThreshold ?? 0.4)
        const meanSell = Number(params.meanReversionSellThreshold ?? params.sellThreshold ?? 0.6)

        normalizedParams.buyThreshold = meanBuy
        normalizedParams.sellThreshold = meanSell
        normalizedParams.meanReversionBuyThreshold = meanBuy
        normalizedParams.meanReversionSellThreshold = meanSell
      }

      const response = await fetch(`${API_BASE}/polymarket/backtest/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          groupName: selectedGroup,
          strategyName: selectedStrategy,
          params: normalizedParams,
          marketId: selectedMarketId,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to run backtest")
      }

      if (data?.success === false) {
        throw new Error(data?.error || data?.hint || "Backtest cannot run with current data state")
      }

      if (data?.fallback) {
        setError(data?.message || "Backtest is currently running in fallback mode")
      }

      setTab("backtests")
      loadBacktests()
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadGroups(), loadStrategies(), loadLiveMarkets()])
      setLoading(false)
    }
    init()
  }, [])

  // 当分组改变时加载回测
  useEffect(() => {
    const liveGroups = buildGroupsFromLiveMarkets(liveMarkets)
    setGroups(liveGroups)

    if (liveGroups.length === 0) {
      setSelectedGroup(null)
      setFallbackNotice((prev) =>
        prev || "Polymarket currently returned no markets, so no groups can be displayed yet."
      )
      return
    }

    setFallbackNotice((prev) =>
      prev === "Polymarket currently returned no markets, so no groups can be displayed yet." ? "" : prev
    )

    setSelectedGroup((prev) => {
      const selectedStillExists = liveGroups.some((group) => group.name === prev)
      return selectedStillExists ? prev : liveGroups[0].name
    })
  }, [liveMarkets])

  useEffect(() => {
    if (resultScope === "all" || selectedGroup) {
      loadBacktests()
    }
  }, [selectedGroup, resultStrategyFilter, latestOnly, hideZeroTradeRuns, resultScope])

  useEffect(() => {
    if (selectedStrategy === "meanReversion") {
      const currentBuy = Number(params.meanReversionBuyThreshold ?? params.buyThreshold)
      const currentSell = Number(params.meanReversionSellThreshold ?? params.sellThreshold)

      // If momentum-style tiny thresholds leaked into mean reversion, reset to sensible defaults.
      const safeBuy = Number.isFinite(currentBuy) && currentBuy >= 0.05 ? currentBuy : 0.4
      const safeSell = Number.isFinite(currentSell) && currentSell > safeBuy ? currentSell : 0.6

      setParams((prev) => ({
        ...prev,
        buyThreshold: safeBuy,
        sellThreshold: safeSell,
        meanReversionBuyThreshold: safeBuy,
        meanReversionSellThreshold: safeSell,
      }))
    }

    if (selectedStrategy === "momentum") {
      setParams((prev) => ({
        ...prev,
        buyThreshold: Number.isFinite(Number(prev.buyThreshold)) ? Number(prev.buyThreshold) : 0.005,
        sellThreshold: Number.isFinite(Number(prev.sellThreshold)) ? Number(prev.sellThreshold) : 0.005,
      }))
    }
  }, [selectedStrategy])

  const selectedGroupDetails = groups.find((group) => group.name === selectedGroup) || null
  const selectedGroupCategory = normalizePolymarketCategory(getGroupCategory(selectedGroupDetails?.name || ""))
  // Only show markets that actually have archive snapshots (backtest-eligible).
  // We intentionally do NOT fall back to liveMarkets: doing so would let the
  // user pick a market with 0 snapshots and hit "Insufficient data".
  const marketOptions = availableMarkets
  const selectedLiveMarket =
    marketOptions.find((market) => String(market.id) === String(selectedMarketId)) || null
  const selectedLiveMarketMeta = selectedLiveMarket ? getPolymarketMarketMeta(selectedLiveMarket) : null
  const selectedStrategyDetails =
    strategies.find((strategy) => strategy.key === selectedStrategy) || null

  // Whenever the selected group changes, refresh the list of markets that
  // actually have archive snapshots so the user can only pick backtestable ones.
  useEffect(() => {
    loadAvailableMarkets(selectedGroup)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup])

  useEffect(() => {
    if (marketOptions.length === 0) {
      if (selectedMarketId) {
        setSelectedMarketId("")
      }
      return
    }

    const currentExists = marketOptions.some((market) => String(market.id) === String(selectedMarketId))
    if (!currentExists) {
      setSelectedMarketId(String(marketOptions[0].id))
    }
  }, [selectedGroup, liveMarkets, selectedMarketId, marketOptions.length])

  if (loading)
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="ml-64 flex-1 px-8 py-8">
          <div className="flex min-h-[60vh] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="text-lg text-gray-500">Loading...</div>
          </div>
        </main>
      </div>
    )

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="ml-64 flex-1 px-8 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <h1 className="text-3xl font-bold text-gray-900">Strategy Backtest</h1>
            <p className="mt-1 text-gray-600">Test trading strategies on historical Polymarket data</p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-3 text-red-700">
              {error}
              <button
                onClick={() => setError("")}
                className="ml-2 text-red-600 hover:text-red-800 font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          {fallbackNotice && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-3 text-amber-800">
              {fallbackNotice}
            </div>
          )}

          {/* Content */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200">
              <button
                onClick={() => setTab("groups")}
                className={`px-4 py-3 font-medium border-b-2 transition ${
                  tab === "groups"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Market Groups
              </button>
              <button
                onClick={() => setTab("backtests")}
                className={`px-4 py-3 font-medium border-b-2 transition ${
                  tab === "backtests"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Results
              </button>
              <button
                onClick={() => setTab("run")}
                className={`px-4 py-3 font-medium border-b-2 transition ${
                  tab === "run"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Run Backtest
              </button>
            </div>

            {/* Market Groups Tab */}
            {tab === "groups" && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Market Groups</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => {
                        setSelectedGroup(group.name)
                        setTab("run")
                      }}
                      className={`p-4 rounded-lg cursor-pointer transition border-2 hover:shadow-md ${
                        selectedGroup === group.name
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <h3 className="font-semibold text-gray-900">{group.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{getGroupDescription(group)}</p>
                      <div className="flex items-center justify-between mt-3 text-sm">
                        <span className="text-gray-600">
                          <span className="font-semibold text-lg text-blue-600">{group.markets.length}</span> markets
                        </span>
                        <span className="text-gray-500">{group._count?.backtests || 0} backtests</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Backtests Tab */}
            {tab === "backtests" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Backtest Results - {resultScope === "all" ? "All Groups" : selectedGroup}
                  </h2>
                  <div className="flex items-center gap-3">
                    <select
                      value={resultScope}
                      onChange={(event) => setResultScope(event.target.value)}
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="selected">Selected group only</option>
                      <option value="all">All groups history</option>
                    </select>
                    <select
                      value={resultStrategyFilter}
                      onChange={(event) => setResultStrategyFilter(event.target.value)}
                      className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="all">All strategies</option>
                      {strategies.map((strategy) => (
                        <option key={strategy.key} value={strategy.key}>
                          {strategy.name}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={latestOnly}
                        onChange={(event) => setLatestOnly(event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Latest only
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={hideZeroTradeRuns}
                        onChange={(event) => setHideZeroTradeRuns(event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Hide zero-trade runs
                    </label>
                    <button
                      onClick={loadBacktests}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm font-medium"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {backtests.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <p className="text-gray-600">No backtests matched current filters.</p>
                    {rawBacktests.length > 0 && hideZeroTradeRuns && (
                      <p className="mt-2 text-sm text-gray-500">
                        You have history, but all runs are currently hidden by "Hide zero-trade runs".
                      </p>
                    )}
                    {rawBacktests.length > 0 && !hideZeroTradeRuns && (
                      <p className="mt-2 text-sm text-gray-500">
                        Try switching Strategy/Scope/Latest filters.
                      </p>
                    )}
                    {rawBacktests.length === 0 && (
                      <p className="mt-2 text-sm text-gray-500">Run a new backtest first to generate history.</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Strategy</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Market</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Category</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">ROI</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Trades</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Win Rate</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Sharpe</th>
                          <th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {backtests.map((bt, i) => {
                          const marketContext = getBacktestMarketContext(bt, liveMarkets)

                          return (
                            <tr
                              key={i}
                              onClick={() => navigate(`/polymarket/backtest/${bt.id}`)}
                              className="hover:bg-blue-50 cursor-pointer transition"
                            >
                              <td className="px-6 py-3">
                                <div className="font-medium text-gray-900">{bt.strategyName}</div>
                                <div className="text-xs text-gray-500">{bt.group?.name || "Unknown group"}</div>
                              </td>
                              <td className="px-6 py-3">
                                <div className="max-w-sm truncate font-medium text-gray-900">
                                  {marketContext.marketTitle}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {marketContext.marketId ? `ID: ${marketContext.marketId}` : "ID unavailable"}
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPolymarketCategoryMeta(marketContext.marketCategoryId).color}`}>
                                  {marketContext.marketCategory}
                                </span>
                              </td>
                              <td className={`px-6 py-3 font-semibold ${roiColor(bt.roi)}`}>
                                {bt.roi.toFixed(2)}%
                              </td>
                              <td className="px-6 py-3 text-gray-600">
                                {bt.totalTrades === 0
                                  ? "No trades"
                                  : `${bt.totalTrades} (${bt.winningTrades}W / ${bt.losingTrades}L)`}
                              </td>
                              <td className={`px-6 py-3 font-semibold ${bt.totalTrades === 0 ? "text-gray-500" : winRateColor(bt.winRate)}`}>
                                {bt.totalTrades === 0 ? "No trades" : `${bt.winRate.toFixed(2)}%`}
                              </td>
                              <td className="px-6 py-3 text-gray-600">{bt.totalTrades === 0 ? "No trades" : "N/A"}</td>
                              <td className="px-6 py-3 text-gray-500 text-xs">
                                {formatDateTime(bt.createdAt)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Run Backtest Tab */}
            {tab === "run" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Run New Backtest</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Choose a market group, strategy, and parameter set before launching a new run.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr]">
                  <div className="space-y-6">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                          1. Select Market Group
                        </h3>
                        <span className="text-xs text-slate-500">{groups.length} available</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {groups.map((group) => (
                          <button
                            key={group.id}
                            onClick={() => setSelectedGroup(group.name)}
                            className={`rounded-xl border-2 p-3 text-left transition ${
                              selectedGroup === group.name
                                ? "border-blue-500 bg-blue-50 text-blue-900"
                                : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                            }`}
                          >
                            <div className="font-medium">{group.name}</div>
                            <div className="mt-1 text-xs text-gray-600">{group.markets.length} markets</div>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                          2. Select Polymarket Market
                        </h3>
                        <span className="text-xs text-slate-500">
                          {availableMarketsLoading
                            ? "loading..."
                            : availableMarketsGroupTotal
                              ? `${marketOptions.length} of ${availableMarketsGroupTotal} have archive data`
                              : `${marketOptions.length} markets`}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <select
                          value={selectedMarketId}
                          onChange={(event) => setSelectedMarketId(event.target.value)}
                          disabled={availableMarketsLoading || marketOptions.length === 0}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">
                            {availableMarketsLoading
                              ? "Loading backtestable markets..."
                              : marketOptions.length === 0
                                ? "No archive data for this group yet"
                                : "Select a market with archive data"}
                          </option>
                          {marketOptions.map((market) => {
                            const meta = getPolymarketMarketMeta(market, `Market ${market.id}`)
                            const parts = []
                            if (market.snapshotCount) parts.push(`${market.snapshotCount} snaps`)
                            if (typeof market.priceRange === "number" && market.priceRange > 0) {
                              parts.push(`${(market.priceRange * 100).toFixed(1)}% range`)
                            }
                            if (market.tradeable === false) parts.push("flat — may yield 0 trades")
                            const suffix = parts.length ? ` — ${parts.join(", ")}` : ""
                            return (
                              <option key={String(market.id)} value={String(market.id)}>
                                {meta.displayName}{suffix}
                              </option>
                            )
                          })}
                        </select>

                        {selectedLiveMarket && (
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <div className="relative h-32 w-full bg-slate-900">
                              <img
                                src={selectedLiveMarketMeta.imageUrl}
                                alt={selectedLiveMarketMeta.displayName}
                                className="h-full w-full object-cover opacity-80"
                              />
                            </div>
                            <div className="p-3">
                              <div className="text-xs uppercase tracking-wide text-slate-500">Selected Market</div>
                              <div className="mt-1 text-sm font-medium text-slate-900">
                                {selectedLiveMarketMeta.displayName}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">ID: {selectedLiveMarket.id}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                          3. Select Strategy
                        </h3>
                        <span className="text-xs text-slate-500">{strategies.length} available</span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {strategies.map((strategy) => (
                          <button
                            key={strategy.key}
                            onClick={() => setSelectedStrategy(strategy.key)}
                            className={`rounded-xl border-2 p-3 text-left transition ${
                              selectedStrategy === strategy.key
                                ? "border-blue-500 bg-blue-50 text-blue-900"
                                : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                            }`}
                          >
                            <div className="font-medium">{strategy.name}</div>
                            <div className="mt-1 text-xs text-gray-600">{strategy.description}</div>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
                        4. Configure Parameters
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {selectedStrategy === "momentum" && (
                          <>
                            <div>
                              <label className="text-sm text-gray-700">Buy Threshold</label>
                              <input
                                type="number"
                                step="0.001"
                                value={params.buyThreshold}
                                onChange={(e) =>
                                  setParams({ ...params, buyThreshold: parseFloat(e.target.value) })
                                }
                                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-gray-700">Sell Threshold</label>
                              <input
                                type="number"
                                step="0.001"
                                value={params.sellThreshold}
                                onChange={(e) =>
                                  setParams({ ...params, sellThreshold: parseFloat(e.target.value) })
                                }
                                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </>
                        )}

                        {selectedStrategy === "meanReversion" && (
                          <>
                            <div>
                              <label className="text-sm text-gray-700">Period (lookback)</label>
                              <input
                                type="number"
                                value={params.period || 20}
                                onChange={(e) =>
                                  setParams({ ...params, period: parseInt(e.target.value) })
                                }
                                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-gray-700">Buy Threshold (percentile)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={params.meanReversionBuyThreshold ?? params.buyThreshold}
                                onChange={(e) =>
                                  setParams({
                                    ...params,
                                    buyThreshold: parseFloat(e.target.value),
                                    meanReversionBuyThreshold: parseFloat(e.target.value),
                                  })
                                }
                                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-gray-700">Sell Threshold (percentile)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={params.meanReversionSellThreshold ?? params.sellThreshold}
                                onChange={(e) =>
                                  setParams({
                                    ...params,
                                    sellThreshold: parseFloat(e.target.value),
                                    meanReversionSellThreshold: parseFloat(e.target.value),
                                  })
                                }
                                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </>
                        )}

                        {selectedStrategy === "volatility" && (
                          <div>
                            <label className="text-sm text-gray-700">Volatility Threshold</label>
                            <input
                              type="number"
                              step="0.001"
                                value={params.spreadThreshold ?? 0.01}
                              onChange={(e) =>
                                setParams({ ...params, spreadThreshold: parseFloat(e.target.value) })
                              }
                              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-sm text-gray-700">Position Size (capital)</label>
                          <input
                            type="number"
                            value={params.positionSize}
                            onChange={(e) =>
                              setParams({ ...params, positionSize: parseInt(e.target.value) })
                            }
                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </section>
                  </div>

                  <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Run Summary</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Market Group</div>
                        <div className="font-medium text-slate-900">
                          {selectedGroupDetails?.name || "Not selected"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedGroupDetails ? `${selectedGroupDetails.markets.length} markets` : "-"}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Polymarket Market</div>
                        <div className="font-medium text-slate-900">
                          {selectedLiveMarketMeta ? selectedLiveMarketMeta.displayName : "Not selected"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedLiveMarket ? `ID: ${selectedLiveMarket.id}` : "-"}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Strategy</div>
                        <div className="font-medium text-slate-900">
                          {selectedStrategyDetails?.name || selectedStrategy}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedStrategyDetails?.description || "-"}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">Capital Setup</div>
                        <div className="font-medium text-slate-900">
                          Position size: ${Number(params.positionSize || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500">
                          Starting capital: ${Number((params.positionSize || 0) * 10).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={runBacktest}
                      disabled={running || !selectedGroup || !selectedMarketId}
                      className="mt-6 w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {running ? "Running Backtest..." : "Run Backtest"}
                    </button>

                    <p className="mt-3 text-xs text-slate-500">
                      Tip: After execution, switch to Results to review the latest records.
                    </p>
                  </aside>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
