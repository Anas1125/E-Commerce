import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../context/useAuth";
import { LoadingState } from "./Storefront";
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Restoring your session…" />;
  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}
export default ProtectedRoute;
