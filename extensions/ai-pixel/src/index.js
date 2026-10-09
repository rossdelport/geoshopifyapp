import { register } from "@shopify/web-pixels-extension";

// Sends one small event per visit (the first page of each browser session) so the app can
// count visits and spot the ones that came from AI assistants. No personal data is sent.
register(({ analytics, browser, settings }) => {
  analytics.subscribe("page_viewed", async (event) => {
    try {
      if (await browser.sessionStorage.getItem("geo_visit")) return;
      await browser.sessionStorage.setItem("geo_visit", "1");
      const doc = event.context.document;
      fetch(settings.endpoint, {
        method: "POST",
        keepalive: true,
        // text/plain keeps this a "simple" request (no CORS preflight).
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({
          shop: settings.accountID,
          ref: doc.referrer || "",
          url: doc.location.href,
          cid: event.clientId,
        }),
      });
    } catch (e) {
      // Never break the storefront.
    }
  });
});
