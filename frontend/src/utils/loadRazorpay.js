/**
 * Dynamically loads the official Razorpay Checkout script if not already present in document.
 * @returns {Promise<boolean>} Resolves true when Razorpay SDK is ready.
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      resolve(true);
    };

    script.onerror = () => {
      console.error('Failed to load Razorpay Checkout SDK');
      resolve(false);
    };

    document.body.appendChild(script);
  });
}
