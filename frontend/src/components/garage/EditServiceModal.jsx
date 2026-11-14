import { useId } from 'react';
import { Pencil, Tag, Wrench, IndianRupee, Clock, Loader2 } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

const inputClass = 'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all';

/** Edit an existing marketplace service. `service` is the draft being edited. */
const EditServiceModal = ({ service, onChange, onSubmit, onClose, saving }) => {
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose });
  const fieldId = useId();
  const set = (field) => (e) => onChange((s) => ({ ...s, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div {...dialogProps} className="bg-white border border-teal-100 rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full animate-in zoom-in-95 duration-200 focus:outline-none">
        <div className="px-8 py-5 bg-teal-50 border-b border-teal-100 flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-xl text-teal-600">
            <Pencil className="h-5 w-5" />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-extrabold text-slate-900">Edit Service</h2>
            <p className="text-xs text-slate-500 mt-0.5">Update the details of your service</p>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <div className="p-8 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-title`} className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400" /> Service Title *
              </label>
              <input
                id={`${fieldId}-title`}
                value={service.title}
                onChange={set('title')}
                placeholder="e.g. Full Car Service"
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${fieldId}-description`} className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-400" /> Description
              </label>
              <input
                id={`${fieldId}-description`}
                value={service.description || ''}
                onChange={set('description')}
                placeholder="What's included?"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor={`${fieldId}-price`} className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-slate-400" /> Price (₹)
                </label>
                <input
                  id={`${fieldId}-price`}
                  type="number"
                  min="0"
                  value={service.price || ''}
                  onChange={set('price')}
                  placeholder="e.g. 2500"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${fieldId}-duration`} className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" /> Duration (mins)
                </label>
                <input
                  id={`${fieldId}-duration`}
                  type="number"
                  min="0"
                  value={service.durationMins || ''}
                  onChange={set('durationMins')}
                  placeholder="e.g. 120"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-all"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditServiceModal;
