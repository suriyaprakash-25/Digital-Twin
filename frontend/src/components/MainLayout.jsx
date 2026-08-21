import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { tryRegisterFcmToken } from '../utils/fcm';
import { Menu, LogOut } from 'lucide-react';
import Copilot from './copilot/Copilot';
import FeedbackButton from './feedback/FeedbackButton';
import NotificationBell from './notifications/NotificationBell';

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

                {/* Top bar (Desktop & Mobile) */}
                <div className="flex items-center justify-between h-16 px-4 lg:px-8 bg-white/80 backdrop-blur-md border-b border-slate-200/80 z-20 shadow-2xs">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            aria-label="Open menu"
                        >
                            <Menu className="h-5.5 w-5.5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2.5 ml-auto">
                        <NotificationBell />
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors border border-slate-200/60 bg-white shadow-2xs"
                            aria-label="Logout"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            <span className="text-xs font-bold hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto relative">
                    <div className="mx-auto h-full p-3 md:p-6 lg:p-8">
                        <Outlet />
                    </div>
                </div>

            </div>

            {/* AI Assistant CoPilot */}
            <Copilot />

            {/* Global Feedback Button */}
            <FeedbackButton />
        </div>
    );
};

export default MainLayout;
