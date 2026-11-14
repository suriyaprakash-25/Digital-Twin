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
const { InvoiceRepository } = require('./InvoiceRepository');
const { PayoutProfileRepository } = require('./PayoutProfileRepository');
const { DisputeRepository } = require('./DisputeRepository');
const { DisputeEventRepository } = require('./DisputeEventRepository');
const { TransferRepository } = require('./TransferRepository');
const { OwnershipHistoryRepository } = require('./OwnershipHistoryRepository');
const { InsuranceRepository } = require('./InsuranceRepository');
const { MediaRepository } = require('./MediaRepository');
const { DiagnosisRepository } = require('./DiagnosisRepository');

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
    invoices: new InvoiceRepository(db),
    payoutProfiles: new PayoutProfileRepository(db),
    disputes: new DisputeRepository(db),
    disputeEvents: new DisputeEventRepository(db),
    transfers: new TransferRepository(db),
    ownershipHistory: new OwnershipHistoryRepository(db),
    insurance: new InsuranceRepository(db),
    media: new MediaRepository(db),
    diagnoses: new DiagnosisRepository(db),
  };
}

module.exports = { createRepositories };
