import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireWebShop } from "../lib/web-auth.server";
import { trackKeyFor, trackingCode } from "../lib/tracking-code.server";
import { CopyButton, PageHead } from "../components/web";

// usegeo.app/dash/tracking: the store's tracking code and how to paste it into Shopify (Settings -> Customer
// events -> Add custom pixel). Once it sends its first visit, the dashboard shows AI clicks, orders and revenue.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const code = trackingCode(shop.trackKey ?? (await trackKeyFor(shop.id)));
  const store = (shop.domain || "").replace(/\.myshopify\.com$/, "");
  return { code, working: Boolean(shop.pixelId), adminUrl: `https://admin.shopify.com/store/${store}/settings/customer_events` };
};

export default function Tracking() {
  const { code, working, adminUrl } = useLoaderData<typeof loader>();
  const selectCode = () => (document.getElementById("geo-code") as HTMLTextAreaElement | null)?.select();
  return (
    <>
      <PageHead
        title="Tracking code"
        intro="See the clicks, orders and money that come from ChatGPT and the other AI assistants."
        right={<span className={`w-chip ${working ? "ok" : "warn"}`}>{working ? "Working" : "Not added yet"}</span>}
      />

      <section className="w-panel">
        <h2>Add it to Shopify in 2 minutes</h2>
        <ol className="w-ol">
          <li>
            In Shopify, open{" "}
            <a href={adminUrl} target="_blank" rel="noreferrer">
              Settings → Customer events
            </a>
            .
          </li>
          <li>
            Click <b>Add custom pixel</b> and name it <b>GEO</b>.
          </li>
          <li>Delete the example code Shopify shows, then paste the code below.</li>
          <li>
            Click <b>Save</b>, then <b>Connect</b>.
          </li>
        </ol>
        <p className="w-note">
          It counts visits that came from AI, and orders with their total and products. It never sends names, emails or addresses,
          and it follows your store’s cookie settings.
        </p>
      </section>

      <section className="w-panel">
        <div className="w-row">
          <h2>Your code</h2>
          <CopyButton text={code} label="Copy code" className="w-btn w-btn-sm" onFail={selectCode} />
        </div>
        <textarea
          id="geo-code"
          className="w-input w-code"
          readOnly
          value={code}
          rows={12}
          aria-label="Your GEO tracking code"
        />
      </section>
    </>
  );
}
