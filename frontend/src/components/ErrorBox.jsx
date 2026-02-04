export default function ErrorBox({ message }) {
  if (!message) return null
  return (
    <div style={{ color: "red", marginBottom: 12 }}>
      ❌ {message}
    </div>
  )
}
