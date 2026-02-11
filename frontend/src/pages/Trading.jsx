import { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import StockDetail from "../components/StockDetail"
import { createOrder, getHoldingsBySymbol } from "../services/portfolio"

export default function Trading() {
  const location = useLocation()
  const navigate = useNavigate()
  const stockData = location.state?.stock

  const [tradeDirection, setTradeDirection] = useState("Buy")
  const [tradePrice, setTradePrice] = useState(stockData?.price || "")
  const [tradeQuantity, setTradeQuantity] = useState(1)
  const [orderType, setOrderType] = useState("Limit")
  const [session, setSession] = useState("RTH++Pre/Post-Mkt")
  const [timeInForce, setTimeInForce] = useState("Day")
  const [holdings, setHoldings] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (stockData?.price) {
      setTradePrice(stockData.price.toFixed(2))
    }
  }, [stockData])

  // Calculate holdings for the stock
  useEffect(() => {
    const loadHoldings = async () => {
      if (!stockData) return
      
      try {
        const holding = await getHoldingsBySymbol(stockData.symbol)
        setHoldings(holding.quantity || 0)
      } catch (err) {
        console.error('Failed to load holdings:', err)
        setHoldings(0)
      }
    }
    
    loadHoldings()
  }, [stockData])

  const handleTrade = async () => {
    // Validate required fields
    if (!stockData || !tradePrice || !tradeQuantity) {
      alert("Please fill in all required fields")
      return
    }

    // Validate price is positive
    const price = parseFloat(tradePrice)
    if (isNaN(price) || price <= 0) {
      alert("Price must be a positive number")
      return
    }

    // Validate quantity is positive integer
    const quantity = parseInt(tradeQuantity)
    if (isNaN(quantity) || quantity <= 0) {
      alert("Quantity must be a positive number")
      return
    }

    // Validate sell order - check holdings
    if (tradeDirection === "Sell") {
      if (holdings <= 0) {
        alert(`You don't own any shares of ${stockData.symbol}. You must buy before selling.`)
        return
      }
      if (quantity > holdings) {
        alert(`Insufficient shares. You only have ${holdings} shares of ${stockData.symbol}, but trying to sell ${quantity}.`)
        return
      }
    }

    try {
      setLoading(true)
      await createOrder({
        symbol: stockData.symbol,
        name: stockData.name,
        direction: tradeDirection,
        price,
        quantity,
        orderType,
        session
      })
      
      alert(`${tradeDirection} order placed for ${quantity} shares of ${stockData.symbol}`)
      navigate("/portfolio")
    } catch (err) {
      console.error('Failed to create order:', err)
      alert(err.message || 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  if (!stockData) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="ml-64 flex-1 p-6 bg-gray-50 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-2">No stock selected</p>
            <button
              onClick={() => navigate("/")}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Go back to stocks
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 flex bg-gray-50">
        {/* Left Side - Stock Detail (60%) */}
        <div className="w-[60%] p-6 border-r border-gray-200 bg-white">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
          >
            ← Back to stocks
          </button>
          
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">{stockData.symbol}</h1>
            <p className="text-gray-600">{stockData.name}</p>
            
            <div className="flex gap-6 mt-4">
              <div>
                <p className="text-sm text-gray-500">Today's Price</p>
                <p className="text-2xl font-bold">${stockData.price?.toFixed(2)}</p>
                <p className={`text-sm ${stockData.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stockData.change >= 0 ? '↑' : '↓'} {stockData.changePercent?.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Average Price</p>
                <p className="text-xl font-semibold text-gray-700">${stockData.average?.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 h-[400px] flex items-center justify-center">
            <p className="text-gray-400">Stock Chart Placeholder</p>
          </div>

          {/* OHLC Data */}
          {stockData.historicalData && stockData.historicalData.length > 0 && (
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Open</p>
                <p className="text-lg font-semibold">${stockData.historicalData[stockData.historicalData.length - 1]?.open?.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">High</p>
                <p className="text-lg font-semibold">${stockData.historicalData[stockData.historicalData.length - 1]?.high?.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Low</p>
                <p className="text-lg font-semibold">${stockData.historicalData[stockData.historicalData.length - 1]?.low?.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Average</p>
                <p className="text-lg font-semibold">${stockData.average?.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Trading Panel (40%) */}
        <div className="w-[40%] p-6 bg-white flex flex-col">
          <h2 className="text-xl font-bold mb-4">Trade</h2>
          
          {/* Symbol Display */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
            <input
              type="text"
              value={stockData.symbol}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>

          {/* Buy/Sell Toggle */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTradeDirection("Buy")}
                className={`py-2 px-4 rounded-lg font-semibold transition ${
                  tradeDirection === "Buy"
                    ? "bg-green-500 text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeDirection("Sell")}
                className={`py-2 px-4 rounded-lg font-semibold transition ${
                  tradeDirection === "Sell"
                    ? "bg-red-500 text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Session */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Session</label>
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option>RTH++Pre/Post-Mkt</option>
              <option>Regular Trading Hours</option>
              <option>Extended Hours</option>
            </select>
          </div>

          {/* Order Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option>Limit</option>
              <option>Market</option>
              <option>Stop</option>
              <option>Stop Limit</option>
            </select>
          </div>

          {/* Price */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tradePrice}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || parseFloat(value) >= 0) {
                    setTradePrice(value)
                  }
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value)
                  if (!isNaN(value) && value > 0) {
                    setTradePrice(value.toFixed(2))
                  } else {
                    setTradePrice(stockData.price.toFixed(2))
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                step="0.01"
                min="0.01"
              />
              <button
                onClick={() => {
                  const newPrice = Math.max(0.01, parseFloat(tradePrice) - 0.01)
                  setTradePrice(newPrice.toFixed(2))
                }}
                className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                −
              </button>
              <button
                onClick={() => {
                  const newPrice = parseFloat(tradePrice) + 0.01
                  setTradePrice(newPrice.toFixed(2))
                }}
                className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
              {tradeDirection === "Sell" && holdings > 0 && (
                <span className="ml-2 text-xs text-gray-500">(Available: {holdings})</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tradeQuantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  if (!isNaN(value) && value > 0) {
                    setTradeQuantity(value)
                  } else if (e.target.value === '') {
                    setTradeQuantity('')
                  }
                }}
                onBlur={(e) => {
                  const value = parseInt(e.target.value)
                  if (isNaN(value) || value < 1) {
                    setTradeQuantity(1)
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                min="1"
              />
              <button
                onClick={() => setTradeQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                −
              </button>
              <button
                onClick={() => setTradeQuantity(q => q + 1)}
                className="w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <div className="px-4 py-2 bg-gray-50 rounded-lg font-mono text-lg">
              {(parseFloat(tradePrice || 0) * tradeQuantity).toFixed(2)} USD
            </div>
          </div>

          {/* Time-in-Force */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Time-in-Force</label>
            <select
              value={timeInForce}
              onChange={(e) => setTimeInForce(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option>Day</option>
              <option>GTC</option>
              <option>IOC</option>
              <option>FOK</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleTrade}
            disabled={(tradeDirection === "Sell" && holdings <= 0) || loading}
            className={`w-full py-3 rounded-lg font-semibold text-white transition ${
              tradeDirection === "Buy"
                ? "bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Processing...
              </span>
            ) : tradeDirection === "Sell" && holdings <= 0 ? (
              `No ${stockData.symbol} to Sell`
            ) : (
              `${tradeDirection} ${stockData.symbol}`
            )}
          </button>
          {tradeDirection === "Sell" && holdings <= 0 && (
            <p className="text-sm text-red-500 mt-2 text-center">
              You must buy {stockData.symbol} before you can sell it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
