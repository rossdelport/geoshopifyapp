import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../../lib/home-page.server";
import { STORIES } from "../../lib/stories";
import { logoSrc, storyPath } from "../../lib/stories/pages";
import font from "../../fonts/inter-geo.woff2?url";
// Ross's photo beside the main hero button (Ross, 3 Nov 2026): a square head-and-shoulders crop, 168px for a 46px box (as tall as the button).
import rossPhoto from "../../home/ross.webp?url";

// The public home page, firstpicked.com.au (Ross, 2 Nov 2026: the new design from /newhomepage, which now sends people here).
// One HTML file with its styles and scripts inline. The font is Inter (with its Display cut for big text),
// trimmed to Latin and served from /assets with a long cache.
// The pages in other languages (/de, /fr, /nl, /es, /it) still use the older design, built from design/overview.
import raw from "../../home/new-home.html?raw";

// Small copies of the PNG story logos, sized for the cards (2x their 28px box); the full-size files stay in
// public/home/img for the /stories pages. Imported as URLs so they get the same long cache as the font.
const smallLogos = import.meta.glob<string>("../../home/logos/*.webp", { eager: true, query: "?url", import: "default" });
const cardLogo = (logo: string) => smallLogos[`../../home/logos/${logo.replace(/^logos\//, "").replace(/\.png$/, ".webp")}`] ?? logoSrc(logo);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const arrow = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';

// The story cards, from the same stories.json as /stories. Written twice so the moving row can loop: the second
// copy is hidden from screen readers and skipped by the keyboard.
const storyGroup = (copy: boolean) =>
  `<ul class="st-group" role="list"${copy ? ' aria-hidden="true"' : ""}>` +
  STORIES.map((s) => {
    const wide = s.logoShape === "wide";
    const logo = `<span class="st-logo${wide ? " is-wide" : ""}"><img src="${cardLogo(s.logo)}" alt="" width="${wide ? 76 : 28}" height="${wide ? 20 : 28}" loading="lazy" decoding="async"></span>`;
    return `<li><a class="st-card" href="${storyPath(s.slug)}"${copy ? ' tabindex="-1"' : ""}><span class="st-h">${esc(s.cardHeadline)}</span><span class="st-f">${logo}${esc(s.brand)}${arrow}</span></a></li>`;
  }).join("") +
  "</ul>";

// Functions as replacements, so a "$" in a headline is never read as a replace pattern.
const page = raw.replaceAll("__FONT_URL__", () => font).replaceAll("__ROSS_PHOTO__", () => rossPhoto).replace("<!-- STORY_CARDS -->", () => storyGroup(false) + storyGroup(true));

// No component: this route sends the finished HTML page as-is.
export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, page);
