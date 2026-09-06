/* Prerender the five non-Korean copies of the site.
 *
 *   node tools/prerender.mjs
 *
 * Writes /en/, /ja/, /es/, /zh/, /de/ — one directory per market, each with
 * index.html, run.html, privacy.html and terms.html. Korean stays at the root
 * and is the x-default.
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
  ROOT, CODES, PAGES, HTML_LANG, HREFLANG, OG_LOCALE, SHOTS,
  loadDicts, attrEscape, findI18nElements, findI18nAttrs, spliceAll,
  faqLd, appLd, pageLd, readLd,
} from './i18n-lib.mjs';

const dicts = loadDicts();
const OUT_CODES = CODES.filter(c => c !== 'ko');

const BANNER = (code, page) => `<!-- GENERATED FILE — do not edit.
     tools/prerender.mjs built this from /${page} and t-${code}.js.
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

/** The "this file goes out to all six languages" notes are true of the Korean
 *  root pages and false of these copies — every string below is already in one
 *  language. Replacing them keeps the next reader from acting on a stale note.
 *
 *  The markers below are literal slices of the root pages' comments. If you
 *  reword one of those comments, reword the marker with it — replaceBlock is a
 *  no-op when it cannot find the pair, and the copies would silently keep a
 *  note that contradicts them. `node tools/check-content.mjs` catches the
 *  drift, because [5] re-renders and compares. */
function retireBilingualNotes(html, code) {
  const note = `<!-- Prerendered ${code} copy. Every crawler-visible string on this page is
     already ${code}: title, description, og:*, canonical, the JSON-LD below and
     the body text were substituted at build time out of t-${code}.js, so a
     search engine or link preview that runs no JavaScript still reads this
     market's page. i18n.js still runs and still lets a reader switch
     languages; it just has nothing left to correct on first paint. -->`;
  html = replaceBlock(html, '<!-- THIS file is the Korean document', 'the root now is. -->', note);
  html = replaceBlock(html, '<!-- Korean only — see the same note in index.html.', 'pages for the other markets. -->', note);
  html = replaceBlock(html, '<!-- Korean only, like index.html.', 'markets and hreflang points at them. -->', note);
  html = replaceBlock(html, '<!-- Six share cards, one per market.', 'ever rendered it. -->',
    `<!-- This market's share card: tools/og_cards.py drew its own n.hero.h1 onto
     tools/og-card-base.png. -->`);
  html = replaceBlock(html, '<!-- Language-neutral card: mark, watch and pulse only, no sentence in any',
    'language. One HTML file serves every ?lang= and crawlers run no JS. -->',
    `<!-- Language-neutral card: mark, watch and pulse only, no sentence in any
     language. -->`);
  return html;
}

/** Absolute site path for one page in one language. */
function pageUrl(code, page) {
  const dir = code === 'ko' ? '/' : `/${code}/`;
  return page === 'index.html' ? `https://runvis.app${dir}` : `https://runvis.app${dir}${page}`;
}

function render(page, code) {
  const dict = dicts[code];
  let html = fs.readFileSync(path.join(ROOT, page), 'utf8');

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
  html = retireBilingualNotes(html, code);

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
  const charset = /<meta charset=["']?[^>]*>/i.exec(html);
  if (!charset) throw new Error('prerender: no <meta charset> in ' + page);
  const at = charset.index + charset[0].length;
  html = html.slice(0, at)
    + `\n<script>window.RunvisPageLang=${JSON.stringify(code)};window.RunvisBase="/";</script>`
    + html.slice(at);

  // ---- 6. relative URLs, from a subdirectory ------------------------------
  // Only the things that live at the site ROOT need rewriting. Page-to-page
  // links stay relative on purpose: href="privacy.html" inside /de/ already
  // resolves to /de/privacy.html, and leaving them alone means the dictionary
  // values that CONTAIN such links (n.beta.do1, pv.s10.p, tm.s8.p) still match
  // the markup exactly — otherwise a language switch would rewrite the link
  // back and check-content.mjs would report drift that is not drift.
  html = replaceAll(html, 'src="assets/', 'src="/assets/');
  html = replaceAll(html, 'srcset="assets/', 'srcset="/assets/');
  html = replaceAll(html, 'href="gpx/', 'href="/gpx/');
  html = replaceAll(html, 'src="i18n.js?v=', 'src="/i18n.js?v=');

  // ---- 7. the localized iPhone captures, already in the markup ------------
  // Saves the runtime swap and, for the hero, the second download that used to
  // arrive after the Korean one had already painted.
  // Three files per capture since round 14 — the PNG the <img> names and the
  // AVIF and lossless WebP the two <source>s name (tools/encode_shots.py).
  // Rewriting only the PNG would have left every prerendered page showing the
  // KOREAN screenshot to any browser that can decode AVIF, under a correctly
  // localized <img src> that never got used.
  for (const base of SHOTS) {
    for (const ext of ['png', 'avif', 'webp']) {
      html = replaceAll(html, `/assets/${base}.${ext}`, `/assets/${base}.${code}.${ext}`);
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
  const card = `assets/og-card.${code}.png`;
  if (!fs.existsSync(path.join(ROOT, card))) {
    throw new Error(`prerender: ${card} is missing — run \`python3 tools/og_cards.py\``);
  }
  html = replaceAll(html, 'assets/og-card.png', card);

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
  const dir = path.join(ROOT, code);
  fs.mkdirSync(dir, { recursive: true });
  for (const page of PAGES) {
    fs.writeFileSync(path.join(dir, page), render(page, code));
    written++;
  }
  console.log(`  ${code}/  ${PAGES.join(' ')}`);
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
  const urls = [];
  for (const page of PAGES) urls.push(pageUrl('ko', page));
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
    for (const code of ['ko', ...OUT_CODES]) {
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
