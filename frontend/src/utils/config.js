const rawEnvUrl = import.meta.env.VITE_API_URL;

function resolveApiBaseUrl() {
  if (rawEnvUrl && rawEnvUrl.trim()) {
    return rawEnvUrl.trim().replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    // In production on driveportz.com or custom domain, default to active origin
    return window.location.origin.includes('driveportz')
      ? 'https://www.driveportz.com'
      : window.location.origin;
  }

  return 'http://localhost:5000';
}

export const API_BASE_URL = resolveApiBaseUrl();
