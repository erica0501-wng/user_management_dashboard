import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"

export default function Sidebar() {
  const [active, setActive] = useState("dashboard")
  const navigate = useNavigate()
  const location = useLocation()

  const items = [
    { id: "dashboard", label: "Homepage", path: "/" },
    { id: "watchlists", label: "Watchlists", path: "/watchlists" },
    { id: "portfolio", label: "Portfolio", path: "/portfolio" },
    { id: "users", label: "Users Management", path: "/users" }
  ]

  // Update active state based on current path
  useEffect(() => {
    const currentItem = items.find(item => item.path === location.pathname)
    if (currentItem) {
      setActive(currentItem.id)
    }
  }, [location.pathname])

  const handleNavigation = (item) => {
    setActive(item.id)
    navigate(item.path)
  }

  return (
    <div className="w-64 h-screen bg-gray-900 text-white p-4 fixed left-0 top-0 z-[100]">
      <h1 className="text-2xl font-bold mb-8">QuadraStocks</h1>
      
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            onClick={(e) => {
              e.stopPropagation()
              handleNavigation(item)
            }}
            className={`flex items-center gap-3 rounded-md p-2 cursor-pointer transition ${
              active === item.id
                ? "bg-gray-800 text-white font-semibold"
                : "hover:bg-gray-800 text-gray-300"
            }`}
          >
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4 border-t border-gray-700">
        <button
          onClick={(e) => {
            e.stopPropagation()
            localStorage.removeItem("token")
            window.location.href = "/login"
          }}
          className="w-full flex items-center gap-3 rounded-md p-2 hover:bg-gray-800 text-gray-300 transition"
        >
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
