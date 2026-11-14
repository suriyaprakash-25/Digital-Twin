/**
 * Response mapping for the three dispute routers (My Disputes, garage disputes, admin console).
 */
function commonListFields(d) {
  return {
    id: String(d._id),
    disputeNumber: d.disputeNumber,
    invoiceNumber: d.invoiceNumber,
  };
}

const detailFields = (d) => ({
  serviceType: d.serviceType,
  vehicleNumber: d.vehicleNumber,
  category: d.category,
  subject: d.subject,
  disputedAmount: d.disputedAmount,
  status: d.status,
});

/** GET /api/disputes item. */
const toUserListItem = (d) => ({ ...commonListFields(d), garageName: d.garageName, ...detailFields(d), resolution: d.resolution, date: d.createdAt });

/** GET /api/garage/disputes item. */
const toGarageListItem = (d) => ({ ...commonListFields(d), ...detailFields(d), garageResponse: d.garageResponse, date: d.createdAt });

/** GET /api/admin/disputes item. */
const toAdminListItem = (d) => ({ ...commonListFields(d), garageName: d.garageName, ...detailFields(d), resolution: d.resolution, resolutionNote: d.resolutionNote, date: d.createdAt });

const toTimelineItem = (t) => ({ id: String(t._id), actorRole: t.actorRole, action: t.action, message: t.message, metadata: t.metadata, date: t.createdAt });

/** Shared list envelope; totalPages keeps its historical formula (0 for an empty list). */
function toListBody(items, present, { total, page, limit }) {
  return { success: true, disputes: items.map(present), totalCount: total, totalPages: Math.ceil(total / limit), currentPage: page };
}

/** GET /api/disputes/:id and /api/admin/disputes/:id. */
function toDetailBody(dispute, events) {
  return { success: true, dispute: { id: String(dispute._id), ...dispute }, timeline: events.map(toTimelineItem) };
}

module.exports = { toUserListItem, toGarageListItem, toAdminListItem, toTimelineItem, toListBody, toDetailBody };
