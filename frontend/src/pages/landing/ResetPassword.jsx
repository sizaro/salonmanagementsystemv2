import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";

export default function ResetPassword() {
  const { resetPassword } = useData();
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [strength, setStrength] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // -----------------------
  // Password Strength Check
  // -----------------------
  const checkStrength = (password) => {
    if (password.length === 0) return null;

    const strongRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!strongRegex.test(password)) return "weak";
    if (password.length >= 12) return "strong";
    return "medium";
  };

  const handlePasswordChange = (value) => {
    setNewPassword(value);
    setStrength(checkStrength(value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await resetPassword({ token, newPassword });
      setSuccess("Password reset successful! Redirecting...");
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const strengthColors = {
    weak: "bg-red-500",
    medium: "bg-yellow-500",
    strong: "bg-green-600",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h2 className="mb-6 text-center text-2xl font-bold text-blue-700">Reset Your Password</h2>

        {/* ERROR */}
        {error && <p className="mb-4 rounded bg-red-100 p-2 text-sm text-red-600">{error}</p>}

        {/* SUCCESS */}
        {success && (
          <p className="mb-4 rounded bg-green-100 p-2 text-sm text-green-700">{success}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* NEW PASSWORD */}
          <div className="relative">
            <label className="text-sm font-medium text-gray-700">New Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-blue-400"
              required
            />

            {/* TOGGLE */}
            <span
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-9 right-3 cursor-pointer text-gray-500"
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </span>

            {/* STRENGTH BAR */}
            {strength && (
              <div className="mt-2">
                <div className={`h-2 rounded ${strengthColors[strength]}`}></div>
                <p className="mt-1 text-xs text-gray-600">
                  {strength === "weak" && "Password is too weak"}
                  {strength === "medium" && "Strong enough"}
                  {strength === "strong" && "Very strong password!"}
                </p>
              </div>
            )}
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="relative">
            <label className="text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 focus:ring-2 focus:ring-blue-400"
              required
            />

            <span
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute top-9 right-3 cursor-pointer text-gray-500"
            >
              {showConfirm ? "👁️" : "👁️‍🗨️"}
            </span>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-lg py-3 font-semibold text-white transition ${loading ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
