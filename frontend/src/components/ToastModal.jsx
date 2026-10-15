import { useEffect } from "react";

export default function ToastModal({ message, type = "success", duration = 5000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!message) return null;

  const tone = type === "success" ? "app-toast-success" : "app-toast-error";

  return (
    <div
      className={`${tone} app-toast fixed right-4 top-4 z-50 px-4 py-3 text-white`}
    >
      {message}
    </div>
  );
}
