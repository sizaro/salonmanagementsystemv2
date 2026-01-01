// src/components/auth/LoginForm.jsx
import { useState } from "react";

export default function LoginForm({ onSubmit, onCancel, onForgotPassword, loading = false, error = null }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    onSubmit({ email: form.email.trim(), password: form.password });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Sign in</h2>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-100 p-2 rounded">
          {error}
        </div>
      )}

      <label className="block mb-2">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          value={form.email}
          onChange={handleChange}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-400 px-3 py-2"
          required
        />
      </label>

      <label className="block mb-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Password</span>
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-400 px-3 py-2"
          required
        />
      </label>

      <div className="flex justify-between items-center mt-2 mb-4">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-blue-600 hover:underline"
        >
          Forgot Password?
        </button>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded text-white font-medium ${
            loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Signing in..." : "Sign in"}
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
