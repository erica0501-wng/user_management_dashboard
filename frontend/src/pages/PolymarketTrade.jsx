import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import { getAccountBalance } from "../services/portfolio"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function PolymarketTrade() {
  const { marketId } = useParams()
  const navigate = useNavigate()
  const [market, setMarket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedOutcome, setSelectedOutcome] = useState("")
  const [shares, setShares] = useState(1)
  const [availableCash, setAvailableCash] = useState(0)
  const [error, setError] = useState("")
  const [tradeLoading, setTradeLoading] = useState(false)
  const [chartData, setChartData] = useState([])

  // Fetch market data
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem("token")
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

        const response = await fetch(`${apiUrl}/polymarket/markets`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        const data = await response.json()
        const foundMarket = data.markets?.find(m => m.id === marketId)

        if (foundMarket) {
          setMarket(foundMarket)
          if (foundMarket.outcomes && foundMarket.outcomes.length > 0) {
            setSelectedOutcome(foundMarket.outcomes[0])
          }
          
          // Generate mock historical data for the chart
          generateChartData(foundMarket)
        } else {
          setError("Market not found")
        }
      } catch (err) {
        console.error("Error fetching market:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMarket()
  }, [marketId])

  // Generate chart data (mock historical probability data)
  const generateChartData = (market) => {
    if (!market.outcomes || !market.outcomePrices) return

    const currentProb = parseFloat(market.outcomePrices[0]) * 100
    const data = []
    const days = 90 // 3 months of data
    
    for (let i = days; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      // Generate realistic probability fluctuation
      const variance = 15
      const trend = (days - i) / days * (currentProb - 50) // Trend toward current value
      const randomWalk = (Math.random() - 0.5) * variance
      let prob = 50 + trend + randomWalk
      
      // Keep within bounds
      prob = Math.max(5, Math.min(95, prob))
      
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        probability: parseFloat(prob.toFixed(1)),
        fullDate: date
      })
    }

    setChartData(data)
  }

  // Load user balance
  useEffect(() => {
    const loadBalance = async () => {
      try {
        const balance = await getAccountBalance()
        setAvailableCash(balance.availableCash || 0)
      } catch (err) {
        console.error("Failed to load balance:", err)
      }
    }
    loadBalance()
  }, [])

  // Get selected outcome price
  const getOutcomePrice = () => {
    if (!selectedOutcome || !market?.outcomes || !market?.outcomePrices) return 0
    const index = market.outcomes.indexOf(selectedOutcome)
    if (index === -1) return 0
    return parseFloat(market.outcomePrices[index]) || 0
  }

  const price = getOutcomePrice()
  const sharesNum = parseFloat(shares) || 0
  const totalCost = (price * sharesNum).toFixed(2)
  const potentialReturn = sharesNum.toFixed(2)
  const potentialProfit = (sharesNum - totalCost).toFixed(2)

  const handleTrade = async () => {
    if (!selectedOutcome) {
      setError("Please select an outcome")
      return
    }

    const sharesValue = parseFloat(shares)
    if (isNaN(sharesValue) || sharesValue <= 0) {
      setError("Shares must be a positive number")
      return
    }

    if (parseFloat(totalCost) > availableCash) {
      setError(`Insufficient funds. Cost: $${totalCost}, Available: $${availableCash.toFixed(2)}`)
      return
    }

    try {
      setTradeLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/polymarket/trade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          marketId: market.id,
          question: market.question,
          outcome: selectedOutcome,
          shares: sharesValue,
          price: price
        })
      })

      // Read response body once
      const contentType = response.headers.get("content-type")
      let data
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json()
      } else {
        // If not JSON, read as text (probably HTML error page)
        const text = await response.text()
        throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`)
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`)
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to execute trade")
      }

      alert(`Trade successful! ${data.message}`)
      navigate("/polymarket")
    } catch (err) {
      console.error("Failed to execute trade:", err)
      setError(err.message || "Failed to execute trade")
    } finally {
      setTradeLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </main>
      </div>
    )
  }

  if (error && !market) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
          <button
            onClick={() => navigate("/polymarket")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Markets
          </button>
        </main>
      </div>
    )
  }

  const leadingOutcome = market?.outcomes && market?.outcomePrices ? 
    (() => {
      const prices = market.outcomePrices.map(p => parseFloat(p))
      const maxPrice = Math.max(...prices)
      const maxIndex = prices.indexOf(maxPrice)
      return {
        outcome: market.outcomes[maxIndex],
        probability: (maxPrice * 100).toFixed(1)
      }
    })() : null

  const marketHeroImage = market?.image || `https://via.placeholder.com/1200x400.png?text=${encodeURIComponent(market?.question || "Polymarket Market")}`

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <button
            onClick={() => navigate("/polymarket")}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-3"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Markets
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{market?.question}</h1>
          {market?.description && (
            <p className="text-gray-600 mt-2">{market.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-8">
          {/* Left Column - Chart and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Market Hero */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-slate-900 text-white shadow-sm">
              <div className="relative h-56">
                <img
                  src={marketHeroImage}
                  alt={market?.question || "Polymarket market"}
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent" />
                <div className="relative flex h-full items-end p-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/70">
                      <span>Polymarket</span>
                      <span>•</span>
                      <span>{market?.active ? "Live" : "Closed"}</span>
                      {market?.endDate ? (
                        <>
                          <span>•</span>
                          <span>{new Date(market.endDate).toLocaleDateString()}</span>
                        </>
                      ) : null}
                    </div>
                    <h2 className="mt-2 text-3xl font-bold leading-tight">{market?.question}</h2>
                    {market?.description && (
                      <p className="mt-2 max-w-3xl text-sm text-white/80">{market.description}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Probability Display */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-sm text-gray-600">Leading Outcome:</span>
                <span className="text-xl font-bold text-blue-600">
                  {leadingOutcome?.outcome}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-900">
                  {leadingOutcome?.probability}%
                </span>
                <span className="text-sm text-green-600">chance</span>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Probability History</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    label={{ value: '%', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                    formatter={(value) => [`${value}%`, 'Probability']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="probability" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Market Stats */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Volume</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${parseFloat(market?.volume || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Liquidity</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${parseFloat(market?.liquidity || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">End Date</div>
                  <div className="text-sm font-medium text-gray-900">
                    {market?.endDate ? new Date(market.endDate).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Status</div>
                  <div>
                    {market?.active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Closed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* All Outcomes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Outcomes</h3>
              <div className="space-y-3">
                {market?.outcomes && market?.outcomePrices && 
                 market.outcomes.map((outcome, index) => {
                  const probability = (parseFloat(market.outcomePrices[index]) * 100).toFixed(1)
                  return (
                    <div key={index} className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{outcome}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${probability}%` }}
                          />
                        </div>
                        <span className="text-lg font-bold text-blue-600 w-16 text-right">
                          {probability}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Trading Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Place Your Bet</h2>

              {/* Outcome Selection */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Outcome
                </label>
                <div className="space-y-2">
                  {market?.outcomes && market?.outcomes.map((outcome, index) => {
                    const outcomePrice = parseFloat(market.outcomePrices[index]) || 0
                    const probability = (outcomePrice * 100).toFixed(1)
                    const isSelected = selectedOutcome === outcome

                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedOutcome(outcome)}
                        className={`w-full p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-900">{outcome}</span>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">
                              {probability}%
                            </div>
                            <div className="text-xs text-gray-500">
                              ${outcomePrice.toFixed(3)}/share
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Shares Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shares
                </label>
                <input
                  type="number"
                  value={shares}
                  onChange={(e) => setShares(parseFloat(e.target.value) || 1)}
                  min="1"
                  step="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="mb-5">
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: '+$1', amount: 1 },
                    { label: '+$5', amount: 5 },
                    { label: '+$10', amount: 10 },
                    { label: '+$100', amount: 100 },
                    { label: 'Max', amount: availableCash }
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() => {
                        const newShares = btn.label === 'Max' 
                          ? Math.floor(availableCash / price)
                          : Math.floor(btn.amount / price)
                        setShares(Math.max(1, newShares))
                      }}
                      className="px-2 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs font-medium text-gray-700 transition-colors"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cost per share:</span>
                  <span className="font-medium text-gray-900">${price.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shares:</span>
                  <span className="font-medium text-gray-900">{shares}</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
                  <span className="text-gray-900">Total Cost:</span>
                  <span className="text-gray-900">${totalCost}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Potential Win:</span>
                  <span className="font-medium text-green-600">${potentialReturn}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Potential Profit:</span>
                  <span className={`font-medium ${parseFloat(potentialProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${potentialProfit}
                  </span>
                </div>
              </div>

              {/* Available Balance */}
              <div className="mb-5 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Available Balance:</span>
                  <span className="text-lg font-bold text-gray-900">
                    ${availableCash.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              {/* Trade Button */}
              <button
                onClick={handleTrade}
                disabled={tradeLoading || !selectedOutcome}
                className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
              >
                {tradeLoading ? "Processing..." : `Place Bet - $${totalCost}`}
              </button>

              {/* Info */}
              <p className="text-xs text-gray-500 mt-4 text-center">
                Each share pays $1.00 if your prediction is correct
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
