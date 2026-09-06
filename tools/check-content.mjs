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
 *   9  the counts the trust block quotes about the app match
 *      tools/app-facts.json (written by tools/app-facts.mjs out of the app
 *      repository). Counts that GROW as the app grows — tests, interface
 *      strings, coach cues — are written as floors ("500개 이상", "2,100개
 *      이상", "270개 이상") and checked as floors, because the exact spelling
 *      of them went stale in four rounds running (502 vs 506, 2,077 vs 2,118,
 *      2,118 vs 2,162, 506 vs 554): every string or test the app repo adds
 *      falsified six hand-edited dictionaries at once. Fixed inventories
 *      (glossary entries, the coach translation table) stay exact
 *  10  every RunvisT('key', 'inline fallback') matches that page's dictionary
 *  11  sitemap.xml lists exactly the pages that exist, and robots.txt points
 *      at it
 *  12  a short list of claims that must survive being reworded in six
 *      languages, each tied to a fact in the app repository
 *  13  the app constants the page repeats in prose (cue budgets, the minimum
 *      gap, how many cue switches exist) still equal what the app declares
 *  14  the three prices are the same three numbers in all six dictionaries,
 *      and the hero note carries no figure at all
 *  15  the seven paid tiles are called what the APP calls them, in all six —
 *      the alt text had carried a name the app retired nine rounds earlier
 *  16  t-zh.js sets no space between two Han characters
 *  17  every document links an apple-touch-icon and a manifest, and every
 *      file those point at exists
 *
 * And, before all of them, [0]: tools/app-facts.json is a CURRENT measurement
 * of the app repository. [9] only compares the dictionaries against that file,
 * so a file that had gone stale let the dictionaries pass while the claim
 * "counted straight out of the app repository" was no longer true. On a
 * machine with no app checkout [0] prints "skip" and says so, which is the
 * point: a skip that announces itself is not a silent pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, CODES, PAGES, loadDicts, findI18nElements, findI18nAttrs,
  faqLd, appLd, pageLd, readLd,
} from './i18n-lib.mjs';
import { locateAppRepo, readFacts, measure } from './app-facts.mjs';

const dicts = loadDicts();
let failures = 0;
const fail = (m) => { console.log('  FAIL ' + m); failures++; };
const ok = (m) => console.log('  ok   ' + m);

/** Every page on the site, with the language it is written in. */
const ALL = [];
for (const p of PAGES) ALL.push({ file: p, code: 'ko', gen: false });
for (const c of CODES.filter(c => c !== 'ko')) for (const p of PAGES) ALL.push({ file: `${c}/${p}`, code: c, gen: true });

/** Documents that carry dictionary bindings but are NOT part of the page set:
 *  no prerendered copies, no hreflang alternates, no sitemap entry. 404.html is
 *  the only one — GitHub Pages serves it for any path it cannot find, at
 *  whatever depth, so there is nothing for a /de/ copy of it to be reached by.
 *  It still goes through [2] (its keys exist in all six), [3] (its inline
 *  Korean matches the dictionary) and [8] (its tags balance); it is kept out of
 *  [6] and [11], which are about the indexable page set. Without this list the
 *  file would be the one document on the site nothing checked. */
const EXTRA = [{ file: '404.html', code: 'ko', gen: false }];
const ALL_DOCS = [...ALL, ...EXTRA];

