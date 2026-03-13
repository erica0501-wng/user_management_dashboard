const app = require("./app")
const alertMonitoringService = require("./services/alertMonitoring")
const autoTraderMonitoringService = require("./services/autoTraderMonitoring")

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)

  // Avoid starting background intervals on serverless hosts unless explicitly enabled.
  const shouldRunBackgroundMonitors =
    process.env.ENABLE_BACKGROUND_MONITORS === "true" && process.env.VERCEL !== "1"

  if (shouldRunBackgroundMonitors) {
    // Start alert monitoring service
    alertMonitoringService.start()

    // Start auto-trader monitoring service
    autoTraderMonitoringService.start()
  } else {
    console.log("ℹ️ Background monitors are disabled (set ENABLE_BACKGROUND_MONITORS=true to enable)")
  }
})
