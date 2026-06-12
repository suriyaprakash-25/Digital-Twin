import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Building2,
    BarChart3,
    IndianRupee,
    LogOut
} from 'lucide-react';

const adminNavigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Garages', href: '/admin/garages', icon: Building2 },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Revenue Reports', href: '/admin/revenue', icon: IndianRupee },
];

const AdminSidebar = ({ onLogout }) => {
    const location = useLocation();

    return (
        <div className="flex flex-col w-64 bg-white h-full border-r border-slate-200 z-20 transition-all duration-300">
            {/* Header */}
            <div className="flex items-center gap-3 p-6 border-b border-slate-100">
                <img
                    src="/logo.jpeg"
                    alt="Driveportz Logo"
                    className="w-10 h-10 rounded-xl object-cover shadow-md shrink-0"
                />
                <div className="hidden sm:block">
                    <span className="text-slate-900 font-extrabold text-lg tracking-tight block leading-tight">
                        Drive<span className="text-teal-600">portz</span>
                    </span>
                    <span className="text-teal-600 text-[11px] font-semibold uppercase tracking-widest">
                        Admin Panel
                    </span>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                {adminNavigation.map((item) => {
                    const isActive =
                        item.href === '/admin'
                            ? location.pathname === '/admin'
                            : location.pathname.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-teal-50 text-teal-700 shadow-sm border border-teal-200/60'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                        >
                            <Icon
                                className={`flex-shrink-0 h-5 w-5 mr-3 transition-colors ${isActive
                                    ? 'text-teal-600'
                                    : 'text-slate-400 group-hover:text-teal-500'
                                    }`}
                            />
                            {item.name}
                            {isActive && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500 shadow-sm shadow-teal-400/50"></div>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Logout */}
            <div className="p-3 border-t border-slate-100">
                <button
                    onClick={onLogout}
                    className="flex items-center w-full px-4 py-3 text-sm font-semibold text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all duration-200"
                >
                    <LogOut className="flex-shrink-0 h-5 w-5 mr-3" />
                    Logout
                </button>
            </div>
        </div>
    );
};

export default AdminSidebar;
