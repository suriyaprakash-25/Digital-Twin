import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AdminSidebar from './AdminSidebar';
import { Menu, LogOut } from 'lucide-react';

const AdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        localStorage.clear();
        window.location.replace('/');
    };

    // Close sidebar when viewport grows to desktop
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const handler = (e) => { if (e.matches) setSidebarOpen(false); };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <AdminSidebar
                onLogout={handleLogout}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col relative min-w-0">
                {/* Background decorations */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-30 pointer-events-none transform translate-x-1/3 -translate-y-1/3"
                    style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 68%)' }} />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-30 pointer-events-none transform -translate-x-1/4 translate-y-1/4"
                    style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 68%)' }} />

                {/* Mobile top bar */}
                <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200 z-20 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            aria-label="Open menu"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <div className="flex items-center gap-2.5">
                            <img src="/logo-removebg-preview.png" alt="Driveportz" className="h-8 w-8 rounded-lg object-cover shadow-sm" />
                            <div>
                                <span className="font-extrabold text-slate-900 text-sm tracking-tight">Driveportz</span>
                                <span className="block text-[10px] font-semibold text-teal-600 uppercase tracking-widest">Admin Panel</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors border border-slate-100/80 bg-slate-50/50"
                        aria-label="Logout"
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="text-xs font-bold">Logout</span>
                    </button>
                </div>

                <main className="flex-1 overflow-y-auto w-full z-10 p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
