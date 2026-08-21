import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from '../utils/api';

const TERMINAL_STATUSES = ['CAPTURED', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'];

/**
 * Safely synchronizes and polls payment status with exponential backoff
 * Stops immediately upon reaching terminal state or max attempts
 */
export async function pollPaymentStatus(paymentId, {
  maxAttempts = 10,
  initialDelayMs = 1500,
  onStatusChange = null
} = {}) {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/payments/details/${paymentId}`, {
        headers: getAuthHeaders()
      });

      if (res.data?.success && res.data?.payment) {
        const payment = res.data.payment;
        if (onStatusChange) onStatusChange(payment);

        if (TERMINAL_STATUSES.includes(payment.status)) {
          return { isTerminal: true, payment, attempts: attempt };
        }
      }
    } catch (err) {
      console.warn(`Payment poll attempt ${attempt} failed:`, err.message);
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 10000); // Exponential backoff capped at 10s
    }
  }

  return { isTerminal: false, payment: null, attempts: attempt };
}
