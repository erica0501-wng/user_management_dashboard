import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import MarketAnalytics from "./pages/MarketAnalytics"
import Watchlists from "./pages/Watchlists"
import Portfolio from "./pages/Portfolio"
import Trading from "./pages/Trading"
import Community from "./pages/Community"
import Polymarket from "./pages/Polymarket"
import PolymarketTrade from "./pages/PolymarketTrade"
import MarketDetails from "./pages/MarketDetails"

export default function App() {
  const isLoggedIn = !!localStorage.getItem("token")

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isLoggedIn ? <Navigate to="/" /> : <Login />}
        />

        <Route
          path="/"
          element={isLoggedIn ? <MarketAnalytics /> : <Navigate to="/login" />}
        />

        <Route
          path="/watchlists"
          element={isLoggedIn ? <Watchlists /> : <Navigate to="/login" />}
        />

        <Route
          path="/portfolio"
          element={isLoggedIn ? <Portfolio /> : <Navigate to="/login" />}
        />

        <Route
          path="/trading"
          element={isLoggedIn ? <Trading /> : <Navigate to="/login" />}
        />

        <Route
          path="/users"
          element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" />}
        />

        <Route
          path="/community"
          element={isLoggedIn ? <Community /> : <Navigate to="/login" />}
        />

        <Route
          path="/polymarket"
          element={isLoggedIn ? <Polymarket /> : <Navigate to="/login" />}
        />

        <Route
          path="/polymarket/details/:marketId"
          element={isLoggedIn ? <MarketDetails /> : <Navigate to="/login" />}
        />

        <Route
          path="/polymarket/trade/:marketId"
          element={isLoggedIn ? <PolymarketTrade /> : <Navigate to="/login" />}
        />
      </Routes>
    </BrowserRouter>
  )
}
