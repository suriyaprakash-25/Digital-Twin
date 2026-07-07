import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { tryRegisterFcmToken } from '../utils/fcm';
import { Menu, LogOut } from 'lucide-react';
import Copilot from './copilot/Copilot';

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
                <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white/90 backdrop-blur-md border-b border-slate-200 z-20 shadow-sm">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu className="h-5.5 w-5.5" />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors border border-slate-100/80 bg-slate-50/50"
                        aria-label="Logout"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold">Logout</span>
                    </button>
                </div>

                <div className="flex-1 overflow-auto relative">
                    <div className="mx-auto h-full p-3 md:p-6 lg:p-8">
                        <Outlet />
                    </div>
                </div>

            </div>

            {/* AI Assistant CoPilot */}
            <Copilot />
        </div>
    );
};

export default MainLayout;
