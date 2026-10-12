// Where things sit, for both layouts (storyboard section 2). Desktop is 1280x800. Phone is laid out at 390x640
// and rendered at 2x. The bottom right corner stays clear of anything to read: the page's pause button sits there.
export type Layout = "desktop" | "phone";

export type Box = { x: number; y: number; w: number; h: number };

export const DESKTOP = {
  W: 1280,
  H: 800,
  tag: { top: 22, right: 22, size: 13 },
  chips: { x: 64, y: 34, h: 30, font: 16, gap: 8 },
  caption: { x: 64, y: 76, w: 1000, size: 40, lh: 1.15, ls: -1.4 },
  win: { x: 64, y: 142, w: 1152, h: 624, pad: 10, r: 22, top: 40, side: 190, strip: 0, mainPad: 22 },
};

export const PHONE = {
  W: 390,
  H: 640,
  tag: { top: 14, right: 14, size: 12 },
  chips: { x: 18, y: 14, h: 26, font: 15, gap: 6 },
  caption: { x: 18, y: 50, yWithNote: 82, w: 354, size: 26, lh: 1.2, ls: -0.8 },
  win: { x: 18, y: 156, w: 354, h: 472, pad: 6, r: 18, top: 32, side: 0, strip: 38, mainPad: 12 },
};

export function geo(layout: Layout) {
  return layout === "phone" ? PHONE : DESKTOP;
}

// The app's main area (grey) and the content box inside its padding, in video coordinates.
export function mainBox(layout: Layout): Box {
  const w = geo(layout).win;
  return {
    x: w.x + w.pad + w.side,
    y: w.y + w.pad + w.top + w.strip,
    w: w.w - 2 * w.pad - w.side,
    h: w.h - 2 * w.pad - w.top - w.strip,
  };
}
export function contentBox(layout: Layout): Box {
  const m = mainBox(layout);
  const p = geo(layout).win.mainPad;
  return { x: m.x + p, y: m.y + p, w: m.w - 2 * p, h: m.h - 2 * p };
}

// Desktop sidebar tabs: 36 px tall, 2 px apart, under the GEO mark.
export const SIDE = { padTop: 14, brandH: 24, brandGap: 10, tabH: 36, tabGap: 2, padX: 8 };
export function desktopTabCenter(i: number): { x: number; y: number } {
  const w = DESKTOP.win;
  const top = w.y + w.pad + w.top + SIDE.padTop + SIDE.brandH + SIDE.brandGap;
  return { x: w.x + w.pad + SIDE.padX + 46, y: top + i * (SIDE.tabH + SIDE.tabGap) + SIDE.tabH / 2 };
}

// Phone tab strip: five tabs; the active one is wider and shows its label.
export const STRIP = { pad: 5, gap: 4, wIcon: 46, wActive: 130 };
export function phoneTabWidths(activeness: number[]): number[] {
  return activeness.map((a) => STRIP.wIcon + (STRIP.wActive - STRIP.wIcon) * a);
}
export function phoneTabCenter(i: number, activeness: number[]): { x: number; y: number } {
  const w = PHONE.win;
  const widths = phoneTabWidths(activeness);
  let x = w.x + w.pad + STRIP.pad;
  for (let k = 0; k < i; k++) x += widths[k] + STRIP.gap;
  return { x: x + Math.min(widths[i], STRIP.wIcon) / 2 + 2, y: w.y + w.pad + w.top + w.strip / 2 };
}
