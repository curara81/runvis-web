/* Prerender all six copies of the site out of src/.
 *
 *   node tools/prerender.mjs
 *
 * Writes the Korean copy to the root (the x-default) and /en/, /ja/, /es/,
 * /zh/, /de/ — one directory per market, each with index.html, run.html,
 * how-it-works.html, privacy.html and terms.html.
 *
 * Korean used to be the exception: the root pages WERE the source, so the five
 * copies went through stripCss/stripJs and the Korean root did not. The launch
 * market carried 60,429 B gzipped where /en/ carried 31,532 B, and the gap
 * widened every round because every new comment was written at the root
 * (2026-09-06 라운드 16, -1.3 and a [회귀]). The source lives in src/ now and
 * Korean is the sixth output, so the same pipeline reaches it. For Korean the
 * language substitutions are identities — the inline defaults ARE the Korean
 * dictionary, which is what check-content [3] asserts — and the steps that
 * only make sense in a subdirectory (the base-path rewrite, the language-
 * suffixed assets, the RunvisPageLang pin) are skipped by name below.
 *
 * WHY this exists. GitHub Pages hands every ?lang= the same file and crawlers
 * do not run i18n.js, so the six hreflang alternates all resolved to one
 * Korean document: five markets had no indexable page at all, and the FAQ rich
 * result, og:title, og:description and <html lang> that search engines and
 * link previews read were Korean for everybody. Everything i18n.js does at
 * runtime is done here at build time instead, so the markup a crawler receives
 * is already the finished page in that language.
 *
 * These files are BUILD OUTPUT. Do not hand-edit them — edit the root page or
 * t-<code>.js and run this again. tools/check-content.mjs fails if they drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import { stripJs, stripCss, sameLiterals } from './strip-comments.mjs';
import {
  ROOT, SRC, CODES, PAGES, HTML_LANG, HREFLANG, OG_LOCALE, SHOTS,
  srcPath, outPath,
  loadDicts, attrEscape, findI18nElements, findI18nAttrs, spliceAll,
  faqLd, appLd, pageLd, readLd,
} from './i18n-lib.mjs';

/* ---- 0. the counted numbers in the copy ---------------------------------
 *
 * Four sentences on the home page state figures measured out of the app
 * checkout: the glossary size, the number of coach lines, the number of tests
 * and the number of interface strings. `node tools/app-facts.mjs` measures
 * them into tools/app-facts.json; until now the SENTENCES were typed by hand
 * and only compared against that file, and to make the comparison survivable
 * four of them were written as floors ("500개 이상", "over 2,100").
 *
 * That is how they rotted. The floors held while the repository grew, so
 * nothing ever failed, and the distance widened every round until the page
 * claimed 500+ tests against 737 and 2,100+ strings against 2,324 — inside the
 * one paragraph whose whole argument is that its numbers are counted rather
 * than invented. The English table had even dropped its "over", so that copy
 * was simply false (2026-09-06 라운드 15, -1 and [회귀]).
 *
 * So the build writes them now. This step runs before anything is rendered: it
 * carries each measurement from tools/app-facts.json into the six dictionaries
 * and into the Korean inline defaults, and records what it wrote in
 * tools/copy-facts.json so the NEXT run knows which token to replace. Only
 * digits move — the sentence around them is the translator's. check-content
 * [9] then asserts exact equality with app-facts.json, so if this step is ever
 * bypassed the build says so instead of shipping a stale number.
 *
 *   key → the fields its numbers state, in the order they appear in the value.
 */
const FACT_NUMBERS = {
  'n.why.s1v': ['glossary'],
  'n.why.s2v': ['cueSites'],
  'n.why.s3v': ['tests'],
  'n.trust.l1': ['tests'],
  'n.trust.l2': ['stringKeys', 'coachTable'],
  'n.trust.l3': ['glossary'],
};
const FACT_LOCALE = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', es: 'es-ES', zh: 'zh-Hant', de: 'de-DE' };

/** The two spellings a market may use for a whole number: bare digits, and
 *  digits grouped with that locale's own separator (2,324 / 2.324). */
function factTokens(code, n) {
  const sep = (new Intl.NumberFormat(FACT_LOCALE[code]).formatToParts(1234567)
    .find(p => p.type === 'group') || { value: '' }).value;
  return { bare: String(n), grouped: sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep) : String(n) };
}

/** Replace one whole-number token, not a digit run inside a longer one: "41"
 *  must not match the "41" in "410" or in "2,410". */
