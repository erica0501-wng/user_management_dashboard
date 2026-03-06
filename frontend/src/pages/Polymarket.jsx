import { useState, useEffect } from "react"
import Sidebar from "../components/Sidebar"
import PolymarketCard from "../components/PolymarketCard"

export default function Polymarket() {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState("all") // all, crypto, politics, sports, tech, finance, entertainment
  const [searchQuery, setSearchQuery] = useState("")
  const [dataSource, setDataSource] = useState(null)

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Polymarket Prediction Markets
          </h1>
          <p className="text-gray-600">
            Explore and bet on real-world events
          </p>
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
                  <PolymarketCard key={market.id} market={market} />
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
