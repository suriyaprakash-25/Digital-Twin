import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

const MainLayout = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col relative">
                {/* Subtle background decoration */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-50 rounded-full blur-[100px] opacity-60 pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-indigo-50 rounded-full blur-[100px] opacity-60 pointer-events-none transform -translate-y-1/2"></div>

                <main className="flex-1 overflow-y-auto w-full z-10 p-4 sm:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
