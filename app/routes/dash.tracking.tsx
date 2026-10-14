import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireWebShop } from "../lib/web-auth.server";
import { trackKeyFor, trackingCode } from "../lib/tracking-code.server";
import { PageHead } from "../components/web";

// usegeo.app/dash/tracking: the store's tracking code and how to paste it into Shopify (Settings -> Customer
// events -> Add custom pixel). Once it sends its first visit, the dashboard shows AI clicks, orders and revenue.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const code = trackingCode(await trackKeyFor(shop.id));
  const store = (shop.domain || "").replace(/\.myshopify\.com$/, "");
  return { code, working: Boolean(shop.pixelId), adminUrl: `https://admin.shopify.com/store/${store}/settings/customer_events` };
};

export default function Tracking() {
  const { code, working, adminUrl } = useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      (document.getElementById("geo-code") as HTMLTextAreaElement | null)?.select();
    }
  };
  return (
    <>
      <PageHead
        title="Tracking code"
        intro="See the clicks, orders and money that come from ChatGPT and the other AI assistants."
        right={<span className={`w-chip ${working ? "ok" : "warn"}`}>{working ? "Working" : "Not added yet"}</span>}
      />

      <section className="w-panel">
        <h2>Add it to Shopify in 2 minutes</h2>
        <ol style={{ paddingLeft: 20, display: "grid", gap: 8 }}>
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
          <button className="w-btn w-btn-sm" type="button" onClick={copy}>
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
        <textarea
          id="geo-code"
          className="w-input"
          readOnly
          value={code}
          rows={12}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, padding: 12, lineHeight: 1.5 }}
          aria-label="Your GEO tracking code"
        />
      </section>
    </>
  );
}
