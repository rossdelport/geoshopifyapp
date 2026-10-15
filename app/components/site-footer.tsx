// The footer of every public React page (the free tools, the hub, the stories, the privacy page, and the free
// check pages through CheckShell): links to all free tools and the main site, as plain <a href> links that work
// without JavaScript. The static home page writes the same links by hand (design/overview/parts/45-cta-footer.html);
// test/tools-foundation.test.ts keeps both in step with the registry.
// Styles: app/styles/site-footer.css, imported here so every page that shows the footer gets them.

import "../styles/site-footer.css";
import { HUB, TOOLS } from "../lib/tools/registry";

const SITE_LINKS: [string, string][] = [
  ["Home", "/"],
  ["How it works", "/#how"],
  ["Pricing", "/#pricing"],
  ["Stories", "/stories"],
  ["Blog", "/blog"],
  ["Privacy", "/privacy"],
];

export function SiteFooter() {
  return (
    <footer className="tl-foot">
      <div className="tl-foot-in">
        <nav className="tl-foot-tools" aria-label="Free tools">
          <p className="tl-foot-h">Free tools</p>
          <ul>
            <li>
              <a href={HUB.path}>All free tools</a>
            </li>
            {TOOLS.map((t) => (
              <li key={t.slug}>
                <a href={t.path}>{t.name}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="tl-foot-site" aria-label="GEO">
          <p className="tl-foot-h">GEO</p>
          <ul>
            {SITE_LINKS.map(([label, href]) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="tl-foot-line">GEO · Helps ChatGPT &amp; co recommend your products</p>
      </div>
    </footer>
  );
}
