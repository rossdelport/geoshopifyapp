import { chromium } from "/tmp/claude-0/tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.route("**/*", (r) => (r.request().url().startsWith("file:") ? r.continue() : r.abort()));
await p.goto("file:///tmp/claude-0/ref/qarin.html", { waitUntil: "load", timeout: 30000 });
await p.addStyleTag({ content: "*{opacity:1 !important; animation:none !important; transition:none !important} h1,h2,h3,p,[data-framer-component-type='RichTextContainer']{filter:none !important} [data-framer-appear-id]{transform:none !important}" });
await p.waitForTimeout(800);
const h = await p.evaluate(() => document.documentElement.scrollHeight);
console.log("height", h);
for (let i = 0, y = 0; y < h && i < 14; i++, y += 1800) {
  await p.screenshot({ path: `ref-${String(i).padStart(2, "0")}.png`, clip: { x: 0, y, width: 1440, height: Math.min(1800, h - y) }, fullPage: true });
}
await b.close();
