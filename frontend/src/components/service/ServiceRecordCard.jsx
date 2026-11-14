import { Wrench, Hash, IndianRupee, Building, CheckCircle, AlertTriangle, FileText, ChevronDown, ChevronUp, Receipt, MoreVertical, Trash2 } from 'lucide-react';
import PaymentButton from '../payment/PaymentButton';
import ServiceRecordDetails from './ServiceRecordDetails';

const formatServiceTitle = (serviceType) => (/^\d+$/.test(String(serviceType || '').trim())
    ? `Periodic Service (${Number(serviceType).toLocaleString()} km)`
    : serviceType || 'General Maintenance');

const PaymentStatusPill = ({ paid }) => (paid ? (
    <span className="flex items-center text-[10px] md:text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border border-emerald-200">
        <CheckCircle className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 text-emerald-600" aria-hidden="true" /> PAID ✓
    </span>
) : (
    <span className="flex items-center text-[10px] md:text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border border-amber-200">
        UNPAID
    </span>
));

/** Garage-only overflow menu (currently: delete record). */
const RecordMenu = ({ open, onToggle, onDelete }) => (
    <>
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-label="Service record options"
            aria-haspopup="menu"
            aria-expanded={open}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors self-start"
        >
            <MoreVertical className="h-5 w-5" aria-hidden="true" />
        </button>
        {open && (
            <div role="menu" className="absolute top-10 right-0 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors"
                >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete Record
                </button>
            </div>
        )}
    </>
);

/**
 * One service record on the vehicle timeline. The summary toggles the full report;
 * a dedicated button carries the keyboard/screen-reader toggle (aria-expanded).
 */
const ServiceRecordCard = ({
    service, vehicle, isGarage, isExpanded, onToggleExpand, menuOpen, onToggleMenu, onDelete,
    onViewInvoice, onViewReceipt, onOpenPhoto, onPaymentSuccess,
}) => {
    const serviceKey = service.id || service._id;
    const detailsId = `service-details-${serviceKey}`;
    const hasBillPhotos = service.billPhotoUrls && service.billPhotoUrls.length > 0;

    return (
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Timeline Center Dot */}
            <div className="flex items-center justify-center w-20 h-20 rounded-full shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl bg-white border-4 border-slate-50 z-10 transition-transform duration-300">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm">
                    <Wrench className="h-6 w-6" aria-hidden="true" />
                </div>
            </div>
            {/* Card Container */}
            <div className="w-[calc(100%-6rem)] md:w-[calc(50%-4rem)] bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">

                {/* Data Integrity Warning Tab */}
                {service.abnormalKmJump && (
                    <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                        <span className="text-[10px] md:text-xs font-bold text-red-700">Data Integrity Flag: Abnormal Odometer Jump Detected</span>
                    </div>
                )}

                {/* Mouse users can click anywhere on the summary; keyboard users use the toggle button below. */}
                <div className="p-4 md:p-6 cursor-pointer" onClick={onToggleExpand}>
                    <div className="flex flex-col xl:flex-row justify-between xl:items-start mb-4 gap-2">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className="text-[10px] md:text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border border-amber-100 uppercase tracking-wide">
                                    {service.serviceCategory}
                                </span>
                                {service.verifiedService && (
                                    <span className="flex items-center text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border border-emerald-100">
                                        <CheckCircle className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" aria-hidden="true" /> Verified
                                    </span>
                                )}
                                <PaymentStatusPill paid={service.paymentStatus === 'PAID'} />
                                {service.invoiceNumber && (
                                    <span className="font-mono text-[10px] md:text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                        {service.invoiceNumber}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-base md:text-xl font-extrabold text-slate-900 group-hover:text-teal-600 transition-colors tracking-tight mt-1">
                                {formatServiceTitle(service.serviceType)}
                            </h3>
                        </div>
                        <div className="flex flex-col items-end gap-2 relative">
                            <div className="flex items-center gap-2">
                                <span className="text-xs md:text-sm font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap self-start border border-slate-200 shadow-sm">
                                    {new Date(service.serviceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {isGarage && <RecordMenu open={menuOpen} onToggle={onToggleMenu} onDelete={onDelete} />}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-4 mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                <Hash className="h-4 w-4 text-slate-500" aria-hidden="true" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">{Number(service.odometerKm).toLocaleString()} km</span>
                        </div>
                        {service.garageName && (
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                    <Building className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                </div>
                                <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{service.garageName}</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                aria-expanded={isExpanded}
                                aria-controls={detailsId}
                                onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                                className="text-slate-400 font-bold flex items-center gap-1.5 text-xs md:text-sm hover:text-slate-600 transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            >
                                {isExpanded
                                    ? <><ChevronUp className="h-4 w-4" aria-hidden="true" /> Hide Details</>
                                    : <><ChevronDown className="h-4 w-4" aria-hidden="true" /> View Full Report</>}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onViewInvoice(serviceKey); }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all shadow-2xs"
                            >
                                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                View Bill / Invoice
                            </button>
                            {service.paymentStatus === 'PAID' && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onViewReceipt(serviceKey); }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all shadow-2xs"
                                >
                                    <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                                    Receipt
                                </button>
                            )}
                            {hasBillPhotos && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onOpenPhoto(service.billPhotoUrls[0]); }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
                                >
                                    Attached Photos ({service.billPhotoUrls.length})
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3 ml-auto flex-wrap">
                            <div className="text-right shrink-0">
                                <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Total Cost</span>
                                <span className="text-lg md:text-2xl font-black text-slate-900 flex items-center tracking-tight">
                                    <IndianRupee className="h-4 w-4 md:h-5 md:w-5 mr-0.5 text-slate-400" aria-hidden="true" />
                                    {(parseFloat(service.totalCost) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            {!isGarage && (
                                <PaymentButton service={service} vehicle={vehicle} onPaymentSuccess={onPaymentSuccess} />
                            )}
                        </div>
                    </div>
                </div>

                {isExpanded && <ServiceRecordDetails id={detailsId} service={service} onOpenPhoto={onOpenPhoto} />}
            </div>
        </div>
    );
};

export default ServiceRecordCard;
