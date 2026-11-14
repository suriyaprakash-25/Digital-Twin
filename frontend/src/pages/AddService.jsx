import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  CheckCircle,
  Calendar,
  Hash,
  ClipboardList,
  Shield,
  Info,
  Car,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useToast } from '../context/toastContextCore';
import { useAuth } from '../context/authContextCore';
import { ROLES } from '../utils/roles';
import { useAddServiceForm } from '../hooks/useAddServiceForm';
import { useBillPhotos } from '../hooks/useBillPhotos';
import ErrorState from '../components/common/ErrorState';
import FormSection from '../components/service/FormSection';
import ServiceFormField from '../components/service/ServiceFormField';
import PartsEditor from '../components/service/PartsEditor';
import LabourEditor from '../components/service/LabourEditor';
import ChargesAndDiscountEditor from '../components/service/ChargesAndDiscountEditor';
import InvoiceSummaryPreview from '../components/service/InvoiceSummaryPreview';
import BillPhotosSection from '../components/service/BillPhotosSection';
import ConfirmInvoiceModal from '../components/service/ConfirmInvoiceModal';
import ServiceSuccessScreen from '../components/service/ServiceSuccessScreen';

const SERVICE_CATEGORIES = ['Periodic Maintenance', 'Unscheduled Repair', 'Accidental Repair', 'Inspection/Checkup', 'Modification'];
const ICON = 'h-4 w-4 md:h-5 md:w-5';

const vehicleOptionLabel = (v) => (v.vehicleNumber
  ? `${v.vehicleNumber} - ${v.brand || ''} ${v.model} (${v.ownerName || 'No Owner'})`
  : `${v.brand || ''} ${v.model}`);

/** Banner with the booked vehicle and customer (completion mode only). */
const AssignedVehicleCard = ({ prefilledData, serviceCategory }) => (
  <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl md:rounded-3xl p-5 md:p-6 mb-6 shadow-md">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
          <Car className="h-8 w-8 text-white" aria-hidden="true" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-100 block">Assigned Vehicle</span>
          <h2 className="text-lg md:text-2xl font-black">
            {prefilledData.vehicle?.brand} {prefilledData.vehicle?.model}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-white/20 text-white font-mono text-xs font-bold px-2 py-0.5 rounded">
              {prefilledData.vehicle?.vehicleNumber}
            </span>
            <span className="text-xs text-teal-100 font-medium">
              Owner: <strong>{prefilledData.customer?.name}</strong>
            </span>
          </div>
        </div>
      </div>
      <div className="bg-white/15 backdrop-blur-sm px-4 py-2 rounded-xl text-right self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:items-end">
        <span className="text-[11px] font-bold text-teal-100 uppercase">Service Category</span>
        <span className="text-sm font-extrabold text-white mt-0.5">{serviceCategory}</span>
      </div>
    </div>
  </div>
);

