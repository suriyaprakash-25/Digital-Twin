/**
 * Repository factory (Abstract Factory). Services receive `repos` from here; tests can pass a
 * fake db or fake repositories instead.
 */
const { getDb } = require('../db');
const { UserRepository } = require('./UserRepository');
const { GarageRepository } = require('./GarageRepository');
const { GarageServiceRepository } = require('./GarageServiceRepository');
const { ReviewRepository } = require('./ReviewRepository');
const { VehicleRepository } = require('./VehicleRepository');
const { ServiceRecordRepository } = require('./ServiceRecordRepository');
const { BookingRepository } = require('./BookingRepository');
const { PaymentRepository } = require('./PaymentRepository');
const { EarningsRepository } = require('./EarningsRepository');
const { SettlementRepository } = require('./SettlementRepository');

function createRepositories(db = getDb()) {
  return {
    users: new UserRepository(db),
    garages: new GarageRepository(db),
    garageServices: new GarageServiceRepository(db),
    reviews: new ReviewRepository(db),
    vehicles: new VehicleRepository(db),
    serviceRecords: new ServiceRecordRepository(db),
    bookings: new BookingRepository(db),
    payments: new PaymentRepository(db),
    earnings: new EarningsRepository(db),
    settlements: new SettlementRepository(db),
  };
}

module.exports = { createRepositories };
