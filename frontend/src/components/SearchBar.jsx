export default function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = "Search",
}) {
  return (
    <div className="relative w-full max-w-xs">
      {/* Icon */}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.65" y1="16.65" x2="21" y2="21" />
        </svg>
      </span>

      {/* Input */}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        className="
          h-10 w-full
          rounded-md
          border border-gray-300
          bg-white
          pl-10 pr-3
          text-sm text-gray-700
          placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500
        "
      />
    </div>
  )
}
