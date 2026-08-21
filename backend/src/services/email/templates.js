/**
 * Financial & Platform Email Templates with Sensitive Data Masking
 */

function baseLayout({ title, content, footerText = 'DrivePortz Mobility Digital Twin Platform' }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%); padding: 24px 32px; text-align: left; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 32px; color: #e2e8f0; font-size: 15px; line-height: 1.6; }
    .card { background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
    .card-row:last-child { margin-bottom: 0; }
    .card-label { color: #94a3b8; }
    .card-value { color: #f8fafc; font-weight: 600; text-align: right; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; }
    .status-success { background-color: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .status-warning { background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .status-danger { background-color: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .footer { padding: 20px 32px; background-color: #1e293b; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DrivePortz Finance</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${footerText}</p>
      <p>© ${new Date().getFullYear()} DrivePortz Technologies. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function renderPaymentSuccessEmail({ customerName = 'Valued Customer', invoiceNumber, amount, paymentId, serviceName }) {
  const content = `
    <h2 style="color: #34d399; margin-top: 0;">Payment Successful</h2>
    <p>Hello ${customerName},</p>
    <p>Your payment for <strong>${serviceName || 'Automotive Service'}</strong> has been received and confirmed.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Invoice Number</span><span class="card-value">${invoiceNumber || 'N/A'}</span></div>
      <div class="card-row"><span class="card-label">Payment ID</span><span class="card-value">${paymentId || 'N/A'}</span></div>
      <div class="card-row"><span class="card-label">Amount Paid</span><span class="card-value" style="color: #34d399; font-size: 16px;">₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value"><span class="status-badge status-success">CAPTURED</span></span></div>
    </div>
    <p>You can view and print your official tax invoice anytime from your <a href="https://www.driveportz.com/payments" style="color: #38bdf8;">Payment Center</a>.</p>
  `;
  return {
    subject: `Payment Confirmed: ₹${amount} for Invoice ${invoiceNumber || ''}`,
    html: baseLayout({ title: 'Payment Confirmed', content }),
    text: `Payment Confirmed!\nInvoice: ${invoiceNumber}\nAmount: ₹${amount}\nPayment ID: ${paymentId}\nStatus: CAPTURED`
  };
}

function renderPaymentFailedEmail({ customerName = 'Valued Customer', invoiceNumber, amount, failureReason }) {
  const content = `
    <h2 style="color: #f87171; margin-top: 0;">Payment Failed</h2>
    <p>Hello ${customerName},</p>
    <p>We were unable to complete your payment for invoice <strong>${invoiceNumber || 'N/A'}</strong>.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Invoice Number</span><span class="card-value">${invoiceNumber || 'N/A'}</span></div>
      <div class="card-row"><span class="card-label">Amount</span><span class="card-value">₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
      <div class="card-row"><span class="card-label">Reason</span><span class="card-value" style="color: #f87171;">${failureReason || 'Transaction was declined by bank'}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value"><span class="status-badge status-danger">FAILED</span></span></div>
    </div>
    <p>Please return to your <a href="https://www.driveportz.com/payments" style="color: #38bdf8;">Payment Center</a> to retry the transaction.</p>
  `;
  return {
    subject: `Action Required: Payment Failed for Invoice ${invoiceNumber || ''}`,
    html: baseLayout({ title: 'Payment Failed', content }),
    text: `Payment Failed.\nInvoice: ${invoiceNumber}\nAmount: ₹${amount}\nReason: ${failureReason}`
  };
}

function renderRefundCompletedEmail({ customerName = 'Valued Customer', invoiceNumber, refundAmount, refundId }) {
  const content = `
    <h2 style="color: #38bdf8; margin-top: 0;">Refund Processed</h2>
    <p>Hello ${customerName},</p>
    <p>A refund has been credited to your original payment method for invoice <strong>${invoiceNumber || 'N/A'}</strong>.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Invoice Number</span><span class="card-value">${invoiceNumber || 'N/A'}</span></div>
      <div class="card-row"><span class="card-label">Refund ID</span><span class="card-value">${refundId || 'N/A'}</span></div>
      <div class="card-row"><span class="card-label">Refunded Amount</span><span class="card-value" style="color: #38bdf8; font-size: 16px;">₹${Number(refundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value"><span class="status-badge status-success">REFUND_COMPLETED</span></span></div>
    </div>
    <p>Depending on your bank, it typically takes 5–7 working days for the credit to reflect on your statement.</p>
  `;
  return {
    subject: `Refund Processed: ₹${refundAmount} for Invoice ${invoiceNumber || ''}`,
    html: baseLayout({ title: 'Refund Processed', content }),
    text: `Refund Processed.\nInvoice: ${invoiceNumber}\nRefund ID: ${refundId}\nAmount: ₹${refundAmount}`
  };
}

function renderSettlementSettledEmail({ garageName = 'Partner Garage', settlementNumber, netAmount, bankAccountLast4 }) {
  const content = `
    <h2 style="color: #34d399; margin-top: 0;">Settlement Payout Complete</h2>
    <p>Hello ${garageName},</p>
    <p>Your payout batch <strong>${settlementNumber}</strong> has been processed to your registered bank account.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Settlement Batch</span><span class="card-value">${settlementNumber}</span></div>
      <div class="card-row"><span class="card-label">Beneficiary Account</span><span class="card-value">•••• •••• ${bankAccountLast4 || 'XXXX'}</span></div>
      <div class="card-row"><span class="card-label">Net Payout</span><span class="card-value" style="color: #34d399; font-size: 16px;">₹${Number(netAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value"><span class="status-badge status-success">SETTLED</span></span></div>
    </div>
    <p>You can view the detailed breakdown in your <a href="https://www.driveportz.com/garage/financial-center" style="color: #38bdf8;">Garage Financial Center</a>.</p>
  `;
  return {
    subject: `Settlement Disbursed: ₹${netAmount} (${settlementNumber})`,
    html: baseLayout({ title: 'Settlement Payout Complete', content }),
    text: `Settlement Disbursed.\nBatch: ${settlementNumber}\nNet Payout: ₹${netAmount}\nAccount: •••• ${bankAccountLast4}`
  };
}

function renderSettlementFailedEmail({ garageName = 'Partner Garage', settlementNumber, failureReason }) {
  const content = `
    <h2 style="color: #f87171; margin-top: 0;">Settlement Processing Issue</h2>
    <p>Hello ${garageName},</p>
    <p>We encountered an issue while processing settlement batch <strong>${settlementNumber}</strong>.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Settlement Batch</span><span class="card-value">${settlementNumber}</span></div>
      <div class="card-row"><span class="card-label">Issue Reason</span><span class="card-value" style="color: #f87171;">${failureReason || 'Bank routing rejection'}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value"><span class="status-badge status-warning">RETRY_PENDING</span></span></div>
    </div>
    <p>Our automated retry engine will re-attempt processing automatically. You may also review your bank details in the Garage Financial Center.</p>
  `;
  return {
    subject: `Settlement Payout Issue: ${settlementNumber}`,
    html: baseLayout({ title: 'Settlement Processing Issue', content }),
    text: `Settlement Payout Issue.\nBatch: ${settlementNumber}\nReason: ${failureReason}\nStatus: RETRY_PENDING`
  };
}

function renderRiskAlertEmail({ adminName = 'Finance Team', alertNumber, alertType, severity, message }) {
  const content = `
    <h2 style="color: #fbbf24; margin-top: 0;">[${severity}] Financial Alert</h2>
    <p>Hello ${adminName},</p>
    <p>The automated financial risk and integrity monitoring engine detected a condition requiring attention.</p>
    <div class="card">
      <div class="card-row"><span class="card-label">Alert ID</span><span class="card-value">${alertNumber}</span></div>
      <div class="card-row"><span class="card-label">Type</span><span class="card-value">${alertType}</span></div>
      <div class="card-row"><span class="card-label">Severity</span><span class="card-value"><span class="status-badge status-danger">${severity}</span></span></div>
      <div class="card-row"><span class="card-label">Details</span><span class="card-value">${message}</span></div>
    </div>
    <p>Investigate and resolve in the <a href="https://www.driveportz.com/admin/financial-command-center" style="color: #38bdf8;">Admin Financial Command Center</a>.</p>
  `;
  return {
    subject: `[${severity}] Financial Alert: ${alertType} (${alertNumber})`,
    html: baseLayout({ title: 'Financial Alert', content }),
    text: `[${severity}] Financial Alert: ${alertType}\nAlert ID: ${alertNumber}\nDetails: ${message}`
  };
}

module.exports = {
  renderPaymentSuccessEmail,
  renderPaymentFailedEmail,
  renderRefundCompletedEmail,
  renderSettlementSettledEmail,
  renderSettlementFailedEmail,
  renderRiskAlertEmail
};
