import Modal from "./Modal"

export default function ConfirmModal({ open, onClose, onConfirm }) {
  if (!open) return null

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900">
        Delete user
      </h2>

      <p className="text-sm text-gray-500 mt-2">
        Are you sure you want to delete this user?
        This action cannot be undone.
      </p>

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          className="px-3 py-1 border rounded"
        >
          Cancel
        </button>

        <button
          onClick={onConfirm}
          className="px-4 py-1 bg-red-600 text-white rounded"
        >
          Delete
        </button>
      </div>
    </Modal>
  )
}
