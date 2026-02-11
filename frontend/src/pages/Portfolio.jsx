import { useState, useEffect } from "react"
import Sidebar from "../components/Sidebar"
import { getAccountBalance, getOrders, updateOrderStatus } from "../services/portfolio"

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState("orders")
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState("All")
  const [directionFilter, setDirectionFilter] = useState("All")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [accountBalance, setAccountBalance] = useState({
    availableCash: 100000,
    totalInvested: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Load orders and balance from API
  const loadData = async () => {
    try {
      setLoading(true)
      setError("")
      const [balanceData, ordersData] = await Promise.all([
        getAccountBalance(),
        getOrders()
      ])
      setAccountBalance(balanceData)
      setOrders(ordersData)
    } catch (err) {
      console.error('Failed to load portfolio data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-fill pending orders after random delay (3-8 seconds)
  useEffect(() => {
    const pendingOrders = orders.filter(order => order.status === "Pending")
    
    if (pendingOrders.length === 0) return

    const timers = pendingOrders.map(order => {
      const randomDelay = Math.random() * 5000 + 3000 // 3-8 seconds
      return setTimeout(async () => {
        try {
          await updateOrderStatus(order.id, "Filled")
          loadData() // Reload all data
        } catch (err) {
          console.error('Failed to fill order:', err)
        }
      }, randomDelay)
    })

    return () => timers.forEach(timer => clearTimeout(timer))
  }, [orders])

  const cancelOrder = async (orderId) => {
    try {
      await updateOrderStatus(orderId, "Cancelled")
      loadData() // Reload data
    } catch (err) {
      console.error('Failed to cancel order:', err)
      alert(err.message)
    }
  }

  const tabs = [
    { id: "orders", label: "Orders" },
    { id: "analysis", label: "Analysis" }
  ]

  // Filter orders based on selected filters
  const filteredOrders = orders.filter(order => {
    const statusMatch = statusFilter === "All" || order.status === statusFilter
    const directionMatch = directionFilter === "All" || order.direction === directionFilter
    
    // Date filtering
    let dateMatch = true
    if (startDate || endDate) {
      const orderDate = new Date(order.createdAt)
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        dateMatch = dateMatch && orderDate >= start
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        dateMatch = dateMatch && orderDate <= end
      }
    }
    
    return statusMatch && directionMatch && dateMatch
  })

  // Calculate account values
  const totalBalance = accountBalance.availableCash + accountBalance.totalInvested
  const buyingPower = accountBalance.availableCash * 2 // 2x leverage

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="ml-64 flex-1 p-6 bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading portfolio...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="ml-64 flex-1 p-6 bg-gray-50">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600">Error: {error}</p>
            <button 
              onClick={loadData}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 p-6 bg-gray-50">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Portfolio</h1>
        
        {/* Funds Banner */}
        <div className="p-6 rounded-2xl bg-blue-50 mb-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col">
              <p className="text-sm text-gray-600 mb-2">Total Balance</p>
              <p className="text-3xl font-bold text-gray-800">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="flex flex-col">
              <p className="text-sm text-gray-600 mb-2">Available Cash</p>
              <p className="text-3xl font-bold text-green-600">${accountBalance.availableCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="flex flex-col">
              <p className="text-sm text-gray-600 mb-2">Buying Power</p>
              <p className="text-3xl font-bold text-blue-600">${buyingPower.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-semibold transition ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters - Only show for orders tab */}
          {activeTab === "orders" && (
            <div className="p-4 flex gap-4 items-center border-b border-gray-200">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status</label>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option>All</option>
                  <option>Pending</option>
                  <option>Filled</option>
                  <option>Cancelled</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Direction</label>
                <select 
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option>All</option>
                  <option>Buy</option>
                  <option>Sell</option>
                </select>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {activeTab === "orders" && (
              <div className="overflow-x-auto">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg mb-2">No orders found</p>
                    <p className="text-sm">Start trading by clicking the $ icon on any stock card</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Direction</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Symbol</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Name</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Price</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Quantity</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Time</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                order.status === "Cancelled"
                                  ? "bg-gray-100 text-gray-600"
                                  : order.status === "Filled"
                                  ? "bg-green-50 text-green-600"
                                  : "bg-yellow-50 text-yellow-600"
                              }`}
                            >
                              {order.status === "Cancelled" && "⊝ "}
                              {order.status === "Filled" && "✓ "}
                              {order.status === "Pending" && "⊗ "}
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold ${
                                order.direction === "Buy" ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {order.direction}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-blue-600">{order.symbol}</td>
                          <td className="py-3 px-4 text-gray-700">{order.name}</td>
                          <td className="py-3 px-4 text-right font-mono">${Number(order.price).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right">{order.quantity}</td>
                          <td className="py-3 px-4 text-center">
                            {order.status === "Pending" ? (
                              <button
                                onClick={() => cancelOrder(order.id)}
                                className="px-3 py-1 text-sm text-white bg-red-500 hover:bg-red-600 rounded transition"
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(order.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">{order.orderType || "LMT"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "analysis" && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">Portfolio Analysis</p>
                <p className="text-sm">Analysis tools coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
