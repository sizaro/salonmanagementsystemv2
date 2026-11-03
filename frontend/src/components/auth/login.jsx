// src/components/auth/LoginForm.jsx
import { useState } from "react";

export default function LoginForm({
  onSubmit,
  onCancel,
  onForgotPassword,
  loading = false,
  error = null,
}) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    onSubmit({ email: form.email.trim(), password: form.password });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
      <h2 className="mb-4 text-2xl font-semibold text-gray-800">Sign in</h2>

      {error && <div className="mb-4 rounded bg-red-100 p-2 text-sm text-red-700">{error}</div>}

      <label className="mb-2 block">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          value={form.email}
          onChange={handleChange}
          className="mt-1 block w-full rounded border-gray-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
          required
        />
      </label>

      <label className="mb-2 block">
        <div className="flex items-center justify-between">
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
          className="mt-1 block w-full rounded border-gray-300 px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
          required
        />
      </label>

      <div className="mt-2 mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-blue-600 hover:underline"
        >
          Forgot Password?
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="submit"
          disabled={loading}
          className={`rounded px-4 py-2 font-medium text-white ${
            loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
