/* Re-measure the numbers the homepage quotes about the app, out of the app
 * repository itself.
 *
 *   node tools/app-facts.mjs            # measure, write tools/app-facts.json
 *   node tools/app-facts.mjs --check    # measure, fail if app-facts.json is stale
 *   node tools/app-facts.mjs --print    # measure, print, write nothing
 *
 * WHY this exists. The trust block on index.html says, in six languages, that
 * every number in it "is counted straight out of the app repository". Those
 * numbers were maintained by hand and went stale in rounds 7, 8 and 9 — the
 * test count drifted 502 vs 506 and the string count 2,077 vs 2,118 — which is
 * the one drift that costs more than its size, because the paragraph's whole
 * claim is that its numbers are counted rather than invented.
 *
 * So the count lives in a file now. This script writes tools/app-facts.json,
 * that file is committed, and tools/check-content.mjs [9] fails when the six
 * dictionaries and that file disagree. The homepage repo can therefore be
 * checked on a machine with no app checkout; re-running THIS script is the
 * only step that needs one.
 *
 * Finding the app repo: $RUNVIS_APP_REPO, else ../SportsDashboard next to this
 * checkout, else ~/Developer/SportsDashboard.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { ROOT } from './i18n-lib.mjs';

export const OUT = path.join(ROOT, 'tools/app-facts.json');

/** The app checkout, or null when this machine has none. `measure()` still
 *  throws for a caller that needs it; check-content.mjs [0] asks first so it
 *  can print "skipped" rather than failing on a site-only checkout. */
export function locateAppRepo() {
  try { return findAppRepo(); } catch { return null; }
}

export function readFacts() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return null; }
}

function findAppRepo() {
  const tries = [
    process.env.RUNVIS_APP_REPO,
    path.resolve(ROOT, '..', 'SportsDashboard'),
    path.join(os.homedir(), 'Developer', 'SportsDashboard'),
  ].filter(Boolean);
  for (const dir of tries) {
    if (fs.existsSync(path.join(dir, 'Tests')) && fs.existsSync(path.join(dir, 'Shared'))) return dir;
  }
  throw new Error('app repo not found — set RUNVIS_APP_REPO to the SportsDashboard checkout\n  tried: ' + tries.join('\n         '));
}

/** Every *.swift under `dir`, recursively. */
function swiftFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...swiftFiles(p));
    else if (e.name.endsWith('.swift')) out.push(p);
  }
  return out;
}

/**
 * Key=value pairs in one .strings file, as {pairs, keys}. `pairs` counts LINES
 * and `keys` counts DISTINCT keys — they differ (2,130 vs 2,118 today) because
 * a handful of long glossary bodies are written under the same Korean key more
 * than once. The site quotes the distinct count, which is the number of
 * different sentences a reader can actually meet.
 */
function stringsCount(file) {
  const text = fs.readFileSync(file, 'utf8');
  const pairs = [...text.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*=\s*"(?:[^"\\]|\\.)*"\s*;/gm)].map(m => m[1]);
  return { pairs: pairs.length, keys: new Set(pairs).size };
}

/** The one value shared by a group of files, or a thrown error naming the odd one. */
function agreed(label, entries) {
  const values = [...new Set(entries.map(e => e[1]))];
  if (values.length !== 1) {
    throw new Error(`${label}: expected one value, got ${entries.map(e => `${e[0]}=${e[1]}`).join(', ')}`);
  }
  return values[0];
}

/* ---- 9. the arithmetic behind the intensity-mix sentence -----------------
 *
 * hw.vs.r7b says, in six languages, that a run's minutes are split into three
 * bands ONLY when the max-HR ceiling those bands are cut from is a real
 * measurement, and that an age-formula ceiling falls back to the run's average
 * heart rate. In 라운드 16 that sentence was true of the site and false of the
 * app: the gate asked `maxHRIsEstimated(manual:observed:)`, which is
 * `manual <= 0 && observed <= 0`, while the ceiling the bands are actually cut
 * from is `UserProfile.effectiveMaxHR` = `max(manual > 0 ? manual : estimated,
 * observed)`. A runner who never typed a max and whose watch once saw 158 bpm
 * passed the gate and got zone bands drawn on 208−0.7×age (-6, the round's
 * largest single deduction). Every check on this repo passed while that was
 * true, because every check compared STRINGS and COUNTS: [26] proves a quoted
 * Siri phrase exists, [13] proves a number in prose equals a number in Swift.
 * Neither can see a predicate that measures the wrong thing.
 *
 * So this measures the predicate by RUNNING it. It reads three expressions out
 * of the app — the max-HR conditions in `withZoneMinutes`'s guard, the same
 * conditions behind the "최대심박 추정치" tag, and `UserProfile`'s own
 * `estimatedMaxHR` / `effectiveMaxHR` — and evaluates all of them over four
 * profiles chosen to sit on the boundary that broke:
 *
 *   neverMeasured           manual 0,   observed 0    → ceiling = 180 (age)
 *   observedBelowEstimate   manual 0,   observed 158  → ceiling = 180 (age)  ← the 라운드 16 hole
 *   observedAboveEstimate   manual 0,   observed 185  → ceiling = 185 (watch)
 *   manualEntered           manual 190, observed 0    → ceiling = 190 (typed)
 *
 * `ceilingMeasured` is not asserted here, it is DERIVED: the app's own
 * `effectiveMaxHR` expression is evaluated for the row, and the ceiling counts
 * as measured when the number it returns is one of the two measured inputs
 * rather than the age formula's. check-content [28] then holds the three
 * tables against each other and against what the copy promises.
 *
 * Nothing in here throws. A predicate that this reader cannot follow is a
 * FACT about the app ("unreadable", with the reason), because the thing that
 * should fail is the invariant that leans on it — [28] names the copy keys
 * that just became unverified, which a thrown error in a measurement script
 * cannot do. Unreadable is never a pass.
 */
