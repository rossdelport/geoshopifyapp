// Small text helpers for the tool pages. Pure and browser-safe.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-11" -> "11 October 2026" (read as a UTC date, English month names, no weekday). Bad input comes back as it is. */
export function formatUpdated(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(m[3])) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * plural(1, "bot") -> "1 bot", plural(3, "bot") -> "3 bots", plural(2, "search", "searches") -> "2 searches",
 * plural(1200, "line") -> "1,200 lines".
 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${new Intl.NumberFormat("en").format(n)} ${n === 1 ? one : many}`;
}