const AddService = () => {
  const { showToast } = useToast();
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const completionMode = searchParams.get('completionMode') === 'true';
  const photos = useBillPhotos();
  const form = useAddServiceForm({
    completionMode,
    bookingId: searchParams.get('bookingId') || '',
    serviceId: searchParams.get('serviceId') || '',
    isGarage: role === ROLES.GARAGE,
    billPhotos: photos.billPhotos,
    showToast,
  });
  const { formData, handleChange, financialTotals, status, isLoading, prefilledData, vehicles } = form;
  const field = (props) => <ServiceFormField formData={formData} onChange={handleChange} {...props} />;

  if (form.successResult) {
    return (
      <ServiceSuccessScreen
        successResult={form.successResult}
        prefilledData={prefilledData}
        serviceType={formData.serviceType}
        completionMode={completionMode}
      />
    );
  }

  if (form.isLoadingPrefill) {
    return (
      <div role="status" aria-label="Loading booking details" className="max-w-4xl mx-auto animate-in fade-in duration-300 pb-12 lg:pb-8 space-y-6">
        <div className="h-12 w-1/3 bg-slate-200 rounded-xl animate-pulse mb-8" />
        <div className="h-32 w-full bg-slate-200 rounded-2xl animate-pulse" />
        <div className="h-64 w-full bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-64 w-full bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const submitDisabled = isLoading || (completionMode ? !formData.vehicleId : vehicles.length === 0);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 lg:pb-8">
      {/* Top Header */}
      <header className="mb-4 md:mb-8">
        {completionMode && (
          <button
            type="button"
            onClick={() => navigate('/garage-dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to Vehicles In Progress
          </button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
              <Wrench className="h-5 w-5 md:h-8 md:w-8 text-teal-600" aria-hidden="true" />
              {completionMode ? 'Complete Service' : 'Log Service Entry'}
            </h1>
            <p className="text-slate-500 mt-1 font-medium text-xs md:text-base">
              {completionMode
                ? "Add the work performed, replaced components and labour charges to generate the customer's invoice."
                : 'Create a highly structured, production-grade maintenance record.'}
            </p>
          </div>
          {completionMode && (
            <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-black tracking-wide uppercase shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
              Completion Mode
            </span>
          )}
        </div>
      </header>

      {completionMode && prefilledData && (
        <AssignedVehicleCard prefilledData={prefilledData} serviceCategory={formData.serviceCategory} />
      )}

      {form.vehiclesError && (
        <ErrorState className="mb-6" title="Could not load vehicles" message={form.vehiclesError} onRetry={form.reloadVehicles} />
      )}

      <form onSubmit={form.handleSubmit} className="space-y-4 md:space-y-8" aria-busy={isLoading}>
        {status.message && (
          <div
            role={status.type === 'error' ? 'alert' : 'status'}
            className={`p-3 md:p-4 rounded-xl flex items-center gap-3 text-xs md:text-sm font-semibold shadow-sm ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {status.type === 'success' ? <CheckCircle className="h-4.5 w-4.5 md:h-5 md:w-5" aria-hidden="true" /> : <AlertCircle className="h-4.5 w-4.5 md:h-5 md:w-5" aria-hidden="true" />}
            {status.message}
          </div>
        )}

        {/* 1. Core Service Info */}
        <FormSection icon={ClipboardList} title="1. Core Information" bodyClassName="p-3 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
          {!completionMode ? (
            field({
              label: 'Select Vehicle *', name: 'vehicleId', icon: <Car className={ICON} />, required: true,
              options: vehicles.map((v) => ({ value: v.id, label: vehicleOptionLabel(v) })),
            })
          ) : (
            <div className="space-y-1 md:space-y-1.5 pb-1 md:pb-2">
              <span id="service-locked-vehicle" className="text-xs md:text-sm font-bold text-slate-700">Vehicle (Locked to Job)</span>
              <div aria-labelledby="service-locked-vehicle" className="flex items-center gap-3 px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-bold text-xs md:text-sm">
                <Car className="h-4 w-4 text-teal-600" aria-hidden="true" />
                <span>{prefilledData?.vehicle?.vehicleNumber} &bull; {prefilledData?.vehicle?.brand} {prefilledData?.vehicle?.model}</span>
              </div>
            </div>
          )}
          {field({ label: 'Service Date *', name: 'serviceDate', type: 'date', icon: <Calendar className={ICON} />, required: true })}
          {field({ label: 'Current Odometer (km) *', name: 'odometerKm', type: 'number', icon: <Hash className={ICON} />, placeholder: 'e.g. 45000', required: true, min: 0 })}

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
            {field({ label: 'Service Category *', name: 'serviceCategory', icon: <ClipboardList className={ICON} />, options: SERVICE_CATEGORIES, required: true })}
            {field({ label: 'Specific Service Title *', name: 'serviceType', icon: <Wrench className={ICON} />, placeholder: 'e.g. Oil & Filter Change, Brake Service', required: true })}
          </div>
        </FormSection>

        {/* 2. Detailed Work Performed & Observations */}
        <FormSection icon={Wrench} title="2. Work Performed & Observations">
          <div className="space-y-1.5">
            <label htmlFor="service-mechanicNotes" className="text-xs md:text-sm font-bold text-slate-700">Mechanic Notes / Observations</label>
            <textarea
              id="service-mechanicNotes"
              name="mechanicNotes"
              value={formData.mechanicNotes}
              onChange={handleChange}
              placeholder="Details on engine oil grade, filter condition, diagnostics run, fluid top-ups, or notes for the customer..."
              className="block w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm min-h-24 text-xs md:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 pt-2">
            {field({ label: 'Warranty Included (Months)', name: 'warrantyMonths', type: 'number', icon: <Shield className={ICON} />, placeholder: 'e.g. 6', min: 0 })}
            {field({ label: 'Next Recommended Date', name: 'recommendedDate', type: 'date', icon: <Calendar className={ICON} /> })}
          </div>
        </FormSection>

        {/* 3. Replaced Components / Parts */}
        <PartsEditor
          parts={form.parts.items}
          onAdd={form.parts.add}
          onRemove={form.parts.remove}
          onUpdate={form.parts.update}
          subtotal={financialTotals.partsSubtotal}
        />

        {/* 4. Labour Charges */}
        <LabourEditor
          completionMode={completionMode}
          labour={form.labour.items}
          onAdd={form.labour.add}
          onRemove={form.labour.remove}
          onUpdate={form.labour.update}
          subtotal={financialTotals.labourSubtotal}
          formData={formData}
          onChange={handleChange}
        />

        {/* 5. Additional Charges & Discount */}
        {completionMode && (
          <ChargesAndDiscountEditor
            charges={form.charges.items}
            onAdd={form.charges.add}
            onRemove={form.charges.remove}
            onUpdate={form.charges.update}
            discount={form.discount}
            onDiscountChange={form.setDiscount}
          />
        )}

        {/* 6. Real-time Invoice Calculation Summary (Completion Mode) */}
        {completionMode && <InvoiceSummaryPreview totals={financialTotals} />}

        {/* Photos Section (+ camera modal) */}
        <BillPhotosSection
          billPhotos={photos.billPhotos}
          onFileChange={photos.handleBillPhotoChange}
          onRemove={photos.removeBillPhoto}
          camera={photos.camera}
        />

        {/* Submit Actions */}
        <div className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
            <Info className="h-4 w-4 text-teal-500 shrink-0" aria-hidden="true" />
            <span>Tax snapshot and atomic financial integrity rules will be applied upon submission.</span>
          </div>

          <button
            type="submit"
            disabled={submitDisabled}
            aria-busy={isLoading}
            className="w-full md:w-auto px-8 py-4 border border-transparent text-sm font-black rounded-xl text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Processing...</>
            ) : completionMode ? (
              <><CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" /> Complete Service & Generate Invoice</>
            ) : (
              <><ClipboardList className="h-5 w-5" aria-hidden="true" /> Submit Service Record</>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Modal for Completion Mode */}
      <ConfirmInvoiceModal
        isOpen={form.showConfirmModal}
        onCancel={() => form.setShowConfirmModal(false)}
        onConfirm={form.executeSubmit}
        isSubmitting={isLoading}
        vehicleNumber={prefilledData?.vehicle?.vehicleNumber}
        serviceCategory={formData.serviceCategory}
        grandTotal={financialTotals.grandTotal}
      />
    </div>
  );
};

export default AddService;
