// Guides that go live by themselves on a business's own website (Ross, 19 Nov 2026: "this ALSO needs to be FULLY
// AUTOMATED"). Two kinds of website for now:
// - WordPress: a new page through WordPress's own REST API, signed in with an application password (Users > Profile >
//   Application passwords). Their normal login password is never asked for or saved.
// - A website kept on GitHub (plain HTML, like Perth Solar Panel Cleaners on Vercel): a new page made from one of the
//   site's own pages (its header, footer and styles kept, its main part swapped for the guide, lib/site-publish.ts),
//   committed with a fine-grained access key that can only change that one repository. Their host builds the site from
//   there, as it does for any change. The page is added to sitemap.xml when the site has one.
// Squarespace, Wix and the rest keep the copy and paste steps on the guide's page. The password or key is locked with
// AES-256-GCM before it is saved (GEO_SITE_KEY, else a key made from the database address).

import type { Fix, Shop, SiteLink } from "@prisma/client";
import db from "../db.server";
import { faqFromGuideHtml } from "./guide";
import { liveGuideBody, storeUrl } from "./fixes.server";
import { lock, unlock } from "./site-secret.server";
import { type SiteLinkInput, absolutise, addToSitemap, guideDescription, guidePageHtml, pagePlace, siteOrigin } from "./site-publish";

const TIMEOUT = 30_000;

// ---------- WordPress ----------

const wpAuth = (link: Pick<SiteLink, "login">, secret: string) => `Basic ${Buffer.from(`${link.login ?? ""}:${secret.replace(/\s+/g, "")}`).toString("base64")}`;

async function wp(link: Pick<SiteLink, "address" | "login">, secret: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${link.address}/wp-json/wp/v2${path}`, {
    ...init,
    headers: { authorization: wpAuth(link, secret), "content-type": "application/json", accept: "application/json", "user-agent": "RankWithRoss/1.0", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: a security plugin or the host answered instead of WordPress.
  }
  if (!res.ok) {
    const msg = (body as { message?: string } | null)?.message;
    if (res.status === 401 || res.status === 403) throw new Error(`WordPress didn’t accept the login${msg ? ` (${msg.replace(/<[^>]+>/g, "")})` : ""}. Check the username and make a new application password.`);
    if (res.status === 404) throw new Error("This website doesn’t answer like WordPress (its REST API is off or blocked by a plugin).");
    throw new Error(`WordPress said ${res.status}${msg ? `: ${msg.replace(/<[^>]+>/g, "")}` : ""}`);
  }
  if (body === null) throw new Error("This website answered, but not like WordPress. A security plugin may be blocking it.");
  return body;
}

// ---------- GitHub ----------

async function gh(token: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "RankWithRoss/1.0",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const ghError = (what: string, r: { status: number; body: unknown }) => {
  const msg = (r.body as { message?: string } | null)?.message;
  if (r.status === 401) return new Error("GitHub didn’t accept the access key. It may have expired: make a new one.");
  if (r.status === 403 || r.status === 404) return new Error(`GitHub wouldn’t let us ${what}. Check the key can read and write Contents on this repository.`);
  return new Error(`GitHub said ${r.status} when we tried to ${what}${msg ? `: ${msg}` : ""}`);
};

const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

interface GhFile {
  sha: string;
  text: string;
}

async function readFile(token: string, repo: string, path: string, ref: string): Promise<GhFile | null> {
  const r = await gh(token, `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
  if (r.status === 404) return null;
  if (r.status !== 200) throw ghError(`read ${path}`, r);
  const f = r.body as { sha: string; content?: string; encoding?: string; type?: string };
  if (f.type !== "file" || typeof f.content !== "string") return null;
  return { sha: f.sha, text: Buffer.from(f.content, "base64").toString("utf8") };
}

