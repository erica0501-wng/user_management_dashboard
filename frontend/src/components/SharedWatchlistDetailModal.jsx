import { useState, useEffect } from "react"
import { getSharedWatchlistById, addComment, deleteComment, toggleLike, checkIsLiked } from "../services/social"

export default function SharedWatchlistDetailModal({ watchlist: initialWatchlist, currentUserId, onClose, onUpdate }) {
  const [watchlist, setWatchlist] = useState(initialWatchlist)
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  useEffect(() => {
    loadDetails()
    if (currentUserId) {
      loadLikeStatus()
    }
  }, [])

  const loadDetails = async () => {
    try {
      const data = await getSharedWatchlistById(watchlist.id)
      setWatchlist(data)
    } catch (error) {
      console.error('Failed to load watchlist details:', error)
    }
  }

  const loadLikeStatus = async () => {
    try {
      const { liked } = await checkIsLiked(watchlist.id)
      setIsLiked(liked)
    } catch (error) {
      console.error('Failed to check like status:', error)
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return

    setLoading(true)
    try {
      await addComment(watchlist.id, commentText.trim())
      setCommentText('')
      await loadDetails()
      onUpdate()
    } catch (error) {
      console.error('Failed to add comment:', error)
      alert('Failed to add comment, please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      await deleteComment(commentId)
      await loadDetails()
      onUpdate()
    } catch (error) {
      console.error('Failed to delete comment:', error)
      alert('Failed to delete, please try again')
    }
  }

  const handleToggleLike = async () => {
    try {
      console.log('Toggling like for watchlist:', watchlist.id, 'Current isLiked:', isLiked)
      await toggleLike(watchlist.id)
      setIsLiked(!isLiked)
      await loadDetails()
      onUpdate()
      console.log('Like toggled successfully, new isLiked:', !isLiked)
    } catch (error) {
      console.error('Failed to toggle like:', error)
      alert('Failed to toggle like. Please try again.')
    }
  }

  const isOwner = currentUserId === watchlist.ownerId

  console.log('Modal - currentUserId:', currentUserId, 'ownerId:', watchlist.ownerId, 'isOwner:', isOwner, 'isLiked:', isLiked)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-100 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-300 bg-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{watchlist.title}</h2>
              <p className="text-sm text-gray-600">
                Shared by: <span className="font-semibold text-gray-800">{watchlist.owner?.username}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg w-8 h-8 flex items-center justify-center transition"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {watchlist.description && (
            <p className="text-sm text-gray-600 mb-4">{watchlist.description}</p>
          )}

          {/* Stats */}
          <div className="flex gap-4">
            {currentUserId ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleLike()
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  isLiked
                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    : 'bg-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                }`}
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                <span className="font-medium">{watchlist._count?.likes || 0}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                <span className="font-medium">{watchlist._count?.likes || 0}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{watchlist._count?.comments || 0}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Symbols */}
          <div className="bg-white rounded-lg p-4 border border-gray-300">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Stock List ({watchlist.symbols?.length || 0})</h3>
            <div className="flex flex-wrap gap-2">
              {watchlist.symbols?.map((symbol, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-semibold text-sm border border-indigo-200"
                >
                  {symbol}
                </span>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white rounded-lg p-4 border border-gray-300">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Discussion ({watchlist.comments?.length || 0})</h3>

            {/* Add Comment Form */}
            {currentUserId && (
              <form onSubmit={handleAddComment} className="mb-6">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm bg-white"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={loading || !commentText.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {loading ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            )}

            {/* Comments List */}
            <div className="space-y-3">
              {watchlist.comments?.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                watchlist.comments?.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium text-xs">
                          {comment.user?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-800 text-sm">
                            {comment.user?.username}
                          </span>
                          <span className="text-gray-500 text-xs ml-2">
                            {new Date(comment.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                      {comment.userId === currentUserId && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-300 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
