import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";
import { renderVsl, type VslAssets } from "../lib/vsl/render";
import { vslBySlug, vslPath } from "../lib/vsl/pages";
import { SITE } from "../lib/tools/site";
import font from "../fonts/inter-geo.woff2?url";
// Libre Baskerville (headings) and Caveat (the handwriting), both SIL Open Font License, unchanged fontsource files.
import serif700 from "../fonts/rr-serif-700.woff2?url";
import serif400 from "../fonts/rr-serif-400.woff2?url";
import hand from "../fonts/rr-hand-700.woff2?url";
import rossPhoto from "../home/ross.webp?url";
import rossCover from "../home/vsl/ross-cover.webp?url";
import reviewVideo from "../home/eduardo-review.mp4?url";
import reviewPoster from "../home/eduardo-review.webp?url";
import reviewCaptions from "../home/eduardo-review.vtt?url";
// The home page's Meta pixel and cookie notice, from the same files the home page copies.
import pixelHead from "../../design/overview/pixel-head.js?raw";
import cookieScript from "../../design/overview/parts/47-cookies.js?raw";
import raw from "../home/vsl.html?raw";

// rankwithross.com.au/for/<niche> (Ross, 17 Nov 2026): one page per niche for his video ads, with his video first and the
// "Book a call" button under it. The words are in app/lib/vsl/pages.ts; app/lib/vsl/render.ts draws them into
// app/home/vsl.html. An address that isn't one of the pages gets Not found.
//
// Ross's videos: put the file (H.264 .mp4, small, no location data) and a cover image (.webp) in app/home/vsl/, import
// both here with ?url (1-year cache) and add them to VIDEOS under the page's slug. Until then the frame says the video
// is coming, over a photo of Ross (app/home/vsl/ross-cover.webp).
const VIDEOS: Record<string, VslAssets["video"]> = {};

const shell = raw
  .replaceAll("__FONT_URL__", () => font)
  .replaceAll("__SERIF_URL__", () => serif700)
  .replaceAll("__SERIF400_URL__", () => serif400)
  .replaceAll("__HAND_URL__", () => hand)
  .replace("<!-- META_PIXEL -->", () => `<script>\n${pixelHead.trim()}\n</script>`)
  .replace("<!-- COOKIE_SCRIPT -->", () => `<script>\n${cookieScript.trim()}\n</script>`);

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const loader = ({ params, request }: LoaderFunctionArgs) => {
  const page = vslBySlug(params.niche);
  if (!page) {
    throw new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });
  }
  const body = renderVsl(page, {
    rossPhoto,
    cover: rossCover,
    video: VIDEOS[page.slug],
    // Eduardo's review on every page (Ross, 17 Nov 2026: "make sure that the eduardo video is on all pages")
    review: { src: reviewVideo, poster: reviewPoster, captions: reviewCaptions },
  });
  const html = shell
    .replaceAll("__TITLE__", () => attr(page.title))
    .replaceAll("__DESCRIPTION__", () => attr(page.description))
    .replaceAll("__URL__", () => attr(`${SITE}${vslPath(page.slug)}`))
    .replace("<!-- VSL_BODY -->", () => body);
  return serveHome(request, html);
};
