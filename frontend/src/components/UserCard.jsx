import StatusBadge from "./StatusBadge"

export default function UserCard({ user, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-6 hover:shadow-lg transition-shadow">
      {/* Top Section: Avatar and Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 w-12 h-12 flex items-center justify-center text-white font-bold text-lg">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <StatusBadge status={user.status ?? "Active"} />
      </div>

      {/* Username and Email */}
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 text-lg">
          {user.username ?? user.name?.toLowerCase()}
        </h3>
        <p className="text-sm text-gray-500 truncate">
          {user.email}
        </p>
      </div>

      {/* User Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4 py-3 border-t border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500 font-medium">Age</p>
          <p className="text-sm font-semibold text-gray-900">{user.age ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Gender</p>
          <p className="text-sm font-semibold text-gray-900">{user.gender ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Role</p>
          <span className="inline-block px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs font-medium">
            {user.role ?? "User"}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">Joined</p>
          <p className="text-xs font-semibold text-gray-900">
            {user.joinedDate
              ? new Date(user.joinedDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
