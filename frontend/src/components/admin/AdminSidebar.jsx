import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Building2,
    BarChart3,
    IndianRupee,
    LogOut,
    X
} from 'lucide-react';

const adminNavigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Garages', href: '/admin/garages', icon: Building2 },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Revenue Reports', href: '/admin/revenue', icon: IndianRupee },
];

const AdminSidebar = ({ onLogout, isOpen, onClose }) => {
    const location = useLocation();

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
                    flex flex-col w-72 lg:w-64 bg-white h-full border-r border-slate-200 z-40
                    fixed lg:static top-0 left-0
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <img
                            src="/logo.jpeg"
                            alt="Driveportz Logo"
                            className="w-10 h-10 rounded-xl object-cover shadow-md shrink-0"
                        />
                        <div className="min-w-0">
                            <span className="text-slate-900 font-extrabold text-lg tracking-tight block leading-tight truncate">
                                Drive<span className="text-teal-600">portz</span>
                            </span>
                            <span className="text-teal-600 text-[11px] font-semibold uppercase tracking-widest">
                                Admin Panel
                            </span>
                        </div>
                    </div>
                    {/* Close button (mobile only) */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                        aria-label="Close menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
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
                                onClick={handleNavClick}
                                className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                                    isActive
                                        ? 'bg-teal-50 text-teal-700 shadow-sm border border-teal-200/60'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                            >
                                <Icon
                                    className={`flex-shrink-0 h-5 w-5 mr-3 transition-colors ${
                                        isActive
                                            ? 'text-teal-600'
                                            : 'text-slate-400 group-hover:text-teal-500'
                                    }`}
                                />
                                {item.name}
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-500 shadow-sm shadow-teal-400/50" />
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
        </>
    );
};

export default AdminSidebar;
