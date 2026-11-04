import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { senderIdentity } from "../lib/email.server";
import { publicHostRedirect } from "../lib/tools/host.server";
import { pageMeta } from "../lib/tools/seo";
import { TERMS_UPDATED } from "../lib/tools/site";
import { formatUpdated } from "../lib/tools/format";
import { OFFER } from "../lib/plans";
import { SiteFooter } from "../components/site-footer";

// Public terms of service (Ross, 3 Nov 2026: "exactly the same layout as the privacy page"). Same styles, footer and
// host redirect as routes/privacy.tsx. After a real change, update TERMS_UPDATED in app/lib/tools/site.ts (shown
// below and in the sitemap). The promises here must match the home page: the price (OFFER), the full refund after
// month 1 with the work kept, no lock-in contract, no promised results.

export const meta: MetaFunction = () =>
  pageMeta({
    path: "/terms",
    title: "FirstPicked terms of service",
    description: "The rules for using FirstPicked: our Done for you plan, the refund after month one, stopping any time, and our free tools.",
    image: "/og/home.png",
    imageAlt: "A small clay shop with a star in a speech bubble above it",
  });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // One public address: www, the old usegeo.app and the Railway address send visitors to https://firstpicked.com.au.
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  return {
    contact: process.env.SUPPORT_EMAIL ?? null,
    // Who runs FirstPicked (GEO_LEGAL_NAME, GEO_ABN, GEO_POSTAL_ADDRESS): the same words as the privacy page and every email.
    owner: (({ legalName, abn, postal }) => (legalName ? { legalName, abn, postal } : null))(senderIdentity()),
  };
};

