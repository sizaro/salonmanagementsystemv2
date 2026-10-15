export default function Button({ onClick, children, className = '', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`app-primary-button px-4 py-2 ${className}`}
    >
      {children}
    </button>
  );
}
