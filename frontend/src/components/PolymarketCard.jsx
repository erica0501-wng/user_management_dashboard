import { useState } from "react"

export default function PolymarketCard({ market }) {
  const [showDetails, setShowDetails] = useState(false)

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
        <div className="flex gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            {showDetails ? "Hide" : "Details"}
          </button>
          <button
            onClick={() => window.open(`https://polymarket.com/event/${market.id}`, "_blank")}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Trade
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
