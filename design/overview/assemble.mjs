/* eslint-env node */
// Build index.html from base.css + parts/*.css + parts/*.html + parts/*.js (sorted by file name).
// Run: node design/overview/assemble.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const parts = path.join(dir, 'parts');
// Optional: --only=20,21 (file-name prefixes) and --out=_part.html for a partial preview.
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const only = arg('only')?.split(',');
const outName = arg('out') || 'index.html';
const root = path.join(dir, '..', '..');
const files = fs.readdirSync(parts).sort().filter((f) => !only || only.some((p) => f.startsWith(p)));
const read = (f) => fs.readFileSync(path.join(parts, f), 'utf8').trim();
// A part's CSS can pull in a stylesheet the React pages share, with a line like /* include: app/styles/story-card.css */.
const withIncludes = (src) =>
  src.replace(/\/\* include: ([\w./-]+) \*\//g, (_, p) => `/* ${p} */\n${fs.readFileSync(path.join(root, p), 'utf8').trim()}`);
const css = [fs.readFileSync(path.join(dir, 'base.css'), 'utf8').trim(), ...files.filter((f) => f.endsWith('.css')).map((f) => `/* ${f} */\n${withIncludes(read(f))}`)].join('\n\n');

// The story cards (11s-stories.html, in place of <!-- STORY_CARDS -->): one per story in app/lib/stories/stories.json,
// in its order, read here with fs so the home page and the /stories pages share one source. Written twice so the
// moving row can loop: the second copy is hidden from screen readers and skipped by the keyboard. The same card as
// StoryCard in app/components/story-ui.tsx (styles: app/styles/story-card.css). The Shopify bag only shows for
// stores we checked run on Shopify (onShopify).
const stories = JSON.parse(fs.readFileSync(path.join(root, 'app', 'lib', 'stories', 'stories.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cardArrow = '<svg class="sc-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
function storyCardHtml(s, copy) {
  const wide = s.logoShape === 'wide';
  const shop = s.onShopify ? '<img class="sc-shop" src="img/logos/shopify.svg" alt="Shopify store" width="22" height="22" decoding="async">' : '';
  const logo = `<span class="sc-logo${wide ? ' is-wide' : ''}"><img src="img/${esc(s.logo)}" alt="" width="${wide ? 76 : 28}" height="${wide ? 20 : 28}" decoding="async"></span>`;
  return `<li><a class="story-card${s.onShopify ? ' is-shopify' : ''}" href="/stories/${esc(s.slug)}"${copy ? ' tabindex="-1"' : ''}>`
    + `<span class="sc-head">${esc(s.cardHeadline)}</span>${shop}<span class="sc-foot">${logo}<span class="sc-name">${esc(s.brand)}</span>${cardArrow}</span></a></li>`;
}
const storyGroup = (copy) =>
  `<ul class="stories-group" role="list"${copy ? ' aria-hidden="true"' : ''}>\n${stories.map((s) => storyCardHtml(s, copy)).join('\n')}\n</ul>`;

const html = files
  .filter((f) => f.endsWith('.html'))
  .map((f) => `<!-- ${f} -->\n${read(f)}`)
  .join('\n\n')
  .replace('<!-- STORY_CARDS -->', `${storyGroup(false)}\n${storyGroup(true)}`);
const js = files.filter((f) => f.endsWith('.js')).map((f) => `// ${f}\n${read(f)}`).join('\n\n');
const out = `<title>GEO Overview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap">
<style>
${css}
</style>

<div class="page">
${html}
</div>
${js ? `<script>\n${js}\n</script>` : ''}
`;
fs.writeFileSync(path.join(dir, outName), out);
console.log(`${outName}: ${(out.length / 1024).toFixed(0)} KB from ${files.length} part files`);

// Full build only: also write the live home page served at "/" by app/routes/_index/route.tsx.
// Same page as a proper HTML document; images come from /home/img/, and window.GEO_LIVE lets the waitlist popup
// post to /waitlist (the design preview shows the "on the waitlist" screen without saving).
if (!only && outName === 'index.html') {
  const head = out.slice(0, out.indexOf('<div class="page">')).trim();
  const body = out.slice(out.indexOf('<div class="page">'));
  // The page head for search engines, link previews and AI assistants: one canonical address (www and the
  // Railway address also serve this page), Open Graph tags, and who GEO is as JSON-LD. The Organization node is
  // the same as ORG_NODE in app/lib/tools/seo.ts (test/tools-foundation.test.ts checks they match).
  const title = 'GEO · Get your products recommended by AI';
  const description = 'Shoppers ask ChatGPT, Gemini and Perplexity what to buy. GEO helps your Shopify products get recommended in those AI answers, then counts the orders it can trace back to AI.';
  const org = { '@type': 'Organization', '@id': 'https://usegeo.app/#org', name: 'GEO', alternateName: 'GEO for Shopify', url: 'https://usegeo.app/', logo: 'https://usegeo.app/apple-touch-icon.png' };
  const website = { '@type': 'WebSite', '@id': 'https://usegeo.app/#website', name: 'GEO', alternateName: 'GEO for Shopify', url: 'https://usegeo.app/', publisher: { '@id': 'https://usegeo.app/#org' } };
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, website] }).replaceAll('<', '\\u003c');
  const site = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${description}">
<link rel="canonical" href="https://usegeo.app/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GEO">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://usegeo.app/">
<meta property="og:image" content="https://usegeo.app/og/home.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A small clay shop with a star in a speech bubble above it">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd}</script>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>[hidden]:not([hidden="until-found"]){display:none!important}</style>
<script>window.GEO_LIVE=true</script>
${head.replace('<title>GEO Overview</title>', `<title>${title}</title>`)}
</head>
<body>
${body}</body>
</html>
`
    .replaceAll('src="img/', 'src="/home/img/')
    .replaceAll('poster="img/', 'poster="/home/img/')
    .replace('href="https://usegeo.app/privacy" target="_blank" rel="noopener"', 'href="/privacy"');
  fs.mkdirSync(path.join(root, 'app', 'home'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app', 'home', 'home.html'), site);

  const imgOut = path.join(root, 'public', 'home', 'img');
  fs.rmSync(imgOut, { recursive: true, force: true });
  fs.mkdirSync(imgOut, { recursive: true });
  const used = [...new Set([...out.matchAll(/(?:src|poster)="img\/([^"]+)"/g)].map((m) => m[1]))];
  // Images other pages load from /home/img/ even when the home page doesn't use them
  // (the free product check pages: app/components/check-ui.tsx).
  // Every story's logo and the Shopify bag (logos/), for the /stories pages (app/components/story-ui.tsx).
  const extra = [
    'clay-magnifier.jpg', 'clay-bubble.png', 'clay-bag.png', 'clay-storefront.jpg',
    ...stories.map((s) => s.logo), 'logos/shopify.svg',
  ].filter((f, i, all) => !used.includes(f) && all.indexOf(f) === i);
  for (const f of [...used, ...extra]) {
    fs.mkdirSync(path.dirname(path.join(imgOut, f)), { recursive: true });
    fs.copyFileSync(path.join(dir, 'img', f), path.join(imgOut, f));
  }
  console.log(`app/home/home.html: ${(site.length / 1024).toFixed(0)} KB, ${used.length} images and videos used, ${used.length + extra.length} copied to public/home/img`);
}
