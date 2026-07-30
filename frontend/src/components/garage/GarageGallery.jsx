import React, { useState } from 'react';
import { Images, Maximize2 } from 'lucide-react';
import ImageLightbox from './ImageLightbox';

const GarageGallery = ({ images = [] }) => {
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Images className="w-5 h-5 text-teal-600" /> Image Gallery
        </h2>
        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          {images.length} Photo{images.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid of Images */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((url, idx) => (
          <div
            key={idx}
            onClick={() => setLightboxIndex(idx)}
            className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <img
              src={url}
              alt={`Garage photo ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white">
                <Maximize2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex >= 0 && (
        <ImageLightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(-1)}
          onIndexChange={(idx) => setLightboxIndex(idx)}
        />
      )}
    </div>
  );
};

export default GarageGallery;
