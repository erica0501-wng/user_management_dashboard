import { useState, useRef, useEffect } from "react"
import StatusBadge from "./StatusBadge"

export default function UserTable({ users, onEdit, onDelete }) {
  const [openMenuId, setOpenMenuId] = useState(null)
  const menuRef = useRef(null)

  // close menu when click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">

        {/* ================= Header ================= */}
        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b sticky top-0">
          <tr>
            <th className="px-2 py-3 text-left font-semibold text-gray-700 w-10">
              Avatar
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 w-24">
              Username
            </th>
            <th className="px-2 py-3 text-left font-semibold text-gray-700 w-20">
              Email
            </th>
            <th className="px-2 py-3 text-center font-semibold text-gray-700 w-12">
              Age
            </th>
            <th className="px-2 py-3 text-center font-semibold text-gray-700 w-16">
              Gender
            </th>
            <th className="px-2 py-3 text-center font-semibold text-gray-700 w-16">
              Status
            </th>
            <th className="px-2 py-3 text-center font-semibold text-gray-700 w-12">
              Role
            </th>
            <th className="px-2 py-3 text-left font-semibold text-gray-700 w-20">
              Joined
            </th>
            <th className="px-3 py-3 text-left font-semibold text-gray-700 w-24">
              Last Active
            </th>
            <th className="px-2 py-3 text-center font-semibold text-gray-700 w-8">
            </th>
          </tr>
        </thead>

        {/* ================= Body ================= */}
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b hover:bg-gray-50 transition-colors">
              {/* Avatar */}
              <td className="px-2 py-2 align-middle">
                <div className="w-7 h-7 rounded-full border border-gray-200 shadow-sm bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              </td>

              <td className="px-3 py-2 font-medium text-gray-900 truncate text-sm">
                {user.username ?? user.name?.toLowerCase()}
              </td>

              <td className="px-2 py-2 text-gray-600 truncate text-xs">
                {user.email}
              </td>

              <td className="px-2 py-2 text-gray-600 text-center text-sm">
                {user.age ?? "—"}
              </td>

              <td className="px-2 py-2 text-gray-600 text-center">
                {user.gender ? (
                  <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {user.gender}
                  </span>
                ) : (
                  "—"
                )}
              </td>

              <td className="px-2 py-2 text-center">
                <StatusBadge status={user.status ?? "Active"} />
              </td>

              <td className="px-2 py-2 text-center">
                <span className="inline-block px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded text-xs font-medium">
                  {user.role ?? "User"}
                </span>
              </td>

              <td className="px-2 py-2 text-gray-500 text-xs">
                {user.joinedDate
                  ? new Date(user.joinedDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })
                  : "—"}
              </td>

              <td className="px-3 py-2 text-gray-500 text-xs truncate">
                {user.lastActive ?? "—"}
              </td>

              {/* ================= 3 DOT ACTION ================= */}
              <td className="px-1 py-2 text-center relative">
                <button
                  onClick={() =>
                    setOpenMenuId(
                      openMenuId === user.id ? null : user.id
                    )
                  }
                  className="w-6 h-6 rounded hover:bg-gray-200 
                             flex items-center justify-center text-gray-600
                             hover:text-gray-900 transition-colors text-sm"
                  title="More options"
                >
                  ⋮
                </button>

                {openMenuId === user.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50
                               bg-white border border-gray-200 rounded-lg shadow-lg
                               w-32 text-sm overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setOpenMenuId(null)
                        onEdit(user)
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700
                                 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                    Edit
                    </button>

                    <button
                      onClick={() => {
                        setOpenMenuId(null)
                        onDelete(user)
                      }}
                      className="w-full px-4 py-2 text-left text-red-600
                                 hover:bg-red-50 transition-colors border-t"
                    >
                    Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}

          {/* Empty */}
          {users.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center text-gray-500 font-medium">
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
