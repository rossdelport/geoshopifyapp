// Free product check: the words of the "email me the report" form, shared by the popup
// (components/check-lead.tsx) and the server (lib/check-lead.server.ts). The server stores the words a
// visitor agreed to exactly as the popup shows them, so both must come from here (a test checks it).
// If you change them, the new words are stored from then on; older rows keep the words they saw.

/** Under the button. Stored with every request (Subscriber.consentText): what the visitor asked for. */
export const REPORT_CONSENT_TEXT = "We’ll email this report to you once, as a PDF.";

/** The optional, unticked box. Stored only when ticked (Subscriber.tipsConsentText). */
export const TIPS_CONSENT_TEXT = "Also send me occasional tips on getting recommended by AI. Unsubscribe any time.";

/** The POST /check/:id/email field for the tips box ("1" when ticked; anything else or missing means no). */
export const TIPS_FIELD = "tips";

/** The server's reply for an address it can't use. The popup marks the email box red only for this one. */
export const BAD_EMAIL_ERROR = "Please enter a valid email address.";
