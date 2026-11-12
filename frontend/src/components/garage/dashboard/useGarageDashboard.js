import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch, getErrorMessage } from '../../../utils/api';
import { useToast } from '../../../context/toastContextCore';

const EMPTY_REVENUE = { totalRevenue: 0, paidInvoices: 0, pendingPayments: 0, todayRevenue: 0 };

export const isActiveBooking = (b) => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS';

/**
 * Data + actions for the garage dashboard. Profile and bookings are required (a
 * failure surfaces as `error` with a retry); services, notifications and revenue
 * are optional panels that fall back to empty values.
 */
export function useGarageDashboard() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [revenueSummary, setRevenueSummary] = useState(EMPTY_REVENUE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingBookingId, setPendingBookingId] = useState(null);
  const [updatingCapacity, setUpdatingCapacity] = useState(false);
  const [sendingInfoRequest, setSendingInfoRequest] = useState(false);

  const loadAll = useCallback(async () => {
    const [pRes, sRes, bRes, nRes, rRes] = await Promise.allSettled([
      apiGet('/garages/me'),
      apiGet('/garages/me/services'),
      apiGet('/bookings/garage'),
      apiGet('/notifications', { limit: 20 }),
      apiGet('/garage/invoices/garage/revenue/summary'),
    ]);
    const value = (r, fallback) => (r.status === 'fulfilled' ? r.value : fallback);

    const critical = [pRes, bRes].find((r) => r.status === 'rejected');
    if (critical) {
      setError(getErrorMessage(critical.reason, 'Failed to load dashboard'));
    } else {
      setError(null);
      const p = value(pRes, null);
      setProfile(p?.exists ? p : null);
      const b = value(bRes, []);
      setBookings(Array.isArray(b) ? b : []);
    }
    const s = value(sRes, []);
    setServices(Array.isArray(s) ? s : []);
    const n = value(nRes, []);
    setNotifications(Array.isArray(n) ? n : []);
    const r = value(rRes, null);
    if (r?.success && r?.summary) setRevenueSummary(r.summary);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) loadAll(); });
    return () => { cancelled = true; };
  }, [loadAll]);

  const retry = useCallback(() => {
    setLoading(true);
    return loadAll();
  }, [loadAll]);

  /** Per-booking in-flight guard: a second click while pending is ignored. */
  const updateBookingStatus = useCallback(async (bookingId, status) => {
    if (pendingBookingId) return;
    setPendingBookingId(bookingId);
    try {
      await apiPatch(`/bookings/${bookingId}/status`, { status });
      showToast('Booking updated successfully!', 'success');
      await loadAll();
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to update booking'), 'error');
    } finally {
      setPendingBookingId(null);
    }
  }, [pendingBookingId, loadAll, showToast]);

  const requestInfo = useCallback(async (bookingId, message) => {
    if (!message || message.trim() === '' || sendingInfoRequest) return false;
    setSendingInfoRequest(true);
    try {
      await apiPatch(`/bookings/${bookingId}/request-info`, { message });
      showToast('Request sent to customer', 'success');
      await loadAll();
      return true;
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to request info'), 'error');
      return false;
    } finally {
      setSendingInfoRequest(false);
    }
  }, [sendingInfoRequest, loadAll, showToast]);

  const updateCapacity = useCallback(async (maxCapacity) => {
    if (maxCapacity < 1) return;
    setUpdatingCapacity(true);
    try {
      const data = await apiPatch('/garages/me/capacity', { maxCapacity });
      setProfile((p) => ({ ...p, maxCapacity: data.maxCapacity }));
      showToast('Capacity limit updated successfully', 'success');
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to update capacity limit'), 'error');
    } finally {
      setUpdatingCapacity(false);
    }
  }, [showToast]);

  return {
    profile, services, bookings, notifications, revenueSummary,
    loading, error, retry,
    pendingBookingId, updateBookingStatus,
    sendingInfoRequest, requestInfo,
    updatingCapacity, updateCapacity,
  };
}

export default useGarageDashboard;
