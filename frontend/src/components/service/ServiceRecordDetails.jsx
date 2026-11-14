import { Wrench, IndianRupee, FileText, Receipt, ZoomIn, Car } from 'lucide-react';
import MediaManager from '../MediaManager';

const formatInr = (value) => (parseFloat(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatShortDate = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const SectionHeading = ({ icon, children, className = 'mb-3' }) => {
    const Icon = icon;
    return (
        <h4 className={`text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 ${className}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {children}
        </h4>
    );
};

const PartsTable = ({ parts }) => (
    <div className="mt-6 mb-6">
        <SectionHeading icon={Wrench}>Parts / Materials Replaced</SectionHeading>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {parts.map((part, pIdx) => {
                const partTotal = parseFloat(part.total) || (parseFloat(part.quantity || 1) * parseFloat(part.unitPrice || 0)) || parseFloat(part.cost) || 0;
                return (
                    <div key={pIdx} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <div>
                            <span className="text-sm font-bold text-slate-700">
                                {part.partName}
                            </span>
                            {part.brand && <span className="font-normal text-xs text-slate-400 font-sans ml-2 bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5">Brand: {part.brand}</span>}
                            {part.quantity > 1 && (
                                <span className="text-xs text-slate-400 font-medium ml-2">
                                    (Qty: {part.quantity} @ ₹{parseFloat(part.unitPrice || 0).toLocaleString('en-IN')})
                                </span>
                            )}
                        </div>
                        <span className="text-sm font-bold text-slate-900 flex items-center">
                            <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" aria-hidden="true" /> {formatInr(partTotal)}
                        </span>
                    </div>
                );
            })}
        </div>
    </div>
);

const LabourCharges = ({ service }) => {
    if (service.laborCharges && service.laborCharges.length > 0) {
        return (
            <div className="mt-4 mb-6">
                <SectionHeading icon={Wrench}>Labour Charges</SectionHeading>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    {service.laborCharges.map((labour, lIdx) => {
                        const labourTotal = parseFloat(labour.total) || (parseFloat(labour.quantity || labour.hours || 1) * parseFloat(labour.rate || 0)) || 0;
                        return (
                            <div key={lIdx} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                <span className="text-sm font-bold text-slate-700">
                                    {labour.description || 'Labour Service'}
                                </span>
                                <span className="text-sm font-bold text-slate-900 flex items-center">
                                    <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" aria-hidden="true" /> {formatInr(labourTotal)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    if (service.laborCost > 0) {
        return (
            <div className="mt-4 mb-4 bg-white rounded-xl border border-slate-200 p-3 flex justify-between items-center shadow-sm">
                <span className="text-sm font-bold text-slate-600">Labour Charges</span>
                <span className="text-sm font-bold text-slate-900 flex items-center">
                    <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" aria-hidden="true" /> {formatInr(service.laborCost)}
                </span>
            </div>
        );
    }
    return null;
};

const BillPhotos = ({ urls, onOpenPhoto }) => (
    <div className="mt-6">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
            Service Bill{urls.length > 1 ? 's' : ''}
            <span className="ml-auto text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {urls.length} photo{urls.length > 1 ? 's' : ''}
            </span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {urls.map((url, pIdx) => (
                <button
                    type="button"
                    key={pIdx}
                    aria-label={`Enlarge bill photo ${pIdx + 1}`}
                    className="relative rounded-xl overflow-hidden border-2 border-violet-100 shadow-sm cursor-pointer group aspect-square bg-slate-900 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    onClick={() => onOpenPhoto(url)}
                >
                    <img
                        src={url}
                        alt={`Bill ${pIdx + 1}`}
                        className="w-full h-full object-cover"
                    />
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" aria-hidden="true" />
                    </span>
                    <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-md">{pIdx + 1}</span>
                </button>
            ))}
        </div>
        <p className="text-[10px] text-slate-400 font-medium mt-1.5">Click any photo to enlarge</p>
    </div>
);

/** Expanded "full report" section of a service record: parts, labour, notes, photos. */
const ServiceRecordDetails = ({ service, id, onOpenPhoto }) => {
    const serviceKey = service.id || service._id;
    return (
        <div id={id} className="px-4 pb-4 md:px-6 md:pb-6 bg-slate-50 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
            {service.partsReplaced && service.partsReplaced.length > 0 && <PartsTable parts={service.partsReplaced} />}

            <LabourCharges service={service} />

            {service.mechanicNotes && (
                <div className="mt-4">
                    <SectionHeading icon={FileText} className="mb-2">Mechanic Notes</SectionHeading>
                    <p className="text-sm text-slate-600 bg-white p-4 rounded-xl border border-slate-200 shadow-sm font-medium leading-relaxed italic">
                        "{service.mechanicNotes}"
                    </p>
                </div>
            )}

            {/* Recommendations Area — always shown */}
            <div className="mt-6 flex flex-wrap gap-4">
                <div className="flex-1 bg-teal-50 border border-teal-100 p-3 rounded-xl min-w-[130px]">
                    <span className="text-[10px] font-bold text-teal-500 uppercase tracking-wider block mb-1">Next Service (Km)</span>
                    <span className="text-sm font-black text-teal-800">
                        {service.recommendedKm ? `${Number(service.recommendedKm).toLocaleString()} km` : '—'}
                    </span>
                </div>
                <div className="flex-1 bg-emerald-50 border border-emerald-100 p-3 rounded-xl min-w-[130px]">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Next Service (Date)</span>
                    <span className="text-sm font-black text-emerald-800">
                        {service.recommendedDate ? formatShortDate(service.recommendedDate) : '—'}
                    </span>
                </div>
            </div>

            {service.billPhotoUrls && service.billPhotoUrls.length > 0 && (
                <BillPhotos urls={service.billPhotoUrls} onOpenPhoto={onOpenPhoto} />
            )}

            {/* Service Media Management (Read Only) */}
            <div className="mt-6">
                <SectionHeading icon={Car}>Service Photos</SectionHeading>
                <div className="space-y-4">
                    {service.bookingId && <MediaManager entityId={service.bookingId} entityType="BOOKING" category="CUSTOMER_DAMAGE" label="Customer Damage Photos" readOnly={true} />}
                    <MediaManager entityId={serviceKey} entityType="SERVICE" category="GARAGE_INSPECTION" label="Inspection Photos" readOnly={true} />
                    {service.bookingId && <MediaManager entityId={service.bookingId} entityType="BOOKING" category="REPAIR_PROGRESS" label="Repair Progress Photos" readOnly={true} />}
                    <MediaManager entityId={serviceKey} entityType="SERVICE" category="SERVICE_COMPLETION" label="Completed Service Photos" readOnly={true} />
                </div>
            </div>
        </div>
    );
};

export default ServiceRecordDetails;
