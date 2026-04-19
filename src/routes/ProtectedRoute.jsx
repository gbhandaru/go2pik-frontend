import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function ProtectedRoute({ children, allowGuest = true }) {
  const location = useLocation();
  const { isAuthenticated, isGuest, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-section">
        <div className="page-empty-state">Validating your session...</div>
      </div>
    );
  }

  if (!isAuthenticated && !(allowGuest && isGuest)) {
    return <Navigate to="/login" replace state={{ from: { pathname: location.pathname } }} />;
  }

  return children || <Outlet />;
}
