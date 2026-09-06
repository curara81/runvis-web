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
  const cueToggles = toggleList[1].split(',').map(t => t.trim()).filter(Boolean).length;

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
    // Held against the six dictionaries by check-content [13].
    cueToggles,
    cueBudgetEasy,
    cueBudgetTempo,
    cueMinGap,
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
  const drift = Object.keys(facts).filter(k => k !== 'measuredAt' && prev[k] !== facts[k]);
  if (drift.length) {
    console.error('app-facts: STALE — ' + drift.map(k => `${k}: file ${prev[k]} vs repo ${facts[k]}`).join(', '));
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
