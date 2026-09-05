/* Shared helpers for the prerender build step and the content checker.
 *
 * Both of them need the same two things: the six dictionaries as plain
 * objects, and a way to walk the [data-i18n] elements of a page without
 * pulling in an HTML parser. The walker below is deliberately narrow — it only
 * understands the markup this site actually writes — and every assumption it
 * makes is asserted rather than silently worked around, because a build step
 * that quietly mangles one tag is worse than one that stops.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CODES = ['ko', 'en', 'ja', 'es', 'zh', 'de'];
export const PAGES = ['index.html', 'run.html', 'privacy.html', 'terms.html'];

/** <html lang> / og:locale / JSON-LD inLanguage per code. */
export const HTML_LANG = { ko: 'ko', en: 'en', ja: 'ja', es: 'es', zh: 'zh-Hant', de: 'de' };
export const OG_LOCALE = { ko: 'ko_KR', en: 'en_US', ja: 'ja_JP', es: 'es_ES', zh: 'zh_TW', de: 'de_DE' };

/** The iPhone frames that exist per language (i18n.js SHOTS, kept in step). */
export const SHOTS = new Set([
  'framed-phone-dash', 'framed-phone-detail', 'framed-phone-glance',
  'framed-phone-plan', 'framed-phone-race',
]);

/** Elements that never have content, so never carry translatable inner text. */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Load t-<code>.js the way the browser does, into a plain object. */
export function loadDicts() {
  const sandbox = { window: {} };
  sandbox.window.RunvisOnDict = () => {};
  vm.createContext(sandbox);
  for (const code of CODES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, `t-${code}.js`), 'utf8'), sandbox);
  }
  const dicts = sandbox.window.RUNVIS_I18N;
  for (const code of CODES) if (!dicts[code]) throw new Error(`dictionary missing: ${code}`);
  return dicts;
}

