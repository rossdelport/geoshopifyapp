// Where the pointer (desktop) and the tap dot (phone) go, in video coordinates. Measured from the rendered
// screens with `node measure.mjs MemberTour <frames>` (see README), so the pointer lands on the real buttons.
// Tabs come from geometry.ts.
import { desktopTabCenter, Layout, phoneTabCenter } from "./geometry";
import { phoneActiveness } from "./AppWindow";
import { CLICK } from "./timeline";

export type Pt = { x: number; y: number };
export type Targets = {
  start: Pt;
  fixesTab: Pt;
  approve: Pt;
  undo: Pt;
  outreachTab: Pt;
  pitchRow: Pt;
  copyRest: Pt;
  questionsTab: Pt;
  weeklyRest: Pt;
  dashboardTab: Pt;
  moneyRest: Pt;
};

const MEASURED: Record<Layout, Omit<Targets, "fixesTab" | "outreachTab" | "questionsTab" | "dashboardTab">> = {
  desktop: {
    start: { x: 980, y: 600 },
    approve: { x: 402, y: 504 }, // button 308..508 x 481..521
    undo: { x: 572, y: 509 }, // button 518..608 x 481..521
    pitchRow: { x: 770, y: 342 }, // row header 660..1164 x 310..371
    copyRest: { x: 1012, y: 526 }, // "Copy email" 867..994 x 496..534
    weeklyRest: { x: 932, y: 402 },
    moneyRest: { x: 900, y: 704 },
  },
  phone: {
    start: { x: 200, y: 500 },
    approve: { x: 135, y: 541 }, // button 49..221 x 523..559
    undo: { x: 272, y: 541 }, // button 231..314 x 523..559
    pitchRow: { x: 120, y: 471 }, // row 47..343 x 451..492
    copyRest: { x: 270, y: 590 },
    weeklyRest: { x: 200, y: 500 },
    moneyRest: { x: 200, y: 500 },
  },
};

export function targets(layout: Layout): Targets {
  const m = MEASURED[layout];
  if (layout === "desktop") {
    return { ...m, fixesTab: desktopTabCenter(3), outreachTab: desktopTabCenter(4), questionsTab: desktopTabCenter(1), dashboardTab: desktopTabCenter(0) };
  }
  // phone tabs move as the active one widens, so take each tab's place just before its tap
  const at = (i: number, f: number) => phoneTabCenter(i, phoneActiveness(f - 1));
  return {
    ...m,
    fixesTab: at(3, CLICK.fixesTab),
    outreachTab: at(4, CLICK.outreachTab),
    questionsTab: at(1, CLICK.questionsTab),
    dashboardTab: at(0, CLICK.dashboardTab),
  };
}
