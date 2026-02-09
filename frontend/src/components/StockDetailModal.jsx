import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Chart } from "react-chartjs-2"

export default function StockDetailModal({ symbol, name, onClose }) {
  const [interval, setInterval] = useState("1day")
  const [view, setView] = useState("chart")
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [hoverCandle, setHoverCandle] = useState(null)

  useEffect(() => {
    setError("")
    const range =
      interval === "1h" ? "1d" :
      interval === "1day" ? "1w" : "1m"

    const token = localStorage.getItem("token")
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

    fetch(`${apiUrl}/market/stocks?symbol=${symbol}&interval=${interval}&range=${range}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        return res.json()
      })
      .then(result => {
        const valid =
          Array.isArray(result?.dates) &&
          Array.isArray(result?.opens) &&
          Array.isArray(result?.highs) &&
          Array.isArray(result?.lows) &&
          Array.isArray(result?.prices)

        if (!valid || result?.error) {
          setError(result?.message || "No market data available")
          setData(null)
          return
        }
        setData(result)
      })
      .catch((err) => {
        console.error("Market data fetch error:", err)
        setError(`Failed to load market data: ${err.message}`)
      })
  }, [symbol, interval])

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-auto p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{symbol} - {name}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">×</button>
          </div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  const dates = data.dates ?? []
  const opens = data.opens ?? []
  const highs = data.highs ?? []
  const lows = data.lows ?? []
  const closes = data.prices ?? []
  const volumes = data.volumes ?? []

  const timeline = dates.map(d => {
    const safe = d.includes(" ") ? d.replace(" ", "T") : d
    return new Date(safe).getTime()
  })

  const ohlcPoints = timeline
    .map((x, i) => ({
      x,
      o: opens[i] ?? null,
      h: highs[i] ?? null,
      l: lows[i] ?? null,
      c: closes[i] ?? null
    }))
    .filter(p => p.o !== null)

  const volumePoints = timeline.map((x, i) => ({
    x,
    y: volumes[i] ?? 0
  }))

  const handleHover = (event, elements, chart) => {
    if (!elements || elements.length === 0) {
      setHoverCandle(null)
      return
    }

    const el = elements[0]
    const dataset = chart.data.datasets[el.datasetIndex]
    const raw = dataset.data[el.index]

    if (!raw) return

    setHoverCandle({
      date: raw.x,
      open: raw.o,
      high: raw.h,
      low: raw.l,
      close: raw.c
    })
  }

  const timeUnit =
    interval === "1h" ? "hour" :
    interval === "1week" ? "week" : "day"

  const priceChartData = {
    datasets: [
      {
        type: "candlestick",
        label: `${symbol} OHLC`,
        data: ohlcPoints,
        parsing: false,
        color: {
          up: "#22c55e",
          down: "#ef4444",
          unchanged: "#9ca3af"
        }
      }
    ]
  }

  const priceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "nearest",
      intersect: false
    },
    onHover: handleHover,
    plugins: {
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        titleColor: "#fff",
        bodyColor: "#e5e7eb",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        displayColors: false,
        callbacks: {
          title: (items) => {
            const x = items?.[0]?.raw?.x
            if (!x) return ""
            return format(new Date(x), "MMM d, yyyy HH:mm")
          },
          label: (context) => {
            const { o, h, l, c } = context.raw || {}
            if ([o, h, l, c].some(v => v == null)) return ""
            return [
              `O: ${o.toFixed(2)}`,
              `H: ${h.toFixed(2)}`,
              `L: ${l.toFixed(2)}`,
              `C: ${c.toFixed(2)}`
            ]
          }
        }
      },
      legend: { display: false }
    },
    scales: {
      x: {
        type: interval === "1h" ? "timeseries" : "time",
        time: { unit: timeUnit },
        grid: { display: false }
      },
      y: {
        position: "left",
        grid: { color: "rgba(148,163,184,0.25)" }
      }
    }
  }

  const volumeChartData = {
    datasets: [
      {
        type: "bar",
        label: "Volume",
        data: volumePoints,
        parsing: false,
        backgroundColor: "rgba(59,130,246,0.35)",
        borderWidth: 0
      }
    ]
  }

  const maxVolume = Math.max(0, ...volumePoints.map(v => v.y))

  const volumeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        type: interval === "1h" ? "timeseries" : "time",
        time: { unit: timeUnit },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        suggestedMax: maxVolume * 1.5,
        grid: { display: false },
        ticks: {
          callback: v => `${Math.round(v / 1000)}k`
        }
      }
    }
  }

  // 计算表格数据
  const tableData = dates.map((date, i) => ({
    date,
    open: opens[i],
    high: highs[i],
    low: lows[i],
    close: closes[i],
    volume: volumes[i]
  })).reverse()

  // 计算价格统计
  const currentPrice = closes[closes.length - 1]
  const prevPrice = closes[closes.length - 2]
  const change = currentPrice - prevPrice
  const changePercent = (change / prevPrice) * 100
  const isPositive = change >= 0
  const average = data.average || (closes.reduce((a, b) => a + b, 0) / closes.length)

  const KpiBlock = ({ value, label, isUp }) => (
    <div className="px-6 border-r border-gray-200 last:border-r-0">
      <h3 className="flex items-start text-2xl font-semibold text-gray-800">
        {value}
        {isUp !== undefined && (
          <span className={`text-base ml-1 ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "↗" : "↘"}
          </span>
        )}
      </h3>
      <p className="text-xs mt-1 text-gray-600">{label}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">{symbol}</h2>
            <p className="text-gray-600">{name}</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-800 text-3xl font-light w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full"
          >
            ×
          </button>
        </div>

        {/* KPI Blocks */}
        <div className="flex items-center bg-blue-50 p-6 rounded-2xl mb-6">
          <KpiBlock
            value={`$${currentPrice?.toFixed(2) || "—"}`}
            label="Today's Price"
            isUp={isPositive}
          />
          <KpiBlock
            value={`${changePercent?.toFixed(2) || "—"}%`}
            label="vs Previous"
            isUp={isPositive}
          />
          <KpiBlock
            value={`$${average?.toFixed(2) || "—"}`}
            label="Average Price"
          />
        </div>

        {/* View Toggle and Time Interval */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView("chart")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              view === "chart"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📈 Chart View
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              view === "table"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            📊 Table View
          </button>

          {/* Time Interval Buttons */}
          <div className="flex gap-2 ml-auto">
            {[
              { value: "1h", label: "1H" },
              { value: "1day", label: "1D" },
              { value: "1week", label: "1W" }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setInterval(value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  interval === value
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        {view === "chart" && (
          <div className="flex flex-col gap-4">
            {/* Hover Info */}
            {hoverCandle && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  {format(new Date(hoverCandle.date), "MMM d, yyyy HH:mm")}
                </p>
                <div className="grid grid-cols-4 gap-4 mt-2">
                  <div>
                    <p className="text-xs text-gray-500">Open</p>
                    <p className="font-bold">${hoverCandle.open?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">High</p>
                    <p className="font-bold">${hoverCandle.high?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Low</p>
                    <p className="font-bold">${hoverCandle.low?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Close</p>
                    <p className="font-bold">${hoverCandle.close?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Price Chart */}
            <div className="h-[400px]">
              <Chart
                type="candlestick"
                data={priceChartData}
                options={priceChartOptions}
              />
            </div>

            {/* Volume Chart */}
            <div className="h-[150px]">
              <Chart
                type="bar"
                data={volumeChartData}
                options={volumeChartOptions}
              />
            </div>
          </div>
        )}

        {view === "table" && (
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Open</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">High</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Low</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Close</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tableData.map((row, i) => {
                  const change = row.close - row.open
                  const isPositive = change >= 0
                  const changePercent = ((change / row.open) * 100).toFixed(2)
                  
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">${row.open?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">${row.high?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">${row.low?.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-sm font-semibold text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        ${row.close?.toFixed(2)}
                        <span className="text-xs ml-2">
                          {isPositive ? '↗' : '↘'} {isPositive ? '+' : ''}{changePercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{row.volume?.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
