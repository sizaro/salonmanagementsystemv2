import { useState } from "react";

export default function ForgotPasswordForm({ onSubmit, onCancel, loading = false, message = null, error = null }) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    onSubmit(email.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Reset Password</h2>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-100 p-2 rounded">{error}</div>
      )}

      {message && (
        <div className="mb-4 text-sm text-green-700 bg-green-100 p-2 rounded">{message}</div>
      )}

      <label className="block mb-4">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-400 px-3 py-2"
          required
        />
      </label>

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded text-white font-medium ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-600 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
