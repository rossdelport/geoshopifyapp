import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";
import { STORIES } from "../lib/stories";
import { logoSrc, storyPath } from "../lib/stories/pages";
import font from "../fonts/inter-geo.woff2?url";

// usegeo.app/newhomepage: the redesigned home page, as a preview next to the live one (Ross, 19 Oct 2026).
// One HTML file with its styles and scripts inline. The font is Inter (with its Display cut for big text),
// trimmed to Latin and served from /assets with a long cache. noindex until it replaces "/".
import raw from "../home/new-home.html?raw";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const arrow = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';

// The story cards, from the same stories.json as /stories. Written twice so the moving row can loop: the second
// copy is hidden from screen readers and skipped by the keyboard.
const storyGroup = (copy: boolean) =>
  `<ul class="st-group" role="list"${copy ? ' aria-hidden="true"' : ""}>` +
  STORIES.map((s) => {
    const wide = s.logoShape === "wide";
    const logo = `<span class="st-logo${wide ? " is-wide" : ""}"><img src="${logoSrc(s.logo)}" alt="" width="${wide ? 76 : 28}" height="${wide ? 20 : 28}" loading="lazy" decoding="async"></span>`;
    return `<li><a class="st-card" href="${storyPath(s.slug)}"${copy ? ' tabindex="-1"' : ""}><span class="st-h">${esc(s.cardHeadline)}</span><span class="st-f">${logo}${esc(s.brand)}${arrow}</span></a></li>`;
  }).join("") +
  "</ul>";

const page = raw.replaceAll("__FONT_URL__", font).replace("<!-- STORY_CARDS -->", storyGroup(false) + storyGroup(true));

export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, page);
