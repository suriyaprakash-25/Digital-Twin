import { API_BASE_URL } from '../utils/config';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { History, Wrench, Calendar, Hash, IndianRupee, ArrowLeft, Car, ShieldAlert, Building, CheckCircle, AlertTriangle, FileText, ChevronDown, ChevronUp, Receipt, X, ZoomIn, MoreVertical, Trash2, CreditCard } from 'lucide-react';
import PaymentButton from '../components/payment/PaymentButton';
import PaymentSuccessModal from '../components/payment/PaymentSuccessModal';
import InvoiceModal from '../components/invoice/InvoiceModal';
import ReceiptModal from '../components/invoice/ReceiptModal';

const ServiceHistory = () => {
    const { vehicleId } = useParams();
    const [services, setServices] = useState([]);
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedService, setExpandedService] = useState(null);
    const [lightboxUrl, setLightboxUrl] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [successPaymentDetails, setSuccessPaymentDetails] = useState(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [selectedReceiptId, setSelectedReceiptId] = useState(null);

    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const isGarage = user && (user.role === 'GARAGE' || user.role === 'garage' || user.role === 'service_center' || user.role === 'servicecenter');

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem('token');

                // Fetch vehicle directly by ID
                const vRes = await axios.get(`${API_BASE_URL}/api/vehicles/${vehicleId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setVehicle(vRes.data);

                // Fetch services for this vehicle
                const sRes = await axios.get(`${API_BASE_URL}/api/services/${vehicleId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setServices(sRes.data);
            } catch (err) {
                console.error('Error fetching service history:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [vehicleId]);

    const toggleExpand = (id) => {
        setExpandedService(expandedService === id ? null : id);
    };

    const handleDeleteService = async (serviceId) => {
        if (!window.confirm('Are you sure you want to delete this service record? This action cannot be undone.')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/services/${serviceId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Update UI by filtering out the deleted service
            setServices(services.filter(s => s.id !== serviceId));
        } catch (err) {
            console.error('Error deleting service:', err);
            alert('Failed to delete service record. Please try again.');
        }
    };

    const totalExpense = services.reduce((sum, service) => sum + (parseFloat(service.totalCost) || 0), 0);

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 lg:pb-8">
            <Link
                to={isGarage ? "/garage-dashboard" : "/my-vehicles"}
                className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-teal-600 mb-6 transition-colors bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm hover:shadow-md"
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {isGarage ? "Back to Dashboard" : "Back to Fleet"}
            </Link>

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-10 gap-4 bg-white border border-slate-100 p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                    <History className="h-64 w-64 text-slate-900" />
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
                                    Total Expense: <IndianRupee className="h-3.5 w-3.5 ml-1 mr-0.5 shrink-0" />
                                    {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-500"></div>
                </div>
            ) : services.length === 0 ? (
                <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-16 text-center shadow-sm">
                    <div className="mx-auto h-24 w-24 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mb-6 shadow-sm">
                        <Wrench className="h-12 w-12 text-amber-400" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-3">No Operational Records</h3>
                    <p className="text-slate-500 max-w-md mx-auto font-medium text-lg">
                        There are no production-grade service maintenance logs for this vehicle. When a partner garage performs service, the records will appear here on your timeline.
                    </p>
                </div>
            ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-10 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {services.map((service, idx) => {
                        const isExpanded = expandedService === service.id;
                        return (
                            <div
                                key={service.id}
                                className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                            >
                                {/* Timeline Center Dot */}
                                <div className="flex items-center justify-center w-20 h-20 rounded-full shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl bg-white border-4 border-slate-50 z-10 transition-transform duration-300">
                                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm">
                                        <Wrench className="h-6 w-6" />
                                    </div>
                                </div>                                 {/* Card Container */}
                                <div className="w-[calc(100%-6rem)] md:w-[calc(50%-4rem)] bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">

                                    {/* Data Integrity Warning Tab */}
                                    {service.abnormalKmJump && (
                                        <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center gap-2">
                                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                            <span className="text-[10px] md:text-xs font-bold text-red-700">Data Integrity Flag: Abnormal Odometer Jump Detected</span>
                                        </div>
                                    )}

                                    <div className="p-4 md:p-6 cursor-pointer" onClick={() => toggleExpand(service.id)}>
                                        <div className="flex flex-col xl:flex-row justify-between xl:items-start mb-4 gap-2">
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                    <span className="text-[10px] md:text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border border-amber-100 uppercase tracking-wide">
                                                        {service.serviceCategory}
                                                    </span>
                                                    {service.verifiedService && (
                                                        <span className="flex items-center text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border border-emerald-100">
                                                            <CheckCircle className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" /> Verified
                                                        </span>
                                                    )}
                                                    {service.paymentStatus === 'PAID' ? (
                                                        <span className="flex items-center text-[10px] md:text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border border-emerald-200">
                                                            <CheckCircle className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 text-emerald-600" /> PAID ✓
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center text-[10px] md:text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md border border-amber-200">
                                                            UNPAID
                                                        </span>
                                                    )}
                                                    {service.invoiceNumber && (
                                                        <span className="font-mono text-[10px] md:text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            {service.invoiceNumber}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-base md:text-xl font-extrabold text-slate-900 group-hover:text-teal-600 transition-colors tracking-tight mt-1">
                                                    {/^\d+$/.test(String(service.serviceType || '').trim())
                                                        ? `Periodic Service (${Number(service.serviceType).toLocaleString()} km)`
                                                        : service.serviceType || 'General Maintenance'}
                                                </h3>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 relative">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs md:text-sm font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap self-start border border-slate-200 shadow-sm">
                                                        {new Date(service.serviceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    
                                                    {/* 3-Dot Menu Button */}
                                                    {isGarage && (
                                                        <>
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuId(activeMenuId === service.id ? null : service.id);
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors self-start"
                                                            >
                                                                <MoreVertical className="h-5 w-5" />
                                                            </button>

                                                            {/* Dropdown Menu */}
                                                            {activeMenuId === service.id && (
                                                                <div className="absolute top-10 right-0 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveMenuId(null);
                                                                            handleDeleteService(service.id);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                        Delete Record
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-x-6 gap-y-4 mb-5">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                    <Hash className="h-4 w-4 text-slate-500" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{Number(service.odometerKm).toLocaleString()} km</span>
                                            </div>
                                            {service.garageName && (
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                        <Building className="h-4 w-4 text-slate-500" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{service.garageName}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="text-slate-400 font-bold flex items-center gap-1.5 text-xs md:text-sm hover:text-slate-600 transition-colors">
                                                    {isExpanded ? <><ChevronUp className="h-4 w-4" /> Hide Details</> : <><ChevronDown className="h-4 w-4" /> View Full Report</>}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedInvoiceId(service.id || service._id); }}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all shadow-2xs"
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    View Bill / Invoice
                                                </button>
                                                {service.paymentStatus === 'PAID' && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedReceiptId(service.id || service._id); }}
                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all shadow-2xs"
                                                    >
                                                        <Receipt className="h-3.5 w-3.5" />
                                                        Receipt
                                                    </button>
                                                )}
                                                {service.billPhotoUrls && service.billPhotoUrls.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setLightboxUrl(service.billPhotoUrls[0]); }}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all"
                                                    >
                                                        Attached Photos ({service.billPhotoUrls.length})
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 ml-auto flex-wrap">
                                                <div className="text-right shrink-0">
                                                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Total Cost</span>
                                                    <span className="text-lg md:text-2xl font-black text-slate-900 flex items-center tracking-tight">
                                                        <IndianRupee className="h-4 w-4 md:h-5 md:w-5 mr-0.5 text-slate-400" />
                                                        {(parseFloat(service.totalCost) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                {!isGarage && (
                                                    <PaymentButton
                                                        service={service}
                                                        vehicle={vehicle}
                                                        onPaymentSuccess={(payment) => {
                                                            setServices(prev => prev.map(s => (s.id === (payment.serviceId || payment.invoiceId) || String(s._id) === String(payment.serviceId)) ? { ...s, paymentStatus: 'PAID', paidAt: payment.paidAt, paymentId: payment.paymentId } : s));
                                                            setSuccessPaymentDetails(payment);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details Section */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 md:px-6 md:pb-6 bg-slate-50 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                                            {/* Parts Table */}
                                            {service.partsReplaced && service.partsReplaced.length > 0 && (
                                                <div className="mt-6 mb-6">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Wrench className="h-3.5 w-3.5" /> Parts / Materials Replaced
                                                    </h4>
                                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                        {service.partsReplaced.map((part, pIdx) => {
                                                            const partTotal = parseFloat(part.total) || (parseFloat(part.quantity || 1) * parseFloat(part.unitPrice || 0)) || parseFloat(part.cost) || 0;
                                                            return (
                                                                <div key={pIdx} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                                                    <div>
                                                                        <span className="text-sm font-bold text-slate-700">
                                                                            {part.partName}
                                                                        </span>
                                                                        {part.brand && <span className="font-normal text-xs text-slate-400 font-sans ml-2 bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5">Brand: {part.brand}</span>}
                                                                        {part.quantity > 1 && (
                                                                            <span className="text-xs text-slate-400 font-medium ml-2">
                                                                                (Qty: {part.quantity} @ ₹{parseFloat(part.unitPrice || 0).toLocaleString('en-IN')})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-sm font-bold text-slate-900 flex items-center">
                                                                        <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" /> {partTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Labour Charges Breakdown */}
                                            {service.laborCharges && service.laborCharges.length > 0 ? (
                                                <div className="mt-4 mb-6">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Wrench className="h-3.5 w-3.5" /> Labour Charges
                                                    </h4>
                                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                        {service.laborCharges.map((labour, lIdx) => {
                                                            const labourTotal = parseFloat(labour.total) || (parseFloat(labour.quantity || labour.hours || 1) * parseFloat(labour.rate || 0)) || 0;
                                                            return (
                                                                <div key={lIdx} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                                                    <span className="text-sm font-bold text-slate-700">
                                                                        {labour.description || 'Labour Service'}
                                                                    </span>
                                                                    <span className="text-sm font-bold text-slate-900 flex items-center">
                                                                        <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" /> {labourTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : service.laborCost > 0 ? (
                                                <div className="mt-4 mb-4 bg-white rounded-xl border border-slate-200 p-3 flex justify-between items-center shadow-sm">
                                                    <span className="text-sm font-bold text-slate-600">Labour Charges</span>
                                                    <span className="text-sm font-bold text-slate-900 flex items-center">
                                                        <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" /> {Number(service.laborCost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            ) : null}

                                            {/* Notes Area */}
                                            {service.mechanicNotes && (
                                                <div className="mt-4">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <FileText className="h-3.5 w-3.5" /> Mechanic Notes
                                                    </h4>
                                                    <p className="text-sm text-slate-600 bg-white p-4 rounded-xl border border-slate-200 shadow-sm font-medium leading-relaxed italic">
                                                        "{service.mechanicNotes}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Recommendations Area — always shown */}
                                            <div className="mt-6 flex flex-wrap gap-4">
                                                <div className="flex-1 bg-teal-50 border border-teal-100 p-3 rounded-xl min-w-[130px]">
                                                    <span className="text-[10px] font-bold text-teal-500 uppercase tracking-wider block mb-1">Next Service (Km)</span>
                                                    <span className="text-sm font-black text-teal-800">
                                                        {service.recommendedKm ? `${Number(service.recommendedKm).toLocaleString()} km` : '—'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 bg-emerald-50 border border-emerald-100 p-3 rounded-xl min-w-[130px]">
                                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Next Service (Date)</span>
                                                    <span className="text-sm font-black text-emerald-800">
                                                        {service.recommendedDate
                                                            ? new Date(service.recommendedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                            : '—'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Bill Photos */}
                                            {service.billPhotoUrls && service.billPhotoUrls.length > 0 && (
                                                <div className="mt-6">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Receipt className="h-3.5 w-3.5" />
                                                        Service Bill{service.billPhotoUrls.length > 1 ? 's' : ''}
                                                        <span className="ml-auto text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                            {service.billPhotoUrls.length} photo{service.billPhotoUrls.length > 1 ? 's' : ''}
                                                        </span>
                                                    </h4>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {service.billPhotoUrls.map((url, pIdx) => (
                                                            <div
                                                                key={pIdx}
                                                                className="relative rounded-xl overflow-hidden border-2 border-violet-100 shadow-sm cursor-pointer group aspect-square bg-slate-900"
                                                                onClick={() => setLightboxUrl(url)}
                                                            >
                                                                <img
                                                                    src={url}
                                                                    alt={`Bill ${pIdx + 1}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                                                                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                                                </div>
                                                                <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-md">{pIdx + 1}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-1.5">Click any photo to enlarge</p>
                                                </div>
                                            )}

                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setLightboxUrl(null)}
                >
                    <div
                        className="relative max-w-3xl max-h-[90vh] w-full"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute -top-4 -right-4 z-10 p-2 bg-white rounded-full shadow-xl border border-slate-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <img
                            src={lightboxUrl}
                            alt="Service bill - full size"
                            className="w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border-2 border-white/20"
                        />
                        <p className="text-center text-white/50 text-xs font-medium mt-3">Service Bill Photo</p>
                    </div>
                </div>
            )}

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
                    onPaymentSuccess={(payment) => {
                        setServices(prev => prev.map(s => (s.id === (payment.serviceId || payment.invoiceId) || String(s._id) === String(payment.serviceId)) ? { ...s, paymentStatus: 'PAID', paidAt: payment.paidAt, paymentId: payment.paymentId } : s));
                        setSuccessPaymentDetails(payment);
                    }}
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
