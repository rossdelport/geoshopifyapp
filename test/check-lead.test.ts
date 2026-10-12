// Free check email capture against a real Postgres (set TEST_DATABASE_URL), with the job queue and the
// email sender faked. Covers: POST /check/:id/email (cross-site, honeypot, bad email, limits, the signed
// cookie), getCheckView (lead state for this browser only; never the action plan), the check.email job
// (idempotent, unsubscribed, email not set up, failures), queueing when a check ends, unsubscribe, retention.
//
// Runs in its own schema ("geo_lead_test" in the test database, created from the migrations), so the
// other database tests (which truncate tables and count rows) can run at the same time.

import { execSync } from "node:child_process";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckView } from "../app/lib/check-types";
import { sampleAnswers, sampleProduct, sampleQuestions, sampleReport } from "./fixtures/check-sample";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_lead_test";
const url = (() => {
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set("schema", SCHEMA);
  return u.toString();
})();
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
process.env.SHOPIFY_APP_URL = "https://geo.test";
process.env.CHECK_IP_SECRET = "test-secret";

const state = vi.hoisted(() => ({ email: true, sendFails: false, duplicate: false }));

vi.mock("../app/lib/jobs.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/jobs.server")>()),
  enqueue: vi.fn(async () => null),
  heartbeat: vi.fn(async () => {}),
}));
vi.mock("../app/lib/email.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/email.server")>()),
  emailConfigured: () => state.email,
  replyAddress: () => "hello@geo.test",
  sendEmailMessage: vi.fn(async () => {
    if (state.sendFails) throw new Error("Resend 500: down");
    return { duplicate: state.duplicate };
  }),
}));

const DAY = 86_400_000;

