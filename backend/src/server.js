const app = require("./app")
const alertMonitoringService = require("./services/alertMonitoring")
const autoTraderMonitoringService = require("./services/autoTraderMonitoring")
const polymarketDataArchiver = require("./services/polymarketDataArchiver")

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)

  // Avoid starting background intervals on serverless hosts unless explicitly enabled.
  const shouldRunBackgroundMonitors =
    process.env.ENABLE_BACKGROUND_MONITORS === "true" && process.env.VERCEL !== "1"
  const shouldRunPolymarketArchiver =
    process.env.ENABLE_POLYMARKET_ARCHIVER === "true" && process.env.VERCEL !== "1"

  if (shouldRunBackgroundMonitors) {
    // Start alert monitoring service
    alertMonitoringService.start()

    // Start auto-trader monitoring service
    autoTraderMonitoringService.start()
  } else {
    console.log("ℹ️ Background monitors are disabled (set ENABLE_BACKGROUND_MONITORS=true to enable)")
  }

  if (shouldRunPolymarketArchiver) {
    polymarketDataArchiver.start()
  } else {
    console.log("ℹ️ Polymarket archiver is disabled (set ENABLE_POLYMARKET_ARCHIVER=true to enable)")
  }
})
