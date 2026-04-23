/**
 * TradingSignalChart Component
 * Integrates renderTradingSignals with Chart.js for interactive visualization
 */

import React, { useEffect, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import {
  renderTradingSignals,
  validatePriceData,
  validateTrades
} from '../utils/chartSignalVisualizer'

/**
 * Renders an interactive price chart with buy/sell signal markers
 * 
 * @component
 * @param {Object} props
 * @param {Array} props.priceData - [{timestamp, price}, ...] - Required
 * @param {Array} props.trades - [{timestamp, action: 'BUY'|'SELL'}, ...] - Required
 * @param {string} props.title - Chart title
 * @param {string} props.containerId - HTML element ID for chart container
 * @param {Object} props.customColors - Override default colors
 * @param {boolean} props.showLegend - Display legend
 * @param {Function} props.onTrade Click - Callback when clicking a trade marker
 * 
 * @example
 * <TradingSignalChart
 *   priceData={priceData}
 *   trades={trades}
 *   title="BTC/USD with Trading Signals"
 *   containerId="chart-container"
 * />
 */
function TradingSignalChart({
  priceData = [],
  trades = [],
  title = 'Price Chart with Trading Signals',
  containerId = 'tradingSignalChart',
  customColors = {},
  showLegend = true,
  onTradeClick = null
}) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    // Validate inputs
    const priceValidation = validatePriceData(priceData)
    if (!priceValidation.valid) {
      setError(`Invalid price data: ${priceValidation.error}`)
      setLoading(false)
      return
    }

    const tradeValidation = validateTrades(trades)
    if (!tradeValidation.valid) {
      setError(`Invalid trades data: ${tradeValidation.error}`)
      setLoading(false)
      return
    }

    // Prepare data
    const sortedPriceData = [...priceData].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    )

    const labels = sortedPriceData.map(p => new Date(p.timestamp))
    const prices = sortedPriceData.map(p => p.price)

    // Default colors
    const colors = {
      line: 'rgba(59, 130, 246, 1)',
      buy: 'rgba(34, 197, 94, 1)',
      sell: 'rgba(239, 68, 68, 1)',
      background: 'rgba(59, 130, 246, 0.1)',
      ...customColors
    }

    // Base chart configuration
    const baseConfig = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Price',
            data: prices,
            borderColor: colors.line,
            backgroundColor: colors.background,
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointRadius: 1,
            pointHoverRadius: 3,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: showLegend,
            position: 'top'
          },
          title: {
            display: !!title,
            text: title,
            font: { size: 16 }
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            cornerRadius: 4,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            callbacks: {
              label: (context) => {
                if (context.dataset.label.includes('Buy')) {
                  return `🟢 Buy @ $${context.raw.y?.toFixed(4) || context.parsed.y.toFixed(4)}`
                }
                if (context.dataset.label.includes('Sell')) {
                  return `🔴 Sell @ $${context.raw.y?.toFixed(4) || context.parsed.y.toFixed(4)}`
                }
                return `Price: $${context.parsed.y.toFixed(4)}`
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                minute: 'HH:mm',
                hour: 'HH:mm',
                day: 'MMM DD'
              }
            },
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Price'
            },
            beginAtZero: false
          }
        }
      }
    }

    // Enhance with trading signals
    const enhancedConfig = renderTradingSignals({
      priceData: sortedPriceData,
      trades,
      chartConfig: baseConfig,
      colors: {
        buy: colors.buy,
        sell: colors.sell,
        synthetic: 'rgba(212, 212, 216, 1)'
      }
    })

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy()
    }

    // Create new chart
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) {
      setError('Failed to get canvas context')
      setLoading(false)
      return
    }

    chartRef.current = new Chart(ctx, enhancedConfig)
    setLoading(false)
  }, [priceData, trades, title, containerId, customColors, showLegend])

  // Cleanup
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [])

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium">Error: {error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border border-blue-300 border-t-blue-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Loading chart...</p>
          </div>
        </div>
      )}

      <div id={containerId} className={`w-full ${loading ? 'hidden' : ''}`}>
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ maxHeight: '500px' }}
        />
      </div>

      {/* Signal Legend */}
      {!loading && (trades?.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full" />
            <span className="text-gray-700">Buy Signals ({trades.filter(t => t.action?.toUpperCase() === 'BUY').length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full" />
            <span className="text-gray-700">Sell Signals ({trades.filter(t => t.action?.toUpperCase() === 'SELL').length})</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradingSignalChart
