import { X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

/** Full-size photo viewer. Closes on backdrop click, the close button or Escape. */
const PhotoLightbox = ({ url, onClose, title = 'Service Bill Photo', alt = 'Service bill - full size' }) => {
    const { dialogProps, titleId } = useDialog({ isOpen: Boolean(url), onClose });
    if (!url) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                {...dialogProps}
                className="relative max-w-3xl max-h-[90vh] w-full focus:outline-none"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close photo"
                    className="absolute -top-4 -right-4 z-10 p-2 bg-white rounded-full shadow-xl border border-slate-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>
                <img
                    src={url}
                    alt={alt}
                    className="w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border-2 border-white/20"
                />
                <p id={titleId} className="text-center text-white/50 text-xs font-medium mt-3">{title}</p>
            </div>
        </div>
    );
};

export default PhotoLightbox;
