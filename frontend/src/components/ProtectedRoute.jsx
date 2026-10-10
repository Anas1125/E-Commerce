import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../context/useAuth";
import { LoadingState } from "./Storefront";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, sessionError } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Restoring your session…" />;

  if (sessionError) {
    return (
      <div role="alert">
        We couldn't restore your session.{" "}
        <button type="button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}

export default ProtectedRoute;