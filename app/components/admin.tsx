// Small pieces for the admin pages.

/** US dollars: cents shown down to a tenth of a cent for small amounts ("$0.004", "$12.30"). */
export function usd(n: number): string {
  if (!n) return "$0";
  if (Math.abs(n) < 1) return `$${n.toFixed(n < 0.01 ? 4 : 3)}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "15 Oct" style date, in Sydney time. */
export function shortDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Sydney" });
}
