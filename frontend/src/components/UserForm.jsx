import { useEffect, useState } from "react"

export default function UserForm({ editingUser, onSubmit, loading }) {
  const [form, setForm] = useState({ name: "", email: "", age: "" })

  useEffect(() => {
    if (editingUser) {
      setForm({
        name: editingUser.name ?? "",
        email: editingUser.email ?? "",
        age: editingUser.age ?? "",
      })
    }
  }, [editingUser])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      age: Number(form.age),
    })
    setForm({ name: "", email: "", age: "" })
  }

return (
  <form onSubmit={handleSubmit} className="mb-6 space-y-3 w-full">
    <input
      className="w-full border px-2 py-1"
      name="name"
      value={form.name}
      onChange={handleChange}
      placeholder="Name"
    />

    <input
      className="w-full border px-2 py-1"
      name="email"
      value={form.email}
      onChange={handleChange}
      placeholder="Email"
    />

    <input
      className="w-full border px-2 py-1"
      type="number"
      name="age"
      value={form.age}
      onChange={handleChange}
      placeholder="Age"
    />

    <button
      className="self-end border px-4 py-1"
      disabled={loading}
    >
      {loading ? "Saving..." : editingUser ? "Update" : "Create"}
    </button>
  </form>
  )

}
