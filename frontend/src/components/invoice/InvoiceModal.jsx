import { API_BASE_URL } from '../../utils/config';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  X,
  FileText,
  Building,
  User,
  Car,
  Wrench,
  IndianRupee,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  Receipt,
  Download,
  AlertCircle
} from 'lucide-react';
import PaymentButton from '../payment/PaymentButton';

const InvoiceModal = ({ isOpen, onClose, serviceId, initialInvoiceData = null, onPaymentSuccess, onViewReceipt }) => {
  const [invoice, setInvoice] = useState(initialInvoiceData);
  const [loading, setLoading] = useState(!initialInvoiceData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !serviceId) return;

    const fetchInvoice = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const apiBaseUrl = API_BASE_URL;
        const res = await axios.get(`${apiBaseUrl}/api/invoices/${serviceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success) {
          setInvoice(res.data.invoice);
        }
      } catch (err) {
        console.error('Error loading invoice details:', err);
        setError(err.response?.data?.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [isOpen, serviceId]);

  if (!isOpen) return null;

  const isPaid = invoice?.paymentStatus === 'PAID';
  const totalPayable = invoice ? Number(invoice.totalAmount !== undefined ? invoice.totalAmount : (invoice.totalCost || 0)) : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full my-auto overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <FileText className="h-4 w-4" />
            </span>
            <span className="font-extrabold text-sm text-slate-800 tracking-tight">
              Tax Invoice / Service Bill
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5"
              title="Print Invoice"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={onClose}
              type="button"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 print:p-0">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-3"></div>
              <p className="text-xs font-bold text-slate-400">Loading verified invoice details...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-sm font-bold text-red-700 flex items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          ) : invoice ? (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <img src="/logo-removebg-preview.png" alt="DrivePortz" className="h-8 w-auto" />
                    <span className="text-xs font-black tracking-wider uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                      Official Invoice
                    </span>
                  </div>
                  <p className="font-mono text-base font-black text-slate-900 mt-1">
                    {invoice.invoiceNumber}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Date:{' '}
                    {invoice.serviceDate
                      ? new Date(invoice.serviceDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                      : '—'}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col sm:items-end gap-1.5">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-2xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      PAID ✓
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 shadow-2xs">
                      <Clock className="h-4 w-4 text-amber-600" />
                      UNPAID
                    </span>
                  )}
                  {invoice.paidAt && (
                    <span className="text-[11px] font-semibold text-slate-400">
                      Paid on: {new Date(invoice.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Garage & Customer Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Garage Info */}
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-teal-600" /> Service Provider
                  </span>
                  <p className="font-extrabold text-sm text-slate-800">{invoice.garage?.name}</p>
                  {invoice.garage?.address && (
                    <p className="text-xs text-slate-600">{invoice.garage.address}</p>
                  )}
                  {invoice.garage?.phone && (
                    <p className="text-xs text-slate-500 font-mono">Tel: {invoice.garage.phone}</p>
                  )}
                </div>

                {/* Customer & Vehicle Info */}
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-teal-600" /> Customer & Vehicle
                  </span>
                  <p className="font-extrabold text-sm text-slate-800">{invoice.customer?.name || 'Customer'}</p>
                  {invoice.vehicle && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                        {invoice.vehicle.registrationNumber}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">
                        {invoice.vehicle.brand} {invoice.vehicle.model}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Description */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-4 w-4 text-teal-600" />
                  <h4 className="font-bold text-sm text-slate-900">{invoice.serviceType || 'Automotive Service'}</h4>
                  <span className="ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-100">
                    {invoice.serviceCategory}
                  </span>
                </div>
                {invoice.mechanicNotes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl italic border border-slate-100 mt-2">
                    "{invoice.mechanicNotes}"
                  </p>
                )}
              </div>

              {/* Line Items Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Itemized Breakdown
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs md:text-sm text-left">
                    <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-center">Qty</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoice.partsReplaced && invoice.partsReplaced.length > 0 ? (
                        invoice.partsReplaced.map((part, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {part.partName}
                              {part.brand && (
                                <span className="text-[10px] text-slate-400 ml-1.5 font-normal">
                                  ({part.brand})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600 font-mono">
                              {part.quantity || 1}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">
                              ₹{Number(part.unitPrice || part.cost || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                              ₹{Number(part.cost || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="px-4 py-3 text-slate-400 italic text-center">
                            No individual replacement parts billed
                          </td>
                        </tr>
                      )}

                      {/* Labor Charge */}
                      {invoice.laborAmount > 0 && (
                        <tr className="bg-slate-50/40">
                          <td colSpan="3" className="px-4 py-2.5 font-medium text-slate-700">
                            Labor & Diagnostic Service
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                            ₹{Number(invoice.laborAmount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      )}

                      {/* Additional Charges */}
                      {invoice.additionalCharges > 0 && (
                        <tr className="bg-slate-50/40">
                          <td colSpan="3" className="px-4 py-2.5 font-medium text-slate-700">
                            Additional Service Charges
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                            ₹{Number(invoice.additionalCharges).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      )}

                      {/* Subtotal */}
                      <tr className="border-t border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                        <td colSpan="3" className="px-4 py-2 text-right">Subtotal</td>
                        <td className="px-4 py-2 text-right">
                          ₹{Number(invoice.subtotal || totalPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>

                      {/* Discount */}
                      {invoice.discountAmount > 0 && (
                        <tr className="bg-emerald-50/40 text-xs font-bold text-emerald-700">
                          <td colSpan="3" className="px-4 py-2 text-right">Promotional Discount</td>
                          <td className="px-4 py-2 text-right">
                            -₹{Number(invoice.discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}

                      {/* Taxes if applicable */}
                      {invoice.taxAmount > 0 && (
                        <tr className="text-xs font-semibold text-slate-600">
                          <td colSpan="3" className="px-4 py-2 text-right">Taxes & GST</td>
                          <td className="px-4 py-2 text-right">
                            +₹{Number(invoice.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}

                      {/* Grand Total */}
                      <tr className="border-t-2 border-slate-900 bg-teal-50/40">
                        <td colSpan="3" className="px-4 py-3 font-black text-sm md:text-base text-slate-900 text-right uppercase tracking-wider">
                          Grand Total Payable
                        </td>
                        <td className="px-4 py-3 text-right font-black text-base md:text-xl text-teal-800">
                          ₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer / Actions */}
        {invoice && (
          <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              <span>Razorpay Secured Digital Payment</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {isPaid ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onViewReceipt) onViewReceipt(invoice);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs md:text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
                  >
                    <Receipt className="h-4 w-4 text-teal-600" />
                    View Receipt
                  </button>
                  <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4" /> Paid
                  </span>
                </>
              ) : (
                <PaymentButton
                  service={invoice}
                  vehicle={invoice.vehicle}
                  onPaymentSuccess={(payment) => {
                    setInvoice((prev) => ({
                      ...prev,
                      paymentStatus: 'PAID',
                      paidAt: payment.paidAt,
                      paymentId: payment.paymentId
                    }));
                    if (onPaymentSuccess) onPaymentSuccess(payment);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 text-sm"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceModal;