const page = { maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px", fontFamily: "Inter, system-ui, sans-serif", color: "#30313d", lineHeight: 1.7 };
const h2 = { fontSize: 20, margin: "36px 0 8px", color: "#0b0c2b" };

export default function Terms() {
  return (
    <>
      <TermsText />
      <SiteFooter />
    </>
  );
}

function TermsText() {
  const { contact, owner } = useLoaderData<typeof loader>();
  return (
    <main style={page}>
      <h1 style={{ fontSize: 34, color: "#0b0c2b", marginBottom: 4 }}>FirstPicked terms of service</h1>
      <p style={{ color: "#707075", marginTop: 0 }}>Last updated {formatUpdated(TERMS_UPDATED)}</p>

      <p>
        These terms are the rules for using FirstPicked. That means our website, our free tools and our {OFFER.name} plan. By
        using FirstPicked, you agree to them. If you don&apos;t agree, please don&apos;t use FirstPicked.
      </p>
      {owner ? (
        <p>
          FirstPicked is run by {owner.legalName}
          {owner.abn ? ` (ABN ${owner.abn})` : ""}
          {owner.postal ? `, ${owner.postal}` : ""}.
        </p>
      ) : null}

      <h2 style={h2}>What FirstPicked does</h2>
      <p>
        FirstPicked helps your store get picked by AI apps like ChatGPT, Gemini and Perplexity. On our {OFFER.name} plan, our
        team does the work for you. We check which products AI picks, write buying guides, fix your product pages and
        email the sites AI trusts. We also show you the sales that came from AI.
      </p>

      <h2 style={h2}>Our {OFFER.name} plan</h2>
      <ul>
        <li>It costs {OFFER.price}, including GST.</li>
        <li>You pay each month, before that month&apos;s work starts. We&apos;ll tell you how to pay when you join.</li>
        <li>
          Onboarding is the only part you do. You tell us about your store and add one small code to Shopify. We help
          you with it.
        </li>
        <li>At the start, we agree with you on what we can change in your store. We only change those things.</li>
        <li>We only take a few stores at a time. We may say no if we don&apos;t think we can help your store.</li>
      </ul>

      <h2 style={h2}>Full refund after month one</h2>
      <p>
        If you&apos;re not happy after your first month, tell us within 14 days after it ends. We&apos;ll refund that
        month in full, and you keep all the work we did. The refund is for your first month only.
      </p>

      <h2 style={h2}>No lock-in contract</h2>
      <p>
        You can stop any time. Tell us before your next month starts, and we won&apos;t charge you again. Your plan runs
        to the end of the month you paid for. After your first month, we don&apos;t refund part of a month. You keep all
        the work we did for you.
      </p>
      <p>
        We can stop working with you too. If we do, we&apos;ll tell you at least 14 days before, and we&apos;ll refund
        any days you paid for but didn&apos;t get. If you break these terms, we can stop straight away.
      </p>

      <h2 style={h2}>Results</h2>
      <p>
        Every store is different, so we can&apos;t promise exact results. AI apps decide what they show, and they change
        often. We don&apos;t control ChatGPT, Gemini, Perplexity, Google or any other AI app. We always show you the
        real numbers.
      </p>
      <p>
        We only count sales we can link to AI. Some AI apps hide where a shopper came from, so the real number is often
        a bit higher. We can&apos;t tell Google AI Overviews apart from normal Google, so we count them as search.
      </p>

      <h2 style={h2}>Your part</h2>
      <ul>
        <li>Give us true facts about your store and products. We write from them, and we never make up facts.</li>
        <li>Only use FirstPicked for a store you own, or one you&apos;re allowed to run.</li>
        <li>If something we wrote is wrong, tell us and we&apos;ll fix it.</li>
        <li>You&apos;re in charge of your store, your products and your prices.</li>
      </ul>

      <h2 style={h2}>Our rules for the work</h2>
      <ul>
        <li>We never write fake reviews.</li>
        <li>We never pretend to be a customer, on Reddit or anywhere else.</li>
        <li>We never buy links or swap links.</li>
        <li>We don&apos;t make health or medical claims about your products.</li>
        <li>We check what we write against your real facts.</li>
      </ul>

      <h2 style={h2}>Who owns what</h2>
      <p>
        The work we make for you is yours. That means the buying guides, product page text and emails. You keep it,
        even after you stop. FirstPicked itself is ours. That means our website, our app, our tools and our code.
      </p>
      <p>You let us use your store&apos;s pages and the facts you give us, but only to do the work for you.</p>

      <h2 style={h2}>Free tools, the free check and calls</h2>
      <p>
        Our free tools, the free product check and a call with Ross are free. Please don&apos;t use them in a way that
        harms our website, like sending lots of automatic requests. Their results are a guide, not a promise, because
        AI answers change from day to day. We can change or stop a free tool at any time.
      </p>
      <p>
        Our giveaway has its own rules, on the <a href="/giveaway#rules">giveaway page</a>.
      </p>

      <h2 style={h2}>Other companies&apos; services</h2>
      <p>
        FirstPicked works with other companies&apos; services, like Shopify and the AI apps. Their own terms apply to them, and
        we can&apos;t control what they do.
      </p>

      <h2 style={h2}>If something goes wrong</h2>
      <p>
        Nothing in these terms takes away your rights under the Australian Consumer Law. Apart from those rights, and as
        far as the law allows:
      </p>
      <ul>
        <li>We&apos;re not responsible for lost sales, lost profits or other losses that come later.</li>
        <li>The most we owe you for any problem is what you paid us in the 3 months before it happened.</li>
      </ul>

      <h2 style={h2}>Your privacy</h2>
      <p>
        Our <a href="/privacy">privacy policy</a> explains what data we collect, why, and how long we keep it.
      </p>

      <h2 style={h2}>Changes to these terms</h2>
      <p>
        We may update these terms. When we do, we change the date at the top. If you&apos;re on our {OFFER.name} plan,
        we&apos;ll email you at least 14 days before a change that affects you.
      </p>

      <h2 style={h2}>The law</h2>
      <p>These terms follow the law of Western Australia, Australia.</p>

      <h2 style={h2}>Contact</h2>
      <p>
        Questions about these terms?
        {contact ? (
          <>
            {" "}
            Email <a href={`mailto:${contact}`}>{contact}</a>, or text
          </>
        ) : (
          <> Text</>
        )}{" "}
        Ross, the founder, on <a href="sms:+61400369865">0400 369 865</a>.
      </p>
    </main>
  );
}
