import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiRequest, apiUpload, getErrorMessage } from '../../utils/api';
import { getPhotoUrl } from '../../utils/imageUrl';
import { useToast } from '../../context/toastContextCore';

/**
 * Shop photo gallery editor. Uploads and deletions hit the API immediately;
 * `onChange(photos, { persisted })` reports the new list to the parent form.
 */
const GalleryManager = ({ photos, onChange }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { showToast } = useToast();

  const handleDelete = async (idx, targetUrl) => {
    onChange(photos.filter((_, i) => i !== idx), { persisted: false });
    try {
      await apiRequest({ method: 'delete', url: '/garages/gallery', data: { photoUrl: targetUrl } });
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete gallery photo.'), 'error');
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('photos', f));
      const data = await apiUpload('/garages/gallery', formData);
      if (Array.isArray(data?.galleryPhotos)) {
        onChange(data.galleryPhotos, { persisted: true });
        showToast(`${files.length} photo(s) uploaded & saved!`, 'success');
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to upload photo(s).'), 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {photos.map((url, idx) => (
        <div key={idx} className="relative group rounded-xl overflow-hidden h-24 border border-slate-200 bg-slate-100">
          <img
            src={getPhotoUrl(url)}
            alt={`Shop photo ${idx + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.parentElement.style.display = 'none';
            }}
          />
          <button
            type="button"
            onClick={() => handleDelete(idx, url)}
            className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shadow-md"
            title="Delete photo"
            aria-label={`Delete shop photo ${idx + 1}`}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-teal-600 transition-all font-semibold text-xs"
      >
        {uploading ? (
          <span role="status" aria-label="Uploading photos" className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span>Upload Photos</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Upload shop photos"
        onChange={handleUpload}
      />
    </div>
  );
};

export default GalleryManager;
