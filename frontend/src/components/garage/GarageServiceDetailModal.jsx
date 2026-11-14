import { Info, Wrench, X } from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUrl';
import { useDialog } from '../../hooks/useDialog';
import MediaManager from '../MediaManager';

/** Read-only details of a service record logged by the garage, plus its media. */
const GarageServiceDetailModal = ({ service, onClose }) => {
  const { dialogProps, titleId } = useDialog({ isOpen: Boolean(service), onClose });

  if (!service) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden focus:outline-none">
        
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 id={titleId} className="text-lg font-bold text-slate-900">Service Details</h3>
            <p className="text-sm text-slate-500 mt-1">Logged on {new Date(service.createdAt || service.serviceDate).toLocaleDateString()}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close service details" className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* Customer & Vehicle Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Vehicle Details</h4>
              {service.vehicle ? (
                <>
                  <p className="font-semibold text-slate-800">{service.vehicle.make} {service.vehicle.model} ({service.vehicle.year})</p>
                  <p className="text-sm text-slate-600 mt-1 uppercase bg-slate-200 inline-block px-2 py-0.5 rounded font-mono">{service.vehicle.registrationNumber}</p>
                  <p className="text-sm text-slate-600 mt-2 flex items-center gap-1"><Info size={14} className="text-slate-400"/> {service.odometerKm} km</p>
                </>
              ) : (
                <p className="text-sm text-slate-500 italic">Details unavailable</p>
              )}
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer Details</h4>
              {service.customer ? (
                <>
                  <p className="font-semibold text-slate-800">{service.customer.name || 'Unknown'}</p>
                  <p className="text-sm text-slate-600 mt-1">{service.customer.email}</p>
                </>
              ) : (
                <p className="text-sm text-slate-500 italic">Details unavailable</p>
              )}
            </div>
          </div>

          {/* Service Summary */}
          <div className="border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Wrench size={18} className="text-teal-600" />
              <h4 className="font-bold text-slate-800">{service.serviceType || 'General Service'}</h4>
              <span className="ml-auto text-xs font-semibold px-2 py-1 rounded-md bg-teal-50 text-teal-700 border border-teal-100">
                {service.serviceCategory}
              </span>
            </div>
            
            {service.mechanicNotes && (
              <div className="mt-4 bg-yellow-50/50 rounded-lg p-3 border border-yellow-100">
                <span className="text-xs font-bold text-yellow-800 uppercase tracking-wider block mb-1">Mechanic Notes</span>
                <p className="text-sm text-yellow-900 leading-relaxed">{service.mechanicNotes}</p>
              </div>
            )}
          </div>

          {/* Billing */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Billing & Parts</h4>
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="bg-slate-50 text-xs uppercase text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Item / Part</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {service.partsReplaced?.map((part, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-700">{part.partName} {part.brand && <span className="text-slate-400 text-xs font-normal ml-1">({part.brand})</span>}</td>
                      <td className="px-4 py-3 text-right">₹{parseFloat(part.cost).toLocaleString()}</td>
                    </tr>
                  ))}
                  {service.laborCost > 0 && (
                    <tr className="border-t border-slate-100 bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-600">Labor / Service Charge</td>
                      <td className="px-4 py-3 text-right">₹{parseFloat(service.laborCost).toLocaleString()}</td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-teal-700 text-base">₹{(parseFloat(service.totalCost) || 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bill Photos */}
          {service.billPhotoUrls && service.billPhotoUrls.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Attached Bills</h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {service.billPhotoUrls.map((url, idx) => (
                  <a key={idx} href={getPhotoUrl(url)} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 hover:border-teal-400 transition-colors">
                    <img src={getPhotoUrl(url)} alt={`Bill ${idx + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
          
          {/* Service Media Management */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Service Media</h4>
            <div className="space-y-4 border border-slate-100 rounded-xl p-4 bg-white">
              <MediaManager entityId={service.id} entityType="SERVICE" category="GARAGE_INSPECTION" label="Inspection Photos" />
              <MediaManager entityId={service.id} entityType="SERVICE" category="REPAIR_PROGRESS" label="Repair Progress Photos" />
              <MediaManager entityId={service.id} entityType="SERVICE" category="SERVICE_COMPLETION" label="Completed Service Photos" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GarageServiceDetailModal;
