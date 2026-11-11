/**
 * Dynamically loads the official Cashfree Drop.js SDK if not already present.
 * SDK docs: https://docs.cashfree.com/docs/cashfree-js-integration
 * @returns {Promise<boolean>} Resolves true when Cashfree SDK is ready.
 */
export function loadCashfreeScript() {
  return new Promise((resolve) => {
    // Already loaded
    if (window.Cashfree) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById('cashfree-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(!!window.Cashfree));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'cashfree-checkout-script';
    // Official Cashfree Drop.js (v3) – works for both sandbox and production
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;

    script.onload = () => {
      resolve(typeof window.Cashfree !== 'undefined');
    };

    script.onerror = () => {
      console.error('Failed to load Cashfree Drop.js SDK');
      resolve(false);
    };

    document.body.appendChild(script);
  });
}
