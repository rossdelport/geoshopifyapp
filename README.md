# GEO — get recommended by AI shopping assistants

A Shopify app that checks whether ChatGPT, Gemini, Perplexity, Google AI Overviews and Claude
recommend a store, shows who they recommend instead, writes fixes the merchant approves in one
click, finds articles worth pitching, and shows the money AI brings in.

The full product plan is in [`CLAUDE.md`](./CLAUDE.md).

## How it fits together

```
Shopify admin (embedded app, Polaris)          Storefront
        │                                          │  Web Pixel: one event per visit
        ▼                                          ▼
React Router app  ──────────────────────────  /api/pixel
  routes/app.*.tsx      screens                   │
  routes/webhooks.*     orders, billing, privacy  │
        │                                          │
        ▼                                          ▼
Postgres (Supabase, "geo" schema only)  ◄──  background worker (same process)
                                               jobs: onboard, scan.run, orders.*,
                                               fixes.*, outreach.find, report.monthly
                                                    │
                                   Treg (AI answers, keyword volume, emails)
                                   Claude (reading answers, writing fixes)
                                   Resend (monthly email)
```

| Folder | What's in it |
|---|---|
| `app/lib/` | All the logic. `*.server.ts` runs on the server only. Plain `.ts` files are pure and tested. |
| `app/routes/` | Screens (`app.*`), webhooks, the pixel endpoint and `/healthz`. |
| `app/components/ui.tsx` | Score ring, trend line, bars and other visuals. |
| `extensions/ai-pixel` | Web Pixel that counts visits and spots AI referrals. |
| `extensions/geo-faq` | Theme block that shows approved product FAQs (+ FAQ structured data), and the app embed "AI-ready guide data" that adds FAQPage data to guide pages (from the page metafield `geo.faq`; the store switches it on once in the theme editor). |
| `prisma/` | Database tables and migrations. |
| `test/` | Unit tests and a full-flow test against Postgres. |

## Settings (environment variables)

| Name | What |
|---|---|
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | From the Partner dashboard (Client ID / Client secret). |
| `SHOPIFY_APP_URL` | Public address of this server. |
| `SCOPES` | Same list as `shopify.app.toml`. |
| `DATABASE_URL` / `DIRECT_URL` | Supabase pooler addresses, see `.env.example`. |
| `TREG_API_KEY` | Treg token (sent as `X-Treg-Token` to `https://treg.to/call/<endpoint>`). |
| `ANTHROPIC_API_KEY` | Claude. `AI_MODEL_FAST` / `AI_MODEL_SMART` override the models. |
| `RESEND_API_KEY`, `GEO_EMAIL_FROM` | Monthly report emails. |
| `GEO_ALERT_EMAIL` | Who is emailed when a store starts or leaves Done-for-you (hand outreach and the monthly call). Must be set at launch. |
| `SHOPIFY_BILLING_TEST` | `true` = test charges (use for development stores). Not set = test charges too: set `false` at launch. |
| `RUN_WORKER` | `false` to run a web-only process. |
| `GEO_SELFTEST` | `1` = run a live end-to-end check at start-up and print it to the logs. |

On Railway the keys are borrowed from the Paperflower `api` service with references like
`${{api.TREG_API_KEY}}`, so they're never copied anywhere.

## Commands

```bash
npm install
npm run dev          # shopify app dev (needs a Partner login)
npm test             # unit tests
TEST_DATABASE_URL=postgresql://...?...schema=geo npm test   # + full-flow test
npm run typecheck && npm run lint && npm run build
npm run deploy       # shopify app deploy: pushes app config, webhooks and extensions
```

## Honesty rules built in

- Nothing in a store changes until the merchant approves it; every change can be undone.
- Fixes never invent facts, reviews or awards, and a claims check removes health claims.
- AI revenue only counts orders that came from an AI assistant (or our own links). Google AI
  Overviews can't be separated from normal Google and aren't counted.
- No customer names, emails or addresses are stored.
