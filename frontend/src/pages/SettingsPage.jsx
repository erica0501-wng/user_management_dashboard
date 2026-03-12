import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, Mail, Hash, CheckCircle, XCircle, Info, Save } from "lucide-react"
import Sidebar from "../components/Sidebar"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

export default function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  // Form states
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [discordEnabled, setDiscordEnabled] = useState(false)
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("")
  const [discordChannelName, setDiscordChannelName] = useState("")
  const [defaultChannels, setDefaultChannels] = useState(["email"])
  
  useEffect(() => {
    fetchSettings()
  }, [])
  
  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        navigate("/login")
        return
      }
      
      const response = await fetch(`${API_URL}/notifications/settings`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      // Handle unauthorized
      if (response.status === 401) {
        localStorage.removeItem("token")
        navigate("/login")
        return
      }
      
      const data = await response.json()
      
      if (data.success) {
        const s = data.settings
        setSettings(s)
        setEmailEnabled(s.emailEnabled)
        setDiscordEnabled(s.discordEnabled)
        setDiscordWebhookUrl(s.discordWebhookUrl || "")
        setDiscordChannelName(s.discordChannelName || "")
        setDefaultChannels(s.defaultChannels || ["email"])
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      showMessage("Failed to load settings", "error")
    } finally {
      setLoading(false)
    }
  }
  
  const handleSave = async () => {
    try {
      setSaving(true)
      const token = localStorage.getItem("token")
      
      const response = await fetch(`${API_URL}/notifications/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          emailEnabled,
          discordEnabled,
          discordWebhookUrl: discordWebhookUrl || null,
          discordChannelName: discordChannelName || null,
          defaultChannels
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSettings(data.settings)
        showMessage("Settings saved successfully!", "success")
      } else {
        showMessage(data.error || "Failed to save settings", "error")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      showMessage("Failed to save settings", "error")
    } finally {
      setSaving(false)
    }
  }
  
  const handleTestNotification = async () => {
    try {
      const token = localStorage.getItem("token")
      
      const response = await fetch(`${API_URL}/notifications/test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      const data = await response.json()
      
      if (data.success) {
        showMessage(`Test notification sent! Check your ${defaultChannels.join(", ")}`, "success")
      } else {
        showMessage(data.error || "Failed to send test notification", "error")
      }
    } catch (error) {
      console.error("Error sending test notification:", error)
      showMessage("Failed to send test notification", "error")
    }
  }
  
  const handleTestDiscord = async () => {
    try {
      const token = localStorage.getItem("token")
      
      const response = await fetch(`${API_URL}/notifications/discord/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          webhookUrl: discordWebhookUrl
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        showMessage("Discord test message sent!", "success")
      } else {
        showMessage(data.error || "Failed to send Discord test", "error")
      }
    } catch (error) {
      console.error("Error testing Discord:", error)
      showMessage("Failed to send Discord test", "error")
    }
  }
  
  const handleDisconnectDiscord = async () => {
    try {
      const token = localStorage.getItem("token")
      
      const response = await fetch(`${API_URL}/notifications/discord/disconnect`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      const data = await response.json()
      
      if (data.success) {
        setDiscordEnabled(false)
        setDiscordWebhookUrl("")
        setDiscordChannelName("")
        showMessage("Discord disconnected", "success")
      }
    } catch (error) {
      console.error("Error disconnecting Discord:", error)
      showMessage("Failed to disconnect Discord", "error")
    }
  }
  
  const toggleDefaultChannel = (channel) => {
    if (defaultChannels.includes(channel)) {
      setDefaultChannels(defaultChannels.filter(c => c !== channel))
    } else {
      setDefaultChannels([...defaultChannels, channel])
    }
  }
  
  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }
  
  if (loading) {
    return (
      <>
        <Sidebar />
        <div className="ml-64 min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">Loading settings...</div>
        </div>
      </>
    )
  }
  
  return (
    <>
      <Sidebar />
      <div className="ml-64 min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-8 h-8 text-indigo-600" />
            Notification Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Configure how you want to receive alert notifications
          </p>
        </div>
        
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}>
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}
        
        {/* Email Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Email Notifications</h2>
                <p className="text-sm text-gray-600">Receive alerts via email</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {emailEnabled && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Email notifications are enabled and will be sent to your registered email address.
              </p>
            </div>
          )}
        </div>
        
        {/* Discord Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Hash className="w-6 h-6 text-indigo-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Discord Notifications</h2>
                <p className="text-sm text-gray-600">Receive alerts in your Discord server</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={discordEnabled}
                onChange={(e) => setDiscordEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          
          {discordEnabled && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-semibold text-indigo-900">Setup Instructions</h3>
                </div>
                <ol className="text-sm text-indigo-800 space-y-2 ml-6 list-decimal">
                  <li>Open your Discord server and go to Server Settings → Integrations</li>
                  <li>Click "Create Webhook" or "View Webhooks"</li>
                  <li>Create a new webhook, give it a name, and select a channel</li>
                  <li>Copy the Webhook URL and paste it below</li>
                </ol>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discord Webhook URL
                </label>
                <input
                  type="text"
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel Name (Optional)
                </label>
                <input
                  type="text"
                  value={discordChannelName}
                  onChange={(e) => setDiscordChannelName(e.target.value)}
                  placeholder="#alerts"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-3">
                {discordWebhookUrl && (
                  <>
                    <button
                      onClick={handleTestDiscord}
                      className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm font-medium"
                    >
                      Send Test Message
                    </button>
                    <button
                      onClick={handleDisconnectDiscord}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Disconnect Discord
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Default Channels */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Default Notification Channels</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select which channels should be notified by default when you create new alerts
          </p>
          
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={defaultChannels.includes("email")}
                onChange={() => toggleDefaultChannel("email")}
                disabled={!emailEnabled}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <Mail className="w-5 h-5 text-blue-600" />
              <span className="text-gray-700">Email</span>
              {!emailEnabled && <span className="text-xs text-gray-500 ml-auto">(Disabled)</span>}
            </label>
            
            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={defaultChannels.includes("discord")}
                onChange={() => toggleDefaultChannel("discord")}
                disabled={!discordEnabled || !discordWebhookUrl}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <Hash className="w-5 h-5 text-indigo-600" />
              <span className="text-gray-700">Discord</span>
              {(!discordEnabled || !discordWebhookUrl) && (
                <span className="text-xs text-gray-500 ml-auto">(Not configured)</span>
              )}
            </label>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Save className="w-5 h-5" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
          
          <button
            onClick={handleTestNotification}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            Send Test Alert
          </button>
        </div>
      </div>
      </div>
    </>
  )
}
