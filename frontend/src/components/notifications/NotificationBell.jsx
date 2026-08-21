import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Bell, 
    Check, 
    CheckCheck, 
    CreditCard, 
    RotateCcw, 
    AlertCircle, 
    FileText, 
    Clock,
    X
} from 'lucide-react';
import { apiGet, apiPatch } from '../../utils/api';

const NotificationBell = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotifications = async () => {
        try {
            const [listRes, countRes] = await Promise.allSettled([
                apiGet('/notifications?limit=15'),
                apiGet('/notifications/unread-count')
            ]);

            if (listRes.status === 'fulfilled' && Array.isArray(listRes.value)) {
                setNotifications(listRes.value);
            }
            if (countRes.status === 'fulfilled' && countRes.value?.success) {
                setUnreadCount(countRes.value.count || 0);
            }
        } catch (err) {
            // Non-blocking
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 20000); // 20s poll
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleMarkAllRead = async () => {
        try {
            await apiPatch('/notifications/read-all');
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error('Error marking notifications read:', err);
        }
    };

    const handleNotificationClick = async (notif) => {
        if (!notif.read) {
            try {
                await apiPatch(`/notifications/${notif.id}/read`);
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (err) {
                console.warn('Error marking notification read:', err);
            }
        }

        setIsOpen(false);

        // Navigation intelligence based on notification type
        const type = notif.data?.type || '';
        const role = localStorage.getItem('role') || 'USER';

        if (type.startsWith('REFUND') || type.startsWith('PAYMENT')) {
            if (role === 'GARAGE') {
                navigate('/garage/payments');
            } else {
                navigate('/payment-history');
            }
        } else if (type === 'INVOICE_CREATED' || type === 'INVOICE_FINALIZED') {
            if (notif.data?.vehicleId) {
                navigate(`/service-history/${notif.data.vehicleId}`);
            } else if (role === 'GARAGE') {
                navigate('/garage-services-history');
            } else {
                navigate('/payment-history');
            }
        }
    };

    const getIconForType = (type) => {
        if (type === 'PAYMENT_SUCCESS') {
            return <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><CreditCard className="h-4 w-4" /></div>;
        } else if (type === 'PAYMENT_FAILED') {
            return <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"><AlertCircle className="h-4 w-4" /></div>;
        } else if (type?.startsWith('REFUND')) {
            return <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0"><RotateCcw className="h-4 w-4" /></div>;
        }
        return <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0"><FileText className="h-4 w-4" /></div>;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Trigger Button */}
            <button
                type="button"
                onClick={() => {
                    setIsOpen(prev => !prev);
                    if (!isOpen) fetchNotifications();
                }}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-teal-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 py-3 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllRead}
                                className="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                            <div className="py-10 text-center text-slate-400">
                                <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                                <p className="text-xs font-bold">No notifications yet</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">We'll alert you when payment or service updates arrive.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${
                                        !notif.read ? 'bg-teal-50/30' : ''
                                    }`}
                                >
                                    {getIconForType(notif.data?.type)}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                            <h4 className={`text-xs truncate ${!notif.read ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                                                {notif.title}
                                            </h4>
                                            {!notif.read && (
                                                <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                                            {notif.body}
                                        </p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : ''}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