function replaceNumberToken(value, from, to) {
  let at = value.indexOf(from);
  while (at >= 0) {
    const before = value[at - 1], after = value[at + from.length];
    const digitish = ch => ch !== undefined && /[0-9.,]/.test(ch);
    if (!digitish(before) && !digitish(after)) {
      return value.slice(0, at) + to + value.slice(at + from.length);
    }
    at = value.indexOf(from, at + 1);
  }
  return null;                                     // token not present
}

/** Rewrite one JSON string value inside t-<code>.js, in place, by key. */
function dictSet(code, key, next) {
  const file = path.join(ROOT, `t-${code}.js`);
  const src = fs.readFileSync(file, 'utf8');
  const needle = JSON.stringify(key) + ': ';
  const at = src.indexOf(needle);
  if (at < 0) throw new Error(`syncFacts: t-${code}.js has no ${key}`);
  let j = at + needle.length;
  if (src[j] !== '"') throw new Error(`syncFacts: ${code}/${key} is not a string`);
  let k = j + 1;
  for (;;) {
    if (src[k] === undefined) throw new Error(`syncFacts: ${code}/${key} is unterminated`);
    if (src[k] === '\\') { k += 2; continue; }
    if (src[k] === '"') { k++; break; }
    k++;
  }
  fs.writeFileSync(file, src.slice(0, j) + JSON.stringify(next) + src.slice(k));
}

function syncFacts() {
  const facts = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/app-facts.json'), 'utf8'));
  const lockPath = path.join(ROOT, 'tools/copy-facts.json');
  const FIELDS = [...new Set(Object.values(FACT_NUMBERS).flat())];
  const now = Object.fromEntries(FIELDS.map(f => [f, facts[f]]));
  for (const f of FIELDS) {
    if (!Number.isInteger(now[f])) throw new Error(`syncFacts: app-facts.json has no integer ${f}`);
  }
  const first = !fs.existsSync(lockPath);
  const was = first ? now : JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const moved = FIELDS.filter(f => was[f] !== now[f]);

  if (moved.length) {
    const dicts0 = loadDicts();
    for (const code of CODES) {
      for (const [key, fields] of Object.entries(FACT_NUMBERS)) {
        let value = dicts0[code][key];
        if (value == null) throw new Error(`syncFacts: t-${code}.js has no ${key}`);
        let changed = false;
        for (const f of fields) {
          if (was[f] === now[f]) continue;
          const old = factTokens(code, was[f]), next = factTokens(code, now[f]);
          // Prefer the grouped spelling: it is the longer, more specific token,
          // and matching "324" inside "2,324" would corrupt the value.
          const hit = replaceNumberToken(value, old.grouped, next.grouped)
            ?? replaceNumberToken(value, old.bare, next.bare);
          if (hit == null) {
            throw new Error(`syncFacts: ${code}/${key} does not state ${f} = ${was[f]} — `
              + 'fix the sentence by hand, then update tools/copy-facts.json');
          }
          value = hit; changed = true;
        }
        if (changed) dictSet(code, key, value);
      }
    }
    // …and the Korean inline defaults, which check-content [3] holds equal to
    // the ko dictionary. Read the dictionaries back: they were just rewritten.
    const koDict = loadDicts().ko;
    for (const page of PAGES) {
      const file = srcPath(page);
      let html = fs.readFileSync(file, 'utf8');
      const edits = [];
      for (const el of findI18nElements(html)) {
        if (!FACT_NUMBERS[el.key]) continue;
        const want = koDict[el.key];
        if (html.slice(el.innerStart, el.innerEnd) !== want) {
          edits.push({ start: el.innerStart, end: el.innerEnd, text: want });
        }
      }
      if (edits.length) { fs.writeFileSync(file, spliceAll(html, edits)); console.log(`  sync src/${page}: ${edits.length} inline default(s)`); }
    }
    console.log(`prerender: app facts moved — ${moved.map(f => `${f} ${was[f]}→${now[f]}`).join(', ')}`);
  }
  if (first || moved.length) {
    fs.writeFileSync(lockPath, JSON.stringify(now, null, 2) + '\n');
  }
}
syncFacts();

const dicts = loadDicts();
// All six. The filter that used to stand here — `CODES.filter(c => c !== 'ko')`
// — is what kept the Korean root out of the strip pipeline.
const OUT_CODES = CODES;

