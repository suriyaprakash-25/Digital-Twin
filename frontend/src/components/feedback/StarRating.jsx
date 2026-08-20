import React, { useState } from 'react';
import { Star } from 'lucide-react';

const RATING_LABELS = {
  1: 'Very Dissatisfied',
  2: 'Dissatisfied',
  3: 'Neutral / Okay',
  4: 'Satisfied',
  5: 'Delighted & Excellent!'
};

const StarRating = ({ value, onChange, disabled = false, error = false }) => {
  const [hovered, setHovered] = useState(0);

  const currentVal = hovered || value || 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating out of 5 stars">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= currentVal;
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onClick={() => onChange(star)}
              onMouseEnter={() => !disabled && setHovered(star)}
              onMouseLeave={() => !disabled && setHovered(0)}
              onFocus={() => !disabled && setHovered(star)}
              onBlur={() => !disabled && setHovered(0)}
              className={`p-1.5 rounded-xl transition-all duration-150 transform focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-115 active:scale-95'
              }`}
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} star${star > 1 ? 's' : ''} - ${RATING_LABELS[star]}`}
            >
              <Star
                className={`h-7 w-7 transition-colors duration-150 ${
                  isFilled
                    ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                    : error
                    ? 'text-red-300 stroke-[1.5]'
                    : 'text-slate-300 stroke-[1.5] hover:text-amber-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="min-h-[20px]">
        {currentVal > 0 ? (
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md inline-block animate-fade-in">
            {RATING_LABELS[currentVal]}
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            {error ? <span className="text-red-500 font-medium">Please select a star rating (1 to 5)</span> : 'Tap a star to rate'}
          </span>
        )}
      </div>
    </div>
  );
};

export default StarRating;
