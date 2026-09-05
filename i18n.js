/* Runvis homepage i18n — switches every [data-i18n] element plus the dynamic
   demo text (hero captions, long-run simulator, voice chips) across six
   languages. Translations live in translations.js (window.RUNVIS_I18N).

   Language resolution: saved choice → browser language → Korean. The choice is
   remembered in localStorage so a returning visitor keeps their language. */
(function () {
  var LANGS = [
    { code: 'ko', label: '한국어',   tts: 'ko-KR' },
    { code: 'en', label: 'English',  tts: 'en-US' },
    { code: 'ja', label: '日本語',   tts: 'ja-JP' },
    { code: 'es', label: 'Español',  tts: 'es-ES' },
    { code: 'zh', label: '繁體中文', tts: 'zh-TW' },
    { code: 'de', label: 'Deutsch',  tts: 'de-DE' }
  ];
  var I18N = window.RUNVIS_I18N || {};
  var current = 'ko';

  function meta(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
    return LANGS[0];
  }

  /// The ?lang= this URL asks for, normalised to one of our table codes, or
  /// null when there is no usable one. Used both to pick the language and to
  /// point the canonical link at this exact URL.
  function urlLang() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) { return null; }
    if (!q) return null;
    q = q.toLowerCase();
    q = q.indexOf('zh') === 0 ? 'zh' : q.slice(0, 2);   // zh-Hant / zh-TW → our zh table
    return I18N[q] ? q : null;
  }

  function resolve() {
    // ?lang= entry points (the hreflang alternates in <head> use them) win over
    // everything — a search engine sent this visitor to a specific language.
    var q = urlLang();
    if (q) return q;
    var saved = null;
    try { saved = localStorage.getItem('runvis_lang'); } catch (e) {}
    if (saved && I18N[saved]) return saved;
    var nav = (navigator.language || 'ko').toLowerCase();
    if (nav.indexOf('zh') === 0) return I18N.zh ? 'zh' : 'en';   // any Chinese → Traditional table
    var two = nav.slice(0, 2);
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === two && I18N[two]) return two;
    return 'ko';
  }

  // There is one set of device captures and it is Korean. The `data-shot`
  // attributes in the markup name each screen so localized captures can be
  // wired up later; until those captures actually exist, nothing is swapped
  // and the `sc.note` caption under the hero says so in all six languages.

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
      el.innerHTML = v;
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
    // The tab title and the link preview are the first thing anyone sees, and
    // they live outside the DOM the loop above walks.
    if (dict['meta.title']) document.title = dict['meta.title'];
    setMeta('name', 'description', dict['meta.desc']);
    setMeta('property', 'og:title', dict['meta.ogtitle']);
    setMeta('property', 'og:description', dict['meta.ogdesc']);
  }

  function setMeta(attr, key, value) {
    if (value == null) return;
    var el = document.querySelector('meta[' + attr + '="' + key + '"]');
    if (el) el.setAttribute('content', value);
  }

  var OG_LOCALE = { ko: 'ko_KR', en: 'en_US', ja: 'ja_JP', es: 'es_ES', zh: 'zh_TW', de: 'de_DE' };

  // Each ?lang= URL should be its own canonical. The <head> ships
  // https://runvis.app/ as canonical and lists the six ?lang= alternates;
  // without this every alternate folded back into the one canonical and only
  // the bare URL stayed indexable. It follows the URL, not the language the
  // reader picks from the menu: the bare URL keeps pointing at itself even
  // when a browser's Accept-Language resolves to English (otherwise "/" would
  // canonicalise to "?lang=en" and orphan the x-default), and switching
  // language by hand does not rewrite the address bar, so it must not rewrite
  // the canonical either. og:locale does follow the shown language, because
  // og:title and og:description already do.
  function applyCanonical(code) {
    var link = document.querySelector('link[rel="canonical"]');
    // The page it belongs to decides the path — this file is shared with
    // run.html, whose canonical is /run.html, not the homepage.
    var base = link ? (link.getAttribute('href') || '').split('?')[0].split('#')[0] : '';
    if (base) {
      var url = base + (urlLang() ? '?lang=' + urlLang() : '');
      link.setAttribute('href', url);
      setMeta('property', 'og:url', url);
    }
    setMeta('property', 'og:locale', OG_LOCALE[code] || 'ko_KR');
  }

  // The FAQ rich result has to carry the same six questions the page shows,
  // in the language the page is showing them in. Rebuilding it from the same
  // dictionary the tiles read is the only way the two cannot drift apart.
  function applyFaqLd(code, dict) {
    var node = document.getElementById('faqld');
    if (!node) return;
    var items = [];
    for (var i = 1; i <= 6; i++) {
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

  function plain(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /// Page scripts call this for their own runtime strings (form results and
  /// the like) so they don't have to reach into the table themselves.
  window.RunvisT = function (key, fallback) {
    var d = I18N[current];
    return (d && d[key]) || fallback;
  };

  // Dynamic demo text is redrawn by the page's own render functions; we just
  // publish the active language's strings + tts code for them to read.
  function publishDynamic(code) {
    var d = I18N[code] || {};
    window.RunvisDyn = {
      code: code,
      tts: meta(code).tts,
      hero: [d.hero0, d.hero1, d.hero2, d.hero3],
      sim: {
        // [timeLabel, messageKey|null-for-silent] — times stay language-neutral
        lsd: [['0:00', d['sim.lsd.0']], ['0:20', d['sim.lsd.1']], ['12:00', null],
              ['40:00', d['sim.lsd.2']], ['1:10:00', d['sim.lsd.3']],
              ['1:45:00', d['sim.lsd.4']], ['2:00:00', d['sim.lsd.5']]],
        half: [['0:00', d['sim.half.0']], ['0:20', d['sim.half.1']], ['5:00', null],
               ['10.5km', d['sim.half.2']], ['18km', d['sim.half.3']], ['19km', d['sim.half.4']]],
        interval: [['0:00', d['sim.interval.0']], ['10:00', d['sim.interval.1']],
                   ['13:00', d['sim.interval.2']], ['15:00', d['sim.interval.3']],
                   ['20:00', null], ['35:00', d['sim.interval.4']]]
      },
      silent: d.silent,
      vchip: [d.vchip0, d.vchip1, d.vchip2, d.vchip3]
    };
    if (typeof window.renderDynamicI18n === 'function') window.renderDynamicI18n();
  }

  function setLang(code) {
    if (!I18N[code]) code = 'ko';
    current = code;
    document.documentElement.lang = code === 'zh' ? 'zh-Hant' : code;
    applyStatic(I18N[code]);
    applyCanonical(code);
    applyFaqLd(code, I18N[code]);
    publishDynamic(code);
    try { localStorage.setItem('runvis_lang', code); } catch (e) {}
    // Anything mid-flight in the old language should stop — the voice demo
    // listens for this and silences itself instead of talking over the new one.
    try { window.dispatchEvent(new CustomEvent('runvis:lang', { detail: code })); } catch (e) {}
    var label = document.getElementById('langlabel');
    if (label) label.textContent = meta(code).label;
    document.querySelectorAll('#langmenu li').forEach(function (li) {
      li.setAttribute('aria-current', li.getAttribute('data-code') === code ? 'true' : 'false');
    });
  }
  window.RunvisSetLang = setLang;

  function buildMenu() {
    var menu = document.getElementById('langmenu');
    var btn = document.getElementById('langbtn');
    var sel = document.getElementById('langsel');
    if (!menu || !btn || !sel) return;
    LANGS.forEach(function (l) {
      if (!I18N[l.code]) return;               // only offer languages we actually have
      var li = document.createElement('li');
      li.textContent = l.label;
      li.setAttribute('role', 'menuitem');
      li.setAttribute('data-code', l.code);
      // Keyboard parity: a menu item that only answers to a mouse is a menu
      // item half the visitors can't use.
      li.tabIndex = 0;
      li.addEventListener('click', function () { setLang(l.code); sel.classList.remove('open'); });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
      });
      menu.appendChild(li);
    });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = sel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function () { sel.classList.remove('open'); });
  }

  function init() {
    buildMenu();
    setLang(resolve());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
