import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import { tryRegisterFcmToken } from '../utils/fcm';
import { Menu, LogOut } from 'lucide-react';

const MainLayout = () => {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const authToken = localStorage.getItem('token');
        if (!authToken) return;
        tryRegisterFcmToken({ authToken, requestPermission: false }).catch(() => {});
    }, []);

    // Close sidebar when viewport grows to desktop
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const handler = (e) => { if (e.matches) setSidebarOpen(false); };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        window.location.replace('/');
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Sidebar
                onLogout={handleLogout}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col relative min-w-0">
                {/* Decorative blobs */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-50 rounded-full blur-[100px] opacity-60 pointer-events-none transform translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-teal-50 rounded-full blur-[100px] opacity-60 pointer-events-none transform -translate-y-1/2" />

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
                            <img src="/logo.jpeg" alt="Driveportz" className="h-8 w-8 rounded-lg object-cover shadow-sm" />
                            <span className="font-extrabold text-slate-900 text-base tracking-tight">Driveportz</span>
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

                <main className="flex-1 overflow-y-auto w-full z-10 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
                    <Outlet />
                </main>

                {/* Mobile bottom navigation */}
                <MobileBottomNav />
            </div>
        </div>
    );
};

export default MainLayout;