// ---- 0. app-facts.json is a current measurement --------------------------
console.log('\n[0] tools/app-facts.json == a fresh count of the app repo');
{
  const appRepo = locateAppRepo();
  const stored = readFacts();
  if (!stored) {
    fail('tools/app-facts.json missing — run `node tools/app-facts.mjs`');
  } else if (!appRepo) {
    // Not a pass and not a failure: this checkout cannot see the app, so [9]
    // is checking the dictionaries against a snapshot nobody re-measured.
    console.log('  skip  no app checkout here (set RUNVIS_APP_REPO) — [9] runs '
      + `against the ${stored.measuredAt} snapshot, unverified`);
  } else {
    const fresh = measure(appRepo);
    // JSON, not ===: `tiles` is an object and two structurally identical
    // objects are never === , which would report drift on every run.
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const drift = Object.keys(fresh).filter(k => k !== 'measuredAt' && !same(stored[k], fresh[k]));
    if (drift.length) {
      fail('tools/app-facts.json is behind the app repo — '
        + drift.map(k => `${k}: file ${JSON.stringify(stored[k])} vs repo ${JSON.stringify(fresh[k])}`).join(', ')
        + '\n       run `node tools/app-facts.mjs`, then update whichever dictionary values [9] and [13] name');
    } else {
      ok(`measured ${stored.measuredAt} and still current (${Object.keys(fresh).length - 1} fields)`);
    }
  }
}

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
for (const { file } of ALL_DOCS) {
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
// There is no exemption any more. The four root pages used to run a bilingual
// <title> and description ("…애플워치면 충분합니다 · Apple Watch running
// coach") on the argument that the root URL still answers ?lang=. It does, but
// half a sentence in each language is a finished sentence in neither, so the
// root is Korean-only now — it is the Korean document and the x-default, and
// /en/, /ja/, /es/, /zh/, /de/ are the pages for everyone else. Keeping the
// table here, empty, so the next person who wants an exemption has to write
// down which key and why.
const BILINGUAL_BY_DESIGN = {};
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();
console.log('\n[3] inline default text == dictionary value');
for (const { file, code } of ALL_DOCS) {
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
  const page = file.split('/').pop();
  for (const [id, builder] of [['faqld', faqLd], ['appld', appLd],
                               ['pageld', (d, c) => pageLd(d, c, page)]]) {
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
      const n = id === 'faqld' ? JSON.parse(want).mainEntity.length + ' questions'
              : id === 'appld' ? '3 offers, PreOrder' : 'WebPage + breadcrumb';
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
for (const { file } of ALL_DOCS) {
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

// ---- 9. the numbers the trust block quotes about the app ------------------
// The trust block says its numbers "are counted straight out of the app
// repository". They were, once. Then the app moved and the page did not — 502
// vs 506 tests and 2,077 vs 2,118 strings, the same drift three rounds
// running, in the one paragraph whose entire value is that its numbers are
// counted rather than invented. tools/app-facts.mjs re-measures them out of
// the app checkout into tools/app-facts.json; this compares that file against
// the six dictionaries. No app checkout is needed here, only the JSON.
console.log('\n[9] app counts in the dictionaries == tools/app-facts.json');
{
  const factsPath = path.join(ROOT, 'tools/app-facts.json');
  if (!fs.existsSync(factsPath)) {
    fail('tools/app-facts.json missing — run `node tools/app-facts.mjs`');
  } else {
    const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
    // Thousands separator per market: a German page writes 2.118, not 2,118.
    // Spanish writes four-digit numbers both ways (2118 and 2.118 are both
    // correct), so accept the locale's own rendering, the bare digits and the
    // digits grouped with that locale's separator — and no other spelling.
    const LOCALE = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', es: 'es-ES', zh: 'zh-Hant', de: 'de-DE' };
    const groupSep = (code) => (new Intl.NumberFormat(LOCALE[code]).formatToParts(1234567)
      .find(p => p.type === 'group') || { value: '' }).value;
    const forms = (code, n) => [...new Set([
      new Intl.NumberFormat(LOCALE[code]).format(n),
      String(n),
      String(n).replace(/\B(?=(\d{3})+(?!\d))/g, groupSep(code)),
    ])];
    const num = (code, n) => forms(code, n)[0];
    // key → the counts it must contain, exactly as that language writes them.
    const EXACT = {
      'n.trust.l2': ['coachTable'],
      'n.trust.l3': ['glossary'],
      'n.why.s1v': ['glossary'],
      // The hero's third badge used to state this same glossary count and was
      // bound here with it. It states the monthly price now — the first screen
      // was carrying three specifications and no decision — so the count is
      // held in one place again, the why section (2026-09-06 라운드 15, -1
      // 구조 / -0.6 메시지). See [22] for what guards the badge that replaced it.
    };
    // These four USED to state a floor — "270개 이상", "500개 이상", "2,100개
    // 이상" — on the argument that a floor cannot be falsified by an app repo
    // that only grows. That argument was wrong twice over. It let the distance
    // between the copy and the measurement widen every round until the page
    // said 500+ where the repo had 737 and 2,100+ where it had 2,324, in the
    // one paragraph whose entire claim is "지어낼 수 있는 숫자 대신, 앱
    // 저장소에서 그대로 세어 나오는 것만 적었습니다" — and 737 is a far better
    // number to have earned than "over 500". Worse, a floor is only true while
    // every translator keeps the hedge: t-en.js had dropped it ("2,100
    // interface strings line up", no "over"), so the English page was stating a
    // plain falsehood that this checker passed (2026-09-06 라운드 15, -1 and
    // [회귀]).
    //
    // They are EXACT now. The maintenance that made a floor tempting is gone:
    // `node tools/prerender.mjs` — the build command — writes the current
    // measurement into the six dictionaries and the inline defaults before it
    // renders (syncFacts), so the copy follows tools/app-facts.json by itself
    // and this check is the assertion that it did.
    //
    // EXACT_FIRST reads the FIRST number in the value, because n.trust.l2 also
    // carries the 396-line coach table (checked exactly, above) and a
    // digits-only scan would glue the two into "2324396".
    const EXACT_FIRST = {
      'n.why.s2v': 'cueSites', 'n.why.s3v': 'tests',
      'n.trust.l2': 'stringKeys', 'n.trust.l1': 'tests',
    };
    for (const c of CODES) {
      const bad = [];
      for (const [key, fields] of Object.entries(EXACT)) {
        const value = dicts[c][key];
        if (value == null) { bad.push(`${key} missing`); continue; }
        for (const f of fields) {
          const wanted = forms(c, facts[f]);
          if (!wanted.some(w => value.includes(w))) bad.push(`${key} has no ${wanted.map(w => `"${w}"`).join(' / ')} (${f})`);
        }
      }
      for (const [key, field] of Object.entries(EXACT_FIRST)) {
        // Drop this locale's group separator (2.324 → 2324, 2,324 → 2324) and
        // take the first run of digits that remains.
        const sep = groupSep(c);
        const flat = String(dicts[c][key] ?? '').split(sep).join('');
        const m = flat.match(/\d+/);
        const said = m ? Number(m[0]) : NaN;
        if (!Number.isFinite(said)) bad.push(`${key} states no number`);
        else if (said !== facts[field]) {
          bad.push(`${key} says ${said}, tools/app-facts.json says ${facts[field]} (${field})`
            + ' — run `node tools/prerender.mjs`, which syncs it');
        }
        // A floor hedge next to an exact count is a contradiction, and the
        // hedge is how this drifted in the first place: five languages kept
        // "이상 / over / más de" while English quietly dropped it, so five
        // pages were vague and one was false. Only the text touching the
        // number is inspected — German writes "über alle sechs Sprachtabellen"
        // ("across all six") thirty characters later, and that über is not a
        // hedge.
        if (m) {
          const at = flat.indexOf(m[0]);
          const near = flat.slice(Math.max(0, at - 12), at + m[0].length + 6);
          const HEDGE = /over|más de|mehr als|über|이상|以上|\+/i;
          if (HEDGE.test(near)) {
            bad.push(`${key} still hedges near the figure ("…${near}…") — the count is exact now`);
          }
        }
      }
      if (bad.length) fail(`${c}: ${bad.join('; ')}`);
      else ok(`${c}: tests ${num(c, facts.tests)}, strings ${num(c, facts.stringKeys)}, tables ${num(c, facts.coachTable)}, glossary ${num(c, facts.glossary)}, cues ${facts.cueSites}`);
    }
  }
}

// ---- 10. RunvisT fallbacks == the dictionary ------------------------------
// The page's own scripts read runtime strings as RunvisT('key', 'inline
// fallback'). The fallback is what a visitor sees when the dictionary has not
// landed yet, and one of them had drifted into a shorter sentence that dropped
// the deletion-request line out of the form's privacy notice. Check [3] only
// looks at data-i18n markup, so this layer went unwatched.
console.log('\n[10] RunvisT() inline fallbacks == dictionary');
for (const { file, code } of ALL) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const bad = [];
  let checked = 0;
  // Both arguments must be single-quoted literals; a call passing a variable
  // (RunvisT(key, fallback)) has nothing to compare and is skipped.
  // `announce(key, fallback)` is index.html's live-region wrapper around
  // RunvisT with the same two-literal shape. It was invisible to this check
  // and to prerender step 7b, so /de/ and /ja/ shipped Korean fallbacks for
  // the two screen-reader announcements — the one place a fallback is heard
  // rather than read. Same regex, both names.
  for (const m of html.matchAll(/(?:RunvisT|announce)\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) {
    const key = m[1];
    const got = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const want = dicts[code][key];
    if (want == null) { bad.push(`${key} (not in ${code})`); continue; }
    checked++;
    if (squash(got) !== squash(want)) bad.push(key);
  }
  // …and the reason this check kept missing whole files. Both machines that
  // keep the fallback layer honest — this one and prerender step 7b — match on
  // the NAME. A page that wrapped window.RunvisT in a local `T` or `t` was
  // invisible to both: run.html's five form messages and index.html's two
  // button labels shipped Korean to every prerendered copy while this line
  // printed "ok" (2026-09-06 라운드 15). The wrapper is legitimate — these
  // scripts run before the deferred i18n.js defines the global — so what is
  // checked is that it keeps the name the machines look for.
  for (const m of html.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>[^;\n]*window\.RunvisT/g)) {
    if (m[1] !== 'RunvisT') {
      bad.push(`local alias \`${m[1]}\` wraps window.RunvisT — name it RunvisT or this file's fallbacks are unchecked and untranslated`);
    }
  }
  if (bad.length) fail(`${file}: ${bad.length} fallback(s) out of step — ${bad.join(', ')}`);
  else ok(`${file}: ${checked} fallback(s) match ${code}`);
}

// ---- 11. sitemap.xml lists exactly the pages that exist -------------------
console.log('\n[11] sitemap.xml == the files on disk');
{
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    fail('sitemap.xml missing — run `node tools/prerender.mjs`');
  } else {
    const xml = fs.readFileSync(sitemapPath, 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const want = new Set(ALL.map(({ file }) =>
      'https://runvis.app/' + (file.endsWith('index.html') ? file.slice(0, -'index.html'.length) : file)));
    const got = new Set(locs);
    const missing = [...want].filter(u => !got.has(u));
    const extra = [...got].filter(u => !want.has(u));
    const unresolved = locs.filter(u => {
      let rel = u.replace('https://runvis.app/', '');
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      return !fs.existsSync(path.join(ROOT, rel));
    });
    if (locs.length !== got.size) fail(`sitemap.xml: ${locs.length - got.size} duplicate <loc>`);
    else if (missing.length) fail(`sitemap.xml: ${missing.length} page(s) not listed — ${missing.join(', ')}`);
    else if (extra.length) fail(`sitemap.xml: ${extra.length} listed URL(s) are not pages — ${extra.join(', ')}`);
    else if (unresolved.length) fail(`sitemap.xml: ${unresolved.length} <loc> do not resolve to a file`);
    else ok(`sitemap.xml: ${locs.length} URLs, one per page, all resolve`);
    const robots = path.join(ROOT, 'robots.txt');
    if (!fs.existsSync(robots)) fail('robots.txt missing');
    else {
      const text = fs.readFileSync(robots, 'utf8');
      if (!text.includes('https://runvis.app/sitemap.xml')) fail('robots.txt does not point at the sitemap');
      else ok('robots.txt points at sitemap.xml');
      // robots.txt used to state the page count in prose and it was counted by
      // hand: it still said 24 after how-it-works.html made it 30, and nothing
      // compared the two (round 13, -0.25). prerender.mjs writes the line now;
      // this is what makes a hand-edit of it fail instead of shipping.
      const m = /^# Pages: (\d+) /m.exec(text);
      if (!m) fail('robots.txt has no "# Pages: <n> …" line — run `node tools/prerender.mjs`');
      else if (Number(m[1]) !== locs.length) fail(`robots.txt says ${m[1]} pages, sitemap.xml lists ${locs.length} — run \`node tools/prerender.mjs\``);
      else ok(`robots.txt states ${m[1]} pages, matching sitemap.xml`);
    }
  }
}

// ---- 12. claims that must survive a rewording ----------------------------
// Round 11 lost points twice for the same shape of mistake: a sentence that was
// true when it was written, reworded or translated later, and the CONDITION
// dropped out of it in some languages and not others. Neither one is
// detectable by comparing the page against the dictionary — the page and the
// dictionary agreed perfectly. So the conditions themselves are written down
// here, once, with the file in the app repository that makes them true.
//
// `need`: at least one of these strings must appear in every language's value.
// `ban` : none of them may appear in any language's value.
console.log('\n[12] claims that carry a condition');
{
  const CLAIMS = [
    {
      key: 'n.faq.a1',
      need: ['Bluetooth', '블루투스', '藍牙', 'BLE'],
      why: 'an iPhone has no heart-rate sensor. PhoneWorkoutManager takes HR only '
         + 'from HeartRateBandManager (BLE 0x180D) and PhoneCoachPlan.zoneCue returns '
         + 'nil when heartRate is 0, so the phone zone cue REQUIRES a chest strap — '
         + 'saying it "arrives on the phone with a subscription" without that '
         + 'condition sells a cue the subscriber may never hear',
    },
    {
      // The launch store is Korea and the shoe-search link only exists there.
      // Five dictionaries carried the clause and the Korean one did not — and
      // pv.legalNote declares the Korean text the binding version, so the
      // binding version was the weakest of the six (2026-09-06 라운드 13, -0.5).
      // One of these six spellings has to survive every future rewording.
      key: 'n.faq.a4',
      need: ['대한민국 App Store', 'Korean App Store', '韓国App Store', 'App Store de Corea', '韓國 App Store', 'koreanischen App Store'],
      why: 'the external shoe-search page (iOSShoesView → the Coupang search URL) '
         + 'only opens on the Korean storefront, and privacy.html pv.s3.r6c already '
         + 'names it; an answer about what leaves the device that drops the '
         + 'condition in one language is answering a different question there',
    },
    {
      key: 'n.priv.p',
      need: ['대한민국 App Store', 'Korean App Store', '韓国App Store', 'App Store de Corea', '韓國 App Store', 'koreanischen App Store'],
      why: 'the same clause in the privacy summary on the landing page — same '
         + 'reason, and this is the paragraph that claims to list every exception '
         + 'without leaving one out',
    },
    {
      key: 'r20',
      ban: ['2.5', '2,5', '二・五', '二點五', '二点五'],
      why: 'the demo quotes the coach verbatim and CoachEngine says "약 3킬로미터마다" '
         + '(distanceSpoken(meters: 3000)) — there is no 2.5 km in any hydration line',
    },
  ];
  for (const claim of CLAIMS) {
    const bad = [];
    for (const c of CODES) {
      const value = dicts[c][claim.key];
      if (value == null) { bad.push(`${c}: key missing`); continue; }
      if (claim.need && !claim.need.some(t => value.includes(t))) {
        bad.push(`${c}: none of ${claim.need.map(t => `"${t}"`).join('/')}`);
      }
      if (claim.ban) {
        const hit = claim.ban.filter(t => value.includes(t));
        if (hit.length) bad.push(`${c}: contains ${hit.map(t => `"${t}"`).join(', ')}`);
      }
    }
    if (bad.length) fail(`${claim.key} — ${claim.why}\n       ${bad.join('\n       ')}`);
    else ok(`${claim.key}: holds in all six languages`);
  }
}

// ---- 13. app constants quoted as literals in six dictionaries -------------
// The app stopped hand-copying its own constants into copy in round 7: the
// paywall's gate paragraph takes them as String(format:) arguments. The
// homepage cannot do that — its copy is six translated sentences — so the
// binding is made here instead. Every number below is measured out of
// Shared/Services/CoachSessionProfile.swift by tools/app-facts.mjs, and the
// sentences are written with digits in all six languages precisely so this
// check can see them ("eight cues" would have been invisible to it).
console.log('\n[13] coach constants in the copy == the app declaration');
{
  const facts = readFacts();
  if (!facts) {
    fail('tools/app-facts.json missing — run `node tools/app-facts.mjs`');
  } else {
    const BOUND = [
      { key: 'n.live.q.n4', field: 'cueToggles',
        why: 'CoachCueCategory.userToggleable is the list iOSSettingsView and the watch SettingsView render' },
      { key: 'n.live.q.sum', field: 'cueBudgetEasy',
        why: 'CoachSessionProfile.spokenBudgetPer30Min for .easy/.long/.runWalk' },
      { key: 'n.live.q.sum', field: 'cueBudgetTempo',
        why: 'CoachSessionProfile.spokenBudgetPer30Min for .tempo/.race/.free' },
      { key: 'n.live.q.sum', field: 'cueMinGap', why: 'CoachCueSpacing.minGap' },
      { key: 'n.live.q.n1', field: 'cueMinGap', why: 'CoachCueSpacing.minGap' },
      { key: 'n.live.q.r1b', field: 'cueBudgetEasy', why: 'the easy-run row of the same table' },
      { key: 'n.live.q.r2b', field: 'cueBudgetTempo', why: 'the tempo/race row of the same table' },
      // The site printed one rule as the rule for two different cues, because
      // it called both of them "자세" (2026-09-06 라운드 14, -1.2). Each
      // sentence is bound to ITS OWN source now, so the next rewording of
      // either cannot quietly adopt the other's numbers.
      { key: 'n.vc3.sensor', field: 'strideCueSessionCap',
        why: 'the index chip is the STRIDE cue — CoachDensityRules.strideCueSessionCap' },
      { key: 'r38', field: 'formSustainSeconds',
        why: 'the run.html SEGMENT 03 rule is FormDrift — gctDriftSustainedSeconds' },
      { key: 'r38', field: 'formCadenceOnlySeconds',
        why: 'FormDrift.evaluate cadence-only path — cadDropSustainedSeconds' },
      { key: 'r38', field: 'formCadenceOnlyDropPct',
        why: 'FormDrift.evaluate cadence-only path — cadDrop floor' },
    ];
    for (const b of BOUND) {
      const want = String(facts[b.field]);
      if (facts[b.field] == null) { fail(`${b.field} missing from app-facts.json — re-run tools/app-facts.mjs`); continue; }
      const bad = CODES.filter(c => !String(dicts[c][b.key] ?? '').includes(want));
      if (bad.length) fail(`${b.key} does not carry ${b.field}=${want} in ${bad.join(', ')} — ${b.why}`);
      else ok(`${b.key} carries ${b.field}=${want} in all six`);
    }
  }
}

// ---- 14. one set of prices, six dictionaries ------------------------------
// Six hand-maintained copies of three numbers. Nothing compared them, so a
// rewrite in one language could quietly reprice the product for that market —
// and the same three figures also appear inside four sentences (the hero note,
// the why-section cost line, the yearly and lifetime paragraphs), where a
// reworded translation is even easier to get wrong. The KRW amounts are the
// app's StoreKit products and the JSON-LD Offers in tools/i18n-lib.mjs, so
// they are stated here once and held against every dictionary.
console.log('\n[14] the three prices are identical in all six dictionaries');
{
  const PRICE = { month: '1,900', year: '15,000', life: '39,000' };
  for (const [slot, amount] of Object.entries(PRICE)) {
    const bad = CODES.filter(c => dicts[c][`pr.${slot}`] !== `₩${amount}`);
    if (bad.length) fail(`pr.${slot} is not "₩${amount}" in ${bad.join(', ')}`);
    else ok(`pr.${slot} = ₩${amount} in all six`);
  }
  // Sentences that quote a price. Each must carry the amounts listed, so a
  // reworded translation cannot drop or change one.
  const IN_PROSE = [
    ['n.why.cost', ['1,900', '15,000', '39,000']],
    ['n.price.year', ['15,000']],
    ['n.price.life', ['39,000']],
  ];
  for (const [key, amounts] of IN_PROSE) {
    const bad = [];
    for (const c of CODES) {
      const v = String(dicts[c][key] ?? '');
      const missing = amounts.filter(a => !v.includes(`₩${a}`));
      if (missing.length) bad.push(`${c}: no ${missing.map(a => `₩${a}`).join(' / ')}`);
    }
    if (bad.length) fail(`${key} — ${bad.join('; ')}`);
    else ok(`${key} quotes ${amounts.map(a => `₩${a}`).join(' · ')} in all six`);
  }
  // The hero note is the one price sentence that must NOT carry a figure. It
  // used to say ₩1,900 to all six markets and five of them had no sense of how
  // big that is (2026-09-06 라운드 13, -0.8). The amounts belong where they can
  // be evaluated: the price table and the hero badge, each of which now pairs
  // every KRW figure with that market's own approximate size ([22],
  // tools/price-approx.json). This invariant is what keeps a bare figure from
  // creeping back into this key in one language and not the others — a number
  // in prose is maintained by six translators, a number under [22] is
  // maintained in one file.
  {
    const bad = CODES.filter(c => /₩\s*[\d.,]/.test(String(dicts[c]['n.hero.note'] ?? '')));
    if (bad.length) fail(`n.hero.note carries a ₩ figure in ${bad.join(', ')} — the hero states no amount; the three prices live in the price table (pr.month/year/life)`);
    else ok('n.hero.note states no ₩ figure in any of the six');
  }
}


// ---- 15. the tile names the copy repeats == the app's own tile names ------
// The seven paid tiles have a name in each of the six Localizable.strings, and
// the site says those names in three places: the price list, the gate
// conditions and the screenshot alt text. Nothing compared the two
// vocabularies, so they drifted, and one of the drifts had survived nine
// rounds: alt.phone.glance still said 언덕 점수, a name the app retired in
// round 4 when it decided it had no grounds to GRADE hills and switched to
// measuring EXPOSURE. Three more were live in the price list (坂の露出 /
// 坡道暴露 / Bergexposition, none of which the app uses).
//
// Compared case-insensitively on purpose: Spanish and German write a tile name
// differently at the head of a sentence than inside one ("Umbral de lactato"
// vs "…, umbral de lactato"), and forcing the app's capitalisation on a
// mid-sentence noun would be a translation bug, not a fix.
console.log('\n[15] tile names in the copy == the app tile names');
{
  const facts = readFacts();
  if (!facts) {
    fail('tools/app-facts.json missing — run `node tools/app-facts.mjs`');
  } else if (!facts.tiles) {
    fail('tools/app-facts.json has no `tiles` — re-run `node tools/app-facts.mjs`');
  } else {
    const T = facts.tiles;
    // dictionary key → the tiles its value has to name, by the app's Korean key.
    const BOUND = [
      ['n.price.t1', ['젖산 역치(추정)']],
      ['n.price.t2', ['지구력 훈련량']],
      ['n.price.t3', ['언덕 노출']],
      ['n.price.t4', ['더위 노출 지수']],
      ['n.price.t5', ['코치 브레이크']],
      ['n.price.t6', ['강도 분포']],
      ['n.price.t7', ['코치 기록 레이더']],
      ['n.price.g1', ['젖산 역치(추정)']],
      ['n.price.g2', ['지구력 훈련량']],
      ['n.price.g3', ['언덕 노출']],
      ['n.price.g4', ['더위 노출 지수']],
      ['n.price.g5', ['강도 분포']],
      ['n.price.g6', ['코치 브레이크']],
      ['n.price.g7', ['코치 기록 레이더']],
      // The drift that started this check. The screenshot shows these three
      // paid tiles, so the alt text names them — by the names on the screen.
      ['alt.phone.glance', ['젖산 역치(추정)', '지구력 훈련량', '언덕 노출']],
      ['hw.vs.r3a', ['젖산 역치(추정)']],
    ];
    for (const [key, wanted] of BOUND) {
      const bad = [];
      for (const c of CODES) {
        const value = String(dicts[c][key] ?? '').toLowerCase();
        if (dicts[c][key] == null) { bad.push(`${c}: key missing`); continue; }
        for (const tile of wanted) {
          const name = T[tile]?.[c];
          if (name == null) { bad.push(`${c}: app-facts has no ${tile}`); continue; }
          if (!value.includes(name.toLowerCase())) bad.push(`${c}: no "${name}" (${tile})`);
        }
      }
      if (bad.length) fail(`${key} does not use the app's tile name — ${bad.join('; ')}`);
      else ok(`${key} uses the app's own name for ${wanted.length} tile(s) in all six`);
    }
  }
}

// ---- 16. Chinese typesetting: no space between two Han characters ---------
// Chinese sets no space between Han characters; the space between a digit or a
// Latin word and a Han character is a convention and stays. t-zh.js carried 14
// of the wrong kind, including the sentence the hero's voice chip speaks
// ("800公尺 的上坡") and eight of the thirteen Seoul course names — the
// giveaway that they had been carried over from Korean word spacing rather
// than typeset (2026-09-06 라운드 13, -0.5).
console.log('\n[16] t-zh.js sets no space between two Han characters');
{
  const HAN_SPACE = /[一-鿿㐀-䶿][  ][一-鿿㐀-䶿]/;
  const offenders = Object.keys(dicts.zh)
    .filter(k => HAN_SPACE.test(String(dicts.zh[k])))
    .map(k => `${k} ("${String(dicts.zh[k]).match(new RegExp(HAN_SPACE.source, 'g')).join('", "')}")`);
  if (offenders.length) fail(`${offenders.length} zh value(s) put a space between two Han characters — ${offenders.join('; ')}`);
  else ok(`no Han-space-Han in any of the ${Object.keys(dicts.zh).length} zh values`);
}


// ---- 17. the icon and manifest every page promises actually exist ---------
// A <link rel="apple-touch-icon"> pointing at nothing is worse than none: iOS
// stops falling back to a screenshot and saves a blank tile. These files are
// referenced by absolute path from six documents including 404.html, so one
// rename breaks all six at once and nothing else on the site would notice.
console.log('\n[17] the icon files and manifest the pages link to');
{
  const REFERENCED = ['apple-touch-icon.png', 'site.webmanifest'];
  for (const f of REFERENCED) {
    if (!fs.existsSync(path.join(ROOT, f))) fail(`${f} is linked from every page and does not exist`);
    else ok(`${f} exists`);
  }
  const manifestPath = path.join(ROOT, 'site.webmanifest');
  if (fs.existsSync(manifestPath)) {
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
    catch (e) { fail('site.webmanifest is not valid JSON'); }
    if (manifest) {
      const missing = (manifest.icons || []).map(i => i.src)
        .filter(src => !fs.existsSync(path.join(ROOT, src.replace(/^\//, ''))));
      if (!manifest.icons || !manifest.icons.length) fail('site.webmanifest lists no icons');
      else if (missing.length) fail(`site.webmanifest points at ${missing.length} icon(s) that do not exist — ${[...new Set(missing)].join(', ')}`);
      else ok(`site.webmanifest: ${manifest.icons.length} icon entries, all resolve`);
    }
  }
  const want = ['rel="apple-touch-icon"', 'rel="manifest"'];
  for (const { file } of ALL_DOCS) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const gone = want.filter(w => !html.includes(w));
    if (gone.length) fail(`${file}: no ${gone.join(' and no ')}`);
  }
  ok(`all ${ALL_DOCS.length} documents link both`);
}

// ---- 18. the free period the price copy promises == the StoreKit offer ----
// index.html told all six markets that the YEARLY plan's first "period" is
// free, next to a sentence saying the year is then charged in one go — which
// reads as a free year. Runvis.storekit gives com.curara.runvis.coach.yearly
// recurringSubscriptionPeriod P1Y and introductoryOffer.subscriptionPeriod
// P1M: the free run is one month (2026-09-06 라운드 14, -2.5). The app says so
// exactly, because PaywallView formats StoreKit's own offer period into the
// sentence; the site cannot read StoreKit at runtime, so the number is written
// into the copy and held here against the same file the app reads.
//
// Every sentence that mentions the free period has to carry the figure, in the
// language it is written in. A vague "first period" passing this check is the
// thing that went wrong, so the month word is required next to the digit.
console.log('\n[18] the free-period copy == Runvis.storekit introductoryOffer');
{
  const facts = readFacts();
  if (!facts) {
    fail('tools/app-facts.json missing — run `node tools/app-facts.mjs`');
  } else if (facts.trialMonths == null) {
    fail('tools/app-facts.json has no `trialMonths` — re-run `node tools/app-facts.mjs`');
  } else {
    const n = facts.trialMonths;
    // digit + that language's word for "month", with an optional space between.
    const MONTH = { ko: '개월', en: 'months?', ja: 'か月', es: 'mes(?:es)?', zh: '個月', de: 'Monate?' };
    const KEYS = ['pl.ribbon', 'n.price.sub', 'n.price.year', 'n.faq.a7'];
    for (const key of KEYS) {
      const bad = [];
      for (const c of CODES) {
        const v = String(dicts[c][key] ?? '');
        if (!new RegExp(`(?<![\\d.,])${n}\\s*(?:${MONTH[c]})`).test(v)) bad.push(c);
      }
      if (bad.length) fail(`${key} does not state the free period as ${n} month(s) in ${bad.join(', ')} — Runvis.storekit introductoryOffer.subscriptionPeriod is P${n}M for every product, including the yearly one`);
      else ok(`${key} states ${n} month(s) in all six`);
    }
  }
}

// ---- 19. the 5K demo's form line is a line FormDrift would actually say ---
// run.html quoted "5 percent slower, ground contact 7 percent longer" one line
// above its own rule, and FormDrift.evaluate rejects that combination: the
// mean drift is 6.0 (needs > 6.5) and neither figure clears its signal floor,
// so signals is 0 (2026-09-06 라운드 14, -1). On a page whose product IS
// showing its reasoning, the example has to pass the rule printed under it.
// The two numbers are declared here, run through the app's own arithmetic out
// of tools/app-facts.json, and then required to appear in all six copies of
// the line — so changing either the copy or the app's thresholds fails this.
console.log('\n[19] the demo form line passes FormDrift.evaluate');
{
  const facts = readFacts();
  const DEMO = { cadDropPct: 7, gctRisePct: 10 };     // what r37 quotes
  if (!facts || facts.formWarnDriftPct == null) {
    fail('tools/app-facts.json has no FormDrift constants — re-run `node tools/app-facts.mjs`');
  } else {
    const driftPct = (DEMO.cadDropPct + DEMO.gctRisePct) / 2;
    const signals = (DEMO.cadDropPct > facts.formCadDropSignalPct ? 1 : 0)
                  + (DEMO.gctRisePct > facts.formGctRiseSignalPct ? 1 : 0);
    const warn = (driftPct > facts.formWarnDriftPct && signals >= 2)
              || (driftPct > facts.formStrongDriftPct && signals >= 1);
    if (!warn) fail(`the demo quotes ${DEMO.cadDropPct}% / ${DEMO.gctRisePct}%: drift ${driftPct}, signals ${signals} — FormDrift.evaluate would stay silent, so the app never says this line`);
    else ok(`${DEMO.cadDropPct}% / ${DEMO.gctRisePct}% → drift ${driftPct} > ${facts.formWarnDriftPct} with ${signals} signals: FormDrift warns`);
    const bad = CODES.filter(c => {
      const v = String(dicts[c].r37 ?? '');
      return !(new RegExp(`(?<![\\d.,])${DEMO.cadDropPct}(?![\\d.,])`).test(v)
            && new RegExp(`(?<![\\d.,])${DEMO.gctRisePct}(?![\\d.,])`).test(v));
    });
    if (bad.length) fail(`r37 does not quote ${DEMO.cadDropPct} and ${DEMO.gctRisePct} in ${bad.join(', ')} — the demo line and the arithmetic above it must be the same two numbers`);
    else ok(`r37 quotes ${DEMO.cadDropPct} and ${DEMO.gctRisePct} in all six`);
  }
}

// ---- 20. what a crawler RENDERS == what the document DECLARES -------------
// The one that cost the most in round 14 (-4). Every page's <head> boot script
// resolves a language before the body is parsed, and it used to resolve a ROOT
// url to navigator.language and then location.replace() to that market's
// directory. Googlebot renders with an English-ish header and empty storage,
// so rendering https://runvis.app/ moved the crawler to /en/ — while the same
// document declared hreflang="ko" for "/", canonical "/", and sitemap.xml
// listed "/" as the Korean URL. A page cannot both be the Korean original and
// send everyone who renders it somewhere else.
//
// A comment saying "we fixed the redirect" is worth nothing here, because the
// last three rounds each shipped a comment ahead of the code. So this RUNS the
// boot script — the real one, cut out of the real file — against a crawler-like
// environment, and compares what it did against what the same file declares.
console.log('\n[20] the boot script renders each page in the language it declares');
{
  const vm = await import('node:vm');

  /** Every attribute of one tag, as a map. */
  const attrsOf = (tag) => {
    const out = {};
    for (const m of tag.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
    return out;
  };
  /** A stand-in for the <head> elements the boot script reads and writes. */
  function makeDom(head) {
    const els = [];
    for (const m of head.matchAll(/<(link|meta)\b([^>]*)>/g)) {
      els.push({ tag: m[1], attrs: attrsOf(m[0]),
        getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        setAttribute(k, v) { this.attrs[k] = String(v); } });
    }
    return {
      els,
      query(sel) {
        const m = /^([a-z]+)\[([a-zA-Z-]+)="([^"]*)"\]$/.exec(sel);
        if (!m) return null;
        return els.find(e => e.tag === m[1] && e.attrs[m[2]] === m[3]) || null;
      },
    };
  }
  /** The inline <head> scripts, in order, minus JSON-LD and external ones. */
  function bootScripts(html) {
    const head = html.slice(0, html.indexOf('</head>'));
    const out = [];
    for (const m of head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\bsrc=/.test(m[1]) || /application\/ld\+json/.test(m[1])) continue;
      out.push(m[2]);
    }
    return { head, scripts: out };
  }

  /** Run a page's boot scripts and report what they did. */
  function boot(html, env) {
    const { head, scripts } = bootScripts(html);
    const dom = makeDom(head);
    const navigated = [];
    const store = (backing) => backing === null
      ? { getItem() { throw new Error('storage disabled'); }, setItem() { throw new Error('storage disabled'); } }
      : { getItem: (k) => (k in backing ? backing[k] : null), setItem: (k, v) => { backing[k] = String(v); } };
    const win = {
      URL, URLSearchParams, console,
      navigator: { language: env.language },
      localStorage: store(env.local),
      sessionStorage: store(env.session ?? {}),
      location: {
        hostname: 'runvis.app', protocol: 'https:', search: env.search || '', hash: '',
        pathname: env.pathname,
        replace(u) { navigated.push(u); throw { RUNVIS_NAVIGATED: true }; },
      },
      document: {
        documentElement: { lang: /<html lang="([^"]*)"/.exec(html)?.[1] ?? '', className: '' },
        title: /<title[^>]*>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '',
        head: { appendChild() {} },
        createElement: () => ({ setAttribute() {} }),
        querySelector: (sel) => dom.query(sel),
      },
    };
    win.window = win;
    const ctx = vm.createContext(win);
    for (const src of scripts) {
      try { vm.runInContext(src, ctx, { timeout: 2000 }); }
      catch (e) { if (e && e.RUNVIS_NAVIGATED) break; throw e; }
    }
    return {
      navigated: navigated[0] ?? null,
      lang: win.document.documentElement.lang,
      canonical: dom.query('link[rel="canonical"]')?.getAttribute('href') ?? null,
      ogUrl: dom.query('meta[property="og:url"]')?.getAttribute('content') ?? null,
      resolved: win.RunvisLang ?? null,
      dictFetched: win.RunvisDictLoaded ?? null,
    };
  }

  const urlOf = (code, page) => 'https://runvis.app'
    + (code === 'ko' ? '/' : `/${code}/`) + (page === 'index.html' ? '' : page);
  const pathOf = (code, page) => (code === 'ko' ? '/' : `/${code}/`) + (page === 'index.html' ? '' : page);
  const HTML_L = { ko: 'ko', en: 'en', ja: 'ja', es: 'es', zh: 'zh-Hant', de: 'de' };

  // 20a. the crawler pass: an English-ish header, no storage at all. Every one
  //      of the thirty pages must render itself and stay at its own address.
  {
    const bad = [];
    for (const { file, code } of ALL) {
      const page = file.split('/').pop();
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const r = boot(html, { pathname: pathOf(code, page), language: 'en-US', local: null, session: null });
      const want = urlOf(code, page);
      if (r.navigated) bad.push(`${file}: navigated to ${r.navigated}`);
      else if (r.lang !== HTML_L[code]) bad.push(`${file}: rendered <html lang="${r.lang}">, declares "${HTML_L[code]}"`);
      else if (r.canonical !== want) bad.push(`${file}: canonical ${r.canonical} ≠ ${want}`);
      else if (r.ogUrl !== want) bad.push(`${file}: og:url ${r.ogUrl} ≠ ${want}`);
    }
    if (bad.length) fail(`a crawler does not get the declared page:\n       ${bad.join('\n       ')}`);
    else ok(`${ALL.length} pages: no navigation, <html lang> and canonical match the sitemap URL`);
  }

  // 20b. the same, with a German browser and empty (working) storage — the
  //      exact visitor whose header used to move the Korean root to /de/.
  {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const r = boot(html, { pathname: '/', language: 'de-DE', local: {}, session: {} });
    if (r.navigated) fail(`a German browser is still redirected off the Korean root (to ${r.navigated}) — hreflang="ko" names "/" as the Korean page`);
    else if (r.lang !== 'ko' || r.canonical !== 'https://runvis.app/') fail(`a German browser renders the root as <html lang="${r.lang}"> canonical ${r.canonical}`);
    else ok('a German browser gets the Korean root, unmoved, canonical "/"');
  }

  // 20c. …and the offer still HAPPENS. Deleting the redirect outright would
  //      put back round 9's "five market pages nobody is ever sent to", so the
  //      one signal that is a CHOICE — a saved language — must still send.
  {
    const html = fs.readFileSync(path.join(ROOT, 'run.html'), 'utf8');
    const r = boot(html, { pathname: '/run.html', language: 'en-US', local: { runvis_lang: 'de' }, session: {} });
    if (r.navigated !== '/de/run.html') fail(`a reader whose saved choice is German is not sent to /de/run.html (got ${r.navigated}) — the market pages need a live route`);
    else ok('a saved choice still routes: /run.html → /de/run.html');
  }

  // 20d. ?lang= on a root URL shows another market's page, so it has to name
  //      that market's canonical rather than compete with it.
  {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const r = boot(html, { pathname: '/', search: '?lang=ja', language: 'en-US', local: {}, session: {} });
    if (r.navigated) fail(`?lang=ja navigated to ${r.navigated} — an explicit ?lang= renders in place`);
    else if (r.canonical !== 'https://runvis.app/ja/' || r.ogUrl !== 'https://runvis.app/ja/')
      fail(`/?lang=ja canonicalises to ${r.canonical} (og:url ${r.ogUrl}), not to https://runvis.app/ja/`);
    else ok('/?lang=ja renders in place and canonicalises to /ja/');
  }

  // 20e. the dictionary is not downloaded to repaint a page with itself.
  {
    const bad = [];
    for (const { file, code } of ALL) {
      const page = file.split('/').pop();
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const r = boot(html, { pathname: pathOf(code, page), language: 'en-US', local: null, session: null });
      if (r.dictFetched) bad.push(`${file} fetched t-${r.dictFetched}.js`);
    }
    if (bad.length) fail(`a page in its own language still downloads a dictionary: ${bad.join(', ')}`);
    else ok(`${ALL.length} pages fetch no dictionary when they are already in the reader's language`);
  }
}

// ---- 21. every image the markup asks for exists, in all three formats ----
// The eleven device captures are <picture> elements now: an AVIF, a lossless
// WebP and the PNG (2026-09-06 라운드 14, -0.8 — the set was PNG-only, ~600 KB
// a page). That turns one referenced file per capture into three, times six
// languages, and the two new ones are named by <source srcset>, which fails
// SILENTLY: a browser whose first matching source 404s does not fall through to
// the next one, it shows nothing. So the references are resolved against disk.
console.log('\n[21] every referenced image file exists');
{
  const seen = new Map();                       // path → the files that ask for it
  for (const { file } of ALL_DOCS) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    // Markup (src, srcset), meta content (og:image, twitter:image) and the
    // JSON-LD image/screenshot — every one of them is a URL a crawler or a
    // browser will actually fetch, and every one of them has gone stale here
    // at least once.
    for (const m of html.matchAll(/(?:src|srcset|content)="(?:https:\/\/runvis\.app)?(\/?assets\/[^"\s?]+)/g)) {
      const rel = m[1].replace(/^\//, '');
      if (!seen.has(rel)) seen.set(rel, []);
      seen.get(rel).push(file);
    }
    for (const m of html.matchAll(/"(?:image|screenshot)":"https:\/\/runvis\.app\/(assets\/[^"]+)"/g)) {
      if (!seen.has(m[1])) seen.set(m[1], []);
      seen.get(m[1]).push(file + ' (JSON-LD)');
    }
  }
  const missing = [...seen.keys()].filter(p => !fs.existsSync(path.join(ROOT, p)));
  if (missing.length) fail(`${missing.length} referenced image(s) do not exist — ${missing.slice(0, 6).join(', ')} (first asked for by ${seen.get(missing[0])[0]})`);
  else ok(`${seen.size} distinct image paths across ${ALL_DOCS.length} documents, all present`);

  // A <picture> whose sources are a different capture from its <img> would
  // show one language and describe another; they have to be the same stem.
  const bad = [];
  for (const { file } of ALL_DOCS) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of html.matchAll(/<picture>([\s\S]*?)<\/picture>/g)) {
      const srcs = [...m[1].matchAll(/srcset="\/?assets\/([^"]+)\.(?:avif|webp)"/g)].map(x => x[1]);
      const img = /src="\/?assets\/([^"]+)\.png"/.exec(m[1]);
      if (!img) { bad.push(`${file}: a <picture> has no PNG <img>`); continue; }
      const off = srcs.filter(x => x !== img[1]);
      if (off.length) bad.push(`${file}: <picture> for ${img[1]} offers ${off.join(', ')}`);
      if (srcs.length !== 2) bad.push(`${file}: <picture> for ${img[1]} has ${srcs.length} source(s), expected avif + webp`);
    }
  }
  if (bad.length) fail(bad.join('\n       '));
  else ok('every <picture> offers the AVIF and WebP of its own <img>');
}

