const BASE_URL = "http://localhost:3000"

export async function getUsers(filters = {}) {
  const params = new URLSearchParams(filters)
  const res = await fetch(`${BASE_URL}/users?${params}`)
  if (!res.ok) throw new Error("Failed to fetch users")
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

export async function getUsers(filters = {}) {
  const params = new URLSearchParams()

  if (filters.search) params.append("search", filters.search)
  if (filters.role) params.append("role", filters.role)
  if (filters.status) params.append("status", filters.status)

  const res = await fetch(
    `http://localhost:3000/users?${params.toString()}`
  )

  if (!res.ok) {
    throw new Error("Failed to fetch users")
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

export async function updateUser(id, user) {
  const res = await fetch(`${BASE_URL}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })
  return handleResponse(res)
}

export async function deleteUser(id) {
  const res = await fetch(`${BASE_URL}/users/${id}`, {
    method: "DELETE",
  })
  return handleResponse(res)
}
