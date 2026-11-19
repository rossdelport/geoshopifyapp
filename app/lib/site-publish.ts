// Guides that go live by themselves on a business's own website (Ross, 19 Nov 2026: "this ALSO needs to be FULLY
// AUTOMATED"). The pure parts, tested in test/site-publish.test.ts: reading the connection form, and making a guide
// page from one of the website's own pages. lib/site-publish.server.ts talks to WordPress and GitHub.

export type SiteKind = "wordpress" | "github";
export const SITE_KINDS: SiteKind[] = ["wordpress", "github"];
export const SITE_KIND_LABEL: Record<SiteKind, string> = { wordpress: "WordPress", github: "GitHub (a website kept on GitHub, like one on Vercel or Netlify)" };

export interface SiteLinkInput {
  kind: SiteKind;
  address: string; // wordpress: https://example.com.au; github: owner/repo
  login: string | null; // wordpress: the username; github: the branch (empty: the repo's own)
  folder: string | null; // github: the folder the website's pages are in ("" for the top)
  secret: string; // the application password or the access key
}

/** Read the connection form. Returns what to fix when something's missing. */
export function readSiteLinkForm(form: FormData): { ok: true; value: SiteLinkInput } | { ok: false; error: string } {
  const kind = String(form.get("kind") ?? "");
  const text = (name: string, max = 300) =>
    String(form.get(name) ?? "")
      .trim()
      .slice(0, max);
  const secret = text("secret", 400).replace(/\s+/g, kind === "wordpress" ? " " : "");
  if (kind === "wordpress") {
    const address = wordpressAddress(text("address"));
    if (!address) return { ok: false, error: "Type their WordPress website address, like https://example.com.au." };
    const login = text("login", 100);
    if (!login) return { ok: false, error: "Type the WordPress username the application password belongs to." };
    if (secret.replace(/\s/g, "").length < 16) return { ok: false, error: "Paste the application password WordPress made (24 letters, with spaces)." };
    return { ok: true, value: { kind, address, login, folder: null, secret } };
  }
  if (kind === "github") {
    const repo = githubRepo(text("address"));
    if (!repo) return { ok: false, error: "Type the GitHub repository as owner/name, like rossdelport/mysite." };
    const branch = text("login", 100).replace(/[^\w./-]/g, "") || null;
    const folder = cleanFolder(text("folder", 200));
    if (secret.length < 20) return { ok: false, error: "Paste the GitHub access key (it starts with github_pat_)." };
    return { ok: true, value: { kind, address: repo, login: branch, folder, secret } };
  }
  return { ok: false, error: "Choose WordPress or GitHub." };
}

/** "example.com.au/" -> "https://example.com.au" (http stays http only for a local test site). */
export function wordpressAddress(raw: string): string | null {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!u.hostname.includes(".")) return null;
    return `${u.protocol === "http:" && u.hostname !== "localhost" ? "https:" : u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** "https://github.com/owner/repo.git" or "owner/repo" -> "owner/repo". */
export function githubRepo(raw: string): string | null {
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(raw.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** "/public/" -> "public"; "" stays "" (the top of the repository). Never "..". */
export function cleanFolder(raw: string): string {
  return raw
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p && p !== "." && p !== "..")
    .join("/");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The guide's "Short answer", as plain words, for the page's description (at most 155 characters). */
export function guideDescription(bodyHtml: string): string {
  const short = /<strong>\s*Short answer:\s*<\/strong>([\s\S]{1,3000}?)<\/p>/i.exec(bodyHtml)?.[1] ?? bodyHtml;
  const words = short
    .replace(/<[^>]{0,500}>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (words.length <= 155) return words;
  const cut = words.slice(0, 152);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 100))}...`;
}

// Page types that belong to one page only: a guide made from the about page must not say it is the about page.
const PAGE_TYPES = /"@type"\s*:\s*(?:\[[^\]]*)?"(?:AboutPage|ContactPage|FAQPage|BreadcrumbList|WebPage|CollectionPage|ItemList|Article|BlogPosting|NewsArticle|Service|Review|Product|Offer|HowTo|QAPage|SearchResultsPage|ProfilePage)"/;

/**
 * A guide page made from one of the website's own pages: its head, header, footer and styles stay; its title,
 * description, canonical address and share tags become the guide's; its main part becomes the guide. Structured data
 * about the business stays, data about that one page goes, and the guide's questions and answers are added as
 * FAQPage data. Null when the page has no main part to swap (no <main>, and no header and footer around one).
 */
