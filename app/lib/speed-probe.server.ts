// Once at start-up (production only): how long the database takes to answer from this server. Logs the plain
// network round trip (a TCP connect) and a tiny query through the app's own connection (see appDatabaseUrl in
// db.server.ts), which also opens the first connection before a visitor needs it. Then, every 4 minutes, a few tiny
// queries at once keep the connections pages use open: opening a new one to the database costs over half a second.

import net from "node:net";
import { lookup } from "node:dns/promises";
import db, { appDatabaseUrl } from "../db.server";

const ms = async (work: () => Promise<unknown>) => {
  const t = performance.now();
  await work();
  return Math.round(performance.now() - t);
};

export async function speedProbe() {
  try {
    const url = new URL(appDatabaseUrl() ?? "");
    const port = Number(url.port || 5432);
    const { address } = await lookup(url.hostname);
    const tcp: number[] = [];
    for (let i = 0; i < 3; i++) {
      tcp.push(
        await ms(
          () =>
            new Promise<void>((resolve, reject) => {
              const s = net.connect(port, address);
              s.once("connect", () => {
                s.destroy();
                resolve();
              });
              s.once("error", reject);
            }),
        ),
      );
    }
    const queries: number[] = [];
    for (let i = 0; i < 3; i++) queries.push(await ms(() => db.$queryRaw`SELECT 1`));
    console.log(`[speed] database ${url.hostname}:${port}: network round trip ${tcp.join(", ")} ms; one query ${queries.join(", ")} ms`);
  } catch (err) {
    console.error(`[speed] start-up check failed: ${(err as Error).message}`);
  }
}

export function keepWarm(connections = 4) {
  setInterval(() => {
    void Promise.all(Array.from({ length: connections }, () => db.$queryRaw`SELECT 1`)).catch(() => {});
  }, 240_000).unref();
}
