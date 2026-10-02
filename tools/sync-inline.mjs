#!/usr/bin/env node
/**
 * Copy the dictionaries back into the AUTHORED files after a copy rewrite.
 *
 *   node tools/sync-inline.mjs
 *
 * Why this exists (2026-09-27 카피 전면 개정): prerender.mjs builds every
 * shipped page FROM src/ + t-<code>.js, but src/ itself carries the Korean
 * defaults inline — what a crawler and a no-JS reader of "/" get — and
 * check-content [3] holds them equal to t-ko.js. prerender only rewrites those
 * defaults when an app FACT moves (syncFacts). A sentence rewritten in t-ko.js
 * therefore left src/ behind, and there was no tool for it: 240 keys by hand is
 * how the inline copy and the dictionary drift apart.
 *
 * What it writes, and nothing else:
 *   1. src/<page> and 404.html — every [data-i18n] inner text, every
 *      data-i18n-attr value, every RunvisT()/announce() literal fallback and
 *      the faqld/appld/pageld JSON-LD, from t-ko.js (the same substitutions
 *      prerender.render() makes for the five other languages).
 *   2. src/index.html's `var C={…}` boot object — the hero copy inlined for
 *      the five non-Korean languages so it paints before i18n.js arrives —
 *      from each language's dictionary (check-content [23]).
 * It never adds or removes a binding; a key missing from t-ko.js is left as is.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, CODES, PAGES, srcPath, loadDicts, attrEscape,
  findI18nElements, findI18nAttrs, spliceAll, faqLd, appLd, pageLd, readLd,
} from './i18n-lib.mjs';

const dicts = loadDicts();
const ko = dicts.ko;
let touched = 0;

function syncKorean(file, page) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  const edits = [];
  for (const el of findI18nElements(html)) {
    const v = ko[el.key];
    if (v != null && html.slice(el.innerStart, el.innerEnd) !== v) {
      edits.push({ start: el.innerStart, end: el.innerEnd, text: v });
    }
  }
  for (const a of findI18nAttrs(html)) {
    const v = ko[a.key];
    if (v == null) continue;
    const want = attrEscape(v);
    if (html.slice(a.valueStart, a.valueEnd) !== want) {
      edits.push({ start: a.valueStart, end: a.valueEnd, text: want });
    }
  }
  html = spliceAll(html, edits);
  html = html.replace(/(RunvisT|announce)\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g, (whole, fn, key) => {
    const v = ko[key];
    if (v == null) return whole;
    if (v.includes('</')) throw new Error(`${file}: ${key} would close the <script>`);
    return `${fn}('${key}', '${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`;
  });
  if (page) {
    // Keep each block's own leading/trailing whitespace — the pages were
    // authored with different wrapping, and a whitespace-only rewrite is noise.
    const putLd = (id, node) => {
      const at = readLd(html, id);
      if (!at || !node) return;
      const inner = html.slice(at.start, at.end);
      const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
      html = html.slice(0, at.start) + lead + JSON.stringify(node) + trail + html.slice(at.end);
    };
    putLd('faqld', readLd(html, 'faqld') && faqLd(ko, 'ko'));
    putLd('appld', readLd(html, 'appld') && appLd(ko, 'ko'));
    putLd('pageld', pageLd(ko, 'ko', page));
  }
  if (html !== before) {
    fs.writeFileSync(file, html);
    touched++;
    console.log(`  ${path.relative(ROOT, file)}: ${edits.length} binding(s) + literals/LD`);
  }
}

for (const page of PAGES) syncKorean(srcPath(page), page);
syncKorean(path.join(ROOT, '404.html'), null);

// ---- the boot object ------------------------------------------------------
{
  const file = srcPath('index.html');
  const html = fs.readFileSync(file, 'utf8');
  const m = /var C=(\{[\s\S]*?\});\n/.exec(html);
  if (!m) throw new Error('src/index.html: no `var C={…};` boot object');
  const obj = JSON.parse(m[1]);
  let changed = 0;
  for (const c of CODES.filter(c => c !== 'ko')) {
    for (const group of ['h', 'm']) {
      for (const key of Object.keys(obj[c]?.[group] || {})) {
        const v = dicts[c][key];
        if (v != null && obj[c][group][key] !== v) { obj[c][group][key] = v; changed++; }
      }
    }
  }
  if (changed) {
    const next = JSON.stringify(obj);
    if (next.includes('</script')) throw new Error('boot object would close the <script>');
    fs.writeFileSync(file, html.slice(0, m.index) + 'var C=' + next + ';\n' + html.slice(m.index + m[0].length));
    touched++;
    console.log(`  src/index.html boot object: ${changed} value(s)`);
  }
}
console.log(touched ? `sync-inline: ${touched} file(s) written` : 'sync-inline: already in step');
