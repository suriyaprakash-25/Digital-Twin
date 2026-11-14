/**
 * Response DTO mappers for the admin console. These shapes are the contract the React admin pages
 * read (pages/admin/*), so they whitelist fields explicitly: nothing else from the stored document
 * (credentials, OTP state, internal flags) can reach a response.
 */
const { ROLE_FALLBACK, DEFAULT_CURRENCY, FALLBACK_LABELS } = require('./adminConstants');

function toUserListItem(u) {
  return {
    id: String(u._id),
    name: u.name || '',
    email: u.email || '',
    role: u.role || ROLE_FALLBACK,
    phone: u.phone || '',
    city: u.city || '',
    photoUrl: u.photoUrl || null,
    vehicleCount: u.vehicleCount || 0,
    serviceCount: u.serviceCount || 0,
    createdAt: u.createdAt || null,
  };
}

function toUserVehicle(v) {
  return {
    id: String(v._id),
    vehicleNumber: v.vehicleNumber,
    brand: v.brand,
    model: v.model,
    year: v.manufacturingYear || v.year,
    fuelType: v.fuelType,
    createdAt: v.createdAt,
  };
}

function toUserService(s) {
  return {
    id: String(s._id),
    vehicleId: s.vehicleId,
    serviceDate: s.serviceDate,
    serviceType: s.serviceType,
    serviceCategory: s.serviceCategory,
    totalCost: s.totalCost || 0,
    garageName: s.garageName || '',
    createdAt: s.createdAt,
  };
}

function toUserDetail(user, vehicles, services) {
  return {
    id: String(user._id),
    name: user.name || '',
    email: user.email || '',
    role: user.role || ROLE_FALLBACK,
    phone: user.phone || '',
    city: user.city || '',
    bio: user.bio || '',
    photoUrl: user.photoUrl || null,
    createdAt: user.createdAt || null,
    vehicles: vehicles.map(toUserVehicle),
    services: services.map(toUserService),
  };
}

function toGarageListItem(g) {
  const stats = (g._bookingStats && g._bookingStats[0]) || {};
  const owner = g._owner && g._owner[0];
  return {
    id: String(g._id),
    name: g.name || '',
    ownerName: owner ? owner.name : '',
    ownerEmail: owner ? owner.email : '',
    phone: g.phone || '',
    city: g.city || '',
    address: g.address || '',
    description: g.description || '',
    photoUrl: g.photoUrl || null,
    verified: g.verified === true,
    isActive: g.isActive !== false,
    servicesCompleted: stats.servicesCompleted || 0,
    totalBookings: stats.totalBookings || 0,
    revenue: stats.revenue || 0,
    createdAt: g.createdAt || null,
  };
}

function toPaymentListItem(p) {
  return {
    id: String(p._id),
    invoiceNumber: p.invoiceNumber || FALLBACK_LABELS.INVOICE_NUMBER,
    orderId: p.razorpayOrderId,
    paymentId: p.razorpayPaymentId || FALLBACK_LABELS.PAYMENT_ID,
    amount: p.amount,
    currency: p.currency || DEFAULT_CURRENCY,
    status: p.status,
    paymentMethod: p.paymentMethod || FALLBACK_LABELS.PAYMENT_METHOD,
    garageName: p.garageName || FALLBACK_LABELS.GARAGE,
    garageId: p.garageId,
    vehicleNumber: p.vehicleNumber || FALLBACK_LABELS.VEHICLE_NUMBER,
    vehicleId: p.vehicleId,
    userId: p.userId,
    serviceType: p.serviceType || FALLBACK_LABELS.SERVICE_TYPE,
    serviceId: p.serviceId,
    totalRefundedAmount: p.totalRefundedAmount || 0,
    refunds: p.refunds || [],
    failureReason: p.failureReason,
    paidAt: p.paidAt,
    refundedAt: p.refundedAt,
    date: p.paidAt || p.createdAt,
  };
}

function toCommissionListItem(e) {
  return {
    id: String(e._id),
    invoiceId: e.invoiceId,
    invoiceNumber: e.invoiceNumber,
    garageId: e.garageId,
    garageName: e.garageName || FALLBACK_LABELS.GARAGE,
    serviceType: e.serviceType,
    vehicleNumber: e.vehicleNumber,
    paymentId: e.paymentId,
    razorpayPaymentId: e.razorpayPaymentId,
    grossAmount: e.grossAmount,
    platformCommission: e.platformCommission,
    garageNetAmount: e.garageNetAmount,
    refundAmount: e.refundAmount || 0,
    netAfterRefund: e.netAfterRefund !== undefined ? e.netAfterRefund : e.garageNetAmount,
    commissionRate: e.commissionRate,
    commissionType: e.commissionType,
    status: e.status,
    settlementId: e.settlementId,
    date: e.createdAt,
  };
}

function toSettlementListItem(s, garageNames) {
  return {
    id: String(s._id),
    settlementId: s.settlementId,
    garageId: s.garageId,
    garageName: garageNames[String(s.garageId)] || FALLBACK_LABELS.SETTLEMENT_GARAGE,
    requestedAmount: s.requestedAmount,
    approvedAmount: s.approvedAmount || s.requestedAmount,
    currency: s.currency || DEFAULT_CURRENCY,
    status: s.status,
    earningsCount: s.earningsIds?.length || 0,
    earningsIds: s.earningsIds || [],
    destinationAccountId: s.destinationAccountId,
    notes: s.notes,
    transferId: s.transferId,
    provider: s.provider,
    requestedAt: s.requestedAt,
    approvedAt: s.approvedAt,
    processedAt: s.processedAt,
    completedAt: s.completedAt,
    failureReason: s.failureReason,
  };
}

module.exports = {
  toUserListItem,
  toUserDetail,
  toGarageListItem,
  toPaymentListItem,
  toCommissionListItem,
  toSettlementListItem,
};
