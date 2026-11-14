import { Wrench, Loader2 } from 'lucide-react';
import MediaManager from '../../MediaManager';

const InProgressVehicles = ({ bookings, pendingBookingId, onStart, onComplete }) => (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden lg:col-span-2 flex flex-col">
    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 text-violet-650 rounded-xl">
          <Wrench className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Vehicles Currently In Progress</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Vehicles on the shop floor being serviced</p>
        </div>
      </div>
      <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">
        {bookings.length} active
      </span>
    </div>

    <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[220px]">
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center h-full">
          <Wrench className="h-10 w-10 text-slate-200 mb-2" />
          <p className="text-slate-400 font-medium text-xs">No vehicles currently in progress.</p>
        </div>
      ) : (
        bookings.map(b => {
          const isPending = pendingBookingId === b.id;
          return (
            <div key={b.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div>
                <div className="text-sm font-extrabold text-slate-900">
                  {b.vehicle?.brand} {b.vehicle?.model} &bull; <span className="font-mono text-xs text-indigo-650">{b.vehicle?.vehicleNumber}</span>
                </div>
                <div className="text-xs text-slate-500 font-semibold mt-0.5">
                  Service: {b.service?.title} | Status: <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${b.status === 'IN_PROGRESS' ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'}`}>{b.status === 'IN_PROGRESS' ? 'In Progress' : 'Accepted'}</span>
                </div>
                {b.status === 'IN_PROGRESS' && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <MediaManager entityId={b.id} entityType="BOOKING" category="REPAIR_PROGRESS" label="Repair Progress Photos" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {b.status === 'ACCEPTED' && (
                  <button
                    type="button"
                    onClick={() => onStart(b.id)}
                    disabled={Boolean(pendingBookingId)}
                    aria-busy={isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 border border-violet-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                    Start Service
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onComplete(b)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  Mark Completed
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);

export default InProgressVehicles;
