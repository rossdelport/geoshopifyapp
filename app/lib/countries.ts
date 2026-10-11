// Countries a store can pick as "where your customers are" (Settings). Stores sell worldwide, so the
// list is sorted by name with no country first, and the store's own country is always offered even
// when it isn't in the list. Safe for the browser: no server imports.

/** Common Shopify markets. Keep in step with LOCATION_CODES in treg.server.ts (others scan as the US). */
export const MARKET_COUNTRIES = [
  "AE", "AT", "AU", "BE", "BR", "CA", "CH", "DE", "DK", "ES", "FI", "FR", "GB", "HK", "IE",
  "IN", "IT", "JP", "MX", "MY", "NL", "NO", "NZ", "PH", "PL", "PT", "SE", "SG", "US", "ZA",
] as const;

export type MarketCountry = (typeof MARKET_COUNTRIES)[number];

export const isMarketCountry = (c: string | null | undefined): c is MarketCountry => (MARKET_COUNTRIES as readonly string[]).includes((c ?? "").toUpperCase());

let names: Intl.DisplayNames | null = null;

// Most country names come from the runtime's list ("Germany", "Japan"); these are the ones a shopper
// says differently in a sentence ("best beard oil in the US").
const SHOPPER_NAMES: Record<string, string> = {
  US: "the US", GB: "the UK", AE: "the UAE", NL: "the Netherlands", PH: "the Philippines",
  DO: "the Dominican Republic", CZ: "the Czech Republic", BS: "the Bahamas", GM: "the Gambia",
  HK: "Hong Kong", MO: "Macau", TR: "Turkey",
};

/** "DE" -> "Germany", "US" -> "the US": the country as a shopper says it. Anything else comes back unchanged. */
export function shopperCountryName(code: string): string {
  const c = (code ?? "").trim().toUpperCase();
  if (SHOPPER_NAMES[c]) return SHOPPER_NAMES[c];
  if (!/^[A-Z]{2}$/.test(c)) return code;
  const name = regionName(c);
  return name === c ? code : name;
}

// Each market's main time zone, and whether its shoppers write the month first ("October 11, 2026").
const TIME_ZONES: Record<MarketCountry, string> = {
  AE: "Asia/Dubai", AT: "Europe/Vienna", AU: "Australia/Sydney", BE: "Europe/Brussels", BR: "America/Sao_Paulo",
  CA: "America/Toronto", CH: "Europe/Zurich", DE: "Europe/Berlin", DK: "Europe/Copenhagen", ES: "Europe/Madrid",
  FI: "Europe/Helsinki", FR: "Europe/Paris", GB: "Europe/London", HK: "Asia/Hong_Kong", IE: "Europe/Dublin",
  IN: "Asia/Kolkata", IT: "Europe/Rome", JP: "Asia/Tokyo", MX: "America/Mexico_City", MY: "Asia/Kuala_Lumpur",
  NL: "Europe/Amsterdam", NO: "Europe/Oslo", NZ: "Pacific/Auckland", PH: "Asia/Manila", PL: "Europe/Warsaw",
  PT: "Europe/Lisbon", SE: "Europe/Stockholm", SG: "Asia/Singapore", US: "America/New_York", ZA: "Africa/Johannesburg",
};
const MONTH_FIRST = new Set<string>(["US", "CA", "PH"]);

/** How a date is written for a shopper in a market: the locale and the main time zone (UTC when unknown). */
export function countryDateStyle(code: string | null | undefined): { locale: string; timeZone: string } {
  const c = (code ?? "").toUpperCase();
  if (!isMarketCountry(c)) return { locale: "en-GB", timeZone: "UTC" };
  return { locale: MONTH_FIRST.has(c) ? "en-US" : "en-GB", timeZone: TIME_ZONES[c] };
}

/** "DE" -> "Germany", "GB" -> "United Kingdom". Unknown codes come back unchanged. */
export function regionName(code: string): string {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return code;
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    const name = names.of(c);
    if (name && name !== c && !/^unknown/i.test(name)) return name;
  } catch {
    // Not a region this runtime knows.
  }
  return c;
}

/** A real two-letter country code (one the runtime can name), e.g. "DE" yes, "ZZ" or "Germany" no. */
export function isCountryCode(code: string | null | undefined): boolean {
  const c = (code ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && regionName(c) !== c;
}

/** [code, name] pairs for a country picker, sorted by name, always including `current`. */
export function countryOptions(current?: string | null): [string, string][] {
  const codes = new Set<string>(MARKET_COUNTRIES);
  const cur = (current ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(cur)) codes.add(cur);
  return [...codes]
    .map((c): [string, string] => [c, regionName(c)])
    .sort((a, b) => a[1].localeCompare(b[1], "en"));
}
