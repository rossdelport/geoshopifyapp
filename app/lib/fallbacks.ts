// Used when Claude is unavailable, so setup still finishes. Pure functions (tested).

export interface SimpleProfile {
  brand_name: string;
  aliases: string[];
  summary: string;
  category: string;
  audience: string;
  price_point: "budget" | "mid" | "premium";
}

/** Used when Claude is unavailable: a plain profile from the catalog alone. */
export function simpleProfile(
  name: string,
  products: { productType: string | null; vendor: string | null }[],
): SimpleProfile {
  const ranked = (vals: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  };
  const types = ranked(products.map((p) => p.productType)).slice(0, 3);
  const brand = ranked(products.map((p) => p.vendor))[0] ?? name;
  return {
    brand_name: brand,
    aliases: brand === name ? [] : [name],
    summary: types.length ? `${brand} sells ${types.join(", ").toLowerCase()}.` : `${brand} is an online store.`,
    category: types[0]?.toLowerCase() ?? "online store",
    audience: "online shoppers",
    price_point: "mid",
  };
}

/** Used when Claude is unavailable: simple, still-useful buyer questions per product type. */
export function templateQuestions(topics: (string | null)[], where: string) {
  const unique = [...new Set(topics.map((t) => t?.trim().toLowerCase()).filter((t): t is string => Boolean(t)))].slice(0, 6);
  return unique.flatMap((t) => [
    { question: `best ${t} in ${where}`, keyword: `best ${t}` },
    { question: `what is the best ${t} to buy right now`, keyword: t },
    { question: `affordable ${t} that actually works`, keyword: `cheap ${t}` },
    { question: `${t} gift ideas`, keyword: `${t} gift` },
    { question: `best natural ${t} brands`, keyword: `natural ${t}` },
  ]);
}
