/**
 * Composition root for the passport module: wires repositories, the vehicle access policy, the QR
 * renderer, the health calculator and the public site URL into the passport service. This is the
 * only place in the module that knows about the live database connection.
 */
const { getDb } = require('../../db');
const { createRepositories } = require('../../repositories');
const { isOwner } = require('../../security/vehicleAccess');
const generateQRCode = require('../../utils/generateQRCode');
const calculateHealthScore = require('../../utils/healthCalc');
const { createPassportService } = require('./passportService');
const { writePassportPdf } = require('./passportPdf');

const cache = new WeakMap();

function buildPassportService(db) {
  return createPassportService({
    repos: createRepositories(db),
    isOwner,
    generateQRCode,
    calculateHealthScore,
    frontendUrl: process.env.FRONTEND_URL,
  });
}

/** Passport service bound to the connected database (memoised per Db instance). */
function getPassportService(db = getDb()) {
  if (!cache.has(db)) cache.set(db, buildPassportService(db));
  return cache.get(db);
}

module.exports = { getPassportService, buildPassportService, writePassportPdf };
