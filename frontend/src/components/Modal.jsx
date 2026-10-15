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
    <div className="app-modal-backdrop fixed inset-0 z-[99999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden p-2">
      <div
        className={`
          app-modal-surface
          flex
          h-[calc(100dvh-1rem)]
          w-full
          flex-col
          overflow-hidden
          rounded-xl
          ${sizeClass}
        `}
      >
        {/* ONLY THIS AREA SCROLLS */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {children}
        </div>

        {/* ALWAYS STAYS AT BOTTOM */}
        <div className="app-modal-footer shrink-0 p-3">
          <button
            type="button"
            className="app-modal-close"
            onClick={onClose}
            disabled={!onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
