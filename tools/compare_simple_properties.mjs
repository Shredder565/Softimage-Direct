// PROP-SIMPLE: CustomColor / TextProp custom properties and their Get > Property anchor menu items.
// Expected values are the tables of docs/ghidra/cmd-01b-sdk-helpers.md ("Related: CustomColor and TextProp
// properties"). No XSIBATCH golden exists for this row yet, so this checks against the spec, not a dump.
// Needs `vite preview` on :4173. Usage: node tools/compare_simple_properties.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

// ---- expected, from the spec note
const SPEC = {
  anchor: 'siMenuTbGetPropertyPSetID',
  menuLabels: ['CustomColor', 'TextProp'],
  msg1174: 'Please select something and try again',
  CustomColor: {
    params: ['Color_R', 'Color_G', 'Color_B', 'Color_A'].map(name => ({ name, type: 'double', value: 0, min: 0, max: 1, uimin: 0, uimax: 1, animatable: true })),
    layout: [{ param: 'Color_R', label: 'Color', control: 'rgba' }],
    help: '<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/property8539.htm',
  },
  TextProp: {
    params: [{ name: 'Text', type: 'string' }],
    layout: [{ param: 'Text', control: 'multiline', height: 275, opts: ['NoLabel'] }],
    help: '<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/property8541.htm',
  },
};

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
await page.goto('http://localhost:4173/?demo'); await page.waitForTimeout(1000);

const r = await page.evaluate(async (anchor) => {
  const A = window.Application;
  const wait = (ms) => new Promise(res => setTimeout(res, ms));
  const describe = (p) => p && ({
    name: p.name, type: p.type, kind: p.kind, help: p.helpTopic, layout: p.layout,
    params: p.params.map(q => ({ name: q.name, type: q.def.type, value: q.value, min: q.def.min, max: q.def.max, uimin: q.def.uimin, uimax: q.def.uimax, animatable: q.animatable })),
  });
  const propsOf = (o) => o.properties.filter(p => p.type === 'CustomColor' || p.type === 'TextProp').map(p => p.type);
  const closeBoxes = () => document.querySelectorAll('.si-msgbox-ok').forEach(x => x.click());
  const out = {};

  A.run('NewScene');
  A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'boxA' });
  A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'ballB' });
  const boxA = A.scene.find('boxA'), ballB = A.scene.find('ballB');

  out.items = window.__anchorMenuItems(anchor);

  // nothing selected: message 1174, nothing added
  A.select([]);
  const undo0 = A.undoStack.length;
  out.none = {};
  for (const label of ['CustomColor', 'TextProp']) {
    const res = window.__runAnchorMenu(anchor, label); await wait(50);
    out.none[label] = { result: res === null ? null : 'property', box: [...document.querySelectorAll('.si-msgbox-text')].map(x => x.textContent), undoGrew: A.undoStack.length - undo0, added: propsOf(boxA).length + propsOf(ballB).length };
    closeBoxes(); await wait(20);
  }
  out.boxesClosed = document.querySelectorAll('.si-msgbox-text').length === 0;

  // two objects selected: property goes on the first one only, and is inspected
  out.menu = {};
  for (const label of ['CustomColor', 'TextProp']) {
    A.select([boxA, ballB]);
    const p = window.__runAnchorMenu(anchor, label); await wait(150);
    const ctl = document.querySelector(label === 'CustomColor' ? '.ppg-row[data-control="rgba"]' : '.ppg-row[data-control="multiline"]');
    const ta = ctl?.querySelector('textarea');
    out.menu[label] = {
      prop: describe(p), onFirst: propsOf(boxA).includes(label), onSecond: propsOf(ballB).includes(label), parent: p?.parent?.name,
      box: document.querySelectorAll('.si-msgbox-text').length,
      inspected: !!ctl,
      rowLabel: ctl?.querySelector('label')?.textContent ?? null,
      hasSwatch: !!ctl?.querySelector('input[type=color]'), hasAlpha: !!ctl?.querySelector('.ppg-rgba-alpha'),
      textareaHeight: ta ? ta.getBoundingClientRect().height : null,
      channelRows: document.querySelectorAll('.ppg-row[data-param="Color_G"], .ppg-row[data-param="Color_B"], .ppg-row[data-param="Color_A"]').length,
    };
  }

  // parameter behaviour
  const cc = boxA.properties.find(p => p.type === 'CustomColor'), tp = boxA.properties.find(p => p.type === 'TextProp');
  cc.set('Color_R', 2); cc.set('Color_G', -1); cc.set('Color_B', 0.25); cc.set('Color_A', 0.5);
  out.clamp = ['Color_R', 'Color_G', 'Color_B', 'Color_A'].map(n => cc.val(n));
  tp.set('Text', 'line one\nline two');
  out.text = tp.val('Text');

  // undo of the menu item removes the property again
  A.select([ballB]);
  window.__runAnchorMenu(anchor, 'TextProp'); await wait(50);
  const had = propsOf(ballB).includes('TextProp');
  A.run('Undo'); await wait(50);
  out.undo = { had, after: propsOf(ballB).includes('TextProp') };

  // AddProp by property type name
  A.run('CreatePrim', { PresetObj: 'Cone', GeometryType: 'MeshSurface', Name: 'coneC' });
  const coneC = A.scene.find('coneC');
  out.addProp = {};
  for (const label of ['CustomColor', 'TextProp']) {
    const p = A.run('AddProp', { PresetObj: label, InputObjs: 'coneC' });
    out.addProp[label] = { prop: describe(p), on: propsOf(coneC).includes(label) };
  }
  return out;
}, SPEC.anchor);

