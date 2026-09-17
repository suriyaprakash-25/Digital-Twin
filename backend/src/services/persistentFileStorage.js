const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { loadConfig } = require('../config');
const { removeUploadByUrl } = require('../utils/uploads');

let configuredSignature = null;

function getCloudinaryConfig() {
  const config = loadConfig();
  return config.cloudinary || {};
}

function isCloudinaryConfigured() {
  const cfg = getCloudinaryConfig();
  return Boolean(cfg.cloudName && cfg.apiKey && cfg.apiSecret);
}

function ensureCloudinaryConfigured() {
  const cfg = getCloudinaryConfig();
  if (!cfg.cloudName || !cfg.apiKey || !cfg.apiSecret) {
    throw new Error('Cloudinary storage is not fully configured. CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required.');
  }

  const signature = `${cfg.cloudName}:${cfg.apiKey}:${cfg.apiSecret}`;
  if (configuredSignature !== signature) {
    cloudinary.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret,
      secure: true
    });
    configuredSignature = signature;
  }

  return cfg;
}

function removeTemporaryFile(file) {
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch (error) {
    console.warn('Temporary upload cleanup failed:', error.message);
  }
}

function parseCloudinaryImageUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(String(url));
    if (parsed.hostname !== 'res.cloudinary.com') return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');
    if (uploadIndex < 1 || uploadIndex >= segments.length - 1) return null;

    const resourceType = segments[uploadIndex - 1];
    if (!['image', 'video'].includes(resourceType)) return null;

    let assetSegments = segments.slice(uploadIndex + 1);
    if (assetSegments[0] && /^v\d+$/.test(assetSegments[0])) {
      assetSegments = assetSegments.slice(1);
    }
    if (assetSegments.length === 0) return null;

    const finalSegment = assetSegments[assetSegments.length - 1];
    assetSegments[assetSegments.length - 1] = finalSegment.replace(/\.[^.]+$/, '');

    return {
      storageProvider: 'cloudinary',
      storageKey: decodeURIComponent(assetSegments.join('/')),
      resourceType
    };
  } catch {
    return null;
  }
}

/**
 * Persist a multer disk upload. In production Cloudinary is mandatory; in
 * development a local /uploads URL remains available for offline development.
 */
async function persistUploadedFile(file, { folder = 'driveportz', resourceType = 'auto' } = {}) {
  if (!file) return null;

  if (isCloudinaryConfigured()) {
    ensureCloudinaryConfigured();
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: resourceType
      });

      return {
        url: result.secure_url,
        storageProvider: 'cloudinary',
        storageKey: result.public_id,
        resourceType: result.resource_type || resourceType,
        bytes: result.bytes || file.size || null,
        originalName: file.originalname || null,
        mimeType: file.mimetype || null
      };
    } finally {
      removeTemporaryFile(file);
    }
  }

  if ((process.env.NODE_ENV || 'development').toLowerCase() === 'production') {
    removeTemporaryFile(file);
    throw new Error('Persistent file storage is unavailable in production because Cloudinary is not configured.');
  }

  return {
    url: `/uploads/${file.filename || path.basename(file.path)}`,
    storageProvider: 'local',
    storageKey: file.filename || path.basename(file.path),
    resourceType: resourceType === 'auto' ? null : resourceType,
    bytes: file.size || null,
    originalName: file.originalname || null,
    mimeType: file.mimetype || null
  };
}

/**
 * Persist multiple uploads as one logical operation. If any upload fails,
 * already-persisted objects are deleted and any remaining temporary files are
 * cleaned up so callers never receive a partially persisted gallery/batch.
 */
async function persistUploadedFiles(files = [], options = {}) {
  const inputFiles = Array.isArray(files) ? files : [];
  const persisted = [];

  try {
    for (const file of inputFiles) {
      const asset = await persistUploadedFile(file, options);
      if (asset) persisted.push(asset);
    }
    return persisted;
  } catch (error) {
    for (const file of inputFiles) removeTemporaryFile(file);
    await Promise.allSettled(persisted.map((asset) => deletePersistedFile(asset)));
    throw error;
  }
}

async function deletePersistedFile({ url, storageProvider, storageKey, resourceType = 'image' } = {}) {
  const parsedCloudinary = !storageKey ? parseCloudinaryImageUrl(url) : null;
  const provider = storageProvider || parsedCloudinary?.storageProvider;
  const key = storageKey || parsedCloudinary?.storageKey;
  const resolvedResourceType = resourceType || parsedCloudinary?.resourceType || 'image';

  if (provider === 'cloudinary' && key) {
    ensureCloudinaryConfigured();
    try {
      await cloudinary.uploader.destroy(key, {
        resource_type: resolvedResourceType,
        invalidate: true
      });
    } catch (error) {
      console.warn('Cloudinary delete failed:', error.message);
    }
    return;
  }

  if (url && (url.startsWith('/uploads/') || url.includes('/uploads/'))) {
    removeUploadByUrl(url);
  }
}

module.exports = {
  isCloudinaryConfigured,
  ensureCloudinaryConfigured,
  parseCloudinaryImageUrl,
  persistUploadedFile,
  persistUploadedFiles,
  deletePersistedFile,
  removeTemporaryFile
};
