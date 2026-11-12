import { useMemo, useRef, useState } from 'react';
import SEO from '../components/SEO';
import { useToast } from '../context/toastContextCore';
import { useAuth } from '../context/authContextCore';
import { apiPost, getErrorMessage } from '../utils/api';
import ErrorState from '../components/common/ErrorState';
import MarketplaceFilters from '../components/marketplace/MarketplaceFilters';
import BookingOptions from '../components/marketplace/BookingOptions';
import GarageCard from '../components/marketplace/GarageCard';
import CustomIssueModal from '../components/marketplace/CustomIssueModal';
import IssuePhotosModal from '../components/marketplace/IssuePhotosModal';
import { filterGarages, useMarketplaceData } from '../components/marketplace/useMarketplaceData';

const Marketplace = () => {
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const {
    garages, vehicles, selectedVehicleId, setSelectedVehicleId, error, loading, refreshing, refetch,
  } = useMarketplaceData();

  const [scheduledFor, setScheduledFor] = useState('');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, AVAILABLE, BUSY, CLOSED
  const [issueGarageId, setIssueGarageId] = useState(null);
  const [successBookingId, setSuccessBookingId] = useState(null);
  const [pendingServiceKey, setPendingServiceKey] = useState(null);
  const bookingInFlight = useRef(false);

  const requestBooking = async ({ garageId, serviceId, serviceTitle }) => {
    if (bookingInFlight.current) return; // double-click guard
    if (!selectedVehicleId) {
      showToast('Please add/select a vehicle first.', 'warning');
      return;
    }

    bookingInFlight.current = true;
    setPendingServiceKey(`${garageId}:${serviceId}`);
    try {
      await apiPost('/bookings', {
        garageId,
        serviceId,
        vehicleId: selectedVehicleId,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        notes
      });
      showToast(`Booking requested for ${serviceTitle || 'service'}! The garage will respond soon.`, 'success');
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to request booking'), 'error');
    } finally {
      bookingInFlight.current = false;
      setPendingServiceKey(null);
    }
  };

  const precheckIssue = () => {
    if (!isAuthenticated) return 'Please log in as a vehicle owner to report an issue.';
    if (!selectedVehicleId) return 'Please select a vehicle from the top menu first.';
    return '';
  };

  const submitCustomIssue = async (issueDetails) => {
    try {
      const data = await apiPost('/bookings', {
        garageId: issueGarageId,
        vehicleId: selectedVehicleId,
        isCustomIssue: true,
        issueDetails
      });
      setIssueGarageId(null);
      setSuccessBookingId(data.id);
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Failed to submit issue. Please try again.'));
    }
  };

  const filteredGarages = useMemo(
    () => filterGarages(garages, { statusFilter, searchQuery }),
    [garages, searchQuery, statusFilter]
  );

  return (
    <>
      <SEO
        title="Find Top-Rated Auto Repair Garages"
        description="Search, compare, and book trusted auto repair garages near you. Read reviews and get instant service quotes on Driveportz Marketplace."
      />
      <div className="space-y-6 sm:space-y-8 pb-12 lg:pb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Garages</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">Choose a garage service and request a booking</p>
        </div>

        <MarketplaceFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />

        {error && (
          <ErrorState title="Failed to load marketplace" message={error} onRetry={() => refetch()} retrying={loading || refreshing} />
        )}

        <BookingOptions
          vehicles={vehicles}
          selectedVehicleId={selectedVehicleId}
          onVehicleChange={setSelectedVehicleId}
          scheduledFor={scheduledFor}
          onScheduledForChange={setScheduledFor}
          notes={notes}
          onNotesChange={setNotes}
        />

        <div className="space-y-4" aria-busy={loading}>
          {loading ? <div role="status" className="text-slate-500 text-sm">Loading...</div> : null}

          {!loading && !error && filteredGarages.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              {searchQuery ? `No garages found for "${searchQuery}"` : 'No garages listed yet.'}
            </div>
          ) : null}

          {filteredGarages.map((g) => (
            <GarageCard
              key={g.id}
              garage={g}
              canBook={vehicles.length > 0}
              pendingServiceKey={pendingServiceKey}
              onRequestService={requestBooking}
              onReportIssue={setIssueGarageId}
            />
          ))}
        </div>

        {issueGarageId && (
          <CustomIssueModal
            onClose={() => setIssueGarageId(null)}
            onSubmit={submitCustomIssue}
            precheck={precheckIssue}
          />
        )}

        {successBookingId && (
          <IssuePhotosModal
            bookingId={successBookingId}
            onDone={() => {
              setSuccessBookingId(null);
              showToast('Booking requested successfully!', 'success');
            }}
          />
        )}
      </div>
    </>
  );
};

export default Marketplace;
