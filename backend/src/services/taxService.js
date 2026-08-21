const { getDb } = require('../db');

const DEFAULT_GST_RATE = 18; // 18% default GST on auto repairs/services

/**
 * Retrieves the effective tax rate from configurable rules
 */
async function getEffectiveTaxRate({ taxType = 'GST', stateCode = null, serviceCategory = null, atDate = new Date(), dbInstance }) {
  const db = dbInstance || getDb();
  if (!db) return DEFAULT_GST_RATE;

  const taxConfigs = db.collection('tax_configurations');
  const targetDate = new Date(atDate);

  const andConditions = [
    { taxType },
    { active: true },
    { effectiveFrom: { $lte: targetDate } },
    { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: targetDate } }] }
  ];

  if (stateCode) {
    andConditions.push({ $or: [{ stateCode: String(stateCode).toUpperCase() }, { stateCode: null }] });
  }

  const config = await taxConfigs.findOne({ $and: andConditions }, { sort: { createdAt: -1 } });
  return config && typeof config.rate === 'number' ? config.rate : DEFAULT_GST_RATE;
}

/**
 * Calculates server-side tax breakdown in integer paise
 * @param {Object} params
 * @param {number} params.amountPaise - Base taxable amount in paise
 * @param {string} [params.sellerState] - e.g. 'KA', 'MH', 'TN'
 * @param {string} [params.buyerState] - e.g. 'KA', 'MH', 'DL'
 * @param {boolean} [params.isTaxExempt] - If true, 0% tax applies
 * @param {string} [params.serviceCategory]
 * @param {Date} [params.atDate]
 * @param {Object} [params.dbInstance]
 * @returns {Promise<Object>} Tax calculation details
 */
async function calculateTax({
  amountPaise,
  sellerState = 'KA',
  buyerState = 'KA',
  isTaxExempt = false,
  serviceCategory = 'AUTOMOTIVE_SERVICE',
  atDate = new Date(),
  dbInstance
}) {
  const taxablePaise = Math.round(Number(amountPaise) || 0);

  if (isTaxExempt || taxablePaise <= 0) {
    return {
      taxablePaise,
      taxableAmount: taxablePaise / 100,
      rate: 0,
      cgstPaise: 0,
      cgstAmount: 0,
      sgstPaise: 0,
      sgstAmount: 0,
      igstPaise: 0,
      igstAmount: 0,
      totalTaxPaise: 0,
      totalTaxAmount: 0,
      grandTotalPaise: taxablePaise,
      grandTotalAmount: taxablePaise / 100,
      isTaxExempt: true,
      isIntrastate: true,
      taxType: 'EXEMPT'
    };
  }

  const rate = await getEffectiveTaxRate({ serviceCategory, stateCode: sellerState, atDate, dbInstance });
  const isIntrastate = Boolean(sellerState && buyerState && sellerState.toUpperCase().trim() === buyerState.toUpperCase().trim());

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (isIntrastate) {
    // Split equally into CGST (rate / 2) and SGST (rate / 2)
    const halfRate = rate / 2;
    cgstPaise = Math.round(taxablePaise * (halfRate / 100));
    sgstPaise = Math.round(taxablePaise * (halfRate / 100));
  } else {
    // Full IGST
    igstPaise = Math.round(taxablePaise * (rate / 100));
  }

  const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
  const grandTotalPaise = taxablePaise + totalTaxPaise;

  return {
    taxablePaise,
    taxableAmount: taxablePaise / 100,
    rate,
    cgstPaise,
    cgstAmount: cgstPaise / 100,
    sgstPaise,
    sgstAmount: sgstPaise / 100,
    igstPaise,
    igstAmount: igstPaise / 100,
    totalTaxPaise,
    totalTaxAmount: totalTaxPaise / 100,
    grandTotalPaise,
    grandTotalAmount: grandTotalPaise / 100,
    isTaxExempt: false,
    isIntrastate,
    taxType: isIntrastate ? 'CGST_SGST' : 'IGST'
  };
}

/**
 * Creates an immutable tax snapshot for attachment to invoices
 */
async function createTaxSnapshot(params) {
  const taxDetails = await calculateTax(params);
  return {
    ...taxDetails,
    sellerState: params.sellerState || 'KA',
    buyerState: params.buyerState || 'KA',
    sellerGstin: params.sellerGstin || null,
    buyerGstin: params.buyerGstin || null,
    snapshotTimestamp: new Date()
  };
}

/**
 * Creates or updates a tax configuration record
 */
async function setTaxConfiguration({
  taxType = 'GST',
  rate = 18,
  stateCode = null,
  serviceCategory = null,
  effectiveFrom = new Date(),
  effectiveTo = null,
  active = true,
  dbInstance
}) {
  const db = dbInstance || getDb();
  const taxConfigs = db.collection('tax_configurations');
  const now = new Date();

  const doc = {
    taxType,
    rate: Number(rate),
    stateCode: stateCode ? String(stateCode).toUpperCase() : null,
    serviceCategory: serviceCategory || null,
    effectiveFrom: new Date(effectiveFrom),
    effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
    active: Boolean(active),
    createdAt: now,
    updatedAt: now
  };

  const res = await taxConfigs.insertOne(doc);
  return { success: true, configId: res.insertedId, config: doc };
}

module.exports = {
  DEFAULT_GST_RATE,
  getEffectiveTaxRate,
  calculateTax,
  createTaxSnapshot,
  setTaxConfiguration
};
