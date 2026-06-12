import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

const AdminLayout = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear();
        window.location.replace('/');
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <AdminSidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col relative">
                {/* Subtle background decorations — matching landing page orbs */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-30 pointer-events-none transform translate-x-1/3 -translate-y-1/3" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 68%)' }}></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-30 pointer-events-none transform -translate-x-1/4 translate-y-1/4" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 68%)' }}></div>

                <main className="flex-1 overflow-y-auto w-full z-10 p-4 sm:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
