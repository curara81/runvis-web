/* DEPRECATED — the 245 KB six-language table was split on 2026-09-06 into
   t-ko.js … t-de.js so a visitor downloads one dictionary (~37-49 KB) instead
   of all six. Nothing in the site loads this file any more: index.html,
   run.html, privacy.html and terms.html each carry an inline <head> boot script
   that injects the single t-<code>.js it needs, and i18n.js fetches a second
   one only when the reader changes language.

   It is kept as a shim so a browser still holding a cached copy of the old
   markup (which asks for translations.js by name) resolves the language the
   same way and pulls the right file instead of getting a 404 and a page with
   no dictionary at all. Do not add strings here — edit t-<code>.js. */
(function () {
  if (window.RUNVIS_I18N && Object.keys(window.RUNVIS_I18N).length) return;
  var L = ['ko', 'en', 'ja', 'es', 'zh', 'de'];
  function norm(v) {
    if (!v) return null;
    v = String(v).toLowerCase();
    v = v.indexOf('zh') === 0 ? 'zh' : v.slice(0, 2);
    return L.indexOf(v) >= 0 ? v : null;
  }
  var q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  var code = norm(q);
  if (!code) { try { code = norm(localStorage.getItem('runvis_lang')); } catch (e) {} }
  if (!code) code = norm(navigator.language) || 'ko';
  window.RunvisLang = window.RunvisLang || code;
  var s = document.createElement('script');
  s.src = 't-' + code + '.js?v=20260906e';
  s.async = false;
  document.head.appendChild(s);
})();
