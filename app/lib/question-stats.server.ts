// Each buying question with how the latest finished scan went: how often AI named the store, its best position
// and the brands AI named instead. Used by the Shopify app's and the web app's Buying questions screens.

import db from "../db.server";
import { sameBrand } from "./match";

export async function questionRows(shopId: string) {
  const [questions, scan] = await Promise.all([
    db.question.findMany({ where: { shopId }, orderBy: [{ active: "desc" }, { volume: { sort: "desc", nulls: "last" } }] }),
    db.scan.findFirst({ where: { shopId, status: "done" }, orderBy: { startedAt: "desc" } }),
  ]);

  const stats = new Map<string, { n: number; named: number; best: number | null; winners: Map<string, number> }>();
  if (scan) {
    const answers = await db.aiAnswer.findMany({
      where: { scanId: scan.id, status: "parsed" },
      select: { questionId: true, mentioned: true, position: true, mentions: { where: { isMerchant: false }, select: { brand: true }, take: 3 } },
    });
    for (const a of answers) {
      const s = stats.get(a.questionId) ?? { n: 0, named: 0, best: null, winners: new Map() };
      s.n++;
      if (a.mentioned) {
        s.named++;
        if (a.position !== null && (s.best === null || a.position < s.best)) s.best = a.position;
      }
      for (const m of a.mentions) {
        const key = [...s.winners.keys()].find((k) => sameBrand(k, m.brand)) ?? m.brand;
        s.winners.set(key, (s.winners.get(key) ?? 0) + 1);
      }
      stats.set(a.questionId, s);
    }
  }

  return {
    scanned: Boolean(scan),
    questions: questions.map((q) => {
      const s = stats.get(q.id);
      return {
        id: q.id,
        text: q.text,
        volume: q.volume,
        active: q.active,
        source: q.source,
        cluster: q.cluster,
        longTail: q.longTail,
        rate: s && s.n ? s.named / s.n : null,
        answers: s?.n ?? 0,
        best: s?.best ?? null,
        winners: s ? [...s.winners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b) : [],
      };
    }),
  };
}
