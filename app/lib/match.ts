// Is the merchant's brand in this AI answer? Pure helpers (tested).

export function brandKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/\b(the|co|company|pty|ltd|inc|australia|au|nz)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, case-insensitive match of any brand name in the text. */
export function textNamesBrand(text: string, names: string[]): boolean {
  const lower = text.toLowerCase();
  return names
    .map((n) => n.trim())
    .filter((n) => n.length >= 3)
    .some((n) => new RegExp(`(^|[^a-z0-9])${escape(n.toLowerCase())}([^a-z0-9]|$)`).test(lower));
}

/** Does any source URL belong to one of the merchant's domains? */
export function sourcesIncludeDomain(sourceDomains: string[], merchantDomains: string[]): boolean {
  const mine = merchantDomains.map((d) => d.replace(/^www\./, "").toLowerCase()).filter(Boolean);
  return sourceDomains.some((d) => mine.some((m) => d === m || d.endsWith(`.${m}`)));
}

/** Same brand? ("The Groomed Man Co." vs "Groomed Man Co") */
export function sameBrand(a: string, b: string): boolean {
  const ka = brandKey(a);
  const kb = brandKey(b);
  return ka.length >= 3 && kb.length >= 3 && (ka === kb || (ka.length >= 5 && kb.length >= 5 && (ka.includes(kb) || kb.includes(ka))));
}

/** First position (1-based) of the merchant in an ordered brand list, or null. */
export function merchantPosition(brands: string[], merchantNames: string[]): number | null {
  const idx = brands.findIndex((b) => merchantNames.some((m) => sameBrand(b, m)));
  return idx === -1 ? null : idx + 1;
}
