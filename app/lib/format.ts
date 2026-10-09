// Formatting helpers shared by server and UI.

export function formatMoney(amount: number, currency = "AUD"): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(0)}`;
  }
}

export const formatNumber = (n: number) => new Intl.NumberFormat("en-AU").format(n);

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
  if (s < 86400) return `${Math.round(s / 3600)} hours ago`;
  const days = Math.round(s / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
