import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
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
import { API_BASE_URL, getAuthHeaders } from '../utils/api';

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

  // Modals
  const [selectedEarningForDetails, setSelectedEarningForDetails] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  // Bank Form State
  const [bankForm, setBankForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: ''
  });
  const [bankSaving, setBankSaving] = useState(false);

  const fetchEarningsAndSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [earnRes, sumRes, profRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/garage/earnings`, {
          headers: getAuthHeaders(),
          params: { page, limit: 15, search, status: statusFilter }
        }),
        axios.get(`${API_BASE_URL}/api/garage/earnings/summary`, {
          headers: getAuthHeaders()
        }),
        axios.get(`${API_BASE_URL}/api/garage/payout-profile`, {
          headers: getAuthHeaders()
        })
      ]);

      if (earnRes.status === 'fulfilled' && earnRes.value.data?.success) {
        setEarnings(earnRes.value.data.earnings || []);
        setTotalPages(earnRes.value.data.totalPages || 1);
      }

      if (sumRes.status === 'fulfilled' && sumRes.value.data?.success) {
        setSummary(sumRes.value.data.summary);
      }

      if (profRes.status === 'fulfilled' && profRes.value.data?.success) {
        setPayoutProfile(profRes.value.data.profile);
      }
    } catch (err) {
      console.error('Error loading garage earnings:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchEarningsAndSummary();
  }, [fetchEarningsAndSummary]);

  const handleSaveBank = async (e) => {
    e.preventDefault();
    setBankSaving(true);
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/garage/payout-profile`,
        bankForm,
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        setPayoutProfile(res.data.profile);
        setIsBankModalOpen(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving payout profile');
    } finally {
      setBankSaving(false);
    }
  };

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
            Transparent revenue tracking, DrivePortz platform fees, and verified payout balances
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setIsBankModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Landmark className="h-3.5 w-3.5 text-slate-500" />
            <span>{payoutProfile ? `Bank (****${payoutProfile.bankAccountLast4})` : 'Set Payout Bank'}</span>
          </button>

          <button
            onClick={() => setIsRequestModalOpen(true)}
            disabled={summary.availableBalance < 500}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Request Payout</span>
          </button>

          <button
            onClick={fetchEarningsAndSummary}
            className="p-2 rounded-xl text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Gross Revenue */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Gross Revenue</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(summary.totalGrossRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Total customer bills</p>
        </div>

        {/* DrivePortz Fee */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block mb-1">Platform Fee</span>
          <div className="text-xl sm:text-2xl font-black text-red-700 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-red-400 mr-0.5" />
            {Number(summary.platformCommission || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Platform commission</p>
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
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number, vehicle, service, payment ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'AVAILABLE', 'SETTLEMENT_PENDING', 'SETTLED', 'REFUND_ADJUSTMENT'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
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
              When customers complete online bill settlements, your service earnings and platform commission snapshots will appear here.
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
                  <th className="py-3.5 px-4">Fee ({earnings[0]?.commissionRate || 5}%)</th>
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
                  const isRefund = e.status === 'REFUND_ADJUSTMENT' || e.status === 'CANCELLED';

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
                      <td className="py-4 px-4 font-bold text-red-600">
                        - ₹{(parseFloat(e.platformCommission) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Garage Bank Account for Payouts</h3>
              <button onClick={() => setIsBankModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Auto Services"
                  value={bankForm.accountHolderName}
                  onChange={e => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank"
                  value={bankForm.bankName}
                  onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Account Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50100492817291"
                  value={bankForm.accountNumber}
                  onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">IFSC Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC0001234"
                  value={bankForm.ifscCode}
                  onChange={e => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bankSaving}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md"
                >
                  {bankSaving ? 'Saving...' : 'Save Bank Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GarageEarnings;
