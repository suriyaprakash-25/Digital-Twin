import { useId, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiPost, getErrorMessage } from '../../utils/api';
import { useDialog } from '../../hooks/useDialog';

export const StatusMessage = ({ status, className = '' }) => (
  status.msg ? (
    <div
      role={status.type === 'success' ? 'status' : 'alert'}
      className={`p-3 rounded-xl text-xs font-semibold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'} ${className}`}
    >
      {status.msg}
    </div>
  ) : null
);

export const VehicleSelect = ({ id, vehicles, value, onChange }) => (
  <select
    id={id}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
    required
  >
    {vehicles.map(v => (
      <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.brand} {v.model})</option>
    ))}
  </select>
);

/**
 * Request a specific garage service (POST /bookings). Guards against double submit;
 * calls `onBooked(bookingId)` on success.
 */
const BookingRequestModal = ({ garageId, service, vehicles, isAuthenticated, onClose, onBooked }) => {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [scheduledFor, setScheduledFor] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose });
  const fieldId = useId();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setStatus({ type: '', msg: '' });

    if (!isAuthenticated) {
      setStatus({ type: 'error', msg: 'Please log in as a vehicle owner to request a booking.' });
      return;
    }
    if (!vehicleId) {
      setStatus({ type: 'error', msg: 'Please select a vehicle or add one to your fleet first.' });
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiPost('/bookings', {
        garageId,
        serviceId: service.id || service._id,
        vehicleId,
        scheduledFor: scheduledFor || undefined,
        notes
      });
      setStatus({ type: 'success', msg: 'Booking request sent successfully!' });
      onBooked(data.id);
    } catch (err) {
      setStatus({ type: 'error', msg: getErrorMessage(err, 'Failed to submit booking request. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 focus:outline-none">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 id={titleId} className="text-lg font-bold text-slate-900">
            Request Service: {service.title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <StatusMessage status={status} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${fieldId}-vehicle`} className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Select Your Vehicle *</label>
            <VehicleSelect id={`${fieldId}-vehicle`} vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
          </div>

          <div>
            <label htmlFor={`${fieldId}-date`} className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Preferred Date &amp; Time</label>
            <input
              id={`${fieldId}-date`}
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-notes`} className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Notes / Instructions</label>
            <textarea
              id={`${fieldId}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific issues or preferences..."
              rows={2}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold shadow-sm disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {submitting ? 'Sending Request...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingRequestModal;
