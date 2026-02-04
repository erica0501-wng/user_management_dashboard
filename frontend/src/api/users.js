const BASE_URL = "http://localhost:3000"

export async function getUsers() {
  const res = await fetch(`${BASE_URL}/users`)
  const json = await res.json()
  return json.data ?? json
}

export async function createUser(user) {
  const res = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })
  return res.json()
}

export async function updateUser(id, user) {
  const res = await fetch(`${BASE_URL}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })
  return res.json()
}

export async function deleteUser(id) {
  const res = await fetch(`${BASE_URL}/users/${id}`, {
    method: "DELETE",
  })
  return res.json()
}
