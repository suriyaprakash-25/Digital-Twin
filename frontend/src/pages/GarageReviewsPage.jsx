import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { MessageSquare, Star, Send, Search, Filter, ShieldCheck, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReviewList from '../components/garage/ReviewList';
import RatingDistribution from '../components/garage/RatingDistribution';

const GarageReviewsPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [profile, setProfile] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], ratingDistribution: {}, averageRating: 4.8, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState('newest');

  // Owner Reply Modal
  const [replyingReview, setReplyingReview] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyStatus, setReplyStatus] = useState({ type: '', msg: '' });

  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    fetchGarageProfile();
  }, [token]);

  const fetchGarageProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me`, headers);
      if (res.data?.exists) {
        setProfile(res.data);
        fetchReviews(res.data.id, sortOption);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setLoading(false);
    }
  };

  const fetchReviews = async (garageId, sort) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/${garageId}/reviews?sort=${sort}`, headers);
      setReviewsData(res.data);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (newSort) => {
    setSortOption(newSort);
    if (profile?.id) fetchReviews(profile.id, newSort);
  };

  const handlePostReply = async (e) => {
    e.preventDefault();
    if (!replyText || replyText.trim().length < 5) {
      setReplyStatus({ type: 'error', msg: 'Reply message must be at least 5 characters long.' });
      return;
    }

    setReplySubmitting(true);
    setReplyStatus({ type: '', msg: '' });

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/${profile.id}/reviews/${replyingReview.id}/reply`,
        { replyMessage: replyText.trim() },
        headers
      );

      setReplyStatus({ type: 'success', msg: 'Reply posted successfully!' });
      setTimeout(() => {
        setReplyingReview(null);
        setReplyText('');
        setReplyStatus({ type: '', msg: '' });
        fetchReviews(profile.id, sortOption);
      }, 1200);
    } catch (err) {
      setReplyStatus({ type: 'error', msg: err.response?.data?.msg || 'Failed to post reply.' });
    } finally {
      setReplySubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Loading reviews dashboard...</div>;
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
            onClick={() => navigate('/garage-dashboard')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Customer Reviews Manager</h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">View customer feedback and respond to reviews</p>
        </div>
      </div>

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
        onReplyClick={(rev) => {
          setReplyingReview(rev);
          setReplyText('');
          setReplyStatus({ type: '', msg: '' });
        }}
        isOwner={true}
      />

      {/* Reply Modal */}
      {replyingReview && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Reply to {replyingReview.userName}'s Review
            </h3>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1">
              <div className="font-bold text-slate-800">"{replyingReview.reviewTitle || 'Customer Review'}"</div>
              <p className="text-slate-600 italic">"{replyingReview.reviewMessage}"</p>
            </div>

            {replyStatus.msg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                replyStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
              }`}>
                {replyStatus.msg}
              </div>
            )}

            <form onSubmit={handlePostReply} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Your Response *</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Thank the customer or address their concerns professionally..."
                  rows={4}
                  className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setReplyingReview(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replySubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5"
                >
                  {replySubmitting ? 'Posting...' : <><Send className="w-3.5 h-3.5" /> Post Reply</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GarageReviewsPage;
