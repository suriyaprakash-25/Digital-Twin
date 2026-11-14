import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Wrench, AlertCircle } from 'lucide-react';
import GarageHeader from '../components/garage/GarageHeader';
import GarageGallery from '../components/garage/GarageGallery';
import ServiceCard from '../components/garage/ServiceCard';
import BusinessInfo from '../components/garage/BusinessInfo';
import RatingDistribution from '../components/garage/RatingDistribution';
import ReviewList from '../components/garage/ReviewList';
import WriteReview from '../components/garage/WriteReview';
import BookingRequestModal from '../components/garage/BookingRequestModal';
import CustomIssueModal from '../components/garage/CustomIssueModal';
import BookingSuccessModal from '../components/garage/BookingSuccessModal';
import ErrorState from '../components/common/ErrorState';
import { apiGet, getErrorMessage } from '../utils/api';
import { useAuth } from '../context/authContextCore';

const GarageDetails = () => {
  const { garageId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [garage, setGarage] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], ratingDistribution: {}, averageRating: 4.8, totalReviews: 0, userCanReview: false, completedBookings: [] });
  const [reviewsError, setReviewsError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Service Filtering & Sorting
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter] = useState('ALL');
  const [serviceSort, setServiceSort] = useState('price_low');

  // Review Sorting
  const [reviewSort, setReviewSort] = useState('newest');

  // Booking flows
  const [userVehicles, setUserVehicles] = useState([]);
  const [selectedServiceForRequest, setSelectedServiceForRequest] = useState(null);
  const [isCustomIssueModalOpen, setIsCustomIssueModalOpen] = useState(false);
  const [successBooking, setSuccessBooking] = useState(null); // { id, type }

  const fetchGarageDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet(`/garages/details/${garageId}`);
      setGarage(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load garage details'));
    } finally {
      setLoading(false);
    }
  }, [garageId]);

  const fetchReviews = useCallback(async (sort = reviewSort) => {
    try {
      const data = await apiGet(`/garages/${garageId}/reviews`, { sort });
      setReviewsData(data);
      setReviewsError(null);
    } catch (err) {
      setReviewsError(getErrorMessage(err, 'Failed to load reviews'));
    }
  }, [garageId, reviewSort]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchGarageDetails(); });
    if (isAuthenticated) {
      apiGet('/vehicles/myvehicles')
        .then(data => { if (!cancelled) setUserVehicles(Array.isArray(data) ? data : []); })
        .catch(() => { /* vehicle list is optional: the booking form validates selection */ });
    }
    return () => { cancelled = true; };
  }, [fetchGarageDetails, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchReviews(); });
    return () => { cancelled = true; };
  }, [fetchReviews]);

  const handleReviewSortChange = (newSort) => {
    setReviewSort(newSort);
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

  const closeModals = useCallback(() => {
    setSelectedServiceForRequest(null);
    setIsCustomIssueModalOpen(false);
    setSuccessBooking(null);
  }, []);

  const targetGarageId = garage ? (garage.id || garage._id || garageId) : garageId;

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
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" aria-hidden="true" />
        <h2 role="alert" className="text-xl font-bold text-slate-900">{error || 'Garage Not Found'}</h2>
        <div className="flex items-center justify-center gap-3">
          {error && (
            <button
              type="button"
              onClick={fetchGarageDetails}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold shadow-sm"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/marketplace')}
            className="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold shadow-sm"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-8 animate-in fade-in duration-300">
      {/* Back Button */}
      <button
        type="button"
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

      {/* Section 2.5: Custom Issue Banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-bold text-indigo-900 mb-2">Not sure which service you need?</h2>
          <p className="text-sm font-medium text-indigo-700 max-w-2xl">
            Tell the garage what is wrong with your vehicle. You can describe the issue and optionally attach photos. The garage will review your request before accepting it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCustomIssueModalOpen(true)}
          className="shrink-0 whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-sm font-bold py-3 px-6 rounded-xl shadow-sm"
        >
          Report a Vehicle Issue
        </button>
      </div>

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
                type="search"
                aria-label="Search services"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Sort */}
            <select
              aria-label="Sort services"
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
        {reviewsError && <ErrorState title="Could not load reviews" message={reviewsError} onRetry={() => fetchReviews(reviewSort)} />}

        {isAuthenticated && reviewsData.userCanReview ? (
          <WriteReview
            garageId={garage.id}
            completedBookings={reviewsData.completedBookings}
            onReviewSubmitted={handleReviewSubmitted}
          />
        ) : isAuthenticated ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl text-center text-xs sm:text-sm font-semibold text-slate-600">
            ℹ️ You can write a customer review after completing a service booking at {garage.name}.
          </div>
        ) : (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl text-center text-xs sm:text-sm font-semibold text-amber-800">
            Please log in to write a review for this garage.
          </div>
        )}
      </div>

      {/* Booking flows */}
      {selectedServiceForRequest && !successBooking && (
        <BookingRequestModal
          garageId={targetGarageId}
          service={selectedServiceForRequest}
          vehicles={userVehicles}
          isAuthenticated={isAuthenticated}
          onClose={closeModals}
          onBooked={(id) => setSuccessBooking({ id, type: 'SERVICE' })}
        />
      )}

      {isCustomIssueModalOpen && !successBooking && (
        <CustomIssueModal
          garageId={targetGarageId}
          vehicles={userVehicles}
          isAuthenticated={isAuthenticated}
          onClose={closeModals}
          onBooked={(id) => {
            setIsCustomIssueModalOpen(false);
            setSuccessBooking({ id, type: 'CUSTOM_ISSUE' });
          }}
        />
      )}

      {successBooking && (
        <BookingSuccessModal
          bookingId={successBooking.id}
          bookingType={successBooking.type}
          onClose={closeModals}
          onDone={() => {
            closeModals();
            navigate('/user-dashboard');
          }}
        />
      )}
    </div>
  );
};

export default GarageDetails;