const BANNER = (code, page) => `<!-- GENERATED FILE — do not edit.
     tools/prerender.mjs built this from src/${page} and t-${code}.js.
     Edit those and run: node tools/prerender.mjs -->
`;

/** Replace an HTML comment block delimited by two literal markers. No-op when
 *  the block is not in this page. */
function replaceBlock(html, startMark, endMark, text) {
  const i = html.indexOf(startMark);
  if (i < 0) return html;
  const j = html.indexOf(endMark, i);
  if (j < 0) return html;
  return html.slice(0, i) + text + html.slice(j + endMark.length);
}

/* `retireBilingualNotes()` used to stand here: it rewrote five HTML comments
 * in each copy so a reader of /de/index.html would not find a note claiming the
 * file was the Korean original. It was dead. Step 9b below strips every HTML
 * comment outside <script>/<style>, which includes the replacements this
 * function had just written, so its entire output was deleted a few lines
 * later — and it carried an instruction to future editors ("if you reword one
 * of those comments, reword the marker with it") for work that changed nothing.
 * Verified by rendering with and without it: the 25 files are byte-identical.
 * Removed 2026-09-06. If comment stripping is ever made optional, the copies
 * will need something like it again — and it will need a test that proves the
 * note actually reached a file this time.
 */

/** Absolute site path for one page in one language. */
function pageUrl(code, page) {
  const dir = code === 'ko' ? '/' : `/${code}/`;
  return page === 'index.html' ? `https://runvis.app${dir}` : `https://runvis.app${dir}${page}`;
}

