import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Chart } from "react-chartjs-2"
import {
  Chart as ChartJS,
  BarController,
  LineController,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
} from "chart.js"
import {
  CandlestickController,
  CandlestickElement
} from "chartjs-chart-financial"
import zoomPlugin from "chartjs-plugin-zoom"
import "chartjs-adapter-date-fns"

import Sidebar from "../components/Sidebar"
import GreetingBanner from "../components/GreetingBanner"
import MarketTable from "../components/MarketTable"
import ViewToggleBanner from "../components/ViewToggleBanner"
ChartJS.register(
  BarController,
  LineController,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  CandlestickController,
  CandlestickElement,
  zoomPlugin
)

export default function MarketAnalytics() {
  const [symbol, setSymbol] = useState("AAPL")
  const [interval, setInterval] = useState("1day")
  const [view, setView] = useState("chart")
  const [data, setData] = useState(null)
  const [dailyData, setDailyData] = useState(null)
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
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`)
        }
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

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"
    fetch(`${apiUrl}/market/stocks?symbol=${symbol}&interval=1day&range=1w`)
      .then(res => res.json())
      .then(result => {
        if (Array.isArray(result?.prices)) {
          setDailyData(result)
        }
      })
      .catch(() => setDailyData(null))
  }, [symbol])

  if (error) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="ml-64 flex-1 p-6 text-red-600">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="ml-64 flex-1 p-6">Loading analytics…</div>
      </div>
    )
  }

  const dates = data.dates ?? []
  const opens = data.opens ?? []
  const highs = data.highs ?? []
  const lows = data.lows ?? []
  const closes = data.prices ?? []
  const volumes = data.volumes ?? []
  const average = data.average ?? null

  const bannerSource = dailyData || data
  const closesForBanner = bannerSource?.prices || []
  const todayClose = closesForBanner[closesForBanner.length - 1]
  const prevClose = closesForBanner[closesForBanner.length - 2]

  const change =
    typeof todayClose === "number" && typeof prevClose === "number"
      ? todayClose - prevClose
      : null

  const changePercent =
    typeof todayClose === "number" && typeof prevClose === "number"
      ? (change / prevClose) * 100
      : null

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
      },
      ...(average != null ? [
        {
          type: "line",
          label: "Average",
          data: ohlcPoints.map(p => ({
            x: p.x,
            y: average
          })),
          borderColor: "rgba(107,114,128,0.8)",
          borderDash: [6, 6],
          borderWidth: 1,
          pointRadius: 0,
          tension: 0,
          yAxisID: "y"
        }
      ] : [])
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
      legend: {
        display: false,
        labels: {
          filter: item => item.text !== "Average"
        }
      }
    },
    scales: {
      x: {
        type: interval === "1h" ? "timeseries" : "time",
        time: { unit: timeUnit },
        grid: { display: false }
      },
      y: {
        position: "left",
        grid: {
          color: "rgba(148,163,184,0.25)"
        }
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

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 p-6">
        <GreetingBanner
          symbol={symbol}
          hoverCandle={hoverCandle}
          todayClose={todayClose}
          change={change}
          changePercent={changePercent}
          average={bannerSource?.average}
        />

        <h2 className="text-xl font-semibold my-4">📊 Market Analytics</h2>

        <ViewToggleBanner view={view} setView={setView} />

        <div className="flex gap-3 mb-4">
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="border px-3 py-1"
          >
            <option value="AAPL">AAPL</option>
            <option value="TSLA">TSLA</option>
            <option value="MSFT">MSFT</option>
          </select>

          <select
            value={interval}
            onChange={e => setInterval(e.target.value)}
            className="border px-3 py-1"
          >
            <option value="1h">1 hour</option>
            <option value="1day">1 day</option>
            <option value="1week">1 week</option>
          </select>
        </div>

        {view === "chart" && (
          <div className="flex flex-col gap-2">
            <div className="h-[420px]">
              <Chart
                type="candlestick"
                data={priceChartData}
                options={priceChartOptions}
              />
            </div>

            <div className="h-[160px]">
              <Chart
                type="bar"
                data={volumeChartData}
                options={volumeChartOptions}
              />
            </div>
          </div>
        )}

        {view === "table" && (
          <MarketTable data={data} />
        )}
      </div>
    </div>
  )
}
