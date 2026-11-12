/**
 * Who may see an invoice, and the related party lookups (vehicle, garage, customer).
 *
 * Viewers: the billed customer, an admin, the issuing garage (creator, or the garage the service was
 * billed under), or the vehicle's current owner. A current owner who was not the billed customer
 * (invoice from before an ownership transfer) sees the invoice without the previous owner's contact
 * details, and the issuing garage always sees the customer it billed, never a later owner.
 */
const { ForbiddenError } = require('../../core/errors');
const { toObjectId } = require('../../repositories/BaseRepository');
const { toCustomer } = require('./invoicePresenters');

const RELATION = Object.freeze({ CUSTOMER: 'CUSTOMER', ADMIN: 'ADMIN', GARAGE: 'GARAGE', VEHICLE_OWNER: 'VEHICLE_OWNER' });
const CUSTOMER_PROJECTION = Object.freeze({ name: 1, email: 1, phone: 1 });

const sameId = (a, b) => a !== undefined && a !== null && a !== '' && String(a) === String(b);

/**
 * @param {{ repos: object, resolveGarageIds: (userId: string) => Promise<string[]> }} deps
 */
function createInvoiceAccess({ repos, resolveGarageIds }) {
  async function isIssuingGarage(user, service) {
    if (sameId(service.createdBy, user.id)) return true;
    if (user.role !== 'GARAGE' || !service.garageId) return false;
    const ids = await resolveGarageIds(user.id);
    return ids.includes(String(service.garageId));
  }

  /**
   * @returns {Promise<{ vehicle: object|null, relation: string }>}
   * @throws {ForbiddenError}
   */
  async function authorize(user, service, forbiddenMessage) {
    const vehicle = await repos.vehicles.findActiveById(service.vehicleId);
    let relation = null;
    if (sameId(service.ownerId, user.id)) relation = RELATION.CUSTOMER;
    else if (user.role === 'ADMIN') relation = RELATION.ADMIN;
    else if (await isIssuingGarage(user, service)) relation = RELATION.GARAGE;
    else if (vehicle && sameId(vehicle.ownerId, user.id)) relation = RELATION.VEHICLE_OWNER;
    if (!relation) throw new ForbiddenError(forbiddenMessage);
    return { vehicle, relation };
  }

  async function loadGarage(service) {
    let garage = null;
    if (service.createdBy) garage = await repos.garages.findByOwner(String(service.createdBy), { activeOnly: true });
    if (!garage && service.garageId) {
      const garageObjectId = toObjectId(service.garageId);
      if (garageObjectId) garage = await repos.garages.findOne({ _id: garageObjectId });
    }
    return garage;
  }

  /** The billed customer (falling back to the vehicle owner on legacy rows), shaped for display. */
  async function loadCustomer({ user, service, vehicle, relation }) {
    const customerId = service.ownerId || (vehicle && vehicle.ownerId);
    if (!customerId) return null;
    if (relation === RELATION.VEHICLE_OWNER && !sameId(customerId, user.id)) return toCustomer(null, { visible: false });
    const objectId = toObjectId(customerId);
    const filter = objectId ? { _id: objectId } : { uid: String(customerId) };
    const userDoc = await repos.users.findOne(filter, { projection: CUSTOMER_PROJECTION });
    return userDoc ? toCustomer(userDoc) : null;
  }

  /** Authorises the viewer and loads every party shown on an invoice or receipt. */
  async function loadParties(user, service, forbiddenMessage) {
    const { vehicle, relation } = await authorize(user, service, forbiddenMessage);
    const [garage, customer] = await Promise.all([loadGarage(service), loadCustomer({ user, service, vehicle, relation })]);
    return { vehicle, relation, garage, customer };
  }

  return { authorize, isIssuingGarage, loadGarage, loadCustomer, loadParties };
}

module.exports = { createInvoiceAccess, RELATION };