async function writeFile(token: string, repo: string, path: string, branch: string, text: string, message: string, sha?: string) {
  const r = await gh(token, `/repos/${repo}/contents/${encodePath(path)}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: Buffer.from(text, "utf8").toString("base64"), branch, ...(sha ? { sha } : {}) }),
  });
  if (r.status !== 200 && r.status !== 201) throw ghError(`save ${path}`, r);
}

async function listFolder(token: string, repo: string, folder: string, ref: string): Promise<string[]> {
  const r = await gh(token, `/repos/${repo}/contents/${encodePath(folder)}?ref=${encodeURIComponent(ref)}`);
  if (r.status !== 200 || !Array.isArray(r.body)) throw ghError(`read the folder “${folder || "top"}”`, r);
  return (r.body as { name: string; type: string }[]).filter((f) => f.type === "file").map((f) => f.name);
}

async function branchOf(token: string, link: Pick<SiteLink, "address" | "login">): Promise<string> {
  if (link.login) return link.login;
  const r = await gh(token, `/repos/${link.address}`);
  if (r.status !== 200) throw ghError("open the repository", r);
  return (r.body as { default_branch?: string }).default_branch ?? "main";
}

// ---------- Connecting ----------

/** Try the login: what we could see, or why it didn't work. Nothing is changed on their website. */
export async function testSite(input: Pick<SiteLinkInput, "kind" | "address" | "login" | "folder">, secret: string): Promise<string> {
  if (input.kind === "wordpress") {
    const me = (await wp(input, secret, "/users/me?context=edit")) as { name?: string; capabilities?: Record<string, boolean> };
    if (me.capabilities && !me.capabilities.publish_pages) throw new Error(`WordPress user ${me.name ?? input.login} can’t publish pages. Use an Editor or Administrator login.`);
    return `Signed in to WordPress as ${me.name ?? input.login}. Guides go live as new pages.`;
  }
  const repo = await gh(secret, `/repos/${input.address}`);
  if (repo.status !== 200) throw ghError("open the repository", repo);
  const branch = input.login || (repo.body as { default_branch?: string }).default_branch || "main";
  const files = await listFolder(secret, input.address, input.folder ?? "", branch);
  const place = pagePlace(files, input.folder ?? "", "example");
  if (!place.template) throw new Error(`There’s no web page in the folder “${input.folder || "top"}” to copy the look from. Check the folder.`);
  return `Opened ${input.address} (${branch}). New guides copy the look of ${place.template} and go in as ${place.path.replace("example", "<guide>")}.`;
}

/** Save the connection after it worked once. */
export async function saveSiteLink(shopId: string, input: SiteLinkInput, by: string): Promise<string> {
  const ok = await testSite(input, input.secret);
  const data = { kind: input.kind, address: input.address, login: input.login, folder: input.folder, secret: lock(input.secret), checkedAt: new Date(), error: null, createdBy: by };
  await db.siteLink.upsert({ where: { shopId }, create: { shopId, ...data }, update: data });
  return ok;
}

export const removeSiteLink = (shopId: string) => db.siteLink.deleteMany({ where: { shopId } });

/** Whether guides can go live on this business's website by themselves. */
export async function siteLinked(shopId: string): Promise<boolean> {
  return Boolean(await db.siteLink.findUnique({ where: { shopId }, select: { id: true } }));
}

/** What the website page shows about the connection (never the password or key). */
export async function siteLinkView(shopId: string) {
  const l = await db.siteLink.findUnique({ where: { shopId } });
  return l ? { kind: l.kind, address: l.address, login: l.kind === "wordpress" ? l.login : null, branch: l.kind === "github" ? l.login : null, folder: l.folder, checkedAt: l.checkedAt?.toISOString() ?? null, error: l.error } : null;
}

// ---------- Publishing ----------

interface GuideAfter {
  title?: string;
  handle?: string;
  bodyHtml?: string;
}

/** Put a written guide live on the business's website. Returns the page's address. */
export async function publishToSite(shop: Pick<Shop, "id" | "primaryDomain" | "domain">, fix: Fix, now = new Date()): Promise<string> {
  const link = await db.siteLink.findUnique({ where: { shopId: shop.id } });
  if (!link) throw new Error("Their website isn’t connected.");
  const after = fix.after as GuideAfter;
  const title = after.title ?? fix.targetTitle;
  const handle = (after.handle ?? "").replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "") || `guide-${fix.id.slice(-6)}`;
  try {
    const secret = unlock(link.secret);
    const body = await liveGuideBody(fix, now);
    let url: string;
    if (link.kind === "wordpress") {
      const page = (await wp(link, secret, "/pages", {
        method: "POST",
        body: JSON.stringify({ title, content: body, slug: handle, status: "publish", excerpt: guideDescription(body) }),
      })) as { link?: string };
      if (!page.link) throw new Error("WordPress made the page but didn’t say its address.");
      url = page.link;
    } else {
      const branch = await branchOf(secret, link);
      const folder = link.folder ?? "";
      const files = await listFolder(secret, link.address, folder, branch);
      const place = pagePlace(files, folder, handle);
      if (!place.template) throw new Error(`There’s no web page in the folder “${folder || "top"}” to copy the look from.`);
      const [template, sitemap, existing] = await Promise.all([
        readFile(secret, link.address, place.template, branch),
        files.includes("sitemap.xml") ? readFile(secret, link.address, folder ? `${folder}/sitemap.xml` : "sitemap.xml", branch) : null,
        readFile(secret, link.address, place.path, branch),
      ]);
      if (!template) throw new Error(`Couldn’t read ${place.template}.`);
      url = `${siteOrigin(sitemap?.text ?? null, template.text, storeUrl(shop))}${place.urlPath}`;
      let page = guidePageHtml(template.text, { title, description: guideDescription(body), url, bodyHtml: body, faq: faqFromGuideHtml(title, body), updated: now.toISOString().slice(0, 10) });
      if (!page) throw new Error(`${place.template} has no <main> part (or header and footer) to put the guide in, so this website needs copy and paste.`);
      if (place.nested) page = absolutise(page);
      const message = `Add guide: ${title.slice(0, 60)} (Rank with Ross)`;
      await writeFile(secret, link.address, place.path, branch, page, message, existing?.sha);
      if (sitemap) {
        const next = addToSitemap(sitemap.text, url, now.toISOString().slice(0, 10));
        if (next !== sitemap.text) await writeFile(secret, link.address, folder ? `${folder}/sitemap.xml` : "sitemap.xml", branch, next, `Add ${place.urlPath} to the sitemap (Rank with Ross)`, sitemap.sha);
      }
    }
    await db.siteLink.update({ where: { id: link.id }, data: { checkedAt: now, error: null } });
    return url;
  } catch (err) {
    await db.siteLink.update({ where: { id: link.id }, data: { error: (err as Error).message.slice(0, 300) } }).catch(() => {});
    throw err;
  }
}
