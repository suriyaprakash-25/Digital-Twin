/** Vehicle / preferred time / notes shared by every booking request on the page. */
const BookingOptions = ({ vehicles, selectedVehicleId, onVehicleChange, scheduledFor, onScheduledForChange, notes, onNotesChange }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <label htmlFor="booking-vehicle" className="block text-sm font-semibold text-slate-700">Vehicle</label>
        <select
          id="booking-vehicle"
          value={selectedVehicleId}
          onChange={(e) => onVehicleChange(e.target.value)}
          className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vehicleNumber}
            </option>
          ))}
        </select>
        {vehicles.length === 0 ? <div className="text-xs text-slate-500 mt-2">No vehicles available.</div> : null}
      </div>

      <div>
        <label htmlFor="booking-scheduled-for" className="block text-sm font-semibold text-slate-700">Preferred date & time</label>
        <input
          id="booking-scheduled-for"
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => onScheduledForChange(e.target.value)}
          className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
        />
      </div>

      <div>
        <label htmlFor="booking-notes" className="block text-sm font-semibold text-slate-700">Notes</label>
        <input
          id="booking-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Optional"
          className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
        />
      </div>
    </div>
  </div>
);

export default BookingOptions;
