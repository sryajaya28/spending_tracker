// --- __PROJECT__ Figma helpers: paste this block at the top of a use_figma call (see docs/FIGMA.md). Needs the Library page of the __PROJECT__ file. ---
const coll = (await figma.variables.getLocalVariableCollectionsAsync()).find((c) => c.name === '__PROJECT__ tokens'), M = Object.fromEntries(coll.modes.map((m) => [m.name, m.modeId]));
const V = new Map((await figma.variables.getLocalVariablesAsync()).map((v) => [v.name, v])), S = new Map((await figma.getLocalTextStylesAsync()).map((s) => [s.name, s]));
for (const st of ['Regular', 'Medium', 'Semi Bold', 'Bold']) await figma.loadFontAsync({ family: 'Inter', style: st });
const LIB = figma.root.children.find((p) => p.name === 'Library'); await LIB.loadAsync();
const bind = (n, v) => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', V.get(v));
const fillOf = (n, v) => { n.fills = [bind(n, v)]; return n; };
const frame = (p, o = {}) => { const f = figma.createAutoLayout(o.dir || 'VERTICAL'); f.name = o.name || 'Frame'; f.itemSpacing = o.gap ?? 0; f.paddingLeft = f.paddingRight = o.px ?? 0; f.paddingTop = f.paddingBottom = o.py ?? 0; f.fills = []; if (o.fill) fillOf(f, o.fill); if (o.radius) ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'].forEach((k) => f.setBoundVariable(k, V.get(o.radius))); if (o.align) f.counterAxisAlignItems = o.align; if (o.justify) f.primaryAxisAlignItems = o.justify; p.appendChild(f); if (o.fillW) f.layoutSizingHorizontal = 'FILL'; return f; };
const text = async (p, s, style, color, fillW) => { const t = figma.createText(); await t.setTextStyleIdAsync(S.get(style).id); t.characters = s; fillOf(t, color); p.appendChild(t); if (fillW) { t.textAutoResize = 'HEIGHT'; t.layoutSizingHorizontal = 'FILL'; } return t; };
const inst = (name, props, p, fillW) => { const c = LIB.findOne((x) => (x.type === 'COMPONENT' || x.type === 'COMPONENT_SET') && x.name === name), i = (c.defaultVariant || c).createInstance(); const keys = Object.keys(i.componentProperties), set = {}; for (const [k, v] of Object.entries(props || {})) set[keys.find((x) => x === k || x.startsWith(k + '#'))] = v; i.setProperties(set); if (p) { p.appendChild(i); if (fillW) i.layoutSizingHorizontal = 'FILL'; } return i; };
const card = (p, name) => { const c = frame(p, { name, gap: 14, px: 24, py: 24, fill: 'color/surface', radius: 'radius/card', fillW: true }); c.effectStyleId = figma.getLocalEffectStyles().find((s) => s.name === 'Shadow/card').id; return c; };
const phone = (section, name, mode, x, y) => { const f = frame(section, { name, gap: 14, px: 16, py: 16, fill: 'color/bg' }); f.resize(390, 100); f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'FIXED'; f.x = x; f.y = y; f.setExplicitVariableModeForCollection(coll, M[mode]); return f; };
// --- end helpers ---
// Feature section starter (switches to the Features page: call it once per script). Creates "Feature - <shortName>" with the request note, a status line and an "Owner comments" layer.
const featureSection = async (shortName, request, status = 'design') => {
  const FP = figma.root.children.find((p) => p.name === 'Features'); await FP.loadAsync(); await figma.setCurrentPageAsync(FP);
  let y = 0; for (const n of FP.children) y = Math.max(y, n.y + n.height);
  const sec = figma.createSection(); sec.name = 'Feature - ' + shortName; sec.x = 0; sec.y = y + 200; sec.resizeWithoutConstraints(1500, 1400); sec.fills = [{ type: 'SOLID', color: { r: 0.914, g: 0.922, b: 0.969 } }];
  const note = await text(sec, `Request (owner): ${request}\nStatus: ${status}.`, 'Body/15 Regular', 'color/ink'); note.x = 40; note.y = 40; note.textAutoResize = 'HEIGHT'; note.resize(1400, 60);
  const oc = await text(sec, 'Owner comments: (write feedback here, or paste it in the chat)', 'Note/12 Regular', 'color/muted'); oc.name = 'Owner comments'; oc.x = 40; oc.y = 110; oc.textAutoResize = 'HEIGHT'; oc.resize(1400, 20);
  return sec;
};
