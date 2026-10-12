// Colours copied from design/overview/base.css so the video matches the home page.
// Purple and lilac are for the one focal point per scene only (docs/copy-deck.md 14b); everything else is
// white, warm grey and navy, like the page.
export const C = {
  navy: "#0b0c2b",
  navy2: "#15163c",
  navy3: "#373868",
  ink2: "#3d3e52",
  text: "#5c5d78",
  text2: "#5f6070",
  muted: "#9a9bab",
  lilac50: "#efecfd",
  lilac100: "#e2e2fc",
  peri300: "#bfc9fa",
  cobalt: "#4050b0",
  cobaltMid: "#6878d8",
  warm50: "#f8f7f4",
  warm100: "#f1f0ec",
  lineSoft: "#e6e5e0",
  line: "#eeeeee",
  white: "#ffffff",
  green: "#6cd68c",
  greenInk: "#167a43",
  greenBg: "#e9f9ee",
  amber: "#f0b150",
  red: "#ef5a5a",
  // mock Shopify admin (parts/20m-money.css)
  adminTop: "#1a1a1a",
  adminNav: "#ebebeb",
  adminMain: "#f1f1f1",
  adminText: "#303030",
  adminSub: "#616161",
  // engine colours used in the page mockups
  chatgpt: "#10a37f",
  gemini: "#4f7cff",
  perplexity: "#20808d",
  google: "#f0b150",
} as const;

export const GRAD_MAIN = "linear-gradient(180deg, #efecfd 0%, #e2e2fc 50%, #bfc9fa 100%)";
export const GRAD_BTN = "linear-gradient(180deg, #373868 0%, #15163c 100%)";
export const SHADOW_SOFT = "0 1px 2px rgba(17, 17, 26, 0.04), 0 16px 32px -22px rgba(17, 17, 26, 0.18)";
export const SHADOW_LG = "0 40px 80px -20px rgba(11, 12, 43, 0.18), 0 12px 24px -8px rgba(11, 12, 43, 0.08)";
