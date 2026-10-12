import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { RETENTION } from "../lib/retention.server";
import { senderIdentity } from "../lib/email.server";
import { publicHostRedirect } from "../lib/tools/host.server";
import { pageMeta } from "../lib/tools/seo";
import { PRIVACY_UPDATED } from "../lib/tools/site";
import { formatUpdated } from "../lib/tools/format";
import { SiteFooter } from "../components/site-footer";

// Public privacy policy (also used for the Shopify App Store listing and the data protection form).
// After a real change, update PRIVACY_UPDATED in app/lib/tools/site.ts (shown below and in the sitemap).

export const meta: MetaFunction = () =>
  pageMeta({
    path: "/privacy",
    title: "GEO privacy policy",
    description: "What data GEO collects and why, how long we keep it, and who helps us run GEO, its free product check and its free tools.",
    image: "/og/home.png",
    imageAlt: "A small clay shop with a star in a speech bubble above it",
  });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // One public address: www.usegeo.app and the Railway address send visitors to https://usegeo.app.
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  return privacyData();
};

const privacyData = () => ({
  contact: process.env.SUPPORT_EMAIL ?? null,
  // Who runs GEO (GEO_LEGAL_NAME, GEO_ABN, GEO_POSTAL_ADDRESS): the same words as every email's footer.
  owner: (({ legalName, abn, postal }) => (legalName ? { legalName, abn, postal } : null))(senderIdentity()),
  inactiveYears: Math.round(RETENTION.inactiveSubscriberMonths / 12),
  visitIdDays: RETENTION.visitIdDays,
  uninstalledDays: RETENTION.uninstalledDays,
  publicCheckDays: RETENTION.publicCheckDays,
  checkIpHours: RETENTION.checkIpHours,
  reportEmailDays: RETENTION.reportEmailDays,
  unsubscribedDays: RETENTION.unsubscribedDays,
  waitlistMonths: RETENTION.waitlistMonths,
});

