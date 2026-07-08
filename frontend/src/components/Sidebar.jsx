import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Car, Wrench, LogOut, PieChart, Store, Building2, UserCircle2, X, Stethoscope } from 'lucide-react';

function normalizeRole(role) {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
    if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
    if (r === 'admin' || r === 'administrator') return 'ADMIN';
    return role || 'USER';
}

const Sidebar = ({ onLogout, isOpen, onClose }) => {
    const location = useLocation();

    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const role = normalizeRole(user?.role);

    const dashboardHref = role === 'GARAGE' ? '/garage-dashboard' : '/user-dashboard';

    const userNavigation = [
        { name: 'Dashboard', href: '/user-dashboard', icon: LayoutDashboard },
        { name: 'My Profile', href: '/my-profile', icon: UserCircle2 },
        { name: 'Garages', href: '/marketplace', icon: Store },
        { name: 'AI Doctor', href: '/vehicle-doctor', icon: Stethoscope },
        { name: 'Add Vehicle', href: '/add-vehicle', icon: PlusCircle },
        { name: 'My Vehicles', href: '/my-vehicles', icon: Car },
        { name: 'Add Service', href: '/add-service', icon: Wrench },
        { name: 'Analytics', href: '/analytics', icon: PieChart },
    ];

    const garageNavigation = [
        { name: 'Dashboard', href: '/garage-dashboard', icon: LayoutDashboard },
        { name: 'Garage Profile', href: '/garage-profile', icon: Building2 },
        { name: 'Your Services', href: '/garage-services', icon: Wrench },
        { name: 'Analytics', href: '/analytics', icon: PieChart },
    ];

    const navigation = role === 'GARAGE' ? garageNavigation : userNavigation;

    const handleNavClick = () => {
        if (onClose) onClose();
    };

    return (
        <>
            {/* Mobile overlay backdrop */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar panel */}
            <div
                className={`
                    flex flex-col w-72 lg:w-64 bg-white border-r border-slate-200 h-full shadow-sm z-40
                    fixed lg:static top-0 left-0
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Header */}
                <div className="relative flex items-center justify-center p-5 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
                    <Link
                        to={dashboardHref}
                        onClick={handleNavClick}
                        aria-label="Go to dashboard"
                        className="flex items-center justify-center rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 px-1"
                    >
                        <img
                            src="/logo-removebg-preview.png"
                            alt="Driveportz logo"
                            style={{ height: '72px' }}
                            className="shrink-0"
                        />
                    </Link>
                    {/* Close button (mobile only) */}
                    <button
                        onClick={onClose}
                        className="absolute right-5 lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Close menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={handleNavClick}
                                className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    isActive
                                        ? 'bg-teal-50 text-teal-700 shadow-sm shadow-teal-100/50'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                <Icon
                                    className={`flex-shrink-0 h-5 w-5 mr-3 transition-colors ${
                                        isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-500'
                                    }`}
                                />
                                {item.name}
                                {isActive && (
                                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500 shadow-sm shadow-teal-400/50" />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Logout */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={onLogout}
                        className="flex items-center w-full px-4 py-3 text-sm font-semibold text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors border border-transparent"
                    >
                        <LogOut className="flex-shrink-0 h-5 w-5 mr-3 text-slate-400" />
                        Logout
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
