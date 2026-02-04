const BASE_URL = "http://localhost:3000"

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token")

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  if (!res.ok) throw new Error("API error")
  return res.json()
}

async function handleResponse(res) {
  if (!res.ok) {
    let message = "Request failed"
    try {
      const err = await res.json()
      message = err.error || message
    } catch {}
    throw new Error(message)
  }
  return res.json()
}

export async function createUser(user) {
  const res = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })
  return handleResponse(res)
}

export async function updateUser(id, data) {
  const res = await fetch(`http://localhost:3000/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || "Update failed")
  }

  return res.json()
}

export async function deleteUser(id) {
  const res = await fetch(`${BASE_URL}/users/${id}`, {
    method: "DELETE",
  })
  return handleResponse(res)
}

export async function getUsers(filters) {
  const params = new URLSearchParams()

  if (filters.search && filters.search.trim()) params.append("search", filters.search)
  if (filters.role && filters.role !== "All" && filters.role.trim()) params.append("role", filters.role)
  if (filters.status && filters.status !== "All" && filters.status.trim()) params.append("status", filters.status)
  if (filters.gender && filters.gender !== "All" && filters.gender.trim()) params.append("gender", filters.gender)

  const url = `${BASE_URL}/users?${params.toString()}`
  console.log("Fetching from:", url)

  const res = await fetch(url)

  if (!res.ok) {
    console.error("Response not OK:", res.status, res.statusText)
    throw new Error("Failed to fetch users")
  }

  const data = await res.json()
  console.log("API returned:", data)
  return data
}

