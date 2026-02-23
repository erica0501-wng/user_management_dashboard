import { useState, useEffect, useRef } from "react"
import Sidebar from "../components/Sidebar"
import Modal from "../components/Modal"
import { getAccountBalance, getOrders, updateOrderStatus, topUpBalance, withdrawBalance, getTransactions, runStrategyBacktest } from "../services/portfolio"
import { Chart as ChartJS, CategoryScale, LinearScale, TimeScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import 'chartjs-adapter-date-fns'
import { Chart } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState("orders")
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState("All")
  const [directionFilter, setDirectionFilter] = useState("All")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [accountBalance, setAccountBalance] = useState({
    availableCash: 0,
    totalInvested: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Top Up Modal State
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("credit_card")
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false)

  // Withdraw Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawPaymentMethod, setWithdrawPaymentMethod] = useState("credit_card")
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false)

  // Transaction History State
  const [transactions, setTransactions] = useState([])
  const [showTransactions, setShowTransactions] = useState(false)

  // Strategy Backtest State
  const [backtestSymbol, setBacktestSymbol] = useState("AAPL")
  const [backtestYears, setBacktestYears] = useState(3)
  const [backtestResult, setBacktestResult] = useState(null)
  const [isRunningBacktest, setIsRunningBacktest] = useState(false)
  const [backtestError, setBacktestError] = useState("")
  const [tradeHistoryView, setTradeHistoryView] = useState("table") // "table" or "chart"
  
  // Chart ref
  const chartRef = useRef(null)

  // Stock symbols from homepage (MarketAnalytics)
  const availableStocks = [
    // Tech
    { symbol: "AAPL", name: "Apple Inc.", category: "Tech" },
    { symbol: "MSFT", name: "Microsoft Corp.", category: "Tech" },
    { symbol: "GOOGL", name: "Alphabet Inc.", category: "Tech" },
    { symbol: "META", name: "Meta Platforms Inc.", category: "Tech" },
    { symbol: "NVDA", name: "NVIDIA Corp.", category: "Tech" },
    { symbol: "NFLX", name: "Netflix Inc.", category: "Tech" },
    { symbol: "AMD", name: "Advanced Micro Devices", category: "Tech" },
    { symbol: "ORCL", name: "Oracle Corp.", category: "Tech" },
    { symbol: "INTC", name: "Intel Corp.", category: "Tech" },
    { symbol: "ADBE", name: "Adobe Inc.", category: "Tech" },
    
    // Auto
    { symbol: "TSLA", name: "Tesla Inc.", category: "Auto" },
    { symbol: "F", name: "Ford Motor Co.", category: "Auto" },
    { symbol: "GM", name: "General Motors Co.", category: "Auto" },
    
    // Retail
    { symbol: "AMZN", name: "Amazon.com Inc.", category: "Retail" },
    { symbol: "WMT", name: "Walmart Inc.", category: "Retail" },
    { symbol: "HD", name: "Home Depot Inc.", category: "Retail" },
    { symbol: "TGT", name: "Target Corp.", category: "Retail" },
    
    // Finance
    { symbol: "JPM", name: "JPMorgan Chase & Co.", category: "Finance" },
    { symbol: "BAC", name: "Bank of America Corp.", category: "Finance" },
    { symbol: "GS", name: "Goldman Sachs Group", category: "Finance" },
    { symbol: "V", name: "Visa Inc.", category: "Finance" },
    { symbol: "MA", name: "Mastercard Inc.", category: "Finance" },
    
    // Healthcare
    { symbol: "JNJ", name: "Johnson & Johnson", category: "Healthcare" },
    { symbol: "PFE", name: "Pfizer Inc.", category: "Healthcare" },
    { symbol: "UNH", name: "UnitedHealth Group", category: "Healthcare" },
    { symbol: "ABBV", name: "AbbVie Inc.", category: "Healthcare" },
    
    // Energy
    { symbol: "XOM", name: "Exxon Mobil Corp.", category: "Energy" },
    { symbol: "CVX", name: "Chevron Corp.", category: "Energy" },
    { symbol: "COP", name: "ConocoPhillips", category: "Energy" }
  ]

  // Load orders and balance from API
  const loadData = async () => {
    try {
      setLoading(true)
      setError("")
      const [balanceData, ordersData, transactionsData] = await Promise.all([
        getAccountBalance(),
        getOrders(),
        getTransactions()
      ])
      setAccountBalance(balanceData)
      setOrders(ordersData)
      setTransactions(transactionsData)
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

  // Card Details State
  const [cardNumber, setCardNumber] = useState("")
  const [cardHolder, setCardHolder] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvv, setCvv] = useState("")
  
  const handleTopUp = async (e) => {
    e.preventDefault()
    
    // Basic validations
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      alert("Please enter a valid amount")
      return
    }

    if (!/^\d{16}$/.test(cardNumber.replace(/\s/g, ''))) {
      alert("Please enter a valid 16-digit card number")
      return
    }

    if (cardHolder.trim().length === 0) {
      alert("Please enter the cardholder name")
      return
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      alert("Please enter a valid expiry date (MM/YY)")
      return
    }

    if (!/^\d{3,4}$/.test(cvv)) {
      alert("Please enter a valid 3 or 4 digit CVV")
      return
    }

    try {
      setIsProcessingTopUp(true)
      // In a real app, we would send card details securely. 
      // Here we just simulate validation success and call the backend.
      await topUpBalance(parseFloat(topUpAmount), paymentMethod)
      alert("Top up successful!")
      setShowTopUpModal(false)
      // Reset form
      setTopUpAmount("")
      setCardNumber("")
      setCardHolder("")
      setExpiry("")
      setCvv("")
      loadData() // Reload balance
    } catch (err) {
      console.error('Failed to top up:', err)
      alert(err.message)
    } finally {
      setIsProcessingTopUp(false)
    }
  }

  // Helper to format card number
  const handleCardNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 16)
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value
    setCardNumber(formatted)
  }

  // Helper to format expiry
  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 4) value = value.substring(0, 4)
    
    if (value.length >= 3) {
      setExpiry(`${value.substring(0, 2)}/${value.substring(2)}`)
    } else {
      setExpiry(value)
    }
  }

  // Withdraw state for card details
  const [withdrawCardNumber, setWithdrawCardNumber] = useState("")
  const [withdrawCardHolder, setWithdrawCardHolder] = useState("")
  const [withdrawExpiry, setWithdrawExpiry] = useState("")
  const [withdrawCvv, setWithdrawCvv] = useState("")

  const handleWithdraw = async (e) => {
    e.preventDefault()
    
    // Basic validations
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert("Please enter a valid amount")
      return
    }

    if (!/^\d{16}$/.test(withdrawCardNumber.replace(/\s/g, ''))) {
      alert("Please enter a valid 16-digit card number")
      return
    }

    if (withdrawCardHolder.trim().length === 0) {
      alert("Please enter the cardholder name")
      return
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(withdrawExpiry)) {
      alert("Please enter a valid expiry date (MM/YY)")
      return
    }

    if (!/^\d{3,4}$/.test(withdrawCvv)) {
      alert("Please enter a valid 3 or 4 digit CVV")
      return
    }

    try {
      setIsProcessingWithdraw(true)
      await withdrawBalance(parseFloat(withdrawAmount), withdrawPaymentMethod)
      alert("Withdrawal successful!")
      setShowWithdrawModal(false)
      // Reset form
      setWithdrawAmount("")
      setWithdrawCardNumber("")
      setWithdrawCardHolder("")
      setWithdrawExpiry("")
      setWithdrawCvv("")
      loadData() // Reload balance
    } catch (err) {
      console.error('Failed to withdraw:', err)
      alert(err.message)
    } finally {
      setIsProcessingWithdraw(false)
    }
  }

  // Helper to format withdraw card number
  const handleWithdrawCardNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 16)
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value
    setWithdrawCardNumber(formatted)
  }

  // Helper to format withdraw expiry
  const handleWithdrawExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 4) value = value.substring(0, 4)
    
    if (value.length >= 3) {
      setWithdrawExpiry(`${value.substring(0, 2)}/${value.substring(2)}`)
    } else {
      setWithdrawExpiry(value)
    }
  }

  // Run strategy backtest
  const handleRunBacktest = async () => {
    try {
      setIsRunningBacktest(true)
      setBacktestError("")
      const result = await runStrategyBacktest(backtestSymbol, backtestYears)
      setBacktestResult(result)
    } catch (err) {
      console.error('Backtest failed:', err)
      setBacktestError(err.message)
    } finally {
      setIsRunningBacktest(false)
    }
  }

  // Load orders and balance from API

  const tabs = [
    { id: "orders", label: "Orders" },
    { id: "transactions", label: "Transactions" },
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
        <div className="p-6 rounded-2xl bg-blue-50 mb-6 relative flex items-center">
          <div className="absolute right-6 flex gap-3" style={{ top: '50%', transform: 'translateY(-50%)' }}>
            <button 
              onClick={() => setShowWithdrawModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg text-xl font-bold transition-all hover:scale-105"
              title="Withdraw Balance"
            >
              -
            </button>
            <button 
              onClick={() => setShowTopUpModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-lg text-xl font-bold transition-all hover:scale-105"
              title="Top Up Balance"
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-3 gap-6 w-full pr-28">
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

            {activeTab === "transactions" && (
              <div className="overflow-x-auto">
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg mb-2">No transactions found</p>
                    <p className="text-sm">Your top-up and withdrawal history will appear here</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Amount</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Payment Method</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                                transaction.type === "TopUp"
                                  ? "bg-green-50 text-green-600"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {transaction.type === "TopUp" ? "↑ Top Up" : "↓ Withdraw"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-mono font-semibold ${
                              transaction.type === "TopUp" ? "text-green-600" : "text-red-600"
                            }`}>
                              {transaction.type === "TopUp" ? "+" : "-"}${Number(transaction.amount).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700 capitalize">
                            {transaction.paymentMethod ? transaction.paymentMethod.replace('_', ' ') : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(transaction.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "analysis" && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Moving Average Crossover Strategy</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This strategy purchases stocks when the price goes below the 30-day moving average 
                    and sells when the price is above the 90-day moving average.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="relative z-10">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stock Symbol</label>
                      <select
                        value={backtestSymbol}
                        onChange={(e) => setBacktestSymbol(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                      >
                        <optgroup label="Tech" className="font-semibold text-gray-900 bg-gray-100">
                          {availableStocks.filter(s => s.category === "Tech").map((stock) => (
                            <option key={stock.symbol} value={stock.symbol} className="py-2">
                              {stock.symbol} - {stock.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Auto" className="font-semibold text-gray-900 bg-gray-100">
                          {availableStocks.filter(s => s.category === "Auto").map((stock) => (
                            <option key={stock.symbol} value={stock.symbol} className="py-2">
                              {stock.symbol} - {stock.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Retail" className="font-semibold text-gray-900 bg-gray-100">
                          {availableStocks.filter(s => s.category === "Retail").map((stock) => (
                            <option key={stock.symbol} value={stock.symbol} className="py-2">
                              {stock.symbol} - {stock.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Finance" className="font-semibold text-gray-900 bg-gray-100">
                          {availableStocks.filter(s => s.category === "Finance").map((stock) => (
                            <option key={stock.symbol} value={stock.symbol} className="py-2">
                              {stock.symbol} - {stock.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Healthcare" className="font-semibold text-gray-900 bg-gray-100">
                          {availableStocks.filter(s => s.category === "Healthcare").map((stock) => (
                            <option key={stock.symbol} value={stock.symbol} className="py-2">
                              {stock.symbol} - {stock.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Energy" className="font-semibold text-gray-900 bg-gray-100">
                          {availableStocks.filter(s => s.category === "Energy").map((stock) => (
                            <option key={stock.symbol} value={stock.symbol} className="py-2">
                              {stock.symbol} - {stock.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Backtest Period</label>
                      <select
                        value={backtestYears}
                        onChange={(e) => setBacktestYears(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={3}>3 Years</option>
                        <option value={5}>5 Years</option>
                        <option value={7}>7 Years</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleRunBacktest}
                        disabled={isRunningBacktest || !backtestSymbol}
                        className="w-full px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isRunningBacktest ? 'Running...' : 'Run Backtest'}
                      </button>
                    </div>
                  </div>

                  {backtestError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mb-4">
                      {backtestError}
                    </div>
                  )}
                </div>

                {backtestResult && (
                  <div className="space-y-6">
                    {/* Performance Summary */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h4 className="text-lg font-bold text-gray-800 mb-4">Performance Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs text-gray-600 mb-1">Initial Capital</p>
                          <p className="text-xl font-bold text-gray-800">${parseFloat(backtestResult.initialCapital).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs text-gray-600 mb-1">Final Value</p>
                          <p className="text-xl font-bold text-green-600">${parseFloat(backtestResult.finalValue).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs text-gray-600 mb-1">Total Return</p>
                          <p className={`text-xl font-bold ${parseFloat(backtestResult.totalReturn) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {backtestResult.totalReturn}%
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs text-gray-600 mb-1">Annualized Return</p>
                          <p className={`text-xl font-bold ${parseFloat(backtestResult.annualizedReturn) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {backtestResult.annualizedReturn}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Buy & Hold Comparison */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h4 className="text-lg font-bold text-gray-800 mb-4">vs. Buy & Hold Strategy</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
                          <p className="text-xs text-blue-700 font-semibold mb-1">Strategy Return</p>
                          <p className={`text-2xl font-bold ${parseFloat(backtestResult.totalReturn) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {backtestResult.totalReturn}%
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs text-gray-600 mb-1">Buy & Hold Return</p>
                          <p className={`text-2xl font-bold ${parseFloat(backtestResult.buyHoldComparison.return) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {backtestResult.buyHoldComparison.return}%
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs text-gray-600 mb-1">Difference</p>
                          <p className={`text-2xl font-bold ${(parseFloat(backtestResult.totalReturn) - parseFloat(backtestResult.buyHoldComparison.return)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(parseFloat(backtestResult.totalReturn) - parseFloat(backtestResult.buyHoldComparison.return)).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Trade History */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-bold text-gray-800">
                          Trade History ({backtestResult.totalTrades} trades)
                        </h4>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTradeHistoryView("table")}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                              tradeHistoryView === "table"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            Table View
                          </button>
                          <button
                            onClick={() => setTradeHistoryView("chart")}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                              tradeHistoryView === "chart"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            Chart View
                          </button>
                        </div>
                      </div>

                      {tradeHistoryView === "table" ? (
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="text-left py-2 px-4 text-sm font-semibold text-gray-600">Date</th>
                                <th className="text-left py-2 px-4 text-sm font-semibold text-gray-600">Action</th>
                                <th className="text-right py-2 px-4 text-sm font-semibold text-gray-600">Price</th>
                                <th className="text-right py-2 px-4 text-sm font-semibold text-gray-600">Shares</th>
                                <th className="text-right py-2 px-4 text-sm font-semibold text-gray-600">Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {backtestResult.trades.map((trade, idx) => (
                                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                                  <td className="py-2 px-4 text-sm text-gray-600">{trade.date}</td>
                                  <td className="py-2 px-4">
                                    <span className={`text-sm font-semibold ${trade.action.includes('BUY') ? 'text-green-600' : 'text-red-600'}`}>
                                      {trade.action}
                                    </span>
                                  </td>
                                  <td className="py-2 px-4 text-sm text-right font-mono">${trade.price}</td>
                                  <td className="py-2 px-4 text-sm text-right">{trade.shares}</td>
                                  <td className="py-2 px-4 text-sm text-right font-mono">${trade.value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Price Chart with MA Lines and Trade Markers */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="text-sm font-semibold text-gray-700">Price Chart with Moving Averages & Trade Signals</h5>
                              <button
                                onClick={() => {
                                  if (chartRef.current) {
                                    chartRef.current.resetZoom()
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium transition"
                              >
                                Reset Zoom
                              </button>
                            </div>
                            <div className="relative h-96 bg-white rounded-lg p-2">
                              <Chart
                                ref={chartRef}
                                type="line"
                                data={{
                                  datasets: [
                                    {
                                      label: `${backtestSymbol} Price`,
                                      data: backtestResult.chartData.dates.map((date, i) => ({
                                        x: new Date(date).getTime(),
                                        y: backtestResult.chartData.prices[i]
                                      })),
                                      borderColor: '#3b82f6',
                                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                      borderWidth: 2,
                                      pointRadius: 0,
                                      tension: 0.1,
                                      fill: true,
                                    },
                                    {
                                      label: '30-Day MA',
                                      type: 'line',
                                      data: backtestResult.chartData.dates.map((date, i) => ({
                                        x: new Date(date).getTime(),
                                        y: backtestResult.chartData.ma30[i]
                                      })).filter(d => d.y !== null),
                                      borderColor: '#f59e0b',
                                      backgroundColor: 'transparent',
                                      borderWidth: 2,
                                      pointRadius: 0,
                                      tension: 0.1,
                                      borderDash: [5, 5],
                                    },
                                    {
                                      label: '90-Day MA',
                                      type: 'line',
                                      data: backtestResult.chartData.dates.map((date, i) => ({
                                        x: new Date(date).getTime(),
                                        y: backtestResult.chartData.ma90[i]
                                      })).filter(d => d.y !== null),
                                      borderColor: '#8b5cf6',
                                      backgroundColor: 'transparent',
                                      borderWidth: 2,
                                      pointRadius: 0,
                                      tension: 0.1,
                                      borderDash: [5, 5],
                                    },
                                  ],
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  interaction: {
                                    mode: 'index',
                                    intersect: false,
                                  },
                                  plugins: {
                                    legend: {
                                      display: true,
                                      position: 'top',
                                      labels: {
                                        usePointStyle: true,
                                        padding: 15,
                                        font: {
                                          size: 11
                                        }
                                      }
                                    },
                                    tooltip: {
                                      callbacks: {
                                        label: function(context) {
                                          const label = context.dataset.label || ''
                                          const value = context.parsed.y
                                          if (value !== undefined && value !== null) {
                                            return `${label}: $${value.toFixed(2)}`
                                          }
                                          return label
                                        }
                                      }
                                    },
                                    zoom: {
                                      pan: {
                                        enabled: true,
                                        mode: 'x',
                                        modifierKey: 'ctrl',
                                      },
                                      zoom: {
                                        wheel: {
                                          enabled: true,
                                          speed: 0.1,
                                        },
                                        pinch: {
                                          enabled: true,
                                        },
                                        mode: 'x',
                                      },
                                    },
                                  },
                                  scales: {
                                    x: {
                                      type: 'time',
                                      time: {
                                        unit: 'month',
                                        displayFormats: {
                                          month: 'MMM yyyy'
                                        }
                                      },
                                      title: {
                                        display: true,
                                        text: 'Date (Time Period)',
                                        font: {
                                          size: 14,
                                          weight: 'bold'
                                        },
                                        color: '#374151'
                                      },
                                      ticks: {
                                        maxRotation: 45,
                                        minRotation: 45
                                      }
                                    },
                                    y: {
                                      title: {
                                        display: true,
                                        text: 'Stock Price (USD)',
                                        font: {
                                          size: 14,
                                          weight: 'bold'
                                        },
                                        color: '#374151'
                                      },
                                      ticks: {
                                        callback: function(value) {
                                          return '$' + value.toFixed(2)
                                        }
                                      }
                                    }
                                  }
                                }}
                              />
                            </div>
                            <div className="flex justify-center gap-6 mt-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-0.5 bg-blue-500"></div>
                                <span className="text-xs text-gray-600">Stock Price</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-0.5 bg-amber-500" style={{backgroundImage: 'repeating-linear-gradient(to right, #f59e0b 0, #f59e0b 5px, transparent 5px, transparent 10px)'}}></div>
                                <span className="text-xs text-gray-600">30-Day MA</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-0.5 bg-purple-500" style={{backgroundImage: 'repeating-linear-gradient(to right, #8b5cf6 0, #8b5cf6 5px, transparent 5px, transparent 10px)'}}></div>
                                <span className="text-xs text-gray-600">90-Day MA</span>
                              </div>
                            </div>
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs text-blue-700 mb-2">
                                <strong>📊 Chart Explanation:</strong>
                              </p>
                              <ul className="text-xs text-blue-700 space-y-1 ml-4">
                                <li>• <strong>X-Axis (Horizontal):</strong> Timeline showing dates over the backtest period</li>
                                <li>• <strong>Y-Axis (Vertical):</strong> Stock price in US dollars ($)</li>
                                <li>• <strong>Blue Line:</strong> Actual stock price movement</li>
                                <li>• <strong>Orange Dashed Line:</strong> 30-day moving average (strategy buys when price crosses below this)</li>
                                <li>• <strong>Purple Dashed Line:</strong> 90-day moving average (strategy sells when price crosses above this)</li>
                              </ul>
                              <p className="text-xs text-blue-700 mt-2">
                                💡 <strong>Controls:</strong> Mouse wheel to zoom • Ctrl + Drag to pan • Click "Reset Zoom" to restore
                              </p>
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-gray-700 mb-3">Trade Timeline</h5>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {backtestResult.trades.map((trade, idx) => (
                                <div key={idx} className="flex items-center gap-4 bg-white rounded-lg p-3 border border-gray-200">
                                  <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center text-2xl ${
                                    trade.action.includes('BUY') ? 'bg-green-100' : 'bg-red-100'
                                  }`}>
                                    {trade.action.includes('BUY') ? '📈' : '📉'}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className={`font-semibold ${trade.action.includes('BUY') ? 'text-green-600' : 'text-red-600'}`}>
                                          {trade.action}
                                        </p>
                                        <p className="text-xs text-gray-500">{trade.date}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-mono font-semibold text-gray-800">${trade.price}</p>
                                        <p className="text-xs text-gray-500">{trade.shares} shares</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    <p className="text-sm font-semibold text-gray-800">${trade.value}</p>
                                    <p className="text-xs text-gray-500">Total</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={showTopUpModal} onClose={() => setShowTopUpModal(false)}>
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Top Up Balance</h2>
          <form onSubmit={handleTopUp}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center justify-center gap-2 border p-3 rounded-lg cursor-pointer transition text-center ${paymentMethod === 'credit_card' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="credit_card"
                    checked={paymentMethod === 'credit_card'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="hidden"
                  />
                  <span>Credit Card</span>
                </label>
                <label className={`flex items-center justify-center gap-2 border p-3 rounded-lg cursor-pointer transition text-center ${paymentMethod === 'debit_card' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="debit_card"
                    checked={paymentMethod === 'debit_card'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="hidden"
                  />
                  <span>Debit Card</span>
                </label>
              </div>
            </div>

            {/* Card Details Section */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
               <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Card Number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-wider"
                  placeholder="0000 0000 0000 0000"
                  maxLength="19"
                />
              </div>

               <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cardholder Name</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  placeholder="YOUR NAME"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={handleExpiryChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    placeholder="MM/YY"
                    maxLength="5"
                  />
                </div>
                 <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CVV</label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    placeholder="123"
                    maxLength="4"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessingTopUp}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition"
              >
                {isProcessingTopUp ? 'Processing...' : 'Confirm Top Up'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal open={showWithdrawModal} onClose={() => setShowWithdrawModal(false)}>
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Withdraw Balance</h2>
          <form onSubmit={handleWithdraw}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="0.00"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: ${accountBalance.availableCash.toFixed(2)}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center justify-center gap-2 border p-3 rounded-lg cursor-pointer transition text-center ${withdrawPaymentMethod === 'credit_card' ? 'border-red-500 bg-red-50 text-red-700 font-semibold' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                  <input 
                    type="radio" 
                    name="withdrawPaymentMethod" 
                    value="credit_card"
                    checked={withdrawPaymentMethod === 'credit_card'}
                    onChange={(e) => setWithdrawPaymentMethod(e.target.value)}
                    className="hidden"
                  />
                  <span>Credit Card</span>
                </label>
                <label className={`flex items-center justify-center gap-2 border p-3 rounded-lg cursor-pointer transition text-center ${withdrawPaymentMethod === 'debit_card' ? 'border-red-500 bg-red-50 text-red-700 font-semibold' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                  <input 
                    type="radio" 
                    name="withdrawPaymentMethod" 
                    value="debit_card"
                    checked={withdrawPaymentMethod === 'debit_card'}
                    onChange={(e) => setWithdrawPaymentMethod(e.target.value)}
                    className="hidden"
                  />
                  <span>Debit Card</span>
                </label>
              </div>
            </div>

            {/* Card Details Section */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
               <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Card Number</label>
                <input
                  type="text"
                  value={withdrawCardNumber}
                  onChange={handleWithdrawCardNumberChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 tracking-wider"
                  placeholder="0000 0000 0000 0000"
                  maxLength="19"
                />
              </div>

               <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cardholder Name</label>
                <input
                  type="text"
                  value={withdrawCardHolder}
                  onChange={(e) => setWithdrawCardHolder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 uppercase"
                  placeholder="YOUR NAME"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={withdrawExpiry}
                    onChange={handleWithdrawExpiryChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-center"
                    placeholder="MM/YY"
                    maxLength="5"
                  />
                </div>
                 <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CVV</label>
                  <input
                    type="text"
                    value={withdrawCvv}
                    onChange={(e) => setWithdrawCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-center"
                    placeholder="123"
                    maxLength="4"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessingWithdraw}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 transition"
              >
                {isProcessingWithdraw ? 'Processing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}
