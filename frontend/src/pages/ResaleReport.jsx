import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ShieldCheck, AlertTriangle, TrendingDown, TrendingUp, HelpCircle, Activity, Award } from 'lucide-react';

const ResaleReport = () => {
    const { vehicleId } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/resale/${vehicleId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setReport(res.data);
            } catch (err) {
                console.error('Error fetching resale report:', err);
                setError('Failed to load resale analysis or vehicle not found.');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [vehicleId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="max-w-4xl mx-auto text-center mt-20 p-8 bg-red-50 rounded-3xl border border-red-100">
                <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-red-700">{error}</h2>
                <Link to="/my-vehicles" className="text-blue-600 font-semibold mt-4 inline-block hover:underline">
                    Return to My Vehicles
                </Link>
            </div>
        );
    }

    const {
        estimatedValueRange,
        trustScore,
        trustFactors,
        maintenanceQuality,
        riskLevel,
        originalPrice,
        ageYears
    } = report;

    const getTrustColor = (score) => {
        if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (score >= 65) return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-rose-600 bg-rose-50 border-rose-200';
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 3 }).format(val);

    return (
        <div className="max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
                <Link to="/my-vehicles" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Vehicles
                </Link>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <ShieldCheck className="h-10 w-10 text-blue-600" />
                            Buyer Verification Report
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium text-lg">
                            AI-driven trust analysis and AI valuation based on lifecycle integrity.
                        </p>
                    </div>
                    <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-right">
                            Risk Level
                            <div className={`text-lg font-black mt-0.5 ${riskLevel === 'Low' ? 'text-emerald-600' : riskLevel === 'Medium' ? 'text-amber-600' : 'text-rose-600'}`}>
                                {riskLevel} RISK
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Trust Score Identity Block */}
                <div className={`col-span-1 border rounded-3xl p-8 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden transition-colors ${getTrustColor(trustScore)}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Award className="h-48 w-48" />
                    </div>
                    <h3 className="text-lg font-bold opacity-80 mb-2 mt-4">System Trust Score</h3>
                    <div className="text-8xl font-black tracking-tighter mb-4 z-10">{trustScore}</div>
                    <span className="px-4 py-1.5 bg-white/60 rounded-full text-sm font-bold z-10 shadow-sm">
                        out of 100
                    </span>
                    <p className="mt-6 text-sm font-semibold opacity-90 z-10">
                        Higher scores indicate verified history and consistent maintenance.
                    </p>
                </div>

                {/* Valuation Engine */}
                <div className="col-span-1 lg:col-span-2 bg-slate-900 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-blue-600/20 to-transparent"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-6">
                            <Activity className="h-5 w-5 text-blue-400" />
                            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Algorithmic Valuation</h3>
                        </div>

                        <div className="flex items-end gap-3 mb-2">
                            <span className="text-6xl font-black tracking-tighter text-white">
                                {formatCurrency(estimatedValueRange.mean)}
                            </span>
                        </div>
                        <p className="text-slate-400 font-medium mb-8">Estimated Market Mean Value</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-800">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Max Value</p>
                                <p className="text-emerald-400 font-bold text-lg">{formatCurrency(estimatedValueRange.max)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Min Value</p>
                                <p className="text-rose-400 font-bold text-lg">{formatCurrency(estimatedValueRange.min)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Age</p>
                                <p className="text-slate-300 font-bold text-lg">{ageYears} Years</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Original Price</p>
                                <p className="text-slate-300 font-bold text-lg">{originalPrice > 0 ? formatCurrency(originalPrice) : 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Audit Analysis */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-blue-500" />
                        Lifecycle Factors
                    </h3>

                    {trustFactors.length === 0 ? (
                        <p className="text-slate-500 italic">No specific factors detected yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {trustFactors.map((factor, idx) => (
                                <div key={idx} className={`p-4 rounded-xl border flex items-start gap-3 ${factor.type === 'positive' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                    {factor.type === 'positive' ? (
                                        <TrendingUp className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                                    ) : (
                                        <TrendingDown className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                                    )}
                                    <span className={`font-semibold ${factor.type === 'positive' ? 'text-emerald-900' : 'text-rose-900'}`}>
                                        {factor.reason}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Condition Breakdown */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-500" />
                        Component Status
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Maintenance Quality</p>
                                <p className="text-lg font-black text-slate-900">{maintenanceQuality}</p>
                            </div>
                            <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${maintenanceQuality === 'Excellent' ? 'bg-emerald-100 text-emerald-700' : maintenanceQuality === 'Good' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                                {maintenanceQuality === 'Excellent' ? 'A+' : maintenanceQuality === 'Good' ? 'B' : 'C'}
                            </div>
                        </div>

                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
                            <div className="flex gap-3 text-slate-600 items-start">
                                <HelpCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-sm font-medium leading-relaxed">
                                    The <strong>Maintenance Quality</strong> rating is derived from the core Health Engine, evaluating service adherence, severity of repairs, and frequency of maintenance gaps.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ResaleReport;
