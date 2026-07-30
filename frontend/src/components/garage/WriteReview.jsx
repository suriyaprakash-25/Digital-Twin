import React, { useState } from 'react';
import axios from 'axios';
import { PenTool, CheckCircle, AlertCircle, Send, Star, ShieldCheck } from 'lucide-react';
import StarRating from './StarRating';

const WriteReview = ({ garageId, token, completedBookings = [], onReviewSubmitted = () => {} }) => {
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState(completedBookings[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  const remainingChars = 1000 - reviewMessage.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', msg: '' });

    if (!rating || rating < 1 || rating > 5) {
      setStatus({ type: 'error', msg: 'Please select a star rating from 1 to 5.' });
      return;
    }

    if (reviewMessage.trim().length < 20) {
      setStatus({ type: 'error', msg: 'Review message must be at least 20 characters long.' });
      return;
    }

    if (reviewMessage.length > 1000) {
      setStatus({ type: 'error', msg: 'Review message cannot exceed 1000 characters.' });
      return;
    }

    setSubmitting(true);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/${garageId}/reviews`,
        {
          rating,
          reviewTitle,
          reviewMessage: reviewMessage.trim(),
          bookingId: selectedBookingId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStatus({ type: 'success', msg: 'Review submitted successfully! Thank you for your feedback.' });
      setReviewTitle('');
      setReviewMessage('');
      
      if (res.data?.review) {
        onReviewSubmitted(res.data.review, res.data.averageRating, res.data.totalReviews);
      }
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.msg || 'Failed to submit review.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-teal-600" /> Write a Customer Review
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Share your experience with other vehicle owners</p>
        </div>
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Verified Customer
        </span>
      </div>

      {status.msg && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {status.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          {status.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Completed Service Selector if multiple */}
        {completedBookings.length > 1 && (
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Select Completed Service Booking
            </label>
            <select
              value={selectedBookingId}
              onChange={(e) => setSelectedBookingId(e.target.value)}
              className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              {completedBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.serviceName} • {b.vehicleModel} ({b.date})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 5-Star Component */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
            Rate Your Experience *
          </label>
          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 w-fit">
            <StarRating rating={rating} size={28} interactive={true} onChange={(val) => setRating(val)} />
            <span className="text-sm font-extrabold text-slate-800 ml-2">
              {rating === 5 ? '⭐⭐⭐⭐⭐ Excellent' : rating === 4 ? '⭐⭐⭐⭐ Very Good' : rating === 3 ? '⭐⭐⭐ Average' : rating === 2 ? '⭐⭐ Poor' : '⭐ Terrible'}
            </span>
          </div>
        </div>

        {/* Review Title */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
            Review Title <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={reviewTitle}
            onChange={(e) => setReviewTitle(e.target.value)}
            placeholder="Summarize your experience (e.g. Quick service and transparent pricing!)"
            maxLength={150}
            className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-xs"
          />
        </div>

        {/* Review Message Textarea */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Review Message * <span className="text-slate-400 font-normal">(Min 20 characters)</span>
            </label>
            <span className={`text-xs font-bold ${remainingChars < 50 ? 'text-amber-600' : 'text-slate-400'}`}>
              {remainingChars} characters remaining
            </span>
          </div>
          <textarea
            value={reviewMessage}
            onChange={(e) => setReviewMessage(e.target.value)}
            placeholder="Tell us details about the service quality, technician professionalism, waiting area, and turnaround time..."
            rows={4}
            maxLength={1000}
            className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-xs"
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 flex items-center gap-2 disabled:opacity-50"
        >
          {submitting ? 'Submitting Review...' : <><Send className="w-4 h-4" /> Submit Review</>}
        </button>
      </form>
    </div>
  );
};

export default WriteReview;
