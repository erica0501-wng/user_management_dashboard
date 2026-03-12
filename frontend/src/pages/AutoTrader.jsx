import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"

export default function AutoTrader() {
  const navigate = useNavigate()
  const [autoTraders, setAutoTraders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [stats, setStats] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    marketId: "",
    question: "",
    outcome: "Yes",
    strategyType: "PriceTarget",
    triggerCondition: "Above",
    targetPrice: "",
    movingAvgPeriod: "7",
    action: "Buy",
    quantity: "1",
    maxExecutions: "1",
    notifyOnExecution: true,
    notificationChannels: ["email"]
  })

  useEffect(() => {
    fetchAutoTraders()
    fetchStats()
  }, [])

  const fetchAutoTraders = async () => {
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/autotrader`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error("Failed to fetch auto-traders")

      const data = await response.json()
      setAutoTraders(data)
    } catch (error) {
      console.error("Error fetching auto-traders:", error)
      alert("Failed to load auto-trader rules")
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/autotrader/stats/summary`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error("Failed to fetch stats")

      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  const handleCreateAutoTrader = async (e) => {
    e.preventDefault()

    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/autotrader`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create auto-trader rule")
      }

      alert(data.message)
      setShowCreateForm(false)
      fetchAutoTraders()
      fetchStats()
      
      // Reset form
      setFormData({
        marketId: "",
        question: "",
        outcome: "Yes",
        strategyType: "PriceTarget",
        triggerCondition: "Above",
        targetPrice: "",
        movingAvgPeriod: "7",
        action: "Buy",
        quantity: "1",
        maxExecutions: "1",
        notifyOnExecution: true,
        notificationChannels: ["email"]
      })
    } catch (error) {
      console.error("Error creating auto-trader:", error)
      alert(error.message)
    }
  }

  const handleToggle = async (traderId) => {
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/autotrader/${traderId}/toggle`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle auto-trader")
      }

      fetchAutoTraders()
      fetchStats()
    } catch (error) {
      console.error("Error toggling auto-trader:", error)
      alert(error.message)
    }
  }

  const handleDelete = async (traderId) => {
    if (!confirm("Are you sure you want to delete this auto-trader rule?")) {
      return
    }

    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/autotrader/${traderId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete auto-trader")
      }

      alert(data.message)
      fetchAutoTraders()
      fetchStats()
    } catch (error) {
      console.error("Error deleting auto-trader:", error)
      alert(error.message)
    }
  }

  const handleReset = async (traderId) => {
    if (!confirm("Reset execution count and reactivate this rule?")) {
      return
    }

    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/autotrader/${traderId}/reset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset auto-trader")
      }

      alert(data.message)
      fetchAutoTraders()
      fetchStats()
    } catch (error) {
      console.error("Error resetting auto-trader:", error)
      alert(error.message)
    }
  }

  const getStatusBadge = (trader) => {
    if (!trader.isActive) {
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700">Paused</span>
    }
    if (trader.executionCount >= trader.maxExecutions && trader.maxExecutions > 0) {
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Completed</span>
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Active</span>
  }

  const getTriggerDescription = (trader) => {
    if (trader.strategyType === "PriceTarget") {
      return `${trader.triggerCondition} $${trader.targetPrice}`
    } else if (trader.strategyType === "MovingAverage") {
      return `${trader.triggerCondition} MA(${trader.movingAvgPeriod})`
    }
    return trader.strategyType
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64 flex justify-center items-center">
          <div className="text-xl">Loading auto-traders...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🤖 Auto-Trader</h1>
            <p className="text-gray-600 mt-2">
              Automate your trading with intelligent rules
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            {showCreateForm ? "Cancel" : "+ Create Rule"}
          </button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm">Total Rules</div>
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-green-50 p-6 rounded-lg shadow">
              <div className="text-green-600 text-sm">Active</div>
              <div className="text-3xl font-bold text-green-700">{stats.active}</div>
            </div>
            <div className="bg-blue-50 p-6 rounded-lg shadow">
              <div className="text-blue-600 text-sm">Triggered</div>
              <div className="text-3xl font-bold text-blue-700">{stats.triggered}</div>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg shadow">
              <div className="text-purple-600 text-sm">Total Executions</div>
              <div className="text-3xl font-bold text-purple-700">{stats.totalExecutions}</div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6">Create Auto-Trader Rule</h2>
            <form onSubmit={handleCreateAutoTrader} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Market ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Market ID *
                  </label>
                  <input
                    type="text"
                    value={formData.marketId}
                    onChange={(e) => setFormData({ ...formData, marketId: e.target.value })}
                    placeholder="e.g., 531202"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Question */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Market Question *
                  </label>
                  <input
                    type="text"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    placeholder="e.g., Will Bitcoin reach $100k?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Outcome */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Outcome
                  </label>
                  <select
                    value={formData.outcome}
                    onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {/* Strategy Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Strategy Type *
                  </label>
                  <select
                    value={formData.strategyType}
                    onChange={(e) => {
                      const newStrategy = e.target.value
                      setFormData({
                        ...formData,
                        strategyType: newStrategy,
                        triggerCondition: newStrategy === "PriceTarget" ? "Above" : "CrossAbove"
                      })
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="PriceTarget">Price Target</option>
                    <option value="MovingAverage">Moving Average</option>
                  </select>
                </div>

                {/* Trigger Condition */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trigger Condition *
                  </label>
                  <select
                    value={formData.triggerCondition}
                    onChange={(e) => setFormData({ ...formData, triggerCondition: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {formData.strategyType === "PriceTarget" ? (
                      <>
                        <option value="Above">Above</option>
                        <option value="Below">Below</option>
                      </>
                    ) : (
                      <>
                        <option value="CrossAbove">Cross Above</option>
                        <option value="CrossBelow">Cross Below</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Target Price (for PriceTarget strategy) */}
                {formData.strategyType === "PriceTarget" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Price * (0-1)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={formData.targetPrice}
                      onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                      placeholder="e.g., 0.75"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                )}

                {/* Moving Average Period (for MovingAverage strategy) */}
                {formData.strategyType === "MovingAverage" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Moving Average Period * (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={formData.movingAvgPeriod}
                      onChange={(e) => setFormData({ ...formData, movingAvgPeriod: e.target.value })}
                      placeholder="e.g., 7"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                )}

                {/* Action */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action *
                  </label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="Buy">Buy</option>
                    <option value="Sell">Sell</option>
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity * (shares)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="e.g., 10"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Max Executions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Executions (0 = unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxExecutions}
                    onChange={(e) => setFormData({ ...formData, maxExecutions: e.target.value })}
                    placeholder="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Notification Channels */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notifications
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.notificationChannels.includes("email")}
                        onChange={(e) => {
                          const channels = e.target.checked
                            ? [...formData.notificationChannels, "email"]
                            : formData.notificationChannels.filter(c => c !== "email")
                          setFormData({ ...formData, notificationChannels: channels })
                        }}
                        className="mr-2"
                      />
                      Email
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.notificationChannels.includes("discord")}
                        onChange={(e) => {
                          const channels = e.target.checked
                            ? [...formData.notificationChannels, "discord"]
                            : formData.notificationChannels.filter(c => c !== "discord")
                          setFormData({ ...formData, notificationChannels: channels })
                        }}
                        className="mr-2"
                      />
                      Discord
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Auto-Traders List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">Your Auto-Trader Rules</h2>
          </div>

          {autoTraders.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-xl mb-2">No auto-trader rules yet</p>
              <p className="text-sm">Create your first rule to start automated trading</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Market</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strategy</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {autoTraders.map((trader) => (
                    <tr key={trader.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {getStatusBadge(trader)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{trader.question}</div>
                        <div className="text-sm text-gray-500">{trader.outcome}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {trader.strategyType}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getTriggerDescription(trader)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          trader.action === "Buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {trader.action} {trader.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {trader.executionCount} / {trader.maxExecutions === -1 ? "∞" : trader.maxExecutions}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggle(trader.id)}
                            className={`px-3 py-1 text-xs rounded ${
                              trader.isActive
                                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {trader.isActive ? "Pause" : "Resume"}
                          </button>
                          <button
                            onClick={() => handleReset(trader.id)}
                            className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => handleDelete(trader.id)}
                            className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">📚 How Auto-Trader Works</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>Price Target:</strong> Execute trade when price reaches your target</li>
            <li>• <strong>Moving Average:</strong> Execute when price crosses the moving average line</li>
            <li>• Trades are executed automatically every 60 seconds when conditions are met</li>
            <li>• You'll receive email/Discord notifications when trades execute</li>
            <li>• Rules can be paused, resumed, or deleted anytime</li>
          </ul>
        </div>
        </div>
      </div>
    </div>
  )
}
