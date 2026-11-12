import { useId, useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { apiPost, getErrorMessage } from '../../utils/api';
import { useDialog } from '../../hooks/useDialog';
import { StatusMessage, VehicleSelect } from './BookingRequestModal';

const SAFETY_TERMS = /\b(brake|brakes|steering|burst|leak|smoke|fire|overheating)\b/i;
const selectClass = 'w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold';

/**
 * "Report a vehicle issue" booking (POST /bookings with isCustomIssue). Shows a safety
 * notice once for safety-related wording; calls `onBooked(bookingId)` on success.
 */
const CustomIssueModal = ({ garageId, vehicles, isAuthenticated, onClose, onBooked }) => {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('Not sure');
  const [urgency, setUrgency] = useState('Not sure');
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose });
  const fieldId = useId();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setStatus({ type: '', msg: '' });

    if (!isAuthenticated) {
      setStatus({ type: 'error', msg: 'Please log in as a vehicle owner to report an issue.' });
      return;
    }
    if (!vehicleId) {
      setStatus({ type: 'error', msg: 'Please select a vehicle.' });
      return;
    }
    if (!description || description.trim().length < 5) {
      setStatus({ type: 'error', msg: 'Please provide a clearer description of the issue.' });
      return;
    }
    if (SAFETY_TERMS.test(description) && !showSafetyWarning) {
      setShowSafetyWarning(true);
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiPost('/bookings', {
        garageId,
        vehicleId,
        isCustomIssue: true,
        issueDetails: { description, duration, urgency }
      });
      onBooked(data.id);
    } catch (err) {
      setStatus({ type: 'error', msg: getErrorMessage(err, 'Failed to submit issue. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto focus:outline-none">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 id={titleId} className="text-lg font-bold text-slate-900">Report a Vehicle Issue</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <StatusMessage status={status} className="mb-4" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${fieldId}-vehicle`} className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Select Your Vehicle *</label>
            <VehicleSelect id={`${fieldId}-vehicle`} vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
          </div>

          <div>
            <label htmlFor={`${fieldId}-description`} className="block text-xs font-extrabold uppercase text-slate-700 mb-1">What problem are you experiencing? *</label>
            <textarea
              id={`${fieldId}-description`}
              required
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setShowSafetyWarning(false); // Reset warning on edit
              }}
              placeholder="Describe what is happening with your vehicle. For example: My brake pedal feels soft and the vehicle takes longer to stop."
              rows={4}
              maxLength={1000}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-duration`} className="block text-xs font-extrabold uppercase text-slate-700 mb-1">When did the problem start?</label>
            <select id={`${fieldId}-duration`} value={duration} onChange={(e) => setDuration(e.target.value)} className={selectClass}>
              <option value="Today">Today</option>
              <option value="A few days ago">A few days ago</option>
              <option value="More than a week ago">More than a week ago</option>
              <option value="More than a month ago">More than a month ago</option>
              <option value="Not sure">Not sure</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${fieldId}-urgency`} className="block text-xs font-extrabold uppercase text-slate-700 mb-1">How is the issue affecting your vehicle?</label>
            <select id={`${fieldId}-urgency`} value={urgency} onChange={(e) => setUrgency(e.target.value)} className={selectClass}>
              <option value="Vehicle is working normally">Vehicle is working normally</option>
              <option value="Vehicle is working but has a problem">Vehicle is working but has a problem</option>
              <option value="Difficult to drive">Difficult to drive</option>
              <option value="Unable to drive">Unable to drive</option>
              <option value="Not sure">Not sure</option>
            </select>
          </div>

          {showSafetyWarning && (
            <div role="alert" className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" aria-hidden="true" />
                <p className="text-xs text-orange-800 font-semibold">
                  <strong>Safety Notice:</strong> Some vehicle problems may make a vehicle unsafe to drive. If you believe your vehicle is unsafe, avoid driving it and consider appropriate professional or emergency assistance. Click Submit again to proceed.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
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
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {submitting ? 'Sending...' : (showSafetyWarning ? 'Acknowledge & Submit' : 'Submit Issue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomIssueModal;
