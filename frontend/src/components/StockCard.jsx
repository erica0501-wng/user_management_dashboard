import { useState } from "react"

export default function StockCard({ 
  symbol, 
  name, 
  price, 
  change, 
  changePercent, 
  average, 
  onClick,
  historicalData = [], // 用于显示迷你图表
  isInWatchlist = false,
  onToggleWatchlist,
  onBuy // 新增购买回调
}) {
  const isPositive = change >= 0

  // 蜡烛图组件
  const MiniChart = ({ data }) => {
    if (!data || data.length === 0) return null
    
    // 获取所有价格数据用于计算范围
    const allPrices = data.flatMap(d => {
      if (d.high && d.low) return [d.high, d.low]
      return [d.close || d.price]
    })
    const max = Math.max(...allPrices)
    const min = Math.min(...allPrices)
    const range = max - min || 1
    
    const candleWidth = 100 / (data.length * 1.5)
    const spacing = candleWidth * 0.3
    
    return (
      <div className="h-full w-full">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {data.map((candle, i) => {
            const open = candle.open || candle.close || candle.price
            const high = candle.high || open
            const low = candle.low || open
            const close = candle.close || candle.price
            
            const isGreen = close >= open
            const color = isGreen ? '#10b981' : '#ef4444'
            
            const x = (i / data.length) * 100 + spacing
            const yHigh = 100 - ((high - min) / range) * 100
            const yLow = 100 - ((low - min) / range) * 100
            const yOpen = 100 - ((open - min) / range) * 100
            const yClose = 100 - ((close - min) / range) * 100
            
            const bodyTop = Math.min(yOpen, yClose)
            const bodyHeight = Math.abs(yOpen - yClose) || 1
            
            return (
              <g key={i}>
                {/* 上下影线 */}
                <line
                  x1={x + candleWidth / 2}
                  y1={yHigh}
                  x2={x + candleWidth / 2}
                  y2={yLow}
                  stroke={color}
                  strokeWidth="1"
                />
                {/* 蜡烛主体 */}
                <rect
                  x={x}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  stroke={color}
                  strokeWidth="0.5"
                />
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  const KpiBlock = ({ value, label, isUp }) => (
    <div className="py-1.5">
      <h3 className="flex items-center text-lg font-semibold text-gray-800">
        {value}
        {isUp !== undefined && (
          <span className={`text-sm ml-1 ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "↗" : "↘"}
          </span>
        )}
      </h3>
      <p className="text-xs mt-0.5 text-gray-600">{label}</p>
    </div>
  )

  const handleWatchlistClick = (e) => {
    console.log('❤️ Heart button clicked for:', symbol)
    e.stopPropagation() // 防止触发卡片的 onClick
    if (onToggleWatchlist) {
      console.log('✅ Calling onToggleWatchlist')
      onToggleWatchlist(symbol)
    } else {
      console.log('❌ onToggleWatchlist is not defined')
    }
  }

  const handleBuyClick = (e) => {
    e.stopPropagation() 
    if (onBuy) {
      onBuy(symbol, price)
    }
  }

  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-200 hover:border-blue-300 h-full relative"
    >
      {/* Buy/Trade 按钮 - 美元符号图标 */}
      <button
        onClick={handleBuyClick}
        className="absolute top-3 right-12 z-10 hover:scale-110 transition-transform p-1"
        title="Buy Stock"
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="text-gray-600 hover:text-green-600"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
          <path d="M12 18V6"></path>
        </svg>
      </button>

      {/* Watchlist 爱心按钮 */}
      <button
        onClick={handleWatchlistClick}
        className="absolute top-3 right-3 z-10 hover:scale-110 transition-transform p-1"
        title={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill={isInWatchlist ? "currentColor" : "none"}
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={isInWatchlist ? "text-red-500" : "text-gray-600 hover:text-red-500"}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>

      {/* Stock Name */}
      <div className="mb-3 border-b border-gray-100 pb-2 pr-16">
        <h3 className="text-lg font-bold text-gray-800">{symbol}</h3>
        <p className="text-xs text-gray-500 truncate">{name}</p>
      </div>

      {/* KPI Blocks 和图表并排显示 */}
      <div className="flex items-center gap-3">
        {/* 左侧 KPI 数据 */}
        <div className="flex-1 space-y-1">
          <KpiBlock
            value={`$${price?.toFixed(2) || "—"}`}
            label="Today's Price"
            isUp={isPositive}
          />
          <KpiBlock
            value={`${changePercent?.toFixed(2) || "—"}%`}
            label="vs Previous"
            isUp={isPositive}
          />
          <KpiBlock
            value={average ? `$${average.toFixed(2)}` : "—"}
            label="Average Price"
          />
        </div>

        {/* 右侧迷你图表 */}
        <div className="w-32 h-24 flex-shrink-0">
          <MiniChart data={historicalData} />
        </div>
      </div>
    </div>
  )
}
