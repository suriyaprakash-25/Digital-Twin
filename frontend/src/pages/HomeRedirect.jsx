import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeRole } from '../utils/roles';

const HomeRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const role = normalizeRole(user?.role);

    if (role === 'GARAGE') {
      navigate('/garage-dashboard', { replace: true });
      return;
    }

    navigate('/user-dashboard', { replace: true });
  }, [navigate]);

  return null;
};

export default HomeRedirect;
