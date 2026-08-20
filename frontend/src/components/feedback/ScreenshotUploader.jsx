import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, X, AlertCircle } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const ScreenshotUploader = ({ file, previewUrl, onChange, onRemove, disabled = false }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const validateAndSetFile = (selectedFile) => {
    setErrorMsg('');
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setErrorMsg('Unsupported file type. Please upload a PNG, JPG, JPEG, or WEBP image.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMsg('Image size exceeds 5MB limit. Please choose a smaller file.');
      return;
    }

    const preview = URL.createObjectURL(selectedFile);
    onChange(selectedFile, preview);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleRemove = () => {
    setErrorMsg('');
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5 text-teal-600" />
          Attach Screenshot <span className="text-slate-400 font-normal">(Optional)</span>
        </label>
        <span className="text-[11px] text-slate-400">Max 5MB (PNG, JPG, WEBP)</span>
      </div>

      {previewUrl ? (
        <div className="relative group border border-teal-200 bg-teal-50/40 rounded-2xl p-2 flex items-center gap-3 overflow-hidden">
          <img
            src={previewUrl}
            alt="Screenshot preview"
            className="w-16 h-16 object-cover rounded-xl border border-teal-100 bg-white shadow-sm shrink-0"
          />
          <div className="flex-1 min-w-0 pr-8">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {file?.name || 'Attached screenshot'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {file?.size ? formatFileSize(file.size) : 'Ready for upload'}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded mt-1">
              Ready to submit
            </span>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={handleRemove}
            aria-label="Remove screenshot"
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 shadow-sm transition-all duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-1.5 ${
            dragActive
              ? 'border-teal-500 bg-teal-50/60 scale-[0.99]'
              : 'border-slate-200 hover:border-teal-400 hover:bg-slate-50/80 bg-slate-50/40'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">
              <span className="text-teal-600 hover:underline">Click to upload</span> or drag & drop screenshot
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Helpful for bug reports, UI suggestions & issue context
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200/80 px-2.5 py-1.5 rounded-xl">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};

export default ScreenshotUploader;