const page = { maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px", fontFamily: "Inter, system-ui, sans-serif", color: "#30313d", lineHeight: 1.7 };
const h2 = { fontSize: 20, margin: "36px 0 8px", color: "#0b0c2b" };

export default function Privacy() {
  return (
    <>
      <PrivacyText />
      {/* The same footer as the free tools and the check pages: every free tool, the hub and the main site. */}
      <SiteFooter />
    </>
  );
}

function PrivacyText() {
  const { contact, owner, inactiveYears, visitIdDays, uninstalledDays, publicCheckDays, checkIpHours, reportEmailDays, unsubscribedDays, waitlistMonths } =
    useLoaderData<typeof loader>();
  return (
    <main style={page}>
      <h1 style={{ fontSize: 34, color: "#0b0c2b", marginBottom: 4 }}>GEO privacy policy</h1>
      <p style={{ color: "#707075", marginTop: 0 }}>Last updated {formatUpdated(PRIVACY_UPDATED)}</p>

      <p>
        GEO is a Shopify app that shows store owners how AI assistants (like ChatGPT, Gemini and Perplexity) recommend
        their store, suggests fixes, and shows which sales came from AI. This page explains what data we use, why, and
        how we look after it.
      </p>
      {owner ? (
        <p>
          GEO is run by {owner.legalName}
          {owner.abn ? ` (ABN ${owner.abn})` : ""}
          {owner.postal ? `, ${owner.postal}` : ""}.
        </p>
      ) : null}

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
        <b>We never collect your customers&apos; names, email addresses, phone numbers or addresses.</b> We do not sell any data, and we
        never use one store&apos;s data for another store.
      </p>

      <h2 style={h2}>Free product check</h2>
      <p>
        Anyone can check a product on our website without installing GEO. To run the check we send the text of that
        public product page to Claude (Anthropic) and the questions to ChatGPT, Gemini and Perplexity through our data
        provider. We keep the product link, what we read from the page and the AI answers, and delete them after{" "}
        {publicCheckDays} days. We also keep a scrambled (hashed) version of your IP address so we can limit how many
        free checks one person runs, and delete it after {checkIpHours === 24 ? "a day" : `${checkIpHours} hours`}.
      </p>
      <p>
        Each report has its own link that isn&apos;t listed anywhere, but anyone you share the link with can see the
        report.
      </p>
      <p>
        <b>If you ask for the full report by email:</b> we keep your email address, the words you agreed to and when,
        and which report you asked for, so we can email you that report (a PDF) once. If you also tick the box for tips
        and then confirm from that email, we send occasional tips on getting recommended by AI. We never put you on the
        tips list without both. Every email has an unsubscribe link, and you can also reply to any email to stop them.
      </p>
      <p>
        We delete your address, and our record of the reports we emailed you, {unsubscribedDays} days after you
        unsubscribe (counted from your last request), or {inactiveYears} years after you last asked for a report or
        clicked a link in our emails. After that we keep only a scrambled code (a hash) of an address that unsubscribed,
        so we never email it tips again by mistake. We also keep a record of each report we emailed, with a scrambled
        (hashed) IP address for a day, to limit how many reports one person can ask for, and delete that record after{" "}
        {reportEmailDays} days.
      </p>
      <p>
        Your browser keeps a small cookie (geo_check_leads) for 30 days, only on the check pages, so the report page can
        show where your report went. It holds the address you typed, signed so it can&apos;t be changed, and only your
        browser sends it.
      </p>
      <p>
        We never sell your email address. We share it only with Resend, which sends our emails for us. We don&apos;t
        upload it to Facebook, Google or any other advertising service.
      </p>

      <h2 style={h2}>Free tools</h2>
      <p>
        Our free tools at <a href="/tools">usegeo.app/tools</a> work without an account.
      </p>
      <ul>
        <li>
          Tools that run in your browser (the FAQ Schema Generator, the AI Bot Checker with pasted text, and pasted
          robots.txt, llms.txt or product data) don&apos;t send what you type to us. If JavaScript is off in your
          browser, the form is sent to our server once to build the result, and we don&apos;t keep it.
        </li>
        <li>
          When you enter a web address, our server fetches public files from that site (such as robots.txt, llms.txt or
          a product page) to check them. We don&apos;t keep the files.
        </li>
        <li>
          The AI Overview Checker sends your search phrase to our data provider, Treg, which passes it to a Google
          results service (Crawl4AI, or AnyAPI as a backup). We keep the result in memory for up to 24 hours so a repeat
          search is fast. If you add your website, we only use it to compare with the results.
        </li>
        <li>
          To stop abuse we count requests using a scrambled (hashed) version of your IP address, held in memory and
          cleared within a day. We record what each search cost us, without your IP address or your search.
        </li>
      </ul>
      <p>The AI Visibility Checker is our free product check, described above.</p>

      <h2 style={h2}>Waitlist</h2>
      <p>
        If you join the waitlist on our home page, we keep your name, your email address, the words shown with the form
        and when you joined. We also keep which button you used and, if you came from an ad or another website, the
        ad&apos;s tracking tags in the page address (such as utm_campaign or Facebook&apos;s click id) and the name of
        that website. To stop abuse we keep a scrambled (hashed) version of your IP address for a day.
      </p>
      <p>
        We use this only to contact you about GEO. We delete it {waitlistMonths} months after you joined, or sooner if
        you ask.
      </p>

      <h2 style={h2}>Why we use it</h2>
      <p>
        <b>Your store&apos;s data:</b> only to run GEO for you: to check AI answers about your products, write suggested
        fixes for you to approve, and show the clicks, orders and revenue that came from AI. We don&apos;t use it for
        advertising or anything else.
      </p>
      <p>
        <b>Free product check:</b> to run the check, to email you the report you asked for, and to send occasional tips
        if you ticked the box and confirmed. We don&apos;t use your email address for anything else, and never for
        advertising.
      </p>
      <p>
        <b>Waitlist:</b> only to contact you about GEO.
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
        <li>
          Resend: sends your monthly email report, and free check reports (and tips, for people who asked for them). It
          gets the email address and the email.
        </li>
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
      <p>
        If you asked for a free check report by email, you can ask us for the email address we hold about you, or ask us
        to delete it, the same way or by replying to any of our emails. If you joined the waitlist, you can ask us for
        your details or ask us to delete them the same way.
      </p>
    </main>
  );
}
