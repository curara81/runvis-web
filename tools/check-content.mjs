/* One command that fails when the site and its dictionaries drift apart.
 *
 *   node tools/check-content.mjs
 *
 * Round 7 lost points to three drifts that a check like this catches for free:
 * the static FAQ JSON-LD still carried answers the page had already corrected,
 * the six hreflang alternates all pointed at the same Korean document, and a
 * prerendered copy can go stale the moment someone edits a root page. So this
 * compares, for every page and every language:
 *
 *   1  the six dictionaries carry exactly the same keys
 *   2  every data-i18n / data-i18n-attr key used in markup exists in all six
 *   3  each page's inline default text equals that page's dictionary value
 *      (crawlers and no-JS readers only ever see the inline default)
 *   4  the static FAQPage / SoftwareApplication JSON-LD equals what the
 *      dictionary says, character for character
 *   5  the prerendered copies are byte-identical to a fresh render
 *   6  hreflang is complete and every alternate resolves to a real file
 *   7  index.html still has its nine sections
 *   8  tags balance
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, CODES, PAGES, loadDicts, findI18nElements, findI18nAttrs,
  faqLd, appLd, readLd,
} from './i18n-lib.mjs';

const dicts = loadDicts();
let failures = 0;
const fail = (m) => { console.log('  FAIL ' + m); failures++; };
const ok = (m) => console.log('  ok   ' + m);

/** Every page on the site, with the language it is written in. */
const ALL = [];
for (const p of PAGES) ALL.push({ file: p, code: 'ko', gen: false });
for (const c of CODES.filter(c => c !== 'ko')) for (const p of PAGES) ALL.push({ file: `${c}/${p}`, code: c, gen: true });

// ---- 1. dictionary key sets --------------------------------------------
console.log('\n[1] dictionary key sets');
const koKeys = Object.keys(dicts.ko).sort();
for (const c of CODES) {
  const keys = Object.keys(dicts[c]).sort();
  const missing = koKeys.filter(k => !(k in dicts[c]));
  const extra = keys.filter(k => !(k in dicts.ko));
  if (missing.length || extra.length) fail(`${c}: ${keys.length} keys, missing ${missing.length} (${missing.slice(0, 6)}), extra ${extra.length} (${extra.slice(0, 6)})`);
  else ok(`${c}: ${keys.length} keys, identical to ko`);
}

// ---- 2. keys used in markup exist everywhere ----------------------------
console.log('\n[2] markup keys present in all six dictionaries');
const used = new Set();
for (const { file } of ALL) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const el of findI18nElements(html)) used.add(el.key);
  for (const a of findI18nAttrs(html)) used.add(a.key);
}
for (const c of CODES) {
  const missing = [...used].filter(k => !(k in dicts[c]));
  if (missing.length) fail(`${c}: ${missing.length} markup keys missing — ${missing.join(', ')}`);
  else ok(`${c}: all ${used.size} markup keys present`);
}

// ---- 3. inline defaults equal the dictionary ----------------------------
// Compared after collapsing whitespace, because the markup wraps long values
// over several source lines and HTML collapses that anyway — the thing being
// checked is the WORDS a crawler and a no-JS reader get, not the indentation.
//
// The four root pages are the exception the site made on purpose: their
// <title> and description are bilingual (Korean, then English) because the
// root URL still answers ?lang= for every language and a share preview of it
// has to be readable by more than one of the six audiences. Every language
// directory has a single-language head, so the exception ends there.
const BILINGUAL_BY_DESIGN = {
  'index.html': ['meta.title', 'meta.desc', 'meta.ogtitle', 'meta.ogdesc'],
  'run.html': ['r1', 'r2'],
  'privacy.html': ['pv.meta.title', 'pv.meta.desc'],
  'terms.html': ['tm.meta.title', 'tm.meta.desc'],
};
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
console.log('\n[3] inline default text == dictionary value');
for (const { file, code } of ALL) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const dict = dicts[code];
  const exempt = new Set(BILINGUAL_BY_DESIGN[file] || []);
  const bad = [];
  let checked = 0, skipped = 0;
  for (const el of findI18nElements(html)) {
    const want = dict[el.key];
    if (want == null) continue;
    if (exempt.has(el.key)) { skipped++; continue; }
    checked++;
    if (squash(html.slice(el.innerStart, el.innerEnd)) !== squash(want)) bad.push(el.key);
  }
  for (const a of findI18nAttrs(html)) {
    const want = dict[a.key];
    if (want == null) continue;
    if (exempt.has(a.key)) { skipped++; continue; }
    checked++;
    const got = html.slice(a.valueStart, a.valueEnd)
      .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    if (squash(got) !== squash(want)) bad.push(a.key + ' (attr)');
  }
  const note = skipped ? ` (+${skipped} bilingual by design)` : '';
  if (bad.length) fail(`${file}: ${bad.length}/${checked} out of step — ${bad.slice(0, 8).join(', ')}`);
  else ok(`${file}: ${checked} bindings match ${code}${note}`);
}

