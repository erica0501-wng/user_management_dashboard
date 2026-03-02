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
    if (userData) {
      setUser(JSON.parse(userData))
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
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar />
      
      <div className="flex-1 ml-64 overflow-auto">
        {/* Header */}
        <div className="bg-white shadow-md sticky top-0 z-10">
          <div className="max-w-7xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Community Watchlists</h1>
                <p className="text-gray-600">Discover and share investment ideas with the community</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                <span className="text-xl">+</span>
                Create Share
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setActiveTab('explore')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all shadow-md ${
                  activeTab === 'explore'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-lg'
                }`}
              >
                Explore
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'explore' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {sharedWatchlists.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('my-shared')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all shadow-md ${
                  activeTab === 'my-shared'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-lg'
                }`}
              >
                My Shares
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'my-shared' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {mySharedWatchlists.length}
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search watchlist or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-lg"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
              <p className="mt-6 text-gray-600 font-medium text-lg">Loading watchlists...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeTab === 'explore' ? (
                filteredWatchlists.length === 0 ? (
                  <div className="col-span-full text-center py-20">
                    <div className="text-6xl mb-4">📭</div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                      {searchQuery ? 'No Results Found' : 'No Shared Watchlists Yet'}
                    </h3>
                    <p className="text-gray-600">
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
                  <div className="col-span-full text-center py-20">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">No Shared Watchlists</h3>
                    <p className="text-gray-600 mb-6">Start sharing your investment ideas with the community</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition font-semibold shadow-lg"
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

      {selectedWatchlist && (
        <SharedWatchlistDetailModal
          watchlist={selectedWatchlist}
          currentUserId={user?.id}
          onClose={() => setSelectedWatchlist(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  )
}

function WatchlistCard({ watchlist, currentUserId, isOwner, onView, onLike, onDelete }) {
  const isLiked = watchlist.likes?.some(like => like.userId === currentUserId)

  return (
    <div 
      className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-gray-100 hover:border-indigo-300 transform hover:-translate-y-1 cursor-pointer group"
      onClick={onView}
    >
      {/* Gradient Header */}
      <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
      
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-xl text-gray-900 mb-2 group-hover:text-indigo-600 transition">
              {watchlist.title}
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold text-sm">
                {watchlist.owner?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <p className="text-sm text-gray-600 font-medium">
                {watchlist.owner?.username || 'Unknown'}
              </p>
            </div>
          </div>
          {!watchlist.isPublic && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-semibold border border-yellow-200">
              🔒 Private
            </span>
          )}
        </div>

        {/* Description */}
        {watchlist.description && (
          <p className="text-gray-700 text-sm mb-4 line-clamp-2 leading-relaxed">
            {watchlist.description}
          </p>
        )}

        {/* Symbols */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stocks</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {watchlist.symbols?.slice(0, 6).map((symbol, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 text-sm rounded-lg font-bold border border-indigo-200 hover:from-indigo-100 hover:to-purple-100 transition"
              >
                ${symbol}
              </span>
            ))}
            {watchlist.symbols?.length > 6 && (
              <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg font-semibold">
                +{watchlist.symbols.length - 6}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t-2 border-gray-100">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg">
              <span className="text-lg">❤️</span>
              <span className="text-sm font-bold text-red-600">{watchlist._count?.likes || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
              <span className="text-lg">💬</span>
              <span className="text-sm font-bold text-blue-600">{watchlist._count?.comments || 0}</span>
            </div>
          </div>
          
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {!isOwner && onLike && (
              <button
                onClick={onLike}
                className={`p-2.5 rounded-xl transition-all transform hover:scale-110 ${
                  isLiked 
                    ? 'bg-red-100 text-red-500 shadow-md' 
                    : 'bg-gray-100 text-gray-400 hover:bg-red-50'
                }`}
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <span className="text-xl">{isLiked ? '❤️' : '🤍'}</span>
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => onDelete(watchlist.id)}
                className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all transform hover:scale-110 shadow-md"
                title="Delete"
              >
                <span className="text-xl">🗑️</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
