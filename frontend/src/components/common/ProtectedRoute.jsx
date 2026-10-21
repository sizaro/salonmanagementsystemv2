// src/components/common/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { SalehishPageLoader } from "../loading/SalehishPageLoader.jsx";

const ProtectedRoute = ({ children, role }) => {
  const { user, authInitializing } = useData();

  if (authInitializing) {
    return <SalehishPageLoader message="RESTORING YOUR SALON WORKSPACE" />;
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
