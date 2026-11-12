import { IndianRupee, Plus } from 'lucide-react';
import FormSection, { AddRowButton } from './FormSection';
import { RemoveRowButton } from './PartsEditor';

/** Step 5 (completion mode): extra charges (consumables, disposal…) and a special discount. */
const ChargesAndDiscountEditor = ({ charges, onAdd, onRemove, onUpdate, discount, onDiscountChange }) => (
  <FormSection
    icon={Plus}
    title="5. Additional Charges & Discounts"
    action={<AddRowButton onClick={onAdd} icon={Plus}>Add Charge</AddRowButton>}
  >
    {charges.length > 0 && (
      <fieldset className="space-y-2">
        <legend className="text-xs md:text-sm font-bold text-slate-700">Additional Charges (Consumables, Disposal, etc.)</legend>
        {charges.map((charge, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              type="text"
              aria-label={`Additional charge ${index + 1} description`}
              placeholder="Charge description (e.g. Consumables & Environmental Fee)"
              value={charge.description}
              onChange={(e) => onUpdate(index, 'description', e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white text-xs md:text-sm"
            />
            <div className="relative w-36">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
                <IndianRupee className="h-3 w-3" />
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label={`Additional charge ${index + 1} amount in rupees`}
                placeholder="Amount"
                value={charge.amount}
                onChange={(e) => onUpdate(index, 'amount', e.target.value)}
                className="w-full pl-7 pr-2 py-2 text-right border border-slate-200 rounded-lg text-slate-900 bg-white text-xs md:text-sm font-bold"
              />
            </div>
            <RemoveRowButton
              onClick={() => onRemove(index)}
              label={`Remove additional charge ${index + 1}`}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
            />
          </div>
        ))}
      </fieldset>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
      <div className="space-y-1.5">
        <label htmlFor="service-discount" className="text-xs md:text-sm font-bold text-slate-700">Special Discount (₹)</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400" aria-hidden="true">
            <IndianRupee className="h-4 w-4" />
          </div>
          <input
            id="service-discount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
            className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white text-xs md:text-sm font-bold"
          />
        </div>
      </div>
    </div>
  </FormSection>
);

export default ChargesAndDiscountEditor;
