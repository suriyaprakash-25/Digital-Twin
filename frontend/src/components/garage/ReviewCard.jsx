import React from 'react';
import { User, MessageSquare, CornerDownRight, Car, Wrench } from 'lucide-react';
import StarRating from './StarRating';

const ReviewCard = ({ review, onReplyClick, isOwner = false }) => {
  if (!review) return null;

  const {
    userName = 'Verified Customer',
    userPhotoUrl,
    rating = 5,
    reviewTitle,
    reviewMessage,
    vehicleModel,
    serviceName,
    reply,
    createdAt
  } = review;

  const formattedDate = createdAt ? new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'Recent';

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
      {/* Customer Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 overflow-hidden">
            {userPhotoUrl ? (
              <img src={userPhotoUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-teal-600" />
            )}
          </div>

          <div>
            <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">{userName}</h4>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
              {vehicleModel && (
                <span className="flex items-center gap-1">
                  <Car className="w-3 h-3 text-slate-400" /> {vehicleModel}
                </span>
              )}
              {serviceName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-teal-700 font-semibold">
                    <Wrench className="w-3 h-3 text-teal-600" /> {serviceName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <StarRating rating={rating} size={15} />
          <div className="text-[11px] text-slate-400 font-semibold mt-1">{formattedDate}</div>
        </div>
      </div>

      {/* Review Content */}
      <div className="space-y-1.5 pt-1">
        {reviewTitle && (
          <h5 className="font-bold text-slate-900 text-sm sm:text-base">{reviewTitle}</h5>
        )}
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{reviewMessage}</p>
      </div>

      {/* Owner Reply Block */}
      {reply && reply.replyMessage ? (
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-teal-800">
            <span className="flex items-center gap-1.5">
              <CornerDownRight className="w-4 h-4 text-teal-600" /> Owner Response
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString() : ''}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pl-5">{reply.replyMessage}</p>
        </div>
      ) : (
        isOwner && (
          <div className="pt-2">
            <button
              onClick={() => onReplyClick(review)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Reply to Customer
            </button>
          </div>
        )
      )}
    </div>
  );
};

export default ReviewCard;
