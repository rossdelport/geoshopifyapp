import { describe, expect, it } from "vitest";
import { classifyOrder, classifyVisit, engineFromReferrer, engineFromUtm } from "../app/lib/attribution";

const OURS = "geo-app";

describe("engineFromReferrer", () => {
  it.each([
    ["https://chatgpt.com/", "chatgpt"],
    ["https://chat.openai.com/c/123", "chatgpt"],
    ["https://www.perplexity.ai/search?q=x", "perplexity"],
    ["https://gemini.google.com/app", "gemini"],
    ["https://copilot.microsoft.com/", "copilot"],
    ["https://www.bing.com/chat?q=x", "copilot"],
    ["https://claude.ai/chat/1", "claude"],
    ["chatgpt.com", "chatgpt"],
  ])("%s -> %s", (ref, engine) => expect(engineFromReferrer(ref)).toBe(engine));

  it("ignores normal sites, Google search and plain Bing", () => {
    expect(engineFromReferrer("https://www.google.com/")).toBeNull();
    expect(engineFromReferrer("https://www.bing.com/search?q=x")).toBeNull();
    expect(engineFromReferrer("https://notchatgpt.com.evil.net/")).toBeNull();
    expect(engineFromReferrer("")).toBeNull();
    expect(engineFromReferrer("not a url ::")).toBeNull();
  });
});

describe("engineFromUtm", () => {
  it("knows ChatGPT's own tag", () => expect(engineFromUtm("chatgpt.com")).toBe("chatgpt"));
  it("ignores other tags", () => expect(engineFromUtm("newsletter")).toBeNull());
});

describe("classifyVisit", () => {
  it("reads utm_source from the landing page URL", () => {
    expect(classifyVisit({ landingPage: "/products/oil?utm_source=chatgpt.com" }, OURS)?.engine).toBe("chatgpt");
  });
  it("our own links win", () => {
    expect(classifyVisit({ landingPage: "https://shop.com/products/a?utm_source=geo-app&utm_medium=ai-guide", referrerUrl: "https://chatgpt.com" }, OURS)?.engine).toBe("ours");
  });
  it("returns null for normal traffic", () => {
    expect(classifyVisit({ landingPage: "/", referrerUrl: "https://www.google.com/" }, OURS)).toBeNull();
  });
});

describe("classifyOrder", () => {
  it("uses the last visit first", () => {
    const r = classifyOrder(
      {
        firstVisit: { referrerUrl: "https://www.perplexity.ai/" },
        lastVisit: { landingPage: "/products/x?utm_source=chatgpt.com" },
      },
      OURS,
    );
    expect(r).toMatchObject({ engine: "chatgpt", ours: false });
    expect(r?.reason).toMatch(/last visit/);
  });

  it("falls back to the first visit", () => {
    expect(classifyOrder({ firstVisit: { referrerUrl: "https://gemini.google.com/" }, lastVisit: { referrerUrl: "https://google.com" } }, OURS)?.engine).toBe("gemini");
  });

  it("marks orders through our pages as ours", () => {
    expect(classifyOrder({ firstVisit: { utmSource: "geo-app" }, lastVisit: null }, OURS)).toMatchObject({ ours: true, engine: "ours" });
  });

  it("detects AI sales channels", () => {
    expect(classifyOrder({ channelName: "ChatGPT", sourceName: "web" }, OURS)?.engine).toBe("chatgpt");
    expect(classifyOrder({ channelHandle: "agentic-storefronts", channelName: "Agentic" }, OURS)?.engine).toBe("other_ai");
  });

  it("returns null for a normal order (the test from the plan: utm_source=chatgpt.com counts)", () => {
    expect(classifyOrder({ sourceName: "web", lastVisit: { referrerUrl: "https://facebook.com" } }, OURS)).toBeNull();
    expect(classifyOrder({ lastVisit: { utmSource: "chatgpt.com", landingPage: "/" } }, OURS)?.engine).toBe("chatgpt");
  });
});
