import { X } from "lucide-react"
import AlertManager from "./AlertManager"
import OrderBook from "./OrderBook"

export default function MarketDetailsModal({ market, onClose }) {
  if (!market) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1 pr-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {market.question}
            </h2>
            {market.description && (
              <p className="text-gray-600 text-sm">{market.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Market Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Volume</div>
              <div className="text-lg font-semibold">
                ${parseFloat(market.volume || 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Liquidity</div>
              <div className="text-lg font-semibold">
                ${parseFloat(market.liquidity || 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">End Date</div>
              <div className="text-sm font-semibold">
                {market.endDate
                  ? new Date(market.endDate).toLocaleDateString()
                  : "N/A"}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-sm font-semibold">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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

          {/* Current Prices */}
          <div className="mb-6 bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Current Prices</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {market.outcomes &&
                market.outcomePrices &&
                market.outcomes.map((outcome, index) => (
                  <div
                    key={outcome}
                    className="bg-white rounded-lg p-3 border border-blue-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">{outcome}</div>
                    <div className="text-xl font-bold text-blue-600">
                      {(parseFloat(market.outcomePrices[index]) * 100).toFixed(
                        1
                      )}
                      %
                    </div>
                    <div className="text-xs text-gray-500">
                      ${parseFloat(market.outcomePrices[index]).toFixed(2)}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Tabs for Alerts and Order Book */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alerts Section */}
            <div>
              <AlertManager
                marketId={market.id}
                question={market.question}
                outcomes={market.outcomes}
                currentPrices={market.outcomePrices}
              />
            </div>

            {/* Order Book Section */}
            <div>
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
