import React, { useState } from 'react';
import { Bot, Copy, Check } from 'lucide-react';

const formatMessage = (text) => {
  if (!text) return { __html: '' };
  // Replace **bold** with <strong>bold</strong>
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Replace newlines with <br />
  html = html.replace(/\n/g, '<br />');
  return { __html: html };
};

const ChatBubble = ({ message, isUser, timestamp }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar for Assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200 mt-1">
          <Bot className="w-5 h-5 text-blue-600" />
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
        <div 
          className={`relative group px-4 py-3 rounded-2xl ${
            isUser 
              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-sm shadow-sm shadow-blue-500/20' 
              : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm shadow-slate-200/50'
          }`}
        >
          <div className={`text-sm ${isUser ? 'font-medium' : ''}`}>
            {isUser ? (
              <p>{message}</p>
            ) : (
              <div 
                className="leading-relaxed text-slate-700 space-y-2"
                dangerouslySetInnerHTML={formatMessage(message)}
              />
            )}
          </div>

          {/* Copy Button (only for assistant) */}
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute -right-10 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy message"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>
        
        {/* Timestamp */}
        <span className="text-[10px] text-slate-400 mt-1 px-1">
          {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>
    </div>
  );
};

export default ChatBubble;
