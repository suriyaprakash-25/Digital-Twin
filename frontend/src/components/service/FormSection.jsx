/** Card with the tinted header used by each step of the service form. */
const FormSection = ({ icon, title, action, tone = 'teal', children, bodyClassName = 'p-3 md:p-8 space-y-4' }) => {
  const Icon = icon;
  const tones = {
    teal: { header: 'bg-teal-50 border-teal-100', badge: 'bg-teal-100 text-teal-600' },
    violet: { header: 'bg-violet-50 border-violet-100', badge: 'bg-violet-100 text-violet-600' },
  };
  const t = tones[tone] || tones.teal;
  return (
    <section className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
      <div className={`${t.header} px-4 py-2.5 md:px-8 md:py-5 border-b flex items-center ${action ? 'justify-between' : ''} gap-2.5`}>
        <div className="flex items-center gap-2.5">
          <div className={`p-1 md:p-1.5 rounded-lg ${t.badge}`}><Icon className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" /></div>
          <h2 className="text-sm md:text-xl font-bold text-slate-800">{title}</h2>
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
};

/** "+ Add …" button placed in a FormSection header. */
export const AddRowButton = ({ onClick, children, icon }) => {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs sm:text-sm text-teal-700 bg-white hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
    >
      <Icon className="h-4 w-4" aria-hidden="true" /> {children}
    </button>
  );
};

export default FormSection;