const PROFILE_FIELD = { maxHR: 'manual', observedMaxHR: 'observed', estimatedMaxHR: 'estimated' };

/** A computed var on `UserProfile` names the stored fields directly rather than
 *  through parameters, so its scope binds each field to itself. */
const PROFILE_SELF_BIND = { maxHR: 'manual', observedMaxHR: 'observed', estimatedMaxHR: 'estimated' };

/** Swift source with comments removed, string literals left alone. Brace and
 *  paren walking below would otherwise count a `{` inside a doc comment. */
function swiftStrip(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    if (two === '/*') {
      let depth = 1; i += 2;                       // Swift block comments nest
      while (i < src.length && depth) {
        if (src.slice(i, i + 2) === '/*') { depth++; i += 2; }
        else if (src.slice(i, i + 2) === '*/') { depth--; i += 2; }
        else i++;
      }
      out += ' '; continue;
    }
    if (src.slice(i, i + 3) === '"""') {
      const j = src.indexOf('"""', i + 3);
      const end = j < 0 ? src.length : j + 3;
      out += src.slice(i, end); i = end; continue;
    }
    if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    out += src[i++];
  }
  return out;
}

/** The text between the balanced delimiters that open at or after `from`. */
function balanced(src, from, open = '{', close = '}') {
  const start = src.indexOf(open, from);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close && !--depth) return { body: src.slice(start + 1, i), start, end: i };
  }
  return null;
}

/** Split on commas that are not inside (), [] or {}. */
function topLevelCommas(s) {
  const out = []; let depth = 0, last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { out.push(s.slice(last, i)); last = i + 1; }
  }
  out.push(s.slice(last));
  return out.map(x => x.trim()).filter(Boolean);
}

/** Evaluate a Swift arithmetic/boolean expression over `vars`.
 *  Deliberately narrow: an operator or a name this grammar does not know is a
 *  thrown error, never a `false`. A checker that silently reads an unfamiliar
 *  predicate as "safe" is the failure this whole section exists to prevent. */
