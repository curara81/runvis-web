/* Runvis homepage i18n — switches every [data-i18n] element plus the dynamic
   demo text (hero captions, voice chips) across six languages.

   Dictionaries live one language per file (t-ko.js … t-de.js) and each one
   assigns into window.RUNVIS_I18N and then calls window.RunvisOnDict. Since
   round 14 the usual number downloaded is ZERO: every page is prerendered in
   one language and check-content [3], [4] and [10] hold its markup, its JSON-LD
   and its script fallbacks to that language's dictionary byte for byte, so
   fetching the table would only repaint the page with what it already says
   (-0.6). A table is fetched when the reader asks for a different language —
   ?lang= at first paint, or the menu later.

   Language resolution: ?lang= → the page's own language (window.RunvisPageLang
   on the prerendered copies under /en/, /ja/ …) → a saved choice → THIS
   DOCUMENT'S OWN language. navigator.language is deliberately not in that list;
   it decides only which language the banner at the top OFFERS. The reason is
   the whole of README "언어 라우팅": the root declares hreflang="ko" for "/", so
   rendering "/" has to produce Korean for everyone who renders it, crawlers
   included (라운드 14, -4).

   A choice is remembered in localStorage only when the URL NAMED the language,
   which is what makes it safe for the boot script to act on. */
