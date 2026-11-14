import { IndianRupee, Plus, Wrench } from 'lucide-react';
import FormSection, { AddRowButton } from './FormSection';
import ServiceFormField from './ServiceFormField';
import { RemoveRowButton } from './PartsEditor';
import { formatRupees } from './serviceFormat';

const ROW_INPUT = 'w-full border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm shadow-sm';

/**
 * Step 4: labour. Completion mode itemises labour (description, hours, rate);
 * a plain log entry only records a single labour cost.
 */
const LabourEditor = ({ completionMode, labour, onAdd, onRemove, onUpdate, subtotal, formData, onChange }) => (
  <FormSection
    icon={Wrench}
    title="4. Labour Charges"
    action={completionMode ? <AddRowButton onClick={onAdd} icon={Plus}>Add Labour</AddRowButton> : null}
  >
    {completionMode ? (
      <div className="space-y-3">
        <div className="hidden md:grid grid-cols-12 gap-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider" aria-hidden="true">
          <span className="col-span-6">Description</span>
          <span className="col-span-2 text-center">Hours / Units</span>
          <span className="col-span-3 text-right">Rate / Hr (₹)</span>
          <span className="col-span-1 text-center">Action</span>
        </div>

        {labour.map((item, index) => {
          const qty = parseFloat(item.quantity || 1) || 1;
          const rate = parseFloat(item.rate || 0) || 0;
          const lineTotal = qty * rate;
          const row = index + 1;

          return (
            <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-stretch md:items-center p-3 bg-slate-50 border border-slate-200/80 rounded-xl md:rounded-2xl animate-in fade-in zoom-in duration-200">
              <div className="col-span-6">
                <input
                  type="text"
                  aria-label={`Labour item ${row} description`}
                  placeholder="Labour description (e.g. Periodic Service Labour)"
                  value={item.description}
                  onChange={(e) => onUpdate(index, 'description', e.target.value)}
                  className={`${ROW_INPUT} px-3 py-2 font-semibold`}
                />
              </div>
              <div className="col-span-2 flex items-center justify-center gap-1.5">
                <span className="md:hidden text-xs text-slate-500 font-bold" aria-hidden="true">Hours:</span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  aria-label={`Labour item ${row} hours`}
                  placeholder="Hours"
                  value={item.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
                  className={`${ROW_INPUT} text-center px-2 py-2 font-bold`}
                />
              </div>
              <div className="col-span-3 relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
                  <IndianRupee className="h-3 w-3" />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`Labour item ${row} rate per hour in rupees`}
                  placeholder="Rate"
                  value={item.rate}
                  onChange={(e) => onUpdate(index, 'rate', e.target.value)}
                  className={`${ROW_INPUT} pl-7 pr-2 py-2 text-right font-bold`}
                />
              </div>
              <div className="col-span-1 flex items-center justify-between md:justify-center">
                <span className="md:hidden text-xs font-black text-slate-700">
                  Total: {formatRupees(lineTotal)}
                </span>
                <RemoveRowButton onClick={() => onRemove(index)} label={`Remove labour item ${row}`} />
              </div>
            </div>
          );
        })}

        <div className="flex justify-end pt-2 text-xs md:text-sm font-extrabold text-slate-700">
          <span>Labour Subtotal: <strong className="text-teal-700 font-mono text-base">{formatRupees(subtotal)}</strong></span>
        </div>
      </div>
    ) : (
      <div>
        <ServiceFormField
          label="Labor Charges (₹)"
          name="laborCost"
          type="number"
          icon={<IndianRupee className="h-4 w-4 md:h-5 md:w-5" />}
          placeholder="0"
          min={0}
          formData={formData}
          onChange={onChange}
        />
      </div>
    )}
  </FormSection>
);

export default LabourEditor;
