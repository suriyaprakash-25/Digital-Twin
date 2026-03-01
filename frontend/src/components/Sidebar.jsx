import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Car, Wrench, LogOut, ShieldCheck, PieChart } from 'lucide-react';

const Sidebar = ({ onLogout }) => {
    const location = useLocation();

    const navigation = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Add Vehicle', href: '/add-vehicle', icon: PlusCircle },
        { name: 'My Vehicles', href: '/my-vehicles', icon: Car },
        { name: 'Add Service', href: '/add-service', icon: Wrench },
        { name: 'Garage Portal', href: '/garage-portal', icon: ShieldCheck },
        { name: 'Analytics', href: '/analytics', icon: PieChart },
    ];

    return (
        <div className="flex flex-col w-64 bg-white border-r border-slate-200 h-full shadow-sm z-20 transition-all duration-300">
            <div className="flex items-center justify-center p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 w-full px-2">
                    <div className="h-10 w-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                        <Car className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-slate-900 font-extrabold text-lg tracking-tight hidden sm:block truncate">
                        Mobility DT
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
