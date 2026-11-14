import { getStatusMeta, paymentStatusMeta } from '../../utils/statusMeta';
import { formatCurrency } from '../../utils/format';

/**
 * Single status pill used across payment, risk and garage tables.
 * `metaMap` comes from utils/statusMeta.jsx; `suffix` appends extra text (e.g. refund amount).
 */
const StatusBadge = ({ status, metaMap = paymentStatusMeta, suffix, uppercase = false, className = '' }) => {
  const meta = getStatusMeta(status, metaMap);
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${meta.color} ${uppercase ? 'uppercase' : ''} ${className}`}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {meta.label}
      {suffix}
    </span>
  );
};

/** Payment status with the refunded amount shown for partial refunds. */
export const PaymentStatusBadge = ({ status, refundedAmount, ...rest }) => (
  <StatusBadge
    status={status}
    metaMap={paymentStatusMeta}
    suffix={status === 'PARTIALLY_REFUNDED' && Number(refundedAmount) > 0 ? ` (${formatCurrency(refundedAmount)})` : null}
    {...rest}
  />
);

export default StatusBadge;
