// CMD-01d: the 20 script-implemented character key set, FX paint shape key and physical sky commands.
// Checked against the "Wire contract" of docs/ghidra/cmd-01d-keysets-paintkeys-sky.md and the registry dump
// data/commands_full.json. No XSIBATCH golden was run for this row, so this is a contract check.
// The native FX paint lookups / save (Q1, Q2) are fed through the app.fxPaint hooks by this script; without
// hooks the commands must log "not yet attested" and change nothing.
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_character_keyset_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = ['GetCurrentCharacterKeySet', 'GetAllCharacterKeySets', 'CreateSubCharacterKeySet', 'AddProxyParamToCharacterKeySet',
  'SaveKeyOnCharacterKeySet', 'SaveZeroKeyOnCharacterKeySet', 'RemoveKeyOnCharacterKeySet', 'InspectCurrentCharacterKeySet',
  'OpenAnimationEditorOnCurrentCharacterKeySet', 'DeleteCurrentCharacterKeySet', 'SelectObjectsFromCharacterKeySet',
  'FirstPaintShapeKey', 'PrevPaintShapeKey', 'ClosestPaintShapeKey', 'NextPaintShapeKey', 'LastPaintShapeKey', 'DeletePaintShapeKey',
  'SavePaintShapeKey', 'PaintShapeManipTool', 'AddPhysicalSky'];

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.commands ?? Object.values(raw));
// SavePaintShapeKey has two registry entries; this row is the script entry (the one with a file).
const registry = Object.fromEntries(NAMES.map(n => { const all = list.filter(x => x.scripting_name === n); const c = all.find(x => x.file) ?? all[0]; return [n, c ? c.args.map(a => [a.name, a.default ?? null]) : null]; }));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
// H3 name prompt: the script answers the browser prompt.
let dialogAnswer = null; const dialogs = [];
page.on('dialog', async d => { dialogs.push([d.type(), d.message(), d.defaultValue()]); if (dialogAnswer === null) await d.dismiss(); else await d.accept(dialogAnswer); });
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('GetCurrentCharacterKeySet'), null, { timeout: 60000 });
await page.waitForTimeout(500);

// helpers shared by every evaluate block
await page.evaluate(() => {
  const app = window.Application;
  window.__t = {
    run: (n, a = {}) => { try { const v = app.run(n, a); return { v: v === undefined ? '<none>' : v === null ? null : Array.isArray(v) ? v.map(x => x?.name ?? x) : (v?.name ?? v) }; } catch (e) { return { err: String(e?.message ?? e) }; } },
    logFrom: (i) => app.log.slice(i).map(l => `${l.kind}:${l.text}`),
    cur: () => app.scene.val('CurrentCharacterKeySet'),
    proxies: (ks) => ks.params.filter(p => p.proxied).map(p => app.characterKeySets.siName(p.proxied)),
    keys: (name) => { const p = app.scene.find(name.split('.')[0]).kinematics.local.get(name.split('.').pop()); return (app.anim.fcurve(p)?.keys ?? []).map(k => [k.time, k.value]); },
  };
});

