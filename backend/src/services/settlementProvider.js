const { getRazorpayInstance } = require('./razorpayService');
const { loadConfig } = require('../config');

/**
 * Base Settlement Provider Interface
 */
class BaseSettlementProvider {
  async processSettlement(params) {
    throw new Error('processSettlement method not implemented');
  }

  async getSettlementStatus(transferId) {
    throw new Error('getSettlementStatus method not implemented');
  }
}

/**
 * Mock / Test Mode Settlement Provider
 * Keeps settlement records completely safe without touching live bank accounts
 */
class MockSettlementProvider extends BaseSettlementProvider {
  constructor() {
    super();
    this.name = 'MOCK_TEST_MODE';
  }

  async processSettlement({ settlement, payoutProfile }) {
    const timestamp = Date.now();
    const mockTransferId = `mock_trf_${settlement.settlementId.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp.toString().slice(-4)}`;

    return {
      success: true,
      provider: this.name,
      transferId: mockTransferId,
      status: 'COMPLETED',
      message: 'Settlement processed in TEST MODE (Ledger Simulation).',
      processedAt: new Date(),
      metadata: {
        mode: 'TEST_MODE',
        bankAccountLast4: payoutProfile?.bankAccountLast4 || 'XXXX',
        ifscMasked: payoutProfile?.ifscMasked || 'XXXX000XXXX'
      }
    };
  }

  async getSettlementStatus(transferId) {
    return {
      transferId,
      provider: this.name,
      status: 'COMPLETED',
      settledAt: new Date()
    };
  }
}

/**
 * Razorpay Route / Linked Account Settlement Provider
 */
class RazorpayRouteSettlementProvider extends BaseSettlementProvider {
  constructor() {
    super();
    this.name = 'RAZORPAY_ROUTE';
  }

  async processSettlement({ settlement, payoutProfile }) {
    if (!payoutProfile?.providerAccountId) {
      throw new Error('Garage linked bank account (Razorpay Route account ID) is not configured.');
    }

    const razorpay = getRazorpayInstance();
    const amountInPaise = Math.round(Number(settlement.approvedAmount || settlement.requestedAmount) * 100);

    try {
      // Direct Razorpay Route Transfer
      const transfer = await razorpay.transfers.create({
        account: payoutProfile.providerAccountId,
        amount: amountInPaise,
        currency: 'INR',
        notes: {
          settlementId: settlement.settlementId,
          garageId: settlement.garageId,
          platform: 'DrivePortz'
        }
      });

      return {
        success: true,
        provider: this.name,
        transferId: transfer.id,
        status: transfer.status === 'processed' ? 'COMPLETED' : 'PROCESSING',
        processedAt: new Date(),
        metadata: transfer
      };
    } catch (err) {
      console.error('Razorpay Route Transfer Error:', err);
      throw new Error(`Razorpay Route transfer failed: ${err.message}`);
    }
  }

  async getSettlementStatus(transferId) {
    const razorpay = getRazorpayInstance();
    try {
      const transfer = await razorpay.transfers.fetch(transferId);
      return {
        transferId,
        provider: this.name,
        status: transfer.status === 'processed' ? 'COMPLETED' : 'PROCESSING',
        raw: transfer
      };
    } catch (err) {
      throw new Error(`Error fetching transfer status: ${err.message}`);
    }
  }
}

/**
 * Factory returning active settlement provider
 */
function getSettlementProvider() {
  const providerType = (process.env.SETTLEMENT_PROVIDER || 'mock').toLowerCase();

  if (providerType === 'razorpay' || providerType === 'route') {
    return new RazorpayRouteSettlementProvider();
  }

  return new MockSettlementProvider();
}

module.exports = {
  BaseSettlementProvider,
  MockSettlementProvider,
  RazorpayRouteSettlementProvider,
  getSettlementProvider
};
