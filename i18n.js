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

  function resolve() {
    // ?lang= entry points (the hreflang alternates in <head> use them) win over
    // everything — a search engine sent this visitor to a specific language.
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q) {
        q = q.toLowerCase();
        if (q.indexOf('zh') === 0) q = 'zh';       // zh-Hant / zh-TW → our zh table
        else q = q.slice(0, 2);
        if (I18N[q]) return q;
      }
    } catch (e) {}
    var saved = null;
    try { saved = localStorage.getItem('runvis_lang'); } catch (e) {}
    if (saved && I18N[saved]) return saved;
    var nav = (navigator.language || 'ko').toLowerCase();
    if (nav.indexOf('zh') === 0) return I18N.zh ? 'zh' : 'en';   // any Chinese → Traditional table
    var two = nav.slice(0, 2);
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === two && I18N[two]) return two;
    return 'ko';
  }

  // Apply static [data-i18n] text. Values are HTML (they carry <b>/<span>/<br>).
  function applyStatic(dict) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')];
      if (v != null) el.innerHTML = v;
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
    publishDynamic(code);
    try { localStorage.setItem('runvis_lang', code); } catch (e) {}
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
      li.addEventListener('click', function () { setLang(l.code); sel.classList.remove('open'); });
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
