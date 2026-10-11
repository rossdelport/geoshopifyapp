import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, data, useActionData, useLoaderData } from "react-router";
import { confirmTips, findTips } from "../lib/check-lead.server";
import { readSmallForm } from "../lib/public-form.server";
import { EMAIL_PAGE_FONTS, EmailPage, emailPage as s } from "../components/email-page";

// "Yes, keep sending me tips": the link in a report email for people who ticked the tips box. No login.
// GET only shows a confirm page (a mail scanner opening the link changes nothing); POST confirms. Asking
// for a report never puts anyone on the tips list by itself: the box and this click both have to happen.

export const meta: MetaFunction = () => [{ title: "Tips from GEO" }, { name: "robots", content: "noindex" }];

export const links: LinksFunction = () => EMAIL_PAGE_FONTS;

const tokenOf = (url: string) => (new URL(url).searchParams.get("t") ?? "").trim();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const token = tokenOf(request.url);
  const found = token ? await findTips(token) : null;
  return { token: found ? token : "", maskedEmail: found?.maskedEmail ?? null, state: found?.state ?? null };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await readSmallForm(request, 2_048);
  const token = tokenOf(request.url) || String(form?.get("t") ?? "").trim();
  const state = token ? await confirmTips(token).catch(() => null) : null;
  return data({ state }, { status: state ? 200 : 404, headers: { "Cache-Control": "no-store" } });
};

export default function Tips() {
  const loaded = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const state = result ? result.state : loaded.state;
  const who = loaded.maskedEmail ? <b>{loaded.maskedEmail}</b> : "you";

  let body;
  if (!loaded.token || !state) {
    body = (
      <>
        <h1 style={s.h1}>This link doesn’t work</h1>
        <p style={s.p}>It may be old or cut short. Use the link in your latest email from GEO, or reply to that email.</p>
        <a href="/" style={s.link}>
          Back to GEO
        </a>
      </>
    );
  } else if (state === "on") {
    body = (
      <>
        <h1 style={s.h1}>You’re on the list</h1>
        <p style={s.p}>We’ll send {who} occasional tips on getting recommended by AI. Every email has an unsubscribe link.</p>
        <a href="/" style={s.link}>
          Back to GEO
        </a>
      </>
    );
  } else if (state === "off") {
    body = (
      <>
        <h1 style={s.h1}>No tips for now</h1>
        <p style={s.p}>
          You didn’t tick the box for tips, or you unsubscribed since, so we won’t send {who} any. To get them, tick the box
          next time you ask for a report.
        </p>
        <a href="/" style={s.link}>
          Back to GEO
        </a>
      </>
    );
  } else {
    body = (
      <>
        <h1 style={s.h1}>Keep sending you tips?</h1>
        <p style={s.p}>You asked for occasional tips on getting recommended by AI. Confirm and we’ll send them to {who}.</p>
        <Form method="post">
          <input type="hidden" name="t" value={loaded.token} />
          <button type="submit" style={s.button}>
            Yes, keep sending me tips
          </button>
        </Form>
      </>
    );
  }
  return <EmailPage>{body}</EmailPage>;
}