function render(page, code) {
  const dict = dicts[code];
  // Korean is a build output like the other five now, but it is the output
  // whose URL is the site root, so three of the steps below are about being in
  // a subdirectory and one is about not being the x-default. Named once here
  // rather than tested five times inline.
  const inSubdir = code !== 'ko';
  let html = fs.readFileSync(srcPath(page), 'utf8');

  // ---- 1. inner text of every [data-i18n] element -------------------------
  // Values are HTML (they carry <b>/<span>/<br>) and go in verbatim, which is
  // exactly what i18n.js does with innerHTML at runtime.
  const edits = [];
  let missing = 0;
  for (const el of findI18nElements(html)) {
    const v = dict[el.key];
    if (v == null) { console.warn(`  ! ${code}/${page}: no value for ${el.key}`); missing++; continue; }
    edits.push({ start: el.innerStart, end: el.innerEnd, text: v });
  }
  // ---- 2. attribute text (alt, placeholder, aria-label, meta content) -----
  for (const a of findI18nAttrs(html)) {
    const v = dict[a.key];
    if (v == null) { console.warn(`  ! ${code}/${page}: no value for ${a.key}`); missing++; continue; }
    edits.push({ start: a.valueStart, end: a.valueEnd, text: attrEscape(v) });
  }
  html = spliceAll(html, edits);
  if (missing) throw new Error(`${code}/${page}: ${missing} missing dictionary values`);

  // ---- 3. document language ----------------------------------------------
  html = replaceOnce(html, '<html lang="ko">', `<html lang="${HTML_LANG[code]}">`);
  html = replaceOnce(html, 'content="ko_KR" property="og:locale"', `content="${OG_LOCALE[code]}" property="og:locale"`,
    'property="og:locale" content="ko_KR"', `property="og:locale" content="${OG_LOCALE[code]}"`);
  // og:locale:alternate lists the OTHER five, so this page's own locale is not
  // declared twice (it now stands as og:locale).
  html = replaceAll(html, `<meta content="${OG_LOCALE[code]}" property="og:locale:alternate"/>`,
    `<meta content="ko_KR" property="og:locale:alternate"/>`);

  // ---- 4. canonical + og:url point at THIS file ---------------------------
  const self = pageUrl(code, page);
  html = replaceAll(html, `<link href="https://runvis.app/" id="canonical" rel="canonical"/>`,
    `<link href="${self}" id="canonical" rel="canonical"/>`);
  html = replaceAll(html, `<link rel="canonical" href="https://runvis.app/${page}">`,
    `<link rel="canonical" href="${self}">`);
  html = replaceAll(html, `content="https://runvis.app/" property="og:url"`, `content="${self}" property="og:url"`);
  html = replaceAll(html, `property="og:url" content="https://runvis.app/${page}"`, `property="og:url" content="${self}"`);

  // ---- 5. tell the boot script which language and where the root is -------
  // After <meta charset>, not before it: the encoding declaration has to stay
  // inside the first 1024 bytes and, by convention, first in <head>.
  //
  // NOT on the Korean root, and this is load-bearing rather than tidiness.
  // The boot script's one automatic navigation — send a reader who has already
  // PICKED a language to that market's directory — is written
  // `if (!window.RunvisPageLang && !urlLang && saved && …)`, so it fires only
  // on a page that has not been pinned to a language. Pinning the root to "ko"
  // would silence it and put the five market pages back to being pages nobody
  // is sent to (라운드 9). `RunvisBase` is likewise "" at the root, which is
  // what the boot script already defaults to.
  if (inSubdir) {
    const charset = /<meta charset=["']?[^>]*>/i.exec(html);
    if (!charset) throw new Error('prerender: no <meta charset> in ' + page);
    const at = charset.index + charset[0].length;
    html = html.slice(0, at)
      + `\n<script>window.RunvisPageLang=${JSON.stringify(code)};window.RunvisBase="/";</script>`
      + html.slice(at);
  }

  // ---- 6. relative URLs, from a subdirectory ------------------------------
  // Only the things that live at the site ROOT need rewriting. Page-to-page
  // links stay relative on purpose: href="privacy.html" inside /de/ already
  // resolves to /de/privacy.html, and leaving them alone means the dictionary
  // values that CONTAIN such links (n.beta.do1, pv.s10.p, tm.s8.p) still match
  // the markup exactly — otherwise a language switch would rewrite the link
  // back and check-content.mjs would report drift that is not drift.
  // The Korean copy IS at the root, so its relative paths already resolve and
  // rewriting them would only make the two builds differ for no reason.
  if (inSubdir) {
    html = replaceAll(html, 'src="assets/', 'src="/assets/');
    html = replaceAll(html, 'srcset="assets/', 'srcset="/assets/');
    html = replaceAll(html, 'href="gpx/', 'href="/gpx/');
    html = replaceAll(html, 'src="i18n.js?v=', 'src="/i18n.js?v=');
  }

  // ---- 7. the localized iPhone captures, already in the markup ------------
  // Saves the runtime swap and, for the hero, the second download that used to
  // arrive after the Korean one had already painted.
  // Three files per capture since round 14 — the PNG the <img> names and the
  // AVIF and lossless WebP the two <source>s name (tools/encode_shots.py).
  // Rewriting only the PNG would have left every prerendered page showing the
  // KOREAN screenshot to any browser that can decode AVIF, under a correctly
  // localized <img src> that never got used.
  // Korean captures carry no language suffix — assets/framed-phone-dash.png IS
  // the Korean one, which is what the markup already names.
  if (inSubdir) {
    for (const base of SHOTS) {
      for (const ext of ['png', 'avif', 'webp']) {
        html = replaceAll(html, `/assets/${base}.${ext}`, `/assets/${base}.${code}.${ext}`);
      }
    }
  }

  // ---- 7b. the page scripts' own inline fallbacks -------------------------
  // The form results and the demo's runtime strings are read as
  // RunvisT(key, fallback) from the page's own script, which the [data-i18n]
  // walk above deliberately skips. The fallback is what shows if the
  // dictionary has not landed, and in these copies leaving it Korean means a
  // German visitor could get a Korean form message. Swap the ones whose two
  // arguments are both plain single-quoted literals; anything passing a
  // variable is left alone.
  // `announce(key, fallback)` is the same two-literal shape — index.html's
  // aria-live wrapper around RunvisT. It was not rewritten here, so the two
  // screen-reader announcements kept their Korean fallback in all five copies.
  html = html.replace(/(RunvisT|announce)\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g, (whole, fn, key) => {
    const v = dict[key];
    if (v == null) return whole;                     // not ours to translate
    if (v.includes('</')) throw new Error(`${code}/${page}: ${key} would close the <script>`);
    return `${fn}('${key}', '${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`;
  });

  // ---- 8. structured data -------------------------------------------------
  const faq = readLd(html, 'faqld');
  if (faq) html = html.slice(0, faq.start) + '\n' + JSON.stringify(faqLd(dict, code)) + '\n' + html.slice(faq.end);
  const app = readLd(html, 'appld');
  if (app) html = html.slice(0, app.start) + '\n' + JSON.stringify(appLd(dict, code)) + '\n' + html.slice(app.end);
  // run.html / privacy.html / terms.html: WebPage + BreadcrumbList, in this
  // language, pointing at this language's directory.
  const pg = readLd(html, 'pageld');
  const pgNode = pageLd(dict, code, page);
  if (pg && pgNode) html = html.slice(0, pg.start) + '\n' + JSON.stringify(pgNode) + '\n' + html.slice(pg.end);

  // ---- 8b. this market's share card --------------------------------------
  // One neutral wordless card served all six markets because GitHub Pages
  // hands every ?lang= the same file. That reason went away when these became
  // separate files, and the six cards themselves arrived in round 14
  // (tools/og_cards.py draws each market's own n.hero.h1 onto the card;
  // tools/og-card-base.png is the background). The swap used to be conditional
  // on the file existing, because for two rounds it did not; it is
  // unconditional now, and check-content [21] resolves every image path in the
  // markup AND in the JSON-LD against disk, so a card that goes missing fails
  // the build instead of quietly reappearing as the wordless one.
  // Covers og:image, twitter:image and the SoftwareApplication `image`.
  // Same naming rule as the captures: og-card.png is the Korean card.
  if (inSubdir) {
    const card = `assets/og-card.${code}.png`;
    if (!fs.existsSync(path.join(ROOT, card))) {
      throw new Error(`prerender: ${card} is missing — run \`python3 tools/og_cards.py\``);
    }
    html = replaceAll(html, 'assets/og-card.png', card);
  }

  // ---- 9. drop what this copy cannot use ---------------------------------
  // 9a. The boot script inlines the hero copy and the four meta strings for
  // the five non-Korean languages so the LCP heading never changes language in
  // place. On a prerendered page the markup is ALREADY in one language and
  // window.RunvisPageLang pins `code`, so four fifths of that object can never
  // be read here. Keep this language's entry, drop the rest. The root page
  // still ships all five, because ?lang= there can be any of them.
  html = html.replace(/var C=(\{.*?\});\n/s, (whole, obj) => {
    try {
      const all = JSON.parse(obj);
      if (!all[code]) return whole;                  // shape changed — leave it
      return `var C=${JSON.stringify({ [code]: all[code] })};\n`;
    } catch { return whole; }                        // never mangle on a parse error
  });

  // 9b. HTML comments. The root pages carry ~14 KB of them and they earn their
  // place THERE — they are why the markup looks the way it does. These files
  // are build output that says "do not edit" in its first line, so shipping the
  // rationale to twenty copies is 14 KB per page of freight a reader of the
  // source already has. Script and style bodies are skipped so a `-->` inside
  // code could never be treated as a comment end.
  {
    const parts = [];
    const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let last = 0, m;
    while ((m = re.exec(html)) !== null) {
      parts.push(html.slice(last, m.index).replace(/\n?[ \t]*<!--[\s\S]*?-->/g, ''), m[0]);
      last = m.index + m[0].length;
    }
    parts.push(html.slice(last).replace(/\n?[ \t]*<!--[\s\S]*?-->/g, ''));
    html = parts.join('');
  }

  // 9c. …and the comments inside the <style> and the inline <script>s, which
  // are the other two languages in this file and about 26 KB of the 132 KB a
  // copy weighs (2026-09-06 라운드 14, -0.3). Same argument as 9b: the
  // rationale belongs to the source, and a reader of a file whose first line
  // says "do not edit" already has it. tools/strip-comments.mjs scans rather
  // than pattern-matches, because "//" lives inside https:// and "/*" can live
  // inside a CSS string; it hands back every literal it walked past, the same
  // scan is run over its own output, and the two lists have to match. The
  // stripped script is then PARSED before it is allowed into the file.
  html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (whole, open, body, close) => {
    const r = stripCss(body);
    const again = stripCss(r.text);
    if (!sameLiterals(r.literals, again.literals)) {
      throw new Error(`prerender: stripping CSS comments changed a string literal in ${code}/${page}`);
    }
    // Not "the same number of braces as before" — several comments in the
    // sheet quote a rule, braces and all. What must hold is that what is LEFT
    // is a balanced sheet.
    const open_ = (r.text.match(/\{/g) || []).length, close_ = (r.text.match(/\}/g) || []).length;
    if (open_ !== close_) {
      throw new Error(`prerender: stripped CSS is unbalanced (${open_} { vs ${close_} }) in ${code}/${page}`);
    }
    return open + '\n' + r.text + '\n' + close;
  });
  html = html.replace(/(<script\b([^>]*)>)([\s\S]*?)(<\/script>)/g, (whole, open, attrs, body, close) => {
    if (/\bsrc=/.test(attrs) || /application\/ld\+json/.test(attrs)) return whole;
    const r = stripJs(body);
    const again = stripJs(r.text);
    if (!sameLiterals(r.literals, again.literals)) {
      throw new Error(`prerender: stripping JS comments changed a literal in ${code}/${page}`);
    }
    try { new Function(r.text); }
    catch (e) { throw new Error(`prerender: stripped script does not parse in ${code}/${page} — ${e.message}`); }
    if (r.text.includes('</script')) throw new Error(`prerender: stripped script would close its own tag in ${code}/${page}`);
    return open + '\n' + r.text + '\n' + close;
  });

  // The banner goes AFTER the doctype — a comment in front of it puts some
  // browsers into quirks mode.
  const dt = /<!DOCTYPE[^>]*>\s*/i.exec(html);
  if (!dt) throw new Error('prerender: no doctype in ' + page);
  const cut = dt.index + dt[0].length;
  return html.slice(0, cut) + BANNER(code, page) + html.slice(cut);
}

