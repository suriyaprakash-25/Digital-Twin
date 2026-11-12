const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { HTTP_LIMITS } = require('../core/constants');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const DEFAULT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const SIGNATURE_BYTES = 12;

/** Extension is derived from the VALIDATED type, never from the client filename (no .html/.svg). */
const EXTENSION_BY_MIME = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
});

/** File signatures ("magic bytes"): the client-sent Content-Type alone is trivially forged. */
const SIGNATURE_CHECKS = Object.freeze({
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  'image/gif': (b) => b.toString('ascii', 0, 4) === 'GIF8',
  'application/pdf': (b) => b.toString('ascii', 0, 4) === '%PDF',
});

function unsupportedType(message) {
  const err = new Error(message);
  err.code = 'UNSUPPORTED_FILE_TYPE';
  return err;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${EXTENSION_BY_MIME[file.mimetype] || '.bin'}`),
});

function readSignature(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(SIGNATURE_BYTES);
    fs.readSync(fd, buffer, 0, SIGNATURE_BYTES, 0);
    return buffer;
  } finally {
    fs.closeSync(fd);
  }
}

function collectFiles(req) {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') return Object.values(req.files).flat();
  return [];
}

/** Post-upload middleware: deletes every uploaded file and rejects if any signature mismatches. */
function verifyUploadedSignatures(req, res, next) {
  const files = collectFiles(req);
  const invalid = files.find((file) => {
    const check = SIGNATURE_CHECKS[file.mimetype];
    try {
      return !check || !check(readSignature(file.path));
    } catch {
      return true;
    }
  });
  if (!invalid) return next();
  files.forEach((file) => fs.unlink(file.path, () => {}));
  return next(unsupportedType('Uploaded file content does not match its declared type.'));
}

/**
 * Same API as a multer instance (single/array/fields/any/none) with content verification appended.
 * @param {string[]} allowedMimeTypes
 * @param {number} maxSizeBytes
 */
const createUploader = (allowedMimeTypes = DEFAULT_IMAGE_TYPES, maxSizeBytes = Math.min(DEFAULT_MAX_BYTES, HTTP_LIMITS.UPLOAD_MAX_BYTES)) => {
  const allowed = allowedMimeTypes.filter((type) => EXTENSION_BY_MIME[type]);
  const fileFilter = (req, file, cb) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(unsupportedType(`Invalid file type. Only ${allowed.map((m) => m.split('/')[1].toUpperCase()).join(', ')} allowed.`), false);
  };
  const instance = multer({ storage, fileFilter, limits: { fileSize: maxSizeBytes, files: 10 } });
  // One composite middleware function, so it works both in route chains and when invoked directly
  // as `uploader.single('file')(req, res, callback)` (routes/media.js).
  const withVerification = (middleware) => (req, res, next) => middleware(req, res, (err) => (err ? next(err) : verifyUploadedSignatures(req, res, next)));
  return {
    single: (name) => withVerification(instance.single(name)),
    array: (name, maxCount) => withVerification(instance.array(name, maxCount)),
    fields: (fields) => withVerification(instance.fields(fields)),
    any: () => withVerification(instance.any()),
    none: () => instance.none(),
  };
};

// Default generic uploader (backward compatible)
const upload = createUploader();

function removeUploadByUrl(url) {
  if (!url) return;
  // basename() strips any path segments, so a crafted URL cannot delete files outside uploads/.
  const filename = path.basename(String(url).split('?')[0]);
  if (!filename || filename.startsWith('.')) return;
  const fullPath = path.join(uploadsDir, filename);
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(fullPath, (err2) => {
        if (err2) console.error('Error asynchronously deleting file:', err2);
      });
    }
  });
}

module.exports = { upload, createUploader, uploadsDir, removeUploadByUrl, verifyUploadedSignatures, EXTENSION_BY_MIME };
