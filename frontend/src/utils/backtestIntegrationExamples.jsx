/**
 * Integration Example: Using Chart Signal Visualizer with Backtest Results
 * 
 * This shows how to integrate the trading signal visualizer with your
 * existing BacktestDetails and BacktestChart components
 */

// ============ INTEGRATION APPROACH 1: React Component (Recommended) ============

import React from 'react'
import TradingSignalChart from '../components/TradingSignalChart'

/**
 * Enhanced BacktestDetailsWithSignals
 * Drop-in replacement for BacktestDetails with trading signal visualization
 */
export function BacktestDetailsWithSignals({
  backtest,
  selectedMarketId = null
}) {
  const [aggregationMode, setAggregationMode] = React.useState('average')

  // Transform backtest data to chart format
  const priceData = React.useMemo(() => {
    if (!backtest?.marketPriceSeries) return []

    const marketId = selectedMarketId === 'all'
      ? null
      : selectedMarketId

    const prices = marketId
      ? (backtest.marketPriceSeries[marketId] || [])
      : Object.values(backtest.marketPriceSeries)
          .reduce((acc, arr) => [...acc, ...(arr || [])], [])

    return prices.map(snapshot => ({
      timestamp: snapshot.intervalStart || snapshot.createdAt,
      price: Array.isArray(snapshot.outcomePrices)
        ? Number(snapshot.outcomePrices[0])
        : 0.5
    }))
  }, [backtest?.marketPriceSeries, selectedMarketId])

  // Transform trade history to signal format
  const trades = React.useMemo(() => {
    if (!backtest?.tradeHistory) return []

    return backtest.tradeHistory.map(trade => ({
      timestamp: trade.time,
      action: trade.action // 'BUY' or 'SELL'
    }))
  }, [backtest?.tradeHistory])

  return (
    <div className="space-y-6">
      {/* Existing backtest stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600">ROI</p>
          <p className="text-2xl font-bold text-blue-600">{backtest?.roi}%</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-gray-600">Total Trades</p>
          <p className="text-2xl font-bold text-green-600">{backtest?.totalTrades}</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-sm text-gray-600">Win Rate</p>
          <p className="text-2xl font-bold text-purple-600">{backtest?.winRate.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg">
          <p className="text-sm text-gray-600">Max Drawdown</p>
          <p className="text-2xl font-bold text-orange-600">-{backtest?.maxDrawdown.toFixed(1)}%</p>
        </div>
      </div>

      {/* NEW: Trading Signal Chart */}
      {priceData.length > 0 && trades.length > 0 && (
        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Trading Signals</h2>
          
          <TradingSignalChart
            priceData={priceData}
            trades={trades}
            title={`${backtest?.groupName} - ${backtest?.strategyName}`}
            customColors={{
              buy: 'rgba(34, 197, 94, 1)',     // Green stars
              sell: 'rgba(239, 68, 68, 1)',    // Red stars
              synthetic: 'rgba(107, 114, 128, 1)' // Gray for auto-close
            }}
            showLegend={true}
          />
        </div>
      )}

      {/* Trade details table */}
      {trades.length > 0 && (
        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Trade Details</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Time</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Action</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Price</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Shares</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">P&L</th>
                </tr>
              </thead>
              <tbody>
                {backtest?.tradeHistory?.map((trade, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {new Date(trade.time).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-white font-medium text-xs ${
                        trade.action === 'BUY'
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}>
                        {trade.action}
                      </span>
                    </td>
                    <td className="px-4 py-2">${trade.price?.toFixed(4)}</td>
                    <td className="px-4 py-2">{trade.shares?.toFixed(0)}</td>
                    <td className="px-4 py-2 font-medium">
                      <span className={trade.profit > 0 ? 'text-green-600' : 'text-red-600'}>
                        ${trade.profit?.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


// ============ INTEGRATION APPROACH 2: Standalone Utility Function ============

import {
  renderTradingSignals,
  validatePriceData,
  validateTrades,
  processTrades
} from '../utils/chartSignalVisualizer'

/**
 * Utility function to create Chart.js config for backtest visualization
 * Use with: new Chart(ctx, createBacktestChartConfig(...))
 */
export function createBacktestChartConfig({
  backtest,
  selectedMarketId = null,
  highlightWinningTrades = false
}) {
  // Transform marketPriceSeries to priceData format
  const allMarketsPrices = selectedMarketId === 'all' || !selectedMarketId
    ? Object.values(backtest.marketPriceSeries || {})
        .reduce((acc, arr) => [...acc, ...(arr || [])], [])
    : (backtest.marketPriceSeries?.[selectedMarketId] || [])

  const priceData = allMarketsPrices.map(snapshot => ({
    timestamp: snapshot.intervalStart || snapshot.createdAt,
    price: Array.isArray(snapshot.outcomePrices)
      ? Number(snapshot.outcomePrices[0])
      : 0.5
  }))

  // Transform tradeHistory to trades format
  const trades = (backtest.tradeHistory || []).map(trade => ({
    timestamp: trade.time,
    action: trade.action,
    profit: trade.profit,
    shares: trade.shares
  }))

  // Validate
  if (!validatePriceData(priceData).valid) {
    console.warn('Invalid price data for backtest chart')
    return null
  }

  if (!validateTrades(trades).valid) {
    console.warn('Invalid trades data for backtest chart')
    return null
  }

  // Create base config
  const baseConfig = {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Price',
          data: priceData.map(p => ({ x: new Date(p.timestamp), y: p.price })),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${backtest.groupName} - ${backtest.strategyName}`,
          font: { size: 14 }
        },
        legend: { display: true }
      },
      scales: {
        x: { type: 'time' },
        y: { beginAtZero: false }
      }
    }
  }

  // Enhance with signals
  return renderTradingSignals({
    priceData,
    trades,
    chartConfig: baseConfig
  })
}


// ============ INTEGRATION APPROACH 3: Batch Processing Multiple Backtests ============

/**
 * Create comparison chart with multiple backtests
 */
export function createBacktestComparison(backtests) {
  const datasets = []

  backtests.forEach((backtest, idx) => {
    // Price line for each backtest
    const prices = Object.values(backtest.marketPriceSeries || {})
      .reduce((acc, arr) => [...acc, ...(arr || [])], [])
      .map(p => ({
        timestamp: p.intervalStart,
        price: Array.isArray(p.outcomePrices) ? p.outcomePrices[0] : 0.5
      }))

    datasets.push({
      label: `${backtest.strategyName} (ROI: ${backtest.roi}%)`,
      data: prices.map(p => ({ x: new Date(p.timestamp), y: p.price })),
      borderWidth: 2,
      tension: 0.1,
      fill: false
    })
  })

  return {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Strategy Comparison' },
        legend: { display: true }
      },
      scales: {
        x: { type: 'time' },
        y: { beginAtZero: false }
      }
    }
  }
}


// ============ INTEGRATION APPROACH 4: Real-time Signal Display ============

/**
 * Component for live trading signals during active backtest
 */
export function LiveTradingSignals({
  livePrice,
  recentTrades,
  maxTradesToShow = 5
}) {
  const priceData = [{
    timestamp: new Date(),
    price: livePrice
  }]

  const visibleTrades = recentTrades.slice(-maxTradesToShow)

  return (
    <div className="p-4 bg-white rounded-lg border">
      <h3 className="font-semibold mb-4">Recent Signals</h3>
      
      <div className="space-y-2">
        {visibleTrades.map((trade, idx) => (
          <div
            key={idx}
            className={`p-3 rounded flex justify-between items-center ${
              trade.action === 'BUY'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div>
              <span className={`font-bold ${
                trade.action === 'BUY' ? 'text-green-700' : 'text-red-700'
              }`}>
                {trade.action}
              </span>
              <p className="text-xs text-gray-600 mt-1">
                {new Date(trade.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">${trade.price?.toFixed(4)}</p>
              {trade.profit && (
                <p className={`text-sm ${
                  trade.profit > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trade.profit > 0 ? '+' : ''}{trade.profit?.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ============ EXPORT FOR USE ============

export default {
  BacktestDetailsWithSignals,
  createBacktestChartConfig,
  createBacktestComparison,
  LiveTradingSignals
}