const LITERALS = { true: true, false: false, nil: null };
function evalSwiftExpr(expr, vars) {
  const js = expr.replace(/\b(?:Double|Int|CGFloat|TimeInterval)\s*\(/g, '(')
                 .replace(/\bmax\s*\(/g, 'Math.max(')
                 .replace(/\bmin\s*\(/g, 'Math.min(')
                 .replace(/\bnil\b/g, 'null')
                 .replace(/\s+/g, ' ')
                 .trim();
  const bad = js.replace(/Math\.(?:max|min)/g, '').match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  for (const name of bad) {
    if (name === 'null' || name === 'true' || name === 'false') continue;
    if (!(name in vars)) throw new Error(`unknown name \`${name}\` in \`${expr}\``);
  }
  if (/[^A-Za-z0-9_.\s<>=!&|()?:+\-*/,]/.test(js)) {
    throw new Error(`unsupported syntax in \`${expr}\``);
  }
  const names = Object.keys(vars);
  // eslint-disable-next-line no-new-func
  const value = new Function(...names, `"use strict"; return (${js});`)(...names.map(n => vars[n]));
  if (typeof value !== 'boolean' && typeof value !== 'number') {
    throw new Error(`\`${expr}\` produced ${typeof value}, not a boolean or a number`);
  }
  return value;
}

/** Statements of a Swift body, one per line, with `{ … }` blocks kept whole. */
function statements(body) {
  const out = [];
  let cur = '', depth = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if ((c === '\n' || c === ';') && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Run a predicate body over `scope`. The grammar is four statements wide —
 * `if`, `guard`, `return`, and a trailing bare expression — and every other
 * shape throws. That narrowness IS the safety: this reader exists to catch a
 * predicate that measures the wrong thing, so a predicate it half-understands
 * has to stop the build rather than produce a plausible answer.
 */
function runBody(body, scope, depth = 0) {
  if (depth > 4) throw new Error('predicate nests deeper than this reader follows');
  const stmts = statements(body);
  for (const [i, st] of stmts.entries()) {
    let m;
    if ((m = /^if\s+([\s\S]+?)\s*\{([\s\S]*)\}\s*(?:else\s*\{([\s\S]*)\})?$/.exec(st))) {
      const taken = evalSwiftExpr(m[1], scope) ? m[2] : m[3];
      if (taken === undefined) continue;
      const r = runBody(taken, scope, depth + 1);
      if (r !== undefined) return r;
      continue;
    }
    if ((m = /^guard\s+([\s\S]+?)\s+else\s*\{([\s\S]*)\}$/.exec(st))) {
      let passed = true;
      for (const cond of topLevelCommas(m[1])) {
        const bind = /^let\s+([A-Za-z_]\w*)$/.exec(cond.trim());
        if (bind) { if (scope[bind[1]] === null || scope[bind[1]] === undefined) { passed = false; break; } continue; }
        if (/^(?:let|var|case)\b/.test(cond.trim())) throw new Error(`guard binding this reader does not follow: \`${cond.trim()}\``);
        if (!evalSwiftExpr(cond, scope)) { passed = false; break; }
      }
      if (passed) continue;
      const r = runBody(m[2], scope, depth + 1);
      if (r === undefined) throw new Error('guard else falls through without returning a value');
      return r;
    }
    if ((m = /^return\s+([\s\S]+)$/.exec(st))) return evalSwiftExpr(m[1], scope);
    if (i === stmts.length - 1 && !/[{}]/.test(st)) return evalSwiftExpr(st, scope);
    throw new Error(`statement this reader does not follow: \`${st.slice(0, 80)}\``);
  }
  return undefined;
}

/** `var name: T { <expression> }`, as its expression. */
function computedVar(src, name) {
  const at = new RegExp(`var\\s+${name}\\s*:\\s*\\w+\\??\\s*\\{`).exec(src);
  if (!at) return null;
  const b = balanced(src, at.index);
  return b ? b.body.trim() : null;
}

/** `static func name(a: T, b: T) -> Bool { <expression> }`, as
 *  {params: ['a','b'], expr}. Only single-expression bodies: a predicate that
 *  grew statements is one this reader must not guess at. */
function boolFunc(src, name) {
  const at = new RegExp(`func\\s+${name}\\s*\\(`).exec(src);
  if (!at) return null;
  const args = balanced(src, at.index, '(', ')');
  if (!args) return null;
  const params = topLevelCommas(args.body).map(p => {
    // `label name: Type`, `name: Type`, `name: Type? = nil`.
    const m = /^(?:([A-Za-z_]\w*)\s+)?([A-Za-z_]\w*)\s*:\s*([^=]+?)\s*(?:=\s*(\S+))?$/.exec(p.trim());
    return m ? { label: m[1] ?? m[2], name: m[2], hasDefault: m[4] !== undefined, default: m[4] } : null;
  });
  if (params.some(p => !p)) return null;
  const body = balanced(src, args.end);
  return body ? { params, body: body.body } : null;
}

/** Which profile field an argument expression reads, or null. */
function fieldOf(expr) {
  const m = /(?:^|\.)\s*([A-Za-z_]\w*)\s*$/.exec(expr.trim());
  return m && PROFILE_FIELD[m[1]] ? m[1] : null;
}

/**
 * Every condition inside `text` that depends on the runner's max-HR fields,
 * resolved to something evaluable. Conditions that mention none of the three
 * fields are returned in `ignored` rather than dropped, so the fact records
 * what this reader decided was none of its business.
 */
function maxHRConditions(text, resolve) {
  const conds = [], ignored = [], unreadable = [];
  for (const raw of topLevelCommas(text.replace(/\n/g, ' '))) {
    // `profile.map { <cond> } ?? true` — the tile reads an OPTIONAL profile, so
    // its predicate is wrapped. The wrapper's `?? true` is the no-profile answer
    // (conservative: assume estimated); the fixtures below always supply a
    // profile, so the condition inside is what this reader must evaluate.
    let cond = raw.trim();
    for (;;) {
      const wrap = /^[A-Za-z_$][\w.$]*\s*\.\s*map\s*\{/.exec(cond);
      if (!wrap) break;
      const inner = balanced(cond, wrap.index + wrap[0].length - 1);
      if (!inner) break;
      const rest = cond.slice(inner.end + 1).trim();
      if (rest && !/^\?\?\s*(?:true|false)$/.test(rest)) break;
      cond = inner.body.trim();
    }
    if (!/\b(?:maxHR|observedMaxHR|estimatedMaxHR|maxHRIsMeasured)\b/.test(cond)) { ignored.push(cond); continue; }
    // (0) a computed var ON THE PROFILE: `!$0.maxHRIsMeasured`. Round 16 moved
    // the tile onto `UserProfile.maxHRIsMeasured` so that it retraces the branch
    // `effectiveMaxHR` actually takes; that form takes no arguments, so the
    // call-shaped reader below cannot see it. Inline the var's body and carry
    // on — the point of [28] is to follow the predicate, not one spelling of it.
    const member = /^(!?)\s*(?:[A-Za-z_$]\w*|\$\d+)\s*\.\s*([A-Za-z_]\w*)\s*$/.exec(cond);
    if (member) {
      const decl = resolve(member[2]);
      if (!decl) { unreadable.push(`${cond} — no single-expression declaration of \`${member[2]}\` found`); continue; }
      if (decl.params.length) { unreadable.push(`${cond} — \`${member[2]}\` takes arguments but is used as a property`); continue; }
      conds.push({ source: cond, negated: member[1] === '!', bind: PROFILE_SELF_BIND, defaults: {}, body: decl.body });
      continue;
    }
    // (a) a named predicate: `!Type.name(label: a.maxHR, label: a.observedMaxHR)`
    const call = /(!?)\s*(?:[A-Za-z_]\w*\s*\.\s*)?([A-Za-z_]\w*)\s*\(/.exec(cond);
    const args = call ? balanced(cond, call.index, '(', ')') : null;
    if (call && args && /^\s*\)?\s*[}?\s]*$/.test(cond.slice(args.end + 1).replace(/\?\?\s*(?:true|false)/, ''))) {
      const decl = resolve(call[2]);
      if (!decl) { unreadable.push(`${cond} — no single-expression declaration of \`${call[2]}\` found`); continue; }
      const bound = {};
      let bad = null;
      for (const [i, part] of topLevelCommas(args.body).entries()) {
        const m = /^([A-Za-z_]\w*)\s*:\s*([\s\S]+)$/.exec(part);
        const value = m ? m[2] : part;
        const param = m ? (decl.params.find(p => p.label === m[1]) ?? decl.params[i]) : decl.params[i];
        const field = fieldOf(value);
        if (!param || !field) { bad = `${cond} — argument \`${part.trim()}\` is not one of ${Object.keys(PROFILE_FIELD).join('/')}`; break; }
        bound[param.name] = field;
      }
      if (bad) { unreadable.push(bad); continue; }
      // A parameter this call does not pass falls back to its own default —
      // which is how `AtAGlanceView` and the loader can read the SAME
      // predicate and answer differently, the tile omitting `estimated:` and
      // getting the conservative answer. Recording the default rather than
      // refusing is what lets [28] see that difference instead of hiding it.
      const unbound = decl.params.filter(p => !(p.name in bound));
      const noDefault = unbound.filter(p => !p.hasDefault);
      if (noDefault.length) { unreadable.push(`${cond} — \`${call[2]}\` parameter(s) ${noDefault.map(p => p.name).join(', ')} are neither passed nor defaulted`); continue; }
      const defaults = Object.fromEntries(unbound.map(p => [p.name, p.default]));
      conds.push({ kind: 'call', negated: call[1] === '!', name: call[2], body: decl.body, bind: bound, defaults, source: cond });
      continue;
    }
    // (b) the condition written inline: `profile.maxHR > 0 || profile.observedMaxHR >= profile.estimatedMaxHR`
    const bind = {};
    const inline = cond.replace(/(?:[A-Za-z_$]\w*\s*\.\s*)*([A-Za-z_]\w*)/g, (whole, tail) =>
      PROFILE_FIELD[tail] ? ((bind[tail] = tail), tail) : whole);
    if (Object.keys(bind).length) {
      conds.push({ kind: 'inline', negated: false, name: null, body: inline, bind: Object.fromEntries(Object.keys(bind).map(f => [f, f])), defaults: {}, source: cond });
      continue;
    }
    unreadable.push(cond);
  }
  return { conds, ignored, unreadable };
}

const ZONE_GATE_FILES = {
  LOADER: 'iOSApp/Services/PerformanceScoreLoader.swift',
  TILE: 'iOSApp/Views/AtAGlanceView.swift',
  PROFILE: 'Shared/Models/UserProfile.swift',
  SCORES: 'Shared/Services/PerformanceScores.swift',
};

function measureZoneGate(app) {
  const read = (rel) => {
    const p = path.join(app, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  };
  return zoneGateFrom({
    loader: read(ZONE_GATE_FILES.LOADER), tile: read(ZONE_GATE_FILES.TILE),
    profile: read(ZONE_GATE_FILES.PROFILE), scores: read(ZONE_GATE_FILES.SCORES),
  });
}

/** The whole measurement as a pure function of four Swift sources, so that
 *  check-content [28] can run it over two fixtures — the predicate that was
 *  wrong in 라운드 16 and the one that replaced it — and prove this reader can
 *  still tell them apart. A checker nobody checks is how the string-grep
 *  alibi got here in the first place. */
export function zoneGateFrom(src) {
  const unreadable = (why, extra = {}) => ({ readable: false, why, ...extra });
  const { LOADER, TILE, PROFILE, SCORES } = ZONE_GATE_FILES;
  if (!src.loader || !src.tile || !src.profile || !src.scores) return unreadable('one of the four files this reads is gone');
  const loader = swiftStrip(src.loader), tile = swiftStrip(src.tile);
  const profile = swiftStrip(src.profile), scores = swiftStrip(src.scores);

  // The two expressions the ceiling itself is made of.
  const estimatedExpr = computedVar(profile, 'estimatedMaxHR');
  const effectiveExpr = computedVar(profile, 'effectiveMaxHR');
  if (!estimatedExpr || !effectiveExpr) {
    return unreadable(`${PROFILE}: estimatedMaxHR / effectiveMaxHR are no longer single-expression computed vars`);
  }

  // A predicate named at either site is resolved out of whichever of the two
  // files declares it.
  const asVar = (src, name) => {
    const body = computedVar(src, name);
    return body === null ? null : { params: [], body };
  };
  const resolve = (name) => boolFunc(scores, name) ?? boolFunc(tile, name) ?? boolFunc(loader, name)
                         ?? asVar(profile, name) ?? asVar(scores, name);

  // The gate: the max-HR conditions of `withZoneMinutes`'s guard.
  const fnAt = /func\s+withZoneMinutes\s*\(/.exec(loader);
  if (!fnAt) return unreadable(`${LOADER}: no withZoneMinutes — the zone-minute path was renamed or removed`);
  const fnBody = balanced(loader, balanced(loader, fnAt.index, '(', ')').end);
  if (!fnBody) return unreadable(`${LOADER}: withZoneMinutes has no readable body`);
  const guardAt = /\bguard\b/.exec(fnBody.body);
  if (!guardAt) return unreadable(`${LOADER}: withZoneMinutes no longer guards at all`);
  const guardText = fnBody.body.slice(guardAt.index + 5, fnBody.body.indexOf('else', guardAt.index));
  const gate = maxHRConditions(guardText, resolve);

  // The disclosure: the predicate behind the "최대심박 추정치" tag.
  const tagExpr = computedVar(tile, 'maxHRIsEstimated');
  const tag = tagExpr ? maxHRConditions(tagExpr, resolve)
                      : { conds: [], ignored: [], unreadable: [`${TILE}: no maxHRIsEstimated computed var`] };

  if (gate.unreadable.length || tag.unreadable.length) {
    return unreadable('a max-HR condition is written in a form this reader cannot evaluate',
                      { blocked: [...gate.unreadable, ...tag.unreadable] });
  }
  if (!gate.conds.length) {
    return unreadable(`${LOADER}: withZoneMinutes's guard no longer tests the max-HR ceiling at all`,
                      { ignoredConditions: gate.ignored });
  }
  if (!tag.conds.length) {
    return unreadable(`${TILE}: the estimate tag no longer tests the max-HR ceiling at all`);
  }

  const AGE = 40;
  const ROWS = {
    neverMeasured: { maxHR: 0, observedMaxHR: 0 },
    observedBelowEstimate: { maxHR: 0, observedMaxHR: 158 },
    observedAboveEstimate: { maxHR: 0, observedMaxHR: 185 },
    manualEntered: { maxHR: 190, observedMaxHR: 0 },
  };
  const all = (conds, vars) => conds.every(c => {
    const scope = Object.fromEntries(Object.entries(c.bind).map(([param, field]) => [param, vars[field]]));
    for (const [name, literal] of Object.entries(c.defaults)) {
      scope[name] = literal in LITERALS ? LITERALS[literal] : Number(literal);
      if (scope[name] !== null && !Number.isFinite(scope[name]) && typeof scope[name] !== 'boolean') {
        throw new Error(`default \`${literal}\` for ${name} is not a literal this reader knows`);
      }
    }
    const v = runBody(c.body, scope);
    if (typeof v !== 'boolean') throw new Error(`\`${c.source.trim()}\` did not produce a boolean`);
    return c.negated ? !v : v;
  });

  const rows = {};
  try {
    for (const [name, io] of Object.entries(ROWS)) {
      const estimated = evalSwiftExpr(estimatedExpr, { age: AGE });
      const vars = { ...io, estimatedMaxHR: estimated };
      const effective = evalSwiftExpr(effectiveExpr, vars);
      rows[name] = {
        manual: io.maxHR, observed: io.observedMaxHR, estimated, effective,
        // Derived from the app's OWN effectiveMaxHR, not asserted here: the
        // ceiling is a measurement exactly when the number the app divides by
        // is one the runner or the watch supplied.
        ceilingMeasured: (io.maxHR > 0 && effective === io.maxHR)
                      || (io.observedMaxHR > 0 && effective === io.observedMaxHR),
        zoneSplit: all(gate.conds, vars),
        estimateTagShown: all(tag.conds, vars),
      };
    }
  } catch (e) {
    return unreadable('a max-HR condition would not evaluate — ' + e.message);
  }

  const describe = (c) => (c.negated ? '!' : '')
    + (c.name ? `${c.name}(${[...Object.entries(c.bind).map(([p, f]) => `${p}: ${f}`),
                             ...Object.entries(c.defaults).map(([p, d]) => `${p}: ${d} (default)`)].join(', ')})`
              : c.body.replace(/\s+/g, ' ').trim());
  return {
    readable: true,
    age: AGE,
    gateSite: LOADER, tagSite: TILE,
    gate: gate.conds.map(describe),
    tag: tag.conds.map(describe),
    predicates: Object.fromEntries([...gate.conds, ...tag.conds].filter(c => c.name)
      .map(c => [c.name, c.body.replace(/\s+/g, ' ').trim()])),
    estimatedMaxHR: estimatedExpr.replace(/\s+/g, ' '),
    effectiveMaxHR: effectiveExpr.replace(/\s+/g, ' '),
    rows,
  };
}

export function measure(app = findAppRepo()) {
  // 1. tests — unique `func test…` names across Tests/*.swift.
  const testFiles = fs.readdirSync(path.join(app, 'Tests')).filter(f => f.endsWith('.swift'));
  const testNames = new Set();
  for (const f of testFiles) {
    const text = fs.readFileSync(path.join(app, 'Tests', f), 'utf8');
    for (const m of text.matchAll(/func\s+(test[A-Za-z0-9_]*)\s*\(/g)) testNames.add(m[1]);
  }

  // 2. interface strings — the six Localizable.strings must agree key for key.
  const lprojs = ['ko', 'en', 'ja', 'es', 'de', 'zh-Hant'];
  const counts = lprojs.map(l => [l, stringsCount(path.join(app, 'Shared/Resources', `${l}.lproj`, 'Localizable.strings'))]);
  const stringKeys = agreed('Localizable.strings distinct keys', counts.map(([l, c]) => [l, c.keys]));
  const stringLines = agreed('Localizable.strings key=value lines', counts.map(([l, c]) => [l, c.pairs]));

  // 3. coach voice tables — four files, one entry per `"key":` at line start.
  const tables = ['ja', 'es', 'zh', 'de'].map(code => {
    const file = path.join(app, 'Shared/Services', `CoachTranslations+${code}.swift`);
    const text = fs.readFileSync(file, 'utf8');
    return [code, [...text.matchAll(/^\s*"(?:[^"\\]|\\.)*"\s*:/gm)].length];
  });
  const coachTable = agreed('CoachTranslations tables', tables);

  // 4. metric explanations — `return Entry(` sites in MetricGlossary.swift.
  const glossary = (fs.readFileSync(path.join(app, 'Shared/Services/MetricGlossary.swift'), 'utf8')
    .match(/return Entry\(/g) || []).length;

  // 5. spoken lines — `Cue( ko:` construction sites in the shipping sources
  //    (Tests excluded). The page states a FLOOR ("270+"), so this only has to
  //    stay above it.
  let cueSites = 0;
  for (const top of ['iOSApp', 'WatchApp', 'Shared']) {
    for (const f of swiftFiles(path.join(app, top))) {
      cueSites += (fs.readFileSync(f, 'utf8').match(/Cue\(\s*ko:/g) || []).length;
    }
  }

  // 5b. how many KINDS of notification the app can post. privacy.html lists
  //     them by name, and the list was two short: it named five while the app
  //     had seven, and the two it omitted were the two commercial ones — the
  //     post-purchase onboarding push and the win-back push a week after
  //     cancelling (2026-09-06 라운드 15, -1.2). A privacy page that lists five
  //     of seven purposes is read as listing all of them, so the omission is
  //     the expensive kind. Counting them here means the next notification
  //     someone adds fails check-content [25] instead of quietly making the
  //     page wrong again.
  //     Distinct identifiers, because plan-day reminders share one call site
  //     across seven weekdays and are one KIND to a reader.
  const notifyKinds = new Set();
  for (const top of ['iOSApp', 'WatchApp', 'Shared']) {
    const dir = path.join(app, top);
    if (!fs.existsSync(dir)) continue;
    for (const f of swiftFiles(dir)) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/UNNotificationRequest\(\s*identifier:\s*(?:"([^"]+)"|([A-Za-z_][\w.]*)\()/g)) {
        notifyKinds.add(m[1] ?? m[2]);
      }
    }
  }
  if (notifyKinds.size === 0) {
    throw new Error('app-facts: found no UNNotificationRequest(identifier:) sites — the scan broke, or the app stopped posting notifications');
  }

  // 6. the coach-density constants the homepage repeats in prose. The app fixed
  //    this class of drift in round 7 by passing its constants into the paywall
  //    copy as format arguments; the site still writes them as literals in six
  //    dictionaries, so the next best thing is to MEASURE them here and let
  //    check-content [13] fail when a dictionary stops agreeing. Every one of
  //    these is a single literal in Shared/Services/CoachSessionProfile.swift,
  //    and a miss throws rather than silently reporting 0 — a check built on a
  //    quietly-failed regex is worse than no check.
  const profile = fs.readFileSync(path.join(app, 'Shared/Services/CoachSessionProfile.swift'), 'utf8');
  const one = (label, re) => {
    const m = re.exec(profile);
    if (!m) throw new Error(`${label}: not found in CoachSessionProfile.swift — the declaration was reworded`);
    return Number(m[1]);
  };
  const cueBudgetEasy = one('spokenBudgetPer30Min .easy', /case \.easy, \.long, \.runWalk: return (\d+)/);
  const cueBudgetTempo = one('spokenBudgetPer30Min .tempo', /case \.tempo, \.race, \.free: return (\d+)/);
  const cueMinGap = one('CoachCueSpacing.minGap', /static let minGap: TimeInterval = (\d+)/);
  const toggleList = /static let userToggleable:[^=]*=\s*\[([^\]]*)\]/.exec(profile);
  if (!toggleList) throw new Error('CoachCueCategory.userToggleable: not found in CoachSessionProfile.swift');
  // 6b. the two cues the site kept calling by one name. The site said "자세"
  //     for the STRIDE cue (CoachTriggerRules.StrideCueRules) on index.html and
  //     "자세" again for the FORM cue (FormDrift) on run.html, and printed one
  //     rule as the rule for both (2026-09-06 라운드 14, -1.2). The two now have
  //     the app's two names on the site, and both rules are measured here so a
  //     future rewording of either sentence is held against the right source.
  const strideCueSessionCap = one('CoachDensityRules.strideCueSessionCap',
    /static let strideCueSessionCap = (\d+)/);
  const drift = fs.readFileSync(path.join(app, 'Shared/Services/FormDrift.swift'), 'utf8');
  const fromDrift = (label, re, scale = 1) => {
    const m = re.exec(drift);
    if (!m) throw new Error(`${label}: not found in FormDrift.swift — the rule was reworded`);
    // toFixed keeps 0.08 * 100 from arriving as 8.000000000000002 in the JSON.
    return Number((Number(m[1]) * scale).toFixed(6));
  };
  //     evaluate()'s two-signal path, as the percentages the copy writes.
  const formCadDropSignalPct = fromDrift('cadDrop signal floor', /\(cadDrop > (0\.\d+) \? 1 : 0\)/, 100);
  const formGctRiseSignalPct = fromDrift('gctRise signal floor', /\(gctRise > (0\.\d+) \? 1 : 0\)/, 100);
  const formWarnDriftPct = fromDrift('two-signal drift threshold', /driftPct > ([\d.]+) && signals >= 2/);
  const formStrongDriftPct = fromDrift('one-signal drift threshold', /driftPct > ([\d.]+) && signals >= 1/);
  const formSustainSeconds = fromDrift('sustained seconds', /gctDriftSustainedSeconds >= (\d+)/);
  const formCadenceOnlySeconds = fromDrift('cadence-only sustained seconds', /cadDropSustainedSeconds >= (\d+)/);
  const formCadenceOnlyDropPct = fromDrift('cadence-only drop', /let warn = cadDrop >= (0\.\d+)/, 100);
  const cueToggles = toggleList[1].split(',').map(t => t.trim()).filter(Boolean).length;

  // 6c. how far out the race screen will fold a weather forecast in. The site
  //     said "15 days" in all six languages and the app says 16 in three
  //     places — the guard, the request, and the sentence on the screen
  //     (2026-09-06 라운드 16, -0.5). The site was the one losing a day, but a
  //     product and its page stating different numbers is the drift, whichever
  //     way it leans. Measured off the guard, because that is the value that
  //     decides whether the forecast is used at all; check-content [13] holds
  //     n.race.lb3 against it.
  const race = fs.readFileSync(path.join(app, 'WatchApp/Views/RacePredictionView.swift'), 'utf8');
  const raceHorizon = /guard days >= 0, days <= (\d+) else/.exec(race);
  if (!raceHorizon) throw new Error('RacePredictionView.swift: the forecast-horizon guard was reworded — the site quotes this number');
  const raceForecastHorizonDays = Number(raceHorizon[1]);

  // 6d. the two OS versions the FAQ names as the requirement. The hero now
  //     leads with "you need an Apple Watch Series 4 or later and an iPhone",
  //     because a visitor without one spent a scroll working out whether the
  //     page was for them at all (2026-09-06 라운드 16). A requirement stated
  //     on the first screen has to be the app's real one, so the two numbers
  //     come out of project.yml. The MODEL (Series 4) is Apple's mapping from
  //     watchOS 10, not a fact this repository holds; [12] instead keeps the
  //     hero and the FAQ from ever naming two different models.
  const proj = fs.readFileSync(path.join(app, 'project.yml'), 'utf8');
  const target = (label, re) => {
    const m = re.exec(proj);
    if (!m) throw new Error(`${label}: not found in project.yml — the site states this version as the requirement`);
    return Number(m[1]);
  };
  const watchOSMinMajor = target('deploymentTarget.watchOS', /deploymentTarget:\s*\n\s*watchOS:\s*"(\d+)/);
  const iOSMinMajor = target('deploymentTarget.iOS', /\n\s*deploymentTarget:\s*"(1[7-9]|[2-9]\d)\.\d+"/);

  // 6e. 지구력 훈련량 — the one paid tile whose method the site sold without
  //     ever printing (라운드 15 said so, 라운드 16 said so again, -0.7). The
  //     how-it-works table has a row for it now, and a row that states a
  //     formula has to state the app's numbers: two full-marks ceilings and
  //     the three weights they are blended with. All five are literals in
  //     PerformanceScores.enduranceScore, and each miss throws rather than
  //     reporting 0 — a quietly-failed regex here would let the row keep
  //     saying whatever it says.
  const scores = fs.readFileSync(path.join(app, 'Shared/Services/PerformanceScores.swift'), 'utf8');
  const fromScores = (label, re) => {
    const m = re.exec(scores);
    if (!m) throw new Error(`${label}: not found in PerformanceScores.swift — the endurance formula was reworded, and hw.vs.r12b prints it`);
    return Number(m[1]);
  };
  const enduranceWeeklyKmFull = fromScores('enduranceScore volume ceiling', /min\(weeklyKm \/ (\d+), 1\)/);
  const enduranceLongRunKmFull = fromScores('enduranceScore long-run ceiling', /min\(longest \/ (\d+), 1\)/);
  const blend = /\(volume \* (\d+) \+ long \* (\d+) \+ consistency \* (\d+)\)/.exec(scores);
  if (!blend) throw new Error('enduranceScore blend: not found in PerformanceScores.swift — hw.vs.r12b prints these three weights');
  const [enduranceVolumeWeight, enduranceLongRunWeight, enduranceConsistencyWeight] = blend.slice(1, 4).map(Number);

  // 7. the eight paid tiles (충격 부하 joined as the eighth), under the app's OWN name for each, in all six
  //    languages. The site repeats these names in the price list, in the gate
  //    conditions and in the screenshot alt text, and it had drifted four ways
  //    at once: 언덕 점수 (a name the app RETIRED in round 4 — the alt text
  //    still carried it) plus 坂の露出 / 坡道暴露 / Bergexposition, none of
  //    which the app uses. Nothing compared the two vocabularies, so the drift
  //    was invisible to every check. check-content [15] compares them now.
  //    The Korean literal IS the key in Localizable.strings, so a rename in the
  //    app throws here rather than silently reporting the old name.
  const TILE_KEYS = ['젖산 역치(추정)', '지구력 훈련량', '언덕 노출', '더위 노출 지수',
                     '코치 브레이크', '강도 분포', '코치 기록 레이더', '충격 부하'];
  const LPROJ_TO_WEB = { ko: 'ko', en: 'en', ja: 'ja', es: 'es', 'zh-Hant': 'zh', de: 'de' };
  const tiles = {};
  for (const [lproj, code] of Object.entries(LPROJ_TO_WEB)) {
    const text = fs.readFileSync(path.join(app, 'Shared/Resources', `${lproj}.lproj`, 'Localizable.strings'), 'utf8');
    for (const key of TILE_KEYS) {
      const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = new RegExp(`^\\s*"${esc}"\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*;`, 'm').exec(text);
      if (!m) throw new Error(`tile "${key}": no ${lproj} translation — the tile was renamed or removed, and the site says its old name`);
      (tiles[key] ||= {})[code] = m[1];
    }
  }

  // 8. the free period the price copy promises, out of the StoreKit config.
  //    index.html said "첫 기간이 무료" for the YEARLY plan in all six
  //    languages, which reads as a free year; the product's introductoryOffer
  //    is P1M (2026-09-06 라운드 14, -2.5). The copy states the month now, and
  //    stating it means it has to be measured — a hand-typed "1개월" in six
  //    dictionaries is the same rot the test count had.
  const storekit = JSON.parse(fs.readFileSync(path.join(app, 'Runvis.storekit'), 'utf8'));
  const subs = (storekit.subscriptionGroups || []).flatMap(g => g.subscriptions || []);
  if (!subs.length) throw new Error('Runvis.storekit: no subscriptions found — the file shape changed');
  const months = (period, what) => {
    const m = /^P(\d+)M$/.exec(period || '');
    if (!m) throw new Error(`Runvis.storekit: ${what} is "${period}", which is not a whole number of months — the copy says months`);
    return Number(m[1]);
  };
  const trials = subs.map(x => [x.referenceName, months(x.introductoryOffer?.subscriptionPeriod, `${x.referenceName} introductoryOffer`)]);
  const trialMonths = agreed('introductoryOffer.subscriptionPeriod', trials);
  const yearly = subs.find(x => x.recurringSubscriptionPeriod === 'P1Y');
  if (!yearly) throw new Error('Runvis.storekit: no P1Y subscription — the yearly product was renamed or removed');

  // 9. the predicate hw.vs.r7b leans on, measured by running it. See the long
  //    note above measureZoneGate: this is the one fact on this list that is a
  //    BEHAVIOUR rather than a count, because the copy it guards states a
  //    condition and a count cannot check a condition.
  const zoneGate = measureZoneGate(app);

  return {
    measuredAt: new Date().toISOString().slice(0, 10),
    appRepo: path.basename(app),
    tests: testNames.size,
    testFiles: testFiles.length,
    stringKeys,
    stringLines,
    coachTable,
    glossary,
    cueSites,
    // Held against privacy.html's notification list by check-content [25].
    notifyKinds: notifyKinds.size,
    notifyIds: [...notifyKinds].sort(),
    // Held against the six dictionaries by check-content [13].
    cueToggles,
    cueBudgetEasy,
    cueBudgetTempo,
    cueMinGap,
    strideCueSessionCap,
    formCadDropSignalPct,
    formGctRiseSignalPct,
    formWarnDriftPct,
    formStrongDriftPct,
    formSustainSeconds,
    formCadenceOnlySeconds,
    formCadenceOnlyDropPct,
    // Held against the six price paragraphs by check-content [18].
    trialMonths,
    // Held against n.race.lb3 by check-content [13].
    raceForecastHorizonDays,
    // Held against n.faq.a2 by check-content [13] — the requirement the hero
    // now states on the first screen.
    watchOSMinMajor,
    iOSMinMajor,
    // Held against hw.vs.r12b by check-content [13].
    enduranceWeeklyKmFull,
    enduranceLongRunKmFull,
    enduranceVolumeWeight,
    enduranceLongRunWeight,
    enduranceConsistencyWeight,
    // Held against the six dictionaries by check-content [15].
    tiles,
    // Held against hw.vs.r7b (and the tile caption it describes) by
    // check-content [28].
    zoneGate,
    // Bumped by hand when the screenshots in assets/ are re-shot. Nothing on
    // the page prints this any more (sc.build is gone — sc.note now says only
    // that the shipping build moves on after a capture, which stays true
    // whoever re-shoots and when). It is kept as the repo's own record of when
    // assets/framed-*.png were last regenerated.
    screensCapturedAt: readPrevious()?.screensCapturedAt ?? '2026-09-06',
  };
}

const readPrevious = readFacts;

/** Fields that are a measurement of the app, not bookkeeping about this run. */
export const MEASURED = (facts) => Object.fromEntries(
  Object.entries(facts).filter(([k]) => k !== 'measuredAt'));

// Importable: check-content.mjs [0] calls measure() itself. Only run the CLI
// when this file IS the entry point — importing it must not write the JSON.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();

function main() {
const mode = process.argv[2] || '--write';
const facts = measure();
const body = JSON.stringify(facts, null, 2) + '\n';

if (mode === '--check') {
  const prev = readPrevious();
  if (!prev) { console.error('app-facts: tools/app-facts.json missing — run `node tools/app-facts.mjs`'); process.exit(1); }
  // JSON, not ===: `tiles` is an object, and two structurally identical
  // objects are never === , which would report permanent drift.
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const drift = Object.keys(facts).filter(k => k !== 'measuredAt' && !same(prev[k], facts[k]));
  if (drift.length) {
    console.error('app-facts: STALE — ' + drift.map(k => `${k}: file ${JSON.stringify(prev[k])} vs repo ${JSON.stringify(facts[k])}`).join(', '));
    console.error('  run `node tools/app-facts.mjs`, then update the six t-*.js values check-content [9] names.');
    process.exit(1);
  }
  console.log('app-facts: current — ' + drift.length + ' drift(s)');
} else if (mode === '--print') {
  console.log(body.trim());
} else {
  fs.writeFileSync(OUT, body);
  console.log('app-facts: wrote tools/app-facts.json');
  console.log(body.trim());
}
}
