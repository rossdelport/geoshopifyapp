import { describe, expect, it } from "vitest";

// Which database address the app uses (db.server.ts appDatabaseUrl): the session pooler in production, because a
// query through it is one round trip instead of about five.
describe("appDatabaseUrl", () => {
  it("uses the session pooler (DIRECT_URL) in production, with at most 6 connections", async () => {
    const { appDatabaseUrl } = await import("../app/db.server");
    expect(
      appDatabaseUrl({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://u:p@pooler.example:6543/postgres?pgbouncer=true&schema=geo",
        DIRECT_URL: "postgresql://u:p@pooler.example:5432/postgres?schema=geo",
      }),
    ).toBe("postgresql://u:p@pooler.example:5432/postgres?schema=geo&sslmode=require&connection_limit=6");
  });

  it("keeps a connection limit already in the address", async () => {
    const { appDatabaseUrl } = await import("../app/db.server");
    expect(
      appDatabaseUrl({ NODE_ENV: "production", DIRECT_URL: "postgresql://u:p@pooler.example:5432/postgres?connection_limit=3" }),
    ).toBe("postgresql://u:p@pooler.example:5432/postgres?connection_limit=3&sslmode=require");
  });

  it("goes back to the transaction pooler when asked, and outside production", async () => {
    const { appDatabaseUrl } = await import("../app/db.server");
    const pooled = "postgresql://u:p@pooler.example:6543/postgres?pgbouncer=true";
    expect(appDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: pooled, DIRECT_URL: "postgresql://u:p@pooler.example:5432/postgres", DB_USE_TRANSACTION_POOLER: "true" })).toBe(`${pooled}&sslmode=require`);
    expect(appDatabaseUrl({ NODE_ENV: "test", DATABASE_URL: "postgresql://geo_app:local@localhost:5432/geotest?schema=geo", DIRECT_URL: "x" })).toBe(
      "postgresql://geo_app:local@localhost:5432/geotest?schema=geo",
    );
  });
});
