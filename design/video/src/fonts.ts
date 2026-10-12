// The home page loads Geist (headings, numbers) and Inter (body) from Google Fonts:
//   https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap
// (see design/overview/assemble.mjs). Google serves one variable woff2 per subset, so public/fonts holds the
// exact same four files (latin + latin-ext for each family), and the faces below copy Google's @font-face rules
// one for one: same family names, same single weights, same unicode ranges. Same files and same descriptors
// mean the same font matching as the site, e.g. a CSS weight of 650 picks the 700 face, exactly like the page.
// Nothing is fetched from the internet at render time. loadFont() holds the render until every face is loaded
// and fails the render if one can't load, so a fallback font can never slip into a video unnoticed.
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

const FAMILIES = [
  { family: "Geist", file: "geist", weights: ["400", "500", "600"] },
  { family: "Inter", file: "inter", weights: ["400", "500", "600", "700"] },
];

const SUBSETS = [
  { suffix: "latin-ext", unicodeRange: LATIN_EXT },
  { suffix: "latin", unicodeRange: LATIN },
];

export const fontsLoaded = Promise.all(
  FAMILIES.flatMap(({ family, file, weights }) =>
    weights.flatMap((weight) =>
      SUBSETS.map(({ suffix, unicodeRange }) =>
        loadFont({
          family,
          url: staticFile(`fonts/${file}-${suffix}.woff2`),
          weight,
          style: "normal",
          display: "block",
          unicodeRange,
        }),
      ),
    ),
  ),
);

// Font stacks copied from design/overview/base.css (--font-head, --font-body).
export const FONT_HEAD = '"Geist", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_BODY = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
