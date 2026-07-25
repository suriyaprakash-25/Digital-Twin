import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, Calendar, Info, MapPin, IndianRupee, Shield, Wrench, ArrowLeft, ArrowRight, X } from 'lucide-react';

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

  // Modal state
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchServices();
  }, [page, debouncedSearch, category, sortBy, sortOrder]);

  const fetchServices = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/services/garage/all`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page,
          limit,
          search: debouncedSearch,
          category,
          sortBy,
          sortOrder
        }
      });
      
      setServices(res.data.services);
      setTotalPages(res.data.totalPages);
      setStats(res.data.stats);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.msg || 'Failed to load services.');
    } finally {
      setLoading(false);
    }
  };

  const ServiceModal = ({ service, onClose }) => {
    if (!service) return null;

    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Service Details</h3>
              <p className="text-sm text-slate-500 mt-1">Logged on {new Date(service.createdAt || service.serviceDate).toLocaleDateString()}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            
            {/* Customer & Vehicle Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Vehicle Details</h4>
                {service.vehicle ? (
                  <>
                    <p className="font-semibold text-slate-800">{service.vehicle.make} {service.vehicle.model} ({service.vehicle.year})</p>
                    <p className="text-sm text-slate-600 mt-1 uppercase bg-slate-200 inline-block px-2 py-0.5 rounded font-mono">{service.vehicle.registrationNumber}</p>
                    <p className="text-sm text-slate-600 mt-2 flex items-center gap-1"><Info size={14} className="text-slate-400"/> {service.odometerKm} km</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 italic">Details unavailable</p>
                )}
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer Details</h4>
                {service.customer ? (
                  <>
                    <p className="font-semibold text-slate-800">{service.customer.name || 'Unknown'}</p>
                    <p className="text-sm text-slate-600 mt-1">{service.customer.email}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 italic">Details unavailable</p>
                )}
              </div>
            </div>

            {/* Service Summary */}
            <div className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Wrench size={18} className="text-teal-600" />
                <h4 className="font-bold text-slate-800">{service.serviceType || 'General Service'}</h4>
                <span className="ml-auto text-xs font-semibold px-2 py-1 rounded-md bg-teal-50 text-teal-700 border border-teal-100">
                  {service.serviceCategory}
                </span>
              </div>
              
              {service.mechanicNotes && (
                <div className="mt-4 bg-yellow-50/50 rounded-lg p-3 border border-yellow-100">
                  <span className="text-xs font-bold text-yellow-800 uppercase tracking-wider block mb-1">Mechanic Notes</span>
                  <p className="text-sm text-yellow-900 leading-relaxed">{service.mechanicNotes}</p>
                </div>
              )}
            </div>

            {/* Billing */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Billing & Parts</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left text-slate-500">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Item / Part</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {service.partsReplaced?.map((part, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-700">{part.partName} {part.brand && <span className="text-slate-400 text-xs font-normal ml-1">({part.brand})</span>}</td>
                        <td className="px-4 py-3 text-right">₹{parseFloat(part.cost).toLocaleString()}</td>
                      </tr>
                    ))}
                    {service.laborCost > 0 && (
                      <tr className="border-t border-slate-100 bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-600">Labor / Service Charge</td>
                        <td className="px-4 py-3 text-right">₹{parseFloat(service.laborCost).toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-teal-700 text-base">₹{parseFloat(service.totalCost).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bill Photos */}
            {service.billPhotoUrls && service.billPhotoUrls.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Attached Bills</h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {service.billPhotoUrls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 hover:border-teal-400 transition-colors">
                      <img src={url} alt={`Bill ${idx + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    );
  };

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
              <p className="text-2xl font-black text-slate-800">{stats.totalServices}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[140px]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Revenue</p>
              <p className="text-2xl font-black text-teal-700">₹{parseFloat(stats.totalRevenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
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
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
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

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Vehicle</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Service Type</th>
                  <th className="px-6 py-4 text-right">Cost</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                      <div className="inline-block animate-spin w-6 h-6 border-2 border-slate-300 border-t-teal-600 rounded-full mb-2"></div>
                      <p>Loading services...</p>
                    </td>
                  </tr>
                ) : services.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                      {search ? 'No services matched your search.' : 'No services logged yet.'}
                    </td>
                  </tr>
                ) : (
                  services.map(service => (
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-700">
                        ₹{parseFloat(service.totalCost).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button 
                          onClick={() => setSelectedService(service)}
                          className="text-xs font-semibold text-teal-700 hover:text-white border border-teal-200 hover:bg-teal-600 px-3 py-1.5 rounded-md transition-all"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <button 
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
      
      {/* Modal */}
      {selectedService && (
        <ServiceModal service={selectedService} onClose={() => setSelectedService(null)} />
      )}
    </>
  );
};

export default GarageServicesHistory;
