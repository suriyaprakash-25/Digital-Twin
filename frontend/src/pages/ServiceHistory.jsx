import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { History, Wrench, IndianRupee, ArrowLeft } from 'lucide-react';
import PaymentSuccessModal from '../components/payment/PaymentSuccessModal';
import InvoiceModal from '../components/invoice/InvoiceModal';
import ReceiptModal from '../components/invoice/ReceiptModal';
import ServiceRecordCard from '../components/service/ServiceRecordCard';
import PhotoLightbox from '../components/service/PhotoLightbox';
import ErrorState from '../components/common/ErrorState';
import { useToast } from '../context/toastContextCore';
import { useAuth } from '../context/authContextCore';
import { apiDelete, apiGet, getErrorMessage } from '../utils/api';
import { ROLES } from '../utils/roles';
import { useAsync } from '../hooks/useAsync';

const EMPTY_HISTORY = { vehicle: null, services: [] };

/** Marks the paid service as PAID after a successful checkout. */
const markServicePaid = (services, payment) => services.map((s) => (
    (s.id === (payment.serviceId || payment.invoiceId) || String(s._id) === String(payment.serviceId))
        ? { ...s, paymentStatus: 'PAID', paidAt: payment.paidAt, paymentId: payment.paymentId }
        : s
));

const ServiceHistory = () => {
    const { vehicleId } = useParams();
    const { showToast } = useToast();
    const { role } = useAuth();
    const isGarage = role === ROLES.GARAGE;
    const [expandedService, setExpandedService] = useState(null);
    const [lightboxUrl, setLightboxUrl] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [successPaymentDetails, setSuccessPaymentDetails] = useState(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [selectedReceiptId, setSelectedReceiptId] = useState(null);

    const { data, error, loading, refetch, setData } = useAsync(async () => {
        const vehicle = await apiGet(`/vehicles/${vehicleId}`);
        const services = await apiGet(`/services/${vehicleId}`);
        return { vehicle, services: Array.isArray(services) ? services : [] };
    }, [vehicleId], { initialData: EMPTY_HISTORY });

    const { vehicle, services } = data || EMPTY_HISTORY;
    const setServices = (updater) => setData((prev) => ({ ...(prev || EMPTY_HISTORY), services: updater((prev || EMPTY_HISTORY).services) }));

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleDeleteService = async (serviceId) => {
        setActiveMenuId(null);
        if (!window.confirm('Are you sure you want to delete this service record? This action cannot be undone.')) {
            return;
        }

        try {
            await apiDelete(`/services/${serviceId}`);
            setServices((prev) => prev.filter((s) => s.id !== serviceId));
        } catch (err) {
            console.error('Error deleting service:', err);
            showToast(getErrorMessage(err, 'Failed to delete service record. Please try again.'), 'error');
        }
    };

    const handlePaymentSuccess = (payment) => {
        setServices((prev) => markServicePaid(prev, payment));
        setSuccessPaymentDetails(payment);
    };

    const totalExpense = services.reduce((sum, service) => sum + (parseFloat(service.totalCost) || 0), 0);

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 lg:pb-8">
            <Link
                to={isGarage ? "/garage-dashboard" : "/my-vehicles"}
                className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-teal-600 mb-6 transition-colors bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm hover:shadow-md"
            >
                <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                {isGarage ? "Back to Dashboard" : "Back to Fleet"}
            </Link>

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-10 gap-4 bg-white border border-slate-100 p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                    <History className="h-64 w-64 text-slate-900" aria-hidden="true" />
                </div>

                <div className="relative z-10">
                    <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 mb-2">
                        Production Service History
                    </h1>
                    {vehicle && (
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            <p className="text-teal-700 font-bold bg-teal-50 inline-block px-3 py-1.5 rounded-full border border-teal-100 text-xs md:text-sm shadow-sm">
                                {vehicle.brand} {vehicle.model} • <span className="font-mono">{vehicle.vehicleNumber}</span>
                            </p>
                            {services.length > 0 && (
                                <p className="text-emerald-700 font-bold bg-emerald-50 inline-flex items-center px-3 py-1.5 rounded-full border border-emerald-100 text-xs md:text-sm shadow-sm whitespace-nowrap">
                                    Total Expense: <IndianRupee className="h-3.5 w-3.5 ml-1 mr-0.5 shrink-0" aria-hidden="true" />
                                    {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {error && (
                <ErrorState className="mb-6" title="Could not load service history" message={error} onRetry={() => refetch()} retrying={loading} />
            )}

            {loading ? (
                <div role="status" aria-label="Loading service history" className="flex justify-center items-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-500"></div>
                </div>
            ) : error ? null : services.length === 0 ? (
                <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-16 text-center shadow-sm">
                    <div className="mx-auto h-24 w-24 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mb-6 shadow-sm">
                        <Wrench className="h-12 w-12 text-amber-400" aria-hidden="true" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-3">No Operational Records</h3>
                    <p className="text-slate-500 max-w-md mx-auto font-medium text-lg">
                        There are no production-grade service maintenance logs for this vehicle. When a partner garage performs service, the records will appear here on your timeline.
                    </p>
                </div>
            ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-10 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {services.map((service) => (
                        <ServiceRecordCard
                            key={service.id}
                            service={service}
                            vehicle={vehicle}
                            isGarage={isGarage}
                            isExpanded={expandedService === service.id}
                            onToggleExpand={() => setExpandedService((current) => (current === service.id ? null : service.id))}
                            menuOpen={activeMenuId === service.id}
                            onToggleMenu={() => setActiveMenuId((current) => (current === service.id ? null : service.id))}
                            onDelete={() => handleDeleteService(service.id)}
                            onViewInvoice={setSelectedInvoiceId}
                            onViewReceipt={setSelectedReceiptId}
                            onOpenPhoto={setLightboxUrl}
                            onPaymentSuccess={handlePaymentSuccess}
                        />
                    ))}
                </div>
            )}

            <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

            {/* Payment Success Modal */}
            <PaymentSuccessModal
                isOpen={Boolean(successPaymentDetails)}
                onClose={() => setSuccessPaymentDetails(null)}
                paymentDetails={successPaymentDetails}
                onViewBill={() => {
                    if (successPaymentDetails?.serviceId) {
                        setSelectedInvoiceId(successPaymentDetails.serviceId);
                    }
                }}
            />

            {/* Tax Invoice Modal */}
            {selectedInvoiceId && (
                <InvoiceModal
                    isOpen={Boolean(selectedInvoiceId)}
                    onClose={() => setSelectedInvoiceId(null)}
                    serviceId={selectedInvoiceId}
                    onPaymentSuccess={handlePaymentSuccess}
                    onViewReceipt={(inv) => setSelectedReceiptId(inv.id || inv._id)}
                />
            )}

            {/* Payment Receipt Modal */}
            {selectedReceiptId && (
                <ReceiptModal
                    isOpen={Boolean(selectedReceiptId)}
                    onClose={() => setSelectedReceiptId(null)}
                    serviceId={selectedReceiptId}
                />
            )}
        </div>
    );
};

export default ServiceHistory;