(function () {
  var LANGS = [
    { code: 'ko', label: '한국어',   tts: 'ko-KR' },
    { code: 'en', label: 'English',  tts: 'en-US' },
    { code: 'ja', label: '日本語',   tts: 'ja-JP' },
    { code: 'es', label: 'Español',  tts: 'es-ES' },
    { code: 'zh', label: '繁體中文', tts: 'zh-TW' },
    { code: 'de', label: 'Deutsch',  tts: 'de-DE' }
  ];
  var CODES = LANGS.map(function (l) { return l.code; });
  var DICT_V = '20260906f';                  // must match the <head> boot script
  // "" on the root pages, "/" on the prerendered per-language copies under
  // /en/, /ja/ … so that dictionaries and screenshots resolve to the one copy
  // at the site root instead of 404ing inside the language directory.
  var BASE = window.RunvisBase || '';
  var I18N = window.RUNVIS_I18N = window.RUNVIS_I18N || {};
  var current = 'ko';

  function meta(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
    return LANGS[0];
  }

  function norm(v) {
    if (!v) return null;
    v = String(v).toLowerCase();
    v = v.indexOf('zh') === 0 ? 'zh' : v.slice(0, 2);   // zh-Hant / zh-TW → our zh table
    return CODES.indexOf(v) >= 0 ? v : null;
  }

  // Same split the pages' boot scripts make, for the same reason: our zh table
  // is Traditional (LANGS 繁體中文 / tts zh-TW / <html lang="zh-Hant">), and
  // norm() sends every zh-* to it. That is right for an EXPLICIT choice —
  // ?lang=zh, the /zh/ directory, the menu — and wrong for a browser that says
  // zh-Hans, zh-CN or zh-SG, which got Traditional assigned to it without
  // asking (2026-09-06 라운드 13, -0.3). Those fall through to the x-default,
  // English; the menu still offers 繁體中文. A bare "zh" is ambiguous and is
  // treated the same way when it comes from the browser.
  function navLang(v) {
    var s = v ? String(v).toLowerCase() : '';
    return (s.indexOf('zh') === 0 && !/^zh-(hant|tw|hk|mo)\b/.test(s)) ? null : norm(s);
  }

  /// The ?lang= this URL asks for, or null. Used both to pick the language and
  /// to point the canonical link at this exact URL.
  function urlLang() {
    try { return norm(new URLSearchParams(location.search).get('lang')); } catch (e) { return null; }
  }

  /// The language THIS document is written in: "ko" at the root, the directory
  /// name on the prerendered copies. It is also the floor of resolve() — see
  /// the long note in every page's boot script (2026-09-06 라운드 14, -4).
  function docLang() { return norm(window.RunvisDocLang) || norm(window.RunvisPageLang) || 'ko'; }

  /// The language to OFFER a reader whose browser is not this document's.
  /// English for anyone outside the six, matching hreflang="x-default".
  function preferred() { return norm(window.RunvisPrefer) || navLang(navigator.language) || 'en'; }

  function resolve() {
    // The boot script already did this before the body was parsed; trust it so
    // the two cannot disagree, and only redo the work if it did not run.
    if (norm(window.RunvisLang)) return norm(window.RunvisLang);
    var q = urlLang();
    if (q) return q;
    var page = norm(window.RunvisPageLang);
    if (page) return page;
    var saved = null;
    try { saved = localStorage.getItem('runvis_lang'); } catch (e) {}
    if (norm(saved)) return norm(saved);
    // NOT navigator.language. A browser header used to end up here and at the
    // top of the boot script, where it decided that the Korean root should
    // render in English — under a canonical, an hreflang and a sitemap entry
    // that all say "/" is the Korean page. The header now only picks what the
    // banner below OFFERS; what renders is this document's own language.
    return docLang();
  }

  // ---- dictionary loading ------------------------------------------------
  // One <script> per language, fetched on demand and cached by the browser
  // afterwards. `waiting[code]` holds the callbacks queued while a file is in
  // flight; a null entry means "already delivered".
  var waiting = {};
  window.RunvisOnDict = function (code) {
    var q = waiting[code];
    waiting[code] = null;
    if (q) q.forEach(function (fn) { fn(); });
  };
  function ensureDict(code, cb) {
    if (I18N[code]) { cb(); return; }
    if (!waiting[code]) {
      waiting[code] = [];
      // The boot script injects a dictionary only when the reader asked for a
      // language this document is not written in, and records which one in
      // RunvisDictLoaded. Testing against that rather than against RunvisLang
      // is what lets a later in-place switch BACK to the page's own language
      // still fetch a table (which RunvisLang would have declared in flight
      // forever, leaving the switch silently doing nothing).
      if (code !== window.RunvisDictLoaded) {
        var s = document.createElement('script');
        s.src = BASE + 't-' + code + '.js?v=' + DICT_V;
        s.async = false;
        s.onerror = function () {
          if (window.console) console.warn('i18n: dictionary failed to load —', code);
          waiting[code] = null;                    // page keeps the language it has
        };
        document.head.appendChild(s);
      }
    }
    if (waiting[code]) waiting[code].push(cb);
  }

  // ---- localized device captures ----------------------------------------
  // All eleven device frames — five iPhone, six Apple Watch — now exist in all
  // six languages: the app was run on the simulator under -AppleLanguages "(xx)"
  // and re-composited into the same Apple bezel
  // (tools/regenerate-screens.md → tools/watch-capture.md → composite_lang.py).
  // Korean is the file with no suffix; the others are `<base>.<code>.png`.
  //
  // The watch set was Korean-only through round 11 because a wrong note in
  // regenerate-screens.md said the watchOS simulator ignores synthetic taps.
  // It does not — taps land once the app's stale HKWorkoutSession is ended and
  // cfprefsd is restarted after the container prefs are written. The three
  // mid-run frames (pace / hr / map) come from a real run driven by
  // `xcrun simctl location start --speed=3.2`, one per language, so the
  // English page now reads 8:22 /mi where it used to read 5:12 /km.
  var SHOT_LANGS = { en: 1, ja: 1, es: 1, zh: 1, de: 1 };   // ko = the base file
  var SHOTS = {
    'framed-phone-dash': 1, 'framed-phone-detail': 1, 'framed-phone-glance': 1,
    'framed-phone-plan': 1, 'framed-phone-race': 1,
    'framed-watch-hero': 1, 'framed-watch-evidence': 1, 'framed-watch-start': 1,
    'framed-watch-pace': 1, 'framed-watch-hr': 1, 'framed-watch-map': 1
  };
  function applyShots(code) {
    document.querySelectorAll('img[data-shot]').forEach(function (img) {
      var base = img.getAttribute('data-shot');
      if (!SHOTS[base]) return;                 // not a localized frame: leave the markup alone
      var stem = BASE + 'assets/' + base + (SHOT_LANGS[code] ? '.' + code : '');
      if (img.getAttribute('src') !== stem + '.png') img.setAttribute('src', stem + '.png');
      // Each capture is a <picture> (AVIF, lossless WebP, then the PNG the
      // markup names — tools/encode_shots.py). A <source> that matches OUTRANKS
      // src, so moving src alone would leave the Korean AVIF on screen under an
      // English <img src> in every browser that can decode AVIF, which is most
      // of them.
      var pic = img.parentNode;
      if (pic && pic.tagName === 'PICTURE') {
        pic.querySelectorAll('source').forEach(function (so) {
          var ext = so.getAttribute('type') === 'image/avif' ? '.avif' : '.webp';
          if (so.getAttribute('srcset') !== stem + ext) so.setAttribute('srcset', stem + ext);
        });
      }
    });
  }

  // The share card is per market since round 14 — tools/og_cards.py draws each
  // language's own n.hero.h1 onto it and tools/prerender.mjs (8b) points that
  // market's og:image, twitter:image and JSON-LD `image` at it. og:title and
  // og:description are in the markup for the same reason: a crawler never runs
  // this file. What this function still fixes is the ROOT document, which
  // serves ?lang= and a saved choice and stays Korean in its own markup.

  // Values are HTML (they carry <b>/<span>/<br>) and are written through
  // innerHTML, which replaces every child of the element. A value whose tags
  // do not close is a value that was cut short, and applying it would delete
  // the rest of the sentence that lives in the markup — that is exactly how
  // the yearly price, the lifetime price and the "we call an estimate an
  // estimate" line lost their second halves. Refuse those and keep the markup.
  var TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  var VOID = { br: 1, img: 1, hr: 1, wbr: 1, input: 1, source: 1, col: 1 };
  function tagsClose(html) {
    if (html.indexOf('<') < 0) return true;
    var stack = [], m;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(html))) {
      var name = m[2].toLowerCase();
      if (VOID[name] || m[3]) continue;
      if (m[1]) { if (stack.pop() !== name) return false; }
      else stack.push(name);
    }
    return stack.length === 0;
  }

  // Apply static [data-i18n] text.
  function applyStatic(dict) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')];
      if (v == null) return;
      if (!tagsClose(v)) {
        if (window.console) console.warn('i18n: unbalanced value kept out of the page —', el.getAttribute('data-i18n'));
        return;
      }
      // <title> has no markup and innerHTML there would escape oddly.
      if (el.tagName === 'TITLE') el.textContent = v; else el.innerHTML = v;
    });
    // Attribute text — alt, placeholder, aria-label. Written as
    // data-i18n-attr="alt:alt.watch.pace" (comma-separated for several).
    // Without this, screen readers and search engines saw Korean on every
    // language, and the e-mail field's placeholder stayed Korean too.
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length !== 2) return;
        var v = dict[bits[1].trim()];
        if (v != null) el.setAttribute(bits[0].trim(), v);
      });
    });
    // The tab title and the link preview are the first thing anyone sees. They
    // used to be hard-coded to meta.title/meta.desc here, which meant every page
    // that shares this file wore the homepage's title; each page now tags its
    // own <title> and <meta> in the markup and the two loops above do the work.
  }

  function setMeta(attr, key, value) {
    if (value == null) return;
    var el = document.querySelector('meta[' + attr + '="' + key + '"]');
    if (el) el.setAttribute('content', value);
  }

  var OG_LOCALE = { ko: 'ko_KR', en: 'en_US', ja: 'ja_JP', es: 'es_ES', zh: 'zh_TW', de: 'de_DE' };

  // The six hreflang alternates now point at the prerendered per-language
  // directories (/en/, /ja/ …), so those are the indexable pages. A root URL
  // carrying ?lang=de shows exactly what /de/ shows, so its canonical points
  // there rather than at itself — two self-canonical copies of one German page
  // would only split the signal. The bare root URL and each prerendered page
  // stay their own canonical.
  //
  // It follows the language ON SCREEN. It used to follow the URL instead —
  // only ?lang= moved the canonical — on the argument that otherwise a browser
  // whose Accept-Language said English would make "/" canonicalise to "/en/"
  // and orphan the x-default. That argument died with the redirect in round
  // 14: a browser header no longer changes what any document renders, so the
  // only ways the shown language can differ from the document's own are ones
  // the reader asked for (?lang=, a saved choice, an in-place switch through
  // window.RunvisSetLang) and every one of them should name the market page
  // that shows the same words. Leaving the saved-choice case out is what put
  // an English body under canonical "/" (2026-09-06 라운드 14, -1.5).
  // og:locale follows the shown language too, because og:title and
  // og:description already do.
  function applyCanonical(code) {
    var link = document.querySelector('link[rel="canonical"]');
    // The page it belongs to decides the path — this file is shared with
    // run.html, whose canonical is /run.html, not the homepage.
    // data-base is the page's own address, stashed by the <head> boot script
    // before it rewrote href — reading href back would prefix twice.
    var base = link ? (link.getAttribute('data-base')
      || (link.getAttribute('href') || '').split('?')[0].split('#')[0]) : '';
    if (link && base) link.setAttribute('data-base', base);
    if (base) {
      var url = base, own = docLang();
      if (code !== own) {
        try {
          var u = new URL(base), p = u.pathname;
          // Strip this document's own directory before adding the shown
          // language's, so /en/run.html?lang=de canonicalises to /de/run.html
          // and never to /de/en/run.html.
          if (window.RunvisPageLang && p.indexOf('/' + own + '/') === 0) p = p.slice(own.length + 1);
          u.pathname = (code === 'ko' ? '' : '/' + code) + p;
          url = u.href;
        } catch (e) {}
      }
      link.setAttribute('href', url);
      setMeta('property', 'og:url', url);
    }
    setMeta('property', 'og:locale', OG_LOCALE[code] || 'ko_KR');
  }

  // The FAQ rich result has to carry the same questions the page shows, in the
  // language the page is showing them in. Rebuilding it from the same
  // dictionary the tiles read is the only way the two cannot drift apart.
  // Ten tiles: the two pricing questions, plus 기기 교체 (there is no iCloud
  // sync, so the answer is the manual backup file) and 컴플리케이션/위젯
  // (there is none in this build — say so before the install, not after).
  var FAQ_COUNT = 10;
  function applyFaqLd(code, dict) {
    var node = document.getElementById('faqld');
    if (!node) return;
    var items = [];
    for (var i = 1; i <= FAQ_COUNT; i++) {
      var q = dict['n.faq.q' + i], a = dict['n.faq.a' + i];
      if (!q || !a) return;                       // never publish a partial FAQ
      items.push({
        '@type': 'Question',
        name: plain(q),
        acceptedAnswer: { '@type': 'Answer', text: plain(a) }
      });
    }
    node.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: code === 'zh' ? 'zh-Hant' : code,
      mainEntity: items
    });
  }

  // The app itself, with the three prices the page already quotes. Prices stay
  // in KRW because that is what the Korean App Store charges, and each Offer
  // now carries eligibleRegion KR so a German-language page is not telling a
  // search engine that a Berlin reader pays ₩1,900. No converted figure goes
  // in structured data; the other stores get their own Offers when App Store
  // Connect has them. Keep this in step with tools/i18n-lib.mjs appLd — check
  // [4] compares the static markup against that one, and a reader with
  // JavaScript gets this one.
  var OFFERS = [
    { name: 'Runvis Coach Monthly',  price: '1900',  category: 'subscription' },
    { name: 'Runvis Coach Yearly',   price: '15000', category: 'subscription' },
    { name: 'Runvis Coach Lifetime', price: '39000', category: 'one-time' }
  ];
  function applyAppLd(code, dict) {
    var node = document.getElementById('appld');
    if (!node) return;
    node.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Runvis',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'watchOS, iOS',
      inLanguage: code === 'zh' ? 'zh-Hant' : code,
      url: 'https://runvis.app/',
      description: plain(dict['meta.desc'] || ''),
      // Six cards, one per market — tools/og_cards.py. Suffixed exactly like
      // the screenshot below it, and exactly like tools/i18n-lib.mjs appLd.
      image: 'https://runvis.app/assets/og-card' + (code === 'ko' ? '' : '.' + code) + '.png',
      screenshot: 'https://runvis.app/assets/framed-phone-dash' + (code === 'ko' ? '' : '.' + code) + '.png',
      author: { '@type': 'Organization', name: 'Runvis', url: 'https://runvis.app/' },
      offers: OFFERS.map(function (o) {
        return {
          '@type': 'Offer', name: o.name, price: o.price, priceCurrency: 'KRW', category: o.category,
          // Nothing is purchasable yet — TestFlight beta, release date not set.
          // Three prices with no availability read as "on sale now".
          availability: 'https://schema.org/PreOrder',
          eligibleRegion: { '@type': 'Country', name: 'KR' }
        };
      })
    });
  }

  // Every page except index.html carries a WebPage + BreadcrumbList node
  // instead of the app and FAQ nodes. Same shape tools/i18n-lib.mjs pageLd
  // builds and tools/prerender.mjs writes — keep this table and PAGE_META
  // there in step — and this one is for a reader who switched language on a
  // root page with ?lang=.
  var PAGE_META = {
    'run.html': { title: 'r1', desc: 'r2' },
    'how-it-works.html': { title: 'hw.meta.title', desc: 'hw.meta.desc' },
    'privacy.html': { title: 'pv.meta.title', desc: 'pv.meta.desc' },
    'terms.html': { title: 'tm.meta.title', desc: 'tm.meta.desc' }
  };
  function applyPageLd(code, dict) {
    var node = document.getElementById('pageld');
    if (!node) return;
    var page = (location.pathname.split('/').pop() || 'index.html');
    var m = PAGE_META[page];
    if (!m) return;
    var home = 'https://runvis.app/' + (code === 'ko' ? '' : code + '/');
    var self = home + page;
    var name = plain(dict[m.title] || '');
    node.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: name,
      description: plain(dict[m.desc] || ''),
      inLanguage: code === 'zh' ? 'zh-Hant' : code,
      url: self,
      isPartOf: { '@type': 'WebSite', name: 'Runvis', url: home },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Runvis', item: home },
          { '@type': 'ListItem', position: 2, name: name, item: self }
        ]
      }
    });
  }

  function plain(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /// Page scripts call this for their own runtime strings (form results, the
  /// voice-chip playback announcements) so they don't reach into the table.
  window.RunvisT = function (key, fallback) {
    var d = I18N[current];
    return (d && d[key]) || fallback;
  };

  // Dynamic demo text is redrawn by the page's own render functions; we just
  // publish the active language's strings + tts code for them to read. Only
  // hero captions and the four voice chips remain — the long-run simulator was
  // removed from the markup and its 17 keys are gone from the dictionaries, so
  // publishing them here only produced arrays full of undefined.
  function publishDynamic(code) {
    var d = I18N[code];
    // No dictionary means the boot script deliberately skipped it: the page is
    // already written in `code` and these eight strings are inlined in its
    // <head> instead (window.RunvisSelfDyn). They are the only text on the
    // page that the markup cannot carry, which is why they are the only text
    // that had to be inlined when the download went away.
    var self = !d && window.RunvisSelfDyn ? window.RunvisSelfDyn : null;
    d = d || {};
    window.RunvisDyn = {
      code: code,
      tts: meta(code).tts,
      hero: self ? self.hero : [d.hero0, d.hero1, d.hero2, d.hero3],
      vchip: self ? self.vchip : [d.vchip0, d.vchip1, d.vchip2, d.vchip3]
    };
    if (typeof window.renderDynamicI18n === 'function') window.renderDynamicI18n();
  }

  /// `remember` is what makes localStorage mean "a language this reader
  /// asked for" rather than "the last language a header happened to produce".
  /// The boot script's one remaining navigation reads that key, so the
  /// difference is load-bearing: a crawler, and a first-time reader who was
  /// only ever shown the page's own language, must not leave a stored choice
  /// behind that later moves someone off the root (라운드 14, -4).
  function applyLang(code, remember) {
    current = code;
    document.documentElement.lang = code === 'zh' ? 'zh-Hant' : code;
    applyStatic(I18N[code]);
    applyShots(code);
    applyCanonical(code);
    applyFaqLd(code, I18N[code]);
    applyAppLd(code, I18N[code]);
    applyPageLd(code, I18N[code]);
    publishDynamic(code);
    if (remember) { try { localStorage.setItem('runvis_lang', code); } catch (e) {} }
    // Anything mid-flight in the old language should stop — the voice demo
    // listens for this and silences itself instead of talking over the new one.
    try { window.dispatchEvent(new CustomEvent('runvis:lang', { detail: code })); } catch (e) {}
    var label = document.getElementById('langlabel');
    if (label) label.textContent = meta(code).label;
    document.querySelectorAll('#langmenu [data-code]').forEach(function (item) {
      item.setAttribute('aria-checked', item.getAttribute('data-code') === code ? 'true' : 'false');
    });
  }

  /// The page is ALREADY written in `code`: every [data-i18n] node, every
  /// data-i18n-attr, both JSON-LD blocks and every RunvisT() fallback were
  /// emitted in it, and check-content [3], [4] and [10] hold all of them to the
  /// same dictionary byte for byte. Repainting them out of a 57-73 KB download
  /// would replace the page with what it already says (2026-09-06 라운드 14,
  /// -0.6), so this is what runs instead: the handful of things that are NOT in
  /// the markup — the localized captures, the canonical, the dynamic demo
  /// strings and the menu's own state.
  function applySelf(code, remember) {
    current = code;
    applyShots(code);            // idempotent — prerender already named this language's files
    applyCanonical(code);        // code === this document's language, so it self-canonicalises
    publishDynamic(code);        // reads window.RunvisSelfDyn when there is no table
    if (remember) { try { localStorage.setItem('runvis_lang', code); } catch (e) {} }
    try { window.dispatchEvent(new CustomEvent('runvis:lang', { detail: code })); } catch (e) {}
    var label = document.getElementById('langlabel');
    if (label) label.textContent = meta(code).label;
    document.querySelectorAll('#langmenu [data-code]').forEach(function (item) {
      item.setAttribute('aria-checked', item.getAttribute('data-code') === code ? 'true' : 'false');
    });
  }

  /// Public entry point. The dictionary for `code` may not be here yet, so this
  /// fetches it first and applies nothing until it lands.
  function setLang(code, remember) {
    if (CODES.indexOf(code) < 0) code = 'ko';
    ensureDict(code, function () { if (I18N[code]) applyLang(code, remember); });
  }
  /// The public entry point is always a deliberate switch, so it remembers.
  window.RunvisSetLang = function (code) { setLang(code, true); };

  /// This page's filename with its language directory stripped — "" for a
  /// directory index, "run.html" for /de/run.html. The language menu builds its
  /// hrefs from it.
  function pageFile() {
    var seg = location.pathname.split('/').filter(Boolean);
    if (window.RunvisPageLang && seg.length && seg[0] === window.RunvisPageLang) seg.shift();
    var last = seg.length ? seg[seg.length - 1] : '';
    return /\.html?$/.test(last) ? last : '';
  }

  /// Where "read this page in <code>" actually lives.
  ///
  /// The menu used to swap the text in place and deliberately leave the address
  /// alone, which meant a reader who picked Deutsch and then sent the link sent
  /// a Korean page: the URL, the canonical and og:url all still said "/"
  /// (2026-09-06 라운드 13, -0.5). The five prerendered directories already
  /// exist and are the indexable pages, so the menu points AT them. The hash is
  /// carried over so "share this section" survives a language switch.
  function langHref(code) {
    return (code === 'ko' ? '/' : '/' + code + '/') + pageFile() + location.hash;
  }

  function buildMenu() {
    var menu = document.getElementById('langmenu');
    var btn = document.getElementById('langbtn');
    var sel = document.getElementById('langsel');
    if (!menu || !btn || !sel) return;
    // Every language is offered, whether or not its dictionary is loaded —
    // picking one fetches it. (The old build hid languages whose table had not
    // arrived, which with per-language files would have meant a menu of one.)
    var items = LANGS.map(function (l) {
      var li = document.createElement('li');
      li.setAttribute('role', 'none');           // the <a> inside is the item
      var a = document.createElement('a');
      a.textContent = l.label;
      // A real href, not a click handler: the browser then does the navigating,
      // and middle-click, cmd-click and "copy link address" all work on a menu
      // that used to be six unlinked list items. The address, the canonical,
      // og:url and anything shared from the new page are then right for free.
      a.href = langHref(l.code);
      // menuitemradio + aria-checked is what a "pick one of six" menu is; plain
      // menuitems left a screen reader unable to say which language was on.
      a.setAttribute('role', 'menuitemradio');
      a.setAttribute('aria-checked', 'false');
      a.setAttribute('data-code', l.code);
      a.setAttribute('lang', l.code === 'zh' ? 'zh-Hant' : l.code);
      a.tabIndex = -1;
      li.appendChild(a);
      menu.appendChild(li);
      return a;
    });

    function open() {
      // The hash moves as the reader scrolls and clicks anchors, and
      // history.pushState does not fire hashchange, so the hrefs are refreshed
      // the moment the menu is opened rather than once at build time.
      items.forEach(function (a) { a.href = langHref(a.getAttribute('data-code')); });
      sel.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      var i = Math.max(0, items.map(function (x) { return x.getAttribute('data-code'); }).indexOf(current));
      items[i].focus();
    }
    function close(focusBtn) {
      sel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
    }
    function move(from, delta) {
      var i = items.indexOf(from);
      if (i < 0) i = 0;
      items[(i + delta + items.length) % items.length].focus();
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (sel.classList.contains('open')) close(false); else open();
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    // Roving focus inside the menu: arrows, Home/End, Enter/Space, Escape.
    menu.addEventListener('keydown', function (e) {
      var li = e.target;
      if (items.indexOf(li) < 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); move(li, 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(li, -1); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === ' ') { e.preventDefault(); li.click(); }   // Enter already activates an <a>
      else if (e.key === 'Escape' || e.key === 'Tab') { close(e.key === 'Escape'); }
    });
    document.addEventListener('click', function () { close(false); });
  }

  // ---- "read this page in your language" ---------------------------------
  // This is what replaced the automatic redirect (2026-09-06 라운드 14, -4).
  //
  // The five market pages have to be reachable by a person who landed on the
  // wrong one, and until round 14 the boot script did that by replacing the
  // location of a root URL whenever navigator.language was not Korean. A
  // crawler is exactly that visitor — an English-ish header, empty storage —
  // so the document that declares hreflang="ko" for "/" and is listed in
  // sitemap.xml as the Korean URL moved the crawler off "/" before it could
  // read it. Render and declaration contradicted each other, and the Korean
  // page deleted itself from the index it was asking to be in.
  //
  // A banner is the form Google documents for a site that cannot redirect
  // server-side (GitHub Pages cannot): everyone — reader and crawler alike —
  // gets the same document plus a visible link, and the reader decides. One
  // click still lands on the market page, which is the round-9 requirement
  // that five prerendered pages must not be pages nobody is sent to.
  //
  // The destination is READ OUT OF the page's own <link rel="alternate"
  // hreflang="…"> rather than assembled from a path, so the banner can only
  // ever offer an address this document already declares — the banner and the
  // hreflang cluster cannot drift apart. 404.html declares no alternates and
  // so gets no banner, which is correct: it has no per-language copy.
  var OFFER = {
    ko: { msg: '이 페이지는 한국어로도 볼 수 있습니다.', cta: '한국어로 보기', close: '닫기' },
    en: { msg: 'This page is also available in English.', cta: 'Read in English', close: 'Dismiss' },
    ja: { msg: 'このページは日本語でも読めます。', cta: '日本語で読む', close: '閉じる' },
    es: { msg: 'Esta página también está en español.', cta: 'Leer en español', close: 'Cerrar' },
    zh: { msg: '這個頁面也有繁體中文版。', cta: '用繁體中文閱讀', close: '關閉' },
    de: { msg: 'Diese Seite gibt es auch auf Deutsch.', cta: 'Auf Deutsch lesen', close: 'Schließen' }
  };

  /// The URL this document's own hreflang gives for `code`, or null.
  function alternateHref(code) {
    var el = document.querySelector('link[rel="alternate"][hreflang="'
      + (code === 'zh' ? 'zh-Hant' : code) + '"]');
    var href = el ? el.getAttribute('href') : null;
    return href || null;
  }

  /// `saved` is the stored choice as it was ON ARRIVAL. It has to be read
  /// before applyLang/applySelf runs, because those WRITE it: reading it back
  /// afterwards on /en/ would always find "en" and the banner would never
  /// appear on the one page it exists for.
  function offerLanguage(shown, saved) {
    // ?lang= means this view was asked for by name; do not second-guess it.
    if (urlLang()) return;
    // A saved choice outranks the browser header, because it is a choice.
    var want = saved || preferred();
    if (!want || want === shown) return;
    try { if (sessionStorage.getItem('runvis_offer_off')) return; } catch (e) {}
    var t = OFFER[want], href = alternateHref(want);
    if (!t || !href) return;

    // 2026-09-06 라운드 15 (-0.8): this bar used to be an ordinary block
    // inserted at the top of <body> AFTER DOMContentLoaded, which means after
    // the hero had painted. Every visitor it appeared for — and it appears for
    // exactly one kind of visitor, the one whose language does not match the
    // page — watched 40-50 px drop in above the LCP image and push the whole
    // document down. It is out of the flow now: fixed to the bottom edge, so
    // it can be inserted at any moment without moving a single pixel of the
    // page, and it no longer covers the H1 it is offering to translate. The
    // DOM position is unchanged (right after the skip link) because that is a
    // reading-order decision, not a layout one.
    var css = document.createElement('style');
    css.textContent = '.langoffer{position:fixed;left:0;right:0;bottom:0;z-index:80;'
      + 'display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;'
      + 'padding:10px 24px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));'
      + 'background:#14171c;border-top:1px solid #24282e;box-shadow:0 -8px 24px rgba(0,0,0,.45);'
      + 'font-size:14.5px;color:#9aa0a6;line-height:1.5}'
      + '.langoffer a{color:#3DDC84;font-weight:700;text-decoration:underline;text-underline-offset:3px}'
      + '.langoffer button{margin-left:auto;background:none;border:1px solid #2e333a;color:#9aa0a6;'
      + 'font:inherit;font-size:13px;padding:5px 12px;border-radius:9px;cursor:pointer}'
      + '.langoffer button:hover{color:#f2f3f5;border-color:#3DDC84}'
      // index.html's phone-width call to action is also fixed to the bottom
      // edge. It arms only after the reader has scrolled past the hero, which
      // is later than this bar appears, so lifting it by the bar's measured
      // height moves nothing that is on screen yet. The rule is inert on every
      // other page, which have no .sticky-cta.
      + 'body.has-langoffer .sticky-cta{bottom:var(--langoffer-h,58px)}';
    document.head.appendChild(css);

    var bar = document.createElement('div');
    bar.className = 'langoffer';
    // A landmark, not a bare div: it is the first thing in the document and a
    // screen reader should be able to name it and skip it.
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', t.cta);
    bar.setAttribute('lang', want === 'zh' ? 'zh-Hant' : want);
    var span = document.createElement('span');
    span.textContent = t.msg;
    var a = document.createElement('a');
    a.href = href;                      // absolute, straight out of the hreflang
    a.textContent = t.cta + ' \u2192';
    var x = document.createElement('button');
    x.type = 'button';
    x.textContent = t.close;
    x.addEventListener('click', function () {
      bar.remove();
      document.body.classList.remove('has-langoffer');
      try { sessionStorage.setItem('runvis_offer_off', '1'); } catch (e) {}
    });
    bar.appendChild(span); bar.appendChild(a); bar.appendChild(x);
    // After the skip link, never before it: the skip link has to stay the
    // first thing a keyboard reaches.
    var skip = document.querySelector('body > a.skip');
    if (skip && skip.nextSibling) document.body.insertBefore(bar, skip.nextSibling);
    else if (skip) document.body.appendChild(bar);
    else document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-langoffer');
    document.body.style.setProperty('--langoffer-h', bar.offsetHeight + 'px');
  }

  function init() {
    buildMenu();
    var code = resolve();
    // Read before anything can write it — see offerLanguage.
    var arrivedWith = null;
    try { arrivedWith = norm(localStorage.getItem('runvis_lang')); } catch (e) {}
    // Remember it only if the URL NAMED this language — ?lang=de, or the /de/
    // directory the reader is standing in. A page that simply rendered its own
    // language stores nothing, so a browser header can never leave behind a
    // "choice" that the boot script would later act on (라운드 14, -4).
    var remember = !!(urlLang() || norm(window.RunvisPageLang));
    if (!I18N[code] && code !== window.RunvisDictLoaded && code === docLang()) {
      applySelf(code, remember);            // nothing to download and nothing to repaint
    } else {
      // The boot script already asked for this one; register it as in flight so
      // ensureDict waits for RunvisOnDict instead of injecting a second copy.
      if (!I18N[code] && code === window.RunvisDictLoaded) waiting[code] = waiting[code] || [];
      setLang(code, remember);
    }
    offerLanguage(code, arrivedWith);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
