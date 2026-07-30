import React from 'react';
import { MessageSquare, ArrowUpDown, Filter } from 'lucide-react';
import ReviewCard from './ReviewCard';

const ReviewList = ({ reviews = [], sortOption = 'newest', onSortChange = () => {}, onReplyClick, isOwner = false }) => {
  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-teal-600" /> Customer Reviews ({reviews.length})
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
          </span>
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          >
            <option value="newest">Newest First</option>
            <option value="rating_high">Highest Rating</option>
            <option value="rating_low">Lowest Rating</option>
          </select>
        </div>
      </div>

      {/* Review Cards List */}
      {reviews.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 space-y-3">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-800 text-base">No Customer Reviews Yet</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Be the first customer to write a review after completing a service at this garage!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onReplyClick={onReplyClick} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewList;
