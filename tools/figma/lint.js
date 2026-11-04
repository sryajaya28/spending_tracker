// Lint for the Features page (read-only): paste into use_figma. Every "Feature - ..." section needs a request note, a status line,
// phone frames in Light and Dark, and an "Owner comments" layer. Returns { ok, problems[] }.
const FP = figma.root.children.find((p) => p.name === 'Features'); await FP.loadAsync(); await figma.setCurrentPageAsync(FP);
const problems = [], sections = FP.children.filter((n) => n.type === 'SECTION' && n.name.startsWith('Feature - '));
for (const s of sections) {
  const texts = s.findAll((n) => n.type === 'TEXT').map((t) => t.characters), frames = s.children.filter((n) => n.type === 'FRAME').map((f) => f.name);
  if (!texts.some((t) => /^Request \(owner\)/.test(t))) problems.push(`${s.name}: no "Request (owner): ..." note`);
  if (!texts.some((t) => /Status: /.test(t))) problems.push(`${s.name}: no "Status: ..." line`);
  if (!frames.some((f) => /Phone 390.*light/i.test(f))) problems.push(`${s.name}: no phone frame in light`);
  if (!frames.some((f) => /Phone 390.*dark/i.test(f))) problems.push(`${s.name}: no phone frame in dark`);
  if (!s.findOne((n) => n.type === 'TEXT' && n.name === 'Owner comments')) problems.push(`${s.name}: no "Owner comments" layer (warning for older sections)`);
}
return { sections: sections.map((s) => s.name), ok: problems.length === 0, problems };