const a = await page.evaluate(({ NAMES }) => {
  const app = window.Application; const T = window.__t; const K = app.characterKeySets; const out = {};
  out.reg = Object.fromEntries(NAMES.map(n => { const d = app.commands.get(n); return [n, d ? d.args.map(x => [x.name, x.default ?? null]) : null]; }));
  out.noLog = NAMES.filter(n => app.commands.get(n)?.noLog);

  app.run('NewScene'); app.autoInspect = false;
  // ---- nothing current
  out.none = { cur: T.run('GetCurrentCharacterKeySet'), all: T.run('GetAllCharacterKeySets') };
  let m = app.log.length;
  out.noneSave = [T.run('SaveKeyOnCharacterKeySet'), T.run('SaveZeroKeyOnCharacterKeySet'), T.logFrom(m).filter(l => !l.startsWith('cmd:'))];
  m = app.log.length;
  out.noneQuiet = [T.run('RemoveKeyOnCharacterKeySet'), T.run('InspectCurrentCharacterKeySet'), T.run('OpenAnimationEditorOnCurrentCharacterKeySet'), T.run('DeleteCurrentCharacterKeySet'), T.logFrom(m).filter(l => !l.startsWith('cmd:'))];
  const cubeA = app.run('CreatePrim', { PresetObj: 'Cube', Name: 'cubeA' });
  const cubeB = app.run('CreatePrim', { PresetObj: 'Cube', Name: 'cubeB' });
  const cubeC = app.run('CreatePrim', { PresetObj: 'Cube', Name: 'cubeC' });
  const M = app.run('CreateModel', { InputObj: [cubeC], Name: 'M' });
  app.select([cubeA]);
  out.noneSelect = [T.run('SelectObjectsFromCharacterKeySet'), app.selection.length];
  m = app.log.length;
  out.noneCreate = [T.run('CreateSubCharacterKeySet', { Name: 'X' }), T.run('AddProxyParamToCharacterKeySet'), T.logFrom(m).filter(l => l.startsWith('info:'))];

  // ---- a top-level key set, H1
  const ks = K.create(app.scene.root, 'CharKeySet');
  out.created = [ks.name, ks.type, ks.val('IsCharacterKeySet'), T.cur(), T.run('GetCurrentCharacterKeySet')];
  app.scene.set('CurrentCharacterKeySet', 'cubeA'); const notCustom = T.run('GetCurrentCharacterKeySet');
  app.scene.set('CurrentCharacterKeySet', 'Scene_Root.nope'); const missing = T.run('GetCurrentCharacterKeySet');
  app.scene.set('CurrentCharacterKeySet', '  Scene_Root.CharKeySet  '); const trimmed = T.run('GetCurrentCharacterKeySet');
  out.h1 = [notCustom, missing, trimmed];
  app.scene.set('CurrentCharacterKeySet', 'Scene_Root.CharKeySet');

  // ---- A3: nothing marked, H5 model filter
  const keyable = (o) => [o.kinematics.local, o.kinematics.global, ...o.properties, o.primitive].filter(Boolean).flatMap(s => s.params.filter(p => p.keyable).map(p => K.siName(p)));
  app.select([cubeA, cubeC]); app.anim.marked.clear();
  const r1 = T.run('CreateSubCharacterKeySet', { Name: 'Sub1' });
  const sub1 = ks.nested[0];
  out.sub1 = { ret: r1, nested: ks.nested.map(p => p.name), flag: sub1?.val('IsCharacterKeySet'), parentIsKs: sub1?.parent === ks, cur: T.cur(),
    proxiesMatch: JSON.stringify(T.proxies(sub1)) === JSON.stringify(keyable(cubeA)), hasPosx: T.proxies(sub1).includes('cubeA.kine.local.posx'), n: T.proxies(sub1).length > 0,
    parentUntouched: T.proxies(ks).length };
  // ---- A3: marked parameters, explicit parent by name, made keyable
  const pp = cubeB.kinematics.local.get('pposx'); const px = cubeB.kinematics.local.get('posx');
  app.anim.marked.clear(); app.anim.marked.add(px); app.anim.marked.add(pp);
  m = app.log.length;
  const r2 = T.run('CreateSubCharacterKeySet', { CharacterKeySet: 'Scene_Root.CharKeySet', InputObjs: [cubeB], Name: 'Sub2' });
  const sub2 = ks.nested[1];
  out.sub2 = { ret: r2, proxies: T.proxies(sub2), log: T.logFrom(m).filter(l => l.startsWith('info:')), keyable: pp.keyable, cur: T.cur() };
  app.anim.marked.clear();
  // ---- A3: wrong type
  m = app.log.length;
  out.badType = [T.run('CreateSubCharacterKeySet', { CharacterKeySet: 'cubeA', Name: 'Y' }), T.run('AddProxyParamToCharacterKeySet', { CharacterKeySet: 'M', InputObjs: 'cubeA.kine.local.posx' }), T.logFrom(m).filter(l => l.startsWith('info:')), ks.nested.length];
  return out;
}, { NAMES });

// ---- A3 / H3: name prompt
dialogAnswer = null;
const promptCancel = await page.evaluate(() => { const app = window.Application; const ks = app.characterKeySets.lookup('Scene_Root.CharKeySet'); const before = window.__t.cur(); const r = window.__t.run('CreateSubCharacterKeySet', { CharacterKeySet: ks, InputObjs: [] }); return [r, ks.nested.length, window.__t.cur() === before]; });
dialogAnswer = 'Prompted';
const promptOk = await page.evaluate(() => { const app = window.Application; const ks = app.characterKeySets.lookup('Scene_Root.CharKeySet'); const r = window.__t.run('CreateSubCharacterKeySet', { CharacterKeySet: ks, InputObjs: [] }); return [r, ks.nested.map(p => p.name), window.__t.cur()]; });
dialogAnswer = null;

