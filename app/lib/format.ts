// Formatting helpers shared by server and UI.

/**
 * A store's own money in its own symbol: "$4,820", "£4,820", "€4,820". The store knows its currency, so
 * the short symbol reads better than "USD 4,820" (what an Australian locale prints for other dollars).
 */
export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
      // "$12.50", never "$12.5"; whole amounts and big ones stay round ("$40", "$4,820").
      minimumFractionDigits: amount >= 1000 || Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(0)}`;
  }
}

export const formatNumber = (n: number) => new Intl.NumberFormat("en").format(n);

export function formatPct(fraction: number | null | undefined, digits = 0): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "–";
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) {
    const h = Math.round(s / 3600);
    return h === 1 ? "an hour ago" : `${h} hours ago`;
  }
  const days = Math.round(s / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); // "11 Oct"
