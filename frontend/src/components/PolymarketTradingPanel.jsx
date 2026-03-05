import { useState, useEffect } from "react"
import { getAccountBalance } from "../services/portfolio"

export default function PolymarketTradingPanel({ market, onClose, onTrade }) {
  const [selectedOutcome, setSelectedOutcome] = useState("")
  const [shares, setShares] = useState(1)
  const [availableCash, setAvailableCash] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Get selected outcome price
  const getOutcomePrice = () => {
    if (!selectedOutcome || !market.outcomes || !market.outcomePrices) return 0
    const index = market.outcomes.indexOf(selectedOutcome)
    if (index === -1) return 0
    return parseFloat(market.outcomePrices[index]) || 0
  }

  const price = getOutcomePrice()
  const totalCost = (price * shares).toFixed(2)
  const potentialReturn = shares.toFixed(2)
  const potentialProfit = (shares - totalCost).toFixed(2)

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

  // Set default outcome
  useEffect(() => {
    if (market.outcomes && market.outcomes.length > 0 && !selectedOutcome) {
      setSelectedOutcome(market.outcomes[0])
    }
  }, [market, selectedOutcome])

  useEffect(() => {
    setError("")
  }, [selectedOutcome, shares])

  const handleTrade = async () => {
    // Validate outcome selection
    if (!selectedOutcome) {
      setError("Please select an outcome")
      return
    }

    // Validate shares
    const sharesValue = parseFloat(shares)
    if (isNaN(sharesValue) || sharesValue <= 0) {
      setError("Shares must be a positive number")
      return
    }

    // Validate funds
    if (parseFloat(totalCost) > availableCash) {
      setError(`Insufficient funds. Cost: $${totalCost}, Available: $${availableCash.toFixed(2)}`)
      return
    }

    try {
      setLoading(true)
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
      onClose()
      if (onTrade) onTrade()
    } catch (err) {
      console.error("Failed to execute trade:", err)
      setError(err.message || "Failed to execute trade")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Place Bet</h2>
            <p className="text-sm text-gray-600 line-clamp-2">{market.question}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Outcome Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Outcome
            </label>
            <div className="space-y-2">
              {market.outcomes && market.outcomes.map((outcome, index) => {
                const outcomePrice = parseFloat(market.outcomePrices[index]) || 0
                const probability = (outcomePrice * 100).toFixed(1)
                const isSelected = selectedOutcome === outcome

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedOutcome(outcome)}
                    className={`w-full p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div
                          className={`w-4 h-4 rounded-full mr-3 border-2 ${
                            isSelected
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-gray-900">{outcome}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-blue-600">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Shares
            </label>
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              min="1"
              step="1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter shares"
            />
            <p className="mt-1 text-xs text-gray-500">
              Each share pays $1.00 if your prediction is correct
            </p>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Select
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setShares(Math.floor(amount / price))}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Price per share:</span>
              <span className="font-medium text-gray-900">${price.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Shares:</span>
              <span className="font-medium text-gray-900">{shares}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-600">Total Cost:</span>
              <span className="font-bold text-gray-900">${totalCost}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Potential Return:</span>
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
          <div className="flex justify-between items-center py-2 border-t border-gray-200">
            <span className="text-sm text-gray-600">Available Balance:</span>
            <span className="text-lg font-bold text-gray-900">
              ${availableCash.toFixed(2)}
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">How it works:</p>
                <p>
                  Each share costs ${price.toFixed(3)} and pays $1.00 if your prediction is
                  correct. Your potential profit is ${potentialProfit} if you win.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleTrade}
            disabled={loading || !selectedOutcome}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? "Processing..." : `Place Bet - $${totalCost}`}
          </button>
        </div>
      </div>
    </div>
  )
}
