import { useState } from "react"
import { login, register } from "../services/auth"

const quickLoginProfiles = [
  {
    id: "intermediate-user",
    label: "Intermediate User",
    email: "intermediate.user@empros.demo",
    password: "DemoPass123",
  },
  {
    id: "new-user",
    label: "New User",
    email: "new.user@empros.demo",
    password: "DemoPass123",
  },
]

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [age, setAge] = useState("")
  const [gender, setGender] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [quickLoginLoadingId, setQuickLoginLoadingId] = useState("")

  async function handleLoginSubmit(e) {
    e.preventDefault()
    try {
      setError("")
      const response = await login({ email, password })
      localStorage.setItem("token", response.token)
      localStorage.setItem("user", JSON.stringify(response.user))
      window.location.href = "/"
    } catch (err) {
      setError(err.message || "Login failed")
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    try {
      setError("")
      const response = await register({ email, password, username, age, gender })
      console.log("Register response:", response)
      localStorage.setItem("token", response.token)
      localStorage.setItem("user", JSON.stringify(response.user))
      window.location.href = "/"
    } catch (err) {
      console.error("Register error:", err)
      setError(err.message || "Registration failed")
    }
  }

  async function handleQuickLogin(profile) {
    try {
      setError("")
      setQuickLoginLoadingId(profile.id)
      const response = await login({ email: profile.email, password: profile.password })
      localStorage.setItem("token", response.token)
      localStorage.setItem("user", JSON.stringify(response.user))
      window.location.href = "/"
    } catch (err) {
      setError(err.message || "Quick login failed")
    } finally {
      setQuickLoginLoadingId("")
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-6 text-[#1d1d1f] flex items-center justify-center font-apple">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-[#d2d2d7] bg-white px-6 py-6 text-[#1d1d1f] shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <h2 className="text-[34px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
            {isRegistering ? "Create Account" : "Sign In"}
          </h2>
          <p className="mt-1 text-[15px] font-medium leading-relaxed text-[#6e6e73]">
            {isRegistering ? "Create your credentials to continue" : "Enter your credentials to continue"}
          </p>

        <form
          onSubmit={isRegistering ? handleRegisterSubmit : handleLoginSubmit}
            className="mt-5 space-y-4"
        >
          {isRegistering && (
            <>
              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                            className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 text-[15px] font-medium text-[#1d1d1f] placeholder-[#8e8e93] outline-none transition focus:border-[#1d1d1f] focus:ring-2 focus:ring-black/10"
              />

              <input
                type="number"
                placeholder="Age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                            className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 text-[15px] font-medium text-[#1d1d1f] placeholder-[#8e8e93] outline-none transition focus:border-[#1d1d1f] focus:ring-2 focus:ring-black/10"
              />

              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                            className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 text-[15px] font-medium text-[#1d1d1f] outline-none transition focus:border-[#1d1d1f] focus:ring-2 focus:ring-black/10"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </>
          )}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 text-[15px] font-medium text-[#1d1d1f] placeholder-[#8e8e93] outline-none transition focus:border-[#1d1d1f] focus:ring-2 focus:ring-black/10"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 pr-10 text-[15px] font-medium text-[#1d1d1f] placeholder-[#8e8e93] outline-none transition focus:border-[#1d1d1f] focus:ring-2 focus:ring-black/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-[#1d1d1f] transition"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {isRegistering && (
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 pr-10 text-[15px] font-medium text-[#1d1d1f] placeholder-[#8e8e93] outline-none transition focus:border-[#1d1d1f] focus:ring-2 focus:ring-black/10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-[#1d1d1f] transition"
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          )}

          <button
            type="submit"
                    className="w-full rounded-xl bg-[#1d1d1f] py-2.5 text-[15px] tracking-[0.01em] text-white font-semibold hover:bg-black transition"
          >
              {isRegistering ? "Register" : "Sign In"}
          </button>
        </form>

        {error && (
            <p className="mt-4 text-center text-sm text-[#d70015]">{error}</p>
        )}

          <p className="mt-5 text-center text-sm font-medium text-[#6e6e73]">
            {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsRegistering(!isRegistering)
              setError("")
            }}
              className="font-semibold text-[#1d1d1f] underline underline-offset-2 hover:text-black"
          >
              {isRegistering ? "Sign In" : "Register"}
          </button>
        </p>

          {!isRegistering && (
            <div className="mt-4 rounded-3xl border border-[#d2d2d7] bg-[#fbfbfd] px-6 py-6 text-[#1d1d1f] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
              <h3 className="text-[26px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">Quick Login</h3>
              <p className="mt-1 text-[14px] font-medium text-[#6e6e73]">Click to sign in as a demo user</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {quickLoginProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleQuickLogin(profile)}
                    disabled={quickLoginLoadingId === profile.id}
                    className="rounded-xl border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm font-semibold tracking-[0.01em] text-[#1d1d1f] transition hover:bg-[#f5f5f7] disabled:opacity-60"
                  >
                    {quickLoginLoadingId === profile.id ? "Signing in..." : profile.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

