'use strict';
/* Stiver app: default categories and sub-categories. Part of the former prototype/app.js; see docs/MAP.md. */
/* ---------- mock data / store ---------- */
/* the default categories: what a new account starts with (the signup seed has the first ones; the app adds the rest on first load, see ensureDefaultCategories)
   and what the sample data uses. [name, type, icon, colour]; sub-categories are in SUBS. */
const CATS = [
  ['Groceries', 'expense', '🛒', '#4A44C6'], ['Dining', 'expense', '🍽️', '#8B8FF0'], ['Transport', 'expense', '🚌', '#F5B800'],
  ['Shopping', 'expense', '🛍️', '#EC4899'], ['Bills & Utilities', 'expense', '🧾', '#14B8A6'], ['Entertainment', 'expense', '🎬', '#F97316'],
  ['Health', 'expense', '🩺', '#EF4444'], ['Travel', 'expense', '✈️', '#0EA5E9'], ['Subscription', 'expense', '🏷️', '#14B8A6'],
  ['Housing', 'expense', '🏠', '#A855F7'], ['Debt Payment', 'expense', '🏦', '#6366F1'], ['Pet', 'expense', '🐶', '#F59E0B'],
  ['Education', 'expense', '📚', '#06B6D4'], ['Insurance', 'expense', '🛡️', '#10B981'], ['Personal Care', 'expense', '💇', '#D946EF'],
  ['Family & Kids', 'expense', '👨‍👩‍👧', '#FB7185'], ['Gifts & Donations', 'expense', '🎁', '#F43F5E'], ['Taxes', 'expense', '🏛️', '#78716C'],
  ['Fee', 'expense', '💸', '#94A3B8'], ['Investment Loss', 'expense', '📉', '#DC2626'], ['Other', 'expense', '⋯', '#94A3B8'],
  ['Salary', 'income', '💼', '#22C55E'], ['Freelance', 'income', '💻', '#84CC16'], ['Bonus', 'income', '🎉', '#16A34A'], ['Investment Profit', 'income', '📈', '#0D9488'],
  ['Rental income', 'income', '🏘️', '#65A30D'], ['Business income', 'income', '🏪', '#059669'], ['Refunds & cashback', 'income', '↩️', '#2DD4BF'], ['Gift received', 'income', '🎀', '#4ADE80'], ['Lent Repayment', 'income', '🤝', '#0EA5A4'], ['Lent', 'expense', '💸', '#F59E0B'],
  ['Other income', 'income', '➕', '#94A3B8'],
];
// sample accounts per country are defined in sample.js
// one level of sub-categories under a parent; transactions may point at either
const SUBS = {
  Groceries: [['Supermarket', '🏬'], ['Fresh market', '🥬']],
  Dining: [['Coffee', '☕'], ['Restaurants', '🍴'], ['Delivery', '🛵']],
  Transport: [['Fuel', '⛽'], ['Ride-hailing', '🚕'], ['Public transit', '🚇'], ['Parking & tolls', '🅿️'], ['Vehicle service', '🔧']],
  Shopping: [['Clothing', '👕'], ['Electronics', '💻'], ['Online shopping', '📦'], ['Hobbies', '🎨']],
  'Bills & Utilities': [['Electricity', '💡'], ['Water', '🚰'], ['Gas', '🔥'], ['Internet & phone', '🌐']],
  Entertainment: [['Movies', '🎬'], ['Streaming', '📺'], ['Events', '🎟️'], ['Games', '🎮']],
  Health: [['Doctor', '🧑‍⚕️'], ['Pharmacy', '💊'], ['Dental', '🦷'], ['Fitness', '🏋️']],
  Travel: [['Flights', '🛫'], ['Hotels', '🏨'], ['Activities', '🎡']],
  Housing: [['Rent', '🔑'], ['Home maintenance', '🛠️'], ['Furniture & decor', '🛋️'], ['Property tax', '🏡']],
  'Debt Payment': [['Mortgage', '🏠'], ['Vehicle loan', '🚗'], ['Personal loan', '🤝'], ['Credit card', '💳'], ['Student loan', '🎓']],
  Pet: [['Pet food', '🦴'], ['Vet & medicine', '💉'], ['Grooming', '✂️']],
  Education: [['Tuition', '🎓'], ['Courses & books', '📖'], ['School supplies', '✏️']],
  Insurance: [['Life', '🕊️'], ['Health', '🏥'], ['Vehicle', '🚙'], ['Home', '🏡']],
  'Personal Care': [['Salon & barber', '💈'], ['Skincare & beauty', '🧴'], ['Spa & massage', '💆']],
  'Family & Kids': [['Childcare', '👶'], ["Kids' activities", '⚽'], ['Baby supplies', '🍼'], ['Parents support', '👵']],
  'Gifts & Donations': [['Gifts', '🎁'], ['Charity', '🤲'], ['Religious giving', '🙏']],
  Taxes: [['Income tax', '📑'], ['Vehicle tax', '🚘'], ['Other taxes', '🧾']],
  'Investment Profit': [['Dividends', '💵'], ['Interest', '🏦'], ['Capital Gain', '📈']],   // Investment Loss is a category of its own, without sub-categories
};
/* every account gets the whole list on first load when it has no transactions and no budgets yet; accounts with data only get the ones below
   (so their own categories do not suddenly multiply). A category that already exists by name (archived ones too) is never added twice,
   and sub-categories are only added under a parent created here. Returns true when something was added. */
