export default function ViewToggleBanner({ view, setView }) {
  return (
    <div className="mb-4 flex justify-center">
      <div className="flex bg-white rounded-xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setView("chart")}
          className={`flex items-center gap-2 px-6 py-2 text-sm font-medium transition ${
            view === "chart"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Chart
        </button>

        <button
          type="button"
          onClick={() => setView("table")}
          className={`flex items-center gap-2 px-6 py-2 text-sm font-medium transition ${
            view === "table"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Table
        </button>
      </div>
    </div>
  )
}
