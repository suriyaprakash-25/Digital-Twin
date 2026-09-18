import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Headphones,
  RefreshCw,
  UserPlus,
  Users,
  Wrench
} from 'lucide-react';
import { API_BASE_URL } from '../../utils/config';
import { useToast } from '../../context/toastContextCore';

const queueLabels = {
  PILOT_OPERATIONS: 'Pilot Operations',
  PAYMENTS_AND_RECONCILIATION: 'Payments & Reconciliation',
  GARAGE_SUCCESS: 'Garage Success',
  ACCOUNT_AND_ACCESS: 'Account & Access',
  TECHNICAL_ON_CALL: 'Technical On-call',
  PRODUCT_FEEDBACK: 'Product Feedback'
};

const priorityClass = {
  URGENT: 'bg-red-50 text-red-700 border-red-200',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  LOW: 'bg-slate-50 text-slate-600 border-slate-200'
};

function KpiCard({ label, value, helper, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>
        <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700">
          {createElement(icon, { className: 'h-5 w-5' })}
        </div>
      </div>
    </div>
  );
}

export default function AdminPilotOperations() {
  const { showToast } = useToast();
  const token = localStorage.getItem('token');
  const adminName = localStorage.getItem('name') || 'Admin on duty';
  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [days, setDays] = useState('30');
  const [analytics, setAnalytics] = useState(null);
  const [support, setSupport] = useState([]);
  const [supportMetrics, setSupportMetrics] = useState({ open: 0, urgent: 0, slaBreached: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, supportRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/admin/pilot/analytics?days=${days}`, headers),
        axios.get(`${API_BASE_URL}/api/admin/pilot/support?limit=50`, headers)
      ]);
      setAnalytics(analyticsRes.data?.analytics || null);
      setSupport(supportRes.data?.items || []);
      setSupportMetrics(supportRes.data?.metrics || { open: 0, urgent: 0, slaBreached: 0, total: 0 });
    } catch (error) {
      showToast(error.response?.data?.msg || 'Failed to load pilot operations', 'error');
    } finally {
      setLoading(false);
    }
  }, [days, headers, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const updateSupport = async (id, patch) => {
    setUpdatingId(id);
    try {
      const res = await axios.patch(`${API_BASE_URL}/api/admin/pilot/support/${id}`, patch, headers);
      const updated = res.data?.item;
      if (updated) {
        setSupport((items) => items.map((item) => (item._id === id ? updated : item)));
      }
      showToast('Support item updated', 'success');
    } catch (error) {
      showToast(error.response?.data?.msg || 'Failed to update support item', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const a = analytics || {
    users: {}, bookings: {}, payments: {}, ai: {}, reliability: {}, garages: {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
              <Headphones className="h-5 w-5" />
            </span>
            Pilot Operations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Live pilot KPIs and support triage in one admin workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            aria-label="Analytics window"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Pilot analytics</h2>
          {analytics?.generatedAt && (
            <span className="text-xs text-slate-400">
              Updated {new Date(analytics.generatedAt).toLocaleString('en-IN')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total users" value={a.users?.total ?? 0} helper={`${a.users?.new ?? 0} new in period`} icon={Users} />
          <KpiCard label="Bookings created" value={a.bookings?.created ?? 0} helper={`${a.bookings?.completed ?? 0} completed • ${a.bookings?.conversionRate ?? 0}% conversion`} icon={Wrench} />
          <KpiCard label="Payment success" value={`${a.payments?.successRate ?? 0}%`} helper={`${a.payments?.successful ?? 0} captured • ${a.payments?.failed ?? 0} failed`} icon={CreditCard} />
          <KpiCard label="AI usage" value={a.ai?.totalUses ?? 0} helper={`${a.ai?.vehicleDoctorUses ?? 0} Doctor • ${a.ai?.copilotMessages ?? 0} CoPilot`} icon={Bot} />
          <KpiCard label="Errors" value={a.reliability?.errors ?? 0} helper="Recorded ERROR events in period" icon={AlertTriangle} />
          <KpiCard label="Active garages" value={a.garages?.activeInPeriod ?? 0} helper={`${a.garages?.activityRate ?? 0}% of ${a.garages?.totalActive ?? 0} active garages`} icon={Building2} />
          <KpiCard label="Open support" value={supportMetrics.open} helper={`${supportMetrics.urgent} urgent`} icon={Clock} />
          <KpiCard label="SLA breaches" value={supportMetrics.slaBreached} helper="Open issues past target response time" icon={Activity} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Pilot support queue</h2>
            <p className="text-xs text-slate-500">
              Booking → Pilot Operations • Payment → Payments & Reconciliation • Garage complaints → Garage Success • Account → Account & Access • Bugs → Technical On-call
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">{supportMetrics.total} operational reports</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Queue</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {support.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                    No operational support reports yet.
                  </td>
                </tr>
              ) : support.map((item) => (
                <tr key={item._id} className="align-top hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{item.category}</p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{item.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{item.name || 'User'} • {item.role || 'USER'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                    {queueLabels[item.supportQueue] || item.supportQueue}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={item.supportPriority || 'MEDIUM'}
                      disabled={updatingId === item._id}
                      onChange={(event) => updateSupport(item._id, { supportPriority: event.target.value })}
                      className={`rounded-lg border px-2 py-1 text-xs font-bold ${priorityClass[item.supportPriority] || priorityClass.MEDIUM}`}
                    >
                      <option value="URGENT">Urgent</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${item.slaBreached ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {item.slaBreached ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {item.slaBreached ? 'Breached' : `${item.supportSlaHours || 24}h target`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.assignedTo ? (
                      <p className="text-xs font-bold text-slate-700">{item.assignedTo}</p>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingId === item._id}
                        onClick={() => updateSupport(item._id, { assignedTo: adminName, status: 'REVIEWED' })}
                        className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100"
                      >
                        Assign to me
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={item.status || 'NEW'}
                      disabled={updatingId === item._id}
                      onChange={(event) => updateSupport(item._id, { status: event.target.value })}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700"
                    >
                      <option value="NEW">New</option>
                      <option value="REVIEWED">In review</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {a.garages?.topGarages?.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-900">Most active garages by bookings</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {a.garages.topGarages.map((garage) => (
              <div key={garage.garageId} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="truncate text-sm font-bold text-slate-800">{garage.name}</p>
                <p className="text-xs text-slate-500">{garage.bookingCount} bookings</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
