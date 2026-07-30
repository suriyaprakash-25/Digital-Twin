import React from 'react';
import { Star } from 'lucide-react';

const RatingDistribution = ({ ratingDistribution = {}, totalReviews = 0, averageRating = 4.8 }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-8">
      {/* Left Overall Rating Block */}
      <div className="text-center md:text-left shrink-0">
        <div className="text-5xl font-black text-slate-900 tracking-tight">{averageRating}</div>
        <div className="flex items-center justify-center md:justify-start gap-1 my-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-5 h-5 ${
                i < Math.floor(averageRating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-slate-100 text-slate-300'
              }`}
            />
          ))}
        </div>
        <div className="text-xs font-bold text-slate-500">
          Based on {totalReviews} customer review{totalReviews !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Right Progress Bars Breakdown */}
      <div className="flex-1 w-full space-y-2">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = ratingDistribution[star] || 0;
          const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;

          return (
            <div key={star} className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 w-12 font-bold text-slate-700 shrink-0">
                <span>{star}</span>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              </div>
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${percentage}%` }}
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                />
              </div>
              <div className="w-12 text-right font-semibold text-slate-500 shrink-0">
                {count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RatingDistribution;
