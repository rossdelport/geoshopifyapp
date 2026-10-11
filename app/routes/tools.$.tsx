import type { MetaFunction } from "react-router";
import { data } from "react-router";
import { AllToolLinks, ToolHero, ToolShell } from "../components/tool-ui";
import { HUB } from "../lib/tools/registry";
import { pageMeta } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";

// Any /tools/* address that isn't a tool: a real 404 (status and noindex) in the site's frame, with every
// tool linked, so a typo or an old link still leads somewhere useful.

export const loader = () =>
  data(null, { status: 404, headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } });

export const headers = toolHeaders;

export const meta: MetaFunction = () =>
  pageMeta({
    path: HUB.path,
    title: "We couldn't find that tool | GEO",
    description: "This page doesn't exist. See all of GEO's free tools for Shopify stores.",
    noindex: true,
  });

export default function ToolNotFound() {
  return (
    <ToolShell
      page={{ name: HUB.name, path: "/tools/not-found" }}
      hero={<ToolHero h1="We couldn't find that tool." intro="It may have moved, or the address has a typo. Here are all our free tools." />}
      result={<AllToolLinks />}
    />
  );
}
