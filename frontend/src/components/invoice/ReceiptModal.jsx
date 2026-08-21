import { API_BASE_URL } from '../../utils/config';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  X,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Building,
  User,
  Car,
  Receipt,
  IndianRupee,
  Calendar,
  AlertCircle
} from 'lucide-react';

const ReceiptModal = ({ isOpen, onClose, serviceId, initialReceiptData = null }) => {
  const [receipt, setReceipt] = useState(initialReceiptData);
  const [loading, setLoading] = useState(!initialReceiptData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !serviceId) return;

    const fetchReceipt = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = API_BASE_URL;
        const res = await axios.get(`${apiBaseUrl}/api/invoices/${serviceId}/receipt`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success) {
          setReceipt(res.data.receipt);
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setError(err.response?.data?.message || 'Failed to load receipt details');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [isOpen, serviceId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = receipt?.paidAt
    ? new Date(receipt.paidAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full my-auto overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Receipt className="h-4 w-4" />
            </span>
            <span className="font-extrabold text-sm text-slate-800 tracking-tight">
              Payment Receipt
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              type="button"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-5 print:p-0">
          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3"></div>
              <p className="text-xs font-bold text-slate-400">Loading verified payment receipt...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-center text-xs font-bold text-red-700 flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : receipt ? (
            <>
              {/* Header Box */}
              <div className="text-center pb-5 border-b border-slate-100">
                <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-2 border border-emerald-100 shadow-2xs">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Payment Confirmed
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Receipt No: <span className="font-mono font-bold text-slate-700">{receipt.receiptNumber}</span>
                </p>
              </div>

              {/* Amount Display */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Total Amount Paid
                </span>
                <span className="text-2xl md:text-3xl font-black text-slate-900 flex items-center justify-center tracking-tight">
                  <IndianRupee className="h-5 w-5 mr-0.5 text-slate-400" />
                  {Number(receipt.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block mt-2">
                  Settled via {receipt.paymentMethod || 'Razorpay Online'}
                </span>
              </div>

              {/* Details List */}
              <div className="space-y-3 text-xs md:text-sm font-medium divide-y divide-slate-100">
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-slate-500">Invoice Number</span>
                  <span className="font-mono font-bold text-slate-800">{receipt.invoiceNumber}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-slate-500">Payment ID</span>
                  <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded select-all">
                    {receipt.paymentId}
                  </span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-slate-500">Date & Time</span>
                  <span className="font-bold text-slate-700">{formattedDate}</span>
                </div>
                {receipt.garage?.name && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-500">Garage</span>
                    <span className="font-bold text-slate-800 text-right truncate max-w-[200px]">{receipt.garage.name}</span>
                  </div>
                )}
                {receipt.vehicle && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-500">Vehicle</span>
                    <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                      {receipt.vehicle.registrationNumber} ({receipt.vehicle.brand} {receipt.vehicle.model})
                    </span>
                  </div>
                )}
                {receipt.serviceType && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-500">Service</span>
                    <span className="font-bold text-slate-800 text-right">{receipt.serviceType}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Verified by DrivePortz Digital Trust Network</span>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            type="button"
            className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
