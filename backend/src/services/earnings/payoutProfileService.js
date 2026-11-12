/**
 * The garage's payout bank profile. Only masked details are persisted: the last four digits of the
 * account number and a masked IFSC. Input is validated so an object or junk string can no longer be
 * stored as "bank details".
 */
const { ValidationError } = require('../../core/errors');
const { asString } = require('../../core/text');
const { PAYOUT_PROFILE, MSG } = require('./constants');
const { toPayoutProfile } = require('./earningsPresenters');

function maskIfsc(ifsc) {
  return `${ifsc.slice(0, 4)}***${ifsc.slice(-3)}`;
}

/** Validates and masks the submitted bank details. Pure. */
function buildMaskedProfile(body = {}) {
  const accountHolderName = asString(body.accountHolderName, { maxLength: PAYOUT_PROFILE.NAME_MAX });
  const accountNumber = asString(body.accountNumber, { maxLength: 40 }).replace(/[\s-]/g, '');
  const ifscCode = asString(body.ifscCode, { maxLength: 20 }).toUpperCase();
  if (!accountHolderName || !accountNumber || !ifscCode) throw new ValidationError(MSG.PROFILE_REQUIRED);
  if (!PAYOUT_PROFILE.ACCOUNT_NUMBER_PATTERN.test(accountNumber)) throw new ValidationError(MSG.ACCOUNT_INVALID);
  if (!PAYOUT_PROFILE.IFSC_PATTERN.test(ifscCode)) throw new ValidationError(MSG.IFSC_INVALID);
  return {
    accountHolderName,
    bankAccountLast4: accountNumber.slice(-4),
    bankName: asString(body.bankName, { maxLength: PAYOUT_PROFILE.NAME_MAX }) || PAYOUT_PROFILE.DEFAULT_BANK_NAME,
    ifscMasked: maskIfsc(ifscCode),
    verified: true,
  };
}

/**
 * @param {{ repos: object, resolveGarageIds: Function, now?: () => Date }} deps
 */
function createPayoutProfileService({ repos, resolveGarageIds, now = () => new Date() }) {
  async function getProfile(user) {
    return toPayoutProfile(await repos.payoutProfiles.findForGarage(await resolveGarageIds(String(user.id))));
  }

  async function saveProfile(user, body) {
    const fields = buildMaskedProfile(body);
    await repos.payoutProfiles.upsertForGarage(String(user.id), fields, now());
    return toPayoutProfile(fields);
  }

  return { getProfile, saveProfile };
}

module.exports = { createPayoutProfileService, buildMaskedProfile };
