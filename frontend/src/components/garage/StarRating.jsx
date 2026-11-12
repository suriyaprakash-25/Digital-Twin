import { useState } from 'react';
import { Star } from 'lucide-react';

const StarRating = ({ rating = 5, maxStars = 5, size = 18, interactive = false, onChange = () => {} }) => {
  const [hoverRating, setHoverRating] = useState(0);

  const displayRating = interactive && hoverRating > 0 ? hoverRating : rating;

  const renderStar = (starValue) => {
    const isFilled = starValue <= Math.floor(displayRating);
    const isHalf = !isFilled && starValue === Math.ceil(displayRating) && displayRating % 1 !== 0;
    return (
      <Star
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`transition-colors ${
          isFilled
            ? 'fill-amber-400 text-amber-400'
            : isHalf
            ? 'fill-amber-400/50 text-amber-400'
            : 'fill-slate-100 text-slate-300'
        }`}
      />
    );
  };

  if (!interactive) {
    const value = Number(rating) || 0;
    return (
      <div className="flex items-center gap-1" role="img" aria-label={`Rated ${value} out of ${maxStars}`}>
        {Array.from({ length: maxStars }).map((_, index) => (
          <span key={index} className="cursor-default">{renderStar(index + 1)}</span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }).map((_, index) => {
        const starValue = index + 1;
        return (
          <button
            key={index}
            type="button"
            aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
            aria-pressed={starValue === rating}
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHoverRating(starValue)}
            onMouseLeave={() => setHoverRating(0)}
            className="cursor-pointer transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
          >
            {renderStar(starValue)}
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