function replaceAll(s, from, to) { return s.split(from).join(to); }
function replaceOnce(s, from, to, altFrom, altTo) {
  if (s.includes(from)) return s.replace(from, to);
  if (altFrom && s.includes(altFrom)) return s.replace(altFrom, altTo);
  throw new Error('prerender: expected markup not found — ' + from);
}

let written = 0;
for (const code of OUT_CODES) {
  for (const page of PAGES) {
    const out = outPath(code, page);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render(page, code));
    written++;
  }
  console.log(`  ${code === 'ko' ? '/ (ko)' : code + '/'}  ${PAGES.join(' ')}`);
}
console.log(`prerender: ${written} files written for ${OUT_CODES.length} languages`);

// ---- sitemap.xml ---------------------------------------------------------
// One URL per page per language, and no way for a crawler to enumerate them:
// GitHub Pages serves no index, and hreflang only tells a crawler about
// alternates of a page it has already found. Every entry carries the same
// seven alternates the page's own <head> declares, which is the form Google
// documents for a multilingual site — declaring them in the sitemap means the
// set is stated once per page rather than once per (page × language) fetch.
// The count is deliberately NOT written in this comment: it was, as "24 URLs
// (4 root + 4 × 5 languages)", and it stayed 24 after how-it-works.html made
// it 30 (round 13, -0.25). robots.txt carried the same stale number by hand;
// it is written from these arrays below.
{
  // OUT_CODES now contains 'ko' (the Korean copy is built like the other five
  // and lands at the root), so the separate Korean pass that used to stand
  // here would list the five root URLs twice.
  const urls = [];
  for (const code of OUT_CODES) for (const page of PAGES) urls.push(pageUrl(code, page));

  // x-default is English, matching the pages' own <head> and the boot script's
  // last resort: a visitor whose language is none of the six gets English, not
  // the Korean root.
  const alternatesFor = (page) => [
    ['x-default', pageUrl('en', page)],
    ...CODES.map(c => [HREFLANG[c], pageUrl(c, page)]),
  ];
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Generated by tools/prerender.mjs — do not hand-edit. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  for (const page of PAGES) {
    // OUT_CODES already starts with 'ko'; prefixing it again listed the five
    // root URLs twice.
    for (const code of OUT_CODES) {
      lines.push('  <url>');
      lines.push(`    <loc>${pageUrl(code, page)}</loc>`);
      for (const [tag, href] of alternatesFor(page)) {
        lines.push(`    <xhtml:link rel="alternate" hreflang="${tag}" href="${href}"/>`);
      }
      lines.push('  </url>');
    }
  }
  lines.push('</urlset>', '');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), lines.join('\n'));
  console.log(`prerender: sitemap.xml with ${urls.length} URLs`);

  // robots.txt says how many pages the sitemap lists, so a reader of the file
  // knows what it is promising. That sentence was maintained by hand and went
  // stale; it is generated here now, and check-content.mjs [11] fails if the
  // two ever disagree again.
  const robotsPath = path.join(ROOT, 'robots.txt');
  const robots = fs.readFileSync(robotsPath, 'utf8');
  const line = `# Pages: ${urls.length} (${PAGES.length} root x ${CODES.length} languages)`;
  if (!/^# Pages: .*$/m.test(robots)) throw new Error('prerender: robots.txt has no "# Pages:" line to write');
  const next = robots.replace(/^# Pages: .*$/m, line);
  if (next !== robots) { fs.writeFileSync(robotsPath, next); console.log(`prerender: robots.txt ${line.slice(2)}`); }
}
