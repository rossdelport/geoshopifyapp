// firstpicked.com.au/josh: the sample report for Ross's FirstIndex application.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../app/home/josh.html", import.meta.url), "utf8");
const text = html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ");

describe("/josh sample report", () => {
  it("is kept out of search", () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  it("says it isn't made or approved by FirstIndex", () => {
    expect(text).toContain("Not made or approved by FirstIndex");
    expect(text).toContain("hasn't approved this page");
  });

  it("uses no em dashes", () => {
    expect(text).not.toContain("—");
  });

  it("keeps the checked prices", () => {
    for (const fact of ["$25", "starting at $45/month", "Rentec Pro is $35/month, while Rentec PM is $40/month", "June 23, 2026"]) {
      expect(text).toContain(fact);
    }
  });

  it("has the font placeholder the route fills in", () => {
    expect(html).toContain("__FONT_URL__");
  });
});
