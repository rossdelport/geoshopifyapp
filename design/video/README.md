# Home page video (Remotion)

The silent, looping video in the home page's video section (`design/overview/parts/11v-video.*`), made with
[Remotion](https://www.remotion.dev). Today that is the **member tour** ("What you get when you join"): 56 s,
compositions `MemberTour` (desktop) and `MemberTourPhone` (phone), built from `docs/video/storyboard.md`. This folder is standalone: its own `package.json` and `node_modules`, not an
npm workspace, never added to the app's root `package.json`. The root `tsconfig.json` excludes it and
`.dockerignore` keeps `node_modules/` and `out/` out of the app image.

Everything below was run and measured in the Claude sandbox on 2026-10-11.

## Versions

| Piece | Version |
|---|---|
| `remotion`, `@remotion/cli`, `@remotion/fonts` | 4.0.534 (pinned exactly, `.npmrc` has `save-exact=true`) |
| `react`, `react-dom` | 19.2.3 |
| TypeScript | 5.9.3 |
| Node | 22.22.0 |
| Browser | Playwright's Chromium 141 headless shell (sandbox), see "Browser" below |
| Encoder | Remotion's bundled FFmpeg 7.1 (libx264, libvpx-vp9). The system `ffmpeg`/`ffprobe` 6.1.1 is only used for checks. |

Setup on a new machine: `cd design/video && npm ci`.

## Files

| Path | What it is |
|---|---|
| `src/index.ts` | Entry point (`registerRoot`). |
| `src/Root.tsx` | The compositions: `MemberTour`, `MemberTourPhone` (1,680 frames each), the test card and the font specimen. |
| `src/tour/` | The member tour. `MemberTour.tsx` puts it together (and the loop seam); `data.ts` holds every word and number on screen (the copy check is one file); `timeline.ts` the scene starts, clicks, tab and badge states and the motion helpers; `geometry.ts` where things sit in each layout; `AppWindow.tsx`, `Caption.tsx`, `Pointer.tsx`, `targets.ts` and `ui.tsx` the shared pieces; `scenes/` one file per screen. |
| `src/fonts.ts` | Loads the site's fonts from `public/fonts` (see "Fonts"). Exports `FONT_HEAD` and `FONT_BODY`. |
| `src/theme.ts` | The page's colours (`C`), gradients and shadows, copied from `design/overview/base.css`. |
| `src/global.css` | The page's base CSS (box sizing, body text, `.tnum`). |
| `src/TestCard.tsx` | 3 second pipeline test (loops when rendered longer). Exports `ExampleTag`, the persistent "Example" tag styled like the page's `.vid-tag`. |
| `src/FontSpecimen.tsx` | A still with every font face the page uses, for the font check. |
| `render.sh` | Renders a full set: desktop and phone, MP4 and WebM, plus both posters. |
| `measure.mjs` | Prints where the member tour's pointer targets sit on given frames (see "The member tour"). |
| `fontcheck/` | Proves the video draws text exactly like the site (see "Fonts"). |
| `remotion.config.ts` | Settings every render uses (see below). |
| `out/` | Renders. Gitignored. Holds the test set and the specimen as a reference. |

## Sizes

| Version | Composition size | Rendered with | File size | Frame rate |
|---|---|---|---|---|
| Desktop | 1280x800 | `--scale=1` (default) | 1280x800 | 30 fps |
| Phone | 390x640 (the page's phone layout in CSS pixels) | `--scale=2` | 780x1280 | 30 fps |

The phone version is drawn at 2x, like a phone screenshot, so text stays sharp on phone screens. Both keep the aspect
ratios the page's CSS sets (`11v-video.css`: `aspect-ratio: 1280 / 800`, and `390 / 640` under 600px).

## Render commands

Run everything from `design/video`.

All six files in one go (desktop MP4 + WebM + poster, phone MP4 + WebM + poster):

```sh
./render.sh <DesktopId> <PhoneId> <name> [posterFrame]
./render.sh Test TestPhone test 75        # same as: npm run render:test
```

This writes `out/<name>.mp4`, `out/<name>.webm`, `out/<name>-poster.jpg`, `out/<name>-phone.mp4`,
`out/<name>-phone.webm` and `out/<name>-phone-poster.jpg`, then prints each file's size, codec and dimensions.
`H264_CRF=20 VP9_CRF=28 ./render.sh ...` overrides the quality.

The same thing one file at a time:

```sh
# Desktop
npx remotion render Test out/test.mp4  --codec=h264 --crf=18 --muted
npx remotion render Test out/test.webm --codec=vp9  --crf=32 --muted
# Phone (always --scale=2)
npx remotion render TestPhone out/test-phone.mp4  --codec=h264 --crf=18 --scale=2 --muted
npx remotion render TestPhone out/test-phone.webm --codec=vp9  --crf=32 --scale=2 --muted
```

Poster frames as JPG (rendered straight from the composition, so they are sharper than a frame pulled out of the
video; the `.jpg` extension picks JPEG):

```sh
npx remotion still Test      out/test-poster.jpg       --frame=75 --jpeg-quality=90
npx remotion still TestPhone out/test-phone-poster.jpg --frame=75 --jpeg-quality=90 --scale=2
```

For a seamless start, the poster should usually be the frame the video opens on (`--frame=0`), unless that frame is
empty.

Checking your work without a browser:

```sh
npx remotion still Test out/frame.png --frame=40                     # one frame as PNG, about 5 s
ffmpeg -i out/test.mp4 -vf "fps=1/5,scale=426:-1,tile=4x3" -frames:v 1 out/sheet.png   # contact sheet, one frame every 5 s
ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,color_space -of compact out/test.mp4
```

`npm run studio` opens Remotion Studio (localhost:3000) for live editing on a laptop. In the sandbox, use stills.

### What `remotion.config.ts` sets for every render

- `setVideoImageFormat("png")`: Chrome hands over lossless PNG frames, so small text is only compressed once.
- `setPixelFormat("yuv420p")`: plays everywhere, Safari included.
- `setColorSpace("bt709")`: the files are tagged BT.709, so browsers show the page's colours. Checked in Chromium:
  the page background `#f8f7f4` (248,247,244) decodes as (249,246,245), one level off, which no one can see.
- `setConcurrency("100%")`: one Chrome tab per CPU core (see "Render speed").
- `setOverwriteOutput(true)` and the entry point `src/index.ts`.
- The browser (below).

Remotion 4.0.534 also moves the MP4 index to the front of the file by itself (`-movflags faststart`, checked: atom
order `ftyp, moov, free, mdat`), so the MP4 starts playing before it has fully downloaded. `--muted` makes sure
there is no audio track (checked: video stream only).

### Browser

Remotion normally downloads its own Chrome Headless Shell from remotion.media. That host is blocked in the Claude
sandbox (proxy answers 403), so `remotion.config.ts` uses Playwright's headless shell when it exists:

```
/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell   (Chromium 141.0.7390.37)
```

Nothing to set by hand. Anywhere else Remotion downloads its own browser on the first render.
`REMOTION_BROWSER_EXECUTABLE=<path>` or `--browser-executable=<path>` picks a different one.

## Quality: the CRF values

H.264 at CRF 18 and VP9 at CRF 32. Lower CRF means sharper and bigger. Measured on the 3 second test card against
the lossless PNG frames (luma PSNR and SSIM: higher means closer to the original):

| Desktop 1280x800 | Size (3 s) | Luma PSNR | SSIM |
|---|---|---|---|
| H.264 CRF 18 (used) | 76 KB | 55.1 dB | 0.9991 |
| H.264 CRF 20 | 67 KB | 53.3 dB | 0.9988 |
| H.264 CRF 23 | 56 KB | 50.5 dB | 0.9983 |
| VP9 CRF 28 | 83 KB | 52.1 dB | 0.9985 |
| VP9 CRF 32 (used) | 70 KB | 50.1 dB | 0.9981 |
| VP9 CRF 36 | 58 KB | 48.0 dB | 0.9975 |

| Phone 780x1280 | Size (3 s) | Luma PSNR | SSIM |
|---|---|---|---|
| H.264 CRF 18 (used) | 142 KB | 51.5 dB | 0.9980 |
| H.264 CRF 20 | 124 KB | 49.8 dB | 0.9975 |
| H.264 CRF 23 | 103 KB | 47.0 dB | 0.9964 |
| VP9 CRF 28 | 163 KB | 48.9 dB | 0.9970 |
| VP9 CRF 32 (used) | 137 KB | 46.9 dB | 0.9962 |

At 2x and 3x zoom the 11px and 12.5px text looks the same in all of the used settings, in still and moving frames.
If the real video's WebM ever looks softer than the MP4, use `VP9_CRF=28` (about 19% bigger). If the phone files are
too heavy, `H264_CRF=20` on the phone saves about 13% and is still sharp at 2x. The x264 `slow` preset saved only
1 to 2%, so it stays on the default (`medium`).

Renders are deterministic: the same code gives byte-identical files on every run and at any concurrency.

## Render speed

Measured in the sandbox (4 CPU cores, 15 GB memory) with the test card, H.264 CRF 18 and VP9 CRF 32.

| Render | Time |
|---|---|
| One 3 second clip (90 frames) | 14 to 22 s, mostly bundling (about 5 s) and starting Chrome |
| A full 3 second set with `render.sh` (4 videos, 2 posters) | 68 s |
| One still (poster or preview frame) | about 5 s |
| 50 s desktop H.264 (1,500 frames, `--duration=1500`) | 77 s (136 s at Remotion's default concurrency of 2) |
| 50 s desktop VP9 | 169 s |
| 50 s phone H.264 at 2x | 151 s |
| 50 s phone VP9 at 2x | 192 s |

So a full set for a 45 to 60 second video takes about 10 to 12 minutes. Chrome needed 110 to 180 ms to capture a
desktop frame and 170 to 230 ms for a phone frame; VP9 encoding adds 60 to 110 ms a frame, which is why WebM is
slower. Busier scenes will capture more slowly. To benchmark any composition at 50 s, add `--duration=1500`.

For quick drafts, `--image-format=jpeg` (JPEG frames at Remotion's default quality, 80) captured frames 38% faster
(76 ms instead of 122 ms a frame) for a 0.2 dB loss. Keep PNG frames for the files that ship.

## File sizes

| File | 3 s test card | 50 s test card (looping) |
|---|---|---|
| Desktop MP4 | 76 KB | 1.37 MB |
| Desktop WebM | 70 KB | 1.23 MB |
| Phone MP4 (2x) | 142 KB | 2.38 MB |
| Phone WebM (2x) | 137 KB | 2.39 MB |
| Desktop poster JPG (q90) | 49 KB | |
| Phone poster JPG (q90, 2x) | 90 KB | |

For comparison, the current free check video on the page is 1.82 MB (MP4) and 1.76 MB (WebM) for 47 s at 1280x800,
and 0.79 MB / 0.84 MB for the phone version at 390x640 (1x). Phone files at 2x come out about three times heavier
than the old 1x phone files. The page only loads the video when it is near the screen (`preload="none"` plus
`11v-video.js`), so this does not slow the first page load.

## Fonts

The page loads Geist (headings, numbers) and Inter (body) from Google Fonts. `public/fonts` holds the exact files
Google serves for that request (one variable woff2 per family and subset, latin and latin-ext), and `src/fonts.ts`
copies Google's `@font-face` rules one for one: same family names, weights (Geist 400, 500, 600; Inter 400, 500,
600, 700) and unicode ranges. So font matching is the same as on the site: a CSS weight of 650 picks the 700 face,
like the page does. Nothing is fetched from the internet at render time, and `loadFont()` holds every render until
all 14 faces are loaded (a missing file fails the render instead of slipping in a fallback font). Licences:
`public/fonts/OFL-Geist.txt`, `public/fonts/OFL-Inter.txt`.

Use the exported stacks, never a bare family name:

```tsx
import { FONT_BODY, FONT_HEAD } from "./fonts";
<h2 style={{ fontFamily: FONT_HEAD, fontWeight: 500 }}>...</h2>
```

### Check the fonts

```sh
npm run specimen            # renders out/specimen.png from src/FontSpecimen.tsx
node fontcheck/compare.mjs  # screenshots fontcheck/site.html with Google Fonts loaded from the web, then diffs
```

Result on 2026-10-11: `{"loadedFaces":14,"differingPixels":0,"maxChannelDiff":0}`. The Remotion still is
pixel-identical to the same text drawn with the live Google Fonts in the same Chromium (with the text flags Remotion
uses: `--font-render-hinting=none`, `--force-color-profile=srgb`). `compare.mjs` takes `PLAYWRIGHT=` and `BROWSER=`
if it runs outside the sandbox. Run the check again if the page's Google Fonts link ever changes.

## Writing the scenes

- Animate only from `useCurrentFrame()` (`interpolate`, `spring`, `Sequence`). No CSS transitions or keyframe
  animations, no timers, no `Date.now()` or `Math.random()`: Remotion renders frames out of order across several
  Chrome tabs, so anything not derived from the frame number flickers or breaks.
- Colours, gradients and shadows from `src/theme.ts`; purple and lilac only for the one focal point per scene.
- Put `<ExampleTag />` (from `TestCard.tsx`) on every scene that shows the sample store or a number.
- Images go in `public/` and are drawn with `<Img src={staticFile("...")} />`, which waits for them to load. The
  page's images are in `design/overview/img/`; copy the ones you need.
- The page plays the video with `loop`, so the last frame should lead cleanly back into the first.
- The copy rules in the repo's `CLAUDE.md` apply to every word on screen.
- `npm run typecheck` checks this folder (the root `npx tsc --noEmit` skips it).
- Root `npm run lint` does lint this folder's `.ts` and `.tsx` files with the app's rules (React, hooks, jsx-a11y,
  TypeScript). It passes today; keep it that way, or add `design/video` to the root `.eslintignore`.

## The member tour

```sh
PHONE_H264_CRF=27 PHONE_VP9_CRF=44 ./render.sh MemberTour MemberTourPhone member-tour 1325
```

Desktop keeps the default CRFs (H.264 18, VP9 32). The phone files are drawn at 2x, so they take higher CRFs to
stay near 1.5 MB; at 2x the text looks the same as at CRF 18 (checked on crops of the 13 px text). The poster is
frame 1325 (the money scene, everything filled in) for both layouts.

- All motion comes from the global frame, passed down as `f`; scenes turn it into their own local frame. Screens
  that aren't showing return nothing, so a frame only draws what is on screen.
- The pointer lands on real buttons. If a screen's layout changes, measure the buttons again with
  `node measure.mjs MemberTour 600,900` (or `MemberTourPhone`, any frames where the buttons show). It prints
  `PT frame=600 {"approve":{"x":308,"y":481,"w":200,"h":40},...}` for every element marked `data-pt`, and those
  numbers go in `src/tour/targets.ts`. (The CLI's `remotion still` doesn't print the browser log, so this uses the
  Node API.)
- Loop: for the last 18 frames, frame 0's picture fades in over the end card, so the last frame differs from frame
  0 by 1/18 of that fade.
- The bottom right corner (100x80 desktop, 60x56 phone) has nothing to read: the page's pause button sits there.
- Differences from the storyboard's numbers: the end card starts at frame 1470 (not 1485) and its stops come in
  faster, so the three stops and the button stay up about 4.5 s before the loop fade; the desktop pointer fades
  once it has opened the Dashboard (so it isn't in the poster); the report card's heading is "Money from AI"
  without a month (the real email, sent in the first days of a month, now covers the whole month before);
  the store's own site in "Sites AI trusts" is labelled "Your website", as on the real Competitors screen.

## Putting a new video on the page

1. Render the set with `./render.sh` and copy the six files from `out/` to `design/overview/img/`.
2. In `design/overview/parts/11v-video.html`, update the four `<source>` paths, the `poster`, the heading and the
   `aria-label`. In `11v-video.js`, update the poster name swap for phones (it replaces `member-tour-poster` with
   `member-tour-phone-poster`) and the button labels. The phone poster is also in the `extra` list in
   `design/overview/assemble.mjs`.
3. Run `node design/overview/assemble.mjs` (writes `app/home/home.html`, `design/overview/index.html` and copies the
   used images to `public/home/img`).
4. Update `test/home.test.ts`, which names `member-tour-phone-poster.jpg` and checks the video markup and files.

Playwright's Chromium cannot play H.264 (no licensed codecs), so check the MP4 with `ffprobe` and frame grabs, and
the WebM in the browser.
