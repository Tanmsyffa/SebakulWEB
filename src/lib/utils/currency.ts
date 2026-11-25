/**
 * Format a number as Indonesian Rupiah (e.g., Rp1.250.000)
 * Uses dot as thousands separator per Indonesian convention.
 */
export function formatRupiah(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(num)) return "Rp0";

  const isNegative = num < 0;
  const absoluteValue = Math.abs(Math.round(num));

  const formatted = absoluteValue
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${isNegative ? "-" : ""}Rp${formatted}`;
}

