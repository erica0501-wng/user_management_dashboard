import { useState, useEffect } from "react"
import { getOrders } from "../services/portfolio"

export default function TradeHistory() {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all") // all, buy, sell
  const [symbolFilter, setSymbolFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchTrades()
  }, [])

  // TODO: 你需要在这里补全 return ( ... )，把 UI 结构全部放到 return 里。
  return (
    <div>
      {/* TradeHistory UI 结构放这里 */}
    </div>
  );
}
