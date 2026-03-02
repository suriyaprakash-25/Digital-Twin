const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeOriginal = String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    cb(null, `${ts}_${safeOriginal}`);
  }
});

const upload = multer({ storage });

function removeUploadByUrl(url) {
  if (!url) return;
  const filename = String(url).split('/').pop();
  const fullPath = path.join(uploadsDir, filename);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

module.exports = { upload, uploadsDir, removeUploadByUrl };
