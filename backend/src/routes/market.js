const express = require("express")
const router = express.Router()

router.get("/stocks", async (req, res) => {
  try {
    const { symbol = "AAPL", interval = "1day", range = "1m" } = req.query
    const allowedIntervals = new Set(["1h", "1day", "1week"])
    const safeInterval = allowedIntervals.has(interval) ? interval : "1day"
    const allowedRanges = new Set(["1d", "1w", "1m"])
    const safeRange = allowedRanges.has(range) ? range : "1m"
    console.log("📌 symbol:", symbol, "interval:", safeInterval)

    const apiKey = process.env.TWELVE_API_KEY || "demo"
    const outputsize = getOutputSize(safeInterval, safeRange)
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${safeInterval}&outputsize=${outputsize}&apikey=${apiKey}`
    console.log("🌐 fetch url:", url)

    const response = await fetch(url)
    console.log("✅ fetched")

    const data = await response.json()
    console.log("📦 raw data keys:", Object.keys(data))

    if (!data.values) {
      console.log("❌ data.values not found", data?.status, data?.message)
      const fallback = buildMockSeries(safeInterval, safeRange)
      return res.json({
        symbol,
        interval: safeInterval,
        range: safeRange,
        ...fallback,
        average: Number(
          (fallback.prices.reduce((s, p) => s + p, 0) / fallback.prices.length).toFixed(2)
        ),
        changes: fallback.prices.map((price, i) => {
          if (i === 0) return null
          const prev = fallback.prices[i - 1]
          return Number((((price - prev) / prev) * 100).toFixed(2))
        }),
        source: "mock",
        note: data?.message || "Using mock data (missing or invalid API key)"
      })
    }

    const values = data.values.reverse()
    console.log("📊 values length:", values.length)

    const dates = values.map(v => v.datetime)
    const prices = values.map(v => Number(v.close))
    const opens = values.map(v => Number(v.open))
    const highs = values.map(v => Number(v.high))
    const lows = values.map(v => Number(v.low))
    const volumes = values.map(v => Number(v.volume ?? 0))
    const candles = values.map(v => ({
      date: v.datetime,
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number(v.volume ?? 0)
    }))

    console.log("📈 first price:", prices[0])

    const average =
      prices.reduce((sum, p) => sum + p, 0) / prices.length

    const changes = prices.map((price, i) => {
      if (i === 0) return null
      const prev = prices[i - 1]
      return Number((((price - prev) / prev) * 100).toFixed(2))
    })

    res.json({
      symbol,
      interval: safeInterval,
      range: safeRange,
      dates,
      prices,
      opens,
      highs,
      lows,
      volumes,
      candles,
      latest: candles[candles.length - 1] || null,
      average: Number(average.toFixed(2)),
      changes,
      source: apiKey === "demo" ? "demo" : "api"
    })
  } catch (err) {
    console.error("🔥 ERROR:", err)
    res.status(500).json({ error: "Market analytics failed" })
  }
})

function buildMockSeries(interval, range) {
  const points = getOutputSize(interval, range)
  const stepMs = interval === "1h" ? 60 * 60 * 1000 : interval === "1week" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const now = Date.now()
  let price = 260
  const dates = []
  const opens = []
  const highs = []
  const lows = []
  const prices = []
  const volumes = []

  for (let i = points - 1; i >= 0; i -= 1) {
    const ts = new Date(now - i * stepMs)
    const open = price + (Math.random() - 0.5) * 2
    const close = open + (Math.random() - 0.5) * 3
    const high = Math.max(open, close) + Math.random() * 2
    const low = Math.min(open, close) - Math.random() * 2
    price = close

    dates.push(formatDate(ts, interval === "1h"))
    opens.push(Number(open.toFixed(2)))
    highs.push(Number(high.toFixed(2)))
    lows.push(Number(low.toFixed(2)))
    prices.push(Number(close.toFixed(2)))
    volumes.push(Math.max(100, Math.floor(500 + Math.random() * 1500)))
  }

  const candles = dates.map((date, i) => ({
    date,
    open: opens[i],
    high: highs[i],
    low: lows[i],
    close: prices[i],
    volume: volumes[i]
  }))
  return { dates, opens, highs, lows, prices, volumes, candles }
}

function getOutputSize(interval, range) {
  if (interval === "1h") {
    if (range === "1d") return 24
    if (range === "1w") return 24 * 7
    return 24 * 30
  }
  if (interval === "1week") {
    if (range === "1m") return 4
    return 1
  }
  if (range === "1d") return 1
  if (range === "1w") return 7
  return 30
}

function formatDate(date, withTime) {
  const pad = (n) => String(n).padStart(2, "0")
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  if (!withTime) return `${yyyy}-${mm}-${dd}`
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

module.exports = router
