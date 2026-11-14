import { IndianRupee, Plus, Trash2, Wrench } from 'lucide-react';
import FormSection, { AddRowButton } from './FormSection';
import { formatRupees } from './serviceFormat';

const ROW_INPUT = 'w-full border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm shadow-sm';

export const RemoveRowButton = ({ onClick, label, className = 'p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer' }) => (
  <button type="button" onClick={onClick} className={className} title="Remove item" aria-label={label}>
    <Trash2 className="h-4 w-4" aria-hidden="true" />
  </button>
);

/** Step 3: parts replaced / materials used (name, brand, qty, unit price). */
const PartsEditor = ({ parts, onAdd, onRemove, onUpdate, subtotal }) => (
  <FormSection
    icon={Wrench}
    title="3. Parts Replaced / Materials Used"
    action={<AddRowButton onClick={onAdd} icon={Plus}>Add Part</AddRowButton>}
  >
    {parts.length === 0 ? (
      <div className="text-center py-6 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-slate-500 font-medium text-xs md:text-sm">
        No parts documented. Click <strong className="text-teal-700 font-bold">"+ Add Part"</strong> to record replaced components (e.g. Engine Oil, Oil Filter, Brake Pads).
      </div>
    ) : (
      <div className="space-y-3">
        <div className="hidden md:grid grid-cols-12 gap-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider" aria-hidden="true">
          <span className="col-span-4">Part Name</span>
          <span className="col-span-3">Brand / Spec</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-2 text-right">Unit Price (₹)</span>
          <span className="col-span-1 text-center">Action</span>
        </div>

        {parts.map((part, index) => {
          const qty = parseInt(part.quantity, 10) || 1;
          const unitPrice = parseFloat(part.unitPrice !== undefined ? part.unitPrice : (part.cost || 0)) || 0;
          const lineTotal = qty * unitPrice;
          const row = index + 1;

          return (
            <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-stretch md:items-center p-3 bg-slate-50 border border-slate-200/80 rounded-xl md:rounded-2xl animate-in fade-in zoom-in duration-200">
              <div className="col-span-4">
                <input
                  type="text"
                  aria-label={`Part ${row} name`}
                  placeholder="Part Name (e.g. Engine Oil)"
                  value={part.partName}
                  onChange={(e) => onUpdate(index, 'partName', e.target.value)}
                  className={`${ROW_INPUT} px-3 py-2 font-semibold`}
                />
              </div>
              <div className="col-span-3">
                <input
                  type="text"
                  aria-label={`Part ${row} brand or grade`}
                  placeholder="Brand / Grade (e.g. Castrol 5W-30)"
                  value={part.brand || ''}
                  onChange={(e) => onUpdate(index, 'brand', e.target.value)}
                  className={`${ROW_INPUT} px-3 py-2`}
                />
              </div>
              <div className="col-span-2 flex items-center justify-center gap-1.5">
                <span className="md:hidden text-xs text-slate-500 font-bold" aria-hidden="true">Qty:</span>
                <input
                  type="number"
                  min="1"
                  aria-label={`Part ${row} quantity`}
                  placeholder="Qty"
                  value={part.quantity !== undefined ? part.quantity : 1}
                  onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
                  className={`${ROW_INPUT} text-center px-2 py-2 font-bold`}
                />
              </div>
              <div className="col-span-2 relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
                  <IndianRupee className="h-3 w-3" />
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`Part ${row} unit price in rupees`}
                  placeholder="Unit Price"
                  value={part.unitPrice !== undefined ? part.unitPrice : part.cost}
                  onChange={(e) => onUpdate(index, 'unitPrice', e.target.value)}
                  className={`${ROW_INPUT} pl-7 pr-2 py-2 text-right font-bold`}
                />
              </div>
              <div className="col-span-1 flex items-center justify-between md:justify-center">
                <span className="md:hidden text-xs font-black text-slate-700">
                  Total: {formatRupees(lineTotal)}
                </span>
                <RemoveRowButton onClick={() => onRemove(index)} label={`Remove part ${row}`} />
              </div>
            </div>
          );
        })}

        <div className="flex justify-end pt-2 text-xs md:text-sm font-extrabold text-slate-700">
          <span>Parts Subtotal: <strong className="text-teal-700 font-mono text-base">{formatRupees(subtotal)}</strong></span>
        </div>
      </div>
    )}
  </FormSection>
);

export default PartsEditor;
