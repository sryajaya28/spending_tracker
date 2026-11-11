'use strict';
/* Stiver app: budget periods (month or custom start day). Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- budget periods ----------
   A "month" key (YYYY-MM) names the period that STARTS in that month. With the default start day 1 a period is a calendar
   month; with start day 25 the period "2026-10" runs 25 Oct to 24 Nov (set in Settings, saved on the profile). */
const periodDay = () => (state.data && state.data.profile && state.data.profile.period) || 1;
const periodStart = (k) => `${k}-${pad(periodDay())}`;
const periodEnd = (k) => { const d = periodDay(), y = +k.slice(0, 4), m = +k.slice(5, 7) - 1; return d === 1 ? `${k}-${pad(new Date(y, m + 1, 0).getDate())}` : isoDate(new Date(y, m + 1, d - 1)); };
const inPeriod = (iso, k) => iso >= periodStart(k) && iso <= periodEnd(k);
const periodKeyOf = (iso) => (+iso.slice(8, 10) >= periodDay() ? iso.slice(0, 7) : monthKey(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 2, 1)));
const currentPeriod = () => periodKeyOf(isoDate(new Date()));
/* "since" fields (wallet, holding, loan) are calendar months of creation; a period includes anything that started by its last day */
const liveIn = (since, k) => `${since || '0000-00'}-01` <= periodEnd(k);
const monthLabel = (k, style = 'long') => {
  const d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1);
  if (style !== 'long') return d.toLocaleDateString(locale(), { month: 'short' });
  if (periodDay() === 1) return d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const f = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  return `${f(periodStart(k))} – ${f(periodEnd(k))}`;
};
/* compact label for filters: "Oct 2026", or "Oct 25–Nov 24" when the period does not start on the 1st */
const periodShort = (k) => {
  if (periodDay() === 1) return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'short', year: 'numeric' });
  const f = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  return `${f(periodStart(k))}–${f(periodEnd(k))}`;
};
/* a period's full heading with the year(s): "November 2026", or "Oct 25 – Nov 24, 2026" when periods do not start on the 1st */
const periodHeading = (k) => {
  if (periodDay() === 1) return monthLabel(k);
  const a = periodStart(k), b = periodEnd(k), f = (iso, y) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).toLocaleDateString(locale(), y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
  return a.slice(0, 4) === b.slice(0, 4) ? `${f(a)} – ${f(b, true)}` : `${f(a, true)} – ${f(b, true)}`;
};
const periodName = (k) => (periodDay() === 1 ? new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(locale(), { month: 'long' }) : monthLabel(k));
const lastMonths = (n) => { const c = currentPeriod(), t = new Date(+c.slice(0, 4), +c.slice(5, 7) - 1, 1); return Array.from({ length: n }, (_, i) => monthKey(new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1))); };