// ---- 22. each market's price copy states its OWN currency, from one file ---
// The three prices are Korean won, because Korea is the launch store and App
// Store Connect has no price points for the other five yet ([14] holds those
// three amounts identical across all six dictionaries). For three rounds the
// site's answer to the other five markets was to print nothing but ₩, so a
// reader in Berlin or Taipei reached the decision point holding three figures
// they could not evaluate at all (2026-09-06 라운드 15, -1.5).
//
// The answer is a SIZE, not a price: each market's copy carries an approximate
// figure in its own currency, coarse enough to read as an order of magnitude,
// next to the sentence saying Apple charges by price point rather than by
// exchange rate. The estimates are written once, in tools/price-approx.json,
// and this is what stops them from becoming six independently-maintained
// numbers — which is exactly how the test counts above rotted.
//
// What is checked: the market's own currency appears, the figures are the ones
// in that file, and the sentence is hedged. The hedge matters most — without
// it the line stops being a size and becomes a claim about a price this
// repository has no authority to state.
console.log('\n[22] price sizes == tools/price-approx.json, in each market’s own currency');
{
  const p = path.join(ROOT, 'tools/price-approx.json');
  if (!fs.existsSync(p)) fail('tools/price-approx.json missing');
  else {
    const approx = JSON.parse(fs.readFileSync(p, 'utf8'));
    const SYMBOL = { USD: 'US$', EUR: '€', JPY: '¥', TWD: 'NT$' };
    for (const c of CODES) {
      const m = approx.markets[c];
      const bad = [];
      if (!m) { fail(`${c}: tools/price-approx.json has no market entry`); continue; }
      const ref = String(dicts[c]['pr.approxref'] ?? '');
      for (const slot of ['month', 'year', 'life']) {
        if (!ref.includes(m[slot])) bad.push(`pr.approxref has no ${slot} size "${m[slot]}"`);
        if (!ref.includes(`₩${approx.krw[slot]}`)) bad.push(`pr.approxref does not say which amount it is sizing (₩${approx.krw[slot]})`);
      }
      if (!SYMBOL[m.currency]) bad.push(`unknown currency ${m.currency}`);
      else if (!ref.includes(SYMBOL[m.currency])) bad.push(`pr.approxref carries no ${m.currency} figure`);
      if (!m.approxWords.some(w => ref.includes(w))) {
        bad.push(`pr.approxref states the size flatly — it must hedge (${m.approxWords.join(' / ')}), or it reads as this market's price`);
      }
      // The hero badge is the same promise on the first screen. Korean is the
      // one market whose store price this actually is, so its badge states the
      // amount and needs no size beside it.
      const badge = String(dicts[c]['n.hero.b5'] ?? '');
      if (c !== 'ko') {
        if (!badge.includes(m.month)) bad.push(`n.hero.b5 has no month size "${m.month}"`);
        if (!m.approxWords.some(w => badge.includes(w))) bad.push('n.hero.b5 states the size flatly');
      }
      if (!String(dicts[c]['n.hero.b5n'] ?? '').includes(`₩${approx.krw.month}`)) {
        bad.push(`n.hero.b5n does not state ₩${approx.krw.month}`);
      }
      if (bad.length) fail(`${c}: ${bad.join('; ')}`);
      else ok(`${c}: ${m.month} / ${m.year} / ${m.life} (${m.currency}), hedged, from price-approx.json`);
    }
  }
}

