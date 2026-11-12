import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../utils/api';
import { useAsync } from '../../hooks/useAsync';

export const POLL_INTERVAL_MS = 30000;
const STATUS_WEIGHT = { AVAILABLE: 1, BUSY: 2, CLOSED: 3 };

async function loadMarketplace() {
  const [garages, vehicles] = await Promise.all([
    apiGet('/marketplace'),
    apiGet('/vehicles/myvehicles'),
  ]);
  return {
    garages: Array.isArray(garages) ? garages : [],
    vehicles: Array.isArray(vehicles) ? vehicles : [],
  };
}

/** Status filter + text search, sorted AVAILABLE -> BUSY -> CLOSED (never mutates input). */
export function filterGarages(garages, { statusFilter = 'ALL', searchQuery = '' } = {}) {
  let result = statusFilter === 'ALL' ? [...garages] : garages.filter((g) => g.currentStatus === statusFilter);
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter((g) =>
      (g.name || '').toLowerCase().includes(q) ||
      (g.city || '').toLowerCase().includes(q) ||
      (g.address || '').toLowerCase().includes(q)
    );
  }
  return result.sort((a, b) => (STATUS_WEIGHT[a.currentStatus] || 4) - (STATUS_WEIGHT[b.currentStatus] || 4));
}

export const slotsLeft = (g) => g.maxCapacity - g.activeBookingsCount;
export const isGarageBookable = (g) => g.currentStatus !== 'CLOSED' && slotsLeft(g) > 0;

/**
 * Garages + the owner's vehicles, refreshed silently every 30s for live availability.
 * The selected vehicle survives refreshes; it falls back to the first vehicle only when
 * nothing is selected yet or the selected vehicle disappeared.
 */
export function useMarketplaceData() {
  const { data, error, loading, refreshing, refetch } = useAsync(loadMarketplace, []);
  const [chosenVehicleId, setSelectedVehicleId] = useState('');

  useEffect(() => {
    const id = setInterval(() => refetch({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  const garages = useMemo(() => data?.garages || [], [data]);
  const vehicles = useMemo(() => data?.vehicles || [], [data]);
  const selectedVehicleId = vehicles.some((v) => v.id === chosenVehicleId)
    ? chosenVehicleId
    : (vehicles[0]?.id || '');

  return {
    garages,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    error,
    loading: loading && !data,
    refreshing,
    refetch,
  };
}
