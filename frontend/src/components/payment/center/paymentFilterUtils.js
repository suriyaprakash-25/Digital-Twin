// Pure filtering for the customer Payment Center table.

export const PAYMENT_STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'CAPTURED', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REFUNDED', label: 'Refunds' },
];

const SEARCH_FIELDS = ['invoiceNumber', 'garageName', 'serviceType', 'vehicleNumber', 'paymentId'];

export const isPayable = (payment) => payment?.status === 'PENDING' || payment?.status === 'CREATED';

export const hasRefundActivity = (payment) =>
  payment?.status === 'REFUNDED' || payment?.status === 'PARTIALLY_REFUNDED' || (payment?.refunds?.length || 0) > 0;

function matchesStatus(status, filter) {
  if (filter === 'ALL') return true;
  if (filter === 'CAPTURED') return status === 'CAPTURED' || status === 'PAID';
  if (filter === 'PENDING') return status === 'PENDING' || status === 'CREATED';
  if (filter === 'REFUNDED') return status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED';
  return status === filter;
}

export function filterPayments(payments, { search = '', status = 'ALL', vehicle = 'ALL' } = {}) {
  const term = search.trim().toLowerCase();
  return (payments || []).filter((p) => {
    const matchesSearch = !term || SEARCH_FIELDS.some((field) => typeof p[field] === 'string' && p[field].toLowerCase().includes(term));
    const matchesVehicle = vehicle === 'ALL' || p.vehicleNumber === vehicle;
    return matchesSearch && matchesStatus(p.status, status) && matchesVehicle;
  });
}

/** Same invoice/payment row? Used for optimistic updates after checkout. */
export const isSamePayment = (a, b) => Boolean(a && b) && ((a.invoiceNumber && a.invoiceNumber === b.invoiceNumber) || a.id === b.id);
