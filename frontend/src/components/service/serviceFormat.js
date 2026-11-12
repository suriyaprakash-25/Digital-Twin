/** Rupee amount with two decimals, e.g. 1234.5 -> "₹1,234.50". */
export const formatRupees = (value) => `₹${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
