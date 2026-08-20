import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({
  isOpen,
  onClose,
  children,
  sizeClass = "max-w-md",
}) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/20 backdrop-blur-sm p-2">
      <div
        className={`
          flex
          h-[calc(100dvh-1rem)]
          w-full
          flex-col
          overflow-hidden
          rounded-xl
          bg-white
          shadow-2xl
          ${sizeClass}
        `}
      >
        {/* ONLY THIS AREA SCROLLS */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {children}
        </div>

        {/* ALWAYS STAYS AT BOTTOM */}
        <div className="shrink-0 border-t border-gray-200 bg-white p-3">
          <button
            type="button"
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