const ESSENTIAL_CATS = ['Housing', 'Debt Payment', 'Pet'];
/* default categories get a fixed id per user and name: two devices (or two loads) that both notice a default is missing create the SAME rows,
   so the second save is a harmless repeat instead of a "duplicate key" error that threw the whole save away */
const defaultCatId = (name, sub) => detId('defcat', state.auth.uid || '', name, sub || '');
const subsOf = (name, type) => SUBS[name + '|' + type] || SUBS[name] || [];
function ensureDefaultCategories() {
  const d = D(), full = d.transactions.length === 0 && d.budgets.length === 0; let changed = false;
  // earlier versions had an "Investment" category (income: Dividends, Interest, Investment Profit; expense: Investment Loss).
  // Now "Investment Profit" is the income category (Dividends, Interest, Capital Gain) and "Investment Loss" an expense category of its own
  const top = (name, type) => d.categories.find((c) => !c.parent_id && c.type === type && c.name.trim().toLowerCase() === name);
  const oldInc = top('investment', 'income');
  if (oldInc && !top('investment profit', 'income')) {
    oldInc.name = 'Investment Profit'; changed = true;
    const sp = d.categories.find((c) => c.parent_id === oldInc.id && c.name.trim().toLowerCase() === 'investment profit'); if (sp) sp.name = 'Capital Gain';
  }
  const oldExp = top('investment', 'expense');
  d.categories.filter((c) => c.type === 'expense' && c.name.trim().toLowerCase() === 'investment loss' && c.parent_id).forEach((c) => { c.parent_id = null; changed = true; });
  if (oldExp && !d.categories.some((c) => c.parent_id === oldExp.id) && !d.transactions.some((t) => t.category_id === oldExp.id) && !d.budgets.some((b) => b.category_id === oldExp.id)) { d.categories = d.categories.filter((c) => c.id !== oldExp.id); changed = true; }
  // the default was first called "Loan Repayment", then "Loan Payment": it is now "Debt Payment" (renamed once, and only when that name is free)
  const oldLoan = d.categories.find((c) => !c.parent_id && ['loan payment', 'loan repayment'].includes(c.name.trim().toLowerCase()));
  if (oldLoan && !d.categories.some((c) => !c.parent_id && c.name.trim().toLowerCase() === 'debt payment')) { oldLoan.name = 'Debt Payment'; changed = true; }
  CATS.forEach(([n, type, icon, color]) => {
    if (!full && !ESSENTIAL_CATS.includes(n)) return;
    if (d.categories.some((c) => !c.parent_id && c.name.trim().toLowerCase() === n.toLowerCase() )) return;
    const parent = { id: defaultCatId(n, ''), parent_id: null, name: n, type, icon, color, archived: false }; d.categories.push(parent); changed = true;
    subsOf(n, type).forEach(([sn, sic]) => d.categories.push({ id: defaultCatId(n, sn), parent_id: parent.id, name: sn, type, icon: sic, color, archived: false }));
  });
  return changed;
}

