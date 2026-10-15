// Once at start-up (production only): how long the database takes to answer from this server, and why. Logs the
// pure network round trip (a TCP connect), then a tiny query through each way of connecting: the transaction pooler
// the app uses (DATABASE_URL) and the session pooler used for migrations (DIRECT_URL). Also opens the app's first
// database connection before the first visitor needs it.

import net from "node:net";
import { lookup } from "node:dns/promises";
import { PrismaClient } from "@prisma/client";
import db, { encryptedUrl } from "../db.server";

const ms = async (work: () => Promise<unknown>) => {
  const t = performance.now();
  await work();
  return Math.round(performance.now() - t);
};

async function threeQueries(client: PrismaClient) {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) out.push(await ms(() => client.$queryRaw`SELECT 1`));
  return out.join(", ");
}

export async function speedProbe() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    const port = Number(url.port || 5432);
    let ip = "";
    const dns = await ms(async () => {
      ip = (await lookup(url.hostname)).address;
    });
    const tcp: number[] = [];
    for (let i = 0; i < 3; i++) {
      tcp.push(
        await ms(
          () =>
            new Promise<void>((resolve, reject) => {
              const s = net.connect(port, ip);
              s.once("connect", () => {
                s.destroy();
                resolve();
              });
              s.once("error", reject);
            }),
        ),
      );
    }
    const pooled = await threeQueries(db);
    let session = "not set";
    if (process.env.DIRECT_URL) {
      const direct = new PrismaClient({ datasourceUrl: encryptedUrl(process.env.DIRECT_URL) });
      try {
        session = await threeQueries(direct);
      } finally {
        await direct.$disconnect();
      }
    }
    console.log(
      `[speed] database ${url.hostname} (${ip}): dns ${dns} ms; network round trip ${tcp.join(", ")} ms; ` +
        `query via app pooler (port ${port}) ${pooled} ms; via session pooler ${session} ms`,
    );
  } catch (err) {
    console.error(`[speed] start-up check failed: ${(err as Error).message}`);
  }
}