describe.skipIf(!url)("free check email capture (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let lead: typeof import("../app/lib/check-lead.server");
  let check: typeof import("../app/lib/check.server");
  let route: typeof import("../app/routes/check.$id.email");
  let unsub: typeof import("../app/routes/unsubscribe");
  let tipsRoute: typeof import("../app/routes/tips");
  let consent: typeof import("../app/lib/check-consent");
  let retention: typeof import("../app/lib/retention.server");
  let enqueue: ReturnType<typeof vi.fn>;
  let send: ReturnType<typeof vi.fn>;

  const json = (v: unknown) => v as Prisma.InputJsonValue;
  const doneCheck = (o: Partial<Prisma.PublicCheckCreateInput> = {}) =>
    db.publicCheck.create({
      data: {
        url: sampleProduct.url,
        country: "NZ",
        status: "done",
        product: json(sampleProduct),
        questions: json(sampleQuestions),
        answers: json(sampleAnswers),
        report: json(sampleReport),
        total: 18,
        done: 18,
        finishedAt: new Date(),
        ...o,
      },
    });

  const post = async (id: string, body: Record<string, string>, headers: Record<string, string> = {}) => {
    const request = new Request(`http://localhost/check/${id}/email`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost", "x-real-ip": "1.2.3.4", ...headers },
      body: new URLSearchParams(body).toString(),
    });
    const res = (await route.action({ request, params: { id }, context: {} } as never)) as Response;
    return { res, body: (await res.json()) as { ok: boolean; error?: string; lead?: { status: string; maskedEmail: string | null } } };
  };
  const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];
  const viewFor = (id: string, cookie?: string) =>
    check.getCheckView(id, new Request(`http://localhost/check/${id}`, { headers: cookie ? { cookie } : {} })) as Promise<CheckView>;

  beforeAll(async () => {
    // Create or update the test schema from the migrations (also proves the new migration applies).
    // Nothing is dropped: each test empties its own three tables instead.
    if (new URL(url!).searchParams.get("schema") !== SCHEMA) throw new Error("expected the lead test schema");
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! },
      stdio: "pipe",
    });
    db = (await import("../app/db.server")).default;
    lead = await import("../app/lib/check-lead.server");
    check = await import("../app/lib/check.server");
    route = await import("../app/routes/check.$id.email");
    unsub = await import("../app/routes/unsubscribe");
    tipsRoute = await import("../app/routes/tips");
    consent = await import("../app/lib/check-consent");
    retention = await import("../app/lib/retention.server");
    enqueue = (await import("../app/lib/jobs.server")).enqueue as unknown as ReturnType<typeof vi.fn>;
    send = (await import("../app/lib/email.server")).sendEmailMessage as unknown as ReturnType<typeof vi.fn>;
  }, 120_000);

  beforeEach(async () => {
    await db.$executeRawUnsafe(`TRUNCATE "ReportEmail", "Subscriber", "PublicCheck", "EmailSuppression"`);
    enqueue.mockClear();
    send.mockClear();
    state.email = true;
    state.sendFails = false;
    state.duplicate = false;
    delete process.env.GEO_REPORT_EMAILS_PER_DAY;
    for (const k of ["GEO_LEGAL_NAME", "GEO_ABN", "GEO_POSTAL_ADDRESS"]) delete process.env[k];
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  describe("POST /check/:id/email", () => {
    it("refuses posts from other websites, bots, bad addresses and unknown checks, saving nothing", async () => {
      const c = await doneCheck();
      expect((await post(c.id, { email: "ross@example.com" }, { origin: "https://evil.example" })).res.status).toBe(403);
      expect((await post(c.id, { email: "ross@example.com" }, { "sec-fetch-site": "cross-site" })).res.status).toBe(403);
      const bot = await post(c.id, { email: "ross@example.com", website: "spam.com" });
      expect(bot.body).toEqual({ ok: false, error: "Something went wrong. Please try again." });
      for (const bad of ["", "ross", "ross@", "@example.com", "ross@example", "ross@@example.com", "ro ss@example.com", `${"a".repeat(250)}@example.com`]) {
        const r = await post(c.id, { email: bad });
        expect(r.res.status, bad).toBe(400);
        expect(r.body.error).toBe("Please enter a valid email address.");
      }
      expect((await post("nope123", { email: "ross@example.com" })).body.error).toBe("We couldn’t find that check. Please run a new one.");
      const big = await post(c.id, { email: "ross@example.com", junk: "x".repeat(10_000) });
      expect(big.res.status).toBe(413);
      expect(await db.subscriber.count()).toBe(0);
      expect(await db.reportEmail.count()).toBe(0);
    });

    it("saves the subscriber with their consent, queues the email for a done check, and tells only this browser", async () => {
      const c = await doneCheck();
      const r = await post(c.id, { email: "  Ross.Delport@Example.com " });
      expect(r.res.status).toBe(200);
      expect(r.body).toEqual({ ok: true, lead: { status: "pending", maskedEmail: "ro***@example.com" } });
      expect(r.res.headers.get("set-cookie")).toMatch(/^geo_check_leads=.+; Max-Age=2592000; Path=\/check; HttpOnly; SameSite=Lax/);

      const sub = await db.subscriber.findUniqueOrThrow({ where: { email: "ross.delport@example.com" } });
      expect(sub.consentText).toBe(consent.REPORT_CONSENT_TEXT); // the words under the popup's button
      expect(sub.consentCheckId).toBe(c.id);
      expect(sub.source).toBe("free-check");
      expect(sub).toMatchObject({ tipsConsentAt: null, tipsConsentText: null, tipsConfirmedAt: null }); // asking for a report isn't a sign-up
      expect(sub.unsubscribeToken.length).toBeGreaterThanOrEqual(30);
      const row = await db.reportEmail.findFirstOrThrow({ where: { checkId: c.id } });
      expect(row).toMatchObject({ email: "ross.delport@example.com", status: "pending" });
      expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(enqueue).toHaveBeenCalledWith("check.email", { id: row.id }, { dedupeKey: `check-email:${row.id}` });

      // This browser sees its own (masked) address; anyone else opening the link sees nothing.
      const cookie = cookieOf(r.res);
      expect((await viewFor(c.id, cookie)).lead).toEqual({ status: "pending", maskedEmail: "ro***@example.com" });
      expect((await viewFor(c.id)).lead).toEqual({ status: "none", maskedEmail: null });
      expect((await check.getCheckView(c.id))!.lead).toEqual({ status: "none", maskedEmail: null });
      const tampered = cookie.replace(/=(.)/, (_m, ch: string) => `=${ch === "e" ? "f" : "e"}`);
      expect((await viewFor(c.id, tampered)).lead.status).toBe("none");
      // The cookie only speaks for its own checks.
      const other = await doneCheck();
      expect((await viewFor(other.id, cookie)).lead.status).toBe("none");

      // Asking again before it's sent changes nothing; once sent, the browser sees "sent".
      await post(c.id, { email: "ross.delport@example.com" }, { cookie });
      expect(await db.reportEmail.count()).toBe(1);
      await db.reportEmail.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date() } });
      expect((await viewFor(c.id, cookie)).lead).toEqual({ status: "sent", maskedEmail: "ro***@example.com" });
    });

    it("puts nobody on the tips list without the ticked box and a click from their inbox", async () => {
      const c = await doneCheck();
      await post(c.id, { email: "kate@example.com", tips: "1" });
      let sub = await db.subscriber.findUniqueOrThrow({ where: { email: "kate@example.com" } });
      expect(sub.tipsConsentText).toBe(consent.TIPS_CONSENT_TEXT);
      expect(sub.tipsCheckId).toBe(c.id);
      expect(sub.tipsConfirmedAt).toBeNull();
      expect(await db.subscriber.count({ where: lead.tipsListWhere })).toBe(0);

      // The confirm page only asks on GET; the POST confirms.
      const t = sub.unsubscribeToken;
      const page = await tipsRoute.loader({ request: new Request(`http://localhost/tips?t=${t}`), params: {}, context: {} } as never);
      expect(page).toEqual({ token: t, maskedEmail: "ka***@example.com", state: "ask" });
      expect(await db.subscriber.count({ where: lead.tipsListWhere })).toBe(0);
      const yes = await tipsRoute.action({
        request: new Request("http://localhost/tips", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `t=${t}` }),
        params: {},
        context: {},
      } as never);
      expect(yes).toMatchObject({ data: { state: "on" }, init: { status: 200 } });
      expect(await db.subscriber.count({ where: lead.tipsListWhere })).toBe(1);

      // Someone who never ticked the box can't be added by the link.
      await post(c.id, { email: "sam@example.com" }, { "x-real-ip": "10.4.0.1" });
      const sam = await db.subscriber.findUniqueOrThrow({ where: { email: "sam@example.com" } });
      expect(await lead.confirmTips(sam.unsubscribeToken)).toBe("off");
      expect(await lead.confirmTips("nope")).toBeNull();

      // Unsubscribing takes them off the list; a form post (even with the box ticked) never puts them back.
      await lead.unsubscribe(t);
      sub = await db.subscriber.findUniqueOrThrow({ where: { email: "kate@example.com" } });
      expect(sub.tipsConfirmedAt).toBeNull();
      const before = sub.unsubscribedAt!;
      await db.reportEmail.updateMany({ data: { status: "sent" } });
      await new Promise((r) => setTimeout(r, 5));
      await post(c.id, { email: "kate@example.com", tips: "1" });
      sub = await db.subscriber.findUniqueOrThrow({ where: { email: "kate@example.com" } });
      expect(sub.unsubscribedAt).toEqual(before);
      expect(sub.consentAt.getTime()).toBeLessThan(before.getTime()); // the first request's consent is kept
      expect(await db.subscriber.count({ where: lead.tipsListWhere })).toBe(0);
      // ...but the report they just asked for still goes (once), with the confirm link for the tips they ticked.
      const fresh = await db.reportEmail.findFirstOrThrow({ where: { email: "kate@example.com", status: "pending" } });
      expect(await lead.sendReportEmail(fresh.id)).toBe("sent");
      expect(send.mock.calls.at(-1)![0].text).toContain(`Yes, keep sending me tips: https://geo.test/tips?t=${encodeURIComponent(t)}`);
      // Only their own click from that email puts them back on the list.
      expect(await lead.confirmTips(t)).toBe("on");
      expect((await db.subscriber.findUniqueOrThrow({ where: { email: "kate@example.com" } })).unsubscribedAt).toBeNull();
    });

    it("pauses the form (saving nothing) when email isn't set up", async () => {
      const c = await doneCheck();
      state.email = false;
      const r = await post(c.id, { email: "ross@example.com" });
      expect(r.res.status).toBe(503);
      expect(r.body.error).toBe("Emailed reports are paused right now. Please try again later.");
      expect(await db.subscriber.count()).toBe(0);
      expect(await db.reportEmail.count()).toBe(0);
    });

    it("waits for a running check, and refuses a failed or stuck one", async () => {
      const running = await doneCheck({ status: "asking", report: Prisma.DbNull, finishedAt: null });
      const r = await post(running.id, { email: "ross@example.com" });
      expect(r.body.ok).toBe(true);
      expect(enqueue).not.toHaveBeenCalled(); // runCheck queues it when the check is done
      await lead.queueReportEmails(running.id);
      expect(enqueue).toHaveBeenCalledTimes(1);

      const failed = await doneCheck({ status: "failed", report: Prisma.DbNull });
      expect((await post(failed.id, { email: "ross@example.com" })).body.error).toBe(
        "This check didn’t finish, so there’s no report to send. Please run it again.",
      );
      const stuck = await doneCheck({ status: "asking", report: Prisma.DbNull, createdAt: new Date(Date.now() - 31 * 60_000) });
      expect((await post(stuck.id, { email: "ross@example.com" })).res.status).toBe(400);
    });

    it("queues report emails that missed their queue, and skips those of checks that didn't finish", async () => {
      const done = await doneCheck();
      const running = await doneCheck({ status: "asking", report: Prisma.DbNull, finishedAt: null });
      const stuck = await doneCheck({ status: "asking", report: Prisma.DbNull, finishedAt: null, createdAt: new Date(Date.now() - 40 * 60_000) });
      const old = new Date(Date.now() - 6 * 60_000);
      const missed = await db.reportEmail.create({ data: { email: "a@example.com", checkId: done.id, status: "pending", createdAt: old } });
      const fresh = await db.reportEmail.create({ data: { email: "b@example.com", checkId: done.id, status: "pending" } });
      const waiting = await db.reportEmail.create({ data: { email: "c@example.com", checkId: running.id, status: "pending", createdAt: old } });
      const dead = await db.reportEmail.create({ data: { email: "d@example.com", checkId: stuck.id, status: "pending", createdAt: old } });
      expect(await lead.queueStrandedReportEmails()).toBe(1);
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(enqueue).toHaveBeenCalledWith("check.email", { id: missed.id }, { dedupeKey: `check-email:${missed.id}` });
      // Saved a moment ago: its own queueing is still on the way, so the sweep leaves it.
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: fresh.id } })).toMatchObject({ status: "pending" });
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: waiting.id } })).toMatchObject({ status: "pending" });
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: dead.id } })).toMatchObject({ status: "skipped" });
    });

    it("skips the emails of a check that fails (runCheck on a check too old to run)", async () => {
      const c = await doneCheck({ status: "queued", report: Prisma.DbNull, finishedAt: null });
      await post(c.id, { email: "ross@example.com" });
      await db.publicCheck.update({ where: { id: c.id }, data: { createdAt: new Date(Date.now() - 31 * 60_000) } });
      await check.runCheck(c.id);
      expect((await db.publicCheck.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("failed");
      expect(await db.reportEmail.findFirstOrThrow({ where: { checkId: c.id } })).toMatchObject({ status: "skipped" });
    });

    it("sends one report to at most 10 addresses, without saying that others asked", async () => {
      const c = await doneCheck();
      for (let i = 0; i < 10; i++) expect((await post(c.id, { email: `r${i}@example.com` }, { "x-real-ip": `10.0.0.${i}` })).body.ok).toBe(true);
      const next = await post(c.id, { email: "late@example.com" }, { "x-real-ip": "10.0.0.99" });
      expect(next.res.status).toBe(429);
      expect(next.body.error).toBe("We can’t send this report right now. Please try again later.");
    });

    it("allows 5 requests per IP and 3 report emails per address a day", async () => {
      const checks = await Promise.all(Array.from({ length: 11 }, () => doneCheck()));
      for (let i = 0; i < 5; i++) expect((await post(checks[i].id, { email: `p${i}@example.com` })).body.ok).toBe(true);
      expect((await post(checks[5].id, { email: "p5@example.com" })).body.error).toBe("You’ve asked for a lot of reports today. Please try again tomorrow.");
      // Yesterday's requests no longer count.
      await db.reportEmail.updateMany({ data: { createdAt: new Date(Date.now() - DAY - 60_000) } });
      expect((await post(checks[5].id, { email: "p5@example.com" })).body.ok).toBe(true);

      await db.$executeRawUnsafe(`TRUNCATE "ReportEmail"`);
      for (let i = 0; i < 3; i++) {
        expect((await post(checks[i].id, { email: "same@example.com" }, { "x-real-ip": `10.1.0.${i}` })).body.ok).toBe(true);
      }
      expect((await post(checks[3].id, { email: "same@example.com" }, { "x-real-ip": "10.1.0.99" })).body.error).toBe(
        "We’ve sent a lot of reports to this address today. Please try again tomorrow.",
      );
    });

    it("stops at the daily cap (GEO_REPORT_EMAILS_PER_DAY)", async () => {
      process.env.GEO_REPORT_EMAILS_PER_DAY = "2";
      const c = await doneCheck();
      await post(c.id, { email: "a@example.com" }, { "x-real-ip": "10.2.0.1" });
      await post(c.id, { email: "b@example.com" }, { "x-real-ip": "10.2.0.2" });
      expect((await post(c.id, { email: "c@example.com" }, { "x-real-ip": "10.2.0.3" })).body.error).toBe(
        "We’re very busy right now. Please try again later today.",
      );
      process.env.GEO_REPORT_EMAILS_PER_DAY = "0"; // 0 turns report emails off
      expect((await post(c.id, { email: "d@example.com" }, { "x-real-ip": "10.2.0.4" })).res.status).toBe(429);
    });
  });

  describe("getCheckView", () => {
    it("never sends the action plan to the page, only what it holds", async () => {
      const c = await doneCheck();
      const view = (await check.getCheckView(c.id))!;
      expect(view.report!.tips).toEqual([]);
      expect(view.report!.aiReady!.checks.map((x) => x.fix)).toEqual(["", "", "", "", "", "", ""]);
      expect(view.report!.aiReady!.checks.map((x) => x.reason)).toEqual(sampleReport.aiReady!.checks.map((x) => x.reason));
      expect(view.plan).toEqual({ steps: 5, pageFixes: 4, sitesToPitch: 2, rivalsToStudy: sampleReport.competitors.length });
      const page = JSON.stringify(view);
      for (const tip of sampleReport.tips) expect(page).not.toContain(tip.body);
      for (const x of sampleReport.aiReady!.checks) expect(page).not.toContain(x.fix);

      const running = await doneCheck({ status: "asking", report: json(sampleReport), finishedAt: null });
      const v2 = (await check.getCheckView(running.id))!;
      expect(v2.report).toBeNull();
      expect(v2.plan).toBeNull();
    });
  });

  describe("the check.email job", () => {
    const queued = async (email = "ross@example.com") => {
      const c = await doneCheck();
      await post(c.id, { email });
      return { c, row: await db.reportEmail.findFirstOrThrow({ where: { checkId: c.id } }) };
    };

    it("emails the report with the PDF, an unsubscribe link and the sender, once", async () => {
      const { c, row } = await queued();
      const sub = await db.subscriber.findUniqueOrThrow({ where: { email: "ross@example.com" } });
      await lead.runReportEmailJob({ payload: { id: row.id }, attempts: 1 });
      expect(send).toHaveBeenCalledTimes(1);
      const msg = send.mock.calls[0][0];
      const unsubscribeUrl = `https://geo.test/unsubscribe?t=${encodeURIComponent(sub.unsubscribeToken)}`;
      expect(msg.to).toEqual(["ross@example.com"]);
      expect(msg.subject).toBe("Your free AI visibility report"); // fixed: nothing from the visitor's page
      expect(msg.replyTo).toBe("hello@geo.test");
      expect(msg.headers).toEqual({ "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
      expect(msg.idempotencyKey).toBe(`geo-report-email/${row.id}`);
      expect(msg.attachments[0].filename).toBe("GEO-report-Kowhai-Co.pdf");
      expect(msg.attachments[0].content.subarray(0, 5).toString()).toBe("%PDF-");
      for (const body of [msg.html, msg.text]) {
        expect(body).toContain(unsubscribeUrl.replace(/&/g, body === msg.html ? "&amp;" : "&"));
        expect(body).toContain("Sent by GEO."); // no legal name set in this test
        expect(body).toContain("We won’t email you again unless you ask."); // didn't tick the tips box
        expect(body).not.toContain("keep sending me tips");
        expect(body).toContain("hello@geo.test");
        expect(body).toContain(`https://geo.test/check/${c.id}`);
        expect(body).toContain("https://geo.test/#waitlist");
        expect(body).toContain("Join the GEO waitlist");
        expect(body).not.toMatch(/free trial/i);
        expect(body).toContain("Fix these on your product page");
        expect(body).toContain("Café Lip Co");
        expect(body).not.toContain(String.fromCharCode(0x2014));
      }
      expect(msg.text).toContain(`Score: ${sampleReport.score} out of 100`);
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "sent", attempts: 1, error: null });

      // Run again (a retry, a second queue entry): nothing more is sent.
      await lead.runReportEmailJob({ payload: { id: row.id }, attempts: 2 });
      expect(await lead.sendReportEmail(row.id)).toBe("none");
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("names the business and its postal address when they are set, and keeps the page's text out of links and headers", async () => {
      process.env.GEO_LEGAL_NAME = "Delport Digital Pty Ltd";
      process.env.GEO_ABN = "12 345 678 901";
      process.env.GEO_POSTAL_ADDRESS = "PO Box 123, Sydney NSW 2001";
      const c = await doneCheck({
        product: json({ ...sampleProduct, title: "Lip balm\r\nBcc: you@evil.example \u202eevil.example/login", brand: "Kowhai Co" }),
      });
      await post(c.id, { email: "ross@example.com" });
      const row = await db.reportEmail.findFirstOrThrow({ where: { checkId: c.id } });
      expect(await lead.sendReportEmail(row.id)).toBe("sent");
      const msg = send.mock.calls[0][0];
      expect(msg.subject).toBe("Your free AI visibility report");
      for (const body of [msg.html, msg.text]) {
        expect(body).toContain("Sent by Delport Digital Pty Ltd (ABN 12 345 678 901), trading as GEO, PO Box 123, Sydney NSW 2001.");
        expect(body).not.toContain("evil.example"); // a zero-width space after the dot: no live link
        expect(body).toContain("evil.\u200bexample");
        expect(body).not.toContain("\u202e");
        expect(body).not.toMatch(/Lip balm[\r\n]/);
      }
      expect(lead.emailSafe("Visit https://evil.example now")).toBe("Visit https://\u200bevil.\u200bexample now");
    });

    it("counts an email Resend already took (409, same key) as sent, and never lets two workers send one row", async () => {
      const { row } = await queued();
      state.duplicate = true;
      expect(await lead.sendReportEmail(row.id)).toBe("sent");
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "sent", lockedAt: null });

      // A row another worker is sending is left alone; a claim whose worker stopped goes back after 10 minutes.
      const { row: other } = await queued("kate@example.com");
      await db.reportEmail.update({ where: { id: other.id }, data: { status: "sending", lockedAt: new Date() } });
      expect(await lead.sendReportEmail(other.id)).toBe("none");
      await lead.queueStrandedReportEmails();
      expect((await db.reportEmail.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("sending");
      await db.reportEmail.update({ where: { id: other.id }, data: { lockedAt: new Date(Date.now() - 11 * 60_000), createdAt: new Date(Date.now() - 12 * 60_000) } });
      enqueue.mockClear();
      expect(await lead.queueStrandedReportEmails()).toBe(1);
      expect((await db.reportEmail.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("pending");
      expect(enqueue).toHaveBeenCalledWith("check.email", { id: other.id }, { dedupeKey: `check-email:${other.id}` });
    });

    it("skips people who unsubscribed after asking", async () => {
      const { row } = await queued();
      await db.subscriber.updateMany({ data: { unsubscribedAt: new Date() } });
      expect(await lead.sendReportEmail(row.id)).toBe("skipped");
      expect(send).not.toHaveBeenCalled();
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "skipped", error: "Unsubscribed" });
    });

    it("fails loudly when email isn't set up, and gives up after the last try", async () => {
      const { row } = await queued();
      state.email = false;
      await expect(lead.runReportEmailJob({ payload: { id: row.id }, attempts: 1 })).rejects.toThrow(/Email is not set up/);
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "pending", attempts: 1 });
      await expect(lead.runReportEmailJob({ payload: { id: row.id }, attempts: 4 })).rejects.toThrow();
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "failed", attempts: 2 });
      expect(send).not.toHaveBeenCalled();
      // A failed email lets the browser ask again (once email works).
      state.email = true;
      expect((await post(row.checkId, { email: "ross@example.com" }, { "x-real-ip": "10.3.0.1" })).body.ok).toBe(true);
    });

    it("keeps the error and retries when sending fails", async () => {
      const { row } = await queued();
      state.sendFails = true;
      await expect(lead.sendReportEmail(row.id, 1)).rejects.toThrow("Resend 500: down");
      expect(await db.reportEmail.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "pending", error: "Resend 500: down" });
      state.sendFails = false;
      expect(await lead.sendReportEmail(row.id, 2)).toBe("sent");
    });

    it("skips emails for checks that were deleted", async () => {
      const { c, row } = await queued();
      await db.publicCheck.delete({ where: { id: c.id } });
      expect(await lead.sendReportEmail(row.id)).toBe("skipped");
    });
  });

  describe("unsubscribe", () => {
    it("shows the masked address, and unsubscribes by form or by one-click", async () => {
      const c = await doneCheck();
      await post(c.id, { email: "ross@example.com" });
      const { unsubscribeToken: t } = await db.subscriber.findUniqueOrThrow({ where: { email: "ross@example.com" } });
      const page = await unsub.loader({ request: new Request(`http://localhost/unsubscribe?t=${t}`), params: {}, context: {} } as never);
      expect(page).toEqual({ token: t, maskedEmail: "ro***@example.com", already: false });

      const oneClick = await unsub.action({
        request: new Request(`http://localhost/unsubscribe?t=${t}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "List-Unsubscribe=One-Click",
        }),
        params: {},
        context: {},
      } as never);
      expect(oneClick).toMatchObject({ data: { done: true }, init: { status: 200 } });
      expect((await db.subscriber.findUniqueOrThrow({ where: { email: "ross@example.com" } })).unsubscribedAt).not.toBeNull();

      const byForm = await unsub.action({
        request: new Request("http://localhost/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: `t=${t}`,
        }),
        params: {},
        context: {},
      } as never);
      expect(byForm).toMatchObject({ data: { done: true }, init: { status: 200 } });
      const wrong = await unsub.action({
        request: new Request("http://localhost/unsubscribe", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "t=nope" }),
        params: {},
        context: {},
      } as never);
      expect(wrong).toMatchObject({ data: { done: false }, init: { status: 404 } });
    });
  });

  it("deletes old report emails, hashed IPs after a day, and unsubscribed or inactive addresses (keeping only a hash of opt-outs)", async () => {
    const { purgeOldData, suppressionHash } = retention;
    const old = await db.reportEmail.create({ data: { email: "a@example.com", checkId: "x", createdAt: new Date(Date.now() - 91 * DAY) } });
    const dayOld = await db.reportEmail.create({ data: { email: "b@example.com", checkId: "x", ipHash: "abc", createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    const fresh = await db.reportEmail.create({ data: { email: "c@example.com", checkId: "x", ipHash: "def" } });
    const sub = (email: string, unsubscribedAt: Date | null, lastActiveAt = new Date(Date.now() - 40 * DAY)) =>
      db.subscriber.create({ data: { email, consentText: "x", consentAt: new Date(), unsubscribedAt, lastActiveAt, unsubscribeToken: email } });
    const gone = await sub("gone@example.com", new Date(Date.now() - 31 * DAY));
    const goneMail = await db.reportEmail.create({ data: { email: "gone@example.com", checkId: "x" } });
    const recent = await sub("recent@example.com", new Date(Date.now() - 5 * DAY));
    const askedAgain = await sub("again@example.com", new Date(Date.now() - 31 * DAY), new Date(Date.now() - 2 * DAY));
    const active = await sub("active@example.com", null);
    const idle = await sub("idle@example.com", null, new Date(Date.now() - 25 * 30 * DAY));
    await purgeOldData();
    expect(await db.reportEmail.findUnique({ where: { id: old.id } })).toBeNull();
    expect((await db.reportEmail.findUniqueOrThrow({ where: { id: dayOld.id } })).ipHash).toBeNull();
    expect((await db.reportEmail.findUniqueOrThrow({ where: { id: fresh.id } })).ipHash).toBe("def");
    expect(await db.subscriber.findUnique({ where: { id: gone.id } })).toBeNull();
    expect(await db.reportEmail.findUnique({ where: { id: goneMail.id } })).toBeNull(); // their report records go too
    expect(await db.subscriber.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await db.subscriber.findUnique({ where: { id: askedAgain.id } })).not.toBeNull(); // asked for a report since
    expect(await db.subscriber.findUnique({ where: { id: active.id } })).not.toBeNull();
    expect(await db.subscriber.findUnique({ where: { id: idle.id } })).toBeNull(); // 2 years without a request or click
    const hashes = (await db.emailSuppression.findMany()).map((x) => x.emailHash);
    expect(hashes).toEqual([suppressionHash("gone@example.com")]); // the opt-out only, as a hash
    expect(JSON.stringify(hashes)).not.toContain("gone");

    // Back later with a new request: they get that report, but stay off the tips list until they confirm.
    const c = await doneCheck();
    await post(c.id, { email: "gone@example.com", tips: "1" });
    const back = await db.subscriber.findUniqueOrThrow({ where: { email: "gone@example.com" } });
    expect(back.unsubscribedAt).not.toBeNull();
    const row = await db.reportEmail.findFirstOrThrow({ where: { email: "gone@example.com" } });
    expect(await lead.sendReportEmail(row.id)).toBe("sent");
    expect(await lead.confirmTips(back.unsubscribeToken)).toBe("on");
    expect(await db.emailSuppression.count()).toBe(0);
  });
});
