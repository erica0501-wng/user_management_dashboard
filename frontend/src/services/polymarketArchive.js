const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

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

  const response = await fetch(`${API_URL}${path}${suffix}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  if (!response.ok) {
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
    throw error
  }

  return response.json()
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

export const runArchiveQualityReport = (windowHours) =>
  fetchArchiveResource(
    "/polymarket/archive/quality-report/run",
    {},
    {
      method: "POST",
      body: { windowHours }
    }
  )