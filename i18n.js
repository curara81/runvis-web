/* Runvis homepage i18n — switches every [data-i18n] element plus the dynamic
   demo text (hero captions, voice chips) across six languages.

   Dictionaries live one language per file (t-ko.js … t-de.js) and each one
   assigns into window.RUNVIS_I18N and then calls window.RunvisOnDict. Only the
   language the visitor actually reads is downloaded — the old single
   translations.js shipped all six (245 KB) to everybody. The inline boot script
   in each page's <head> resolves the language, sets <html lang>, and injects the
   first dictionary before the body is parsed; this file does the rest and
   fetches a second dictionary only if the reader picks another language.

   Language resolution: ?lang= → the page's own language (set as
   window.RunvisPageLang by the prerendered copies under /en/, /ja/ …) → saved
   choice → browser language → Korean. The choice is remembered in localStorage
   so a returning visitor keeps it. */
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
  var DICT_V = '20260906e';                  // must match the <head> boot script
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

  /// The ?lang= this URL asks for, or null. Used both to pick the language and
  /// to point the canonical link at this exact URL.
  function urlLang() {
    try { return norm(new URLSearchParams(location.search).get('lang')); } catch (e) { return null; }
  }

  function resolve() {
    // The boot script already did this before the body was parsed; trust it so
    // the two cannot disagree, and only redo the work if it did not run.
    if (norm(window.RunvisLang)) return norm(window.RunvisLang);
    var q = urlLang();
    if (q) return q;
    var saved = null;
    try { saved = localStorage.getItem('runvis_lang'); } catch (e) {}
    if (norm(saved)) return norm(saved);
    return norm(navigator.language) || 'ko';
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
      // The boot script injected this one already — do not fetch it twice.
      if (code !== window.RunvisLang) {
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
  // The five iPhone frames now exist in all six languages: the app was run on
  // the iPhone 17 simulator under -AppleLanguages "(xx)" and re-composited into
  // the same Apple bezel (tools/regenerate-screens.md → tools/composite_lang.py).
  // Korean is the file with no suffix; the others are `<base>.<code>.png`.
  //
  // The six WATCH frames have no localized variants and are Korean in every
  // language. They are not in SHOTS below, so nothing is swapped for them and
  // no request 404s — the capture script cannot reach those screens because the
  // watchOS simulator ignores synthetic taps (only drags and hardware buttons
  // register), and three of them are mid-run screens on top of that. The
  // `sc.note` caption under the FIRST screenshot section (#today) is the place
  // that tells the reader which half is which, in all six languages.
  var SHOT_LANGS = { en: 1, ja: 1, es: 1, zh: 1, de: 1 };   // ko = the base file
  var SHOTS = {
    'framed-phone-dash': 1, 'framed-phone-detail': 1, 'framed-phone-glance': 1,
    'framed-phone-plan': 1, 'framed-phone-race': 1
  };
  function applyShots(code) {
    document.querySelectorAll('img[data-shot]').forEach(function (img) {
      var base = img.getAttribute('data-shot');
      if (!SHOTS[base]) return;                 // watch frames: leave the markup alone
      var want = BASE + 'assets/' + base + (SHOT_LANGS[code] ? '.' + code : '') + '.png';
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    });
  }

  // The share card (assets/og-card.png) is deliberately language-neutral —
  // mark, watch silhouette, pulse, domain, no sentence — because og:image is
  // read by crawlers that never run this file. og:title/og:description no
  // longer depend on this file either: tools/prerender.mjs writes /en/, /ja/,
  // /es/, /zh/, /de/ with their own <html lang>, title, meta, og, canonical
  // and JSON-LD already in the markup, and the hreflang alternates point
  // there. What this function still fixes is the ROOT document, which serves
  // ?lang= and browser-language visitors and stays Korean in the markup.

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
  // It follows the URL, not the language the reader picks from the menu: the
  // bare URL keeps pointing at itself even when a browser's Accept-Language
  // resolves to English (otherwise "/" would canonicalise to "/en/" and orphan
  // the x-default), and switching language by hand does not rewrite the
  // address bar, so it must not rewrite the canonical either. og:locale does
  // follow the shown language, because og:title and og:description already do.
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
      var url = base, q = urlLang();
      if (!window.RunvisPageLang && q && q !== 'ko') {
        try { var u = new URL(base); u.pathname = '/' + q + u.pathname; url = u.href; } catch (e) {}
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
  // in KRW because that is what the Korean App Store charges; the approximate
  // local figures on the page are labelled as approximations and have no place
  // in structured data.
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
      offers: OFFERS.map(function (o) {
        return { '@type': 'Offer', name: o.name, price: o.price, priceCurrency: 'KRW', category: o.category };
      })
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
    var d = I18N[code] || {};
    window.RunvisDyn = {
      code: code,
      tts: meta(code).tts,
      hero: [d.hero0, d.hero1, d.hero2, d.hero3],
      vchip: [d.vchip0, d.vchip1, d.vchip2, d.vchip3]
    };
    if (typeof window.renderDynamicI18n === 'function') window.renderDynamicI18n();
  }

  function applyLang(code) {
    current = code;
    document.documentElement.lang = code === 'zh' ? 'zh-Hant' : code;
    applyStatic(I18N[code]);
    applyShots(code);
    applyCanonical(code);
    applyFaqLd(code, I18N[code]);
    applyAppLd(code, I18N[code]);
    publishDynamic(code);
    try { localStorage.setItem('runvis_lang', code); } catch (e) {}
    // Anything mid-flight in the old language should stop — the voice demo
    // listens for this and silences itself instead of talking over the new one.
    try { window.dispatchEvent(new CustomEvent('runvis:lang', { detail: code })); } catch (e) {}
    var label = document.getElementById('langlabel');
    if (label) label.textContent = meta(code).label;
    document.querySelectorAll('#langmenu li').forEach(function (li) {
      li.setAttribute('aria-checked', li.getAttribute('data-code') === code ? 'true' : 'false');
    });
  }

  /// Public entry point. The dictionary for `code` may not be here yet, so this
  /// fetches it first and applies nothing until it lands.
  function setLang(code) {
    if (CODES.indexOf(code) < 0) code = 'ko';
    ensureDict(code, function () { if (I18N[code]) applyLang(code); });
  }
  window.RunvisSetLang = setLang;

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
      li.textContent = l.label;
      // menuitemradio + aria-checked is what a "pick one of six" menu is; plain
      // menuitems left a screen reader unable to say which language was on.
      li.setAttribute('role', 'menuitemradio');
      li.setAttribute('aria-checked', 'false');
      li.setAttribute('data-code', l.code);
      li.setAttribute('lang', l.code === 'zh' ? 'zh-Hant' : l.code);
      li.tabIndex = -1;
      li.addEventListener('click', function () { setLang(l.code); close(true); });
      menu.appendChild(li);
      return li;
    });

    function open() {
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
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
      else if (e.key === 'Escape' || e.key === 'Tab') { close(e.key === 'Escape'); }
    });
    document.addEventListener('click', function () { close(false); });
  }

  function init() {
    buildMenu();
    var code = resolve();
    // The boot script already asked for this one; register it as in flight so
    // ensureDict waits for RunvisOnDict instead of injecting a second copy.
    if (!I18N[code] && code === window.RunvisLang) waiting[code] = waiting[code] || [];
    setLang(code);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
