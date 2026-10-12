// Remotion CLI settings for every render in this folder. CLI flags override these.
// https://www.remotion.dev/docs/config
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
// Lossless PNG frames from Chrome, so small text isn't softened twice (JPEG frames, then the video encoder).
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
// Tag the video as BT.709, so browsers show the page's exact colours (untagged video can shift a little).
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
// One Chrome tab per CPU core. The default (half the cores) took 136 s for a 50 s desktop test; this took 77 s
// on the 4-core sandbox. Output is byte-identical either way.
Config.setConcurrency("100%");

// Remotion downloads its own Chrome Headless Shell from remotion.media. That download is blocked in the Claude
// sandbox, so there we use Playwright's headless shell (Chromium 141), found automatically below. Anywhere else
// Remotion fetches its own on the first render. REMOTION_BROWSER_EXECUTABLE=<path> (or --browser-executable=<path>)
// picks another browser.
const SANDBOX_HEADLESS_SHELL = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable =
  process.env.REMOTION_BROWSER_EXECUTABLE || (existsSync(SANDBOX_HEADLESS_SHELL) ? SANDBOX_HEADLESS_SHELL : null);
if (browserExecutable) {
  Config.setBrowserExecutable(browserExecutable);
}
