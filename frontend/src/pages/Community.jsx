import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import { getSharedWatchlists, getMySharedWatchlists, deleteSharedWatchlist, toggleLike } from "../services/social"
import CreateSharedWatchlistModal from "../components/CreateSharedWatchlistModal"
import SharedWatchlistDetailModal from "../components/SharedWatchlistDetailModal"

export default function Community() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sharedWatchlists, setSharedWatchlists] = useState([])
  const [mySharedWatchlists, setMySharedWatchlists] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('explore') // explore, my-shared
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedWatchlist, setSelectedWatchlist] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem("user")
    console.log('Community - Raw userData from localStorage:', userData)
    if (userData) {
      const parsedUser = JSON.parse(userData)
      console.log('Community - Parsed user:', parsedUser)
      setUser(parsedUser)
    }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [shared, myShared] = await Promise.all([
        getSharedWatchlists(),
        getMySharedWatchlists()
      ])
      console.log('My Shared Watchlists data:', myShared)
      setSharedWatchlists(shared)
      setMySharedWatchlists(myShared)
    } catch (error) {
      console.error('Failed to load shared watchlists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this shared watchlist?')) return
    
    try {
      await deleteSharedWatchlist(id)
      await loadData()
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete. Please try again.')
    }
  }

  const handleLike = async (id) => {
    try {
      await toggleLike(id)
      await loadData()
    } catch (error) {
      console.error('Failed to toggle like:', error)
    }
  }

  const filteredWatchlists = sharedWatchlists.filter(wl => {
    if (!searchQuery) return true
    return wl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           wl.owner.username.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="flex">
      <Sidebar />
      
      <div className="ml-64 w-full min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="p-8">
          <div className="mx-auto" style={{ maxWidth: "1400px" }}>
            {/* Header */}
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Community Watchlists</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Discover and share investment ideas with the community
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                + Create Share
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('explore')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'explore'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                Explore ({sharedWatchlists.length})
              </button>
              <button
                onClick={() => setActiveTab('my-shared')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === 'my-shared'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                My Shares ({mySharedWatchlists.length})
              </button>
            </div>

            {/* Search */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search watchlist or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-indigo-600"></div>
                <p className="mt-4 text-gray-600">Loading watchlists...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTab === 'explore' ? (
                  filteredWatchlists.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-lg">
                      <div className="text-4xl mb-3">📭</div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">
                        {searchQuery ? 'No Results Found' : 'No Shared Watchlists Yet'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {searchQuery ? 'Try a different search term' : 'Be the first to share a watchlist!'}
                      </p>
                    </div>
                  ) : (
                    filteredWatchlists.map((wl) => (
                      <WatchlistCard
                        key={wl.id}
                        watchlist={wl}
                        currentUserId={user?.id}
                        onView={() => setSelectedWatchlist(wl)}
                        onLike={() => handleLike(wl.id)}
                        onDelete={handleDelete}
                      />
                    ))
                  )
                ) : (
                  mySharedWatchlists.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-lg">
                      <div className="text-4xl mb-3">📊</div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">No Shared Watchlists</h3>
                      <p className="text-sm text-gray-600 mb-4">Start sharing your investment ideas with the community</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                      >
                        Create Your First Share
                      </button>
                    </div>
                  ) : (
                    mySharedWatchlists.map((wl) => (
                      <WatchlistCard
                        key={wl.id}
                        watchlist={wl}
                        currentUserId={user?.id}
                        isOwner={true}
                        onView={() => setSelectedWatchlist(wl)}
                        onDelete={handleDelete}
                      />
                    ))
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateSharedWatchlistModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadData()
          }}
        />
      )}

      {selectedWatchlist && (() => {
        console.log('Rendering modal - watchlist:', selectedWatchlist.id, 'ownerId:', selectedWatchlist.ownerId, 'user:', user, 'user.id:', user?.id)
        return (
          <SharedWatchlistDetailModal
            watchlist={selectedWatchlist}
            currentUserId={user?.id}
            onClose={() => {
              console.log('Closing modal, user:', user)
              setSelectedWatchlist(null)
            }}
            onUpdate={loadData}
          />
        )
      })()}
    </div>
  )
}

function WatchlistCard({ watchlist, currentUserId, isOwner, onView, onLike, onDelete }) {
  const isLiked = watchlist.likes?.some(like => like.userId === currentUserId)

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer relative"
      onClick={onView}
    >
      {/* Delete button in top right - visible for all cards */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(watchlist.id)
        }}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
        title="Delete"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <div className="p-4">
        {/* Header */}
        <div className="mb-3 pr-6">
          <h3 className="font-semibold text-base text-gray-900 mb-2">
            {watchlist.title}
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium text-xs">
              {watchlist.owner?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <p className="text-xs text-gray-600">
              {watchlist.owner?.username || 'Unknown'}
            </p>
            {!watchlist.isPublic && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                🔒 Private
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {watchlist.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {watchlist.description}
          </p>
        )}

        {/* Symbols */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            {watchlist.symbols?.slice(0, 5).map((symbol, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium"
              >
                {symbol}
              </span>
            ))}
            {watchlist.symbols?.length > 5 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                +{watchlist.symbols.length - 5}
              </span>
            )}
          </div>
        </div>

        {/* Footer - Like and Comment counts */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
          {onLike ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onLike()
              }}
              className={`flex items-center gap-1 transition-colors ${
                isLiked 
                  ? 'text-indigo-600 hover:text-indigo-700' 
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              {watchlist._count?.likes || 0}
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              {watchlist._count?.likes || 0}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            {watchlist._count?.comments || 0}
          </span>
        </div>
      </div>
    </div>
  )
}
