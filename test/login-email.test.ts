import { describe, expect, it } from "vitest";
import { loginEmail } from "../app/lib/web-auth.server";

describe("sign-in email", () => {
  const url = "https://firstpicked.com.au/login/abc123";
  const mail = loginEmail(url);

  it("has the purple button, the link twice and the plain text link", () => {
    expect(mail.subject).toBe("Your FirstPicked sign-in link");
    expect(mail.html).toContain('bgcolor="#6c5cf2"');
    expect(mail.html.split(`href="${url}"`)).toHaveLength(3);
    expect(mail.text).toContain(url);
  });

  it("has no em dashes and never names the old brand", () => {
    for (const s of [mail.html, mail.text]) {
      expect(s).not.toContain("—");
      expect(s).not.toMatch(/\bGEO\b|usegeo/);
    }
  });
});
