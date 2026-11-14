import ProtectedRoute from '../ProtectedRoute';
import { ROLES } from '../../utils/roles';

/**
 * Route guard for admin pages.
 * - No token -> /login
 * - Signed in but not ADMIN (after role normalisation) -> that role's home page
 */
const AdminRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>{children}</ProtectedRoute>
);

export default AdminRoute;
