import { useState } from "react"
import { login, register } from "../services/auth"
import AuthLayout from "../layouts/AuthLayout"
import AuthCard from "../layouts/AuthCard"

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

  async function handleLoginSubmit(e) {
    e.preventDefault()
    try {
      setError("")
      const response = await login({ email, password })
      localStorage.setItem("token", response.token)
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
      window.location.href = "/"
    } catch (err) {
      console.error("Register error:", err)
      setError(err.message || "Registration failed")
    }
  }

  return (
    
    <AuthLayout>
      <AuthCard>
        <h2 className="text-center text-2xl font-semibold text-white mb-6">
          {isRegistering ? "Create Account" : "Sign in"}
        </h2>

        <form
          onSubmit={isRegistering ? handleRegisterSubmit : handleLoginSubmit}
          className="space-y-4"
        >
          {isRegistering && (
            <>
              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-500"
              />

              <input
                type="number"
                placeholder="Age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-500"
              />

              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-white outline-none"
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
            className="w-full rounded-lg bg-slate-700 px-4 py-2 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-500"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-700 px-4 py-2 pr-10 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>

          {isRegistering && (
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-700 px-4 py-2 pr-10 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#005adc] py-2.5 text-white font-semibold hover:bg-blue-700 transition shadow-lg"
          >
            {isRegistering ? "Register" : "Sign in"}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-center text-sm text-red-400">{error}</p>
        )}

        <p className="mt-6 text-center text-sm text-gray-300">
          {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsRegistering(!isRegistering)
              setError("")
            }}
            className="text-white font-medium underline hover:text-gray-200"
          >
            {isRegistering ? "Sign in" : "Register"}
          </button>
        </p>
      </AuthCard>
    </AuthLayout>
  )
}

