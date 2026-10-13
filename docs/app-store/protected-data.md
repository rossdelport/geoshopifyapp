# Protected customer data request (draft answers)

Where: Partner Dashboard > Apps > the app > **API access requests** > Protected customer data access > Request
access. Pick the distribution method (Public) first, or the request can't be made. Do this **before** submitting:
until the "Data protection details" are saved, the app can't read the customer journey even on a development store,
so the AI orders test in `reviewer.md` won't work.

## 1. What to request

- **Protected customer data: yes.**
- **Protected customer fields (Name, Email, Phone, Address): none.** The app never asks for them.
- So this is **level 1**. Level 2 (name, email, phone, address) is not needed.

## 2. Reason (paste into the request)

> We show merchants which orders and revenue came from AI assistants such as ChatGPT, Perplexity and Gemini. For each
> order we read its total, currency, line item titles and quantities, sales channel and the customer journey's first
> and last visit (referrer, landing page and UTM source) to decide whether the shopper came from an AI assistant. We
> store only orders that came from AI (order number, total, product titles, which assistant and why), plus daily
> order totals for context. We never request or store customer names, emails, phone numbers or addresses.

## 3. Exactly what the code reads (checked in `app/lib`)

| Source | Fields | Why | What we keep |
|---|---|---|---|
| Orders query, `app/lib/orders.server.ts` (60-day backfill at install, then each new order) | `id`, `name` (the order number like #1001, not a person), `createdAt`, `sourceName`, `totalPriceSet.shopMoney`, `channelInformation` (channel handle and name, app title), `lineItems(first: 10) { title quantity }` | Total and products for the AI revenue figures; channel to spot orders placed through an AI sales channel | AI orders only: order id and number, total, currency, product titles and quantities, assistant, a one-line reason, date. Other orders: only a daily count and revenue sum. |
| Same query: `customerJourneySummary.firstVisit` / `lastVisit` | `landingPage`, `referrerUrl`, `source`, `sourceType`, `utmParameters { source medium campaign }` | The referrer or `utm_source` is how we tell a visit came from chatgpt.com, perplexity.ai and so on | Not stored. Only the reason line (for example "Arrived from chatgpt.com") |
| `orders/create` webhook | The payload is ignored except `admin_graphql_api_id` | Queues a check of the new order 3 minutes later | The order id in the job queue |
| Web pixel (`extensions/ai-pixel`), `page_viewed`, first page of each browser session | `document.referrer`, page address, Shopify's anonymous `clientId` | Counts visits and spots the ones from AI assistants | All visits: a daily count only. AI visits: assistant, referrer, page path with its utm tags only (other query values dropped), and a SHA-256 hash of shop + clientId for de-duplication |
| Shop query (`app/lib/install.server.ts`) | Shop name, email, currency, domains, country, dev store flag | Running the app, monthly report recipient | Store details (merchant data, not customer data) |

The app uses offline access tokens only, so no staff names or emails are saved with sessions. It has no
`read_customers` scope and never queries the `Customer` object.

## 4. Answers to the level 1 requirements

| Requirement | Answer |
|---|---|
| Process only the minimum personal data | Yes. No customer fields at all. Ten line items per order. Landing pages cut to path + utm tags. Visit ids hashed. Non-AI orders kept only as daily totals. |
| Tell merchants what you process and why | Yes. https://usegeo.app/privacy ("What we collect", "Why we use it"), and in the app: Settings > "How we keep this honest" says no customer names, emails or addresses are stored. |
| Limit processing to the stated purposes | Yes. Order and visit data is used only for the store's own AI sales figures and monthly report. Never for ads, never sold, never used for another store. |
| Respect customer consent | Yes. The pixel declares `analytics = true`, `marketing = false`, `preferences = false` in `customer_privacy`, so Shopify only runs it when the shopper allows analytics. No consent, no data. |
| Respect opt-outs of data sale or sharing | Yes. `sale_of_data = "disabled"`: we don't sell or share it. |
| Automated decisions with legal or significant effects | None. |
| Privacy and data protection agreements with merchants | The privacy policy at https://usegeo.app/privacy. (If you want a separate data processing agreement, that is still to write.) |
| Retention periods | Yes, see section 5. |
| Encrypt at rest and in transit | Yes. Supabase Postgres (Tokyo) is encrypted at rest. The app forces TLS on every database connection (`sslmode=require` is added in `app/db.server.ts`), and the app, webhooks and pixel endpoint are served over HTTPS (Railway, Singapore). |

## 5. Retention (from `app/lib/retention.server.ts`, run hourly, and the privacy page)

- Hashed visit id: removed after **90 days**.
- AI orders, daily order and visit totals: kept while the app is installed (needed for "before you joined" and
  "since you joined").
- After uninstall: `shop/redact` (Shopify sends it about 48 hours later) deletes the store and everything linked to
  it. Safety net: any uninstalled store is deleted after **30 days** anyway.
- `customers/redact`: deletes that customer's orders (`orders_to_redact`) from our AI order list.

## 6. Compliance webhooks (`app/routes/webhooks.compliance.tsx`, set in `shopify.app.toml`)

- `customers/data_request`: logged. We hold no customer names or contact details, so there is nothing personal to send.
- `customers/redact`: deletes the listed orders from the AI order list.
- `shop/redact`: deletes the store's sessions and its row; every other table is deleted with it (cascade).

## 7. Who can see it, and what other services get

- The database login `geo_app` can only reach the `geo` schema of the Supabase project. The app's code always
  filters by store, so one store never sees another's data.
- People: the owner, through the Supabase and Railway dashboards. Done-for-you staff work on outreach, which uses
  store and product details, not customer data.
- Treg gets buyer questions only. Anthropic (Claude) gets product details and AI answers only. Resend gets the
  merchant's report address and a report with totals. None of them get order or customer data.

## 8. Check before you submit

- Confirm who else is an admin on the Supabase project (OneInbox) and the Railway project (Paperflower). Admins of those
  projects can see the `geo` schema. Keep the list short and turn on two-factor sign-in.
- `customers/data_request` sends nothing back. That's defensible (no personal data), but Shopify may ask. If they do,
  answer with the AI order rows for the listed orders (order number, total, products, source).
