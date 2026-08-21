const rawEnvUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

function resolveApiBaseUrl() {
  if (rawEnvUrl && rawEnvUrl.trim()) {
    return rawEnvUrl.trim().replace(/\/$/, '').replace(/\/api$/, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }

  // Production Render backend
  return 'https://driveportz.onrender.com';
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_ROOT_URL = `${API_BASE_URL}/api`;

