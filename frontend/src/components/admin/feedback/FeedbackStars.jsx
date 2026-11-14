import { Star } from 'lucide-react';

const FeedbackStars = ({ rating }) => (
  <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${
          star <= rating
            ? 'fill-amber-400 text-amber-400'
            : 'text-slate-500 stroke-1'
        }`}
      />
    ))}
  </div>
);

export default FeedbackStars;
