/**
 * Helper function to safely format and resolve photo URLs.
 * Handles relative paths (/uploads/...), localhost URLs, data URIs, and external URLs.
 */
export const getPhotoUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;

  // Base API URL
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

  // 1. Data URIs or Blob URLs
  if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
    return cleanUrl;
  }

  // 2. Localhost hardcoded URLs -> replace host with actual API Base URL
  if (cleanUrl.includes('localhost:5000')) {
    const path = cleanUrl.replace(/^https?:\/\/localhost:5000/, '');
    return `${apiBase}${path.startsWith('/') ? path : '/' + path}`;
  }

  // 3. Absolute HTTP(S) URLs (Unsplash, Cloudinary, etc.)
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }

  // 4. Relative paths (e.g. /uploads/filename.jpg or uploads/filename.jpg)
  const relativePath = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  return `${apiBase}${relativePath}`;
};