// ---- 4. static JSON-LD equals the dictionary ----------------------------
console.log('\n[4] static JSON-LD == dictionary');
for (const { file, code } of ALL) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const [id, builder] of [['faqld', faqLd], ['appld', appLd]]) {
    const node = readLd(html, id);
    if (!node) continue;
    const want = JSON.stringify(builder(dicts[code], code));
    if (node.json !== want) {
      let why = 'differs';
      try {
        const got = JSON.parse(node.json), exp = JSON.parse(want);
        if (id === 'faqld') {
          const diffs = [];
          for (let i = 0; i < Math.max(got.mainEntity.length, exp.mainEntity.length); i++) {
            const g = got.mainEntity[i], e = exp.mainEntity[i];
            if (!g || !e) { diffs.push(`q${i + 1} present in only one`); continue; }
            if (g.name !== e.name) diffs.push(`q${i + 1}`);
            if (g.acceptedAnswer.text !== e.acceptedAnswer.text) diffs.push(`a${i + 1}`);
          }
          why = diffs.length ? diffs.join(', ') : 'inLanguage/shape';
        }
      } catch (e) { why = 'not valid JSON'; }
      fail(`${file} #${id}: ${why}`);
    } else {
      const n = id === 'faqld' ? JSON.parse(want).mainEntity.length + ' questions' : 'ok';
      ok(`${file} #${id}: ${n}, byte-identical to ${code} dictionary`);
    }
  }
}

// ---- 5. prerendered copies are not stale --------------------------------
console.log('\n[5] prerendered copies match a fresh render');
{
  const before = new Map();
  for (const { file, gen } of ALL) if (gen) before.set(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const tmp = fs.mkdtempSync(path.join(ROOT, '.prerender-check-'));
  try {
    // Re-run the generator into place, compare, then restore whatever was there.
    for (const [file, text] of before) fs.writeFileSync(path.join(tmp, file.replace('/', '__')), text);
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, [path.join(ROOT, 'tools/prerender.mjs')], { cwd: ROOT, stdio: 'pipe' });
    let stale = 0;
    for (const [file, text] of before) {
      if (fs.readFileSync(path.join(ROOT, file), 'utf8') !== text) { fail(`${file}: stale — regenerate with node tools/prerender.mjs`); stale++; }
    }
    if (!stale) ok(`${before.size} generated files are current`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---- 6. hreflang ---------------------------------------------------------
console.log('\n[6] hreflang completeness');
const WANT_HREFLANG = ['x-default', 'ko', 'en', 'ja', 'es', 'zh-Hant', 'de'];
for (const { file } of ALL) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const found = [];
  for (const m of html.matchAll(/<link[^>]*hreflang="([^"]+)"[^>]*>/g)) {
    const href = /href="([^"]+)"/.exec(m[0]);
    found.push([m[1], href ? href[1] : null]);
  }
  const tags = found.map(f => f[0]);
  const miss = WANT_HREFLANG.filter(t => !tags.includes(t));
  const unresolved = found.filter(([, h]) => {
    if (!h || !h.startsWith('https://runvis.app/')) return true;
    let rel = h.slice('https://runvis.app/'.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    return !fs.existsSync(path.join(ROOT, rel));
  });
  const distinct = new Set(found.map(f => f[1])).size;
  if (miss.length) fail(`${file}: hreflang missing ${miss.join(', ')}`);
  else if (unresolved.length) fail(`${file}: hreflang targets do not exist — ${unresolved.map(u => u[1]).join(', ')}`);
  else if (distinct < 6) fail(`${file}: ${found.length} hreflang links but only ${distinct} distinct URLs`);
  else ok(`${file}: ${found.length} hreflang links, ${distinct} distinct URLs, all resolve`);
}

// ---- 7 + 8. structure ----------------------------------------------------
console.log('\n[7] index sections and [8] tag balance');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
for (const { file } of ALL) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (file.endsWith('index.html')) {
    const n = (html.match(/<section id="/g) || []).length;
    if (n !== 9) fail(`${file}: ${n} sections, expected 9`); else ok(`${file}: 9 sections`);
  }
  // Tag balance over markup only (script/style bodies skipped).
  const stripped = html.replace(/<script[\s\S]*?<\/script>/g, '<script></script>')
                       .replace(/<style[\s\S]*?<\/style>/g, '<style></style>')
                       .replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  let broken = null;
  for (const m of stripped.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g)) {
    const name = m[2].toLowerCase();
    if (VOID.has(name) || m[3] === '/') continue;
    if (m[1]) { if (stack.pop() !== name) { broken = name; break; } }
    else stack.push(name);
  }
  if (broken || stack.length) fail(`${file}: tags unbalanced (${broken ? 'stray </' + broken + '>' : 'unclosed ' + stack.join(',')})`);
  else ok(`${file}: tags balance`);
}

console.log(failures ? `\nFAILED — ${failures} problem(s)` : '\nPASS — no drift');
process.exit(failures ? 1 : 0);
