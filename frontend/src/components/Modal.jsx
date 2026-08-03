export default function Modal({ isOpen, onClose, children, sizeClass = "max-w-md" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`bg-white p-6 rounded shadow-md w-[calc(100%-2rem)] ${sizeClass}`}>
        {children}
        <button
          className="mt-4 bg-red-500 hover:bg-green-600 text-white py-1 px-4 rounded"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
