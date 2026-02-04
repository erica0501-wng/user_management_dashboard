export default function StatusBadge({ status }) {
  const colors = {
    Active: "#22c55e",
    Inactive: "#facc15",
    Banned: "#ef4444",
  }

  return (
    <span
      style={{
        backgroundColor: colors[status],
        color: "white",
        padding: "4px 10px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 600,
        display: "inline-block",
        lineHeight: 1,
      }}
    >
      {status}
    </span>
  )
}
