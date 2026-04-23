import { useEffect, useRef, useState } from "react"
import Chart from "chart.js/auto"
import "chartjs-adapter-date-fns"
import zoomPlugin from "chartjs-plugin-zoom"

Chart.register(zoomPlugin)

const BacktestChart = ({ trades, priceSeries = [] }) => {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [showYes, setShowYes] = useState(true)
  const [showNo, setShowNo] = useState(true)

  const findClosestPricePoint = (series, targetTimestamp) => {
    if (!Array.isArray(series) || series.length === 0 || !targetTimestamp) {
      return null
    }

    const targetTime = new Date(targetTimestamp).getTime()
    if (!Number.isFinite(targetTime)) {
      return null
    }

    let closestPoint = null
    let closestDistance = Infinity

    for (const point of series) {
      const pointTime = new Date(point.time).getTime()
      if (!Number.isFinite(pointTime)) {
        continue
      }

      const distance = Math.abs(pointTime - targetTime)
      if (distance < closestDistance) {
        closestDistance = distance
        closestPoint = point
      }
    }

    return closestPoint
  }

  const clampProbability = (value) => {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) {
      return null
    }
    return Math.min(1, Math.max(0, numberValue))
  }

  const toProbability = (value) => {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) {
      return null
    }

    // Already in probability format.
    if (numberValue >= 0 && numberValue <= 1) {
      return numberValue
    }

    // Common percentage format (0-100).
    if (numberValue > 1 && numberValue <= 100) {
      return numberValue / 100
    }

    return null
  }

  const resolveYesPrice = (point) => {
    const yesCandidate = clampProbability(toProbability(point?.yesPrice))
    if (yesCandidate !== null) return yesCandidate

    const altYesCandidate = clampProbability(
      toProbability(point?.yes_price ?? point?.price_yes)
    )
    if (altYesCandidate !== null) return altYesCandidate

    const fallbackCandidate = clampProbability(toProbability(point?.price))
    if (fallbackCandidate !== null) return fallbackCandidate

    return null
  }

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "-"
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(timestamp))
  }

  const zoomChart = (factor) => {
    if (!chartRef.current) return
    chartRef.current.zoom({ x: factor }, "none")
  }

  const panChart = (delta) => {
    if (!chartRef.current) return
    chartRef.current.pan({ x: delta }, undefined, "none")
  }

  const resetChart = () => {
    if (!chartRef.current) return
    chartRef.current.resetZoom("none")
  }

  useEffect(() => {
    if (!canvasRef.current) return

    const hasTrades = Array.isArray(trades) && trades.length > 0
    const hasPriceSeries = Array.isArray(priceSeries) && priceSeries.length > 0

    if (!hasTrades && !hasPriceSeries) return

    const sortedTrades = hasTrades
      ? [...trades].sort((left, right) => new Date(left.time) - new Date(right.time))
      : []

    const sortedPriceSeries = hasPriceSeries
      ? [...priceSeries].sort((left, right) => new Date(left.time) - new Date(right.time))
      : []

    const baseYesPricePoints = sortedPriceSeries
      .map((point) => {
        const directYesPrice = resolveYesPrice(point)
        const noPrice =
          directYesPrice !== null
            ? clampProbability(1 - directYesPrice)
            : null
        const yesPrice =
          directYesPrice !== null
            ? directYesPrice
            : noPrice !== null
              ? clampProbability(1 - noPrice)
              : null

        if (yesPrice === null && noPrice === null) {
          return null
        }

        return {
          x: new Date(point.time),
          y: yesPrice,
          yesPrice,
          noPrice,
        }
      })
      .filter(Boolean)

    const baseNoPricePoints = baseYesPricePoints.map((point) => {
      const noPrice = clampProbability(1 - point.yesPrice)
      return {
        x: point.x,
        y: noPrice,
        yesPrice: point.yesPrice,
        noPrice,
      }
    })

    const fallbackYesFromTrades = sortedTrades
      .map((trade) => {
        const yesPrice = clampProbability(toProbability(trade?.price))
        if (yesPrice === null) return null

        return {
          x: new Date(trade.time),
          y: yesPrice,
          yesPrice,
          noPrice: clampProbability(1 - yesPrice),
        }
      })
      .filter(Boolean)

    const yesPricePoints = baseYesPricePoints.length > 0 ? baseYesPricePoints : fallbackYesFromTrades
    const noPricePoints = baseNoPricePoints.length > 0
      ? baseNoPricePoints
      : fallbackYesFromTrades.map((point) => ({ ...point, y: point.noPrice }))

    const inspectedNoValues = noPricePoints
      .map((point) => point?.y)
      .filter((value) => Number.isFinite(value))

    const noLineAllZero = inspectedNoValues.length > 0 && inspectedNoValues.every((value) => value === 0)
    const noLineAllSame =
      inspectedNoValues.length > 1 &&
      inspectedNoValues.every((value) => value === inspectedNoValues[0])

    if (typeof window !== "undefined") {
      console.log("[BacktestChart] No Price inspection", {
        totalPoints: noPricePoints.length,
        finiteValueCount: inspectedNoValues.length,
        sample: noPricePoints.slice(0, 12),
        allZero: noLineAllZero,
        allSame: noLineAllSame,
        min: inspectedNoValues.length ? Math.min(...inspectedNoValues) : null,
        max: inspectedNoValues.length ? Math.max(...inspectedNoValues) : null,
      })
    }

    const pricePoints = yesPricePoints

    if (pricePoints.length === 0) {
      sortedTrades.forEach((trade) => {
        pricePoints.push({ x: new Date(trade.time), y: Number(trade.price || 0) })
      })
    }

    const buyPoints = []
    const sellPoints = []
    const autoClosePoints = []

    sortedTrades.forEach((trade) => {
      const matchedPricePoint = findClosestPricePoint(sortedPriceSeries, trade.time)
      const point = {
        x: matchedPricePoint ? new Date(matchedPricePoint.time) : new Date(trade.time),
        // Keep markers anchored to Yes line for consistency with strategy execution price.
        y: resolveYesPrice(matchedPricePoint) ?? clampProbability(toProbability(trade.price)) ?? 0,
        yesPrice: resolveYesPrice(matchedPricePoint) ?? clampProbability(toProbability(trade.price)) ?? 0,
        noPrice:
          clampProbability(
            1 - (resolveYesPrice(matchedPricePoint) ?? clampProbability(toProbability(trade.price)) ?? 0)
          ) ?? 0,
      }
      const normalizedAction = String(trade.action || "").toUpperCase()
      const isAutoClose = String(trade.signal || "").toLowerCase().includes("auto-close")

      if (normalizedAction === "BUY") {
        buyPoints.push({ ...point, signal: trade.signal || null })
      } else if (normalizedAction === "SELL") {
        const sellPoint = { ...point, isAutoClose, signal: trade.signal || null }
        if (isAutoClose) {
          autoClosePoints.push(sellPoint)
        } else {
          sellPoints.push(sellPoint)
        }
      }
    })

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    const lineDatasets = []

    if (showYes) {
      lineDatasets.push({
        label: "Yes Price",
        data: yesPricePoints.length > 0 ? yesPricePoints : pricePoints,
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14, 165, 233, 0.12)",
        fill: false,
        tension: 0.24,
        cubicInterpolationMode: "monotone",
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2.4,
        order: 1,
        yAxisID: "yYes",
      })
    }

    if (showNo) {
      lineDatasets.push({
        label: "No Price",
        data: noPricePoints,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        fill: false,
        tension: 0.24,
        cubicInterpolationMode: "monotone",
        spanGaps: true,
        pointRadius: noLineAllZero ? 2.5 : 1.6,
        pointHoverRadius: noLineAllZero ? 5 : 4,
        pointBackgroundColor: "#ef4444",
        pointBorderColor: "#b91c1c",
        pointBorderWidth: 0.8,
        borderWidth: 2.6,
        borderDash: noLineAllZero ? [3, 5] : [6, 4],
        order: 2,
        yAxisID: "yNo",
      })
    }

    const ctx = canvasRef.current.getContext("2d")
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          ...lineDatasets,
          {
            label: "Buy (Entry)",
            data: buyPoints,
            type: "scatter",
            pointRadius: 10,
            pointHoverRadius: 13,
            pointStyle: "star",
            pointBackgroundColor: "#22c55e",
            pointBorderColor: "#14532d",
            pointBorderWidth: 2.5,
            showLine: false,
            order: 3,
            clip: false,
            yAxisID: "yYes",
          },
          {
            label: "Sell (Exit)",
            data: sellPoints,
            type: "scatter",
            pointRadius: (context) => (context.raw?.isAutoClose ? 11 : 10),
            pointHoverRadius: 13,
            pointStyle: "star",
            pointBackgroundColor: "#ef4444",
            pointBorderColor: (context) => (context.raw?.isAutoClose ? "#f59e0b" : "#7f1d1d"),
            pointBorderWidth: (context) => (context.raw?.isAutoClose ? 3.5 : 2.5),
            showLine: false,
            order: 4,
            clip: false,
            yAxisID: "yYes",
          },
          {
            label: "Auto-close (Forced Exit)",
            data: autoClosePoints,
            type: "scatter",
            pointRadius: 11,
            pointHoverRadius: 13,
            pointStyle: "star",
            pointBackgroundColor: "#f59e0b",
            pointBorderColor: "#92400e",
            pointBorderWidth: 3,
            showLine: false,
            order: 5,
            clip: false,
            yAxisID: "yYes",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        interaction: {
          mode: "nearest",
          intersect: false,
        },
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              mode: "x",
            },
            zoom: {
              wheel: {
                enabled: true,
                speed: 0.12,
              },
              pinch: {
                enabled: true,
              },
              drag: {
                enabled: true,
                backgroundColor: "rgba(14, 165, 233, 0.08)",
                borderColor: "rgba(14, 165, 233, 0.35)",
                borderWidth: 1,
              },
              mode: "x",
            },
          },
          legend: {
            display: true,
            position: "top",
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 12,
                weight: "500",
              },
            },
          },
          tooltip: {
            backgroundColor: "rgba(17, 24, 39, 0.92)",
            padding: 12,
            titleFont: { size: 13, weight: "bold" },
            bodyFont: { size: 12 },
            displayColors: true,
            callbacks: {
              title: (context) => formatDateTime(context?.[0]?.parsed?.x),
              label: (context) => {
                const yesPrice = clampProbability(context.raw?.yesPrice)
                const noPrice = clampProbability(context.raw?.noPrice)
                const yesText = yesPrice !== null ? `Yes: ${yesPrice.toFixed(4)}` : "Yes: N/A"
                const noText = noPrice !== null ? `No: ${noPrice.toFixed(4)}` : "No: N/A"

                const priceLabel = `${context.dataset.label}: ${Number(context.parsed.y).toFixed(4)}`
                const signal = context.raw?.signal
                const autoCloseTag = context.dataset.label === "Auto-close (Forced Exit)" ? " (自动平仓)" : context.raw?.isAutoClose ? " (Auto-close at end)" : ""

                if (context.dataset.type === "scatter") {
                  const markerSummary = `${priceLabel}${autoCloseTag}`
                  return signal
                    ? [markerSummary, `${yesText} | ${noText}`, `Signal: ${signal}`]
                    : [markerSummary, `${yesText} | ${noText}`]
                }

                return [priceLabel, `${yesText} | ${noText}`]
              },
            },
          },
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "hour",
              tooltipFormat: "dd/MM/yyyy HH:mm:ss",
              displayFormats: {
                hour: "HH:mm",
              },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.14)",
            },
            ticks: {
              maxTicksLimit: 10,
              font: { size: 10 },
              color: "#64748b",
            },
          },
          yYes: {
            type: "linear",
            display: true,
            position: "left",
            min: 0,
            max: 1,
            grid: {
              color: "rgba(148, 163, 184, 0.14)",
            },
            title: {
              display: true,
              text: "Yes Price (0-1)",
              font: { size: 12, weight: "bold" },
            },
            ticks: {
              callback: (value) => Number(value).toFixed(3),
              font: { size: 11 },
              color: "#64748b",
            },
          },
          yNo: {
            type: "linear",
            display: true,
            position: "right",
            min: 0,
            max: 1,
            grid: {
              drawOnChartArea: false,
            },
            title: {
              display: true,
              text: "No Price (0-1)",
              font: { size: 12, weight: "bold" },
            },
            ticks: {
              callback: (value) => Number(value).toFixed(3),
              font: { size: 11 },
              color: "#64748b",
            },
          },
        },
      },
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
      }
    }
  }, [trades, priceSeries, showYes, showNo])

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showYes}
            onChange={(event) => setShowYes(event.target.checked)}
            className="h-3.5 w-3.5"
          />
          Show Yes
        </label>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showNo}
            onChange={(event) => setShowNo(event.target.checked)}
            className="h-3.5 w-3.5"
          />
          Show No
        </label>
        <button
          type="button"
          onClick={() => zoomChart(1.2)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Zoom in
        </button>
        <button
          type="button"
          onClick={() => zoomChart(0.8)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Zoom out
        </button>
        <button
          type="button"
          onClick={() => panChart(-120)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Pan left
        </button>
        <button
          type="button"
          onClick={() => panChart(120)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Pan right
        </button>
        <button
          type="button"
          onClick={resetChart}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Reset
        </button>
        <span className="ml-auto text-xs text-slate-500">
          Drag horizontally, scroll to zoom, or use the buttons above.
        </span>
      </div>
      <div className="relative h-96">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  )
}

export default BacktestChart
