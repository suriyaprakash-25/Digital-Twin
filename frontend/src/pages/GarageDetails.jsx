import { API_BASE_URL } from '../utils/config';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Search, SlidersHorizontal, Wrench, ShieldCheck, Star, Images, Info, MessageSquare, AlertCircle } from 'lucide-react';
import GarageHeader from '../components/garage/GarageHeader';
import GarageGallery from '../components/garage/GarageGallery';
import ServiceCard from '../components/garage/ServiceCard';
import BusinessInfo from '../components/garage/BusinessInfo';
import RatingDistribution from '../components/garage/RatingDistribution';
import ReviewList from '../components/garage/ReviewList';
import WriteReview from '../components/garage/WriteReview';

const GarageDetails = () => {
  const { garageId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [garage, setGarage] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], ratingDistribution: {}, averageRating: 4.8, totalReviews: 0, userCanReview: false, completedBookings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Service Filtering & Sorting
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('ALL');
  const [serviceSort, setServiceSort] = useState('price_low');

  // Review Sorting
  const [reviewSort, setReviewSort] = useState('newest');

  // Request Booking Modal State
  const [selectedServiceForRequest, setSelectedServiceForRequest] = useState(null);
  const [userVehicles, setUserVehicles] = useState([]);
  const [bookingVehicleId, setBookingVehicleId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingStatus, setBookingStatus] = useState({ type: '', msg: '' });

  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    fetchGarageDetails();
    fetchReviews();
    if (token) {
      axios.get(`${API_BASE_URL}/api/vehicles/myvehicles`, headers)
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : [];
          setUserVehicles(list);
          if (list.length > 0) setBookingVehicleId(list[0].id);
        })
        .catch(() => {});
    }
  }, [garageId, token, headers]);

  const fetchGarageDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/garages/details/${garageId}`);
      setGarage(res.data);
    } catch (err) {
      console.error('Error fetching garage details:', err);
      setError(err.response?.data?.msg || 'Failed to load garage details');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (sort = reviewSort) => {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await axios.get(`${API_BASE_URL}/api/garages/${garageId}/reviews?sort=${sort}`, config);
      setReviewsData(res.data);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }
  };

  const handleReviewSortChange = (newSort) => {
    setReviewSort(newSort);
    fetchReviews(newSort);
  };

  const handleReviewSubmitted = (newReview, newAvg, newTotal) => {
    fetchReviews(reviewSort);
    if (garage) {
      setGarage(prev => ({
        ...prev,
        rating: newAvg,
        reviewCount: newTotal
      }));
    }
  };

  // Process Services List
  const filteredServices = useMemo(() => {
    if (!garage || !garage.services) return [];
    let list = [...garage.services];

    if (serviceCategoryFilter !== 'ALL') {
      list = list.filter(s => (s.category || '').toLowerCase() === serviceCategoryFilter.toLowerCase());
    }

    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase();
      list = list.filter(s => s.title.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q)));
    }

    if (serviceSort === 'price_low') list.sort((a, b) => a.price - b.price);
    if (serviceSort === 'price_high') list.sort((a, b) => b.price - a.price);
    if (serviceSort === 'duration') list.sort((a, b) => a.durationMins - b.durationMins);
    if (serviceSort === 'alphabetical') list.sort((a, b) => a.title.localeCompare(b.title));

    return list;
  }, [garage, serviceCategoryFilter, serviceSearch, serviceSort]);

  // Handle Request Booking Submission
  const handleRequestBooking = async (e) => {
    e.preventDefault();
    setBookingStatus({ type: '', msg: '' });

    if (!token) {
      setBookingStatus({ type: 'error', msg: 'Please log in as a vehicle owner to request a booking.' });
      return;
    }

    if (!bookingVehicleId) {
      setBookingStatus({ type: 'error', msg: 'Please select a vehicle or add one to your fleet first.' });
      return;
    }

    setBookingSubmitting(true);
    try {
      const targetGarageId = garage.id || garage._id || garageId;
      const targetServiceId = selectedServiceForRequest.id || selectedServiceForRequest._id;

      await axios.post(
        `${API_BASE_URL}/api/bookings`,
        {
          garageId: targetGarageId,
          serviceId: targetServiceId,
          vehicleId: bookingVehicleId,
          scheduledFor: bookingDate || undefined,
          notes: bookingNotes
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setBookingStatus({ type: 'success', msg: 'Booking request sent successfully!' });
      setTimeout(() => {
        setSelectedServiceForRequest(null);
        setBookingStatus({ type: '', msg: '' });
        navigate('/user-dashboard');
      }, 1200);
    } catch (err) {
      console.error('Booking request error:', err);
      setBookingStatus({
        type: 'error',
        msg: err.response?.data?.msg || err.response?.data?.message || 'Failed to submit booking request. Please try again.'
      });
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-xl w-36" />
        <div className="h-64 bg-slate-200 rounded-3xl" />
        <div className="h-48 bg-slate-200 rounded-3xl" />
      </div>
    );
  }

  if (error || !garage) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">{error || 'Garage Not Found'}</h2>
        <button
          onClick={() => navigate('/marketplace')}
          className="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold shadow-sm"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-8 animate-in fade-in duration-300">
      {/* Back Button */}
      <button
        onClick={() => navigate('/marketplace')}
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Garages Marketplace
      </button>

      {/* Section 1: Garage Header */}
      <GarageHeader
        garage={garage}
        onBookClick={() => {
          const el = document.getElementById('services-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onLocationClick={() => {
          if (garage.garageLocation?.latitude && garage.garageLocation?.longitude) {
            window.open(`https://www.google.com/maps?q=${garage.garageLocation.latitude},${garage.garageLocation.longitude}`, '_blank');
          }
        }}
      />

      {/* Section 2: Image Gallery */}
      {garage.galleryPhotos && garage.galleryPhotos.length > 0 && (
        <GarageGallery images={garage.galleryPhotos} />
      )}

      {/* Section 3: Services Catalog */}
      <div id="services-section" className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-teal-600" /> Available Services ({filteredServices.length})
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Sort */}
            <select
              value={serviceSort}
              onChange={(e) => setServiceSort(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="duration">Duration</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Services Grid */}
        {filteredServices.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs sm:text-sm font-semibold">
            No services matched your search filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onRequestClick={(svc) => setSelectedServiceForRequest(svc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Business Information */}
      <BusinessInfo garage={garage} />

      {/* Section 5: Customer Reviews & Breakdown */}
      <div className="space-y-6">
        <RatingDistribution
          ratingDistribution={reviewsData.ratingDistribution}
          totalReviews={reviewsData.totalReviews}
          averageRating={reviewsData.averageRating}
        />

        <ReviewList
          reviews={reviewsData.reviews}
          sortOption={reviewSort}
          onSortChange={handleReviewSortChange}
        />

        {/* Section 6: Write Review Form (Only if eligible or logged in) */}
        {token && reviewsData.userCanReview ? (
          <WriteReview
            garageId={garage.id}
            token={token}
            completedBookings={reviewsData.completedBookings}
            onReviewSubmitted={handleReviewSubmitted}
          />
        ) : token ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl text-center text-xs sm:text-sm font-semibold text-slate-600">
            ℹ️ You can write a customer review after completing a service booking at {garage.name}.
          </div>
        ) : (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl text-center text-xs sm:text-sm font-semibold text-amber-800">
            Please log in to write a review for this garage.
          </div>
        )}
      </div>

      {/* Request Booking Modal */}
      {selectedServiceForRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Request Service: {selectedServiceForRequest.title}
            </h3>

            {bookingStatus.msg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                bookingStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
              }`}>
                {bookingStatus.msg}
              </div>
            )}

            <form onSubmit={handleRequestBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Select Your Vehicle *</label>
                <select
                  value={bookingVehicleId}
                  onChange={(e) => setBookingVehicleId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
                  required
                >
                  {userVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.brand} {v.model})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Preferred Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Notes / Instructions</label>
                <textarea
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="Any specific issues or preferences..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedServiceForRequest(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold shadow-sm"
                >
                  {bookingSubmitting ? 'Sending Request...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GarageDetails;
