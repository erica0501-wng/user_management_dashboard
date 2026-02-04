import { useEffect, useState } from "react"
import { getUsers, createUser, updateUser, deleteUser } from "../services/api"

import Sidebar from "../components/Sidebar"
import Toolbar from "../components/Toolbar"
import UserTable from "../components/UserTable"
import UserModal from "../components/UserModal"
import ConfirmModal from "../components/ConfirmModal"
import SearchBar from "../components/SearchBar"

export default function Dashboard() {
  const [users, setUsers] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [filters, setFilters] = useState({
    search: "",
    role: "",
    status: "",
    gender: "",
  })

  const [showUserModal, setShowUserModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  function handleLogout() {
    localStorage.removeItem("token")
    window.location.reload()
  }

  async function loadUsers() {
    try {
      setLoading(true)
      const data = await getUsers(filters)
      setUsers(data)
      setError("")
    } catch (err) {
      setError("Failed to fetch users: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [filters])

  function handleSearch() {
    loadUsers()
  }

  async function handleSaveUser(data) {
    if (selectedUser) {
      await updateUser(selectedUser.id, data)
    } else {
      await createUser(data)
    }
    loadUsers()
  }

  async function handleConfirmDelete() {
    if (!selectedUser?.id) return
    await deleteUser(selectedUser.id)
    setShowDeleteModal(false)
    loadUsers()
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 w-full min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="p-8">
          <div className="mx-auto" style={{ maxWidth: "1400px" }}>
          <div className="mb-8" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User management</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage your team members and their account permissions here.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            {/* Left: Search */}
            <SearchBar
              value={filters.search}
              onChange={(val) => setFilters({ ...filters, search: val })}
              onSearch={handleSearch}
              placeholder="Search username or email"
            />
          </div>

          <Toolbar
            filters={filters}
            setFilters={setFilters}
            total={users.length}
            onSearch={handleSearch}
            onAdd={() => {
              setSelectedUser(null)
              setShowUserModal(true)
            }}
          />

          {error && <p className="text-red-500 mt-4">{error}</p>}
          {loading && <p className="text-gray-500 mt-4">Loading...</p>}

          <div className="mt-6">
            {!loading && !error && users.length > 0 && (
              <UserTable
                users={users}
                onEdit={(user) => {
                  setSelectedUser(user)
                  setShowDeleteModal(false)
                  setShowUserModal(true)
                }}
                onDelete={(user) => {
                  setSelectedUser(user)
                  setShowUserModal(false)
                  setShowDeleteModal(true)
                }}
              />
            )}
          </div>

          {!loading && !error && users.length === 0 && (
            <p className="text-gray-500 mt-4 text-center py-8">No users found</p>
          )}

          <UserModal
            open={showUserModal}
            user={selectedUser}
            onClose={() => setShowUserModal(false)}
            onSave={handleSaveUser}
          />

          <ConfirmModal
            open={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleConfirmDelete}
          />
        </div>
        </div>
      </div>
    </div>
  )
}
