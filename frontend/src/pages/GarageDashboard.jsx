import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/authContextCore';
import { ROLES } from '../utils/roles';
import ErrorState from '../components/common/ErrorState';
import { useGarageDashboard, isActiveBooking } from '../components/garage/dashboard/useGarageDashboard';
import DashboardHero from '../components/garage/dashboard/DashboardHero';
import RevenueOverview from '../components/garage/dashboard/RevenueOverview';
import CapacityCard from '../components/garage/dashboard/CapacityCard';
import InProgressVehicles from '../components/garage/dashboard/InProgressVehicles';
import BookingRequests from '../components/garage/dashboard/BookingRequests';
import NotificationsFeed from '../components/garage/dashboard/NotificationsFeed';
import RequestInfoModal from '../components/garage/dashboard/RequestInfoModal';

const GarageDashboard = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const {
    profile, services, bookings, notifications, revenueSummary,
    loading, error, retry,
    pendingBookingId, updateBookingStatus,
    sendingInfoRequest, requestInfo,
    updatingCapacity, updateCapacity,
  } = useGarageDashboard();
  const [requestInfoBookingId, setRequestInfoBookingId] = useState(null);

  const goToCompletion = (b) => {
    navigate(`/garage/add-service?bookingId=${b.id}&serviceId=${b.serviceId || b.id}&completionMode=true`);
  };

  const handleReject = (b) => {
    const label = [b.service?.title, b.vehicle?.vehicleNumber].filter(Boolean).join(' – ');
    if (!window.confirm(`Reject this booking${label ? ` (${label})` : ''}? The customer will be notified.`)) return;
    updateBookingStatus(b.id, 'REJECTED');
  };

  const submitRequestInfo = async (message) => {
    const sent = await requestInfo(requestInfoBookingId, message);
    if (sent) setRequestInfoBookingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32" role="status" aria-label="Loading dashboard">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600" />
      </div>
    );
  }

  if (role !== ROLES.GARAGE) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <div className="text-lg font-extrabold text-slate-900">Access Restricted</div>
        <div className="text-slate-500 mt-1 text-sm">This page is for Garage partner accounts only.</div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load your dashboard" message={error} onRetry={retry} />;
  }

  if (!profile) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center mx-auto">
          <Store className="h-8 w-8 text-teal-500" />
        </div>
        <div className="text-xl font-extrabold text-slate-900">Set Up Your Garage Profile</div>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          You haven&apos;t created your garage profile yet. Set it up to start accepting bookings and managing your services.
        </p>
        <Link
          to="/garage-profile"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Store className="h-4 w-4" /> Create Garage Profile
        </Link>
      </div>
    );
  }

  const activeBookings = bookings.filter(isActiveBooking);
  const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;

  return (
    <div className="space-y-8 pb-12 lg:pb-8">
      <DashboardHero
        profile={profile}
        servicesCount={services.length}
        inProgressCount={activeBookings.length}
        completedCount={completedCount}
      />

      <RevenueOverview revenueSummary={revenueSummary} />

      {/* Capacity & Vehicles In Progress Control Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CapacityCard
          key={profile.maxCapacity ?? 'default'}
          maxCapacity={profile.maxCapacity}
          activeCount={activeBookings.length}
          updating={updatingCapacity}
          onUpdate={updateCapacity}
        />
        <InProgressVehicles
          bookings={activeBookings}
          pendingBookingId={pendingBookingId}
          onStart={(id) => updateBookingStatus(id, 'IN_PROGRESS')}
          onComplete={goToCompletion}
        />
      </div>

      <BookingRequests
        bookings={bookings}
        garageName={profile.name}
        pendingBookingId={pendingBookingId}
        onUpdateStatus={updateBookingStatus}
        onReject={handleReject}
        onRequestInfo={setRequestInfoBookingId}
        onComplete={goToCompletion}
      />

      <NotificationsFeed notifications={notifications} />

      {requestInfoBookingId && (
        <RequestInfoModal
          sending={sendingInfoRequest}
          onClose={() => setRequestInfoBookingId(null)}
          onSubmit={submitRequestInfo}
        />
      )}
    </div>
  );
};

export default GarageDashboard;
