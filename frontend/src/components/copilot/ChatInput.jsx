import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import ImageUploader from './AIDoctor/ImageUploader';

const ChatInput = ({ onSendMessage, isLoading }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };
  const [inputText, setInputText] = useState('');
  const [imageBase64, setImageBase64] = useState(null);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (inputText.trim() || imageBase64) {
      onSendMessage(inputText.trim(), imageBase64);
      setInputText('');
      setImageBase64(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 bg-white/80 backdrop-blur border-t border-slate-100 rounded-b-2xl">
      <form 
        onSubmit={handleSubmit}
        className="relative flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all p-1"
      >
        <ImageUploader 
          selectedImage={imageBase64} 
          onImageSelect={setImageBase64} 
          onClear={() => setImageBase64(null)} 
        />
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={imageBase64 ? "Add a description..." : "Ask anything about DrivePortz..."}
          disabled={isLoading}
          className="w-full max-h-[120px] bg-transparent text-sm text-slate-800 placeholder-slate-400 border-0 focus:ring-0 resize-none py-3 px-2 outline-none disabled:opacity-50"
          rows={1}
        />
        
        <div className="p-1 shrink-0">
          <button
            type="submit"
            disabled={(!inputText.trim() && !imageBase64) || isLoading}
            className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
              (inputText.trim() || imageBase64) && !isLoading
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:scale-105'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4 translate-x-px translate-y-px" />
            )}
          </button>
        </div>
      </form>
      <div className="text-center mt-2">
        <span className="text-[10px] text-slate-400 font-medium">Shift + Enter for new line</span>
      </div>
    </div>
  );
};

export default ChatInput;
