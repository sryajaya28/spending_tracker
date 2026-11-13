// Example (after the helpers): the Edit debt dialog with a repeat set, light and dark from the same code. Place it where you want, then screenshot.
const holder = LIB;   // for a feature, use its own section: const sec = figma.createSection(); sec.name = 'Feature - <short-name>';
const out = [];
for (const [mode, x] of [['Light', 900], ['Dark', 1360]]) {
  const p = phone(holder, `Example - Edit debt, Every month - Phone 390 - ${mode}`, mode, x, 820);
  const d = card(p, 'Edit debt dialog');
  const tr = frame(d, { name: 'Title row', dir: 'HORIZONTAL', justify: 'SPACE_BETWEEN', align: 'CENTER', fillW: true }); await text(tr, 'Edit debt', 'Title/22 Bold', 'color/ink'); inst('Close', {}, tr);
  inst('Field', { Type: 'input', State: 'default', Label: 'Name', Value: 'Housing loan' }, d, true);
  const r1 = frame(d, { name: 'Row', dir: 'HORIZONTAL', gap: 12, fillW: true }); for (const [l, v] of [['Type', 'Mortgage'], ['Currency', 'IDR']]) { const f = inst('Field', { Type: 'select', State: 'default', Label: l, Value: v }, r1); f.layoutGrow = 1; }
  inst('Field', { Type: 'input', State: 'default', Label: 'Amount owed now', Value: '852500000' }, d, true);
  inst('Field', { Type: 'select', State: 'new', Label: 'Repeat payment', Value: 'Every month' }, d, true);
  const r2 = frame(d, { name: 'Row', dir: 'HORIZONTAL', gap: 12, fillW: true }); for (const [l, v, s] of [['Monthly payment', '9500000', 'new'], ['Next payment', '5 Dec 2026', 'default']]) { const f = inst('Field', { Type: 'input', State: s, Label: l, Value: v }, r2); f.layoutGrow = 1; }
  inst('Field', { Type: 'select', State: 'default', Label: 'Paid from', Value: 'BCA' }, d, true);
  inst('Field', { Type: 'input', State: 'new', Label: 'Installments remaining (Monthly)', Value: '130' }, d, true);
  const r3 = frame(d, { name: 'Row', dir: 'HORIZONTAL', gap: 12, fillW: true, align: 'MAX' }); for (const [l, v, t] of [['Interest rate (% per year, optional)', '7.2', 'input'], ['Interest type', 'Declining balance', 'select']]) { const f = inst('Field', { Type: t, State: 'default', Label: l, Value: v }, r3); f.layoutGrow = 1; }
  inst('Hint', { Text: 'Type what you still owe today. __PROJECT__ keeps your payments and charges and adjusts the starting amount (Rp 900.000.000) behind the scenes.' }, d, true);
  const act = frame(d, { name: 'Actions', dir: 'HORIZONTAL', gap: 10, justify: 'MAX', fillW: true }); inst('Button', { Kind: 'danger', Label: 'Archive' }, act); inst('Button', { Kind: 'primary', Label: 'Save' }, act);
  out.push({ mode, id: p.id, h: Math.round(p.height) });
}
return out;