const b = await page.evaluate(() => {
  const app = window.Application; const T = window.__t; const K = app.characterKeySets; const out = {};
  const ks = K.lookup('Scene_Root.CharKeySet'); const [sub1, sub2] = ks.nested;
  const cubeA = app.scene.find('cubeA'), cubeB = app.scene.find('cubeB'), M = app.scene.find('M');
  // ---- A2 order
  const mks = K.create(M, 'CharKeySet', false);
  app.run('CreateSubCharacterKeySet', { CharacterKeySet: mks, InputObjs: [], Name: 'MSub' });
  const plain = K.create(app.scene.root, 'NotAKeySet', false); plain.set('IsCharacterKeySet', false);
  K.create(cubeA, 'OnObject', false);
  out.all = T.run('GetAllCharacterKeySets');
  out.mcur = T.cur();
  // ---- A4
  K.setCurrent(ks);
  T.run('AddProxyParamToCharacterKeySet', { CharacterKeySet: 'Scene_Root.CharKeySet', InputObjs: 'cubeA.kine.local.posx,cubeA.kine.local.posy' });
  const afterExplicit = T.proxies(ks);
  app.select([cubeB]); app.anim.marked.clear(); app.anim.marked.add(cubeB.kinematics.local.get('posx')); app.anim.marked.add(cubeA.kinematics.local.get('posz'));
  const r = T.run('AddProxyParamToCharacterKeySet');
  out.a4 = { afterExplicit, afterMarked: T.proxies(ks), ret: r, cur: T.cur() };
  app.anim.marked.clear();
  // proxy = alias of its master
  const proxy = ks.params.find(p => p.proxied === cubeA.kinematics.local.get('posx'));
  proxy.value = 2; const viaProxy = cubeA.kinematics.local.val('posx'); cubeA.kinematics.local.set('posy', 0);
  out.alias = [viaProxy, proxy.value, proxy.keyable];
  // ---- A5 / A6 / A7
  app.keyModifiedOnly = false;
  app.anim.frame = 5; T.run('SaveKeyOnCharacterKeySet');
  const k5 = [T.keys('cubeA.posx'), T.keys('cubeA.posy'), T.keys('cubeB.posx'), T.keys('cubeA.posz')];
  app.anim.frame = 9; T.run('SaveZeroKeyOnCharacterKeySet');
  const k9 = [T.keys('cubeA.posx'), T.keys('cubeB.posx')];
  T.run('RemoveKeyOnCharacterKeySet');
  const k9r = [T.keys('cubeA.posx'), T.keys('cubeB.posx')];
  app.keyModifiedOnly = true; app.anim.frame = 12; cubeA.kinematics.local.set('posy', 7);
  T.run('SaveKeyOnCharacterKeySet');
  const k12 = [T.keys('cubeA.posx'), T.keys('cubeA.posy')];
  app.keyModifiedOnly = false;
  out.keys = { k5, k9, k9r, k12 };
  // ---- A8 / A9
  let inspected = null; const off = app.events.on('inspect', n => { inspected = n?.name ?? null; });
  const sel0 = app.selection.map(n => n.name);
  const i = T.run('InspectCurrentCharacterKeySet'); off();
  out.inspect = [i, inspected, JSON.stringify(app.selection.map(n => n.name)) === JSON.stringify(sel0)];
  let m = app.log.length;
  out.animEd = [T.run('OpenAnimationEditorOnCurrentCharacterKeySet'), T.logFrom(m).filter(l => l.startsWith('info:'))];
  // ---- A11
  app.select([M]); m = app.log.length;
  const s = T.run('SelectObjectsFromCharacterKeySet');
  const lines = T.logFrom(m).filter(l => l.startsWith('info:')).map(l => l.slice(5));
  out.selObjs = { ret: s, sel: app.selection.map(n => n.name).sort(), lineCount: lines.length,
    expectedLines: [ks, ...ks.nested].reduce((n, p) => n + p.params.reduce((k, q) => k + (q.proxied ? 2 : 1), 0), 0),
    hasFlagLine: lines.includes('Scene_Root.CharKeySet.IsCharacterKeySet'), hasMaster: lines.includes('cubeA.kine.local.posx') };
  out.selEmpty = [T.run('SelectObjectsFromCharacterKeySet', { CharacterKeySet: 'Scene_Root.CharKeySet.Prompted' }), app.selection.length];
  out.selByObject = [T.run('SelectObjectsFromCharacterKeySet', { CharacterKeySet: sub2 }), app.selection.map(n => n.name)];
  // ---- A10
  K.setCurrent(sub1);
  const d1 = T.run('DeleteCurrentCharacterKeySet');
  const afterDel = [ks.nested.map(p => p.name), T.cur(), T.run('GetCurrentCharacterKeySet')];
  app.undo();
  const afterUndo = [ks.nested.map(p => p.name), T.cur()];
  K.setCurrent(ks);
  const d2 = T.run('DeleteCurrentCharacterKeySet');
  out.del = { d1, afterDel, afterUndo, d2, all: T.run('GetAllCharacterKeySets'), cur: T.cur(), rootHas: app.scene.root.properties.some(p => p === ks) };
  return out;
});

