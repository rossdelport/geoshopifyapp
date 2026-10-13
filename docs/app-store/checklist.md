# Submit checklist (do these in order)

## 1. Accounts and money

- [ ] Partner account: business name, address and ABN filled in (Partner Dashboard > Settings).
- [ ] Pay the one-time **US$19** App Store registration fee.
- [ ] Payouts: add a payout method and the tax form (outside the US: W-8BEN for a person, W-8BEN-E for a company).
- [ ] **Emergency developer contact**: an email and a phone you answer (Settings). Submission is blocked without it.
- [ ] Pick the app's distribution: **Public (Shopify App Store)**. This can't be changed later.
- [ ] Pick the app name (see `listing.md`). If it's "UseGEO: ...", set `name = "UseGEO"` in `shopify.app.toml`.

## 2. Protected customer data (before submitting)

- [ ] API access requests > Protected customer data access: request **protected customer data only** (no name,
      email, phone or address), paste the reason and fill in Data protection details from `protected-data.md`.
- [ ] Check who is an admin on the Supabase (OneInbox) and Railway (Paperflower) projects. Two-factor sign-in on.

## 3. Railway settings (service `geo-shopify-app`)

- [ ] `SHOPIFY_BILLING_TEST=false`. Safe now: Shopify development stores (yours and the reviewer's) always get test
      charges; real stores pay.
- [ ] `GEO_ALERT_EMAIL`: your or the VA's inbox (told when a store starts or leaves Done-for-you).
- [ ] `RESEND_API_KEY` and `GEO_EMAIL_FROM` (best from a usegeo.app address verified in Resend).
- [ ] `GEO_LEGAL_NAME` and `GEO_POSTAL_ADDRESS` (a PO box is fine), plus `GEO_ABN`. They show on /privacy and in emails.
- [ ] `SUPPORT_EMAIL`: the same address as the listing's support email. Without it /privacy shows no contact email.
- [ ] `SHOPIFY_API_SECRET` is set (logins and webhooks need it).
- [ ] **Top up the Anthropic credit.** Without it the reviewer gets no fixes, weaker questions and no pitches.
- [ ] Run `npm run deploy` so Shopify has the current app address, webhooks, the visit pixel and the FAQ theme block.

## 4. Test it once, like the reviewer will

- [ ] On a fresh development store, follow `reviewer.md` start to finish: install, free scan, Standard trial,
      approve and undo a fix, a `?utm_source=chatgpt.com` test order showing on the Dashboard, cancel, uninstall,
      reinstall.

## 5. Fill in the listing and submit

- [ ] Paste every field from `listing.md`; check each live character counter.
- [ ] Upload the icon (`icon-1200-navy.png` or `icon-1200-lilac.png`, pick one), 3 to 6 screenshots and the feature image (`screenshots.md`).
- [ ] Record and upload the screencast (script in `reviewer.md`), paste the testing instructions.
- [ ] Privacy policy URL https://usegeo.app/privacy, support email [SUPPORT EMAIL].
- [ ] **Submit for review.** Watch your email for the reviewer's questions and answer them quickly.

## 6. Approval day

- [ ] Switch the website's buttons from the waitlist to the App Store listing.
- [ ] Email the waitlist (they joined to hear about GEO) with the listing link. Send from the GEO address.
- [ ] Listing > tracking: add the **Meta pixel** and **Conversions API** so ad clicks to the listing and installs
      can be measured.
