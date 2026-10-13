# For Shopify's reviewer

## Testing instructions (paste into the "Testing instructions" field)

No login, password or outside account is needed: the app signs in with Shopify. It works best on a store that has a
few products with descriptions. Development stores always get test charges, so nothing is ever billed.

1. **Install.** Approve the permissions. The app opens on its Dashboard: "Does ChatGPT recommend your store?"
2. **Start the free scan.** Click "Start my free scan". The app reads your products, writes a short profile of the
   store, writes the questions shoppers ask AI, then asks ChatGPT, Gemini and Perplexity 10 of them, twice each
   (60 answers). It reads each answer for the brands named and the sites linked, and works out a score out of 100.
   At the same time it checks the last 60 days of orders for sales that came from AI. The screen shows each step and
   "x of 60 AI answers read". It usually takes a few minutes, longer if the AI services are slow. You can leave the
   page; it keeps going.
3. **See the results.** Dashboard: "Money from AI" at the top, then the score, "Do this next" and "Who AI recommends
   instead". Questions: every tracked question; click one to read each AI's real answers and the sites it used.
   Competitors: brands AI names and the websites it relies on.
4. **Pick a plan.** Click "Start tracking weekly" (top right of the Dashboard), or Settings > "See plans". Choose
   Standard, click "Start 7-day free trial" and approve the test charge on Shopify's page. You come back to Plans with
   "Free trial: 7 days left". The upgrade starts a bigger scan (50 questions on 4 AI assistants); the Dashboard shows
   its progress. Plans can be switched or cancelled on the same page.
5. **Approve and undo a fix.** Open Fixes. Fixes are written after every scan; to get some straight away, click
   "Write more fixes" and refresh after a minute or two. Each card shows "Now" and "After".
   - Click "Approve & publish": the product changes in your store ("Live in your store").
   - Open the "Live" tab and click "View in store" to see it.
   - Click "Undo": the product goes back exactly as it was ("Undone. Your store is back how it was.").
   - Buying guides use "Approve & publish page", which creates an Online Store page; Undo removes it.
   - Approved product FAQs show on the storefront once the "AI-ready FAQs" theme block is added (the Fixes page shows
     an "Add to my theme" button).
   - On Done-for-you, autopilot applies fixes for the store (switch at the top of Fixes). Please test approve and
     undo on Standard.
6. **Outreach.** Pages AI quotes that name other brands, each with a drafted email. "Open in my email" opens the
   reviewer's own email app. The app never sends anything itself.
7. **The money dashboard.** It counts orders where the shopper came from an AI assistant (for example chatgpt.com,
   perplexity.ai or gemini.google.com as the referrer, or a link tagged `utm_source=chatgpt.com`) and orders through
   pages the app built. A test store usually has none, so it shows 0 and "No AI sales found yet". To see it work:
   - Open the storefront with `?utm_source=chatgpt.com` on the address, for example
     `https://YOUR-STORE.myshopify.com/?utm_source=chatgpt.com`. Accept analytics cookies if a banner shows.
   - Place a test order (Bogus Gateway).
   - About 3 minutes later the Dashboard shows it under "Where AI sales come from", with the reason "Link was tagged
     utm_source=chatgpt.com". The visit also counts under "visits from AI".
8. **Settings.** Brand name, country, monthly report emails, visit tracking status, product refresh, and "How we keep
   this honest".

The app never stores customers' names, emails, phone numbers or addresses. Uninstalling stops all work, and
Shopify's shop/redact webhook deletes the store's data.

## Demo screencast (English, about 3 minutes 40 seconds)

Record on a development store with a grooming or skincare catalogue that has already run its free scan, has Standard
on a test charge, and has one AI test order. Show the real app only. Speak slowly; cut the waiting.

| Time | Click | Say |
|---|---|---|
| 0:00 to 0:15 | Show the app's Dashboard in the Shopify admin. | "This app shows whether ChatGPT and other AI assistants recommend a store's products, writes fixes the store approves, and shows the orders that came from AI." |
| 0:15 to 0:40 | On a second, fresh dev store: install, then click "Start my free scan". | "After install there's one button. The app reads the products, writes the questions shoppers ask AI, and asks ChatGPT, Gemini and Perplexity each one twice." |
| 0:40 to 0:55 | Show the setup steps and the "AI answers read" counter. Cut to the end. | "Progress shows here. It takes a few minutes, and the store can leave the page." |
| 0:55 to 1:25 | Back on the main store: Dashboard, then Questions, then click one question and open a run's sources. | "Each question shows how often the store is named and who AI picks instead. Here are the real answers, run by run, and the sites each AI used." |
| 1:25 to 1:45 | Competitors. Switch between "All assistants" and one assistant. | "These are the brands AI names most, and the websites each assistant relies on." |
| 1:45 to 2:05 | Settings > "See plans" (or "Change plan"). Show the Monthly / Yearly switch and "Start 7-day free trial" on Standard, then the approval page. | "Plans bill through Shopify with a 7-day free trial. On a development store the charge is a test, so nothing is billed." |
| 2:05 to 2:45 | Fixes: open a "Clearer product description" card, point at Now and After, click "Approve & publish", open "Live", click "View in store", come back, click "Undo". | "Fixes use only facts from the store. One click puts this live on the product. Here it is in the store. And one click puts it back exactly as it was." |
| 2:45 to 3:05 | Outreach: one article card, its drafted email, "Open in my email". | "These are pages AI quotes that name other brands. The app drafts an honest pitch; the store sends it from its own email." |
| 3:05 to 3:30 | Open the storefront with `?utm_source=chatgpt.com`, place a Bogus Gateway order, then show the order on the Dashboard under "Where AI sales come from". | "When a shopper arrives from ChatGPT and buys, the order shows here with the reason we counted it. Google AI Overviews can't be separated from normal Google, so they aren't counted." |
| 3:30 to 3:40 | Settings: scroll to "How we keep this honest". | "Every change can be undone, nothing is invented, and no customer names or emails are stored." |
