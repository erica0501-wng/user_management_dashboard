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
      await toggleLike(watchlist.id)
      setIsLiked(!isLiked)
      await loadDetails()
      onUpdate()
    } catch (error) {
      console.error('Failed to toggle like:', error)
    }
  }

  const isOwner = currentUserId === watchlist.ownerId

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{watchlist.title}</h2>
              <p className="text-gray-600">
                Shared by: <span className="font-medium">{watchlist.owner?.username}</span>
              </p>
              {watchlist.description && (
                <p className="text-gray-600 mt-2">{watchlist.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4">
            <button
              onClick={handleToggleLike}
              disabled={!currentUserId}
              className={`flex items-center gap-2 ${
                currentUserId ? 'cursor-pointer hover:text-red-500' : 'cursor-default'
              } transition`}
            >
              <span className={isLiked ? 'text-red-500' : 'text-gray-400'}>
                {isLiked ? '❤️' : '🤍'}
              </span>
              <span className="font-medium">{watchlist._count?.likes || 0}</span>
            </button>
            <div className="flex items-center gap-2 text-gray-600">
              <span>💬</span>
              <span className="font-medium">{watchlist._count?.comments || 0}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Symbols */}
          <div className="p-6 border-b">
            <h3 className="font-semibold text-gray-800 mb-3">Stock List ({watchlist.symbols?.length || 0})</h3>
            <div className="flex flex-wrap gap-2">
              {watchlist.symbols?.map((symbol, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg font-medium"
                >
                  {symbol}
                </span>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Discussion ({watchlist.comments?.length || 0})</h3>

            {/* Add Comment Form */}
            {currentUserId && (
              <form onSubmit={handleAddComment} className="mb-6">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={loading || !commentText.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            )}

            {/* Comments List */}
            <div className="space-y-4">
              {watchlist.comments?.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                watchlist.comments?.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-800">
                          {comment.user?.username}
                        </span>
                        <span className="text-gray-500 text-sm ml-2">
                          {new Date(comment.createdAt).toLocaleDateString('en-US')}
                        </span>
                      </div>
                      {comment.userId === currentUserId && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="text-gray-700">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
