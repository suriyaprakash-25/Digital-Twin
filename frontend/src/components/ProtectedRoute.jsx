import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/authContextCore';
import { hasRole, homePathForRole } from '../utils/roles';
import PageLoader from './common/PageLoader';

/**
 * Route guard for signed-in pages.
 * - Session still being restored from the cookie -> loading state (never redirect yet)
 * - No session -> /login
 * - `allowedRoles` given and the verified role is not in it -> that role's home page
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isBootstrapping, isAuthenticated, role } = useAuth();

  if (isBootstrapping) {
    return <PageLoader fullScreen label="Restoring your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(role, allowedRoles)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
