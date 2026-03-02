import { useState, useEffect } from "react"
import { getWatchlist } from "../services/watchlist"
import { createSharedWatchlist } from "../services/social"

export default function CreateSharedWatchlistModal({ onClose, onSuccess }) {
  const [watchlist, setWatchlist] = useState([])
  const [selectedSymbols, setSelectedSymbols] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingWatchlist, setLoadingWatchlist] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadWatchlist()
  }, [])

  const loadWatchlist = async () => {
    setLoadingWatchlist(true)
    try {
      const data = await getWatchlist()
      console.log('📋 Loaded watchlist:', data)
      setWatchlist(data)
    } catch (error) {
      console.error('Failed to load watchlist:', error)
      setError('Failed to load your watchlist')
    } finally {
      setLoadingWatchlist(false)
    }
  }

  const handleToggleSymbol = (symbol) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter(s => s !== symbol))
    } else {
      setSelectedSymbols([...selectedSymbols, symbol])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Please enter a title')
      return
    }

    if (selectedSymbols.length === 0) {
      setError('Please select at least one stock')
      return
    }

    setLoading(true)
    try {
      await createSharedWatchlist({
        title: title.trim(),
        description: description.trim() || null,
        symbols: selectedSymbols,
        isPublic
      })
      onSuccess()
    } catch (error) {
      console.error('Failed to create shared watchlist:', error)
      setError('Failed to create share, please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Share Watchlist</h2>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit}>
            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., My Tech Stock Picks"
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Share your investment thesis..."
                rows={3}
                maxLength={500}
              />
            </div>

            {/* Select Symbols */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Stocks * ({selectedSymbols.length} selected)
              </label>
              
              {loadingWatchlist ? (
                <div className="border rounded-lg p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                  Loading your watchlist...
                </div>
              ) : watchlist.length === 0 ? (
                <p className="text-gray-500 text-sm border rounded-lg p-4">
                  Your watchlist is empty. Please add some stocks first.
                </p>
              ) : (
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {watchlist.map((symbol) => (
                      <label
                        key={symbol}
                        className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSymbols.includes(symbol)}
                          onChange={() => handleToggleSymbol(symbol)}
                          className="mr-3 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="font-medium text-gray-800">{symbol}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Public/Private */}
            <div className="mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mr-3 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-gray-800">Public Share</span>
                  <p className="text-sm text-gray-500">
                    Turn off to make it private (only you can see)
                  </p>
                </div>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || loadingWatchlist || watchlist.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
