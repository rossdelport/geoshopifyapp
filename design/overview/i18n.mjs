/* eslint-env node */
// The home page in other languages (usegeo.app/de, /fr, /nl, /es, /it). assemble.mjs builds the English page, then
// this turns a copy of it into each language from design/overview/i18n/<lang>.json, so the English parts stay the
// one source. The build stops if any English text is left untranslated, so a new English line can't slip through.
//
// A language file has:
//   meta:  lang, locale, path, title, description, money (prefix, suffix, sep) and legal (the company details line)
//   text:  English text (as it appears between tags, spaces squeezed) or attribute value -> translation
//   js:    exact pieces of the page's script -> translation (each must be found)
// keep.json lists text that is the same in every language (brand names, AI names, sample domains).
import fs from 'fs';
import path from 'path';

const ATTRS = ['aria-label', 'placeholder', 'alt', 'title', 'data-m', 'data-y', 'aria-valuetext'];
const norm = (s) => s.replace(/\s+/g, ' ').trim();

export function languages(dir) {
  const d = path.join(dir, 'i18n');
  const keep = new Set(JSON.parse(fs.readFileSync(path.join(d, 'keep.json'), 'utf8')));
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith('.json') && f !== 'keep.json')
    .sort()
    .map((f) => ({ ...JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')), keep }));
}

/** The <link rel="alternate"> tags that tell search engines which page is which language. */
export function hreflangTags(langs) {
  return [
    '<link rel="alternate" hreflang="en" href="https://usegeo.app/">',
    ...langs.map((l) => `<link rel="alternate" hreflang="${l.meta.lang}" href="https://usegeo.app/${l.meta.path}">`),
    '<link rel="alternate" hreflang="x-default" href="https://usegeo.app/">',
  ].join('\n');
}

/** The English live page (with hreflang tags) -> the same page in one language. */
export function translatePage(site, l) {
  const { meta, text, js, keep } = l;
  const missing = new Set();
  const used = new Set();
  const tr = (en) => {
    const k = norm(en);
    if (!/[A-Za-z]/.test(k) || keep.has(k)) return null;
    if (Object.prototype.hasOwnProperty.call(text, k)) {
      used.add(k);
      return text[k];
    }
    missing.add(k);
    return null;
  };

  // 1. No explainer video on these pages (its section and its script).
  let page = cut(site, '<!-- 11v-video.html -->', '<!-- 12-engines.html -->');
  page = cut(page, '// 11v-video.js', '// 12-engines.js');

  // 2. The head: language, title, description, own address, Open Graph locale.
  const desc = esc(meta.description);
  page = page
    .replace('<html lang="en">', `<html lang="${meta.lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${desc}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(meta.title)}">`)
    .replace('<link rel="canonical" href="https://usegeo.app/">', `<link rel="canonical" href="https://usegeo.app/${meta.path}">`)
    .replace('<meta property="og:url" content="https://usegeo.app/">', `<meta property="og:url" content="https://usegeo.app/${meta.path}">\n<meta property="og:locale" content="${meta.locale}">`)
    .replace('<script>window.GEO_LIVE=true</script>', `<script>window.GEO_LIVE=true;window.GEO_LANG="${meta.lang}"</script>`);

  // 4. Body text and attributes, outside scripts and styles.
  const bodyAt = page.indexOf('<body>');
  const head = page.slice(0, bodyAt);
  const body = page
    .slice(bodyAt)
    .split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/)
    .map((seg) => {
      if (/^<(script|style)/.test(seg)) return seg;
      return seg
        .replace(/>([^<]+)</g, (m, t) => {
          // A bare sample amount like "$4,820" (the app demo, the value slider): same number, in euros.
          const amount = norm(t).match(/^\$(\d[\d,]*)$/);
          if (amount) return `>${fmtMoney(Number(amount[1].replace(/,/g, '')), meta.money)}<`;
          const out = tr(t);
          if (out === null) return m;
          const lead = t.match(/^\s*/)[0];
          const tail = t.match(/\s*$/)[0];
          return `>${lead}${out}${tail}<`;
        })
        .replace(new RegExp(`\\s(${ATTRS.join('|')})="([^"]*)"`, 'g'), (m, a, v) => {
          const out = tr(v);
          return out === null ? m : ` ${a}="${out.replace(/"/g, '&quot;')}"`;
        });
    })
    .join('');
  page = head + body;

  // 4b. The company details line under the copyright (an Impressum / mentions légales / aviso legal).
  const copy = `<p>${text['© 2026 GEO · Made for Shopify stores worldwide']}</p>`;
  if (!page.includes(copy)) throw new Error(`i18n ${meta.lang}: footer copyright line not found`);
  page = page.replace(copy, `${copy}\n      <p class="foot-legal">${esc(meta.legal.label)}: ${esc(meta.legal.details)} · <a href="mailto:${meta.legal.email}">${meta.legal.email}</a></p>`);

  // 5. Text the scripts write (pieces of code, each must be found), then money: euros, local thousands separator.
  const scriptAt = page.lastIndexOf('<script>');
  let script = page.slice(scriptAt);
  for (const [en, out] of Object.entries(js)) {
    if (!script.includes(en)) throw new Error(`i18n ${meta.lang}: script text not found: ${en}`);
    script = script.split(en).join(out);
  }
  const { prefix, suffix, sep } = meta.money;
  const grp = `.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ${JSON.stringify(sep)})`;
  const money = [
    [`return '$' + String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');`, `return ${JSON.stringify(prefix)} + String(Math.round(n))${grp} + ${JSON.stringify(suffix)};`],
    [`function commas(n) { return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }`, `function commas(n) { return String(Math.round(n))${grp}; }`],
    [`aud: function (n) { return '$' + commas(n); }`, `aud: function (n) { return ${JSON.stringify(prefix)} + commas(n) + ${JSON.stringify(suffix)}; }`],
  ];
  for (const [en, out] of money) {
    if (!script.includes(en)) throw new Error(`i18n ${meta.lang}: money code not found: ${en}`);
    script = script.split(en).join(out);
  }
  page = page.slice(0, scriptAt) + script;

  if (missing.size) throw new Error(`i18n ${meta.lang}: ${missing.size} English text(s) have no translation:\n  ${[...missing].join('\n  ')}`);
  const unused = Object.keys(text).filter((k) => !used.has(k));
  if (unused.length) throw new Error(`i18n ${meta.lang}: translations for text that is no longer on the page:\n  ${unused.join('\n  ')}`);
  if (page.includes('—')) throw new Error(`i18n ${meta.lang}: an em dash crept in (house rule: none)`);
  return page;
}

function fmtMoney(n, { prefix, suffix, sep }) {
  return prefix + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep) + suffix;
}

function cut(s, from, to) {
  const a = s.indexOf(from);
  const b = s.indexOf(to);
  if (a < 0 || b < 0 || b < a) throw new Error(`i18n: could not find ${from} .. ${to}`);
  return s.slice(0, a) + s.slice(b);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
