import { useRef } from 'react';
import { Camera, FolderOpen, Plus, Receipt, X } from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUrl';
import CameraModal from './CameraModal';

/** Optional bill / service photos: camera capture or file picker, with thumbnails. */
const BillPhotosSection = ({ billPhotos, onFileChange, onRemove, camera }) => {
  const fileInputRef = useRef(null);
  const pickFile = () => fileInputRef.current?.click();

  return (
    <section className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
      <div className="bg-violet-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-violet-100 flex items-center gap-2.5">
        <div className="p-1 md:p-1.5 bg-violet-100 rounded-lg text-violet-600"><Receipt className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" /></div>
        <h2 className="text-sm md:text-xl font-bold text-slate-800">Service Photos & Documentation</h2>
        {billPhotos.length > 0 && (
          <span className="ml-2 text-[10px] sm:text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-violet-200">
            {billPhotos.length} photo{billPhotos.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-[10px] sm:text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">Optional</span>
      </div>
      <div className="p-3 md:p-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Choose bill photo file"
          tabIndex={-1}
          onChange={onFileChange}
        />

        {billPhotos.length === 0 ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={camera.openCamera}
              className="flex-1 flex flex-col items-center justify-center gap-2 md:gap-3 border-2 border-dashed border-violet-200 rounded-2xl py-6 md:py-10 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all group cursor-pointer"
            >
              <div className="p-3 md:p-4 bg-white rounded-2xl shadow-sm border border-violet-100 group-hover:scale-105 transition-transform">
                <Camera className="h-6 w-6 md:h-8 md:w-8 text-violet-500" aria-hidden="true" />
              </div>
              <span className="text-xs md:text-sm font-bold text-violet-700">Take Photo</span>
              <span className="text-[10px] md:text-xs text-slate-400 font-medium">Open camera</span>
            </button>

            <button
              type="button"
              onClick={pickFile}
              className="flex-1 flex flex-col items-center justify-center gap-2 md:gap-3 border-2 border-dashed border-slate-200 rounded-2xl py-6 md:py-10 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all group cursor-pointer"
            >
              <div className="p-3 md:p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                <FolderOpen className="h-6 w-6 md:h-8 md:w-8 text-slate-400" aria-hidden="true" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-600">Choose File</span>
              <span className="text-[10px] md:text-xs text-slate-400 font-medium">Browse gallery / files</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {billPhotos.map((src, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border-2 border-violet-100 shadow-sm aspect-square bg-slate-900 animate-in fade-in zoom-in duration-200">
                  <img src={getPhotoUrl(src)} alt={`Bill ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-start justify-end p-1.5">
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      aria-label={`Remove bill photo ${idx + 1}`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-lg cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-md">{idx + 1}</span>
                </div>
              ))}

              <button
                type="button"
                onClick={camera.openCamera}
                className="aspect-square flex flex-col items-center justify-center gap-1.5 md:gap-2 border-2 border-dashed border-violet-200 rounded-xl bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all group cursor-pointer"
              >
                <Camera className="h-5 w-5 text-violet-500" aria-hidden="true" />
                <span className="text-[10px] md:text-xs font-bold text-violet-600">Take Photo</span>
              </button>

              <button
                type="button"
                onClick={pickFile}
                className="aspect-square flex flex-col items-center justify-center gap-1.5 md:gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all group cursor-pointer"
              >
                <Plus className="h-5 w-5 text-slate-400" aria-hidden="true" />
                <span className="text-[10px] md:text-xs font-bold text-slate-500">Add Photo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <CameraModal camera={camera} />
    </section>
  );
};

export default BillPhotosSection;
