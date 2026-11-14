import { Hash } from 'lucide-react';

const FIELD_CLASS = 'block w-full pl-9 md:pl-11 pr-3 md:pr-4 py-2 md:py-3 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm';

/**
 * Labelled input/select with a leading icon, bound to `formData[name]`.
 * `options` (strings or `{ value, label }`) renders a <select>.
 */
const ServiceFormField = ({
  label, name, formData, onChange, type = 'text', icon, placeholder = '', options = null, ...extraProps
}) => {
  const id = `service-${name}`;
  return (
    <div className="space-y-1 md:space-y-1.5 pb-1 md:pb-2">
      <label htmlFor={id} className="text-xs md:text-sm font-bold text-slate-700">{label}</label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors" aria-hidden="true">
          {icon || <Hash className="h-4 w-4 md:h-5 md:w-5" />}
        </div>
        {options ? (
          <select
            id={id}
            name={name}
            value={formData[name]}
            onChange={onChange}
            {...extraProps}
            className={`${FIELD_CLASS} appearance-none cursor-pointer`}
          >
            {options.map((opt) => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            name={name}
            type={type}
            placeholder={placeholder}
            value={formData[name]}
            onChange={onChange}
            {...extraProps}
            className={`${FIELD_CLASS} placeholder-slate-400`}
          />
        )}
      </div>
    </div>
  );
};

export default ServiceFormField;
