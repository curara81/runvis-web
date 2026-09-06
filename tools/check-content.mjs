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
      // The hero's third trust badge took this slot in round 13 (it used to
      // carry the launch-region caveat). It states the same glossary count the
      // why section does, so it is bound to the same measurement rather than
      // being a second hand-typed 41 that can drift away from the first.
      'n.hero.b4n': ['glossary'],
    };
    // n.why.s2v states a floor ("270개 이상" / "270+"), so the repo only has to
    // stay above the number written there — adding a cue can never make it false.
    // n.why.s3v joined it for the same reason: the app repo gained 48 tests in
    // one session of round 10 and an exact "506" in six dictionaries was wrong
    // the moment it did.
    const FLOOR = { 'n.why.s2v': 'cueSites', 'n.why.s3v': 'tests' };
    // Same idea for the interface-string count, and for the same reason it was
    // needed here more than anywhere: an exact count in six dictionaries went
    // stale in rounds 7, 8, 9 and 10 (502 vs 506, 2,077 vs 2,118, 2,118 vs
    // 2,162), because every string the app repo adds falsifies it and the two
    // repositories are edited in different sessions. n.trust.l2 states a floor
    // now ("2,100개 이상" / "Over 2,100"), so the sentence stays true while the
    // app grows and only an actual SHRINK below the floor fails. The exact
    // measurement still lives in tools/app-facts.json and is still re-measured
    // by `node tools/app-facts.mjs --check`. FLOOR_FIRST reads the FIRST number
    // in the value, because n.trust.l2 also carries the 396-line coach table
    // (checked exactly, above) and a digits-only scan would glue the two.
    const FLOOR_FIRST = { 'n.trust.l2': 'stringKeys', 'n.trust.l1': 'tests' };
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
      for (const [key, field] of Object.entries(FLOOR)) {
        const digits = String(dicts[c][key] ?? '').replace(/[^0-9]/g, '');
        const floor = digits ? Number(digits) : NaN;
        if (!Number.isFinite(floor)) bad.push(`${key} states no number`);
        else if (facts[field] < floor) bad.push(`${key} claims ${floor}+ but the repo has ${facts[field]}`);
      }
      for (const [key, field] of Object.entries(FLOOR_FIRST)) {
        // Drop this locale's group separator (2.162 → 2162, 2,162 → 2162) and
        // take the first run of digits that remains.
        const sep = groupSep(c);
        const flat = String(dicts[c][key] ?? '').split(sep).join('');
        const m = flat.match(/\d+/);
        const floor = m ? Number(m[0]) : NaN;
        if (!Number.isFinite(floor)) bad.push(`${key} states no number`);
        else if (facts[field] < floor) bad.push(`${key} claims ${floor}+ but the repo has ${facts[field]}`);
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
  // The hero note is the one price sentence that must NOT carry a figure.
  // It used to say ₩1,900 to all six markets and five of them have no sense
  // of how big that is (2026-09-06 라운드 13, -0.8). A converted figure is not
  // the fix either: Apple charges by price point, not by exchange rate — which
  // is exactly what pr.approx2 tells the reader — so any number written here
  // would be wrong on the day someone pays and would have to be maintained by
  // hand in six files. The amount belongs to the price table, next to the
  // store note that says which store it is. This is the invariant that keeps
  // it from creeping back into one language and not the others.
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

console.log(failures ? `\nFAILED — ${failures} problem(s)` : '\nPASS — no drift');
process.exit(failures ? 1 : 0);
