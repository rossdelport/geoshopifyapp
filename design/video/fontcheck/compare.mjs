// Font check: screenshots fontcheck/site.html (the specimen with Google Fonts loaded from the web, like the
// live page) in the same Chromium Remotion renders with, then diffs it pixel by pixel against out/specimen.png
// (npm run specimen). 0 differing pixels = the video draws text exactly like the site.
// Run from design/video:  node fontcheck/compare.mjs
// Playwright is not a dependency of this folder: PLAYWRIGHT=<path to playwright/index.mjs> (default: the Claude
// sandbox copy). BROWSER=<chrome or headless shell> (default: the sandbox headless shell).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const playwright = process.env.PLAYWRIGHT || "/tmp/claude-0/tools/node_modules/playwright/index.mjs";
const browserPath = process.env.BROWSER || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const still = path.join(here, "../out/specimen.png");
const shot = path.join(here, "../out/specimen-site.png");

const { chromium } = await import(pathToFileURL(playwright).href);
// Same text flags Remotion passes to Chrome (see @remotion/renderer open-browser.js).
const browser = await chromium.launch({ executablePath: browserPath, args: ["--force-color-profile=srgb", "--font-render-hinting=none"] });
const page = await browser.newPage({ viewport: { width: 720, height: 420 } });
await page.goto(pathToFileURL(path.join(here, "site.html")).href);
await page.evaluate(() => document.fonts.ready);
const loadedFaces = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").length);
await page.screenshot({ path: shot });

const [a, b] = [shot, still].map((f) => fs.readFileSync(f).toString("base64"));
const result = await page.evaluate(async ([a, b]) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + s; });
  const pixels = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const [da, db] = [pixels(ia), pixels(ib)];
  let differingPixels = 0, maxChannelDiff = 0;
  for (let i = 0; i < Math.min(da.length, db.length); i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    if (d > 0) differingPixels++;
    if (d > maxChannelDiff) maxChannelDiff = d;
  }
  return { site: [ia.width, ia.height], video: [ib.width, ib.height], differingPixels, maxChannelDiff };
}, [a, b]);
console.log(JSON.stringify({ loadedFaces, ...result }));
await browser.close();
