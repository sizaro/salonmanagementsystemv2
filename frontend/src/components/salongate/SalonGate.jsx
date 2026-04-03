import { Navigate, useParams } from "react-router-dom";
import { useData } from "../context/DataContext";

export default function SalonGate({ children }) {
  const { salon } = useData();
  const { slug } = useParams();

  // still loading salon info
  if (!salon) return null;

  // salon exists but setup not complete
  if (!salon.setup_complete) {
    return <Navigate to="/setup" replace />;
  }

  // salon ready → allow landing pages
  return children;
}
