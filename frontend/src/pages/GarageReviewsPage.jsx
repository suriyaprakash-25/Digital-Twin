import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReviewList from '../components/garage/ReviewList';
import RatingDistribution from '../components/garage/RatingDistribution';
import ReviewReplyModal from '../components/garage/ReviewReplyModal';
import ErrorState from '../components/common/ErrorState';
import { apiGet, getErrorMessage } from '../utils/api';

const GarageReviewsPage = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], ratingDistribution: {}, averageRating: 4.8, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOption, setSortOption] = useState('newest');
  const [replyingReview, setReplyingReview] = useState(null);

  const fetchReviews = useCallback(async (garageId, sort) => {
    try {
      const data = await apiGet(`/garages/${garageId}/reviews`, { sort });
      setReviewsData(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load reviews'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGarageProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/garages/me');
      if (data?.exists) {
        setProfile(data);
        await fetchReviews(data.id, 'newest');
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load your garage profile'));
      setLoading(false);
    }
  }, [fetchReviews]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchGarageProfile(); });
    return () => { cancelled = true; };
  }, [fetchGarageProfile]);

  const handleSortChange = (newSort) => {
    setSortOption(newSort);
    if (profile?.id) fetchReviews(profile.id, newSort);
  };

  const handleReplyPosted = useCallback(() => {
    setReplyingReview(null);
    if (profile?.id) fetchReviews(profile.id, sortOption);
  }, [profile, sortOption, fetchReviews]);

  if (loading) {
    return <div role="status" className="p-12 text-center text-slate-500 font-medium">Loading reviews dashboard...</div>;
  }

  if (error && !profile) {
    return <div className="max-w-5xl mx-auto"><ErrorState message={error} onRetry={fetchGarageProfile} /></div>;
  }

  if (!profile) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-amber-50 rounded-3xl border border-amber-200">
        <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
        <h3 className="font-bold text-amber-900 text-lg">Garage Profile Required</h3>
        <p className="text-xs text-amber-700">Please create your garage profile first before managing customer reviews.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/garage-dashboard')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Customer Reviews Manager</h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">View customer feedback and respond to reviews</p>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => fetchReviews(profile.id, sortOption)} />}

      {/* Analytics Summary */}
      <RatingDistribution
        ratingDistribution={reviewsData.ratingDistribution}
        totalReviews={reviewsData.totalReviews}
        averageRating={reviewsData.averageRating}
      />

      {/* Review List & Reply Action */}
      <ReviewList
        reviews={reviewsData.reviews}
        sortOption={sortOption}
        onSortChange={handleSortChange}
        onReplyClick={(rev) => setReplyingReview(rev)}
        isOwner={true}
      />

      {replyingReview && (
        <ReviewReplyModal
          garageId={profile.id}
          review={replyingReview}
          onClose={() => setReplyingReview(null)}
          onPosted={handleReplyPosted}
        />
      )}
    </div>
  );
};

export default GarageReviewsPage;
