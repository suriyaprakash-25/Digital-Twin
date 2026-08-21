import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  X,
  Plus,
  Trash2,
  Wrench,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Save,
  Loader2,
  Building,
  Car,
  User,
  Percent
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const GarageBillingModal = ({ isOpen, onClose, service, onInvoiceUpdated }) => {
  const { showToast } = useToast();

  const [parts, setParts] = useState([]);
  const [laborAmount, setLaborAmount] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [mechanicNotes, setMechanicNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  useEffect(() => {
    if (!service) return;

    // Initialize line items from existing service record
    const initialParts = Array.isArray(service.partsReplaced) && service.partsReplaced.length > 0
      ? service.partsReplaced.map(p => ({
          partName: p.partName || '',
          brand: p.brand || '',
          quantity: p.quantity || 1,
          unitPrice: p.unitPrice !== undefined ? p.unitPrice : (p.cost || 0)
        }))
      : [{ partName: '', brand: '', quantity: 1, unitPrice: 0 }];

    setParts(initialParts);
    setLaborAmount(parseFloat(service.laborAmount !== undefined ? service.laborAmount : (service.laborCost || 0)) || 0);
    setAdditionalCharges(parseFloat(service.additionalCharges || 0) || 0);
    setDiscountAmount(parseFloat(service.discountAmount || 0) || 0);
    setMechanicNotes(service.mechanicNotes || '');
    setConfirmFinalize(false);
  }, [service]);

  if (!isOpen || !service) return null;

  const isPaid = service.paymentStatus === 'PAID';
  const isFinalized = service.invoiceStatus === 'FINALIZED';

  // Live Calculations
  const partsSubtotal = parts.reduce((sum, p) => {
    const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
    const price = Math.max(0, parseFloat(p.unitPrice) || 0);
    return sum + (qty * price);
  }, 0);

  const subtotal = partsSubtotal + (parseFloat(laborAmount) || 0) + (parseFloat(additionalCharges) || 0);
  const grandTotal = Math.max(0, subtotal - (parseFloat(discountAmount) || 0));

  const handleAddPart = () => {
    setParts([...parts, { partName: '', brand: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemovePart = (idx) => {
    if (parts.length === 1) {
      setParts([{ partName: '', brand: '', quantity: 1, unitPrice: 0 }]);
      return;
    }
    setParts(parts.filter((_, i) => i !== idx));
  };

  const handlePartChange = (idx, field, value) => {
    const updated = [...parts];
    updated[idx][field] = value;
    setParts(updated);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const validParts = parts.filter(p => p.partName.trim() !== '');

      const res = await axios.put(
        `${apiBaseUrl}/api/garage/invoices/garage/${service.id || service._id}`,
        {
          partsReplaced: validParts,
          laborAmount: parseFloat(laborAmount) || 0,
          additionalCharges: parseFloat(additionalCharges) || 0,
          discountAmount: parseFloat(discountAmount) || 0,
          mechanicNotes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        showToast('Draft invoice updated successfully', 'success');
        if (onInvoiceUpdated) onInvoiceUpdated(res.data.invoice);
        onClose();
      }
    } catch (err) {
      console.error('Error updating draft invoice:', err);
      showToast(err.response?.data?.message || 'Failed to save draft invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeBill = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const validParts = parts.filter(p => p.partName.trim() !== '');

      const res = await axios.post(
        `${apiBaseUrl}/api/garage/invoices/garage/${service.id || service._id}/finalize`,
        {
          partsReplaced: validParts,
          laborAmount: parseFloat(laborAmount) || 0,
          additionalCharges: parseFloat(additionalCharges) || 0,
          discountAmount: parseFloat(discountAmount) || 0,
          mechanicNotes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        showToast(`Bill finalized with Invoice No: ${res.data.invoiceNumber}`, 'success');
        if (onInvoiceUpdated) {
          onInvoiceUpdated({
            id: service.id || service._id,
            invoiceNumber: res.data.invoiceNumber,
            invoiceStatus: 'FINALIZED',
            totalCost: res.data.totalAmount,
            totalAmount: res.data.totalAmount
          });
        }
        onClose();
      }
    } catch (err) {
      console.error('Error finalizing bill:', err);
      showToast(err.response?.data?.message || 'Failed to finalize invoice', 'error');
    } finally {
      setSaving(false);
      setConfirmFinalize(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full my-auto overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <FileCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">
                {isFinalized ? 'View Finalized Invoice' : 'Create / Finalize Service Bill'}
              </h3>
              {service.invoiceNumber && (
                <p className="font-mono text-xs text-slate-500 font-bold">{service.invoiceNumber}</p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Service</span>
              <p className="font-bold text-slate-800">{service.serviceType || 'General Service'}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Vehicle</span>
              <p className="font-bold text-teal-700 font-mono">
                {service.vehicle?.registrationNumber || service.vehicle?.vehicleNumber || 'Vehicle'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Customer</span>
              <p className="font-bold text-slate-800">{service.customer?.name || 'Owner'}</p>
            </div>
          </div>

          {/* Parts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-teal-600" />
                Replacement Parts & Materials
              </h4>
              {!isPaid && !isFinalized && (
                <button
                  type="button"
                  onClick={handleAddPart}
                  className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Line Item
                </button>
              )}
            </div>

            <div className="space-y-2">
              {parts.map((part, idx) => {
                const lineTotal = (parseInt(part.quantity, 10) || 1) * (parseFloat(part.unitPrice) || 0);
                return (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-slate-50/60 rounded-2xl border border-slate-200/80"
                  >
                    <input
                      type="text"
                      placeholder="Part Name (e.g. Synthetic Engine Oil 5W30)"
                      value={part.partName}
                      disabled={isPaid || isFinalized}
                      onChange={(e) => handlePartChange(idx, 'partName', e.target.value)}
                      className="flex-2 bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-teal-500 disabled:bg-slate-100"
                    />
                    <input
                      type="text"
                      placeholder="Brand (Optional)"
                      value={part.brand}
                      disabled={isPaid || isFinalized}
                      onChange={(e) => handlePartChange(idx, 'brand', e.target.value)}
                      className="w-full sm:w-28 bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-teal-500 disabled:bg-slate-100"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={part.quantity}
                        disabled={isPaid || isFinalized}
                        onChange={(e) => handlePartChange(idx, 'quantity', e.target.value)}
                        className="w-16 bg-white px-2 py-2 border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:border-teal-500 disabled:bg-slate-100"
                      />
                      <div className="relative flex-1 sm:w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Price"
                          value={part.unitPrice}
                          disabled={isPaid || isFinalized}
                          onChange={(e) => handlePartChange(idx, 'unitPrice', e.target.value)}
                          className="w-full pl-6 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 disabled:bg-slate-100"
                        />
                      </div>
                      <div className="w-24 text-right font-bold text-xs text-slate-800 pr-1">
                        ₹{lineTotal.toLocaleString('en-IN')}
                      </div>
                      {!isPaid && !isFinalized && (
                        <button
                          type="button"
                          onClick={() => handleRemovePart(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Labor & Service (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  value={laborAmount}
                  disabled={isPaid || isFinalized}
                  onChange={(e) => setLaborAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Additional Charges (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  value={additionalCharges}
                  disabled={isPaid || isFinalized}
                  onChange={(e) => setAdditionalCharges(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                Discount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-xs font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount}
                  disabled={isPaid || isFinalized}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 focus:outline-none focus:border-emerald-500 disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Mechanic / Service Notes
            </label>
            <textarea
              rows="2"
              value={mechanicNotes}
              disabled={isPaid || isFinalized}
              onChange={(e) => setMechanicNotes(e.target.value)}
              placeholder="Add service notes, recommendations, or parts warranty details..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500 disabled:bg-slate-100"
            ></textarea>
          </div>

          {/* Authoritative Live Total Box */}
          <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs space-y-0.5 text-slate-300">
              <p>Parts Subtotal: <strong className="text-white">₹{partsSubtotal.toLocaleString('en-IN')}</strong></p>
              <p>Labor & Charges: <strong className="text-white">₹{((parseFloat(laborAmount) || 0) + (parseFloat(additionalCharges) || 0)).toLocaleString('en-IN')}</strong></p>
              {discountAmount > 0 && (
                <p className="text-emerald-300">Discount Applied: -₹{Number(discountAmount).toLocaleString('en-IN')}</p>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-0.5">
                Calculated Grand Total
              </span>
              <span className="text-2xl md:text-3xl font-black text-white flex items-center justify-end tracking-tight">
                <IndianRupee className="h-6 w-6 mr-0.5 text-teal-400" />
                {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Confirmation Warning before Finalize */}
          {confirmFinalize && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl animate-in fade-in duration-200">
              <h5 className="font-extrabold text-sm text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Finalize this Service Bill?
              </h5>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Once finalized, a permanent invoice number will be generated and the bill will be unlocked for the customer to pay online. Billing amounts cannot be altered silently afterwards.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleFinalizeBill}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Yes, Finalize & Lock Bill
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFinalize(false)}
                  className="px-3 py-2 bg-white text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold border border-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-semibold text-slate-500">
            {isPaid ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Invoice Paid & Settled
              </span>
            ) : isFinalized ? (
              <span className="text-slate-600 font-bold">
                Invoice Finalized • Waiting for customer payment
              </span>
            ) : (
              <span>Draft Invoice • Review itemization before finalizing</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {!isFinalized && !isPaid && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
                >
                  <Save className="h-4 w-4" />
                  Save Draft
                </button>

                {!confirmFinalize && (
                  <button
                    type="button"
                    disabled={saving || grandTotal <= 0}
                    onClick={() => setConfirmFinalize(true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Finalize Bill (₹{grandTotal.toLocaleString('en-IN')})
                  </button>
                )}
              </>
            )}

            {(isFinalized || isPaid) && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs md:text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GarageBillingModal;
