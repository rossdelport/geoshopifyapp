import "./global.css";
import "./fonts"; // starts loading the site's fonts; every render waits for them
import React from "react";
import { Composition, Still } from "remotion";
import { FontSpecimen } from "./FontSpecimen";
import { TestCard } from "./TestCard";
import { Explainer, EXPLAINER_DURATION, EXPLAINER_FPS } from "./explainer/Explainer";
import { MemberTour } from "./tour/MemberTour";
import { DURATION, FPS } from "./tour/timeline";

// Desktop videos: 1280x800 at 30 fps, rendered at scale 1.
// Phone videos: designed at 390x640 CSS pixels (the page's phone layout) and rendered with --scale=2,
// so the file is 780x1280 and text is drawn at 2x like a phone screenshot, not blown up.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Test" component={TestCard} durationInFrames={90} fps={30} width={1280} height={800} defaultProps={{ layout: "desktop" as const }} />
    <Composition id="TestPhone" component={TestCard} durationInFrames={90} fps={30} width={390} height={640} defaultProps={{ layout: "phone" as const }} />
    {/* The home page video: the member tour (docs/video/storyboard.md). 56 s at 30 fps. */}
    <Composition id="MemberTour" component={MemberTour} durationInFrames={DURATION} fps={FPS} width={1280} height={800} defaultProps={{ layout: "desktop" as const, measure: false }} />
    <Composition id="MemberTourPhone" component={MemberTour} durationInFrames={DURATION} fps={FPS} width={390} height={640} defaultProps={{ layout: "phone" as const, measure: false }} />
    {/* The home page video since 13 Oct 2026: the explainer (docs/video/explainer.md). Desktop only: the page hides
        the video section on phones. */}
    <Composition id="Explainer" component={Explainer} durationInFrames={EXPLAINER_DURATION} fps={EXPLAINER_FPS} width={1280} height={800} />
    <Still id="FontSpecimen" component={FontSpecimen} width={720} height={420} />
  </>
);
