import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, TrendingUp, DollarSign, Calendar, Activity } from "lucide-react"
import Sidebar from "../components/Sidebar"
import AlertManager from "../components/AlertManager"
import OrderBook from "../components/OrderBook"

export default function MarketDetails() {
  const { marketId } = useParams()
  const navigate = useNavigate()
  const [market, setMarket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchMarketDetails()
  }, [marketId])

  const fetchMarketDetails = async () => {
    try {
      setLoading(true)
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"
      
      // First try to get from markets endpoint
      const response = await fetch(`${apiUrl}/polymarket/markets`)
      
      if (!response.ok) throw new Error("Failed to fetch market")

      const data = await response.json()
      const foundMarket = data.markets.find(m => m.id === marketId)
      
      if (!foundMarket) {
        throw new Error("Market not found")
      }

      setMarket(foundMarket)
      
      // Log market data for debugging
      console.log('📊 Market loaded:', {
        id: foundMarket.id,
        question: foundMarket.question,
        hasTokens: !!foundMarket.tokens,
        tokensCount: foundMarket.tokens?.length || 0,
        firstToken: foundMarket.tokens?.[0]
      })
    } catch (err) {
      setError(err.message)
      console.error("Error fetching market:", err)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (value) => {
    if (!value) return "$0"
    const num = parseFloat(value)
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`
    }
    return `$${num.toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-500">Loading market details...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !market) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="text-red-600 mb-4">{error || "Market not found"}</div>
              <button
                onClick={() => navigate("/polymarket")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Back to Markets
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/polymarket")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Markets</span>
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {market.question}
          </h1>
          {market.description && (
            <p className="text-gray-600 text-base leading-relaxed">{market.description}</p>
          )}
        </div>

        {/* Market Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-sm text-gray-500">Volume</div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatMoney(market.volume)}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-sm text-gray-500">Liquidity</div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatMoney(market.liquidity)}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-sm text-gray-500">End Date</div>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {market.endDate
                ? new Date(market.endDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })
                : "N/A"}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Activity className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-sm text-gray-500">Status</div>
            </div>
            <div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  market.active
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {market.active ? "Active" : "Closed"}
              </span>
            </div>
          </div>
        </div>

        {/* Current Prices Section */}
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Current Prices</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {market.outcomes &&
              market.outcomePrices &&
              market.outcomes.map((outcome, index) => (
                <div
                  key={outcome}
                  className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-200 hover:border-blue-400 transition"
                >
                  <div className="text-sm text-gray-600 font-medium mb-2">
                    {outcome}
                  </div>
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {(parseFloat(market.outcomePrices[index]) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    ${parseFloat(market.outcomePrices[index]).toFixed(3)} per share
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Alerts and Order Book Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Alerts Section */}
          <div className="h-fit">
            <AlertManager
              marketId={market.id}
              question={market.question}
              outcomes={market.outcomes}
              currentPrices={market.outcomePrices}
            />
          </div>

          {/* Order Book Section */}
          <div className="h-fit">
            <OrderBook
              marketId={market.id}
              tokenId={
                market.tokens && market.tokens.length > 0
                  ? market.tokens[0].tokenId
                  : null
              }
              outcome={
                market.outcomes && market.outcomes.length > 0
                  ? market.outcomes[0]
                  : null
              }
            />
          </div>
        </div>

        {/* Trade Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => navigate(`/polymarket/trade/${market.id}`)}
            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
          >
            Trade on this Market
          </button>
        </div>
      </main>
    </div>
  )
}
