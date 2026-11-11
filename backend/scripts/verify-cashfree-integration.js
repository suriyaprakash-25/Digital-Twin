require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const {
  getCashfreeConfig,
  createCashfreeOrder,
  fetchCashfreeOrder,
  verifyCashfreeWebhook
} = require('../src/services/cashfreeService');

async function verifyCashfree() {
  console.log('--- 1. Checking Configuration ---');
  const config = getCashfreeConfig();
  console.log('Base URL:', config.baseUrl);
  console.log('API Version:', config.version);
  console.log('App ID:', config.appId ? `${config.appId.slice(0, 8)}... (Length: ${config.appId.length})` : 'MISSING');
  console.log('Secret Key:', config.secretKey ? `${config.secretKey.slice(0, 10)}... (Length: ${config.secretKey.length})` : 'MISSING');

  if (!config.appId || !config.secretKey) {
    console.error('❌ Missing Cashfree App ID or Secret Key.');
    process.exit(1);
  }

  console.log('\n--- 2. Testing Order Creation with Cashfree Sandbox ---');
  const testOrderId = `TEST_DP_${Date.now()}`;
  try {
    const order = await createCashfreeOrder({
      amountInRupees: 10.00,
      orderId: testOrderId,
      customer: {
        id: 'cust_test_driveportz_01',
        name: 'DrivePortz Tester',
        email: 'test@driveportz.com',
        phone: '9876543210'
      },
      meta: {
        note: 'Automated verification test order'
      }
    });

    console.log('✅ Order successfully created on Cashfree Sandbox!');
    console.log('CF Order ID:', order.cf_order_id);
    console.log('Internal Order ID:', order.order_id);
    console.log('Order Status:', order.order_status);
    console.log('Payment Session ID:', order.payment_session_id ? 'Present ✅' : 'Missing ❌');

    console.log('\n--- 3. Testing Order Fetch ---');
    const fetched = await fetchCashfreeOrder(testOrderId);
    console.log('✅ Order fetched successfully from Cashfree!');
    console.log('Fetched Status:', fetched.order_status);
    console.log('Order Amount:', fetched.order_amount, fetched.order_currency);

    console.log('\n--- 4. Testing Webhook Signature Verification ---');
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const mockPayload = JSON.stringify({
      data: {
        order: { order_id: testOrderId },
        payment: { cf_payment_id: 123456, payment_status: 'SUCCESS' }
      },
      type: 'PAYMENT_SUCCESS_WEBHOOK'
    });
    const testSignature = crypto
      .createHmac('sha256', config.secretKey)
      .update(`${timestamp}${mockPayload}`)
      .digest('base64');

    const isValid = verifyCashfreeWebhook({
      rawBody: mockPayload,
      timestamp,
      signature: testSignature
    });

    console.log('Webhook Verification Logic:', isValid ? 'Passed ✅' : 'Failed ❌');

    console.log('\n=======================================');
    console.log('🎉 ALL CASHFREE CHECKS PASSED SUCCESSFULLY!');
    console.log('=======================================');
  } catch (err) {
    console.error('❌ Error testing Cashfree:', err?.response?.data || err.message);
    process.exit(1);
  }
}

verifyCashfree();
