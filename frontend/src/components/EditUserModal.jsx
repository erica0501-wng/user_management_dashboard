import { useState, useEffect } from "react"
import { validatePassword, validatePasswordMatch } from "../utils/passwordValidation"

export default function EditUserModal({ user, onClose, onSave }) {
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) {
      setRole(user.role)
      setStatus(user.status)
      setPassword("")
      setConfirmPassword("")
      setError("")
    }
  }, [user])

  function handleSubmit(e) {
    e.preventDefault()
    setError("")
    
    if (!role || !status) {
      setError("Role and status are required")
      return
    }

    // If password fields are filled, validate them
    if (password || confirmPassword) {
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        setError(passwordValidation.message)
        return
      }

      const matchValidation = validatePasswordMatch(password, confirmPassword)
      if (!matchValidation.valid) {
        setError(matchValidation.message)
        return
      }
    }

    const updateData = { role, status }
    if (password) {
      updateData.password = password
    }

    onSave(user.id, updateData)
    onClose()
  }

  if (!user) return null

  return (
    <div className="fixed inset-0 bg-gray-900/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Edit User</h2>

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username (read-only) */}
          <div>
            <label className="text-sm text-gray-600">Username</label>
            <input
              value={user.username}
              disabled
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-sm text-gray-600">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="ADMIN">Admin</option>
              <option value="USER">User</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm text-gray-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BANNED">Banned</option>
            </select>
          </div>

          {/* Reset Password Section */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Reset Password (Optional)</h3>
            
            <div className="mb-3">
              <label className="text-sm text-gray-600">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">Must contain letters and numbers</p>
            </div>

            <div>
              <label className="text-sm text-gray-600">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
