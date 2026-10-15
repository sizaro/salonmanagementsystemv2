import React from "react";

const ConfirmModal = ({ isOpen, onClose, onConfirm, message, confirmMessage =""}) => {
  if (!isOpen) return null;

  return (
    <div className="app-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="app-confirm-surface w-80 rounded-2xl p-6 text-center">
        <p className="text-lg font-medium text-gray-800 mb-4">{message}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onConfirm}
            className="app-danger-button"
          >
            {confirmMessage}
          </button>
          <button
            onClick={onClose}
            className="app-secondary-button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
