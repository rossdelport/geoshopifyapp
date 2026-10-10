import type { ActionFunctionArgs, LinksFunction, MetaFunction } from "react-router";
import { data, redirect, useActionData } from "react-router";
import { createCheck } from "../lib/check.server";
import { env } from "../lib/env.server";
import { CHECK_FONT_LINKS, CheckIntro, CheckPerks, CheckShell } from "../components/check-ui";
import styles from "../styles/check.css?url";

// Free product check: the form. The home page hero posts here too (plain HTML form, works without JS).
// The form is just the product link: the check works out where the store is. An old form or link
// that still sends `country` gets that country (createCheck checks it).

export const meta: MetaFunction = () => [
  { title: "Free product check: does AI recommend your product? · GEO" },
  {
    name: "description",
    content:
      "Paste a product link and see whether ChatGPT, Gemini and Perplexity recommend it, who they pick instead, and which sites they trust. Free, no sign-up.",
  },
];

export const links: LinksFunction = () => [...CHECK_FONT_LINKS, { rel: "stylesheet", href: styles }];

/**
 * The visitor's IP, only used (hashed) to limit free checks. Railway sets x-real-ip to the client's
 * address. Fallback: the last x-forwarded-for entry, the one our proxy added (visitors can fake the first).
 */
function clientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return real || forwarded || null;
}

/**
 * Posts from other websites are refused: a page elsewhere could auto-submit our form from its
 * visitors' browsers (each with a new IP) and use up everyone's free checks.
 */
function fromAnotherSite(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false; // old browsers and tools; the per-visitor limits still apply
  const ours = [request.url, env.appUrl].map((u) => {
    try {
      return new URL(u).origin;
    } catch {
      return null;
    }
  });
  return !ours.includes(origin);
}

const MAX_FORM_BYTES = 8_192; // the form has 2 short fields (3 on old forms)

/** The posted form, or null when the body is too big to be our form. Never buffers more than the cap. */
async function readSmallForm(request: Request): Promise<URLSearchParams | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FORM_BYTES) return null;
  if (!request.body) return new URLSearchParams();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FORM_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new URLSearchParams(new TextDecoder().decode(Buffer.concat(chunks)));
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (fromAnotherSite(request)) {
    return data({ error: "Please start your check from the GEO website.", url: "" }, { status: 403 });
  }
  const form = await readSmallForm(request);
  if (!form) return data({ error: "That was too much to send. Please paste just the product link.", url: "" }, { status: 413 });
  const url = String(form.get("url") ?? "").trim();
  const country = form.get("country"); // old forms only
  const honeypot = String(form.get("website") ?? "");

  let result;
  try {
    result = await createCheck({ url, country: country ? String(country) : null, ip: clientIp(request), honeypot });
  } catch (err) {
    console.error("[check] could not start a check", err);
    result = { ok: false as const, error: "Something went wrong. Please try again." };
  }
  if (result.ok) return redirect(`/check/${result.id}`);
  return { error: result.error, url };
};

export default function CheckStart() {
  const data = useActionData<typeof action>();
  return (
    <CheckShell hero={<CheckIntro url={data?.url} error={data?.error} />}>
      <CheckPerks />
    </CheckShell>
  );
}
