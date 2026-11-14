import { useCallback, useEffect, useState } from 'react';
import { Search, Filter, ArrowLeft, ArrowRight, FileText, CheckCircle2, Clock, Receipt, Edit3 } from 'lucide-react';
import { apiGet, getErrorMessage } from '../utils/api';
import ErrorState from '../components/common/ErrorState';
import GarageServiceDetailModal from '../components/garage/GarageServiceDetailModal';
import InvoiceModal from '../components/invoice/InvoiceModal';
import ReceiptModal from '../components/invoice/ReceiptModal';
import GarageBillingModal from '../components/garage/GarageBillingModal';

const GarageServicesHistory = () => {
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalServices: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modal states
  const [selectedService, setSelectedService] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [billingService, setBillingService] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/services/garage/all', {
        page,
        limit,
        search: debouncedSearch,
        category,
        sortBy,
        sortOrder
      });

      setServices(data.services || []);
      setTotalPages(data.totalPages || 1);
      setStats(data.stats || { totalRevenue: 0, totalServices: 0 });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load services.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, category, sortBy, sortOrder]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchServices(); });
    return () => { cancelled = true; };
  }, [fetchServices]);


  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Stats */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Your Services</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and track all services logged by your garage.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[140px]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Services Logged</p>
              <p className="font-metric text-metric-lg text-slate-800">{stats.totalServices}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[140px]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Revenue</p>
              <p className="font-metric text-metric-lg text-teal-700">₹{parseFloat(stats.totalRevenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={fetchServices} retrying={loading} />}

        {/* Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search services"
              placeholder="Search by Reg No, Customer, Service..."  
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                aria-label="Filter by category"
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:outline-none focus:border-teal-500 font-medium text-slate-700"
              >
                <option value="ALL">All Categories</option>
                <option value="Periodic Maintenance">Periodic Maintenance</option>
                <option value="Repairs">Repairs</option>
                <option value="Major Service">Major Service</option>
                <option value="Breakdown">Breakdown</option>
                <option value="Accessories/Mods">Accessories/Mods</option>
              </select>
            </div>

            <select
              aria-label="Sort services"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by);
                setSortOrder(order);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 font-medium text-slate-700"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="cost-desc">Highest Cost</option>
              <option value="cost-asc">Lowest Cost</option>
            </select>
          </div>
        </div>

        {/* Table & Mobile Stacked Cards Container */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          
          {/* Desktop Table View (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Vehicle</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Service Type</th>
                  <th className="px-6 py-4 text-center">Payment Status</th>
                  <th className="px-6 py-4 text-right">Total Cost</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                      <div className="inline-block animate-spin w-6 h-6 border-2 border-slate-300 border-t-teal-600 rounded-full mb-2"></div>
                      <p>Loading services...</p>
                    </td>
                  </tr>
                ) : services.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                      {search ? 'No services matched your search.' : 'No services logged yet.'}
                    </td>
                  </tr>
                ) : (
                  services.map(service => {
                    const isPaid = service.paymentStatus === 'PAID';
                    const isFinalized = service.invoiceStatus === 'FINALIZED';

                    return (
                      <tr key={service.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-slate-800">{new Date(service.serviceDate).toLocaleDateString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          {service.vehicle ? (
                            <div>
                              <div className="font-bold text-slate-800 bg-slate-100 inline-block px-2 py-0.5 rounded text-xs tracking-wider mb-1 border border-slate-200">
                                {service.vehicle.registrationNumber}
                              </div>
                              <div className="text-xs text-slate-500 font-medium">
                                {service.vehicle.make} {service.vehicle.model}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {service.customer ? (
                            <div>
                              <div className="font-medium text-slate-800">{service.customer.name || 'Unknown'}</div>
                              <div className="text-xs text-slate-500 truncate max-w-[150px]" title={service.customer.email}>{service.customer.email}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 truncate max-w-[200px]" title={service.serviceType}>
                            {service.serviceType || 'General Service'}
                          </div>
                          <div className="text-xs text-teal-700 font-semibold mt-0.5">
                            {service.serviceCategory}
                          </div>
                          {service.invoiceNumber && (
                            <div className="font-mono text-[10px] text-slate-400 font-bold mt-1">
                              {service.invoiceNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              PAID
                            </span>
                          ) : isFinalized ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black text-amber-700 bg-amber-50 border border-amber-200">
                              <Clock className="h-3 w-3 text-amber-600" />
                              UNPAID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200">
                              DRAFT
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-metric text-metric-md text-slate-700">
                          ₹{(parseFloat(service.totalCost) || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setSelectedService(service)}
                              className="text-xs font-semibold text-slate-700 hover:text-teal-700 hover:bg-slate-100 px-2.5 py-1.5 rounded-md transition-all border border-slate-200"
                              title="View Service Details"
                            >
                              Details
                            </button>

                            <button 
                              onClick={() => setSelectedInvoiceId(service.id)}
                              className="text-xs font-semibold text-teal-700 hover:text-white border border-teal-200 hover:bg-teal-600 px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1"
                              title="View Tax Invoice"
                            >
                              <FileText className="h-3 w-3" />
                              Bill
                            </button>

                            {!isPaid && (
                              <button 
                                onClick={() => setBillingService(service)}
                                className="text-xs font-semibold text-amber-700 hover:text-white border border-amber-200 hover:bg-amber-600 px-2 py-1.5 rounded-md transition-all flex items-center gap-1"
                                title="Edit or Finalize Billing Items"
                              >
                                <Edit3 className="h-3 w-3" />
                                {isFinalized ? 'Edit' : 'Finalize'}
                              </button>
                            )}

                            {isPaid && (
                              <button 
                                onClick={() => setSelectedReceiptId(service.id)}
                                className="text-xs font-semibold text-emerald-700 hover:text-white border border-emerald-200 hover:bg-emerald-600 px-2 py-1.5 rounded-md transition-all flex items-center gap-1"
                                title="View Payment Receipt"
                              >
                                <Receipt className="h-3 w-3" />
                                Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards View (<md) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                <div className="inline-block animate-spin w-6 h-6 border-2 border-slate-300 border-t-teal-600 rounded-full mb-2"></div>
                <p className="text-xs font-semibold">Loading services...</p>
              </div>
            ) : services.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-semibold">
                {search ? 'No services matched your search.' : 'No services logged yet.'}
              </div>
            ) : (
              services.map(service => (
                <div key={service.id} className="p-4 space-y-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{new Date(service.serviceDate).toLocaleDateString()}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100">{service.serviceCategory}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{service.serviceType || 'General Service'}</h4>
                      {service.vehicle && (
                        <div className="text-xs text-slate-600 mt-0.5">
                          <span className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-bold">{service.vehicle.registrationNumber}</span>
                          <span className="ml-1.5">{service.vehicle.make} {service.vehicle.model}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-teal-700">₹{(parseFloat(service.totalCost) || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="text-slate-500 truncate max-w-[180px]">
                      Customer: <span className="font-bold text-slate-700">{service.customer?.name || 'Owner'}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedService(service)}
                      className="font-bold text-teal-600 hover:underline text-xs"
                    >
                      View Details &rarr;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Service Details Modal */}
      {selectedService && (
        <GarageServiceDetailModal service={selectedService} onClose={() => setSelectedService(null)} />
      )}

      {/* Tax Invoice Modal */}
      {selectedInvoiceId && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoiceId)}
          onClose={() => setSelectedInvoiceId(null)}
          serviceId={selectedInvoiceId}
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

      {/* Garage Bill Editing / Finalize Modal */}
      {billingService && (
        <GarageBillingModal
          isOpen={Boolean(billingService)}
          onClose={() => setBillingService(null)}
          service={billingService}
          onInvoiceUpdated={fetchServices}
        />
      )}
    </>
  );
};

export default GarageServicesHistory;
