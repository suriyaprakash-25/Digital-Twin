import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

const ImageLightbox = ({ images = [], currentIndex = 0, onClose = () => {}, onIndexChange = () => {} }) => {
  const [zoom, setZoom] = useState(1);

  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  const handlePrev = (e) => {
    e.stopPropagation();
    setZoom(1);
    const newIdx = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    onIndexChange(newIdx);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setZoom(1);
    const newIdx = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    onIndexChange(newIdx);
  };

  const toggleZoom = (e) => {
    e.stopPropagation();
    setZoom(prev => (prev === 1 ? 1.6 : 1));
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image Counter */}
      <div className="absolute top-5 left-6 text-xs font-bold text-white/80 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 z-50">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Prev button */}
      {images.length > 1 && (
        <button
          onClick={handlePrev}
          className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 z-50"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center"
      >
        <img
          src={currentImage}
          alt={`Gallery ${currentIndex + 1}`}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.25s ease-out' }}
          className="max-w-full max-h-[75vh] object-contain cursor-zoom-in"
          onClick={toggleZoom}
        />

        {/* Zoom Control Pill */}
        <button
          onClick={toggleZoom}
          className="absolute bottom-4 right-4 p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-white border border-white/10 flex items-center gap-1.5 text-xs font-bold"
        >
          {zoom === 1 ? <><ZoomIn className="w-4 h-4" /> Zoom In</> : <><ZoomOut className="w-4 h-4" /> Zoom Out</>}
        </button>
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 z-50"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default ImageLightbox;
