import { Navigate } from 'react-router-dom';

/**
 * Route guard for admin pages.
 * - No token → redirect to /login
 * - Token but not ADMIN role → redirect to /user-dashboard
 */
const AdminRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    try {
        const userRaw = localStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;
        const role = String(user?.role || '').toUpperCase();

        if (role !== 'ADMIN') {
            return <Navigate to="/user-dashboard" replace />;
        }
    } catch {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default AdminRoute;