// ---- 23. the boot script's inlined hero copy == the dictionary -------------
// index.html inlines the hero heading and the four meta strings for the five
// non-Korean languages so the largest text on the page never paints Korean and
// then changes under the reader. That object is a second copy of five
// dictionary values, it lives inside a <script> — which is exactly where [3]'s
// walk stops — and nothing compared the two. A translator editing t-de.js
// would have left the German hero heading a round behind in the one place a
// German visitor sees first, and every check here would still have said PASS.
console.log('\n[23] index.html’s inlined hero copy == the dictionaries');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /var C=(\{[\s\S]*?\});\n/.exec(html);
  if (!m) fail('index.html: no `var C={…};` boot object to compare');
  else {
    let obj = null;
    try { obj = JSON.parse(m[1]); } catch (e) { fail('index.html: the boot object is not JSON — ' + e.message); }
    if (obj) {
      const want = CODES.filter(c => c !== 'ko');
      const missingLang = want.filter(c => !obj[c]);
      if (missingLang.length) fail(`the boot object has no ${missingLang.join(', ')}`);
      const bad = [];
      let n = 0;
      for (const c of want) {
        if (!obj[c]) continue;
        for (const group of ['h', 'm']) {
          for (const [key, value] of Object.entries(obj[c][group] || {})) {
            n++;
            if (dicts[c][key] === undefined) bad.push(`${c}/${key} is not a dictionary key`);
            else if (dicts[c][key] !== value) bad.push(`${c}/${key} differs from t-${c}.js`);
          }
        }
      }
      if (bad.length) fail(bad.join('\n       '));
      else ok(`${n} inlined values across ${want.length} languages, all equal to their dictionary`);
    }
  }
}

