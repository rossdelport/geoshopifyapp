// Visibility score (0-100). One formula, used everywhere, explained in the UI.
//
// For every AI answer we checked (question x engine x run):
//   named in the top 3          = 1 point
//   named, but lower down       = 2/3 point
//   not named, but your site is one of the sources = 1/3 point
//   not there at all            = 0
// Each engine's score is its average x 100. The overall score is the average of the engines,
// so one engine with lots of answers can't drown out the others.

export interface ScoredAnswer {
  engine: string;
  mentioned: boolean;
  position: number | null;
  cited: boolean;
}

export const SCORE_EXPLAINER =
  "Out of 100. We ask every question twice on each AI. You get full points when the AI names you in its top 3, two-thirds when it names you lower down, and one-third when it only links to your website.";

export function answerPoints(a: ScoredAnswer): number {
  if (a.mentioned) return a.position !== null && a.position <= 3 ? 1 : 2 / 3;
  if (a.cited) return 1 / 3;
  return 0;
}

export function visibilityScore(answers: ScoredAnswer[]): {
  score: number;
  byEngine: Record<string, number>;
  mentionRate: number;
} {
  const groups = new Map<string, number[]>();
  for (const a of answers) {
    const list = groups.get(a.engine) ?? [];
    list.push(answerPoints(a));
    groups.set(a.engine, list);
  }
  const byEngine: Record<string, number> = {};
  for (const [engine, points] of groups) {
    byEngine[engine] = Math.round((points.reduce((s, p) => s + p, 0) / points.length) * 100);
  }
  const engineScores = Object.values(byEngine);
  const score = engineScores.length
    ? Math.round(engineScores.reduce((s, v) => s + v, 0) / engineScores.length)
    : 0;
  const mentionRate = answers.length ? answers.filter((a) => a.mentioned).length / answers.length : 0;
  return { score, byEngine, mentionRate };
}

/**
 * A short label for a score. Under 10 it says plainly whether AI named you at all, so the label never
 * contradicts "AI named you in 1 of 18 answers". Pass `named` when you know it (a score above 0 can
 * also come from links to your site alone).
 */
export function scoreLabel(
  score: number,
  named: boolean = score > 0,
): { label: string; tone: "critical" | "warning" | "info" | "success" } {
  if (score >= 60) return { label: "Strong", tone: "success" };
  if (score >= 30) return { label: "Growing", tone: "info" };
  if (score >= 10) return { label: "Weak", tone: "warning" };
  return named ? { label: "Rarely named", tone: "warning" } : { label: "Not named yet", tone: "critical" };
}
