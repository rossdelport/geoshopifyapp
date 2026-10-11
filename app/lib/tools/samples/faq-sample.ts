// The FAQ Schema Generator's on-load example: three questions and answers for a made-up beard oil
// (docs/tools/spec.md T4), labelled as made up on the page. The page builds its code live from these, so
// the server's HTML already shows real output. Pure data, browser-safe.

import type { FaqRow } from "../faq-schema";

export const SAMPLE_ROWS: FaqRow[] = [
  { q: "How long does a 30 ml bottle last?", a: "About two months if you use three or four drops a day." },
  { q: "Is it fragrance-free?", a: "Yes. It's made with jojoba and argan oil and has no added fragrance." },
  { q: "Do you ship outside the US?", a: "Yes, we ship to most countries. You'll see the delivery time and cost at checkout." },
];
