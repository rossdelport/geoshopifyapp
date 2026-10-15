import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

/** Always encrypt the database connection, except for a local test database. */
export function encryptedUrl(url: string | undefined) {
  if (!url || /[?&]sslmode=/.test(url) || /@(localhost|127\.0\.0\.1)[:/]/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

/**
 * The address the app talks to the database through. The server runs all the time, so in production it uses the
 * session pooler (DIRECT_URL, port 5432), which keeps prepared statements: a query is one round trip. Measured from
 * Railway on 15 Oct 2026: 75 ms a query, against 365 ms through the transaction pooler (DATABASE_URL, pgbouncer=true).
 * At most 6 connections: the session pooler gives each one its own database connection, and the OneInbox project
 * shares the database's limit (even two servers overlapping during a deploy stay well inside it).
 * Set DB_USE_TRANSACTION_POOLER=true to go back without a code change.
 */
export function appDatabaseUrl(e: Record<string, string | undefined> = process.env) {
  const direct = e.DIRECT_URL;
  if (e.NODE_ENV === "production" && direct && e.DB_USE_TRANSACTION_POOLER !== "true") {
    const url = encryptedUrl(direct)!;
    return /[?&]connection_limit=/.test(url) ? url : `${url}${url.includes("?") ? "&" : "?"}connection_limit=6`;
  }
  return encryptedUrl(e.DATABASE_URL);
}

const make = () => new PrismaClient({ datasourceUrl: appDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = make();
  }
}

const prisma = global.prismaGlobal ?? make();

export default prisma;
