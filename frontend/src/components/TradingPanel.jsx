import { useState } from "react"

export default function TradingPanel({ stock, onClose, onTrade }) {
  const [direction, setDirection] = useState("Buy")
  const [orderType, setOrderType] = useState("Limit")
  const [price, setPrice] = useState(stock?.price || 0)
  const [quantity, setQuantity] = useState(1)
  const [session, setSession] = useState("RTH+Pre/Post-Mkt")
  const [timeInForce, setTimeInForce] = useState("Day")

  const amount = (price * quantity).toFixed(2)

  const handleTrade = () => {
    onTrade({
      symbol: stock.symbol,
      direction,
      orderType,
      price,
      quantity,
      amount,
      session,
      timeInForce
    })
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
                className={`flex-1 py-2 rounded-lg font-semibold transition ${
                  direction === "Sell"
                    ? "bg-red-500 text-white"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                Sell
              </button>
            </div>
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
                onChange={(e) => setPrice(Number(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                step="0.01"
              />
              <button
                onClick={() => setPrice(price - 1)}
                className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                −
              </button>
              <button
                onClick={() => setPrice(price + 1)}
                className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-2">Quantity</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
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
          <button
            onClick={handleTrade}
            className={`w-full py-3 rounded-lg font-bold text-white text-lg transition ${
              direction === "Buy"
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {direction} {stock.symbol}
          </button>
        </div>
      </div>
    </div>
  )
}