const diffs = [];
const eq = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${what}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const sameParams = (what, got, want) => { eq(`${what} param count`, got?.length, want.length); want.forEach((w, i) => { for (const k of Object.keys(w)) eq(`${what} ${w.name}.${k}`, got?.[i]?.[k], w[k]); }); };

eq('anchor items', r.items, SPEC.menuLabels.map(label => ({ anchor: SPEC.anchor, label })));
for (const label of SPEC.menuLabels) {
  const S = SPEC[label];
  // nothing selected
  eq(`${label} no selection: result`, r.none[label].result, null);
  eq(`${label} no selection: message box`, r.none[label].box, [SPEC.msg1174]);
  eq(`${label} no selection: properties added`, r.none[label].added, 0);
  eq(`${label} no selection: undo entries`, r.none[label].undoGrew, 0);
  // menu item with a selection
  const m = r.menu[label];
  eq(`${label} menu: type`, m.prop?.type, label);
  eq(`${label} menu: kind`, m.prop?.kind, 'property');
  sameParams(`${label} menu`, m.prop?.params, S.params);
  eq(`${label} menu: layout`, m.prop?.layout, S.layout);
  eq(`${label} menu: help topic`, m.prop?.help, S.help);
  eq(`${label} menu: on first selected`, m.onFirst, true);
  eq(`${label} menu: on second selected`, m.onSecond, false);
  eq(`${label} menu: parent`, m.parent, 'boxA');
  eq(`${label} menu: message box count`, m.box, 0);
  eq(`${label} menu: inspected (control drawn)`, m.inspected, true);
  // AddProp
  eq(`${label} AddProp: type`, r.addProp[label].prop?.type, label);
  sameParams(`${label} AddProp`, r.addProp[label].prop?.params, S.params);
  eq(`${label} AddProp: on target`, r.addProp[label].on, true);
}
eq('CustomColor control label', r.menu.CustomColor.rowLabel, 'Color');
eq('CustomColor control has swatch', r.menu.CustomColor.hasSwatch, true);
eq('CustomColor control has alpha', r.menu.CustomColor.hasAlpha, true);
eq('CustomColor is one control (no separate G/B/A rows)', r.menu.CustomColor.channelRows, 0);
eq('TextProp control height px', r.menu.TextProp.textareaHeight, 275);
eq('TextProp control label', r.menu.TextProp.rowLabel, null);
eq('TextProp default Text', r.menu.TextProp.prop?.params?.[0]?.value, '');
eq('CustomColor range clamp 0..1', r.clamp, [1, 0, 0.25, 0.5]);
eq('TextProp keeps line breaks', r.text, 'line one\nline two');
eq('message boxes close on OK', r.boxesClosed, true);
eq('menu item is undoable', r.undo, { had: true, after: false });
eq('page errors', pageErrors, []);

console.log(diffs.length ? 'DIFF' : 'OK', 'PROP-SIMPLE CustomColor / TextProp (spec tables; no XSIBATCH golden yet)');
console.log(JSON.stringify(r, null, 1));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/simple-properties-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, r }, null, 2));
await b.close();
process.exit(diffs.length ? 1 : 0);
