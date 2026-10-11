import { useEffect, useRef } from "react";
import type { HeadersFunction, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { isRouteErrorResponse, useLoaderData, useRevalidator, useRouteError } from "react-router";
import { getCheckUrl, getCheckView } from "../lib/check.server";
import { CHECK_FONT_LINKS, CheckFailed, CheckForm, CheckReport, CheckShell, ProductCard } from "../components/check-ui";
import { CheckLive, liveAnnouncement } from "../components/check-live";
import styles from "../styles/check.css?url";
import liveStyles from "../styles/check-live.css?url";

// Free product check: the live check while it runs, then the shareable report. Public, no login.
// Running and done use the same frame (CheckShell): the band with the product card, then the main
// container; only what is inside the container changes. The email popup (check-lead.tsx) is on for
// running and done checks, never on a failed one.

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const id = params.id ?? "";
  // The request carries this browser's email cookie, so the page shows whether its report was sent.
  const view = /^[a-z0-9_-]{1,64}$/i.test(id) ? await getCheckView(id, request) : null;
  if (!view) throw new Response("Not found", { status: 404 });
  // No product yet (still reading, or we couldn't read the page): show the link it was started with.
  const url = view.status === "done" ? null : (view.product?.url ?? (await getCheckUrl(id)));
  return { view, url };
};

// The page depends on this browser's email cookie (the masked address, lead status): never cache it in a
// shared cache (a CDN, a proxy), or one visitor could see another's. Applies to the page and its .data.
export const headers: HeadersFunction = () => ({ "Cache-Control": "private, no-store", Vary: "Cookie" });

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.view.product ? `Free product check: ${data.view.product.title} · GEO` : "Free product check · GEO" },
  { name: "description", content: "Does AI recommend this product? A free check across ChatGPT, Gemini and Perplexity." },
  { name: "robots", content: "noindex" },
];

export const links: LinksFunction = () => [
  ...CHECK_FONT_LINKS,
  { rel: "stylesheet", href: styles },
  { rel: "stylesheet", href: liveStyles },
];

export default function CheckPage() {
  const { view, url } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const running = view.status !== "done" && view.status !== "failed";

  // Ask for fresh progress every 3 seconds until the check is done.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (revalidator.state === "idle" && document.visibilityState === "visible") revalidator.revalidate();
    }, 3000);
    return () => clearInterval(timer);
  }, [running, revalidator]);

  // The report replaces the live view in place. Someone who scrolled down to watch the AI at work would
  // land mid-report with the ring out of view: bring the score card up (16px from the top), move focus to
  // its heading, and the shell's live region says "Your report is ready".
  const was = useRef(view.status);
  useEffect(() => {
    const before = was.current;
    was.current = view.status;
    if (before === "done" || before === "failed" || view.status !== "done") return;
    const card = document.querySelector<HTMLElement>(".ck-score");
    if (!card) return;
    const top = card.getBoundingClientRect().top;
    if (top < 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, top + window.scrollY - 16), behavior: reduce ? "auto" : "smooth" });
    }
    document.getElementById("ck-score-h")?.focus({ preventScroll: true });
  }, [view.status]);

  // A check that failed before reading the page has no product to show: the message takes its place.
  if (!view.product && !running) {
    return <CheckShell hero={<CheckFailed view={view} url={url} asTitle />} />;
  }
  const failed = view.status === "failed";
  const announce = running ? liveAnnouncement(view) : failed ? "This check didn’t finish" : "Your report is ready";
  return (
    <CheckShell
      lead={failed ? null : view}
      announce={announce}
      hero={
        <ProductCard product={view.product} country={view.country} done={view.status === "done"} running={running} nudge={!failed} url={url} />
      }
    >
      {view.status === "done" ? <CheckReport view={view} /> : failed ? <CheckFailed view={view} url={url} /> : <CheckLive view={view} url={url} />}
    </CheckShell>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  if (!missing) console.error("[check] page error", error);
  return (
    <CheckShell
      hero={
        <section className="ck-card ck-msg">
          <h1 className="ck-h2">{missing ? "We couldn’t find that check" : "Something went wrong"}</h1>
          <p>
            {missing
              ? "The link may be wrong, or the check is more than 30 days old and was deleted. You can run a new one here."
              : "Please try again in a minute, or start a new check."}
          </p>
          <CheckForm />
        </section>
      }
    />
  );
}
