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
const files = fs.readdirSync(parts).sort().filter((f) => !only || only.some((p) => f.startsWith(p)));
const read = (f) => fs.readFileSync(path.join(parts, f), 'utf8').trim();
const css = [fs.readFileSync(path.join(dir, 'base.css'), 'utf8').trim(), ...files.filter((f) => f.endsWith('.css')).map((f) => `/* ${f} */\n${read(f)}`)].join('\n\n');
const html = files.filter((f) => f.endsWith('.html')).map((f) => `<!-- ${f} -->\n${read(f)}`).join('\n\n');
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
// Same page as a proper HTML document; images come from /home/img/, the sign-up buttons
// go to the Shopify install (log in) page, and window.GEO_LIVE lets the hero check form post to /check.
if (!only && outName === 'index.html') {
  const root = path.join(dir, '..', '..');
  const head = out.slice(0, out.indexOf('<div class="page">')).trim();
  const body = out.slice(out.indexOf('<div class="page">'));
  const site = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Shoppers ask ChatGPT, Gemini and Perplexity what to buy. GEO shows whether AI recommends your Shopify store, writes the fixes, and counts the orders AI sends you.">
<link rel="icon" href="/favicon.ico">
<style>[hidden]{display:none!important}</style>
<script>window.GEO_LIVE=true</script>
${head.replace('<title>GEO Overview</title>', '<title>GEO · The free sales channel your store is missing</title>')}
</head>
<body>
${body}</body>
</html>
`
    .replaceAll('src="img/', 'src="/home/img/')
    .replace(/(<a class="btn[^"]*" href=)"#pricing"/g, '$1"/auth/login"')
    .replace('href="https://geo-shopify-app-production.up.railway.app/privacy" target="_blank" rel="noopener"', 'href="/privacy"');
  fs.mkdirSync(path.join(root, 'app', 'home'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app', 'home', 'home.html'), site);

  const imgOut = path.join(root, 'public', 'home', 'img');
  fs.rmSync(imgOut, { recursive: true, force: true });
  fs.mkdirSync(imgOut, { recursive: true });
  const used = [...new Set([...out.matchAll(/src="img\/([^"]+)"/g)].map((m) => m[1]))];
  // Images other pages load from /home/img/ even when the home page doesn't use them
  // (the free product check pages: app/components/check-ui.tsx).
  const extra = ['clay-magnifier.jpg', 'clay-bubble.png', 'clay-bag.png', 'clay-storefront.jpg'].filter((f) => !used.includes(f));
  for (const f of [...used, ...extra]) fs.copyFileSync(path.join(dir, 'img', f), path.join(imgOut, f));
  console.log(`app/home/home.html: ${(site.length / 1024).toFixed(0)} KB, ${used.length} images used, ${used.length + extra.length} copied to public/home/img`);
}
