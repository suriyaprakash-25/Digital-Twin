const rawEnvUrl = import.meta.env.VITE_API_URL;

function normalizeApiBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '').replace(/\/api$/, '');
}

function resolveApiBaseUrl() {
  if (rawEnvUrl && rawEnvUrl.trim()) {
    return normalizeApiBaseUrl(rawEnvUrl);
  }

  if (import.meta.env.PROD) {
    throw new Error('VITE_API_URL is required in production. Configure it in the Vercel Production environment.');
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return `http://${hostname}:5000`;
    }
  }

  return 'http://localhost:5000';
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_ROOT_URL = `${API_BASE_URL}/api`;
