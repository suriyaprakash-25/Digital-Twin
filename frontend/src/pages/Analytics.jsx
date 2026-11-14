import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { apiGet } from '../utils/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/authContextCore';
import { ROLES } from '../utils/roles';
import ErrorState from '../components/common/ErrorState';
import GarageAnalyticsView from '../components/analytics/GarageAnalyticsView';
import OwnerAnalyticsView from '../components/analytics/OwnerAnalyticsView';

const MOBILE_QUERY_WIDTH = 640;

/** Tracks the small-screen breakpoint used to size the charts. */
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_QUERY_WIDTH);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_QUERY_WIDTH);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
}

const EmptyAnalytics = ({ message }) => (
    <div className="text-center py-12 px-4">
        <Activity className="h-10 w-10 md:h-16 md:w-16 text-slate-300 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-base md:text-xl font-bold text-slate-900 mb-1">Analytics Unavailable</h3>
        <p className="text-2xs md:text-sm text-slate-500 font-medium max-w-sm mx-auto">{message}</p>
    </div>
);

const Analytics = () => {
    const { role } = useAuth();
    const isGarage = role === ROLES.GARAGE;
    const [dateRange, setDateRange] = useState('all');
    const isMobile = useIsMobile();
    const yAxisWidth = isMobile ? 80 : 150;

    const { data, error, loading, refetch } = useAsync(
        () => (isGarage ? apiGet('/analytics/garage', { days: dateRange }) : apiGet('/analytics')),
        [dateRange, isGarage]
    );

    if (loading) {
        return (
            <div role="status" aria-label="Loading analytics" className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <ErrorState title="Could not load analytics" message={error} onRetry={() => refetch()} />
            </div>
        );
    }

    if (isGarage) {
        if (!data) return <EmptyAnalytics message="Complete your garage profile and start accepting bookings to see analytics." />;
        return (
            <GarageAnalyticsView
                garageData={data}
                isMobile={isMobile}
                yAxisWidth={yAxisWidth}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
            />
        );
    }

    if (!data) return <EmptyAnalytics message="Add vehicles and service records to generate insights." />;
    return <OwnerAnalyticsView data={data} isMobile={isMobile} yAxisWidth={yAxisWidth} />;
};

export default Analytics;
