import { useState, useEffect } from "react"
import { createOrder, getHoldingsBySymbol } from "../services/portfolio"

export default function TradingPanel({ stock, onClose, onTrade }) {
  const [direction, setDirection] = useState("Buy")
  const [orderType, setOrderType] = useState("Limit")
  const [price, setPrice] = useState(stock?.price || 0)
  const [quantity, setQuantity] = useState(1)
  const [session, setSession] = useState("RTH+Pre/Post-Mkt")
  const [timeInForce, setTimeInForce] = useState("Day")
  const [holdings, setHoldings] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Calculate holdings for the stock
  useEffect(() => {
    const loadHoldings = async () => {
      if (!stock) return
      
      try {
        const holding = await getHoldingsBySymbol(stock.symbol)
        setHoldings(holding.quantity || 0)
      } catch (err) {
        console.error('Failed to load holdings:', err)
        setHoldings(0)
      }
    }
    
    loadHoldings()
  }, [stock])

  useEffect(() => {
    setError("")
  }, [direction, quantity])

  const amount = (price * quantity).toFixed(2)

  const handleTrade = async () => {
    // Validate price
    const priceValue = parseFloat(price)
    if (isNaN(priceValue) || priceValue <= 0) {
      setError("Price must be a positive number")
      return
    }

    // Validate quantity
    const quantityValue = parseInt(quantity)
    if (isNaN(quantityValue) || quantityValue <= 0) {
      setError("Quantity must be a positive number")
      return
    }

    // Validate sell order - check holdings
    if (direction === "Sell") {
      if (holdings <= 0) {
        setError(`You don't own any shares of ${stock.symbol}. You must buy before selling.`)
        return
      }
      if (quantityValue > holdings) {
        setError(`Insufficient shares. You only have ${holdings} shares but trying to sell ${quantityValue}.`)
        return
      }
    }

    try {
      setLoading(true)
      setError("")
      
      await createOrder({
        symbol: stock.symbol,
        name: stock.name,
        direction,
        price: priceValue,
        quantity: quantityValue,
        orderType,
        session
      })
      
      alert(`${direction} order placed for ${quantityValue} shares of ${stock.symbol}`)
      onClose()
      if (onTrade) onTrade()
    } catch (err) {
      console.error('Failed to create order:', err)
      setError(err.message || 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-200 bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800">Trade</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Trading Form */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Symbol */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Symbol</label>
            <input
              type="text"
              value={stock.symbol}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 font-semibold"
            />
          </div>

          {/* Direction - Buy/Sell */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Direction</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection("Buy")}
                className={`flex-1 py-2 rounded-lg font-semibold transition ${
                  direction === "Buy"
                    ? "bg-green-500 text-white"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setDirection("Sell")}
                disabled={holdings <= 0}
                className={`flex-1 py-2 rounded-lg font-semibold transition ${
                  direction === "Sell"
                    ? "bg-red-500 text-white"
                    : "bg-white text-gray-600 border border-gray-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Sell
              </button>
            </div>
            {holdings <= 0 && (
              <p className="text-xs text-red-500 mt-1">No shares to sell</p>
            )}
          </div>

          {/* Session */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Session</label>
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option>RTH+Pre/Post-Mkt</option>
              <option>Regular Hours</option>
              <option>Extended Hours</option>
            </select>
          </div>

          {/* Order Type */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option>Limit</option>
              <option>Market</option>
              <option>Stop</option>
              <option>Stop Limit</option>
            </select>
          </div>

          {/* Price */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Price</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={price}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || parseFloat(value) >= 0) {
                    setPrice(value)
                  }
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value)
                  if (!isNaN(value) && value > 0) {
                    setPrice(value)
                  } else {
                    setPrice(stock?.price || 0)
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                step="0.01"
                min="0.01"
              />
              <button
                onClick={() => {
                  const newPrice = Math.max(0.01, parseFloat(price) - 1)
                  setPrice(newPrice)
                }}
                className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                −
              </button>
              <button
                onClick={() => {
                  const newPrice = parseFloat(price) + 1
                  setPrice(newPrice)
                }}
                className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Quantity
              {direction === "Sell" && holdings > 0 && (
                <span className="ml-2 text-xs text-gray-500">(Available: {holdings})</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={quantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  if (!isNaN(value) && value > 0) {
                    setQuantity(value)
                  } else if (e.target.value === '') {
                    setQuantity('')
                  }
                }}
                onBlur={(e) => {
                  const value = parseInt(e.target.value)
                  if (isNaN(value) || value < 1) {
                    setQuantity(1)
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                min="1"
              />
              <button
                onClick={() => quantity > 1 && setQuantity(quantity - 1)}
                className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                −
              </button>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Amount</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-semibold">
              {amount} USD
            </div>
          </div>

          {/* Time-in-Force */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Time-in-Force</label>
            <select
              value={timeInForce}
              onChange={(e) => setTimeInForce(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option>Day</option>
              <option>GTC</option>
              <option>IOC</option>
              <option>FOK</option>
            </select>
          </div>

          {/* Buy/Sell Button */}
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
          <button
            onClick={handleTrade}
            disabled={(direction === "Sell" && holdings <= 0) || loading}
            className={`w-full py-3 rounded-lg font-bold text-white text-lg transition ${
              direction === "Buy"
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
            } disabled:bg-gray-400 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Processing...
              </span>
            ) : direction === "Sell" && holdings <= 0 ? (
              `No ${stock.symbol} to Sell`
            ) : (
              `${direction} ${stock.symbol}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
