import { useState } from "react"
import { Link } from "react-router-dom"
import { login } from "../services/auth"

const demoAccounts = [
  {
    id: "new-user",
    label: "New User",
    role: "Investor",
    email: "new.user@empros.demo",
    password: "DemoPass123",
    profile: "Zero watchlist",
    detail: "Fresh account with no watchlist symbols.",
  },
  {
    id: "intermediate-user",
    label: "Intermediate User",
    role: "Investor Relations",
    email: "intermediate.user@empros.demo",
    password: "DemoPass123",
    profile: "Stocks + Polymarket watchlist",
    detail: "Includes stock symbols and Polymarket tracking symbols.",
  },
]

export default function MultiLogin() {
  const [error, setError] = useState("")
  const [loadingId, setLoadingId] = useState("")

  async function signInWithDemoAccount(account) {
    try {
      setError("")
      setLoadingId(account.id)
      const response = await login({ email: account.email, password: account.password })
      localStorage.setItem("token", response.token)
      localStorage.setItem("user", JSON.stringify(response.user))
      window.location.href = "/"
    } catch (err) {
      setError(err.message || "Login failed")
    } finally {
      setLoadingId("")
    }
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="mx-auto max-w-xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-semibold tracking-tight">Empros Capital</h1>
          <p className="text-gray-300 mt-2">Investor Portal</p>
          <p className="text-gray-400 mt-3 text-sm">
            Multi-tenant investor portal with role-based access control
          </p>
        </header>

        <section className="rounded-2xl border border-gray-700 bg-white/95 text-gray-900 p-6 shadow-2xl">
          <h2 className="text-2xl font-semibold">Quick Login</h2>
          <p className="text-gray-600 mt-1">Choose a demo profile to sign in instantly.</p>

          <div className="mt-5 grid grid-cols-1 gap-4">
            {demoAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{account.label}</h3>
                    <p className="text-sm text-gray-600">{account.role}</p>
                    <p className="text-sm text-gray-500 mt-1">{account.profile}</p>
                    <p className="text-xs text-gray-500 mt-2">{account.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => signInWithDemoAccount(account)}
                    disabled={loadingId === account.id}
                    className="rounded-lg bg-[#2f65d9] px-4 py-2 text-white font-semibold hover:bg-[#2653b8] transition disabled:opacity-60"
                  >
                    {loadingId === account.id ? "Signing in..." : "Sign In"}
                  </button>
                </div>
                <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <p>Email: {account.email}</p>
                  <p>Password: {account.password}</p>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </section>

        <div className="mt-5 text-center text-sm text-gray-300">
          <Link to="/login" className="underline hover:text-white">
            Use regular login and registration page
          </Link>
        </div>
      </div>
    </div>
  )
}
