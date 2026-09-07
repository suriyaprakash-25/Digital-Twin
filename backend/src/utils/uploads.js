const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const randomHex = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomHex}${ext}`);
  }
});

const createUploader = (allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSizeBytes = 5 * 1024 * 1024) => {
  const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowedMimeTypes.map(m => m.split('/')[1].toUpperCase()).join(', ')} allowed.`), false);
    }
  };

  return multer({ 
    storage,
    fileFilter,
    limits: { fileSize: maxSizeBytes }
  });
};

// Default generic uploader (backward compatible)
const upload = createUploader();

function removeUploadByUrl(url) {
  if (!url) return;
  const filename = String(url).split('/').pop();
  const fullPath = path.join(uploadsDir, filename);
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(fullPath, (err2) => {
        if (err2) console.error('Error asynchronously deleting file:', err2);
      });
    }
  });
}

module.exports = { upload, createUploader, uploadsDir, removeUploadByUrl };
