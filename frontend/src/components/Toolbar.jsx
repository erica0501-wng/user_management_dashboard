export default function Toolbar({
  filters,
  setFilters,
  onSearch,
  onAdd,
  total = 0,
}) {
  return (
    <>
      {/* Title and user count */}
      <div className="mb-6">
        <div className="text-lg" style={{ fontWeight: 700, color: "#000000" }}>
          All users <span style={{ fontWeight: 500, color: "#6b7280", marginLeft: 4 }}>
            {total}
          </span>
        </div>
      </div>

      {/* Filters on left + Add user on right */}
      <div className="flex items-center justify-between mb-6">
        {/* Left: Filter buttons */}
        <div className="flex items-center gap-2">
          {/* Role filter */}
          <select
            value={filters.role}
            onChange={(e) =>
              setFilters({ ...filters, role: e.target.value })
            }
            className="rounded-md bg-black px-3 py-2 
                       text-xs font-medium text-white
                       hover:bg-gray-900"
          >
            <option value="">All roles</option>
            <option value="Admin">Admin</option>
            <option value="User">User</option>
          </select>

          {/* Status filter */}
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
            className="rounded-md bg-black px-3 py-2 
                       text-xs font-medium text-white
                       hover:bg-gray-900"
          >
            <option value="">All status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Banned">Banned</option>
          </select>

          {/* Gender filter */}
          <select
            value={filters.gender}
            onChange={(e) =>
              setFilters({ ...filters, gender: e.target.value })
            }
            className="rounded-md bg-black px-3 py-2 
                       text-xs font-medium text-white
                       hover:bg-gray-900"
          >
            <option value="">All gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        {/* Right: Add user button */}
        <button
          onClick={onAdd}
          className="rounded-md bg-black px-4 py-2 
                     text-sm font-medium text-white
                     hover:bg-gray-900 whitespace-nowrap"
        >
          + Add user
        </button>
      </div>
    </>
  )
}
