import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Car, Wrench, LogOut, PieChart, Store, Building2 } from 'lucide-react';

function normalizeRole(role) {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
    if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
    return role || 'USER';
}

const Sidebar = ({ onLogout }) => {
    const location = useLocation();

    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const role = normalizeRole(user?.role);

    const userNavigation = [
        { name: 'Dashboard', href: '/user-dashboard', icon: LayoutDashboard },
        { name: 'Marketplace', href: '/marketplace', icon: Store },
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

    return (
        <div className="flex flex-col w-64 bg-white border-r border-slate-200 h-full shadow-sm z-20 transition-all duration-300">
            <div className="flex items-center justify-center p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 w-full px-2">
                    <div className="h-10 w-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                        <Car className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-slate-900 font-extrabold text-lg tracking-tight hidden sm:block truncate">
                        Drivix
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/50'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <Icon
                                className={`flex-shrink-0 h-5 w-5 mr-3 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'
                                    }`}
                            />
                            {item.name}
                        </Link>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <button
                    onClick={onLogout}
                    className="flex items-center w-full px-4 py-3 text-sm font-semibold text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors border border-transparent"
                >
                    <LogOut className="flex-shrink-0 h-5 w-5 mr-3 text-slate-400 group-hover:text-red-500" />
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
