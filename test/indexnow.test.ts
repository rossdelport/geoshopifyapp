// IndexNow: the key file matches the key, the body names usegeo.app pages, and only recent pages are sent.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDEXNOW_KEY, indexNowBody, recentPaths } from "../app/lib/indexnow.server";

describe("indexnow", () => {
  it("serves the key file", () => {
    expect(readFileSync(`public/${INDEXNOW_KEY}.txt`, "utf8")).toBe(INDEXNOW_KEY);
  });

  it("builds the body with full addresses and no repeats", () => {
    const b = indexNowBody(["/compare", "/compare", "/blog"]);
    expect(b.host).toBe("usegeo.app");
    expect(b.keyLocation).toBe(`https://usegeo.app/${INDEXNOW_KEY}.txt`);
    expect(b.urlList).toEqual(["https://usegeo.app/compare", "https://usegeo.app/blog"]);
  });

  it("keeps only pages changed in the last 3 days", () => {
    const now = new Date("2026-11-02T06:00:00Z");
    expect(recentPaths([{ path: "/a", updated: "2026-11-01" }, { path: "/b", updated: "2026-10-20" }], now)).toEqual(["/a"]);
  });
});
