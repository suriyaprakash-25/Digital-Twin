import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, CheckCircle2, FileText, IndianRupee } from 'lucide-react';
import InvoiceModal from '../invoice/InvoiceModal';
import MediaManager from '../MediaManager';

const SummaryCard = ({ label, children, footer }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</div>
    {children}
    {footer}
  </div>
);

/** Shown after a service is logged or completed: invoice summary, photo upload, next steps. */
const ServiceSuccessScreen = ({ successResult, prefilledData, serviceType, completionMode }) => {
  const navigate = useNavigate();
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const isLogOnly = successResult.isLogOnly;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-in fade-in zoom-in-95 duration-400">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden text-center p-8 md:p-12">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
          <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
        </div>

        <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-wider rounded-full">
          {isLogOnly ? 'Service Logged' : 'Service Finalized'}
        </span>

        <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">
          {isLogOnly ? 'Service Logged Successfully' : 'Service Completed Successfully'}
        </h1>
        <p className="text-slate-500 text-sm md:text-base mt-2 max-w-lg mx-auto font-medium">
          {isLogOnly
            ? 'The service details have been securely logged to the vehicle history.'
            : 'The customer has been notified and the authoritative GST tax invoice has been generated.'}
        </p>

        {/* Key Summary Cards */}
        {!isLogOnly && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left">
            <SummaryCard label="Invoice Number" footer={<div className="text-xs text-teal-600 font-semibold mt-1">Tax Compliant</div>}>
              <div className="text-base font-extrabold text-slate-900 mt-1 font-mono">{successResult.invoiceNumber}</div>
            </SummaryCard>

            <SummaryCard label="Total Amount" footer={<div className="text-xs text-slate-500 font-medium mt-1">Incl. 18% GST</div>}>
              <div className="text-xl font-black text-slate-900 mt-1 flex items-center">
                <IndianRupee className="h-4 w-4" aria-hidden="true" /> {successResult.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </SummaryCard>

            <SummaryCard label="Payment Status">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-extrabold mt-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true"></span>
                Awaiting Customer Payment
              </div>
            </SummaryCard>
          </div>
        )}

        {/* Vehicle & Customer Details */}
        {prefilledData && (
          <div className="bg-teal-50/60 border border-teal-200/80 rounded-2xl p-5 mb-8 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-100 text-teal-700 rounded-xl">
                <Car className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-slate-900">
                  {prefilledData.vehicle?.brand} {prefilledData.vehicle?.model} &bull; <span className="font-mono text-teal-700">{prefilledData.vehicle?.vehicleNumber}</span>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  Customer: <span className="font-bold text-slate-700">{prefilledData.customer?.name}</span> ({prefilledData.customer?.phone || prefilledData.customer?.email})
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              Service: <span className="text-slate-900 font-bold">{serviceType}</span>
            </div>
          </div>
        )}

        {/* Media Manager Section */}
        <div className="mt-8 mb-8 text-left border border-slate-100 bg-slate-50 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Upload Service Photos (Optional)</h2>
          <div className="space-y-4">
            {completionMode ? (
              <MediaManager entityId={successResult.serviceId} entityType="SERVICE" category="SERVICE_COMPLETION" label="Completed Service Photos" />
            ) : (
              <MediaManager entityId={successResult.serviceId} entityType="SERVICE" category="GARAGE_INSPECTION" label="Inspection Photos" />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {!isLogOnly && (
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <FileText className="h-4 w-4" aria-hidden="true" /> View Generated Invoice
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/garage-services-history')}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            Back to Service History
          </button>
          <button
            type="button"
            onClick={() => navigate('/garage-dashboard')}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Reusable Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          serviceId={successResult.serviceId || successResult.invoiceNumber}
        />
      )}
    </div>
  );
};

export default ServiceSuccessScreen;
