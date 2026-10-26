/* GENERATED FILE — built from src/i18n.js by tools/prerender.mjs. Do not edit. */
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
  var DICT_V = '20261025a';
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
    v = v.indexOf('zh') === 0 ? 'zh' : v.slice(0, 2);
    return CODES.indexOf(v) >= 0 ? v : null;
  }
  function navLang(v) {
    var s = v ? String(v).toLowerCase() : '';
    return (s.indexOf('zh') === 0 && !/^zh-(hant|tw|hk|mo)\b/.test(s)) ? null : norm(s);
  }
  function urlLang() {
    try { return norm(new URLSearchParams(location.search).get('lang')); } catch (e) { return null; }
  }
  function docLang() { return norm(window.RunvisDocLang) || norm(window.RunvisPageLang) || 'ko'; }
  function preferred() { return norm(window.RunvisPrefer) || navLang(navigator.language) || 'en'; }
  function resolve() {
    if (norm(window.RunvisLang)) return norm(window.RunvisLang);
    var q = urlLang();
    if (q) return q;
    var page = norm(window.RunvisPageLang);
    if (page) return page;
    var saved = null;
    try { saved = localStorage.getItem('runvis_lang'); } catch (e) {}
    if (norm(saved)) return norm(saved);
    return docLang();
  }
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
      if (code !== window.RunvisDictLoaded) {
        var s = document.createElement('script');
        s.src = BASE + 't-' + code + '.js?v=' + DICT_V;
        s.async = false;
        s.onerror = function () {
          if (window.console) console.warn('i18n: dictionary failed to load —', code);
          waiting[code] = null;
        };
        document.head.appendChild(s);
      }
    }
    if (waiting[code]) waiting[code].push(cb);
  }
  var SHOT_LANGS = { en: 1, ja: 1, es: 1, zh: 1, de: 1 };
  var SHOTS = {
    'framed-phone-dash': 1, 'framed-phone-detail': 1, 'framed-phone-glance': 1,
    'framed-phone-plan': 1, 'framed-phone-race': 1,
    'framed-watch-hero': 1,
    'framed-watch-pace': 1, 'framed-watch-hr': 1, 'framed-watch-map': 1,
    'framed-duo-detail': 1
  };
  function applyShots(code) {
    document.querySelectorAll('img[data-shot]').forEach(function (img) {
      var base = img.getAttribute('data-shot');
      if (!SHOTS[base]) return;
      var stem = BASE + 'assets/' + base + (SHOT_LANGS[code] ? '.' + code : '');
      if (img.getAttribute('src') !== stem + '.png') img.setAttribute('src', stem + '.png');
      var pic = img.parentNode;
      if (pic && pic.tagName === 'PICTURE') {
        pic.querySelectorAll('source').forEach(function (so) {
          var ext = so.getAttribute('type') === 'image/avif' ? '.avif' : '.webp';
          if (so.getAttribute('srcset') !== stem + ext) so.setAttribute('srcset', stem + ext);
        });
      }
    });
  }
  var HERO_LANGS = { en: 1, es: 1, de: 1 };
  function applyHero(code) {
    if (typeof window.RunvisHeroSet === 'function') window.RunvisHeroSet(HERO_LANGS[code] ? '.' + code : '');
  }
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
  function applyStatic(dict) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')];
      if (v == null) return;
      if (!tagsClose(v)) {
        if (window.console) console.warn('i18n: unbalanced value kept out of the page —', el.getAttribute('data-i18n'));
        return;
      }
      if (el.tagName === 'TITLE') el.textContent = v; else el.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length !== 2) return;
        var v = dict[bits[1].trim()];
        if (v != null) el.setAttribute(bits[0].trim(), v);
      });
    });
  }
  function setMeta(attr, key, value) {
    if (value == null) return;
    var el = document.querySelector('meta[' + attr + '="' + key + '"]');
    if (el) el.setAttribute('content', value);
  }
  var OG_LOCALE = { ko: 'ko_KR', en: 'en_US', ja: 'ja_JP', es: 'es_ES', zh: 'zh_TW', de: 'de_DE' };
  function applyCanonical(code) {
    var link = document.querySelector('link[rel="canonical"]');
    var base = link ? (link.getAttribute('data-base')
      || (link.getAttribute('href') || '').split('?')[0].split('#')[0]) : '';
    if (link && base) link.setAttribute('data-base', base);
    if (base) {
      var url = base, own = docLang();
      if (code !== own) {
        try {
          var u = new URL(base), p = u.pathname;
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
  var FAQ_COUNT = 10;
  function applyFaqLd(code, dict) {
    var node = document.getElementById('faqld');
    if (!node) return;
    var items = [];
    for (var i = 1; i <= FAQ_COUNT; i++) {
      var q = dict['n.faq.q' + i], a = dict['n.faq.a' + i];
      if (!q || !a) return;
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
      image: 'https://runvis.app/assets/og-card' + (code === 'ko' ? '' : '.' + code) + '.png',
      screenshot: 'https://runvis.app/assets/framed-phone-dash' + (code === 'ko' ? '' : '.' + code) + '.png',
      author: { '@type': 'Organization', name: 'Runvis', url: 'https://runvis.app/' },
      offers: OFFERS.map(function (o) {
        return {
          '@type': 'Offer', name: o.name, price: o.price, priceCurrency: 'KRW', category: o.category,
          availability: 'https://schema.org/PreOrder',
          eligibleRegion: { '@type': 'Country', name: 'KR' }
        };
      })
    });
  }
  var PAGE_META = {
    'run.html': { title: 'r1', desc: 'r2' },
    'how-it-works.html': { title: 'hw.meta.title', desc: 'hw.meta.desc' },
    'privacy.html': { title: 'pv.meta.title', desc: 'pv.meta.desc' },
    'terms.html': { title: 'tm.meta.title', desc: 'tm.meta.desc' },
    'about.html': { title: 'ab.meta.title', desc: 'ab.meta.desc' }
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
  window.RunvisT = function (key, fallback) {
    var d = I18N[current];
    return (d && d[key]) || fallback;
  };
  function publishDynamic(code) {
    var d = I18N[code];
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
  function applyLang(code, remember) {
    current = code;
    document.documentElement.lang = code === 'zh' ? 'zh-Hant' : code;
    applyStatic(I18N[code]);
    applyShots(code);
    applyHero(code);
    applyCanonical(code);
    applyFaqLd(code, I18N[code]);
    applyAppLd(code, I18N[code]);
    applyPageLd(code, I18N[code]);
    publishDynamic(code);
    if (remember) { try { localStorage.setItem('runvis_lang', code); } catch (e) {} }
    try { window.dispatchEvent(new CustomEvent('runvis:lang', { detail: code })); } catch (e) {}
    var label = document.getElementById('langlabel');
    if (label) label.textContent = meta(code).label;
    document.querySelectorAll('#langmenu [data-code]').forEach(function (item) {
      item.setAttribute('aria-checked', item.getAttribute('data-code') === code ? 'true' : 'false');
    });
  }
  function applySelf(code, remember) {
    current = code;
    applyShots(code);
    applyHero(code);
    applyCanonical(code);
    publishDynamic(code);
    if (remember) { try { localStorage.setItem('runvis_lang', code); } catch (e) {} }
    try { window.dispatchEvent(new CustomEvent('runvis:lang', { detail: code })); } catch (e) {}
    var label = document.getElementById('langlabel');
    if (label) label.textContent = meta(code).label;
    document.querySelectorAll('#langmenu [data-code]').forEach(function (item) {
      item.setAttribute('aria-checked', item.getAttribute('data-code') === code ? 'true' : 'false');
    });
  }
  function setLang(code, remember) {
    if (CODES.indexOf(code) < 0) code = 'ko';
    ensureDict(code, function () { if (I18N[code]) applyLang(code, remember); });
  }
  window.RunvisSetLang = function (code) { setLang(code, true); };
  function pageFile() {
    var seg = location.pathname.split('/').filter(Boolean);
    if (window.RunvisPageLang && seg.length && seg[0] === window.RunvisPageLang) seg.shift();
    var last = seg.length ? seg[seg.length - 1] : '';
    return /\.html?$/.test(last) ? last : '';
  }
  function langHref(code) {
    return (code === 'ko' ? '/' : '/' + code + '/') + pageFile() + location.hash;
  }
  function buildMenu() {
    var menu = document.getElementById('langmenu');
    var btn = document.getElementById('langbtn');
    var sel = document.getElementById('langsel');
    if (!menu || !btn || !sel) return;
    var items = LANGS.map(function (l) {
      var li = document.createElement('li');
      li.setAttribute('role', 'none');
      var a = document.createElement('a');
      a.textContent = l.label;
      a.href = langHref(l.code);
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
    menu.addEventListener('keydown', function (e) {
      var li = e.target;
      if (items.indexOf(li) < 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); move(li, 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(li, -1); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === ' ') { e.preventDefault(); li.click(); }
      else if (e.key === 'Escape' || e.key === 'Tab') { close(e.key === 'Escape'); }
    });
    document.addEventListener('click', function () { close(false); });
    menu.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-code]') : null;
      if (a) rememberChoice(a.getAttribute('data-code'));
    });
  }
  function rememberChoice(code) {
    if (CODES.indexOf(code) < 0) return;
    try { localStorage.setItem('runvis_lang', code); } catch (e) {}
  }
  var OFFER = {
    ko: { msg: '이 페이지는 한국어로도 볼 수 있습니다.', cta: '한국어로 보기', close: '닫기' },
    en: { msg: 'This page is also available in English.', cta: 'Read in English', close: 'Dismiss' },
    ja: { msg: 'このページは日本語でも読めます。', cta: '日本語で読む', close: '閉じる' },
    es: { msg: 'Esta página también está en español.', cta: 'Leer en español', close: 'Cerrar' },
    zh: { msg: '這個頁面也有繁體中文版。', cta: '用繁體中文閱讀', close: '關閉' },
    de: { msg: 'Diese Seite gibt es auch auf Deutsch.', cta: 'Auf Deutsch lesen', close: 'Schließen' }
  };
  function alternateHref(code) {
    var el = document.querySelector('link[rel="alternate"][hreflang="'
      + (code === 'zh' ? 'zh-Hant' : code) + '"]');
    var href = el ? el.getAttribute('href') : null;
    return href || null;
  }
  function offerLanguage(shown, saved) {
    if (urlLang()) return;
    var want = saved || preferred();
    if (!want || want === shown) return;
    try { if (sessionStorage.getItem('runvis_offer_off')) return; } catch (e) {}
    var t = OFFER[want], href = alternateHref(want);
    if (!t || !href) return;
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
      + 'body.has-langoffer .sticky-cta{bottom:var(--langoffer-h,58px)}';
    document.head.appendChild(css);
    var bar = document.createElement('div');
    bar.className = 'langoffer';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', t.cta);
    bar.setAttribute('lang', want === 'zh' ? 'zh-Hant' : want);
    var span = document.createElement('span');
    span.textContent = t.msg;
    var a = document.createElement('a');
    a.href = href;
    a.addEventListener('click', function () { rememberChoice(want); });
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
    var skip = document.querySelector('body > a.skip');
    if (skip && skip.nextSibling) document.body.insertBefore(bar, skip.nextSibling);
    else if (skip) document.body.appendChild(bar);
    else document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-langoffer');
    var setH = function () {
      document.body.style.setProperty('--langoffer-h', bar.offsetHeight + 'px');
    };
    setH();
    if (window.ResizeObserver) new ResizeObserver(setH).observe(bar);
    else window.addEventListener('resize', setH);
    window.addEventListener('orientationchange', function () { setTimeout(setH, 150); });
  }
  function init() {
    buildMenu();
    var code = resolve();
    var arrivedWith = null;
    try { arrivedWith = norm(localStorage.getItem('runvis_lang')); } catch (e) {}
    var remember = !!(urlLang() || norm(window.RunvisPageLang));
    if (!I18N[code] && code !== window.RunvisDictLoaded && code === docLang()) {
      applySelf(code, remember);
    } else {
      if (!I18N[code] && code === window.RunvisDictLoaded) waiting[code] = waiting[code] || [];
      setLang(code, remember);
    }
    offerLanguage(code, arrivedWith);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
