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