/** Strip tags and collapse whitespace — the same `plain()` i18n.js uses. */
export function plain(html) {
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Escape for an attribute value written with double quotes. */
export function attrEscape(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Byte ranges of <script>…</script> and <style>…</style> bodies. The page's own
 * boot code contains the literal `'[data-i18n="'+k+'"]'`, so a scan that did
 * not skip script bodies would try to translate a selector.
 */
function codeRanges(html) {
  const ranges = [];
  for (const tag of ['script', 'style']) {
    const open = '<' + tag, close = '</' + tag;
    let i = html.indexOf(open);
    while (i >= 0) {
      const bodyStart = html.indexOf('>', i);
      const bodyEnd = html.indexOf(close, bodyStart);
      if (bodyStart < 0 || bodyEnd < 0) break;
      ranges.push([bodyStart, bodyEnd]);
      i = html.indexOf(open, bodyEnd);
    }
  }
  return ranges;
}
const inRanges = (ranges, at) => ranges.some(([a, b]) => at > a && at < b);

/**
 * Every [data-i18n] element in `html`, as {key, tag, innerStart, innerEnd}.
 * innerStart/innerEnd bound the element's content, which is what i18n.js
 * overwrites with innerHTML at runtime.
 */
export function findI18nElements(html) {
  const out = [];
  const skip = codeRanges(html);
  const marker = 'data-i18n="';
  for (let at = html.indexOf(marker); at >= 0; at = html.indexOf(marker, at + 1)) {
    if (inRanges(skip, at)) continue;
    // `data-i18n-attr="` also starts with `data-i18n` but not with `data-i18n="`.
    const keyEnd = html.indexOf('"', at + marker.length);
    if (keyEnd < 0) throw new Error('unterminated data-i18n at ' + at);
    const key = html.slice(at + marker.length, keyEnd);
    const tagStart = html.lastIndexOf('<', at);
    if (tagStart < 0) throw new Error('no tag start for ' + key);
    const nameMatch = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(tagStart, tagStart + 24));
    if (!nameMatch) throw new Error('no tag name for ' + key);
    const tag = nameMatch[1].toLowerCase();
    const openEnd = html.indexOf('>', keyEnd);
    if (openEnd < 0) throw new Error('unterminated open tag for ' + key);
    if (VOID.has(tag)) continue;                       // nothing to translate inside
    // Matching close tag, counting nested elements of the SAME name only.
    let depth = 1, i = openEnd + 1, innerEnd = -1;
    const open = '<' + tag, close = '</' + tag;
    while (i < html.length) {
      const nO = html.indexOf(open, i), nC = html.indexOf(close, i);
      if (nC < 0) break;
      if (nO >= 0 && nO < nC) { depth++; i = nO + open.length; continue; }
      depth--;
      if (depth === 0) { innerEnd = nC; break; }
      i = nC + close.length;
    }
    if (innerEnd < 0) throw new Error('no closing </' + tag + '> for ' + key);
    out.push({ key, tag, innerStart: openEnd + 1, innerEnd });
  }
  return out;
}

/** Every data-i18n-attr binding, as {attr, key, valueStart, valueEnd}. */
export function findI18nAttrs(html) {
  const out = [];
  const skip = codeRanges(html);
  const marker = 'data-i18n-attr="';
  for (let at = html.indexOf(marker); at >= 0; at = html.indexOf(marker, at + 1)) {
    if (inRanges(skip, at)) continue;
    const end = html.indexOf('"', at + marker.length);
    const spec = html.slice(at + marker.length, end);
    const tagStart = html.lastIndexOf('<', at);
    const openEnd = html.indexOf('>', end);
    for (const pair of spec.split(',')) {
      const bits = pair.split(':');
      if (bits.length !== 2) continue;
      const attr = bits[0].trim(), key = bits[1].trim();
      // Locate that attribute inside this one open tag.
      const openTag = html.slice(tagStart, openEnd);
      const m = new RegExp('\\b' + attr.replace(/[^\w-]/g, '') + '="').exec(openTag);
      if (!m) continue;
      const vs = tagStart + m.index + m[0].length;
      const ve = html.indexOf('"', vs);
      out.push({ attr, key, valueStart: vs, valueEnd: ve });
    }
  }
  return out;
}

/** Apply a list of {start,end,text} edits to `html`, right to left. */
export function spliceAll(html, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = html;
  for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** The FAQPage JSON-LD this page should be carrying, for one language. */
export function faqLd(dict, code, count = 10) {
  const items = [];
  for (let i = 1; i <= count; i++) {
    const q = dict['n.faq.q' + i], a = dict['n.faq.a' + i];
    if (!q || !a) throw new Error(`FAQ ${code}: n.faq.q${i}/a${i} missing`);
    items.push({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } });
  }
  return { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: HTML_LANG[code], mainEntity: items };
}

/** The SoftwareApplication JSON-LD, for one language. Prices stay in KRW. */
export function appLd(dict, code) {
  const offers = [
    { name: 'Runvis Coach Monthly', price: '1900', category: 'subscription' },
    { name: 'Runvis Coach Yearly', price: '15000', category: 'subscription' },
    { name: 'Runvis Coach Lifetime', price: '39000', category: 'one-time' },
  ];
  return {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Runvis',
    applicationCategory: 'HealthApplication', operatingSystem: 'watchOS, iOS',
    inLanguage: HTML_LANG[code], url: 'https://runvis.app/',
    description: plain(dict['meta.desc'] || ''),
    offers: offers.map(o => ({ '@type': 'Offer', name: o.name, price: o.price, priceCurrency: 'KRW', category: o.category })),
  };
}

/** Read the JSON out of <script id="..." type="application/ld+json">. */
export function readLd(html, id) {
  const open = `<script id="${id}" type="application/ld+json">`;
  const i = html.indexOf(open);
  if (i < 0) return null;
  const j = html.indexOf('</script>', i);
  return { start: i + open.length, end: j, json: html.slice(i + open.length, j).trim() };
}
