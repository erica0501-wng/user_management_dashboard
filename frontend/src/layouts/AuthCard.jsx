// src/layouts/AuthCard.jsx
export default function AuthCard({ children }) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-gray-800 border border-gray-700 p-8 shadow-2xl">
      {children}
    </div>
  )
}
