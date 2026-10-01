import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../context/useAuth";
import { LoadingState } from "./Storefront";
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Verifying administrator access…" />;
  if (!user)
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
export default AdminRoute;
