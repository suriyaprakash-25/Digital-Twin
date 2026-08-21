import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  IndianRupee,
  Calendar,
  Search,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquare,
  X,
  ChevronLeft,
  ChevronRight,
  Send
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../utils/api';

const GarageDisputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Response Modal State
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [garageResponse, setGarageResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/garage/disputes`, {
        headers: getAuthHeaders(),
        params: { page, limit: 20, status: statusFilter, search }
      });

      if (res.data?.success) {
        setDisputes(res.data.disputes || []);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching garage disputes:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleRespondSubmit = async (e) => {
    e.preventDefault();
    if (!garageResponse.trim()) {
      setError('Please provide an explanation');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/garage/disputes/${selectedDispute.id}/respond`,
        { response: garageResponse },
        { headers: getAuthHeaders() }
      );

      if (res.data?.success) {
        setSelectedDispute(null);
        setGarageResponse('');
        fetchDisputes();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting response');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
              Customer Support Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Customer Inquiries & Disputes
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Review and respond to customer billing or service inquiries regarding completed invoices
          </p>
        </div>

        <button
          onClick={fetchDisputes}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dispute number, invoice, vehicle..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'].map((status) => (
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
              {status === 'ALL' ? 'All Inquiries' : status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-16 px-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Active Disputes</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              All your garage service invoices are in good standing with customers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 pl-6">Dispute ID</th>
                  <th className="py-3.5 px-4">Invoice / Vehicle</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Claimed Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {disputes.map((d) => {
                  const isResolved = d.status === 'RESOLVED';
                  const isRejected = d.status === 'REJECTED';
                  const isOpen = d.status === 'OPEN';
                  const hasResponded = Boolean(d.garageResponse);

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 pl-6 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {d.disputeNumber}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-800 block">{d.invoiceNumber}</span>
                        <span className="text-[11px] text-slate-400 block">{d.vehicleNumber}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-900 block truncate max-w-[220px]">{d.subject}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d.category?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900">
                        ₹{Number(d.disputedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            RESOLVED
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                            REJECTED
                          </span>
                        ) : isOpen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            AWAITING RESPONSE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                            UNDER REVIEW
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px]">
                        {d.date ? new Date(d.date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDispute(d);
                            setGarageResponse(d.garageResponse || '');
                          }}
                          className="px-3 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{hasResponded ? 'View Response' : 'Respond'}</span>
                        </button>
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

      {/* Response Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-6 relative">
              <button
                onClick={() => setSelectedDispute(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold bg-slate-800 text-amber-400 px-2 py-0.5 rounded">
                  {selectedDispute.disputeNumber}
                </span>
                <span className="text-xs text-slate-400">{selectedDispute.invoiceNumber}</span>
              </div>
              <h3 className="text-base font-black text-white">{selectedDispute.subject}</h3>
            </div>

            <form onSubmit={handleRespondSubmit} className="p-6 space-y-4">
              {error && <p className="text-xs font-bold text-red-600">{error}</p>}

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Customer Claim</span>
                <p className="font-bold text-slate-800">
                  Claimed Amount: ₹{Number(selectedDispute.disputedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-slate-600">{selectedDispute.category?.replace(/_/g, ' ')}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Garage Partner Explanation *
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="Provide detailed context regarding parts used, service performed, or billing justification..."
                  value={garageResponse}
                  onChange={(e) => setGarageResponse(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs"
                >
                  {submitting ? 'Saving...' : 'Submit Garage Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GarageDisputes;
