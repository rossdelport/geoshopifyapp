import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireClient } from "../lib/clients.server";
import { clientPlan, setTick } from "../lib/client-plan.server";
import { fromAnotherSite } from "../lib/public-form.server";
import { PageHead } from "../components/web";
import { ClientPlanView, usePlanRefresh } from "../components/client-plan";
import styles from "../styles/client-plan.css?url";

// One client's checklist and work in the agency hub (Ross, 17 Nov 2026): the first 24 hours, then the crucial next
// steps, with what runs for them today, next and later, and why. The hub's pop-up (a brand card on /dash) loads this
// page's data and ticks lines here too; this page is the same thing on its own, from the client's menu.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, client } = await requireClient(request);
  return clientPlan(shop, client);
};

/** Tick a line, or untick it. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { user, shop } = await requireClient(request);
  if (fromAnotherSite(request)) return { ok: false as const, error: "Please use the buttons on Rank with Ross." };
  const form = await request.formData();
  if (String(form.get("intent")) !== "tick") return { ok: false as const, error: "Unknown action." };
  const saved = await setTick(shop, form.get("key"), form.get("done") === "1", user.email);
  return saved ? { ok: true as const } : { ok: false as const, error: "That line ticks itself when it’s done." };
};

export default function ClientChecklist() {
  const plan = useLoaderData<typeof loader>();
  usePlanRefresh(plan.busy);
  return (
    <>
      <PageHead title="Checklist" intro="What’s set up for them and what isn’t, then what runs for them today, next and later." />
      <ClientPlanView plan={plan} />
    </>
  );
}
