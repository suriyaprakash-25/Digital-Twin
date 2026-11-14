import { Link } from 'react-router-dom';
import { Store, Wrench, Clock, TrendingUp } from 'lucide-react';

const DashboardHero = ({ profile, servicesCount, inProgressCount, completedCount }) => {
  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G';

  const stats = [
    { label: 'Total Services', value: servicesCount, icon: <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-teal-400" />, bg: 'bg-teal-500/10' },
    { label: 'In Progress', value: inProgressCount, icon: <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />, bg: 'bg-violet-500/10' },
    { label: 'Completed', value: completedCount, icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />, bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-5 sm:p-8 shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.3),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.15),transparent_60%)]" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
              {profile?.photoUrl
                ? <img src={profile.photoUrl} alt="Garage" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-xl font-black">{initials}</div>
              }
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold tracking-wide border border-emerald-500/30 mb-1">
                <Store className="h-3.5 w-3.5" /> Partner Garage
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                {profile?.name || 'Your Garage'}
              </h1>
              {profile?.city && <p className="text-slate-400 text-sm font-medium mt-0.5">{profile.city}</p>}
            </div>
          </div>

          {/* Smart Availability Button */}
          <Link
            to="/garage-availability"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold rounded-xl transition-colors border border-indigo-500/30 text-sm shadow-sm"
          >
            <Clock className="h-4 w-4" />
            Smart Availability
          </Link>
        </div>

        {/* Stats - Responsive 3-col tight row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-4 text-center sm:text-left">
              <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl ${s.bg} flex items-center justify-center mx-auto sm:mx-0 mb-1.5 sm:mb-3`}>{s.icon}</div>
              <div className="font-metric text-metric-lg text-white">{s.value}</div>
              <div className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-0.5 truncate">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardHero;
