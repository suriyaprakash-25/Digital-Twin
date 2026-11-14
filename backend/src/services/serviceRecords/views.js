/**
 * Pure response mappers (presentation of service documents). They keep the exact JSON shapes the
 * React pages (ServiceHistory, GarageServicesHistory, AddService) already consume.
 */
const { DEFAULTS, VERIFICATION_STATUS, SERVICE_STATUS, INVOICE_STATUS } = require('./constants');

const isoOrNull = (value) => (value ? new Date(value).toISOString() : null);
const firstDefined = (...values) => values.find((v) => v !== undefined);
const billPhotos = (s) => (Array.isArray(s.billPhotoUrls) ? s.billPhotoUrls : (s.billPhotoUrl ? [s.billPhotoUrl] : []));
const todayIso = () => new Date().toISOString().split('T')[0];

function legacyLabourCost(s) {
  if (s.laborCost) return s.laborCost;
  if (!s.laborCharges) return 0;
  return s.laborCharges.reduce((sum, l) => sum + (parseFloat(l.total || l.rate) || 0), 0) || 0;
}

function toGarageListView(s) {
  return {
    id: String(s._id),
    vehicleId: s.vehicleId,
    serviceDate: s.serviceDate,
    odometerKm: s.odometerKm || s.mileage,
    serviceCategory: s.serviceCategory || DEFAULTS.SERVICE_CATEGORY,
    serviceType: s.serviceType,
    partsReplaced: s.partsReplaced || [],
    laborCost: s.laborCost || 0,
    totalCost: s.totalCost || s.cost,
    warrantyMonths: s.warrantyMonths,
    mechanicNotes: s.mechanicNotes,
    verificationStatus: s.verificationStatus || VERIFICATION_STATUS.PENDING,
    paymentStatus: s.paymentStatus || INVOICE_STATUS.UNPAID,
    paidAt: isoOrNull(s.paidAt),
    paymentId: s.paymentId || null,
    createdAt: isoOrNull(s.createdAt),
    vehicle: s.vehicleDetails ? {
      make: s.vehicleDetails.make,
      model: s.vehicleDetails.model,
      registrationNumber: s.vehicleDetails.registrationNumber,
      year: s.vehicleDetails.year,
    } : null,
    customer: s.ownerDetails ? { name: s.ownerDetails.name, email: s.ownerDetails.email } : null,
    billPhotoUrls: billPhotos(s),
  };
}

function toHistoryView(s) {
  const completed = s.status === SERVICE_STATUS.COMPLETED;
  return {
    id: String(s._id),
    vehicleId: s.vehicleId,
    serviceDate: s.serviceDate,
    odometerKm: s.odometerKm || s.mileage || 0,
    serviceCategory: s.serviceCategory || DEFAULTS.SERVICE_CATEGORY,
    serviceType: s.serviceType || s.serviceName || DEFAULTS.HISTORY_SERVICE_TYPE,
    partsReplaced: s.partsReplaced || [],
    laborCost: legacyLabourCost(s),
    laborCharges: s.laborCharges || [],
    additionalCharges: s.additionalCharges || [],
    discount: s.discountAmount || s.discount || 0,
    subtotal: s.subtotalAmount || 0,
    taxAmount: s.taxAmount || 0,
    totalCost: firstDefined(s.totalCost, s.grandTotalAmount, s.totalAmount, s.cost || 0),
    totalAmount: s.totalAmount || s.grandTotalAmount || s.totalCost || s.cost || 0,
    warrantyMonths: s.warrantyMonths || '',
    mechanicNotes: s.mechanicNotes || s.notes || '',
    garageName: s.garageName || DEFAULTS.GARAGE_NAME,
    location: s.location || '',
    verifiedService: s.verifiedService === true || completed,
    recommendedKm: s.recommendedKm || '',
    recommendedDate: s.recommendedDate || '',
    abnormalKmJump: s.abnormalKmJump || false,
    verificationStatus: s.verificationStatus || (completed ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.PENDING),
    status: s.status || SERVICE_STATUS.COMPLETED,
    isArchived: s.isArchived || false,
    billPhotoUrls: billPhotos(s),
    invoiceNumber: s.invoiceNumber || null,
    invoiceStatus: s.invoiceStatus || INVOICE_STATUS.FINALIZED,
    bookingId: s.bookingId || null,
    paymentStatus: s.paymentStatus || (s.paidAt ? 'PAID' : INVOICE_STATUS.UNPAID),
    paidAt: isoOrNull(s.paidAt),
    paymentId: s.paymentId || null,
    paymentMethod: s.paymentMethod || null,
    razorpayOrderId: s.razorpayOrderId || null,
    createdAt: isoOrNull(s.createdAt),
  };
}

/** Prefill payload for the completion form, falling back to booking snapshots for missing docs. */
function toCompletionDetailsView({ booking, service, vehicle, customer, garage, vehicleId, customerId }) {
  const snapshots = (booking && booking.snapshots) || {};
  const snapUser = snapshots.user || {};
  const snapVehicle = snapshots.vehicle || {};
  const snapService = snapshots.service || {};
  const snapGarage = snapshots.garage || {};
  const v = vehicle || {};
  const s = service || {};
  const c = customer || {};
  const g = garage || {};
  return {
    success: true,
    bookingId: booking ? String(booking._id) : null,
    serviceId: service ? String(service._id) : null,
    vehicle: {
      id: vehicle ? String(vehicle._id) : (vehicleId ? String(vehicleId) : ''),
      vehicleNumber: v.vehicleNumber || v.registrationNumber || snapVehicle.vehicleNumber || DEFAULTS.VEHICLE_NUMBER,
      brand: v.brand || v.make || snapVehicle.brand || '',
      model: v.model || snapVehicle.model || '',
      year: v.year || '',
      currentOdometerKm: v.currentOdometerKm || s.odometerKm || 0,
    },
    customer: {
      id: customerId ? String(customerId) : '',
      name: c.name || snapUser.name || DEFAULTS.CUSTOMER_NAME,
      phone: c.phone || snapUser.phone || '',
      email: c.email || snapUser.email || '',
    },
    service: {
      category: s.serviceCategory || DEFAULTS.SERVICE_CATEGORY,
      title: s.serviceType || snapService.title || DEFAULTS.HISTORY_SERVICE_TYPE,
      date: s.serviceDate || todayIso(),
      price: s.totalCost || snapService.price || 0,
      odometer: s.odometerKm || v.currentOdometerKm || '',
    },
    garage: {
      id: garage ? String(garage._id) : '',
      name: g.name || snapGarage.name || DEFAULTS.GARAGE_NAME,
      phone: g.phone || snapGarage.phone || '',
      location: g.city || g.address || snapGarage.address || '',
    },
  };
}

module.exports = { toGarageListView, toHistoryView, toCompletionDetailsView };
