import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  IndianRupee,
  Building,
  Car,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Send,
  MessageSquare,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../utils/api';

const DisputeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dispute, setDispute] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userMessage, setUserMessage] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/disputes/${id}`, {
        headers: getAuthHeaders()
      });
      if (res.data?.success) {
        setDispute(res.data.dispute);
        setTimeline(res.data.timeline || []);
      }
    } catch (err) {
      console.error('Error fetching dispute details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleUserResponse = async (e) => {
    e.preventDefault();
    if (!userMessage.trim()) return;

    setSubmittingResponse(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/disputes/${id}/respond`,
        { message: userMessage },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        setUserMessage('');
        fetchDetails();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error submitting response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleCancelDispute = async () => {
    if (!window.confirm('Are you sure you want to cancel this dispute? This action cannot be undone.')) {
      return;
    }

    setCancelling(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/disputes/${id}/cancel`,
        {},
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        fetchDetails();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error cancelling dispute');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Dispute Not Found</h2>
        <button
          onClick={() => navigate('/disputes')}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          Back to My Disputes
        </button>
      </div>
    );
  }

  const isResolved = dispute.status === 'RESOLVED';
  const isRejected = dispute.status === 'REJECTED';
  const isOpen = dispute.status === 'OPEN';
  const isWaitingUser = dispute.status === 'WAITING_FOR_USER';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Back Navigation */}
      <button
        onClick={() => navigate('/disputes')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to My Disputes</span>
      </button>

      {/* Header Banner */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200">
              {dispute.disputeNumber}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {dispute.category?.replace(/_/g, ' ')}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            {dispute.subject}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Submitted on {new Date(dispute.createdAt).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isResolved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> RESOLVED
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-red-50 text-red-700 border border-red-200">
              REJECTED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="h-4 w-4" /> {dispute.status?.replace(/_/g, ' ')}
            </span>
          )}

          {isOpen && (
            <button
              onClick={handleCancelDispute}
              disabled={cancelling}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
            >
              Cancel Dispute
            </button>
          )}
        </div>
      </div>

      {/* Financial Snapshot Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Disputed Amount</span>
          <div className="text-xl font-black text-slate-900 flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(dispute.disputedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Claimed refund amount</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Invoice Bill</span>
          <div className="text-xl font-black text-slate-900 flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(dispute.originalAmount || dispute.disputedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{dispute.invoiceNumber}</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Garage</span>
          <div className="text-sm font-black text-slate-900 truncate">
            {dispute.garageName}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{dispute.serviceType || 'Service'}</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Vehicle</span>
          <div className="text-sm font-black text-slate-900">
            {dispute.vehicleNumber}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Registered Vehicle</p>
        </div>
      </div>

      {/* Description & Evidence */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900">Customer Statement</h3>
        <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-wrap">
          {dispute.description}
        </p>

        {dispute.evidence && dispute.evidence.length > 0 && (
          <div>
            <span className="text-xs font-bold text-slate-800 block mb-2">Attached Evidence</span>
            <div className="flex flex-wrap gap-2">
              {dispute.evidence.map((ev, i) => (
                <a
                  key={i}
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-teal-700 transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{ev.originalName || `Evidence Attachment ${i + 1}`}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Garage Explanation if present */}
      {dispute.garageResponse && (
        <div className="bg-teal-50/50 border border-teal-200 rounded-3xl p-6 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
              <Building className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-extrabold text-teal-900">Garage Partner Response</h3>
          </div>
          <p className="text-xs text-teal-800 font-medium leading-relaxed bg-white/70 p-4 rounded-2xl border border-teal-100 whitespace-pre-wrap">
            {dispute.garageResponse}
          </p>
        </div>
      )}

      {/* Resolution Outcome if closed */}
      {(isResolved || isRejected) && (
        <div className={`p-6 rounded-3xl border shadow-xs space-y-2 ${isResolved ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg ${isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h3 className={`text-sm font-extrabold ${isResolved ? 'text-emerald-900' : 'text-red-900'}`}>
              Support Resolution: {dispute.resolution?.replace(/_/g, ' ')}
            </h3>
          </div>
          <p className={`text-xs font-medium leading-relaxed p-4 rounded-2xl bg-white/70 ${isResolved ? 'text-emerald-800 border border-emerald-100' : 'text-red-800 border border-red-100'}`}>
            {dispute.resolutionNote || 'The dispute inquiry was reviewed and concluded by support.'}
          </p>
        </div>
      )}

      {/* Interactive Timeline */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          Dispute Timeline & Activity
        </h3>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {timeline.map((event, idx) => (
            <div key={idx} className="relative group">
              <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-white border-2 border-teal-600"></div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {event.actorRole}
                  </span>
                  <span className="text-xs font-black text-slate-800">{event.action?.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">
                    {new Date(event.date).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{event.message}</p>
              </div>
            </div>
          ))}
        </div>

        {/* User Response Form if active */}
        {isWaitingUser && (
          <form onSubmit={handleUserResponse} className="mt-6 pt-6 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-900">Your Follow-up Response</h4>
            <textarea
              rows="2"
              required
              placeholder="Type your response to the support team or garage..."
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800"
            />
            <button
              type="submit"
              disabled={submittingResponse}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{submittingResponse ? 'Sending...' : 'Submit Response'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DisputeDetails;
