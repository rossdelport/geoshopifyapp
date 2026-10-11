// Long-tail buyer questions and topic clusters. Pure (tested), shared by server and UI.
// Specific questions ("best beard oil for sensitive skin under $40") rarely have measurable search
// volume, but they are the ones AI answers name smaller brands in. So a share of the tracked questions
// is kept for them whatever their volume, the fix writer sees the questions we lose most (spread across
// topics) rather than the highest-volume ones, and guide pages are planned per topic cluster.

export const MAX_CLUSTERS = 8;
/** Share of active question slots kept for long-tail questions, whatever their search volume. */
export const LONG_TAIL_SHARE = 0.35;

/** "Beard Oil, for Dry Skin!" -> "beard oil for dry skin". Empty input -> "general". */
export function normalizeClusterLabel(raw: string | null | undefined): string {
  const label = String(raw ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48)
    .trim();
  return label || "general";
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3));

/**
 * Normalise every item's cluster label and keep at most `max` clusters: the store's `existing` topics
 * (biggest first) and then the biggest new ones. An item in any other cluster joins the kept cluster whose
 * label shares the most words with its question and old label (else the first kept one). Returns new
 * items; order is kept.
 */
export function tidyClusters<T extends { cluster: string; question: string }>(items: T[], max = MAX_CLUSTERS, existing: string[] = []): T[] {
  const normal = items.map((it) => ({ ...it, cluster: normalizeClusterLabel(it.cluster) }));
  const have = [...new Set(existing.filter((l) => l && l.trim()).map((l) => normalizeClusterLabel(l)))].slice(0, max);
  const counts = new Map<string, number>();
  for (const it of normal) counts.set(it.cluster, (counts.get(it.cluster) ?? 0) + 1);
  const fresh = [...counts.entries()]
    .filter(([label]) => !have.includes(label))
    .sort((a, b) => b[1] - a[1] || normal.findIndex((x) => x.cluster === a[0]) - normal.findIndex((x) => x.cluster === b[0]))
    .slice(0, Math.max(0, max - have.length))
    .map(([label]) => label);
  const kept = [...have, ...fresh];
  if (!kept.length) return normal;
  return normal.map((it) => {
    if (kept.includes(it.cluster)) return it;
    const have = words(`${it.question} ${it.cluster}`);
    let best = kept[0];
    let bestScore = 0;
    for (const label of kept) {
      const score = [...words(label)].filter((w) => have.has(w)).length;
      if (score > bestScore) {
        best = label;
        bestScore = score;
      }
    }
    return { ...it, cluster: best };
  });
}

/**
 * A rough guess for questions Claude didn't label (templates, questions the store added): specific
 * needs, budgets, gifts and comparisons, or simply long questions.
 */
export function looksLongTail(question: string): boolean {
  const q = question.toLowerCase();
  if (/\b(under|below|less than|cheaper than)\s*[^\s]*\d/.test(q)) return true;
  if (/\b(gift|present|vs\.?|versus|compared to|or)\b/.test(q) && q.split(/\s+/).length >= 5) return true;
  if (/\bfor (sensitive|dry|oily|curly|thick|thin|fine|coarse|itchy|patchy|short|long|grey|gray|mature|acne)\b/.test(q)) return true;
  if (/\b(with|without|free of|free from)\s+[a-z]{4,}/.test(q)) return true;
  return q.split(/\s+/).filter(Boolean).length >= 9;
}

interface Pickable {
  longTail: boolean;
  volume: number | null;
  cluster: string | null;
}

/** Items in turn from each cluster (in the order each cluster first appears), keeping order within a cluster. */
export function roundRobinByCluster<T extends { cluster: string | null }>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = it.cluster ?? "";
    const g = groups.get(k) ?? [];
    g.push(it);
    groups.set(k, g);
  }
  const lists = [...groups.values()];
  const out: T[] = [];
  for (let i = 0; out.length < items.length; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

const byVolume = <T extends Pickable>(a: T, b: T) => (b.volume ?? -1) - (a.volume ?? -1);

/**
 * Which questions to track in `slots` slots: about 35% kept for long-tail questions whatever their
 * volume (taken in turn from each cluster), the rest by search volume. If either kind runs short, the
 * other fills the gap. Returns the chosen items, best first.
 */
export function pickActive<T extends Pickable>(items: T[], slots: number, share = LONG_TAIL_SHARE): T[] {
  if (slots <= 0) return [];
  const longTail = roundRobinByCluster(items.filter((i) => i.longTail));
  const broad = items.filter((i) => !i.longTail).sort(byVolume);
  const ltWanted = Math.min(longTail.length, Math.round(slots * share));
  const chosen = [...longTail.slice(0, ltWanted), ...broad.slice(0, slots - ltWanted)];
  for (const it of longTail.slice(ltWanted)) {
    if (chosen.length >= slots) break;
    chosen.push(it);
  }
  return chosen.slice(0, slots);
}

/**
 * The questions to hand the fix writer: the ones AI names the store in least, spread across clusters
 * (in turn from each), with search volume only breaking ties. Specific questions with no measurable
 * volume still get their turn.
 */
export function rankLost<T extends { mentionRate: number; volume: number | null; cluster: string | null }>(items: T[], n = 10): T[] {
  const sorted = [...items].sort((a, b) => a.mentionRate - b.mentionRate || (b.volume ?? 0) - (a.volume ?? 0));
  return roundRobinByCluster(sorted).slice(0, n);
}

/** The most common cluster among some questions (ties: the first seen), or null. */
export function mainCluster(items: { cluster: string | null }[]): string | null {
  const counts = new Map<string, number>();
  for (const it of items) if (it.cluster) counts.set(it.cluster, (counts.get(it.cluster) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}
