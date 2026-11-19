import { describe, expect, it } from "vitest";
import { absolutise, addToSitemap, cleanFolder, githubRepo, guideDescription, guidePageHtml, pagePlace, readSiteLinkForm, siteOrigin, wordpressAddress } from "../app/lib/site-publish";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("the website connection form", () => {
  it("reads a WordPress login", () => {
    const r = readSiteLinkForm(form({ kind: "wordpress", address: "example.com.au/", login: "ross", secret: "abcd efgh ijkl mnop qrst uvwx" }));
    expect(r).toEqual({ ok: true, value: { kind: "wordpress", address: "https://example.com.au", login: "ross", folder: null, secret: "abcd efgh ijkl mnop qrst uvwx" } });
    expect(readSiteLinkForm(form({ kind: "wordpress", address: "example.com.au", login: "", secret: "abcd efgh ijkl mnop qrst uvwx" })).ok).toBe(false);
    expect(readSiteLinkForm(form({ kind: "wordpress", address: "example.com.au", login: "ross", secret: "short" })).ok).toBe(false);
  });

  it("reads a GitHub repository, branch and folder", () => {
    const r = readSiteLinkForm(form({ kind: "github", address: "https://github.com/rossdelport/perthsolarpanelcleaners.git", login: "", folder: "/public/../", secret: "github_pat_1234567890abcdefghij" }));
    expect(r).toEqual({ ok: true, value: { kind: "github", address: "rossdelport/perthsolarpanelcleaners", login: null, folder: "public", secret: "github_pat_1234567890abcdefghij" } });
    expect(readSiteLinkForm(form({ kind: "github", address: "not a repo", secret: "github_pat_1234567890abcdefghij" })).ok).toBe(false);
    expect(readSiteLinkForm(form({ kind: "ftp" })).ok).toBe(false);
  });

  it("tidies addresses", () => {
    expect(wordpressAddress("http://example.com/blog/")).toBe("https://example.com/blog");
    expect(wordpressAddress("nope")).toBeNull();
    expect(githubRepo("owner/repo")).toBe("owner/repo");
    expect(cleanFolder("")).toBe("");
    expect(cleanFolder("./site/pages/")).toBe("site/pages");
  });
});

const TEMPLATE = `<!DOCTYPE html>
<html lang="en"><head>
<title>About | Perth Solar Panel Cleaners</title>
<meta name="description" content="About us.">
<link rel="canonical" href="https://www.pspc.com/about.html">
<meta property="og:title" content="About">
<meta property="og:url" content="https://www.pspc.com/about.html">
<link rel="stylesheet" href="styles.css">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"PSPC"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"AboutPage","name":"About"}</script>
</head><body>
<header><a href="index.html">Home</a><a href="about.html" aria-current="page">About</a></header>
<main class="about"><h1>About us</h1><p>Run by Ross.</p></main>
<footer>© PSPC</footer>
</body></html>`;

const BODY = `<p><strong>Short answer:</strong> Clean them once or twice a year in Perth.</p>\n<h2>How often should I clean solar panels?</h2>\n<p>Once or twice a year.</p>`;

describe("a guide page made from one of the website's pages", () => {
  const page = guidePageHtml(TEMPLATE, {
    title: "How often should solar panels be cleaned in Perth?",
    description: guideDescription(BODY),
    url: "https://www.pspc.com/how-often.html",
    bodyHtml: BODY,
    faq: [{ q: "How often should I clean solar panels?", a: "Once or twice a year." }],
    updated: "2026-11-20",
  })!;

  it("keeps the look and swaps the main part for the guide", () => {
    expect(page).toContain('<link rel="stylesheet" href="styles.css">');
    expect(page).toContain("<header>");
    expect(page).toContain("<footer>© PSPC</footer>");
    expect(page).toContain('<main class="about">\n<article class="rr-guide">\n<h1>How often should solar panels be cleaned in Perth?</h1>');
    expect(page).not.toContain("Run by Ross.");
    expect(page).not.toContain('aria-current="page"');
  });

  it("gives it its own title, description, address and share tags", () => {
    expect(page).toContain("<title>How often should solar panels be cleaned in Perth?</title>");
    expect(page).toContain('<meta name="description" content="Clean them once or twice a year in Perth.">');
    expect(page).toContain('<link rel="canonical" href="https://www.pspc.com/how-often.html">');
    expect(page).toContain('<meta property="og:url" content="https://www.pspc.com/how-often.html">');
    expect(page).not.toContain("about.html\">\n<meta property");
  });

  it("keeps the business data, drops the about page's, and adds the guide's questions", () => {
    expect(page).toContain('"@type":"LocalBusiness"');
    expect(page).not.toContain("AboutPage");
    expect(page).toContain('"@type":"FAQPage"');
    expect(page).toContain('"dateModified":"2026-11-20"');
  });

  it("works without a <main>, between the header and the footer, and gives up with neither", () => {
    const noMain = TEMPLATE.replace(/<main[^>]*>/, "<div>").replace("</main>", "</div>");
    const made = guidePageHtml(noMain, { title: "T?", description: "d", url: "https://x.com/t.html", bodyHtml: "<p>b</p>", faq: [], updated: "2026-11-20" })!;
    expect(made).toContain("</header>\n<main>\n<article");
    expect(made).toContain("</main>\n<footer>");
    expect(guidePageHtml("<html><body><p>hi</p></body></html>", { title: "T", description: "d", url: "u", bodyHtml: "", faq: [], updated: "" })).toBeNull();
  });
});

describe("where a guide goes on a website kept on GitHub", () => {
  it("copies how the site names its pages", () => {
    expect(pagePlace(["index.html", "about.html", "services.html", "sitemap.xml"], "", "how-often")).toEqual({ path: "how-often.html", urlPath: "/how-often.html", template: "about.html", nested: false });
    expect(pagePlace(["index.html", "robots.txt"], "public", "how-often")).toEqual({ path: "public/how-often/index.html", urlPath: "/how-often/", template: "public/index.html", nested: true });
    expect(pagePlace(["readme.md"], "", "x").template).toBeNull();
  });

  it("makes a nested page's links start from the top", () => {
    expect(absolutise('<link href="styles.css"><img src="./img/a.png"><a href="/x">x</a><a href="https://y.com">y</a><a href="#top">t</a>')).toBe(
      '<link href="/styles.css"><img src="/img/a.png"><a href="/x">x</a><a href="https://y.com">y</a><a href="#top">t</a>',
    );
  });

  it("adds the page to the sitemap once, and finds the site's own address", () => {
    const xml = "<urlset>\n  <url><loc>https://www.pspc.com/</loc></url>\n</urlset>";
    const next = addToSitemap(xml, "https://www.pspc.com/how-often.html", "2026-11-20");
    expect(next).toContain("<loc>https://www.pspc.com/how-often.html</loc>\n    <lastmod>2026-11-20</lastmod>");
    expect(addToSitemap(next, "https://www.pspc.com/how-often.html", "2026-11-21")).toBe(next);
    expect(siteOrigin(xml, "", "https://pspc.com")).toBe("https://www.pspc.com");
    expect(siteOrigin(null, TEMPLATE, "https://pspc.com")).toBe("https://www.pspc.com");
    expect(siteOrigin(null, "", "https://pspc.com")).toBe("https://pspc.com");
  });

  it("describes the guide from its short answer", () => {
    expect(guideDescription(`<p><strong>Short answer:</strong> ${"word ".repeat(60)}</p>`).length).toBeLessThanOrEqual(155);
  });
});
