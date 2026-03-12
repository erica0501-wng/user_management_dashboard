const app = require("./app")
const alertMonitoringService = require("./services/alertMonitoring")
const autoTraderMonitoringService = require("./services/autoTraderMonitoring")

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  
  // Start alert monitoring service
  alertMonitoringService.start()
  
  // Start auto-trader monitoring service
  autoTraderMonitoringService.start()
})
