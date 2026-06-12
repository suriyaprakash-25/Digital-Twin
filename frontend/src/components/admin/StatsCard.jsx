import { useEffect, useState } from 'react';

const StatsCard = ({ icon: Icon, title, value, subtitle, accentColor = 'teal', trend, prefix = '' }) => {
    const [displayValue, setDisplayValue] = useState(0);

    const colorMap = {
        teal: {
            bg: 'bg-teal-50',
            icon: 'text-teal-600',
            border: 'border-teal-200/60',
            glow: 'shadow-teal-500/5',
            accent: 'from-teal-500 to-teal-600',
            iconBg: '#f0fdfa'
        },
        cyan: {
            bg: 'bg-cyan-50',
            icon: 'text-cyan-600',
            border: 'border-cyan-200/60',
            glow: 'shadow-cyan-500/5',
            accent: 'from-cyan-500 to-cyan-600',
            iconBg: '#ecfeff'
        },
        emerald: {
            bg: 'bg-emerald-50',
            icon: 'text-emerald-600',
            border: 'border-emerald-200/60',
            glow: 'shadow-emerald-500/5',
            accent: 'from-emerald-500 to-emerald-600',
            iconBg: '#ecfdf5'
        },
        amber: {
            bg: 'bg-amber-50',
            icon: 'text-amber-600',
            border: 'border-amber-200/60',
            glow: 'shadow-amber-500/5',
            accent: 'from-amber-500 to-amber-600',
            iconBg: '#fffbeb'
        },
        sky: {
            bg: 'bg-sky-50',
            icon: 'text-sky-600',
            border: 'border-sky-200/60',
            glow: 'shadow-sky-500/5',
            accent: 'from-sky-500 to-sky-600',
            iconBg: '#f0f9ff'
        },
        rose: {
            bg: 'bg-rose-50',
            icon: 'text-rose-600',
            border: 'border-rose-200/60',
            glow: 'shadow-rose-500/5',
            accent: 'from-rose-500 to-rose-600',
            iconBg: '#fff1f2'
        }
    };

    const colors = colorMap[accentColor] || colorMap.teal;

    // Animated counter — compatible with React 18+ StrictMode
    useEffect(() => {
        const numericValue = typeof value === 'number'
            ? value
            : parseFloat(String(value).replace(/[^0-9.]/g, ''));

        if (Number.isNaN(numericValue) || numericValue === 0) {
            setDisplayValue(value);
            return;
        }

        setDisplayValue(typeof value === 'number' ? 0 : '0');

        const duration = 1000;
        const steps = 30;
        const increment = numericValue / steps;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            const current = Math.min(numericValue, increment * step);
            setDisplayValue(Math.round(current));
            if (step >= steps) {
                setDisplayValue(typeof value === 'number' ? value : numericValue);
                clearInterval(timer);
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value]);

    const formatValue = (val) => {
        if (typeof val === 'number') {
            return val.toLocaleString('en-IN');
        }
        return String(val);
    };

    return (
        <div
            className={`relative overflow-hidden rounded-2xl bg-white border ${colors.border} p-6 transition-all duration-300 hover:shadow-lg ${colors.glow} hover:-translate-y-0.5 group`}
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
            {/* Gradient accent line at top */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${colors.accent} opacity-60`}></div>

            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        {title}
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {prefix}{formatValue(displayValue)}
                    </p>
                    {subtitle && (
                        <p className="text-slate-400 text-xs font-medium mt-1.5">{subtitle}</p>
                    )}
                </div>
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${colors.bg} transition-transform duration-300 group-hover:scale-110`}
                    style={{ border: `1px solid ${colors.iconBg}` }}
                >
                    {Icon && <Icon className={`h-5 w-5 ${colors.icon}`} />}
                </div>
            </div>

            {trend !== undefined && (
                <div className="mt-3 flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                    <span className="text-slate-400 text-xs">vs last month</span>
                </div>
            )}
        </div>
    );
};

export default StatsCard;
