import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
  if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
  return role || 'USER';
}

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
