export default function Modal({ open, onClose, children }) {
  if (!open) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}  
    >
      <div
        style={{ background: "white", padding: 24, minWidth: 320 }}
        onClick={(e) => e.stopPropagation()} 
      >
        {children}
      </div>
    </div>
  )
}
