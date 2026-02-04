import { format } from "date-fns"

export default function GreetingBanner({
  symbol,
  user,
  hoverCandle,
  todayClose,
  change,
  changePercent,
  average
}) {
  const isHover = !!hoverCandle
  const price = isHover ? hoverCandle.close : todayClose
  const date = isHover ? hoverCandle.date : null
  const isUp = change > 0
  const KpiBlock = ({ value, label, sub, isUp }) => (
    <div className="pe-6 border-e border-gray-300 border-opacity-20">
      <h3 className="flex items-start text-3xl font-semibold">
        {value}
        {isUp !== undefined && (
          <span
            className={`text-base ml-1 ${
              isUp ? "text-green-500" : "text-red-500"
            }`}
          >
            {isUp ? "↗" : "↘"}
          </span>
        )}
      </h3>
      <p className="text-sm mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )

  return (
    <div className="p-6 rounded-2xl bg-blue-50 overflow-hidden relative">
      <div className="grid grid-cols-12">
        <div className="lg:col-span-7 md:col-span-7 sm:col-span-12 col-span-12">
          
          {/* User */}
          <div className="flex gap-3 items-center mb-9">
            <div className="rounded-full bg-gradient-to-br from-blue-400 to-blue-600 w-10 h-10 flex items-center justify-center text-white font-bold">
              {user?.username?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h5 className="text-lg font-semibold">
                Welcome back {user?.username || "User"}!
              </h5>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>

          {/* Price */}
          <div className="flex gap-6 items-center">
          {/* Today Price */}
          <KpiBlock
            value={`$${(hoverCandle?.close ?? todayClose)?.toFixed(2)}`}
            label={`Today's ${symbol} Price`}
            isUp={change > 0}
          />

          {/* Change % */}
          <KpiBlock
            value={`${changePercent?.toFixed(2)}%`}
            label="vs Previous"
            isUp={changePercent > 0}
          />

          {/* Average Price */}
          <KpiBlock
            value={`$${average?.toFixed(2)}`}
            label="Average Price"
          />
        </div>

          {/* Hover OHLC */}
          {isHover && (
            <div className="mt-3 text-sm text-gray-700">
              O: {hoverCandle.open} H: {hoverCandle.high} L: {hoverCandle.low} C: {hoverCandle.close}
            </div>
          )}

        </div>

        <div className="lg:col-span-5 md:col-span-5 sm:col-span-12 col-span-12">
          <div className="sm:absolute relative right-0 -bottom-8">
            <img
              src="/images/backgrounds/welcome-bg.svg"
              alt="background"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
