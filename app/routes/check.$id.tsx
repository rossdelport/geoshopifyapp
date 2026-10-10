import { useEffect } from "react";
import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { isRouteErrorResponse, useLoaderData, useRevalidator, useRouteError } from "react-router";
import { getCheckUrl, getCheckView } from "../lib/check.server";
import {
  CHECK_FONT_LINKS,
  CheckFailed,
  CheckForm,
  CheckReport,
  CheckRunning,
  CheckShell,
  ProductCard,
} from "../components/check-ui";
import styles from "../styles/check.css?url";

// Free product check: progress while it runs, then the shareable report. Public, no login.

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const id = params.id ?? "";
  const view = /^[a-z0-9_-]{1,64}$/i.test(id) ? await getCheckView(id) : null;
  if (!view) throw new Response("Not found", { status: 404 });
  // A failed check may have no product (we couldn't read the page): show the link it was started with.
  const url = view.status === "failed" ? (view.product?.url ?? (await getCheckUrl(id))) : null;
  return { view, url };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.view.product ? `Free product check: ${data.view.product.title} · GEO` : "Free product check · GEO" },
  { name: "description", content: "Does AI recommend this product? A free check across ChatGPT, Gemini and Perplexity." },
  { name: "robots", content: "noindex" },
];

export const links: LinksFunction = () => [...CHECK_FONT_LINKS, { rel: "stylesheet", href: styles }];

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

  // A check that failed before reading the page has no product to show: the message takes its place.
  if (!view.product && !running) {
    return <CheckShell hero={<CheckFailed view={view} url={url} asTitle />} />;
  }
  return (
    <CheckShell hero={<ProductCard product={view.product} country={view.country} />}>
      {view.status === "done" ? <CheckReport view={view} /> : view.status === "failed" ? <CheckFailed view={view} url={url} /> : <CheckRunning view={view} />}
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
