import { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldCheck, AlertTriangle, Upload, CheckCircle, Clock } from 'lucide-react';

const GaragePortal = () => {
    const [pendingServices, setPendingServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState(null);
    const [garageKm, setGarageKm] = useState('');
    const [severity, setSeverity] = useState('Normal');
    const [notes, setNotes] = useState('');
    const [billFile, setBillFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const fetchPending = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/garage/pending', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPendingServices(res.data);
        } catch (err) {
            console.error('Error fetching pending services:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const handleVerifySubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setSuccessMessage('');

        const formData = new FormData();
        formData.append('garageReportedKm', garageKm);
        formData.append('repairSeverity', severity);
        formData.append('garageNotes', notes);
        if (billFile) {
            formData.append('billFile', billFile);
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`http://localhost:5000/api/garage/verify/${selectedService.id}`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.tamperDetected) {
                alert('WARNING: Odometer tamper logic triggered based on inputs. Service is flagged.');
            } else {
                setSuccessMessage('Service formally verified with Trust Badge.');
            }

            setSelectedService(null);
            setGarageKm('');
            setNotes('');
            setBillFile(null);
            fetchPending();
        } catch (err) {
            console.error('Error verifying:', err);
            alert('Verification failed.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <header className="mb-8 p-8 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-600/30 to-transparent"></div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold tracking-wide border border-emerald-500/30 mb-3">
                            <ShieldCheck className="h-4 w-4" /> Partner Garage Portal
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Service Verification & Audit</h1>
                        <p className="text-slate-400 mt-2 font-medium text-lg max-w-2xl">
                            Verify client service claims, issue Trust Badges, and flag mileage tampering directly in the digital twin blockchain-equivalent record.
                        </p>
                    </div>
                </div>
            </header>

            {successMessage && (
                <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                    <span className="font-bold">{successMessage}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Pending Verification Queue */}
                <div className="col-span-1 lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col h-[700px]">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900 border-b border-slate-100 pb-4">
                        <Clock className="h-5 w-5 text-amber-500" />
                        Awaiting Audit ({pendingServices.length})
                    </h2>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {pendingServices.length === 0 ? (
                            <p className="text-slate-500 italic text-center py-8">No pending verifications queue is empty.</p>
                        ) : (
                            pendingServices.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedService(s)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${selectedService?.id === s.id
                                            ? 'bg-emerald-50 border-emerald-300 shadow-md ring-2 ring-emerald-500/20'
                                            : 'bg-slate-50 border-slate-200 hover:border-emerald-300 hover:bg-slate-100'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-slate-900">{s.vehicleInfo}</h3>
                                        <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">
                                            {s.serviceDate}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-600 mb-1">{s.serviceCategory}</p>
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        Client claimed: <span className="font-bold text-slate-700">{s.odometerKm} km</span>
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Audit Tools Area */}
                <div className="col-span-1 lg:col-span-2">
                    {selectedService ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-md">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-900">
                                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                                Audit Service Record
                            </h2>

                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-8 flex gap-6 text-sm">
                                <div><span className="font-bold text-blue-900 block mb-1">Vehicle</span> {selectedService.vehicleInfo}</div>
                                <div><span className="font-bold text-blue-900 block mb-1">Date</span> {selectedService.serviceDate}</div>
                                <div><span className="font-bold text-blue-900 block mb-1">Claimed Km</span> {selectedService.odometerKm} km</div>
                                <div><span className="font-bold text-blue-900 block mb-1">Category</span> {selectedService.serviceCategory}</div>
                            </div>

                            <form onSubmit={handleVerifySubmit} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Actual Garage Odometer Reading (Km)</label>
                                        <input
                                            type="number"
                                            required
                                            value={garageKm}
                                            onChange={(e) => setGarageKm(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                                            placeholder="Verify mileage against cluster..."
                                        />
                                        <p className="text-xs text-amber-600 font-bold flex items-center gap-1 mt-1">
                                            <AlertTriangle className="h-3 w-3" /> Mismatches will auto-flag tampering.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Repair Severity Rating</label>
                                        <select
                                            value={severity}
                                            onChange={(e) => setSeverity(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                                        >
                                            <option>Routine / Minor</option>
                                            <option>Normal Wear & Tear</option>
                                            <option>Major Component Failure</option>
                                            <option>Accident / Crash Recovery</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Official Mechanic Notes & Recommendations</label>
                                    <textarea
                                        rows="3"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium resize-none"
                                        placeholder="Add mechanical observations..."
                                    ></textarea>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-slate-100">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Upload className="h-4 w-4 text-emerald-600" />
                                        Upload System-Generated Invoice (PDF/Img)
                                    </label>
                                    <input
                                        type="file"
                                        onChange={(e) => setBillFile(e.target.files[0])}
                                        className="w-full file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 text-slate-500"
                                        accept=".pdf,image/*"
                                    />
                                </div>

                                <div className="pt-6">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                    >
                                        {submitting ? 'Committing Audit to Chain...' : 'Approve & Issue Trust Badge'}
                                        {!submitting && <ShieldCheck className="h-5 w-5" />}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-16 text-center h-full flex flex-col justify-center items-center">
                            <ShieldCheck className="h-16 w-16 text-slate-300 mb-4" />
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Select a Record to Audit</h3>
                            <p className="text-slate-500 font-medium max-w-sm">
                                Choose a pending service record from the queue to verify details, flag discrepancies, and upload official documentation.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GaragePortal;
