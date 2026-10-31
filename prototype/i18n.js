'use strict';
/* Translations. English text is the key, so English needs no entries and any missing translation simply
   shows in English. Variables are written {name}. Add a language: add it to LANGS and LOCALES and give it a
   dictionary in DICT (see i18n-id.js). */
const LANGS = { en: 'English', id: 'Bahasa Indonesia' };
const LOCALES = { en: 'en', id: 'id-ID' };   // number and date formatting
const DICT = {};
let LANG = 'en';
const __ = (s, v) => {
  let o = (DICT[LANG] && DICT[LANG][s]) || s;
  if (v) o = o.replace(/\{(\w+)\}/g, (_, k) => (v[k] === undefined ? '' : v[k]));
  return o;
};
const locale = () => LOCALES[LANG] || 'en';
function setLang(l) { LANG = LANGS[l] ? l : 'en'; document.documentElement.lang = LANG; try { localStorage.setItem('stiver.lang.v1', LANG); } catch { /* storage unavailable */ } }
function initialLang() {
  try { const s = localStorage.getItem('stiver.lang.v1'); if (s && LANGS[s]) return s; } catch { /* ignore */ }
  return (navigator.language || 'en').toLowerCase().startsWith('id') ? 'id' : 'en';
}

/* ---------- appearance (light / dark / follow the device) ---------- */
const THEMES = ['system', 'light', 'dark'];
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let THEME = 'system';
const effectiveTheme = () => (THEME === 'dark' || (THEME === 'system' && darkQuery && darkQuery.matches) ? 'dark' : 'light');
function applyTheme(mode) {
  THEME = THEMES.includes(mode) ? mode : 'system';
  const eff = effectiveTheme();
  document.documentElement.dataset.theme = eff;
  document.documentElement.dataset.themeMode = THEME;
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', eff === 'dark' ? '#0e0d22' : '#4A44C6');
  try { localStorage.setItem('stiver.theme.v1', THEME); } catch { /* storage unavailable */ }
}
function initialTheme() { try { const t = localStorage.getItem('stiver.theme.v1'); if (t && THEMES.includes(t)) return t; } catch { /* ignore */ } return 'system'; }
if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => { if (THEME === 'system') applyTheme('system'); });
