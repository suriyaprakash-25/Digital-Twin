import { Search } from 'lucide-react';
import { PAYMENT_STATUS_FILTERS } from './paymentFilterUtils';

/** Search box, status segmented control and vehicle select for the Payment Center. */
const PaymentFilters = ({ search, onSearchChange, status, onStatusChange, vehicle, onVehicleChange, vehicles = [] }) => (
  <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
    <div className="relative w-full md:w-80">
      <label htmlFor="payment-center-search" className="sr-only">Search payments</label>
      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        id="payment-center-search"
        type="search"
        placeholder="Search by invoice, garage, service..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
      />
    </div>

    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
      <div role="group" aria-label="Filter by status" className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs">
        {PAYMENT_STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => onStatusChange(value)}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              status === value ? 'bg-teal-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vehicles.length > 0 && (
        <>
          <label htmlFor="payment-center-vehicle" className="sr-only">Filter by vehicle</label>
          <select
            id="payment-center-vehicle"
            value={vehicle}
            onChange={(e) => onVehicleChange(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </>
      )}
    </div>
  </div>
);

export default PaymentFilters;
