// The 3-month giveaway at firstpicked.com.au/giveaway (Ross, 3 Nov 2026): one Australian Shopify brand wins 3 months of
// FirstPicked Done for you, drawn at random. Facebook ads send people to the page.
// Round 2 (Ross, 8 Nov 2026): cold ad visitors wouldn't book a call (about 300 visits to /book, no bookings), so the
// ads send people here instead. The entry asks what the store sells a month, phone is optional, and everyone who
// enters and doesn't win can have 50% off their first 3 months (RUNNER_UP_OFFER). Round 1 (3 to 6 Nov) had no entries.
// The dates here are the rules' dates: the page (app/home/giveaway.html), the server and the admin page all use
// them. A test checks the page says the same.


export const GIVEAWAY = {
  /** Entries close 11:59pm Friday 13 November 2026, Perth time (AWST, UTC+8). */
  closesAt: new Date("2026-11-13T23:59:59+08:00"),
  /** The draw: 12pm Saturday 14 November 2026, Perth time. */
  drawAt: new Date("2026-11-14T12:00:00+08:00"),
};

/** For everyone who enters and doesn't win: half price for the first 3 months, if they start by 30 November 2026. */
export const RUNNER_UP_OFFER = {
  percentOff: 50,
  months: 3,
  /** A$945 a month (OFFER in plans.ts) at half price. */
  monthly: "A$472.50",
  startBy: "Monday 30 November 2026",
};

/** The words under the form, saved with each entry. app/home/giveaway.html shows the same. */
export const GIVEAWAY_CONSENT_TEXT = "We’ll use this to run the draw and to contact you about FirstPicked.";

export const GIVEAWAY_ERRORS = {
  generic: "Something went wrong. Please try again.",
  store: "Please type your store’s website, like amazingproduct.com.au.",
  name: "Please enter your name.",
  email: "Please enter a valid email address.",
  phone: "Please check your phone number, like 0400 000 000, or leave it empty.",
  sales: "Please pick how much your store sells each month.",
  closed: "Sorry, entries are closed. The winner is drawn on Saturday 14 November.",
  perIp: "You’ve entered a lot today. Please try again tomorrow.",
  busy: "We’re very busy right now. Please try again later today.",
  crossSite: "Please use the form on the FirstPicked website.",
  tooBig: "That was too much to send. Please fill in just the five boxes.",
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