const c = await page.evaluate(() => {
  const app = window.Application; const T = window.__t; const F = app.fxPaint; const out = {};
  const NAV = ['FirstPaintShapeKey', 'PrevPaintShapeKey', 'ClosestPaintShapeKey', 'NextPaintShapeKey', 'LastPaintShapeKey'];
  app.select([app.scene.find('cubeA')]); app.anim.frame = 4;
  // ---- no native side: not yet attested, nothing changes
  let m = app.log.length;
  const res = [...NAV, 'DeletePaintShapeKey', 'SavePaintShapeKey'].map(n => T.run(n));
  const info = T.logFrom(m).filter(l => l.startsWith('info:'));
  out.bare = { res, frame: app.anim.frame, notYet: info.filter(l => /not yet attested/.test(l)).length, q: info.map(l => /Q[12]\)$/.test(l)) };
  // ---- with hooks (the lookups here are this script's stand-in for the native commands)
  const keys = [3, 10, 20].map(t => ({ name: `k${t}`, time: t })); const calls = [];
  F.lookup = (which, shape, time) => {
    calls.push([which, Array.isArray(shape) ? shape.map(x => x?.name ?? x) : shape, time ?? null]);
    if (!keys.length) return null;
    if (which === 'First') return keys[0];
    if (which === 'Last') return keys[keys.length - 1];
    if (which === 'Prev') return [...keys].reverse().find(k => k.time < time) ?? null;
    if (which === 'Next') return keys.find(k => k.time > time) ?? null;
    return [...keys].sort((x, y) => Math.abs(x.time - time) - Math.abs(y.time - time))[0];
  };
  const frames = [];
  T.run('FirstPaintShapeKey'); frames.push(app.anim.frame);
  T.run('LastPaintShapeKey', { Shape: 'shapeX' }); frames.push(app.anim.frame);
  T.run('PrevPaintShapeKey'); frames.push(app.anim.frame);                 // Time defaults to the current frame (20) -> 10
  T.run('NextPaintShapeKey', { Time: 3 }); frames.push(app.anim.frame);    // -> 10
  T.run('ClosestPaintShapeKey', { Time: 17 }); frames.push(app.anim.frame); // -> 20
  T.run('PrevPaintShapeKey', { Time: 1 }); frames.push(app.anim.frame);    // no key -> unchanged
  out.nav = { frames, calls: calls.slice() };
  // ---- delete: only when the timeline sits on the key
  const deleted = []; F.deleteKey = (k) => { deleted.push(k.name); keys.splice(keys.indexOf(k), 1); };
  app.anim.frame = 11; m = app.log.length;
  T.run('DeletePaintShapeKey', { Time: 10 });
  const off = [deleted.slice(), T.logFrom(m).filter(l => l.startsWith('info:'))];
  app.anim.frame = 10; m = app.log.length;
  T.run('DeletePaintShapeKey', { Time: 11 });
  out.del = { off, on: [deleted.slice(), T.logFrom(m).filter(l => l.startsWith('info:')), keys.map(k => k.time)] };
  // ---- save
  const saves = []; F.saveNative = (shape, t) => saves.push([Array.isArray(shape) ? shape.map(x => x?.name ?? x) : shape, t]);
  app.anim.frame = 7; m = app.log.length;
  const sv = [T.run('SavePaintShapeKey', { Shape: 'shapeX', Time: 3 }), T.run('SavePaintShapeKey')];
  out.save = { sv, saves, frame: app.anim.frame, notYet: T.logFrom(m).filter(l => /not yet attested/.test(l)).length };
  F.lookup = null; F.saveNative = null; F.deleteKey = null;
  // ---- manipulator tool
  const mt = T.run('PaintShapeManipTool');
  out.manip = [mt, F.marking, F.PaintTool.val('CurrentTool')];

  // ================= AddPhysicalSky
  const pass = app.scene.passes[0]; const P = pass; const names = (s) => (s ?? []).map(x => x.name);
  app.autoInspect = true;
  let cm = app.log.length;
  out.skyDefault = [T.run('AddPhysicalSky'), names(P.EnvironmentShaderStack), T.logFrom(cm).filter(l => l.startsWith('cmd:'))];
  cm = app.log.length;
  const r = T.run('AddPhysicalSky', { Pass: pass, LightName: 'XSI_Physical_Sun', ConstrainLight: true, UseToneMap: true });
  const log1 = T.logFrom(cm);
  const light = app.scene.find('XSI_Physical_Sun'); const centre = app.scene.find('XSI_Center_Of_World');
  const cx = light?.primitive?.shaderCnx; const sun = cx?.LightShader; const sky = P.EnvironmentShaderStack?.[0]; const exp = P.LensShaderStack?.[0];
  const cns = light?.properties.find(p => p.type === 'dircns'); const vis = centre?.properties.find(p => p.type === 'visibility');
  const comp = (sh, n, i) => sh.get(`${n}.${['red', 'green', 'blue'][i]}`)?.value ?? sh.val(n)?.[i];
  out.sky1 = {
    ret: r, cmdLogged: log1.filter(l => l.startsWith('cmd:')).length, autoInspect: app.autoInspect,
    light: [light?.type, light?.primitive?.name], sunBoth: !!sun && sun === cx?.PhotonShader, sunName: sun?.name, sunProgId: sun?.progId, sunOwner: sun?.parent === light?.primitive,
    centreVis: vis ? ['viewvis', 'rendvis', 'selectability'].map(n => vis.val(n)) : null, parent: light?.parentObj?.name,
    cns: cns ? [cns.targets.map(t => t.name), Number(cns.val('dirx')), cns.val('diry'), cns.val('dirz')] : null,
    pos: light ? ['posx', 'posy', 'posz'].map(n => light.kinematics.local.val(n)) : null,
    env: names(P.EnvironmentShaderStack), lens: names(P.LensShaderStack), progIds: [sky?.progId, exp?.progId], owners: [sky?.parent === pass, exp?.parent === pass],
    links: (sun?.skyLinks ?? []).map(l => [l.driven.split('.').slice(-2).join('.').replace(/^mia_physicalsun\./, ''), l.source.replace('Passes.' + pass.name + '.mia_physicalsky.', '')]),
    sunOp: log1.filter(l => /not yet attested/.test(l) && /SunDirectionOp/.test(l) && /Q4\)$/.test(l)).length,
    values: sky && exp ? [sky.val('multiplier'), [0, 1, 2].map(i => comp(sky, 'rgb_unit_conversion', i)), pass.val('OverrideCameraLensShaders'), exp.val('f_number'), exp.val('cm2_factor'), exp.val('burn_highlights'), exp.val('gamma')] : null,
  };
  if (sky && sun) {   // the sun follows the sky
    sky.set('haze', 5); sky.set('saturation', 0.5); app.anim.frame = app.anim.frame + 1;
    out.sky1.follow = [sun.val('haze'), sun.val('saturation'), [0, 1, 2].map(i => comp(sun, 'rgb_unit_conversion', i))];
  }
  // ---- no constraint, no tone map
  const r2 = T.run('AddPhysicalSky', { Pass: 'Passes.' + pass.name, LightName: 'Sun2', ConstrainLight: false, UseToneMap: false });
  const l2 = app.scene.find('Sun2'); const sky2 = P.EnvironmentShaderStack?.[1];
  out.sky2 = { ret: r2, parent: l2?.parentObj?.name, cns: l2?.properties.filter(p => p.type === 'dircns').length, pos: l2 ? ['posx', 'posy', 'posz'].map(n => l2.kinematics.local.val(n)) : null,
    env: names(P.EnvironmentShaderStack), lens: names(P.LensShaderStack), values: sky2 ? [sky2.val('multiplier'), [0, 1, 2].map(i => comp(sky2, 'rgb_unit_conversion', i))] : null,
    nulls: [...app.scene.allObjects()].filter(o => /^XSI_Center_Of_World/.test(o.name)).length };
  // ---- the light already exists (inferred, Q3): script error after the pass shaders were added
  const r3 = T.run('AddPhysicalSky', { Pass: pass, LightName: 'XSI_Physical_Sun', ConstrainLight: true, UseToneMap: true });
  out.sky3 = { err: /already exists/.test(r3.err ?? ''), env: names(P.EnvironmentShaderStack).length, lens: names(P.LensShaderStack).length, lights: [...app.scene.allObjects()].filter(o => o.type === 'light' && /Sun/.test(o.name)).length };
  return out;
});
await browser.close();