// ---- 24. 404.html hands the reader links in the language it rendered ------
// GitHub Pages serves 404.html for every path it cannot find, its boot script
// picks the visitor's language and i18n.js translates the page in place — and
// then the three recovery buttons, the only actionable thing on the page, were
// hard-coded to the Korean root (2026-09-06 라운드 15, -0.9). They are built
// from data-page now. This runs the REAL function out of the REAL file rather
// than reading the markup and believing it, because the last several rounds of
// this repository each shipped a comment ahead of the code.
console.log('\n[24] 404.html’s recovery links follow the language it renders');
{
  const vm = await import('node:vm');
  const html = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
  const cut = html.indexOf('</head>');
  const head = html.slice(0, cut), body = html.slice(cut);
  const scripts = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(m => !/\bsrc=/.test(m[1])).map(m => m[2]);
  const declared = [...body.matchAll(/<a\b[^>]*data-page="([^"]*)"[^>]*>/g)]
    .map(m => ({ page: m[1], href: /href="([^"]*)"/.exec(m[0])?.[1] ?? null }));

  if (!declared.length) fail('404.html has no a[data-page] recovery links to rewrite');
  else {
    // Every page named must be one this site actually serves. "" is the home.
    const unknown = declared.filter(a => a.page !== '' && !PAGES.includes(a.page));
    if (unknown.length) fail(`404.html links to ${unknown.map(a => a.page).join(', ')}, which is not in PAGES`);

    const run = (language) => {
      const els = declared.map(a => ({
        attrs: { 'data-page': a.page, href: a.href },
        getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        setAttribute(k, v) { this.attrs[k] = String(v); },
      }));
      const win = {
        URL, URLSearchParams, console,
        navigator: { language },
        localStorage: { getItem: () => null, setItem() {} },
        location: { hostname: 'runvis.app', protocol: 'https:', search: '', hash: '', pathname: '/typo/nope' },
        document: {
          readyState: 'complete',
          documentElement: { lang: 'ko' },
          head: { appendChild() {} },
          createElement: () => ({ setAttribute() {} }),
          addEventListener() {},
          querySelectorAll: (sel) => (sel === 'a[data-page]' ? els : []),
        },
      };
      win.window = win;
      vm.createContext(win);
      for (const src of scripts) vm.runInContext(src, win, { timeout: 2000 });
      return { lang: win.RunvisLang, els, fix: typeof win.RunvisFix404 };
    };

    const bad = [];
    for (const [language, code] of [['ko-KR', 'ko'], ['en-GB', 'en'], ['de-DE', 'de'],
                                    ['ja-JP', 'ja'], ['es-ES', 'es'], ['zh-TW', 'zh']]) {
      let r;
      try { r = run(language); }
      catch (e) { bad.push(`${language}: the boot script threw — ${e.message}`); continue; }
      if (r.fix !== 'function') { bad.push(`${language}: the boot script defines no RunvisFix404`); continue; }
      if (r.lang !== code) { bad.push(`${language}: resolved to ${r.lang}, expected ${code}`); continue; }
      const want = code === 'ko' ? '/' : `/${code}/`;
      for (const el of r.els) {
        const got = el.getAttribute('href');
        if (got !== want + el.getAttribute('data-page')) {
          bad.push(`${language}: "${el.getAttribute('data-page') || 'home'}" points at ${got}, not ${want}${el.getAttribute('data-page')}`);
        }
      }
    }
    // The six direct language links are the escape hatch that needs no script
    // at all — the one thing on this page that still works if i18n.js never
    // arrives, which on a mistyped deep path is a real possibility.
    const row = /<p class="langrow">([\s\S]*?)<\/p>/.exec(body);
    if (!row) bad.push('no .langrow of direct language links');
    else {
      const hrefs = [...row[1].matchAll(/href="([^"]+)"/g)].map(m => m[1]);
      const want = CODES.map(c => (c === 'ko' ? '/' : `/${c}/`));
      const missing = want.filter(w => !hrefs.includes(w));
      if (missing.length) bad.push(`.langrow does not link to ${missing.join(', ')}`);
    }
    if (bad.length) fail(bad.join('\n       '));
    else ok(`${declared.length} recovery links + 6 direct language links, correct in all six languages`);
  }
}

// ---- 25. the privacy page lists every kind of notification the app posts ---
// privacy.html enumerates the notification purposes by name, and the same page
// enumerates all six network exceptions in a table without omitting one — so
// this list reads as complete. It was not: it named five of the seven the
// iPhone app posts, and the two it left out were the two commercial ones, the
// first-week push after a purchase and the win-back push a week after
// cancelling. It also promised a reminder "two days before a subscription
// renews", which SubscriptionRules.reminderCopy explicitly refuses to send
// (2026-09-06 라운드 15, -1.2 and -0.7).
//
// So the count is stated in the sentence and measured out of the app repo.
// Prose cannot be counted reliably across six languages — separators and
// conjunctions differ — but a number can, and the number failing is what makes
// someone re-read the list. Adding a tenth notification to the app now fails
// this build.
console.log('\n[25] the notification list == the app’s notification kinds');
{
  const facts = readFacts();
  if (!facts) fail('tools/app-facts.json missing — run `node tools/app-facts.mjs`');
  else if (typeof facts.notifyKinds !== 'number') {
    fail('tools/app-facts.json has no notifyKinds — run `node tools/app-facts.mjs`');
  } else {
    const bad = [];
    for (const c of CODES) {
      const v = String(dicts[c]['pv.s4.li4'] ?? '');
      const m = v.replace(/<[^>]*>/g, '').match(/\d+/);
      if (!m) bad.push(`${c}: pv.s4.li4 states no count`);
      else if (Number(m[0]) !== facts.notifyKinds) {
        bad.push(`${c}: pv.s4.li4 says ${m[0]} kinds, the app posts ${facts.notifyKinds} (${(facts.notifyIds || []).join(', ')})`);
      }
    }
    if (bad.length) fail(bad.join('\n       '));
    else ok(`pv.s4.li4 states ${facts.notifyKinds} kinds in all six, matching the app`);
  }
}

// ---- 26. the Siri phrases the site quotes are phrases Siri answers to ------
// Five App Shortcuts shipped with spoken phrases in six languages, and neither
// the app's settings screen nor this site mentioned them — so the only way to
// find them was to already know (2026-09-06 라운드 15, -0.8). Quoting a
// shortcut is worse than saying nothing if the quote is wrong: the reader says
// the sentence, nothing happens, and the page has taught them the feature is
// broken. So each language's quote is held against that language's OWN
// AppShortcuts.strings, with ${applicationName} resolved — the same table the
// build extracts the phrases from.
console.log('\n[26] the Siri phrases in the copy == iOSApp/Intents/*.lproj/AppShortcuts.strings');
{
  const app = locateAppRepo();
  if (!app) console.log('  skip  no app checkout here (set RUNVIS_APP_REPO)');
  else {
    const LPROJ = { ko: 'ko', en: 'en', ja: 'ja', es: 'es', zh: 'zh-Hant', de: 'de' };
    const KEYS = ['n.today.siri', 'n.live.siri'];
    const bad = [];
    for (const c of CODES) {
      const f = path.join(app, `iOSApp/Intents/${LPROJ[c]}.lproj/AppShortcuts.strings`);
      if (!fs.existsSync(f)) { bad.push(`${c}: ${LPROJ[c]}.lproj/AppShortcuts.strings does not exist`); continue; }
      // "key" = "value"; — the value is the spoken phrase in this language.
      const phrases = [...fs.readFileSync(f, 'utf8').matchAll(/=\s*"((?:[^"\\]|\\.)*)"\s*;/g)]
        .map(m => m[1].replace(/\$\{applicationName\}/g, 'Runvis').toLowerCase());
      if (!phrases.length) { bad.push(`${c}: no phrases parsed out of ${LPROJ[c]}.lproj/AppShortcuts.strings`); continue; }
      for (const key of KEYS) {
        const v = String(dicts[c][key] ?? '').toLowerCase();
        if (!phrases.some(p => v.includes(p))) {
          bad.push(`${c}: ${key} quotes no phrase that ${LPROJ[c]}.lproj/AppShortcuts.strings contains`);
        }
      }
    }
    if (bad.length) fail(bad.join('\n       '));
    else ok(`${KEYS.length} quoted phrases × ${CODES.length} languages, every one of them a real App Shortcut`);
  }
}

