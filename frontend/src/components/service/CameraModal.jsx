import { Camera, SwitchCamera, X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

/** Full-screen camera capture for bill photos (state lives in useBillPhotos). */
const CameraModal = ({ camera }) => {
  const { showCamera, cameraError, videoRef, canvasRef, closeCamera, flipCamera, capturePhoto } = camera;
  const { dialogProps, titleId } = useDialog({ isOpen: showCamera, onClose: closeCamera });
  if (!showCamera) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
      <div {...dialogProps} className="relative w-full max-w-2xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 focus:outline-none">
        <div className="flex items-center justify-between px-5 py-4 bg-black/60 border-b border-white/10">
          <h2 id={titleId} className="flex items-center gap-2 text-white font-bold text-sm">
            <Camera className="h-4 w-4 text-violet-400" aria-hidden="true" /> Take Bill Photo
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={flipCamera}
              aria-label="Switch camera"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <SwitchCamera className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={closeCamera}
              aria-label="Close camera"
              className="p-2 rounded-full bg-white/10 hover:bg-red-500/80 text-white transition-colors"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {cameraError ? (
          <div role="alert" className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
            <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
              <Camera className="h-10 w-10 text-red-400" aria-hidden="true" />
            </div>
            <p className="text-red-300 font-semibold text-sm">{cameraError}</p>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[60vh] object-cover bg-black" />
        )}

        <canvas ref={canvasRef} className="hidden" />

        {!cameraError && (
          <div className="flex items-center justify-center py-6 bg-black/60 border-t border-white/10">
            <button
              type="button"
              onClick={capturePhoto}
              aria-label="Capture photo"
              className="w-16 h-16 rounded-full bg-white hover:bg-violet-100 border-4 border-violet-400 shadow-xl hover:scale-105 transition-all flex items-center justify-center cursor-pointer"
            >
              <Camera className="h-7 w-7 text-violet-600" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraModal;
