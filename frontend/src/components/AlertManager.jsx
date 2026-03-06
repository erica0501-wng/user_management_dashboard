import { useState, useEffect } from "react"
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, TrendingUp, BookOpen } from "lucide-react"

export default function AlertManager({ marketId, question, outcomes, currentPrices }) {
  const [alerts, setAlerts] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  // Form state
  const [alertType, setAlertType] = useState("Price")
  const [selectedOutcome, setSelectedOutcome] = useState("")
  const [targetPrice, setTargetPrice] = useState("")
  const [condition, setCondition] = useState("Above")
  const [orderBookThreshold, setOrderBookThreshold] = useState("")

  useEffect(() => {
    fetchAlerts()
  }, [marketId])

  useEffect(() => {
    if (outcomes && outcomes.length > 0 && !selectedOutcome) {
      setSelectedOutcome(outcomes[0])
    }
  }, [outcomes, selectedOutcome])

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/alerts`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error("Failed to fetch alerts")

      const data = await response.json()
      
      // Filter alerts for this market
      const marketAlerts = data.alerts.filter(alert => alert.marketId === marketId)
      setAlerts(marketAlerts)
    } catch (err) {
      console.error("Error fetching alerts:", err)
    }
  }

  const createAlert = async () => {
    try {
      setLoading(true)
      setError("")

      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const alertData = {
        marketId,
        question,
        outcome: selectedOutcome,
        alertType
      }

      if (alertType === "Price") {
        alertData.targetPrice = parseFloat(targetPrice)
        alertData.condition = condition
      } else if (alertType === "OrderBook") {
        alertData.orderBookThreshold = parseFloat(orderBookThreshold)
      }

      const response = await fetch(`${apiUrl}/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(alertData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create alert")
      }

      await fetchAlerts()
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteAlert = async (alertId) => {
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/alerts/${alertId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error("Failed to delete alert")

      await fetchAlerts()
    } catch (err) {
      console.error("Error deleting alert:", err)
    }
  }

  const toggleAlert = async (alertId, currentStatus) => {
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/alerts/${alertId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (!response.ok) throw new Error("Failed to toggle alert")

      await fetchAlerts()
    } catch (err) {
      console.error("Error toggling alert:", err)
    }
  }

  const resetForm = () => {
    setAlertType("Price")
    setSelectedOutcome(outcomes && outcomes.length > 0 ? outcomes[0] : "")
    setTargetPrice("")
    setCondition("Above")
    setOrderBookThreshold("")
    setError("")
  }

  const getCurrentPrice = () => {
    if (!selectedOutcome || !outcomes || !currentPrices) return null
    const index = outcomes.indexOf(selectedOutcome)
    if (index === -1) return null
    return parseFloat(currentPrices[index])
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-semibold">Alerts</h3>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Create Alert</span>
        </button>
      </div>

      {/* Alert List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {alerts.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No alerts set for this market
          </p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-5 shadow-sm ${
                alert.isTriggered
                  ? "border-green-500 bg-green-50"
                  : alert.isActive
                  ? "border-gray-200 bg-white"
                  : "border-gray-200 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    {alert.alertType === "Price" ? (
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-purple-600" />
                    )}
                    <span className="font-semibold">
                      {alert.alertType} Alert: {alert.outcome}
                    </span>
                  </div>
                  
                  {alert.alertType === "Price" && (
                    <p className="text-gray-600 mb-1">
                      Notify when price goes {alert.condition.toLowerCase()} <span className="font-semibold">{alert.targetPrice}</span>
                    </p>
                  )}
                  
                  {alert.alertType === "OrderBook" && (
                    <p className="text-gray-600 mb-1">
                      Notify when order book volume exceeds <span className="font-semibold">{alert.orderBookThreshold.toLocaleString()}</span>
                    </p>
                  )}

                  {alert.isTriggered && (
                    <div className="mt-3 inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full">
                      ✓ Triggered {new Date(alert.triggeredAt).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {!alert.isTriggered && (
                    <button
                      onClick={() => toggleAlert(alert.id, alert.isActive)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                      title={alert.isActive ? "Deactivate" : "Activate"}
                    >
                      {alert.isActive ? (
                        <ToggleRight className="w-6 h-6 text-blue-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Create New Alert</h3>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            {/* Alert Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alert Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAlertType("Price")}
                  className={`px-4 py-3 rounded-lg border-2 transition ${
                    alertType === "Price"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <TrendingUp className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">Price Alert</span>
                </button>
                <button
                  onClick={() => setAlertType("OrderBook")}
                  className={`px-4 py-3 rounded-lg border-2 transition ${
                    alertType === "OrderBook"
                      ? "border-purple-600 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <BookOpen className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-sm font-medium">Order Book</span>
                </button>
              </div>
            </div>

            {/* Outcome Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Outcome
              </label>
              <select
                value={selectedOutcome}
                onChange={(e) => setSelectedOutcome(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {outcomes && outcomes.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Alert Fields */}
            {alertType === "Price" && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Above">Price goes above</option>
                    <option value="Below">Price goes below</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="0.65"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {getCurrentPrice() !== null && (
                    <p className="mt-1 text-xs text-gray-500">
                      Current price: {getCurrentPrice().toFixed(2)}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Order Book Alert Fields */}
            {alertType === "OrderBook" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Volume Threshold
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={orderBookThreshold}
                  onChange={(e) => setOrderBookThreshold(e.target.value)}
                  placeholder="50000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Alert when total order book volume exceeds this amount
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={createAlert}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
