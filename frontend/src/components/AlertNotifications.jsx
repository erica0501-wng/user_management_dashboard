import { useState, useEffect } from "react"
import { Bell, X, TrendingUp, BookOpen, BellOff, Sparkles, Clock } from "lucide-react"

export default function AlertNotifications() {
  const [triggeredAlerts, setTriggeredAlerts] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchTriggeredAlerts()
    
    // Poll for new alerts every 30 seconds
    const interval = setInterval(() => {
      fetchTriggeredAlerts()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const fetchTriggeredAlerts = async () => {
    try {
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const response = await fetch(`${apiUrl}/alerts/triggered`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (response.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return
      }

      if (!response.ok) return

      const data = await response.json()
      setTriggeredAlerts(data.alerts || [])
      
      // Count unread (triggered in last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const unread = data.alerts.filter(
        (alert) => new Date(alert.triggeredAt) > oneHourAgo
      ).length
      setUnreadCount(unread)
    } catch (err) {
      console.error("Error fetching triggered alerts:", err)
    }
  }

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000)
    
    if (seconds < 60) return "just now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getAlertDetails = (alert) => {
    if (alert.alertType === "Price") {
      return {
        icon: TrendingUp,
        bgColor: "bg-gradient-to-br from-blue-50 to-indigo-50",
        iconBg: "bg-blue-500",
        iconColor: "text-white",
        badge: "bg-blue-100 text-blue-700",
        detail: `${alert.condition} $${alert.targetPrice}`
      }
    } else {
      return {
        icon: BookOpen,
        bgColor: "bg-gradient-to-br from-purple-50 to-pink-50",
        iconBg: "bg-purple-500",
        iconColor: "text-white",
        badge: "bg-purple-100 text-purple-700",
        detail: `Volume > ${alert.orderBookThreshold}`
      }
    }
  }

  return (
    <>
      {/* Bell Icon with Badge */}
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2.5 hover:bg-gray-800 rounded-xl transition-all duration-200 group"
          aria-label="View notifications"
        >
          <Bell className={`w-5 h-5 transition-all duration-200 ${
            unreadCount > 0 
              ? "text-yellow-400 animate-pulse" 
              : "text-gray-400 group-hover:text-white"
          }`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-gradient-to-br from-red-500 to-pink-600 rounded-full animate-bounce shadow-lg ring-2 ring-gray-900">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Centered Modal Notifications */}
        {showNotifications && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowNotifications(false)}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header with Gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Bell className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-2xl">
                      Alert Notifications
                    </h3>
                    <p className="text-blue-100 text-sm mt-1">
                      {triggeredAlerts.length} {triggeredAlerts.length === 1 ? "alert" : "alerts"} triggered
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-2.5 hover:bg-white/20 rounded-xl transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[600px] overflow-y-auto">
              {triggeredAlerts.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-6">
                    <BellOff className="w-12 h-12 text-gray-400" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-xl mb-3">
                    All caught up!
                  </h4>
                  <p className="text-gray-500 text-base max-w-md mx-auto">
                    No triggered alerts yet. We'll notify you when your price or order book alerts are triggered.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {triggeredAlerts.map((alert) => {
                    const details = getAlertDetails(alert)
                    const Icon = details.icon
                    
                    return (
                      <div
                        key={alert.id}
                        className={`p-6 hover:bg-gray-50 transition-all duration-200 cursor-pointer border-l-4 border-transparent hover:border-blue-500 ${
                          new Date(alert.triggeredAt) > new Date(Date.now() - 60 * 60 * 1000)
                            ? "bg-blue-50/30"
                            : ""
                        }`}
                      >
                        <div className="flex gap-5">
                          {/* Icon */}
                          <div className="flex-shrink-0">
                            <div className={`w-14 h-14 ${details.iconBg} rounded-xl flex items-center justify-center shadow-lg`}>
                              <Icon className={`w-7 h-7 ${details.iconColor}`} />
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Alert Type Badge */}
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${details.badge}`}>
                                <Sparkles className="w-4 h-4" />
                                {alert.alertType} Alert
                              </span>
                              {new Date(alert.triggeredAt) > new Date(Date.now() - 60 * 60 * 1000) && (
                                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold animate-pulse">
                                  New
                                </span>
                              )}
                            </div>

                            {/* Question */}
                            <p className="font-semibold text-gray-900 text-base mb-2 line-clamp-2">
                              {alert.question}
                            </p>

                            {/* Details */}
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-2.5">
                              <span className="font-semibold text-gray-900">
                                {alert.outcome}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="font-mono bg-gray-100 px-2.5 py-1 rounded text-sm">
                                {details.detail}
                              </span>
                            </div>

                            {/* Timestamp */}
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              <span>{formatTimeAgo(alert.triggeredAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {triggeredAlerts.length > 0 && (
              <div className="p-5 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <button
                  onClick={() => {
                    setShowNotifications(false)
                    // Navigate to alerts page
                  }}
                  className="w-full py-3 text-center text-base font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-xl border border-gray-300 transition-all duration-200 shadow-sm hover:shadow"
                >
                  View All Alerts →
                </button>
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