export function guidePageHtml(
  template: string,
  g: { title: string; description: string; url: string; bodyHtml: string; faq: { q: string; a: string }[]; updated: string },
): string | null {
  const article = `<article class="rr-guide">\n<h1>${esc(g.title)}</h1>\n${g.bodyHtml}\n</article>`;
  let html: string;
  const main = /(<main\b[^>]*>)([\s\S]*?)(<\/main>)/i.exec(template);
  if (main) {
    html = template.slice(0, main.index) + main[1] + "\n" + article + "\n" + main[3] + template.slice(main.index + main[0].length);
  } else {
    const headEnd = template.search(/<\/header>/i);
    const footStart = template.search(/<footer\b[^>]*>(?![\s\S]*<footer\b)/i);
    if (headEnd < 0 || footStart < 0 || footStart < headEnd) return null;
    const after = headEnd + "</header>".length;
    html = `${template.slice(0, after)}\n<main>\n${article}\n</main>\n${template.slice(footStart)}`;
  }

  // The head: title, description, canonical and share tags.
  const setTag = (h: string, re: RegExp, tag: string) => (re.test(h) ? h.replace(re, tag) : h.replace(/<\/head>/i, `${tag}\n</head>`));
  html = setTag(html, /<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(g.title)}</title>`);
  html = setTag(html, /<meta\s+[^>]*name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(g.description)}">`);
  html = setTag(html, /<link\s+[^>]*rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(g.url)}">`);
  for (const [prop, value] of [
    ["og:title", g.title],
    ["og:description", g.description],
    ["og:url", g.url],
    ["og:type", "article"],
  ]) {
    html = html.replace(new RegExp(`<meta\\s+[^>]*property=["']${prop}["'][^>]*>`, "i"), `<meta property="${prop}" content="${esc(value)}">`);
  }
  html = html.replace(/<meta\s+[^>]*name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${esc(g.title)}">`);
  html = html.replace(/<meta\s+[^>]*name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${esc(g.description)}">`);
  html = html.replace(/\saria-current=["']page["']/gi, "");

  // Structured data: keep what's about the business, drop what's about the page it was made from, add the guide's.
  html = html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, (block) => (PAGE_TYPES.test(block) ? "" : block));
  const data = [
    { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description, url: g.url, dateModified: g.updated },
    ...(g.faq.length
      ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }]
      : []),
  ];
  const json = JSON.stringify(data.length === 1 ? data[0] : data).replace(/</g, "\\u003c");
  const style = "<style>.rr-guide{max-width:760px;margin:0 auto;padding:48px 20px 64px;line-height:1.6}.rr-guide h1{margin:0 0 16px}.rr-guide h2{margin:32px 0 8px}</style>";
  html = html.replace(/<\/head>/i, `<script type="application/ld+json">${json}</script>\n${style}\n</head>`);
  return html;
}

/** Make the page's own relative links start from the top of the website, so a page saved one folder down still finds its styles. */
export function absolutise(html: string): string {
  return html.replace(/\s(href|src)=(["'])(?![a-z][a-z0-9+.-]*:|\/|#|\?|\{)([^"']*)\2/gi, (_m, attr: string, q: string, path: string) => ` ${attr}=${q}/${path.replace(/^\.\//, "")}${q}`);
}

/** Add a page to sitemap.xml, once. Returns the sitemap unchanged when the page is in it already. */
export function addToSitemap(xml: string, url: string, day: string): string {
  if (xml.includes(`<loc>${esc(url)}</loc>`) || !/<\/urlset>/i.test(xml)) return xml;
  return xml.replace(/<\/urlset>/i, `  <url>\n    <loc>${esc(url)}</loc>\n    <lastmod>${day}</lastmod>\n  </url>\n</urlset>`);
}

/** The website's address as its own pages give it: the sitemap's first address, else the page's canonical, else the fallback. */
export function siteOrigin(sitemap: string | null, template: string, fallback: string): string {
  const loc = sitemap ? /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/i.exec(sitemap)?.[1] : null;
  const canon = /<link\s+[^>]*rel=["']canonical["'][^>]*href=["'](https?:\/\/[^"']+)["']/i.exec(template)?.[1] ?? /<link\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*rel=["']canonical["']/i.exec(template)?.[1];
  for (const u of [loc, canon, fallback]) {
    if (!u) continue;
    try {
      return new URL(u).origin;
    } catch {
      // try the next
    }
  }
  return fallback.replace(/\/+$/, "");
}

/**
 * Where a guide goes in a website's folder, copying how the site names its own pages: "about.html" pages get
 * "<handle>.html" (address /<handle>.html), "about/index.html" pages get "<handle>/index.html" (address /<handle>/).
 */
export function pagePlace(files: string[], folder: string, handle: string): { path: string; urlPath: string; template: string | null; nested: boolean } {
  const inFolder = (name: string) => (folder ? `${folder}/${name}` : name);
  const flat = files.filter((f) => /\.html?$/i.test(f) && !/^index\.html?$/i.test(f) && !/^(404|500)\.html?$/i.test(f));
  const prefer = ["about.html", "services.html", "service-areas.html", "contact.html"];
  if (flat.length) {
    const template = prefer.find((p) => flat.includes(p)) ?? flat[0];
    return { path: inFolder(`${handle}.html`), urlPath: `/${handle}.html`, template: inFolder(template), nested: false };
  }
  const index = files.find((f) => /^index\.html?$/i.test(f));
  return { path: inFolder(`${handle}/index.html`), urlPath: `/${handle}/`, template: index ? inFolder(index) : null, nested: true };
}
