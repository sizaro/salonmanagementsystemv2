// src/components/common/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useData } from "../../context/DataContext";

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        Checking access...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (role && String(user.role || "").toLowerCase() !== String(role).toLowerCase()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
