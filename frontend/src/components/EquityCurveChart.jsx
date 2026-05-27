import { useEffect, useRef } from "react"
import Chart from "chart.js/auto"
import "chartjs-adapter-date-fns"

/**
 * EquityCurveChart
 * Renders cumulative realized P&L over time (the "equity curve"), with the
 * running peak and drawdown shaded underneath. Driven entirely from the trade
 * rows already present in the report — no extra API call required.
 *
 * Props:
 *   trades         : array of trade rows ({ time, action, profit, ... })
 *   initialCapital : starting capital so the y-axis can show equity in $
 */
const EquityCurveChart = ({ trades = [], initialCapital = 0 }) => {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const sorted = [...(trades || [])]
      .filter((t) => t && t.time)
      .sort((a, b) => new Date(a.time) - new Date(b.time))

    const equityPoints = []
    const drawdownPoints = []
    const peakPoints = []
    let cumulative = 0
    let peak = Number(initialCapital) || 0

    // Seed with the starting capital so the curve doesn't begin at 0.
    if (sorted.length > 0) {
      const firstTime = new Date(sorted[0].time)
      equityPoints.push({ x: firstTime, y: Number(initialCapital) || 0 })
      peakPoints.push({ x: firstTime, y: peak })
      drawdownPoints.push({ x: firstTime, y: 0 })
    }

    sorted.forEach((trade) => {
      const profit = Number(trade.profit)
      if (!Number.isFinite(profit) || trade.action !== "SELL") return
      cumulative += profit
      const equity = (Number(initialCapital) || 0) + cumulative
      if (equity > peak) peak = equity
      const drawdown = equity - peak // <= 0

      const x = new Date(trade.time)
      equityPoints.push({ x, y: equity })
      peakPoints.push({ x, y: peak })
      drawdownPoints.push({ x, y: drawdown })
    })

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    if (equityPoints.length === 0) {
      return
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        datasets: [
          {
            label: "Equity",
            data: equityPoints,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            fill: true,
            tension: 0.25,
            borderWidth: 2.2,
            pointRadius: 0,
            pointHoverRadius: 3,
            yAxisID: "yEquity",
          },
          {
            label: "Peak",
            data: peakPoints,
            borderColor: "rgba(148, 163, 184, 0.6)",
            borderDash: [4, 4],
            fill: false,
            tension: 0,
            borderWidth: 1.2,
            pointRadius: 0,
            yAxisID: "yEquity",
          },
          {
            label: "Drawdown",
            data: drawdownPoints,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.18)",
            fill: true,
            tension: 0.25,
            borderWidth: 1.6,
            pointRadius: 0,
            yAxisID: "yDrawdown",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.parsed.y)
                return `${ctx.dataset.label}: $${v.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              },
            },
          },
        },
        scales: {
          x: {
            type: "time",
            time: { tooltipFormat: "yyyy-MM-dd HH:mm" },
            grid: { display: false },
          },
          yEquity: {
            type: "linear",
            position: "left",
            title: { display: true, text: "Equity ($)" },
            ticks: {
              callback: (v) => `$${Number(v).toLocaleString("en-US")}`,
            },
          },
          yDrawdown: {
            type: "linear",
            position: "right",
            title: { display: true, text: "Drawdown ($)" },
            grid: { drawOnChartArea: false },
            ticks: {
              callback: (v) => `$${Number(v).toLocaleString("en-US")}`,
            },
          },
        },
      },
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [trades, initialCapital])

  const hasSells = (trades || []).some((t) => t?.action === "SELL")

  return (
    <div className="relative h-72 w-full">
      <canvas ref={canvasRef} />
      {!hasSells && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          No realized SELL trades yet — equity curve will appear once positions are closed.
        </div>
      )}
    </div>
  )
}

export default EquityCurveChart