let checks = 0; const diffs = [];
const eq = (label, x, y) => { checks++; const A = JSON.stringify(x), B = JSON.stringify(y); if (A === B) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: got ${A}, expected ${B}`); } };
const ok = (label, cond, detail) => { checks++; if (cond) console.log(`ok    ${label}`); else { console.log(`FAIL  ${label}`); diffs.push(`${label}: ${JSON.stringify(detail)}`); } };
const V = (v) => ({ v }); const NONE = V('<none>');
const REJECT = ['info:Must receive Character Set as first parameter'];

for (const n of NAMES) { ok(`${n}: in the registry dump`, registry[n] !== null, n); eq(`${n}: registered with the registry argument list`, a.reg[n], registry[n]); }
eq('only AddPhysicalSky is registered with logging off', a.noLog, ['AddPhysicalSky']);

// ---- A
eq('A1/A2 with no key set: null object, empty collection', a.none, { cur: V(null), all: V([]) });
eq('A5/A6 with no current key set: error line (word "SaveKey" both times), no failure', a.noneSave, [NONE, NONE, ['error:No current character key set for SaveKey', 'error:No current character key set for SaveKey']]);
eq('A7/A8/A9/A10 with no current key set: silent no-ops', a.noneQuiet, [NONE, NONE, NONE, NONE, []]);
eq('A11 with no key set: DeselectAll', a.noneSelect, [NONE, 0]);
eq('A3/A4 with no key set: two log lines each, no result', a.noneCreate, [NONE, NONE, [...REJECT, 'info:Type was Nothing', ...REJECT, 'info:Type was Nothing']]);
eq('key set = custom property with IsCharacterKeySet; scene parameter holds its full name; A1 returns it', a.created, ['CharKeySet', 'customparamset', true, 'Scene_Root.CharKeySet', V('CharKeySet')]);
eq('H1: not a custom property -> nothing; unknown name -> nothing; text is trimmed', a.h1, [V(null), V(null), V('CharKeySet')]);
eq('A3 nothing marked: sub key set nested under the current key set, keyable parameters of the same-model objects, made current', a.sub1,
  { ret: V(['Sub1']), nested: ['Sub1'], flag: true, parentIsKs: true, cur: 'Scene_Root.CharKeySet.Sub1', proxiesMatch: true, hasPosx: true, n: true, parentUntouched: 0 });
eq('A3 marked: marked parameters only, non-keyable one made keyable and logged', a.sub2,
  { ret: V(['Sub2']), proxies: ['cubeB.kine.local.posx', 'cubeB.kine.local.pposx'], log: ['info:Made cubeB.kine.local.pposx Keyable'], keyable: true, cur: 'Scene_Root.CharKeySet.Sub2' });
eq('A3/A4 with a non-custom-property argument: rejected with the type name', a.badType, [NONE, NONE, [...REJECT, 'info:Type was X3DObject', ...REJECT, 'info:Type was Model'], 2]);
eq('H3 prompt cancelled: silent abort, nothing created, current unchanged', promptCancel, [NONE, 2, true]);
eq('H3 prompt answered: the typed name; new set is current', promptOk, [V(['Prompted']), ['Sub1', 'Sub2', 'Prompted'], 'Scene_Root.CharKeySet.Prompted']);
eq('H3 prompt: text id 1052, default SubCharKeySet', dialogs, [['prompt', 'Name for New Character Key Set', 'SubCharKeySet'], ['prompt', 'Name for New Character Key Set', 'SubCharKeySet']]);
eq('A2 order: root key sets depth first, then per model; non key sets and non-model owners skipped', b.all, V(['CharKeySet', 'Sub1', 'Sub2', 'Prompted', 'CharKeySet', 'MSub']));
eq('A3 on a model key set: current = M.CharKeySet.MSub', b.mcur, 'M.CharKeySet.MSub');
eq('A4: explicit parameters, then the marked parameters of the selection; no result; current unchanged', b.a4,
  { afterExplicit: ['cubeA.kine.local.posx', 'cubeA.kine.local.posy'], afterMarked: ['cubeA.kine.local.posx', 'cubeA.kine.local.posy', 'cubeB.kine.local.posx'], ret: NONE, cur: 'Scene_Root.CharKeySet' });
eq('proxy parameter is a keyable alias of its master', b.alias, [2, 2, true]);
eq('A5: keys at the key time on every keyable parameter of the current key set only', b.keys.k5, [[[5, 2]], [[5, 0]], [[5, 0]], []]);
eq('A6: zero keys at the key time', b.keys.k9, [[[5, 2], [9, 0]], [[5, 0], [9, 0]]]);
eq('A7: keys at the key time removed', b.keys.k9r, [[[5, 2]], [[5, 0]]]);
eq('A5 with savekeymodified: only the modified parameter is keyed', b.keys.k12, [[[5, 2]], [[5, 0], [12, 7]]]);
eq('A8: the current key set is inspected; selection untouched', b.inspect, [NONE, 'CharKeySet', true]);
eq('A9: animation editor opened on the key set', b.animEd, [NONE, ['info:Animation Editor: Scene_Root.CharKeySet']]);
eq('A11: owners of the proxied masters, recursively through sub key sets; every parameter logged (two lines per proxy)', b.selObjs,
  { ret: NONE, sel: ['cubeA', 'cubeB'], lineCount: b.selObjs.expectedLines, expectedLines: b.selObjs.expectedLines, hasFlagLine: true, hasMaster: true });
eq('A11 on a key set without proxies: DeselectAll', b.selEmpty, [NONE, 0]);
eq('A11 with an object argument', b.selByObject, [NONE, ['cubeB']]);
eq('A10: deletes the current (sub) key set and clears the scene parameter; undo restores both', [b.del.d1, b.del.afterDel, b.del.afterUndo],
  [NONE, [['Sub2', 'Prompted'], '', V(null)], [['Sub1', 'Sub2', 'Prompted'], 'Scene_Root.CharKeySet.Sub1']]);
eq('A10 on a top-level key set: nested sets go with it, no fallback', [b.del.d2, b.del.all, b.del.cur, b.del.rootHas], [NONE, V(['CharKeySet', 'MSub']), '', false]);

// ---- B
eq('B without the native side: no throw, timeline unchanged, one "not yet attested" line (Q1/Q2) per command', c.bare,
  { res: Array(7).fill(NONE), frame: 4, notYet: 7, q: Array(7).fill(true) });
eq('B navigation: the timeline jumps to the returned key; no key = no change', c.nav.frames, [3, 20, 10, 10, 20, 20]);
eq('B navigation: lookup, Shape (default selection) and Time (default current frame) passed to the native lookup', c.nav.calls,
  [['First', ['cubeA'], null], ['Last', 'shapeX', null], ['Prev', ['cubeA'], 20], ['Next', ['cubeA'], 3], ['Closest', ['cubeA'], 17], ['Prev', ['cubeA'], 1]]);
eq('B6: closest key not on the current frame: nothing deleted, nothing logged', c.del.off, [[], []]);
eq('B6: closest key on the current frame (Time argument ignored for the test): logged and deleted', c.del.on, [['k10'], ['info:Deleting key: k10'], [3, 20]]);
eq('B7: native save called with Shape and the key time; timeline left on the key time', c.save, { sv: [NONE, NONE], saves: [['shapeX', 7], [['cubeA'], 7]], frame: 7, notYet: 0 });
eq('B8: marking text and select-shape tool id 80', c.manip, [NONE, 'PosX,PosY,SclX,SclY,PivX,PivY,RotZ', 80]);

// ---- C
ok('C with default arguments: script error for the missing pass, nothing added, nothing in the command log', typeof c.skyDefault[0].err === 'string' && c.skyDefault[1].length === 0 && c.skyDefault[2].length === 0, c.skyDefault);
const s1 = c.sky1;
eq('C: returns nothing, not logged, auto-inspect restored', [s1.ret, s1.cmdLogged, s1.autoInspect], [NONE, 0, true]);
eq('C step 2: infinite light with the physical sun on LightShader and PhotonShader', [s1.light, s1.sunBoth, s1.sunName, s1.sunProgId, s1.sunOwner], [['light', 'Infinite'], true, 'mia_physicalsun', 'Softimage.mia_physicalsun.1.0', true]);
// the build creates an infinite light at its own default position; the translation is relative to it
const D = c.sky2.pos ?? [0, 0, 0];
eq('C step 2.3: hidden XSI_Center_Of_World null, light parented and direction-constrained to it, moved by (0, 3, -19)', [s1.centreVis, s1.parent, s1.cns, s1.pos],
  [[false, false, false], 'XSI_Center_Of_World', [['XSI_Center_Of_World'], 0, 0, -1], [D[0], D[1] + 3, D[2] - 19]]);
eq('C steps 3/4: sky on the environment stack, photographic exposure on the lens stack, both owned by the pass', [s1.env, s1.lens, s1.progIds, s1.owners],
  [['mia_physicalsky'], ['mia_exposure_photographic'], ['Softimage.mia_physicalsky.1.0', 'Softimage.mia_exposure_photographic.1.0'], [true, true]]);
const linkNames = s1.links.map(l => l[0]);
ok('C step 5: sun parameters driven by the same-named sky parameters; the misspelt "mulitplier" link is skipped',
  ['haze', 'redblueshift', 'saturation', 'horizon_height'].every(n => s1.links.some(l => l[0] === n && l[1] === n)) && ['red', 'green', 'blue'].every(k => s1.links.some(l => l[0] === `rgb_unit_conversion.${k}` && l[1] === `rgb_unit_conversion.${k}`)) && !linkNames.some(n => /mul/.test(n)), s1.links);
eq('C step 5: the sun follows the sky (haze, saturation, rgb_unit_conversion)', s1.follow, [5, 0.5, [0.318, 0.318, 0.318]]);
eq('C step 6: sun direction operator not yet attested (Q4), logged once', s1.sunOp, 1);
eq('C step 7 with tone map: multiplier 1, rgb 0.318, lens override 3, exposure 16 / 1 / 0.02 / 1', s1.values, [1, [0.318, 0.318, 0.318], 3, 16, 1, 0.02, 1]);
eq('C without constraint / tone map: light under the root, not moved, no lens shader added, multiplier 0.01, rgb 0.001', c.sky2,
  { ret: NONE, parent: 'Scene_Root', cns: 0, pos: D, env: ['mia_physicalsky', 'mia_physicalsky1'], lens: ['mia_exposure_photographic'], values: [0.01, [0.001, 0.001, 0.001]], nulls: 1 });
eq('C with an existing light (inferred, Q3): script error; the pass shaders of steps 3/4 stay; no new light', c.sky3, { err: true, env: 3, lens: 2, lights: 2 });

eq('page errors', pageErrors, []);

if (diffs.length) {
  console.error(`FAIL CMD-01d character key set / paint shape key / physical sky commands: ${diffs.length} of ${checks} checks`);
  for (const x of diffs) console.error('  ' + x);
  process.exit(1);
}
console.log(`OK CMD-01d character key set / paint shape key / physical sky commands: ${checks} checks, ${NAMES.length} commands exercised (contract tables + registry dump; no XSIBATCH golden yet)`);
console.log('   fully wired: GetCurrentCharacterKeySet, GetAllCharacterKeySets, CreateSubCharacterKeySet, AddProxyParamToCharacterKeySet, SaveKeyOnCharacterKeySet, SaveZeroKeyOnCharacterKeySet, RemoveKeyOnCharacterKeySet, InspectCurrentCharacterKeySet, OpenAnimationEditorOnCurrentCharacterKeySet, DeleteCurrentCharacterKeySet, SelectObjectsFromCharacterKeySet');
console.log('   partly wired: First/Prev/Closest/Next/LastPaintShapeKey, DeletePaintShapeKey (native lookups Q2), SavePaintShapeKey (native save Q1), PaintShapeManipTool (tool id 80 meaning Q2), AddPhysicalSky (sun direction operator Q4, existing light Q3)');
