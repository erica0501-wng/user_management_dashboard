export default function FilterBar({ filters, setFilters }) {
  return (
    <div className="flex gap-3 mb-4">
      <input
        placeholder="Search..."
        value={filters.search}
        onChange={(e) =>
          setFilters({ ...filters, search: e.target.value })
        }
      />

      <select
        value={filters.role}
        onChange={(e) =>
          setFilters({ ...filters, role: e.target.value })
        }
      >
        <option value="">Role</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
      </select>

      <select
        value={filters.status}
        onChange={(e) =>
          setFilters({ ...filters, status: e.target.value })
        }
      >
        <option value="">Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="banned">Banned</option>
      </select>

    </div>
  )
}
