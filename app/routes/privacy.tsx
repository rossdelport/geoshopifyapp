import type { MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { RETENTION } from "../lib/retention.server";

// Public privacy policy (also used for the Shopify App Store listing and the data protection form).

export const meta: MetaFunction = () => [{ title: "GEO privacy policy" }];

export const loader = async () => ({
  contact: process.env.SUPPORT_EMAIL ?? null,
  visitIdDays: RETENTION.visitIdDays,
  uninstalledDays: RETENTION.uninstalledDays,
});

const page = { maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px", fontFamily: "Inter, system-ui, sans-serif", color: "#30313d", lineHeight: 1.7 };
const h2 = { fontSize: 20, margin: "36px 0 8px", color: "#0b0c2b" };

export default function Privacy() {
  const { contact, visitIdDays, uninstalledDays } = useLoaderData<typeof loader>();
  return (
    <main style={page}>
      <h1 style={{ fontSize: 34, color: "#0b0c2b", marginBottom: 4 }}>GEO privacy policy</h1>
      <p style={{ color: "#707075", marginTop: 0 }}>Last updated 10 October 2026</p>

      <p>
        GEO is a Shopify app that shows store owners how AI assistants (like ChatGPT, Gemini and Perplexity) recommend
        their store, suggests fixes, and shows which sales came from AI. This page explains what data we use, why, and
        how we look after it.
      </p>

      <h2 style={h2}>What we collect</h2>
      <ul>
        <li>
          <b>Your store details:</b> shop name, domain, plan, and your products (titles, descriptions, types, tags, prices,
          images) so we can write questions and fixes.
        </li>
        <li>
          <b>Orders that came from AI:</b> the order number, total, currency, product titles and quantities, and the visit
          source (referrer, landing page and utm tags) that shows it came from an AI assistant. We also keep daily order
          and visit totals so we can show AI as a share of your sales.
        </li>
        <li>
          <b>Visits from AI:</b> when a shopper agrees to analytics cookies, our web pixel records visits that arrive from an
          AI assistant: the referrer, the page path with its utm tags, and a hashed browser id used only to avoid counting
          the same visit twice.
        </li>
      </ul>
      <p>
        <b>We never collect customer names, email addresses, phone numbers or addresses.</b> We do not sell any data, and we
        never use one store&apos;s data for another store.
      </p>

      <h2 style={h2}>Why we use it</h2>
      <p>
        Only to run GEO for you: to check AI answers about your products, write suggested fixes for you to approve, and
        show the clicks, orders and revenue that came from AI. We don&apos;t use the data for advertising or anything else.
      </p>

      <h2 style={h2}>Shoppers&apos; choices</h2>
      <p>
        Our web pixel only runs when the shopper allows analytics in your store&apos;s cookie banner (Shopify&apos;s
        customer privacy settings). If they say no, we record nothing about their visit.
      </p>

      <h2 style={h2}>How long we keep it</h2>
      <ul>
        <li>We remove the hashed browser id from visit records after {visitIdDays} days.</li>
        <li>Everything else is kept while GEO is installed, so you can compare against your starting point.</li>
        <li>
          When you uninstall, Shopify tells us to delete your store&apos;s data (usually 48 hours later) and we do. As a
          backup we delete it ourselves {uninstalledDays} days after uninstall.
        </li>
        <li>If a shopper asks your store to delete their data, we delete any of their orders from our records.</li>
      </ul>

      <h2 style={h2}>How we protect it</h2>
      <p>
        All data is encrypted in transit (HTTPS and encrypted database connections) and at rest. Each store&apos;s data is
        kept separate, and only the GEO app can read it.
      </p>

      <h2 style={h2}>Services we use</h2>
      <ul>
        <li>Railway (Singapore): runs the app.</li>
        <li>Supabase (Tokyo): stores the data.</li>
        <li>Treg: fetches public AI answers to buyer questions. It gets the questions only, never customer data.</li>
        <li>Anthropic (Claude): reads AI answers and drafts fixes from your product details. It never gets customer data.</li>
        <li>Resend: sends your monthly email report.</li>
      </ul>

      <h2 style={h2}>Your rights and contact</h2>
      <p>
        You can ask us what we hold about your store, or ask us to delete it, at any time
        {contact ? (
          <>
            {" "}
            by emailing <a href={`mailto:${contact}`}>{contact}</a>.
          </>
        ) : (
          <> using the contact details on GEO&apos;s Shopify App Store listing. Uninstalling GEO also deletes everything.</>
        )}
      </p>
    </main>
  );
}
