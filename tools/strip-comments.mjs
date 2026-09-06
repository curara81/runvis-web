/* Take the comments out of the inline <style> and <script> of BUILD OUTPUT.
 *
 * WHY. index.html is 36 KB of CSS and 38 KB of JS inlined, and about 26 KB of
 * that is comments — 20% of the document — copied verbatim into each of the
 * twenty-five prerendered files (2026-09-06 라운드 14, -0.3). Those comments
 * earn their place in the SOURCE: they are why the markup looks the way it
 * does, and every round has added one. They earn nothing in a generated file
 * whose first line already says "do not edit — regenerate". This is exactly the
 * argument tools/prerender.mjs step 9b makes about HTML comments, applied to
 * the other two languages in the file.
 *
 * WHY NOT A MINIFIER. There isn't one here: no package.json, no node_modules,
 * and adding esbuild or lightningcss makes a static site that currently builds
 * with nothing but `node` depend on an install step. What that would buy over
 * this is renaming locals and rewriting selectors — the part with the risk.
 * So this does the safe 80%: comments out, blank lines out, indentation out.
 * Nothing is reordered, nothing is renamed, no token is joined to another.
 *
 * SAFETY. Both strippers are scanners, not regexes, because "//" lives inside
 * https:// and "/*" can live inside a CSS string. Each one collects every
 * string / template / regex literal it walks past, and the caller asserts that
 * the same list comes back out of the stripped text: if a stripper ever ate a
 * literal or grew one, that fails loudly instead of shipping. prerender.mjs
 * additionally parses every stripped script before writing it.
 */

/** Result shape: { text, literals } — literals are what the scan walked past. */

const REGEX_OK_BEFORE = new Set([
  '', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*',
  '%', '~', '^', '<', '>', '\n',
]);
const REGEX_OK_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await',
]);

/** Could a `/` at this point start a regex literal rather than a division? */
function regexAllowed(out) {
  let i = out.length - 1;
  while (i >= 0 && /\s/.test(out[i])) i--;
  if (i < 0) return true;
  const ch = out[i];
  if (REGEX_OK_BEFORE.has(ch)) return true;
  if (/[A-Za-z0-9_$]/.test(ch)) {
    let j = i;
    while (j >= 0 && /[A-Za-z0-9_$]/.test(out[j])) j--;
    return REGEX_OK_KEYWORDS.has(out.slice(j + 1, i + 1));
  }
  return false;
}

/**
 * Remove JS comments, keeping every newline (so automatic semicolon insertion
 * cannot change meaning) and every literal untouched.
 */
export function stripJs(src) {
  let out = '';
  const literals = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    // ---- comments ----
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;                                   // the \n itself is kept below
    }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const body = src.slice(i, end < 0 ? n : end + 2);
      i = end < 0 ? n : end + 2;
      // A block comment spanning lines still has to leave its newlines, or two
      // statements that were on different lines become one.
      out += '\n'.repeat((body.match(/\n/g) || []).length);
      continue;
    }
    // ---- literals ----
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      const lit = src.slice(i, Math.min(j + 1, n));
      literals.push(lit); out += lit; i = j + 1; continue;
    }
    if (c === '`') {
      // Template literals nest ${ … } which can contain more strings; walking
      // them properly matters because their whitespace IS content.
      let j = i + 1, depth = 0;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (depth === 0 && src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0 && src[j] === '}') { depth--; j++; continue; }
        j++;
      }
      const lit = src.slice(i, Math.min(j + 1, n));
      literals.push(lit); out += lit; i = j + 1; continue;
    }
    if (c === '/' && regexAllowed(out)) {
      let j = i + 1, klass = false, ok = false;
      while (j < n) {
        const e = src[j];
        if (e === '\\') { j += 2; continue; }
        if (e === '\n') break;                    // not a regex after all
        if (e === '[') klass = true;
        else if (e === ']') klass = false;
        else if (e === '/' && !klass) { ok = true; break; }
        j++;
      }
      if (ok) {
        let k = j + 1;
        while (k < n && /[a-z]/.test(src[k])) k++;  // flags
        const lit = src.slice(i, k);
        literals.push(lit); out += lit; i = k; continue;
      }
    }
    out += c; i++;
  }
  return { text: tidy(out), literals };
}

/** Trailing spaces and blank lines out; indentation out where it is code. */
function tidy(text) {
  return text
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .filter(line => line !== '')
    .join('\n');
}

/**
 * Remove CSS comments. CSS strings can contain "/*", so this is a scan too;
 * everything else about the sheet is left alone.
 */
export function stripCss(src) {
  let out = '';
  const literals = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      const lit = src.slice(i, Math.min(j + 1, n));
      literals.push(lit); out += lit; i = j + 1; continue;
    }
    out += c; i++;
  }
  // Indentation and blank lines carry nothing in CSS.
  return {
    text: out.split('\n').map(l => l.trim()).filter(Boolean).join('\n'),
    literals,
  };
}

/** Same scan over the OUTPUT must see the same literals. */
export function sameLiterals(a, b) {
  return a.length === b.length && a.every((x, k) => x === b[k]);
}
