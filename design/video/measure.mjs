/* eslint-env node */
// Prints where the pointer targets (elements marked data-pt) sit on given frames, so src/tour/targets.ts can
// point at the real buttons. Usage: node measure.mjs <MemberTour|MemberTourPhone> <frame>[,<frame>...]
// Example: node measure.mjs MemberTour 600,900   ->   PT frame=600 {"approve":{"x":308,"y":481,"w":200,"h":40},...}
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const here = path.dirname(fileURLToPath(import.meta.url));
const [id = "MemberTour", framesArg = "600"] = process.argv.slice(2);
const sandboxShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || (existsSync(sandboxShell) ? sandboxShell : null);
const inputProps = { layout: id.endsWith("Phone") ? "phone" : "desktop", measure: true };

const serveUrl = await bundle({ entryPoint: path.join(here, "src/index.ts"), publicDir: path.join(here, "public") });
const browser = await openBrowser("chrome", { browserExecutable });
const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable, puppeteerInstance: browser });
const out = mkdtempSync(path.join(tmpdir(), "measure-"));
for (const frame of framesArg.split(",").map(Number)) {
  await renderStill({
    serveUrl,
    composition,
    frame,
    inputProps,
    output: path.join(out, `${frame}.png`),
    browserExecutable,
    puppeteerInstance: browser,
    onBrowserLog: (log) => {
      if (log.text.startsWith("PT ")) console.log(log.text);
    },
  });
}
await browser.close({ silent: true });
