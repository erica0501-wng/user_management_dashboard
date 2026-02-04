import { format } from "date-fns"

export default function MarketTable({ data }) {
  const { dates = [], opens = [], highs = [], lows = [], prices = [], volumes = [] } = data || {}

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Open</th>
              <th className="px-4 py-3 text-right font-medium">High</th>
              <th className="px-4 py-3 text-right font-medium">Low</th>
              <th className="px-4 py-3 text-right font-medium">Close</th>
              <th className="px-4 py-3 text-right font-medium">Volume</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {[...dates].reverse().map((d, i) => {
              const index = dates.length - 1 - i
              const close = prices[index]
              const prev = prices[index - 1]
              const isUp = prev !== undefined && close > prev
              const safe = d?.includes(" ") ? d.replace(" ", "T") : d

              return (
                <tr
                  key={index}
                  className="hover:bg-blue-50 transition"
                >
                  <td className="px-4 py-3 text-gray-700">
                    {safe ? format(new Date(safe), "yyyy-MM-dd HH:mm") : ""}
                  </td>

                  <td className="px-4 py-3 text-right">{opens[index]}</td>
                  <td className="px-4 py-3 text-right">{highs[index]}</td>
                  <td className="px-4 py-3 text-right">{lows[index]}</td>

                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      isUp ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {close}
                  </td>

                  <td className="px-4 py-3 text-right text-gray-600">
                    {volumes?.[index]?.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
