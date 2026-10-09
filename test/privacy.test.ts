import { describe, expect, it } from "vitest";
import { encryptedUrl } from "../app/db.server";

describe("encrypted database connection", () => {
  it("adds sslmode=require to remote databases", () => {
    expect(encryptedUrl("postgresql://u:p@db.example.com:6543/postgres?pgbouncer=true&schema=geo")).toBe(
      "postgresql://u:p@db.example.com:6543/postgres?pgbouncer=true&schema=geo&sslmode=require",
    );
    expect(encryptedUrl("postgresql://u:p@db.example.com/postgres")).toBe("postgresql://u:p@db.example.com/postgres?sslmode=require");
  });
  it("leaves local databases and explicit settings alone", () => {
    expect(encryptedUrl("postgresql://u:p@localhost:5432/test")).toBe("postgresql://u:p@localhost:5432/test");
    expect(encryptedUrl("postgresql://u:p@db.example.com/x?sslmode=verify-full")).toBe("postgresql://u:p@db.example.com/x?sslmode=verify-full");
    expect(encryptedUrl(undefined)).toBeUndefined();
  });
});
