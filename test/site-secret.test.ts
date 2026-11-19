import { expect, it } from "vitest";

// The website login is saved locked, and reads back the same (lib/site-secret.server.ts).
import { lock, unlock } from "../app/lib/site-secret.server";
it("locks and unlocks", () => {
  const s = lock("abcd efgh");
  expect(s).not.toContain("abcd");
  expect(unlock(s)).toBe("abcd efgh");
  expect(() => unlock("v1.x.y.z")).toThrow(/Connect the website again/);
});
