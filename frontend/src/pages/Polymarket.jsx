import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import PolymarketCard from "../components/PolymarketCard"

const getDiscordInviteUrl = (rawUrl) => {
  if (!rawUrl) return ""

  try {
    const parsedUrl = new URL(rawUrl.trim())
    const host = parsedUrl.hostname.toLowerCase()
    const path = parsedUrl.pathname.toLowerCase()

    const isInviteHost = host === "discord.gg"
    const isInvitePath =
      (host === "discord.com" || host === "www.discord.com" || host === "discordapp.com") &&
      path.startsWith("/invite/")

    return isInviteHost || isInvitePath ? parsedUrl.toString() : ""
  } catch {
    return ""
  }
}

const parseMarketNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatCompactCurrency = (value) => {
  const amount = parseMarketNumber(value)

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: amount >= 1000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 1000 ? 1 : 0,
  }).format(amount)
}

const getLeadingOutcome = (market) => {
  if (!Array.isArray(market.outcomes) || !Array.isArray(market.outcomePrices)) {
    return null
  }

  const prices = market.outcomePrices.map((price) => parseMarketNumber(price))
  if (prices.length === 0) return null

  const highestProbability = Math.max(...prices)
  const highestIndex = prices.indexOf(highestProbability)

  return {
    name: market.outcomes[highestIndex] || "Leading",
    probability: highestProbability * 100,
  }
}

const getTrendingScore = (market) => {
  const volume = parseMarketNumber(market.volume)
  const liquidity = parseMarketNumber(market.liquidity)
  const leadingOutcome = getLeadingOutcome(market)
  const balanceScore = leadingOutcome
    ? Math.max(0, 1 - Math.abs(leadingOutcome.probability - 50) / 50)
    : 0

  return volume * 0.65 + liquidity * 0.25 + balanceScore * 150000
}

const leaderboardSections = [
  {
    key: "ranking",
    title: "Ranking",
    description: "Highest-volume markets right now",
    accent: "from-blue-600 via-cyan-500 to-sky-400",
    metricLabel: "Volume",
    rankPrefix: "#",
    getValue: (market) => parseMarketNumber(market.volume),
    formatValue: (market) => formatCompactCurrency(market.volume),
  },
  {
    key: "trending",
    title: "Trending",
    description: "Activity weighted by volume, liquidity, and tight odds",
    accent: "from-orange-500 via-amber-500 to-yellow-400",
    metricLabel: "Heat",
    rankPrefix: "T",
    getValue: (market) => getTrendingScore(market),
    formatValue: (market) => `${Math.round(getTrendingScore(market) / 1000).toLocaleString()} pts`,
  },
]