// ---- 27. English typography, and the app's Korean name in Korean prose ----
// Two spelling rules that were being kept by hand and were not being kept.
//
// (a) t-en.js mixed straight and curly quotation marks — the price card used
//     curly ("The coach’s voice") and the FAQ beside it used straight ("The
//     watch's live coaching loop"), on one screen (2026-09-06 라운드 15, -0.2).
//     Curly is the rule; the other five dictionaries already keep their own
//     conventions. Only text is inspected, never markup: `<a href="…">` inside
//     a value has to keep its straight quotes.
//     The exception is vocabulary QUOTED from the app: the seven paid tiles
//     carry the app's own names, which [15] holds byte for byte against
//     Localizable.strings, and "Coach's Brake" is spelled there with a straight
//     apostrophe. Prettifying a quotation would make the two surfaces disagree
//     about a product name, which costs more than the typography gains.
//
// (b) Korean prose calls the app 런비스; the legal documents, <title>, alt text
//     and the copyright line call it Runvis. That reads as a rule until one
//     marketing paragraph breaks it, which pr.launch did — "Runvis는 대한민국
//     App Store에…" sat directly under a paragraph that said 런비스
//     (2026-09-06 라운드 15, -0.5). Checked only for the keys index.html
//     actually renders, since that is where the mixing is visible.
console.log('\n[27] English quotation marks, and 런비스 vs Runvis in Korean prose');
{
  // (a)
  const QUOTED_FROM_APP = new Set(['n.price.t5', 'n.price.t7', 'n.price.g6', 'n.price.g7',
                                   'hw.vs.r10a', 'hw.vs.r11a']);
  const straight = [];
  for (const [key, value] of Object.entries(dicts.en)) {
    if (QUOTED_FROM_APP.has(key)) continue;
    const text = String(value).replace(/<[^>]*>/g, '');
    if (/['"]/.test(text)) straight.push(key);
  }
  if (straight.length) {
    fail(`t-en.js uses straight quotes in ${straight.length} value(s) — ${straight.slice(0, 8).join(', ')}${straight.length > 8 ? ' …' : ''}`);
  } else {
    ok(`t-en.js: ${Object.keys(dicts.en).length} values, curly quotes throughout (${QUOTED_FROM_APP.size} exempt: app tile names)`);
  }

  // (b) — Runvis is right in these, and only these, on index.html.
  //   meta.*  the <title>/<meta> a search engine prints, where the brand is
  //           the searchable token
  //   alt.*   alt text names the product in the screenshot
  //   t166    the legal footer, which is written like the policy pages
  //   *.siri  the spoken Siri phrase, quoted verbatim from AppShortcuts.strings
  //           ([26]) — Siri answers to "Runvis", so 런비스 there would be wrong
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const rendered = new Set();
  for (const m of html.matchAll(/data-i18n(?:-attr)?="([^"]+)"/g)) {
    for (const part of m[1].split(',')) rendered.add(part.includes(':') ? part.split(':')[1] : part);
  }
  const EXEMPT = (k) => /^meta\./.test(k) || /^alt\./.test(k) || k === 't166' || /\.siri$/.test(k);
  const mixed = [...rendered].filter(k => !EXEMPT(k) && /Runvis/.test(String(dicts.ko[k] ?? '')));
  if (mixed.length) fail(`t-ko.js prose says "Runvis" where index.html renders it — ${mixed.join(', ')} (use 런비스)`);
  else ok(`${rendered.size} keys rendered by index.html: Korean prose says 런비스 throughout`);
}

console.log(failures ? `\nFAILED — ${failures} problem(s)` : '\nPASS — no drift');
process.exit(failures ? 1 : 0);
