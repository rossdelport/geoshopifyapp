// The 3-month giveaway at firstpicked.com.au/giveaway (Ross, 3 Nov 2026): one Australian Shopify brand wins 3 months of
// GEO Done for you, drawn at random on Saturday 7 November 2026. Facebook ads send people to the page.
// The dates here are the rules' dates: the page (app/home/giveaway.html), the server and the admin page all use
// them. A test checks the page says the same.

export const GIVEAWAY = {
  /** Entries close 11:59pm Friday 6 November 2026, Perth time (AWST, UTC+8). */
  closesAt: new Date("2026-11-06T23:59:59+08:00"),
  /** The draw: 12pm Saturday 7 November 2026, Perth time. */
  drawAt: new Date("2026-11-07T12:00:00+08:00"),
};

/** The words under the form, saved with each entry. app/home/giveaway.html shows the same. */
export const GIVEAWAY_CONSENT_TEXT = "We’ll use this to run the draw and to contact you about GEO.";

export const GIVEAWAY_ERRORS = {
  generic: "Something went wrong. Please try again.",
  store: "Please type your store’s website, like amazingproduct.com.au.",
  name: "Please enter your name.",
  email: "Please enter a valid email address.",
  phone: "Please enter your phone number, like 0400 000 000.",
  closed: "Sorry, entries are closed. The winner is drawn on Saturday 7 November.",
  perIp: "You’ve entered a lot today. Please try again tomorrow.",
  busy: "We’re very busy right now. Please try again later today.",
  crossSite: "Please use the form on the GEO website.",
  tooBig: "That was too much to send. Please fill in just the four boxes.",
};

export const isOpen = (now = new Date()) => now.getTime() <= GIVEAWAY.closesAt.getTime();

/** A phone number as typed, tidied ("0400 369 865", "+61 400 369 865"). Null unless it has 8 to 15 digits. */
export function cleanPhone(raw: unknown): string | null {
  const s = String(raw ?? "")
    .replace(/[^\d+()\-. ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
  const digits = s.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15 ? s : null;
}
