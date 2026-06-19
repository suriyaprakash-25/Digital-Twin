import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, Store, UserCircle2 } from 'lucide-react';

function normalizeRole(role) {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
    return 'USER';
}

const MobileBottomNav = () => {
    const location = useLocation();
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const role = normalizeRole(user?.role);

    const tabs = role === 'GARAGE'
        ? [
            { name: 'Dashboard', href: '/garage-dashboard', icon: LayoutDashboard },
            { name: 'Marketplace', href: '/marketplace', icon: Store },
            { name: 'Profile', href: '/garage-profile', icon: UserCircle2 },
        ]
        : [
            { name: 'Dashboard', href: '/user-dashboard', icon: LayoutDashboard },
            { name: 'Vehicles', href: '/my-vehicles', icon: Car },
            { name: 'Marketplace', href: '/marketplace', icon: Store },
            { name: 'Profile', href: '/my-profile', icon: UserCircle2 },
        ];

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-stretch">
                {tabs.map((tab) => {
                    const isActive = location.pathname === tab.href;
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.name}
                            to={tab.href}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors duration-200 ${
                                isActive
                                    ? 'text-teal-600'
                                    : 'text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-teal-50' : ''}`}>
                                <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                                {isActive && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-500" />
                                )}
                            </div>
                            <span>{tab.name}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
