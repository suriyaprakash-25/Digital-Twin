import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  Percent,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ArrowLeft,
  Building,
  Car,
  Receipt,
  Eye,
  TrendingUp,
  RotateCcw,
  RefreshCw,
  Wallet,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Landmark,
  ShieldCheck
} from 'lucide-react';
import CommissionDetailsModal from '../components/commission/CommissionDetailsModal';
import RequestSettlementModal from '../components/settlement/RequestSettlementModal';
import InvoiceModal from '../components/invoice/InvoiceModal';
import PayoutProfileModal from '../components/garage/PayoutProfileModal';
import ErrorState from '../components/common/ErrorState';
import { apiGet, getErrorMessage } from '../utils/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const GarageEarnings = () => {
  const [earnings, setEarnings] = useState([]);
  const [summary, setSummary] = useState({
    totalGrossRevenue: 0,
    platformCommission: 0,
    netGarageEarnings: 0,
    availableBalance: 0,
    pendingSettlement: 0,
    settledAmount: 0,
    totalRefundAdjustments: 0
  });
  const [payoutProfile, setPayoutProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  // Modals
  const [selectedEarningForDetails, setSelectedEarningForDetails] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  const fetchEarningsAndSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [earnRes, sumRes, profRes] = await Promise.allSettled([
        apiGet('/garage/earnings', { page, limit: 15, search: debouncedSearch, status: statusFilter }),
        apiGet('/garage/earnings/summary'),
        apiGet('/garage/payout-profile')
      ]);

      if (earnRes.status === 'fulfilled' && earnRes.value?.success) {
        setEarnings(earnRes.value.earnings || []);
        setTotalPages(earnRes.value.totalPages || 1);
      }

      if (sumRes.status === 'fulfilled' && sumRes.value?.success) {
        setSummary(sumRes.value.summary);
      }

      if (profRes.status === 'fulfilled' && profRes.value?.success) {
        setPayoutProfile(profRes.value.profile);
      }

      // The payout profile may legitimately be missing; the ledger and summary may not.
      const failed = [earnRes, sumRes].find((r) => r.status === 'rejected');
      setError(failed ? getErrorMessage(failed.reason, 'Failed to load your earnings') : null);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchEarningsAndSummary(); });
    return () => { cancelled = true; };
  }, [fetchEarningsAndSummary]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/garage-dashboard"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-teal-600 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Garage Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Earnings & Revenue Ledger
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
            Transparent revenue tracking and verified payout balances
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsBankModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Landmark className="h-3.5 w-3.5 text-slate-500" />
            <span>{payoutProfile ? `Bank (****${payoutProfile.bankAccountLast4})` : 'Set Payout Bank'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRequestModalOpen(true)}
            disabled={summary.availableBalance < 500}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Request Payout</span>
          </button>

          <button
            type="button"
            onClick={fetchEarningsAndSummary}
            disabled={loading}
            className="p-2 rounded-xl text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh Ledger"
            aria-label="Refresh ledger"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Gross Revenue */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Gross Revenue</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(summary.totalGrossRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Total customer bills</p>
        </div>

        {/* Net Garage Earnings */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block mb-1">Net Earnings</span>
          <div className="text-xl sm:text-2xl font-black text-teal-700 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-teal-500 mr-0.5" />
            {Number(summary.netGarageEarnings || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-teal-600 mt-1">Gross - Commission</p>
        </div>

        {/* Available Balance */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">Available Balance</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-900 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-emerald-600 mr-0.5" />
            {Number(summary.availableBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-bold text-emerald-700 mt-1">Ready to withdraw</p>
        </div>

        {/* Pending Settlement */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Pending Payout</span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-amber-500 mr-0.5" />
            {Number(summary.pendingSettlement || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-amber-600 mt-1">Under review</p>
        </div>

        {/* Settled */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">Settled Amount</span>
          <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(summary.settledAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Transferred to bank</p>
        </div>
      </div>

      {/* Controls: Search & Filters */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Search earnings"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by invoice number, vehicle, service, payment ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'AVAILABLE', 'SETTLEMENT_PENDING', 'SETTLED', 'REFUND_ADJUSTMENT'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => { setStatusFilter(status); setPage(1); }}
              aria-pressed={statusFilter === status}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {status === 'ALL' ? 'All Transactions' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchEarningsAndSummary} retrying={loading} />}

      {/* Ledger Table */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : earnings.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Percent className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Earnings Records Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              When customers complete online bill settlements, your service earnings snapshots will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 pl-6">Invoice #</th>
                  <th className="py-3.5 px-4">Service & Vehicle</th>
                  <th className="py-3.5 px-4">Gross Bill</th>

                  <th className="py-3.5 px-4">Net Earned</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {earnings.map((e) => {
                  const isAvailable = e.status === 'AVAILABLE';
                  const isSettled = e.status === 'SETTLED';
                  const isPending = e.status === 'SETTLEMENT_PENDING' || e.status === 'PENDING_SETTLEMENT';

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 pl-6 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {e.invoiceNumber || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900">{e.serviceType}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Car className="h-3 w-3" />
                          {e.vehicleNumber}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        ₹{(parseFloat(e.grossAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-4 px-4 font-black text-emerald-700">
                        ₹{(parseFloat(e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> SETTLED
                          </span>
                        ) : isAvailable ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                            AVAILABLE
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" /> PROCESSING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200">
                            <RotateCcw className="h-3 w-3" /> ADJUSTED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px]">
                        {e.date ? new Date(e.date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedEarningForDetails(e)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                          >
                            Details
                          </button>

                          {e.invoiceId && (
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceId(e.invoiceId)}
                              className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all"
                            >
                              Invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Commission Breakdown Modal */}
      {selectedEarningForDetails && (
        <CommissionDetailsModal
          isOpen={Boolean(selectedEarningForDetails)}
          onClose={() => setSelectedEarningForDetails(null)}
          earning={selectedEarningForDetails}
          onViewInvoice={(invId) => setSelectedInvoiceId(invId)}
        />
      )}

      {/* Payout Request Modal */}
      {isRequestModalOpen && (
        <RequestSettlementModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          availableBalance={summary.availableBalance}
          payoutProfile={payoutProfile}
          onSuccess={() => fetchEarningsAndSummary()}
        />
      )}

      {/* Invoice Modal */}
      {selectedInvoiceId && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoiceId)}
          onClose={() => setSelectedInvoiceId(null)}
          serviceId={selectedInvoiceId}
        />
      )}

      {/* Bank Details Modal */}
      {isBankModalOpen && (
        <PayoutProfileModal
          onClose={() => setIsBankModalOpen(false)}
          onSaved={(profile) => {
            setPayoutProfile(profile);
            setIsBankModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default GarageEarnings;
