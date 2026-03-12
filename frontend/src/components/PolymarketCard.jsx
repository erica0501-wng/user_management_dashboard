import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, BookOpen, Bot, X, Pause, Play, Trash2 } from "lucide-react"

export default function PolymarketCard({ market, onTradeComplete }) {
  const [showDetails, setShowDetails] = useState(false)
  const [showAutoTradeForm, setShowAutoTradeForm] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [existingRules, setExistingRules] = useState([])
  const [loadingRules, setLoadingRules] = useState(false)
  const navigate = useNavigate()
  
  // Auto-trade form state
  const [autoTradeForm, setAutoTradeForm] = useState({
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
  
  // Fetch existing rules when auto-trade section is opened
  useEffect(() => {
    if (showAutoTradeForm) {
      fetchExistingRules()
    }
  }, [showAutoTradeForm])
  
  const fetchExistingRules = async () => {
    setLoadingRules(true)
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"
      
      const response = await fetch(`${apiUrl}/autotrader`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Filter rules for this specific market
        const marketRules = data.filter(rule => rule.marketId === market.id)
        setExistingRules(marketRules)
      }
    } catch (error) {
      console.error("Error fetching auto-trade rules:", error)
    } finally {
      setLoadingRules(false)
    }
  }

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  }

  // 格式化金额
  const formatMoney = (value) => {
    if (!value) return "$0"
    const num = parseFloat(value)
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`
    }
    return `$${num.toFixed(2)}`
  }

  // 获取最高概率的结果
  const getLeadingOutcome = () => {
    if (!market.outcomes || !market.outcomePrices) return null
    if (!Array.isArray(market.outcomes) || !Array.isArray(market.outcomePrices)) return null
    if (market.outcomes.length === 0 || market.outcomePrices.length === 0) return null
    
    try {
      const prices = market.outcomePrices.map(p => parseFloat(p))
      const maxPrice = Math.max(...prices)
      const maxIndex = prices.indexOf(maxPrice)
      
      return {
        outcome: market.outcomes[maxIndex],
        probability: (maxPrice * 100).toFixed(1)
      }
    } catch (error) {
      console.error('Error getting leading outcome:', error)
      return null
    }
  }

  const leading = getLeadingOutcome()
  // Detect category
  const detectCategory = (question, description) => {
    const text = `${question || ""} ${description || ""}`.toLowerCase()
    
    // Entertainment - check first to avoid "market" in "box office market"
    if (text.match(/movie|film|music|celebrity|oscar|grammy|entertainment|tv show|box office|netflix|streaming|concert|album|cinema|actor|actress/)) {
      return { name: "Entertainment", color: "bg-pink-100 text-pink-800" }
    }
    
    // Crypto
    if (text.match(/bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft|cryptocurrency|token|coin/)) {
      return { name: "Crypto", color: "bg-orange-100 text-orange-800" }
    }
    
    // Politics
    if (text.match(/election|president|presidential|政治|vote|voting|congress|senate|政府|political|government|campaign/)) {
      return { name: "Politics", color: "bg-purple-100 text-purple-800" }
    }
    
    // Sports
    if (text.match(/sport|football|basketball|soccer|nba|nfl|championship|tennis|premier league|lakers|olympics|world cup|fifa|baseball|hockey/)) {
      return { name: "Sports", color: "bg-green-100 text-green-800" }
    }
    
    // Tech
    if (text.match(/\bai\b|artificial intelligence|coding|software|apple|google|meta|microsoft|ar glasses|augmented reality|virtual reality|robot|technology|tech/)) {
      return { name: "Tech", color: "bg-blue-100 text-blue-800" }
    }
    
    // Finance
    if (text.match(/stock market|stock|economy|recession|gdp|inflation|finance|trading|fed|federal reserve|interest rate|investment|wall street|sp 500|s&p 500|nasdaq|dow jones/)) {
      return { name: "Finance", color: "bg-yellow-100 text-yellow-800" }
    }
    
    // Everything else
    return { name: "Other", color: "bg-gray-100 text-gray-800" }
  }

  const category = detectCategory(market.question || "", market.description || "")
  
  // State to track image load status
  const [imageLoaded, setImageLoaded] = useState(true)
  
  // Handle auto-trade form submission
  const handleCreateAutoTrade = async (e) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"
      
      const payload = {
        marketId: market.id,
        question: market.question,
        ...autoTradeForm
      }
      
      console.log("📤 Sending auto-trade payload:", payload)
      
      const response = await fetch(`${apiUrl}/autotrader`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      
      const data = await response.json()
      
      console.log("📥 Response from server:", { 
        status: response.status, 
        ok: response.ok,
        data: data,
        error: data.error,
        details: data.details
      })
      
      if (!response.ok) {
        const errorMsg = data.details || data.error || "Failed to create auto-trade rule"
        console.error("❌ Server error:", errorMsg)
        throw new Error(errorMsg)
      }
      
      alert("✅ Auto-trade rule created successfully!")
      setShowCreateForm(false)
      fetchExistingRules() // Refresh the list
      
      // Reset form
      setAutoTradeForm({
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
      console.error("Error creating auto-trade:", error)
      alert("❌ " + error.message)
    }
  }
  
  // Toggle rule (pause/resume)
  const handleToggleRule = async (ruleId) => {
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"
      
      const response = await fetch(`${apiUrl}/autotrader/${ruleId}/toggle`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error("Failed to toggle rule")
      }
      
      fetchExistingRules() // Refresh the list
    } catch (error) {
      console.error("Error toggling rule:", error)
      alert("❌ " + error.message)
    }
  }
  
  // Delete rule
  const handleDeleteRule = async (ruleId) => {
    if (!confirm("Are you sure you want to delete this rule?")) {
      return
    }
    
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"
      
      const response = await fetch(`${apiUrl}/autotrader/${ruleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error("Failed to delete rule")
      }
      
      alert("✅ Rule deleted successfully!")
      fetchExistingRules() // Refresh the list
    } catch (error) {
      console.error("Error deleting rule:", error)
      alert("❌ " + error.message)
    }
  }
  
  // Format strategy details for display
  const formatStrategyDetails = (rule) => {
    if (rule.strategyType === "PriceTarget") {
      return `${rule.triggerCondition} ${parseFloat(rule.targetPrice).toFixed(2)}`
    } else if (rule.strategyType === "MovingAverage") {
      return `${rule.triggerCondition} ${rule.movingAvgPeriod}d MA`
    }
    return rule.strategyType
  }
  
  // Get category gradient
  const getCategoryGradient = () => {
    const gradients = {
      "Crypto": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      "Politics": "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      "Sports": "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      "Tech": "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      "Finance": "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
      "Entertainment": "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
      "Other": "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)"
    }
    return gradients[category.name] || gradients["Other"]
  }

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow border border-gray-200 overflow-hidden">
      {/* Market Image with Fallback */}
      <div className="h-40 bg-gray-100 overflow-hidden relative">
        {market.image && imageLoaded ? (
          <img
            src={market.image}
            alt={market.question}
            className="w-full h-full object-cover"
            onError={(e) => {
              setImageLoaded(false)
            }}
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center text-white"
            style={{ background: getCategoryGradient() }}
          >
            <div className="text-center p-4">
              <div className="text-sm font-semibold opacity-90">{category.name}</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-5">
        {/* Category Badge */}
        <div className="mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${category.color}`}>
            {category.name}
          </span>
        </div>

        {/* Question */}
        <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">
          {market.question}
        </h3>

        {/* Leading Outcome */}
        {leading && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-sm text-gray-600 mb-1">Leading</div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900">{leading.outcome}</span>
              <span className="text-xl font-bold text-blue-600">{leading.probability}%</span>
            </div>
          </div>
        )}

        {/* All Outcomes */}
        <div className="mb-4 space-y-2">
          {market.outcomes && market.outcomePrices && 
           Array.isArray(market.outcomes) && Array.isArray(market.outcomePrices) &&
           market.outcomes.length > 0 && market.outcomes.map((outcome, index) => {
            if (!market.outcomePrices[index]) return null
            const probability = (parseFloat(market.outcomePrices[index]) * 100).toFixed(1)
            return (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="text-gray-700">{outcome}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${probability}%` }}
                    />
                  </div>
                  <span className="text-gray-600 font-medium w-12 text-right">
                    {probability}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-500 mb-1">Volume</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatMoney(market.volume)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Liquidity</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatMoney(market.liquidity)}
            </div>
          </div>
        </div>

        {/* End Date */}
        <div className="text-xs text-gray-500 mb-4">
          <span className="font-medium">Ends:</span> {formatDate(market.endDate)}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* First row: Details and primary actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              {showDetails ? "Hide" : "Details"}
            </button>
            <button
              onClick={() => navigate(`/polymarket/details/${market.id}`)}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium flex items-center gap-2"
              title="View Alerts & Order Book"
            >
              <Bell className="w-4 h-4" />
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(`/polymarket/trade/${market.id}`)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Trade
            </button>
          </div>
          
          {/* Second row: Auto-Trade button */}
          <button
            onClick={() => setShowAutoTradeForm(!showAutoTradeForm)}
            className="w-full px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Bot className="w-4 h-4" />
            {showAutoTradeForm ? "Hide Auto-Trade" : "Create Auto-Trade Rule"}
          </button>
        </div>

        {/* Expanded Details */}
        {showDetails && market.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600 leading-relaxed">
              {market.description}
            </p>
          </div>
        )}

        {/* Auto-Trade Section */}
        {showAutoTradeForm && (
          <div className="mt-4 pt-4 border-t-2 border-purple-100 bg-purple-50 -mx-5 px-5 pb-5 rounded-b-lg">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Auto-Trade Rules
              </h4>
              <button
                onClick={() => {
                  setShowAutoTradeForm(false)
                  setShowCreateForm(false)
                }}
                className="text-purple-600 hover:text-purple-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loading State */}
            {loadingRules && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            )}

            {/* Existing Rules List */}
            {!loadingRules && !showCreateForm && (
              <div className="space-y-3">
                {existingRules.length > 0 ? (
                  <>
                    <div className="text-sm text-gray-600 mb-3">
                      {existingRules.length} rule{existingRules.length !== 1 ? 's' : ''} for this market
                    </div>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {existingRules.map((rule) => (
                        <div key={rule.id} className="bg-white p-3 rounded-lg border border-purple-200">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  rule.isActive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {rule.isActive ? 'Active' : 'Paused'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {rule.outcome}
                                </span>
                              </div>
                              
                              <div className="text-sm font-medium text-gray-900">
                                {rule.action} {rule.quantity} shares
                              </div>
                              
                              <div className="text-xs text-gray-600 mt-1">
                                Strategy: {rule.strategyType} - {formatStrategyDetails(rule)}
                              </div>
                              
                              <div className="text-xs text-gray-500 mt-1">
                                Executed: {rule.executionCount} / {rule.maxExecutions === 0 ? '∞' : rule.maxExecutions}
                              </div>
                            </div>
                            
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handleToggleRule(rule.id)}
                                className={`p-1.5 rounded hover:bg-gray-100 ${
                                  rule.isActive ? 'text-yellow-600' : 'text-green-600'
                                }`}
                                title={rule.isActive ? 'Pause' : 'Resume'}
                              >
                                {rule.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-1.5 rounded hover:bg-gray-100 text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Bot className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No auto-trade rules for this market yet</p>
                  </div>
                )}
                
                {/* Create New Rule Button */}
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 mt-4"
                >
                  <Bot className="w-4 h-4" />
                  Create New Rule
                </button>
              </div>
            )}

            {/* Create Form */}
            {!loadingRules && showCreateForm && (
              <form onSubmit={handleCreateAutoTrade} className="space-y-4">
              {/* Market Info (Read-only) */}
              <div className="bg-white p-3 rounded-lg border border-purple-200">
                <div className="text-xs text-gray-500 mb-1">Market</div>
                <div className="text-sm font-medium text-gray-900 line-clamp-2">
                  {market.question}
                </div>
                <div className="text-xs text-gray-500 mt-1">ID: {market.id}</div>
              </div>

              {/* Outcome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outcome
                </label>
                <select
                  value={autoTradeForm.outcome}
                  onChange={(e) => setAutoTradeForm({ ...autoTradeForm, outcome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              {/* Strategy Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strategy Type
                </label>
                <select
                  value={autoTradeForm.strategyType}
                  onChange={(e) => {
                    const newStrategy = e.target.value
                    setAutoTradeForm({
                      ...autoTradeForm,
                      strategyType: newStrategy,
                      triggerCondition: newStrategy === "PriceTarget" ? "Above" : "CrossAbove"
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="PriceTarget">Price Target</option>
                  <option value="MovingAverage">Moving Average</option>
                </select>
              </div>

              {/* Trigger Condition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Condition
                </label>
                <select
                  value={autoTradeForm.triggerCondition}
                  onChange={(e) => setAutoTradeForm({ ...autoTradeForm, triggerCondition: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  {autoTradeForm.strategyType === "PriceTarget" ? (
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

              {/* Target Price (for Price Target strategy) */}
              {autoTradeForm.strategyType === "PriceTarget" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Price (0-1)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={autoTradeForm.targetPrice}
                    onChange={(e) => setAutoTradeForm({ ...autoTradeForm, targetPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0.75"
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Example: 0.75 = 75%
                  </div>
                </div>
              )}

              {/* Moving Average Period (for MA strategy) */}
              {autoTradeForm.strategyType === "MovingAverage" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moving Average Period (days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={autoTradeForm.movingAvgPeriod}
                    onChange={(e) => setAutoTradeForm({ ...autoTradeForm, movingAvgPeriod: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="7"
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Example: 7 for 7-day moving average
                  </div>
                </div>
              )}

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={autoTradeForm.action}
                  onChange={(e) => setAutoTradeForm({ ...autoTradeForm, action: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity (shares)
                </label>
                <input
                  type="number"
                  min="1"
                  value={autoTradeForm.quantity}
                  onChange={(e) => setAutoTradeForm({ ...autoTradeForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="10"
                  required
                />
              </div>

              {/* Max Executions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Executions
                </label>
                <select
                  value={autoTradeForm.maxExecutions}
                  onChange={(e) => setAutoTradeForm({ ...autoTradeForm, maxExecutions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="1">1 time</option>
                  <option value="5">5 times</option>
                  <option value="10">10 times</option>
                  <option value="0">Unlimited</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  How many times this rule can execute
                </div>
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
                      checked={autoTradeForm.notificationChannels.includes("email")}
                      onChange={(e) => {
                        const channels = e.target.checked
                          ? [...autoTradeForm.notificationChannels, "email"]
                          : autoTradeForm.notificationChannels.filter(c => c !== "email")
                        setAutoTradeForm({ ...autoTradeForm, notificationChannels: channels })
                      }}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Email</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoTradeForm.notificationChannels.includes("discord")}
                      onChange={(e) => {
                        const channels = e.target.checked
                          ? [...autoTradeForm.notificationChannels, "discord"]
                          : autoTradeForm.notificationChannels.filter(c => c !== "discord")
                        setAutoTradeForm({ ...autoTradeForm, notificationChannels: channels })
                      }}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Discord</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Bot className="w-4 h-4" />
                  Create Rule
                </button>
              </div>
            </form>
            )}
          </div>
        )}

        {/* Status Badge */}
        {market.active && (
          <div className="mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
            Active
          </div>
        )}
      </div>
    </div>
  )
}
