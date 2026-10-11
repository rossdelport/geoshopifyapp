import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, data, useActionData, useLoaderData } from "react-router";
import { findUnsubscribe, unsubscribe } from "../lib/check-lead.server";
import { readSmallForm } from "../lib/public-form.server";
import { EMAIL_PAGE_FONTS, EmailPage, emailPage } from "../components/email-page";

// Unsubscribe from the free check emails (the link in every report email). No login.
// GET shows a small confirm page; POST unsubscribes. Mail apps' one-click unsubscribe
// (List-Unsubscribe-Post) POSTs "List-Unsubscribe=One-Click" to the same link, token in the URL.

export const meta: MetaFunction = () => [{ title: "Unsubscribe · GEO" }, { name: "robots", content: "noindex" }];

export const links: LinksFunction = () => EMAIL_PAGE_FONTS;

const tokenOf = (url: string) => (new URL(url).searchParams.get("t") ?? "").trim();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const token = tokenOf(request.url);
  const found = token ? await findUnsubscribe(token) : null;
  return { token: found ? token : "", maskedEmail: found?.maskedEmail ?? null, already: found?.unsubscribed ?? false };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await readSmallForm(request, 2_048);
  const token = tokenOf(request.url) || String(form?.get("t") ?? "").trim();
  const ok = token ? await unsubscribe(token).catch(() => false) : false;
  // A mail app's one-click only looks at the status; people get the page below.
  return data({ done: ok }, { status: ok ? 200 : 404, headers: { "Cache-Control": "no-store" } });
};

const s = emailPage;

export default function Unsubscribe() {
  const { token, maskedEmail, already } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const done = Boolean(result?.done) || already;

  let body;
  if (done) {
    body = (
      <>
        <h1 style={s.h1}>You’re unsubscribed</h1>
        <p style={s.p}>
          We won’t send {maskedEmail ? <b>{maskedEmail}</b> : "you"} any more emails about the free product check or tips. If you ask
          for another report later, we’ll send just that report.
        </p>
        <a href="/" style={s.link}>
          Back to GEO
        </a>
      </>
    );
  } else if (!token || result?.done === false) {
    body = (
      <>
        <h1 style={s.h1}>This link doesn’t work</h1>
        <p style={s.p}>It may be old or cut short. Use the unsubscribe link in your latest email from GEO, or reply to that email and we’ll take you off the list.</p>
        <a href="/" style={s.link}>
          Back to GEO
        </a>
      </>
    );
  } else {
    body = (
      <>
        <h1 style={s.h1}>Unsubscribe from GEO emails?</h1>
        <p style={s.p}>
          We’ll stop sending {maskedEmail ? <b>{maskedEmail}</b> : "you"} reports and tips about getting recommended by AI.
        </p>
        <Form method="post">
          <input type="hidden" name="t" value={token} />
          <button type="submit" style={s.button}>
            Unsubscribe
          </button>
        </Form>
      </>
    );
  }

  return <EmailPage>{body}</EmailPage>;
}
