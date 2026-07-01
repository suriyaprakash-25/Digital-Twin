import React, { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';

const ImageUploader = ({ onImageSelect, selectedImage, onClear }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(reader.result); // Pass Base64 string
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      
      {selectedImage ? (
        <div className="relative group">
          <img src={selectedImage} alt="Upload preview" className="w-8 h-8 rounded object-cover border border-slate-200 shadow-sm" />
          <button 
            onClick={onClear}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current.click()}
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"
          title="Attach Image"
        >
          <Paperclip className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default ImageUploader;
