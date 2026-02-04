import { useEffect, useState } from "react"
import Modal from "./Modal"
import { validatePassword, validatePasswordMatch } from "../utils/passwordValidation"

export default function UserModal({ open, user, onClose, onSave }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    age: "",
    gender: "",
    role: "User",
    status: "Active",
    password: "",
    confirmPassword: "",
  })

  const [error, setError] = useState("")

  // Validation functions
  function isValidUsername(username) {
    return /^[A-Za-z\s]+$/.test(username) && username.trim().length > 0
  }

  function isValidGmail(email) {
    return /^[A-Za-z0-9._%+-]+@gmail\.com$/.test(email)
  }

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username ?? "",
        email: user.email ?? "",
        age: user.age ?? "",
        gender: user.gender ?? "",
        role: user.role ?? "User",
        status: user.status ?? "Active",
        password: "",
        confirmPassword: "",
      })
    } else {
      setForm({
        username: "",
        email: "",
        age: "",
        gender: "",
        role: "User",
        status: "Active",
        password: "",
        confirmPassword: "",
      })
    }
    setError("")
  }, [user, open])

  if (!open) return null

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit() {
    // Frontend validation - only validate username/email when creating new user
    if (!user) {
      if (!form.username || !form.email) {
        setError("Username and email are required")
        return
      }

      if (!isValidUsername(form.username)) {
        setError("Username must contain only letters and spaces")
        return
      }

      if (!isValidGmail(form.email)) {
        setError("Email must be a valid @gmail.com address")
        return
      }
    }

    // When editing, validate password only if it's being changed
    if (user && (form.password || form.confirmPassword)) {
      const passwordValidation = validatePassword(form.password)
      if (!passwordValidation.valid) {
        setError(passwordValidation.message)
        return
      }

      const matchValidation = validatePasswordMatch(form.password, form.confirmPassword)
      if (!matchValidation.valid) {
        setError(matchValidation.message)
        return
      }
    }

    try {
      const dataToSave = { ...form }
      
      // When editing, remove only username and email (they're read-only)
      if (user) {
        delete dataToSave.username
        delete dataToSave.email
      }
      
      // Remove password fields if they're empty (when editing without password change)
      if (user && !form.password) {
        delete dataToSave.password
        delete dataToSave.confirmPassword
      }
      
      // Keep gender in the data
      // dataToSave will include gender, age, role, status, and password (if set)
      
      await onSave(dataToSave)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      {/* ⚠️ EVERYTHING MUST BE INSIDE MODAL */}
      <h2 className="text-lg font-semibold mb-4">
        {user ? "Edit User" : "Add User"}
      </h2>

      <div className="space-y-3">
        <input
          name="username"
          placeholder="Username"
          value={form.username}
          onChange={handleChange}
          disabled={!!user}
          className="w-full border px-3 py-2 rounded bg-gray-100"
        />

        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          disabled={!!user}
          className="w-full border px-3 py-2 rounded bg-gray-100"
        />

        <input
          type="number"
          name="age"
          value={form.age}
          onChange={handleChange}
          placeholder="Age"
          min="0"
          className="w-full border px-3 py-2 rounded"
        />

        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>

        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="Admin">Admin</option>
          <option value="User">User</option>
        </select>

        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Banned">Banned</option>
        </select>

        {/* Password reset fields - only show when editing */}
        {user && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Reset Password (Optional)
            </h3>
            
            <input
              type="password"
              name="password"
              placeholder="New password (leave blank to keep current)"
              value={form.password}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded mb-3"
            />

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm new password"
              value={form.confirmPassword}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mt-3">{error}</p>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          className="px-3 py-1 border rounded"
        >
          Cancel
        </button>

        <button
          onClick={handleSubmit}
          className="px-4 py-1 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </Modal>
  )
}
