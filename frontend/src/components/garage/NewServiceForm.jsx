import { useId, useState } from 'react';
import { Plus, Wrench, Tag, IndianRupee, Image as ImageIcon, ListChecks, Check, Layers } from 'lucide-react';

const inputClass = 'w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all';
const labelClass = 'text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2';

/** "New Service" form for the garage's marketplace listing. Controlled by the parent. */
const NewServiceForm = ({ value, onChange, onSubmit, onCancel, adding }) => {
  const [newInclusion, setNewInclusion] = useState('');
  const fieldId = useId();
  const set = (field) => (e) => onChange((s) => ({ ...s, [field]: e.target.value }));

  const addInclusion = () => {
    if (!newInclusion.trim()) return;
    onChange((s) => ({ ...s, whatsIncluded: [...(s.whatsIncluded || []), newInclusion.trim()] }));
    setNewInclusion('');
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-teal-100 rounded-2xl md:rounded-3xl shadow-md overflow-hidden mb-8"
      aria-labelledby={`${fieldId}-heading`}
    >
      <div className="px-4 py-3 md:px-8 md:py-5 bg-teal-50 border-b border-teal-100 flex items-center gap-3">
        <div className="p-1.5 bg-teal-100 rounded-xl text-teal-600"><Wrench className="h-4 w-4 md:h-5 md:w-5" /></div>
        <div>
          <h2 id={`${fieldId}-heading`} className="text-sm md:text-base font-extrabold text-slate-900">New Service</h2>
          <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">This will be shown to customers in the marketplace</p>
        </div>
      </div>
      <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-title`} className={labelClass}>
            <Tag className="h-3.5 w-3.5 text-slate-400" /> Service Title *
          </label>
          <input id={`${fieldId}-title`} value={value.title} onChange={set('title')} placeholder="e.g. Full Car Service" required className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-description`} className={labelClass}>
            <Wrench className="h-3.5 w-3.5 text-slate-400" /> Description
          </label>
          <input id={`${fieldId}-description`} value={value.description} onChange={set('description')} placeholder="What's included?" className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-price`} className={labelClass}>
            <IndianRupee className="h-3.5 w-3.5 text-slate-400" /> Price (₹)
          </label>
          <input id={`${fieldId}-price`} type="number" min="0" value={value.price} onChange={set('price')} placeholder="e.g. 2500" className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-category`} className={labelClass}>
            <Tag className="h-3.5 w-3.5 text-slate-400" /> Category
          </label>
          <select id={`${fieldId}-category`} value={value.category} onChange={set('category')} className={`${inputClass} text-slate-900`}>
            <option value="Periodic Maintenance">Periodic Maintenance</option>
            <option value="Repairs">Repairs</option>
            <option value="Packages & Bundles">Packages &amp; Bundles</option>
            <option value="Breakdown & Inspection">Breakdown &amp; Inspection</option>
            <option value="Accessories & Detailing">Accessories &amp; Detailing</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-photo`} className={labelClass}>
            <ImageIcon className="h-3.5 w-3.5 text-slate-400" /> Service Photo URL
          </label>
          <input id={`${fieldId}-photo`} value={value.photoUrl || ''} onChange={set('photoUrl')} placeholder="https://images.unsplash.com/photo-..." className={inputClass} />
        </div>

        {/* What's Included Bullet List */}
        <div className="md:col-span-2 space-y-1.5">
          <label htmlFor={`${fieldId}-inclusion`} className={labelClass}>
            <ListChecks className="h-3.5 w-3.5 text-teal-600" /> &quot;What&apos;s Included&quot; Bullet List
          </label>
          <div className="space-y-2">
            {value.whatsIncluded?.map((inc, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal-600" /> {inc}</span>
                <button
                  type="button"
                  aria-label={`Remove "${inc}"`}
                  onClick={() => onChange((s) => ({ ...s, whatsIncluded: s.whatsIncluded.filter((_, i) => i !== idx) }))}
                  className="text-red-500 hover:text-red-700 font-bold"
                >
                  &times;
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                id={`${fieldId}-inclusion`}
                value={newInclusion}
                onChange={(e) => setNewInclusion(e.target.value)}
                placeholder="Add item (e.g. Synthetic Oil, 25-Point Inspection)"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addInclusion();
                  }
                }}
              />
              <button
                type="button"
                onClick={addInclusion}
                className="px-3.5 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-900 transition-colors"
              >
                + Add Item
              </button>
            </div>
          </div>
        </div>

        {/* Package Bundling Option */}
        <div className="md:col-span-2 space-y-2 pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value.isPackage)}
              onChange={(e) => onChange((s) => ({ ...s, isPackage: e.target.checked, category: e.target.checked ? 'Packages & Bundles' : s.category }))}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-violet-600" /> Bundle sub-items into a service package (e.g. Basic Service = Oil + Filter + Inspection)
            </span>
          </label>
        </div>
      </div>
      <div className="px-4 py-3 md:px-8 md:py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 md:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs md:text-sm font-semibold hover:bg-slate-100 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 rounded-xl bg-teal-600 text-white text-xs md:text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-all"
        >
          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
          {adding ? 'Adding…' : 'Add Service'}
        </button>
      </div>
    </form>
  );
};

export default NewServiceForm;
