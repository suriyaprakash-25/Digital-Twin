import { useId, useState } from 'react';
import { Store, Loader2 } from 'lucide-react';

const DEFAULT_CAPACITY = 20;

// The parent keys this card by the saved limit, so the editor re-syncs when it changes.
const CapacityCard = ({ maxCapacity, activeCount, updating, onUpdate }) => {
  const capacity = maxCapacity !== undefined ? maxCapacity : DEFAULT_CAPACITY;
  const [inputCapacity, setInputCapacity] = useState(capacity);
  const inputId = useId();

  const occupancyPct = Math.min(100, Math.round((activeCount / capacity) * 100));
  const barColor = occupancyPct >= 90 ? 'bg-rose-500' : occupancyPct >= 75 ? 'bg-amber-500' : 'bg-teal-500';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between lg:col-span-1">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
            <Store className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Capacity & Shop Floor</h3>
            <p className="text-xs text-slate-500 font-semibold">Manage active vehicle limits</p>
          </div>
        </div>

        {/* Occupancy stats */}
        <div className="space-y-2 mt-4">
          <div className="flex justify-between text-sm font-bold text-slate-700">
            <span>Occupancy</span>
            <span>{activeCount} / {capacity} slots</span>
          </div>
          <div
            className="w-full bg-slate-100 rounded-full h-3 overflow-hidden"
            role="progressbar"
            aria-label="Shop floor occupancy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={occupancyPct}
          >
            <div className={`h-full transition-all duration-500 rounded-full ${barColor}`} style={{ width: `${occupancyPct}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1">
            {capacity - activeCount} available slots out of {capacity} total limit.
          </p>
        </div>
      </div>

      {/* Quick Edit Capacity Form */}
      <div className="border-t border-slate-100 pt-4 mt-6">
        <label htmlFor={inputId} className="block text-xs font-bold text-slate-700 mb-2">Adjust Capacity Limit</label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="number"
            min="1"
            value={inputCapacity}
            onChange={(e) => setInputCapacity(Math.max(1, parseInt(e.target.value, 10) || 0))}
            className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-950 bg-slate-55 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-center"
          />
          <button
            type="button"
            onClick={() => onUpdate(inputCapacity)}
            disabled={updating || inputCapacity === capacity}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 text-white font-bold rounded-xl px-4 py-2 text-xs hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {updating && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {updating ? 'Saving…' : 'Update Limit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CapacityCard;
