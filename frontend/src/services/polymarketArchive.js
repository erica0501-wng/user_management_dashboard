const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "")
const LOCAL_API_URL = "http://localhost:3000"

const getToken = () => localStorage.getItem("token")

const buildHeaders = () => {
  const token = getToken()
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {}
}

async function fetchArchiveResource(path, params = {}, options = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value))
    }
  })

  const suffix = query.toString() ? `?${query.toString()}` : ""
  const method = options.method || "GET"
  const headers = {
    ...buildHeaders(),
    ...(options.body ? { "Content-Type": "application/json" } : {})
  }

  const shouldTryLocalFallback =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    API_URL !== LOCAL_API_URL

  const candidateBaseUrls = shouldTryLocalFallback
    ? [API_URL, LOCAL_API_URL]
    : [API_URL]

  let lastError = null

  for (let index = 0; index < candidateBaseUrls.length; index += 1) {
    const baseUrl = candidateBaseUrls[index]
    const hasNextCandidate = index < candidateBaseUrls.length - 1

    try {
      const response = await fetch(`${baseUrl}${path}${suffix}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      })

      if (response.ok) {
        return response.json()
      }

      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const message =
        payload?.error ||
        payload?.message ||
        `Request failed for ${path} with status ${response.status}`
      const error = new Error(message)
      error.status = response.status
      error.payload = payload
      error.apiBaseUrl = baseUrl
      lastError = error

      if (hasNextCandidate && (response.status === 404 || response.status >= 500)) {
        continue
      }

      throw error
    } catch (error) {
      lastError = error
      if (hasNextCandidate) {
        continue
      }
      throw error
    }
  }

  throw lastError || new Error(`Request failed for ${path}`)
}

export const getArchiveStatus = (params) =>
  fetchArchiveResource("/polymarket/archive/status", params)

export const getArchiveGaps = (params) =>
  fetchArchiveResource("/polymarket/archive/gaps", params)

export const getReplayWindows = (params) =>
  fetchArchiveResource("/polymarket/archive/replay-windows", params)

export const getReplaySlice = (params) =>
  fetchArchiveResource("/polymarket/archive/replay-slice", params)

export const getArchiveQualityReports = (params) =>
  fetchArchiveResource("/polymarket/archive/quality-reports", params)

export const getSportsActivePeriods = (params) =>
  fetchArchiveResource("/polymarket/sports/active-periods", params)

export const getSportsActivePeriodActivity = (params) =>
  fetchArchiveResource("/polymarket/sports/active-period-activity", params)

export const getMarketCategories = (params) =>
  fetchArchiveResource("/polymarket/market-categories", params)

export const runArchiveQualityReport = (windowHours) =>
  fetchArchiveResource(
    "/polymarket/archive/quality-report/run",
    {},
    {
      method: "POST",
      body: { windowHours }
    }
  )