export default function Polymarket() {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState("all") // all, crypto, politics, sports, tech, finance, entertainment
  const [searchQuery, setSearchQuery] = useState("")
  const [dataSource, setDataSource] = useState(null)
  const [focusedMarketId, setFocusedMarketId] = useState(null)
  const discordInviteUrl = getDiscordInviteUrl(import.meta.env.VITE_DISCORD_INVITE_URL)

  useEffect(() => {
    fetchMarkets()
  }, [])

  // Detect market category based on keywords
  const detectCategory = (question, description) => {
    const text = `${question || ""} ${description || ""}`.toLowerCase()
    
    // Entertainment - check first to avoid "market" in "box office market"
    if (text.match(/movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress/)) return "entertainment"
    
    // Crypto
    if (text.match(/bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/)) return "crypto"
    
    // Politics
    if (text.match(/election|president|presidential|政治|vote|voting|congress|senate|政府|political|government|campaign/)) return "politics"
    
    // Sports
    if (text.match(/sport|football|basketball|soccer|nba|nfl|championship|tennis|premier league|lakers|olympics|world cup|fifa|baseball|hockey/)) return "sports"
    
    // Tech
    if (text.match(/\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/)) return "tech"
    
    // Finance
    if (text.match(/stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/)) return "finance"
    
    // Everything else
    return "other"
  }

  // Filter and search markets
  const filteredMarkets = markets.filter((market) => {
    // Search filter
    const matchesSearch = 
      searchQuery === "" ||
      market.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      market.description?.toLowerCase().includes(searchQuery.toLowerCase())

    // Category filter
    const detectedCategory = detectCategory(market.question, market.description)
    const matchesCategory = 
      category === "all" ||
      detectedCategory === category

    return matchesSearch && matchesCategory
  })

  const leaderboardMarkets = leaderboardSections.map((section) => ({
    ...section,
    markets: [...filteredMarkets]
      .sort((firstMarket, secondMarket) => section.getValue(secondMarket) - section.getValue(firstMarket))
      .slice(0, 5),
  }))

  const fetchMarkets = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = localStorage.getItem("token")
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/polymarket/markets`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error("Failed to fetch markets")
      }

      const data = await response.json()
      setMarkets(data.markets || [])
      setDataSource(data.source || 'unknown')
      
      // Log data source info
      if (data.source === 'mock-data') {
        console.log('ℹ️ Using mock data:', data.note || data.reason)
      } else {
        console.log('✅ Using real Polymarket API data')
      }
    } catch (err) {
      console.error("Error fetching markets:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinDiscord = () => {
    if (!discordInviteUrl) return
    window.open(discordInviteUrl, "_blank", "noopener,noreferrer")
  }

  const handleLeaderboardMarketClick = (marketId) => {
    const targetCard = document.getElementById(`market-card-${marketId}`)
    if (!targetCard) return

    targetCard.scrollIntoView({ behavior: "smooth", block: "center" })
    setFocusedMarketId(marketId)

    window.setTimeout(() => {
      setFocusedMarketId((currentFocusedMarketId) =>
        currentFocusedMarketId === marketId ? null : currentFocusedMarketId
      )
    }, 1800)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Polymarket Prediction Markets
            </h1>
            <p className="text-gray-600">
              Explore and bet on real-world events
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <Link
              to="/polymarket/archive"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              Open Archive Health
            </Link>
            <button
              onClick={handleJoinDiscord}
              disabled={!discordInviteUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              title={discordInviteUrl ? "Join Discord for live notifications" : "Set VITE_DISCORD_INVITE_URL to a Discord invite link"}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.317 4.369A19.791 19.791 0 0 0 15.885 3c-.191.328-.404.768-.553 1.11a18.27 18.27 0 0 0-5.44 0A11.64 11.64 0 0 0 9.339 3a19.736 19.736 0 0 0-4.434 1.371C2.098 8.532 1.337 12.59 1.71 16.591a19.935 19.935 0 0 0 5.992 3.032 14.08 14.08 0 0 0 1.283-2.093 12.96 12.96 0 0 1-2.017-.964c.169-.121.334-.248.495-.38 3.887 1.824 8.105 1.824 11.946 0 .162.133.327.26.495.38a12.97 12.97 0 0 1-2.021.966c.36.743.79 1.442 1.284 2.091a19.905 19.905 0 0 0 5.994-3.03c.437-4.64-.76-8.66-3.849-12.224zM8.02 14.223c-1.182 0-2.154-1.085-2.154-2.422 0-1.337.951-2.422 2.154-2.422 1.211 0 2.175 1.095 2.154 2.422 0 1.337-.951 2.422-2.154 2.422zm7.974 0c-1.183 0-2.154-1.085-2.154-2.422 0-1.337.95-2.422 2.154-2.422 1.21 0 2.174 1.095 2.154 2.422 0 1.337-.944 2.422-2.154 2.422z" />
              </svg>
              Join Discord
            </button>
            {!discordInviteUrl && (
              <p className="text-xs text-gray-500">Add a Discord invite URL like https://discord.gg/your-invite-code to enable this button</p>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search markets by question or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Ranking + Trending */}
        {!loading && !error && filteredMarkets.length > 0 && (
          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {leaderboardMarkets.map((section) => (
              <section
                key={section.key}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              >
                <div className={`bg-gradient-to-r ${section.accent} px-5 py-4 text-white`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">{section.title}</h2>
                      <p className="text-sm text-white/80">{section.description}</p>
                    </div>
                    <div className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                      Top 5
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {section.markets.map((market, index) => {
                    const leadingOutcome = getLeadingOutcome(market)

                    return (
                      <button
                        type="button"
                        key={`${section.key}-${market.id}`}
                        onClick={() => handleLeaderboardMarketClick(market.id)}
                        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white">
                          {section.rankPrefix}{index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 line-clamp-2 text-sm font-semibold text-gray-900">
                            {market.question}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span>{section.metricLabel}: {section.formatValue(market)}</span>
                            <span>Liquidity: {formatCompactCurrency(market.liquidity)}</span>
                            {leadingOutcome && (
                              <span>
                                Leading: {leadingOutcome.name} {leadingOutcome.probability.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Category Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "all", label: "All Categories"},
            { id: "crypto", label: "Crypto"},
            { id: "politics", label: "Politics" },
            { id: "sports", label: "Sports" },
            { id: "tech", label: "Technology" },
            { id: "finance", label: "Finance" },
            { id: "entertainment", label: "Entertainment" },
            { id: "other", label: "Other" }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-full font-medium transition-all ${
                category === cat.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-300 hover:border-blue-500 hover:text-blue-600"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Showing</div>
            <div className="text-2xl font-bold text-gray-900">{filteredMarkets.length}</div>
            <div className="text-xs text-gray-500 mt-1">of {markets.length} markets</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Volume</div>
            <div className="text-2xl font-bold text-gray-900">
              ${filteredMarkets.reduce((sum, m) => {
                const volume = parseFloat(m.volume) || 0
                return sum + volume
              }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Active Markets</div>
            <div className="text-2xl font-bold text-gray-900">
              {filteredMarkets.filter(m => m.active).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Category</div>
            <div className="text-lg font-bold text-blue-600 capitalize">
              {category === "all" ? "All" : category}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error loading markets</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Markets Grid */}
        {!loading && !error && (
          <div>
            {filteredMarkets.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg mb-2">No markets found</p>
                <p className="text-gray-400 text-sm">
                  {searchQuery
                    ? "Try adjusting your search query or filters"
                    : "Try selecting a different category"}
                </p>
                {(searchQuery || category !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setCategory("all")
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarkets.map((market) => (
                  <div
                    key={market.id}
                    id={`market-card-${market.id}`}
                    className={`rounded-xl transition-all duration-300 ${
                      focusedMarketId === market.id
                        ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-50"
                        : ""
                    }`}
                  >
                    <PolymarketCard market={market} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Refresh Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={fetchMarkets}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Loading..." : "Refresh Markets"}
          </button>
        </div>
      </main>
    </div>
  )
}
