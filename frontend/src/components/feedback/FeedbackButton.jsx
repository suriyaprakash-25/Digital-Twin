import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import FeedbackModal from './FeedbackModal';
import { FEATURES } from '../../config/features';

const ROUTE_NAME_MAP = {
  '/': 'Home / Landing Page',
  '/user-dashboard': 'User Dashboard',
  '/dashboard': 'Vehicle Dashboard',
  '/garage-dashboard': 'Garage Dashboard',
  '/marketplace': 'Marketplace',
  '/my-profile': 'My Profile',
  '/my-vehicles': 'My Vehicles',
  '/add-vehicle': 'Add Vehicle',
  '/add-service': 'Add Service Record',
  '/analytics': 'Analytics',
  '/vehicle-doctor': 'AI Vehicle Doctor',
  '/vehicle-doctor/history': 'Diagnosis History',
  '/garage-profile': 'Garage Profile',
  '/garage-services': 'Garage Services',
  '/garage-services-history': 'Garage Service History',
  '/garage-availability': 'Garage Availability',
  '/garage-portal': 'Garage Portal',
  '/garage/reviews': 'Garage Reviews',
  '/fleets': 'Fleet Management',
  '/garage-partners': 'Garage Partners',
  '/partner-support': 'Partner Support',
  '/help-faq': 'Help & FAQs',
  '/admin': 'Admin Dashboard',
  '/admin/users': 'Admin Users',
  '/admin/garages': 'Admin Garages',
  '/admin/analytics': 'Admin Analytics',
  '/admin/revenue': 'Admin Revenue',
  '/admin/feedback': 'Admin Feedback'
};

function getPageName(pathname) {
  if (ROUTE_NAME_MAP[pathname]) {
    return ROUTE_NAME_MAP[pathname];
  }
  if (pathname.startsWith('/passport/')) return 'Vehicle Passport';
  if (pathname.startsWith('/garages/')) return 'Garage Details';
  if (pathname.startsWith('/edit-vehicle/')) return 'Edit Vehicle';
  if (pathname.startsWith('/service-history/')) return 'Service History';
  if (pathname.startsWith('/resale-report/')) return 'Resale Report';
  if (pathname.startsWith('/insurance/')) return 'Insurance';
  if (pathname.startsWith('/transfer/')) return 'Transfer Ownership';

  // Fallback: derive title from path
  const clean = pathname.replace(/^\//, '').replace(/-/g, ' ');
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'DrivePortz App';
}

const FeedbackButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // If feature flag is off, do not render
  if (!FEATURES.FEEDBACK) {
    return null;
  }

  const currentPage = useMemo(() => ({
    pageUrl: location.pathname,
    pageName: getPageName(location.pathname)
  }), [location.pathname]);

  return (
    <>
      {/* Desktop Floating Tab (Right Edge, Vertically Centered) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open feedback form"
        className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-slate-900 hover:bg-teal-600 text-white py-3 px-2 rounded-l-2xl shadow-xl shadow-slate-950/20 items-center gap-1.5 transition-all duration-200 hover:pr-3 cursor-pointer group border-y border-l border-white/10"
        title="Share your feedback"
      >
        <MessageSquarePlus className="h-4 w-4 text-teal-400 group-hover:text-white transition-colors" />
        <span
          className="text-xs font-bold tracking-wide uppercase text-[10px]"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          Feedback
        </span>
      </button>

      {/* Mobile Floating Action Button (Bottom-Right, positioned above mobile bars) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open feedback form"
        className="flex md:hidden fixed right-4 bottom-24 z-40 bg-slate-900 hover:bg-teal-600 active:scale-95 text-white p-3.5 rounded-full shadow-xl shadow-slate-950/30 items-center justify-center transition-all duration-200 cursor-pointer border border-white/15"
        title="Share your feedback"
      >
        <MessageSquarePlus className="h-5 w-5 text-teal-400" />
      </button>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentPage={currentPage}
      />
    </>
  );
};

export default FeedbackButton;
