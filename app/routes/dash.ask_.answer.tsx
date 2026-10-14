import type { ActionFunctionArgs } from "react-router";
import { requireWebShop } from "../lib/web-auth.server";
import { ASK_ERRORS, answer, cleanHistory } from "../lib/ask.server";
import { fromAnotherSite } from "../lib/public-form.server";

// POST /dash/ask/answer: one Ask GEO answer, as JSON, for the chat page. Nothing is saved.
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST" || fromAnotherSite(request)) return Response.json({ ok: false, error: ASK_ERRORS.failed }, { status: 400 });
  const { user, shop } = await requireWebShop(request);
  const body = await request.json().catch(() => null);
  const history = cleanHistory((body as { messages?: unknown } | null)?.messages);
  if (!history) return Response.json({ ok: false, error: ASK_ERRORS.empty });
  return Response.json(await answer(shop, user, history));
};
