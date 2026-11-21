// INFERRED batch check: Viewing / Edit / Property / Constraint / Transport Control / General commands registered by
// src/commands/viewEditProperty.ts (+ viewEditPropertyMore.ts). There is no analyst note and no golden for these, so
// this is a contract check: (1) every command is registered with the argument names / defaults of one of its entries
// in data/commands_full.json, (2) it runs with default arguments on a small scene (or raises the stated error),
// (3) the scene state / return value / log text the implementation promises, including undo.
// Needs `vite preview` (or SI_URL). Usage: SI_URL='http://localhost:4184/?demo' node tools/compare_view_edit_property_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const COMMANDS = [
  // Viewing (HideUnselected, SIHideObjects, SIUnhideObjects, UnghostAll, MakeAllUnselectable: now CMD-B17a,
  // checked by compare_selection_layers_b17a.mjs; the behaviour checks below still run against the new bodies)
  'HideAndUnselect',
  // IsolateAll / IsolateAdd/Remove/ToggleSelected, CenterSelection, FrameContextual and the Transport Control commands
  // PlayBackwardsFromEnd / PlayFrame / PlayRealTime / PlayRealTimeFromStart: CMD-B19d, checked by compare_selection_b19d.mjs
  // ColorizeObject / ShadeObject: CMD-B17g contract (tools.vbs pick loops), checked by tools/compare_params_rigs_b17gh.mjs
  'SetViewDisplayMode', 'ToggleViewDisplayMode', 'ToggleWireOnShadedDisplay', 'ToggleHeadlightDisplayMode',
  'SetUserKeyword', 'GetUserKeyword', 'RemoveUserKeyword', 'ClearUserKeyword', 'SetUserTab', 'GetUserTab', 'AddUserTab', 'RemoveUserTab', 'ClearUserTab',
  // Edit
  'ToggleSelectability', 'ParentObjects', 'Clone', 'Instance', 'SIInstantiate', 'GetMaster', 'GetInstances', 'SIDuplicate',
  'DuplicateModelFromObj', 'DeleteModelFromObj', 'DeleteAll', 'DeleteObjPermanent', 'ToggleParameterValue',
  'MoveOperatorAfter', 'MoveOperatorBefore', 'SwapOperators', 'DeactivateAbove', 'CreateTransformGroup', 'RemoveTransformGroup',
  // Property
  'SIAddProp', 'SIAddPropEx', 'RemoveProperties', 'RemoveAllProperties', 'SIAssignMaterial', 'SIUnAssignMaterial',
  'MakeLocal', 'SIMakeLocal', 'SelectMaterialsUsedBy', 'SelectObjectsUsingMaterial', 'IncreaseSubdivision', 'DecreaseSubdivision',
  'AutoInspectEnabled', 'ToggleBooleanUserPref', 'InspectLastOperator',
  // Constraint
  'RemoveAllCns', 'RemoveCnsType', 'GetConstrainedObjects', 'SelectConstrainedObjects', 'SIApplyCns', 'SIApplyConstraint',
  // General
  'BeginUndo', 'EndUndo',
];

const all = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/commands_full.json'), 'utf8'));
const registry = {};
for (const c of all) if (COMMANDS.includes(c.scripting_name)) (registry[c.scripting_name] ??= []).push({ label: c.name, category: c.category, args: c.args.map(a => ({ name: a.name, default: a.default ?? null })) });

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1200);

const got = await page.evaluate(async ({ COMMANDS }) => {
  const A = window.Application; const VM = window.__vm;
  const R = []; const used = new Set();
  const show = d => { try { return JSON.stringify(d, (k, v) => v && typeof v === 'object' && 'params' in v && 'name' in v ? `<${v.name}>` : v); } catch { return String(d); } };
  const ck = (cmd, what, ok, detail) => { used.add(cmd); R.push({ cmd, what, ok: !!ok, detail: ok || detail === undefined ? undefined : show(detail) }); };
  const run = (n, args) => { used.add(n); try { return { v: A.run(n, args ?? {}) }; } catch (e) { return { err: String(e?.message ?? e), nya: e?.notYetAttested === true }; } };
  const ok = r => !('err' in r);
  const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const names = l => (l ?? []).map(o => o?.name);
  const vis = o => o.property('visibility').val('viewvis');
  const allObjs = () => [...A.scene.allObjects()];
  const logSince = i => A.log.slice(i).map(l => l.text).join('\n');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const near = (x, y) => Math.abs(x - y) < 1e-6;
  const posx = o => o.kinematics.local.val('posx');
  const S = () => {
    A.run('NewScene'); A.autoInspect = false;
    const cube = A.run('CreatePrim', { PresetObj: 'Cube', Name: 'vcube' }), sph = A.run('CreatePrim', { PresetObj: 'Sphere', Name: 'vsphere' }), nul = A.run('GetPrim', { PresetObj: 'Null', Name: 'vnull' });
    A.select([]); return { cube, sph, nul };
  };

  // 1. registration
  const registration = COMMANDS.map(n => { const d = A.commands.get(n); return { name: n, found: !!d, label: d?.label, category: d?.category, args: d?.args.map(a => ({ name: a.name, default: a.default ?? null })) }; });
  const info = A.viewEditPropertyCommands;

  // ------------------------------------------------------------------------------------------------ Viewing
  {
    let { cube, sph, nul } = S();
    A.select([cube]); let r = run('HideUnselected');
    ck('HideUnselected', 'default args: only the selected object stays view-visible', ok(r) && vis(cube) && allObjs().every(o => o === cube || !vis(o)), r);
    A.undo(); ck('HideUnselected', 'undo restores every object', allObjs().every(vis));
    A.select([]); r = run('HideUnselected', { Target: [sph] });
    // CMD-B17a contract: Target is only examined for polygons; the (empty) current selection is inverted -> all hidden
    ck('HideUnselected', 'explicit Target (CMD-B17a: only examined for polygons)', ok(r) && !vis(sph) && !vis(cube) && !vis(nul), r); A.undo();

    A.select([cube, sph]); r = run('HideAndUnselect');
    ck('HideAndUnselect', 'default args: selection hidden and cleared', ok(r) && !vis(cube) && !vis(sph) && vis(nul) && A.selection.length === 0, r);
    A.undo(); ck('HideAndUnselect', 'undo restores visibility and selection', vis(cube) && vis(sph) && eq(names(A.selection), ['vcube', 'vsphere']));

    A.select([cube]); r = run('SIHideObjects');
    ck('SIHideObjects', 'default args: hides the selection, keeps it selected', ok(r) && !vis(cube) && vis(sph) && eq(names(A.selection), ['vcube']), r);
    r = run('SIHideObjects', { Target: 'vsphere' }); ck('SIHideObjects', 'Target by name', ok(r) && !vis(sph), r);
    r = run('SIUnhideObjects'); ck('SIUnhideObjects', 'default args: unhides the selection only', ok(r) && vis(cube) && !vis(sph) && eq(names(A.selection), ['vcube']), r);
    r = run('SIUnhideObjects', { Target: [sph] }); ck('SIUnhideObjects', 'explicit Target', ok(r) && vis(sph), r);
    A.undo(); ck('SIUnhideObjects', 'undo hides again', !vis(sph)); A.undo(); A.undo(); A.undo();
    ck('SIHideObjects', 'undo shows again', vis(cube) && vis(sph));

    cube.property('visibility').set('ghosting', true); sph.property('visibility').set('ghosting', true);
    r = run('UnghostAll'); ck('UnghostAll', 'default args: no object is ghosted', ok(r) && allObjs().every(o => o.property('visibility').val('ghosting') === false), r);
    A.undo(); ck('UnghostAll', 'undo restores ghosting', cube.property('visibility').val('ghosting') === true && sph.property('visibility').val('ghosting') === true);
  }
  // Isolate*: CMD-B19d (compare_selection_b19d.mjs)
  // ColorizeObject / ShadeObject moved to the CMD-B17g contract (pick loops); see tools/compare_params_rigs_b17gh.mjs
  {
    S(); const flag = k => !!VM.flags()[k];
    let r = run('SetViewDisplayMode'); ck('SetViewDisplayMode', 'default args: shaded', ok(r) && VM.displayOf() === 'shaded', [r, VM.displayOf()]);
    const table = { wireframe: 'wireframe', bbox: 'bounding box', hiddenline: 'hidden line', constant: 'constant', textured: 'textured', texturedecal: 'texture decal' };
    for (const [k, want] of Object.entries(table)) { r = run('SetViewDisplayMode', { DisplayMode: k }); ck('SetViewDisplayMode', `${k} → ${want}`, ok(r) && VM.displayOf() === want && !flag('Depth Cue'), [r, VM.displayOf()]); }
    r = run('SetViewDisplayMode', { DisplayMode: 'depthcue' }); ck('SetViewDisplayMode', 'depthcue = wireframe with the Depth Cue flag', ok(r) && VM.displayOf() === 'wireframe' && flag('Depth Cue'), [r, VM.displayOf()]);
    r = run('SetViewDisplayMode', { DisplayMode: 'shaded' }); ck('SetViewDisplayMode', 'another mode clears Depth Cue', ok(r) && VM.displayOf() === 'shaded' && !flag('Depth Cue'), r);
    r = run('SetViewDisplayMode', { DisplayMode: 'nonsense' }); ck('SetViewDisplayMode', 'unknown mode is an error', /unknown display mode/.test(r.err ?? ''), r);
    r = run('ToggleViewDisplayMode'); ck('ToggleViewDisplayMode', 'default args from shaded → wireframe', ok(r) && VM.displayOf() === 'wireframe', [r, VM.displayOf()]);
    r = run('ToggleViewDisplayMode'); ck('ToggleViewDisplayMode', 'again → shaded', ok(r) && VM.displayOf() === 'shaded', r);
    r = run('ToggleViewDisplayMode', { FirstDisplayMode: 'bbox', SecondDisplayMode: 'constant' }); ck('ToggleViewDisplayMode', 'custom pair → second', ok(r) && VM.displayOf() === 'constant', r);
    r = run('ToggleViewDisplayMode', { FirstDisplayMode: 'bbox', SecondDisplayMode: 'constant' }); ck('ToggleViewDisplayMode', 'custom pair → first', ok(r) && VM.displayOf() === 'bounding box', r);
    run('SetViewDisplayMode');
    let f0 = flag('Wire on Shaded'); r = run('ToggleWireOnShadedDisplay'); ck('ToggleWireOnShadedDisplay', 'default args: flips the view flag', ok(r) && flag('Wire on Shaded') === !f0, r);
    r = run('ToggleWireOnShadedDisplay'); ck('ToggleWireOnShadedDisplay', 'flips back', ok(r) && flag('Wire on Shaded') === f0, r);
    f0 = flag('Headlight'); r = run('ToggleHeadlightDisplayMode'); ck('ToggleHeadlightDisplayMode', 'default args: flips the headlight flag', ok(r) && flag('Headlight') === !f0, r);
    r = run('ToggleHeadlightDisplayMode'); ck('ToggleHeadlightDisplayMode', 'flips back', ok(r) && flag('Headlight') === f0, r);
    const u = A.undoStack.length; run('SetViewDisplayMode'); run('ToggleWireOnShadedDisplay'); run('ToggleWireOnShadedDisplay'); ck('SetViewDisplayMode', 'view state commands add no undo entries', A.undoStack.length === u);
  }
  // CenterSelection / FrameContextual: CMD-B19d (compare_selection_b19d.mjs)
  for (const [W, field] of [['Keyword', 'userKeywords'], ['Tab', 'userTabs']]) {
    const { cube, sph } = S(); A.select([cube]);
    // CMD-B7a (docs/ghidra/cmd-b7a-uitasks-group-view-binary.md) replaced the inferred registrations: the attribute is the
    // comma separated string, Get returns a collection, and Set without Keywords fails in batch (it opens a dialog in a session).
    const kw = o => String(o[field] ?? '').split(',').filter(Boolean);
    A.Interactive = false; let r = run(`SetUser${W}`); A.Interactive = true; ck(`SetUser${W}`, 'default args, no UI: invalid argument, nothing set', /status 0x80070057/.test(r.err ?? '') && eq(kw(cube), []), r);
    r = run(`SetUser${W}`, { Keywords: 'alpha, beta' }); ck(`SetUser${W}`, 'sets the list on the selection', ok(r) && eq(kw(cube), ['alpha', 'beta']), kw(cube));
    r = run(`GetUser${W}`); ck(`GetUser${W}`, 'default args: collection of the tokens', String(r.v) === 'alpha,beta', r);
    r = run(`SetUser${W}`, { InputObjs: 'vsphere', Keywords: 'gamma' }); ck(`SetUser${W}`, 'InputObjs by name', ok(r) && eq(kw(sph), ['gamma']) && eq(kw(cube), ['alpha', 'beta']), kw(sph));
    r = run(`GetUser${W}`, { InputObjs: [cube, sph] }); ck(`GetUser${W}`, 'several inputs: union', String(r.v) === 'alpha,beta,gamma', r);
    r = run(`SetUser${W}`, { Keywords: 'delta' }); ck(`SetUser${W}`, 'Set replaces', ok(r) && eq(kw(cube), ['delta']), kw(cube));
    A.undo(); ck(`SetUser${W}`, 'undo restores the previous list', eq(kw(cube), ['alpha', 'beta']), kw(cube));
    if (W === 'Tab') { r = run('AddUserTab'); ck('AddUserTab', 'default args: nothing added', ok(r) && eq(kw(cube), ['alpha', 'beta']), r); r = run('AddUserTab', { Keywords: 'beta,zeta' }); ck('AddUserTab', 'appends new entries only', ok(r) && eq(kw(cube), ['alpha', 'beta', 'zeta']), kw(cube)); A.undo(); ck('AddUserTab', 'undo', eq(kw(cube), ['alpha', 'beta'])); }
    r = run(`RemoveUser${W}`); ck(`RemoveUser${W}`, 'default args: nothing removed', ok(r) && eq(kw(cube), ['alpha', 'beta']), r);
    r = run(`RemoveUser${W}`, { Keywords: 'alpha' }); ck(`RemoveUser${W}`, 'removes the named entry', ok(r) && eq(kw(cube), ['beta']), kw(cube));
    A.undo(); ck(`RemoveUser${W}`, 'undo', eq(kw(cube), ['alpha', 'beta']));
    r = run(`ClearUser${W}`); ck(`ClearUser${W}`, 'default args: clears the selection\'s list', ok(r) && eq(kw(cube), []) && String(run(`GetUser${W}`).v) === '', r);
    A.undo(); ck(`ClearUser${W}`, 'undo', eq(kw(cube), ['alpha', 'beta']));
  }

  // --------------------------------------------------------------------------------------------------- Edit
  {
    const { cube, sph, nul } = S(); const sel = o => o.property('visibility').val('selectability');
    A.select([cube]); let r = run('ToggleSelectability'); ck('ToggleSelectability', 'default args: selection becomes unselectable', ok(r) && sel(cube) === false && sel(sph) === true, r);
    r = run('ToggleSelectability', { InputObjects: [cube] }); ck('ToggleSelectability', 'toggles back', ok(r) && sel(cube) === true, r);
    A.undo(); ck('ToggleSelectability', 'undo', sel(cube) === false);
    sph.property('visibility').set('selectability', false);
    r = run('MakeAllUnselectable'); ck('MakeAllUnselectable', 'default args: every object is selectable (registry description)', ok(r) && allObjs().every(sel), r);
    A.undo(); ck('MakeAllUnselectable', 'undo', sel(cube) === false && sel(sph) === false);

    A.select([cube]); r = run('ParentObjects'); ck('ParentObjects', 'one object is an error', /at least two objects/.test(r.err ?? ''), r);
    A.select([cube, sph, nul]); r = run('ParentObjects'); ck('ParentObjects', 'default args: selection parented under its last object', ok(r) && cube.parentObj === nul && sph.parentObj === nul && eq(names(nul.children), ['vcube', 'vsphere']), r);
    r = run('ParentObjects', { Objects: [nul, cube] }); ck('ParentObjects', 'parenting under a descendant is an error', /descendant/.test(r.err ?? '') && nul.parentObj === A.scene.root, r);
    const order = names(A.scene.root.children); A.undo(); ck('ParentObjects', 'undo restores the parents', cube.parentObj === A.scene.root && sph.parentObj === A.scene.root && order.length + 2 === A.scene.root.children.length);
  }
  {
    const { cube, sph, nul } = S(); const pos = o => Array.from(o.primitive.mesh().positions);
    let r = run('Clone'); ck('Clone', 'default args, nothing selected: error', /select the object/.test(r.err ?? ''), r);
    A.select([sph]); const n0 = allObjs().length; r = run('Clone'); const c = r.v?.[0];
    ck('Clone', 'default args: one new object, selected', ok(r) && r.v.length === 1 && allObjs().length === n0 + 1 && eq(names(A.selection), [c?.name]) && c.type === sph.type && c.parentObj === A.scene.root, r);
    ck('Clone', 'clone generator reads the master (copy operator)', c?.primitive.operators[0].siType === 'copyop' && c.primitive.operators[0].master === sph && c.cloneMaster === sph);
    ck('Clone', 'clone geometry equals the master', eq(pos(c), pos(sph)));
    const rad = sph.primitive.operators[0].params.find(p => typeof p.value === 'number' && /radius/i.test(p.name));
    A.setParam(rad, Number(rad.value) * 2); ck('Clone', 'editing the master generator changes the clone', eq(pos(c), pos(sph)) && Math.max(...pos(c).map(Math.abs)) > 0, rad?.name);
    A.select([c]); A.run('ApplyOp', { PresetObj: 'Twist' }); ck('Clone', 'operators on the clone do not touch the master', c.primitive.operators.length === 2 && sph.primitive.operators.length === 1);
    A.undo(); A.undo(); A.undo(); ck('Clone', 'undo removes the clone', allObjs().length === n0 && !allObjs().includes(c));
    r = run('Clone', { InputObjs: [cube], NbItems: 3, Tx: '2', Selection: 'siNoSelection' }); ck('Clone', 'NbItems / Tx: each copy is offset once more; siNoSelection leaves the selection', ok(r) && r.v.length === 3 && eq(r.v.map(posx), [2, 4, 6]) && !A.selection.includes(r.v[0]), r.v?.map?.(posx));
    A.undo();
    A.run('Translate', { InputObj: [nul], X: 5, Y: 0, Z: 0 }); A.run('ParentObj', { Parent: 'vnull', Children: [cube] });
    r = run('Clone', { InputObjs: [cube] }); ck('Clone', 'default Hierarchy siNoParent + Xfrom siGlobalXForm: under the scene root at the same global pose', ok(r) && r.v[0].parentObj === A.scene.root && near(posx(r.v[0]), 5), r.v && posx(r.v[0]));
    r = run('Clone', { InputObjs: [cube], Hierarchy: 'siSharedParent' }); ck('Clone', 'siSharedParent: beside the master', ok(r) && r.v[0].parentObj === nul && near(posx(r.v[0]), 0), r);
    r = run('Clone', { InputObjs: [nul] }); ck('Clone', 'object without geometry: plain copy', ok(r) && r.v[0].type === 'null' && !r.v[0].cloneMaster, r);

    // instances
    A.select([cube]); r = run('SIInstantiate'); ck('SIInstantiate', 'default args on a non-model: error', /is not a model/.test(r.err ?? ''), r);
    const model = A.run('CreateModel', { InputObj: [sph], Name: 'vmodel' }); A.run('ParentObj', { Parent: 'vsphere', Children: [nul] }); A.select([cube]);
    const n1 = allObjs().length; r = run('SIInstantiate', { InputObjs: [model] }); const inst = r.v?.[0];
    ck('SIInstantiate', 'creates an instance model pointing at its master; selection untouched', ok(r) && r.v.length === 1 && inst.kind === 'model' && inst.instanceMaster === model && inst.name === 'vmodel_Instance' && inst.parentObj === model.parentObj && eq(names(A.selection), ['vcube']), [r, inst?.name]);
    const ic = inst?.children[0];
    ck('SIInstantiate', 'instance content follows the master hierarchy and geometry', inst?.children.length === 1 && ic.children.length === 1 && ic.primitive.operators[0].master === sph && eq(pos(ic), pos(sph)), names(inst?.children));
    r = run('SIInstantiate', { InputObjs: [model], NbItems: 2, Name: 'copyOfModel' }); ck('SIInstantiate', 'NbItems / Name', ok(r) && r.v.length === 2 && r.v[0].name === 'copyOfModel' && r.v[1].name === 'copyOfModel1', names(r.v));
    A.undo(); ck('SIInstantiate', 'undo removes the instances', !allObjs().some(o => /^copyOfModel/.test(o.name)));
    r = run('SIInstantiate', { InputObjs: [inst] }); ck('SIInstantiate', 'an instance in the input is replaced by its master (CMD-B8e contract)', ok(r) && r.v.length === 1 && r.v[0].instanceMaster === model, r); A.undo();
    r = run('GetMaster', { InputObjs: [inst] }); ck('GetMaster', 'returns the master of an instance (one object, CMD-B8e contract)', ok(r) && r.v === model, r);
    A.select([cube]); r = run('GetMaster'); ck('GetMaster', 'default args on a non-instance: Value left unset', ok(r) && r.v === undefined, r);
    r = run('GetInstances', { InputObjs: [model] }); ck('GetInstances', 'returns the instances of a master', ok(r) && r.v.length === 1 && r.v[0] === inst, names(r.v));
    r = run('GetInstances'); ck('GetInstances', 'default args on a non-master: Value left unset', ok(r) && r.v === undefined, r);
    A.select([model]); r = run('Instance'); ck('Instance', 'default args: instance of the selected model, selected', ok(r) && r.v.length === 1 && r.v[0].instanceMaster === model && eq(names(A.selection), [r.v[0].name]), r);
    A.undo(); ck('Instance', 'undo removes it', run('GetInstances', { InputObjs: [model] }).v.length === 1);
    A.select([cube]); r = run('Instance'); ck('Instance', 'non-model: error', /is not a model/.test(r.err ?? ''), r);
    void n1;
  }
  {
    const { cube, sph, nul } = S();
    A.select([cube]); const n0 = allObjs().length; let r = run('SIDuplicate');
    ck('SIDuplicate', 'default args: one copy, selection untouched', ok(r) && r.v.length === 1 && allObjs().length === n0 + 1 && eq(names(A.selection), ['vcube']) && r.v[0].type === 'polymsh', r);
    r = run('SIDuplicate', { InputObjs: [sph], NbItems: 2 }); ck('SIDuplicate', 'NbItems', ok(r) && r.v.length === 2 && allObjs().length === n0 + 3, r);
    A.undo(); A.undo(); ck('SIDuplicate', 'undo removes the copies', allObjs().length === n0);
    A.select([]); r = run('SIDuplicate'); ck('SIDuplicate', 'nothing given: error', /no object given/.test(r.err ?? ''), r);

    // CMD-B17b contract (Model.vbs): an object whose model is the scene root is itself duplicated / deleted (was an error here)
    A.select([cube]); const nd = allObjs().length; r = run('DuplicateModelFromObj'); ck('DuplicateModelFromObj', 'default args, object directly under the scene root: the object itself is duplicated (CMD-B17b)', ok(r) && r.v && r.v !== cube && r.v.type === cube.type && allObjs().length === nd + 1, r);
    A.undo(); A.select([cube]);
    r = run('DeleteModelFromObj'); ck('DeleteModelFromObj', 'default args, object directly under the scene root: the object itself is deleted (CMD-B17b)', ok(r) && !allObjs().includes(cube), r);
    A.undo(); A.select([cube]);
    const model = A.run('CreateModel', { InputObj: [cube, sph], Name: 'vmodel' }); A.run('ParentObj', { Parent: 'vcube', Children: [nul] });
    const n1 = allObjs().length; A.select([nul]); r = run('DuplicateModelFromObj'); const copy = r.v;
    ck('DuplicateModelFromObj', 'duplicates the owning model with its hierarchy and selects the copy', ok(r) && copy.kind === 'model' && copy !== model && copy.children.length === 2 && [...copy.descendants()].length === 3 && allObjs().length === n1 + 4 && eq(names(A.selection), [copy.name]), [r, copy && names([...copy.descendants()])]);
    A.undo(); ck('DuplicateModelFromObj', 'undo removes the copy', allObjs().length === n1 && !allObjs().includes(copy));
    r = run('DeleteModelFromObj', { InputObj: 'vnull' }); ck('DeleteModelFromObj', 'deletes the owning model and its content', ok(r) && !allObjs().includes(model) && !allObjs().includes(cube) && !allObjs().includes(nul), r);
    A.undo(); ck('DeleteModelFromObj', 'undo restores the model', allObjs().includes(model) && allObjs().includes(nul) && cube.parentObj === model);

    const realConfirm = window.confirm; const asked = []; let answer = false; window.confirm = m => { asked.push(m); return answer; };
    const n2 = A.scene.root.children.length; r = run('DeleteAll'); ck('DeleteAll', 'default args (Confirm=True), declined: nothing deleted', ok(r) && r.v === false && asked.length === 1 && A.scene.root.children.length === n2, [r, asked]);
    answer = true; r = run('DeleteAll'); ck('DeleteAll', 'confirmed: the scene root is empty', ok(r) && r.v === true && asked.length === 2 && A.scene.root.children.length === 0 && allObjs().length === 0, r);
    A.undo(); ck('DeleteAll', 'undo restores every object', A.scene.root.children.length === n2 && allObjs().includes(cube));
    r = run('DeleteAll', { Confirm: false }); ck('DeleteAll', 'Confirm=False: no question asked', ok(r) && asked.length === 2 && allObjs().length === 0, r);
    A.undo(); window.confirm = realConfirm;

    const i0 = A.log.length; A.select([nul]); r = run('DeleteObjPermanent');
    ck('DeleteObjPermanent', 'default args: the selection is deleted; the "permanent" part is logged as not yet attested', ok(r) && !allObjs().includes(nul) && /DeleteObjPermanent: not yet attested/.test(logSince(i0)), r);
    A.undo(); ck('DeleteObjPermanent', 'undo', allObjs().includes(nul));

    const P = (o, n) => o.property('visibility').val(n);
    r = run('ToggleParameterValue'); ck('ToggleParameterValue', 'default args: error, no parameter', /no parameter given/.test(r.err ?? ''), r);
    r = run('ToggleParameterValue', { InputObjects: [cube, sph], Parameters: 'visibility.viewvis,visibility.rendvis' }); ck('ToggleParameterValue', 'toggles the listed booleans on every input', ok(r) && r.v === 4 && !P(cube, 'viewvis') && !P(cube, 'rendvis') && !P(sph, 'viewvis') && !P(sph, 'rendvis'), r);
    r = run('ToggleParameterValue', { Parameters: 'vcube.visibility.viewvis' }); ck('ToggleParameterValue', 'full parameter path', ok(r) && P(cube, 'viewvis') && !P(sph, 'viewvis'), r);
    A.undo(); A.undo(); ck('ToggleParameterValue', 'undo', P(cube, 'viewvis') && P(cube, 'rendvis') && P(sph, 'viewvis'));
    r = run('ToggleParameterValue', { InputObjects: [cube], Parameters: 'kine.local.posx' }); ck('ToggleParameterValue', 'non-boolean parameter: error', /not a boolean/.test(r.err ?? ''), r);
    r = run('ToggleParameterValue', { InputObjects: [cube], Parameters: 'visibility.nope' }); ck('ToggleParameterValue', 'unknown parameter: error', /parameter not found/.test(r.err ?? ''), r);
  }
  {
    const { cube, sph } = S(); A.select([sph]);
    const twist = A.run('ApplyOp', { PresetObj: 'Twist' })[0]; A.select([sph]); const bend = A.run('ApplyOp', { PresetObj: 'Bend' })[0]; A.select([sph]); const taper = A.run('ApplyOp', { PresetObj: 'Taper' })[0]; A.select([]);
    const prim = sph.primitive; const gen = prim.operators[0]; const stack = () => prim.operators.map(o => o === gen ? 'gen' : o === twist ? 'twist' : o === bend ? 'bend' : o === taper ? 'taper' : '?');
    ck('MoveOperatorAfter', 'setup: generator, twist, bend, taper', eq(stack(), ['gen', 'twist', 'bend', 'taper']), stack());
    for (const n of ['MoveOperatorAfter', 'MoveOperatorBefore', 'SwapOperators', 'DeactivateAbove']) { const r = run(n); ck(n, 'default args: error, no operator stack', /no object with an operator stack given/.test(r.err ?? ''), r); }
    prim.geom(); let v0 = prim.version; let r = run('MoveOperatorAfter', { Object: sph, OperatorToMove: twist, OperatorReference: taper }); prim.geom();
    ck('MoveOperatorAfter', 'moves the operator to evaluate right after the reference; the geometry is re-evaluated', ok(r) && eq(stack(), ['gen', 'bend', 'taper', 'twist']) && prim.version > v0, [stack(), v0, prim.version]);
    A.undo(); ck('MoveOperatorAfter', 'undo restores the order', eq(stack(), ['gen', 'twist', 'bend', 'taper']), stack());
    r = run('MoveOperatorAfter', { Object: 'vsphere', OperatorToMove: taper.name, OperatorReference: gen }); ck('MoveOperatorAfter', 'object and operator by name; after the generator', ok(r) && eq(stack(), ['gen', 'taper', 'twist', 'bend']), stack()); A.undo();
    r = run('MoveOperatorBefore', { Object: sph, OperatorToMove: taper, OperatorReference: twist }); ck('MoveOperatorBefore', 'moves the operator to evaluate right before the reference', ok(r) && eq(stack(), ['gen', 'taper', 'twist', 'bend']), stack());
    A.undo(); ck('MoveOperatorBefore', 'undo', eq(stack(), ['gen', 'twist', 'bend', 'taper']));
    r = run('MoveOperatorBefore', { Object: sph, OperatorToMove: taper, OperatorReference: gen }); ck('MoveOperatorBefore', 'before the generator: error', /before the generator/.test(r.err ?? '') && eq(stack(), ['gen', 'twist', 'bend', 'taper']), r);
    r = run('MoveOperatorAfter', { Object: sph, OperatorToMove: gen, OperatorReference: taper }); ck('MoveOperatorAfter', 'moving the generator: error', /generator operator cannot be moved/.test(r.err ?? ''), r);
    r = run('MoveOperatorAfter', { Object: cube, OperatorToMove: twist, OperatorReference: taper }); ck('MoveOperatorAfter', 'operator of another object: error', /is not in the stack/.test(r.err ?? ''), r);
    prim.geom(); v0 = prim.version; r = run('SwapOperators', { Object: sph, Operator1: twist, Operator2: taper }); prim.geom(); ck('SwapOperators', 'exchanges the two operators; the geometry is re-evaluated', ok(r) && eq(stack(), ['gen', 'taper', 'bend', 'twist']) && prim.version > v0, stack());
    A.undo(); ck('SwapOperators', 'undo', eq(stack(), ['gen', 'twist', 'bend', 'taper']));
    r = run('SwapOperators', { Object: sph, Operator1: gen, Operator2: taper }); ck('SwapOperators', 'generator: error', /generator operator cannot be moved/.test(r.err ?? ''), r);
    const mute = () => [twist, bend, taper].map(o => o.val('mute'));
    r = run('DeactivateAbove', { Operator: twist, Mute: true }); ck('DeactivateAbove', 'Mute=True mutes every operator above', ok(r) && r.v === 2 && eq(mute(), [false, true, true]), mute());
    r = run('DeactivateAbove', { Operator: twist }); ck('DeactivateAbove', 'default Mute=False un-mutes them', ok(r) && eq(mute(), [false, false, false]), mute());
    A.undo(); ck('DeactivateAbove', 'undo', eq(mute(), [false, true, true]));
  }
  {
    const { cube, sph, nul } = S(); const root = A.scene.root;
    A.run('Translate', { InputObj: [nul], X: 2, Y: 0, Z: 0 }); A.run('ParentObj', { Parent: 'vnull', Children: [cube] }); A.run('Translate', { InputObj: [cube], X: 3, Y: 0, Z: 0 });
    const gx = o => o.globalMatrix().elements[12];
    let r = run('CreateTransformGroup'); ck('CreateTransformGroup', 'default args, nothing selected: error', /select the object/.test(r.err ?? ''), r);
    r = run('RemoveTransformGroup', { InputObjs: [cube] }); ck('RemoveTransformGroup', 'no group: error', /no transform group/.test(r.err ?? ''), r);
    A.select([cube, sph]); r = run('CreateTransformGroup'); const g = r.v;
    ck('CreateTransformGroup', 'default args: a null named transfogroup parents the selection and is selected', ok(r) && g.name === 'transfogroup' && g.type === 'null' && g.parentObj === root && eq(names(g.children), ['vcube', 'vsphere']) && eq(names(A.selection), ['transfogroup']), [r, names(g?.children)]);
    ck('CreateTransformGroup', 'the members keep their global pose', near(gx(cube), 5) && near(posx(cube), 5), [gx(cube), posx(cube)]);
    A.undo(); ck('CreateTransformGroup', 'undo restores parents and transforms', cube.parentObj === nul && sph.parentObj === root && near(posx(cube), 3) && !allObjs().includes(g));
    A.redo(); A.run('Translate', { InputObj: [g], X: 10, Y: 0, Z: 0 }); A.select([g]);
    r = run('RemoveTransformGroup'); ck('RemoveTransformGroup', 'default args: members go to the group\'s parent at their global pose, the group is deleted', ok(r) && cube.parentObj === root && sph.parentObj === root && !allObjs().includes(g) && near(posx(cube), 15) && near(gx(cube), 15), [r, posx(cube)]);
    A.undo(); ck('RemoveTransformGroup', 'undo restores the group', allObjs().includes(g) && cube.parentObj === g && near(posx(cube), 5) && near(gx(cube), 15));
    r = run('RemoveTransformGroup', { InputObjs: [sph] }); ck('RemoveTransformGroup', 'a member names its group', ok(r) && !allObjs().includes(g) && cube.parentObj === root, r);
  }

  // ----------------------------------------------------------------------------------------------- Property
  {
    const { cube, sph, nul } = S(); A.select([sph]);
    let r = run('SIAddProp'); ck('SIAddProp', 'default args: error, no preset', /no property preset given/.test(r.err ?? ''), r);
    const k0 = cube.properties.length; r = run('SIAddProp', { PresetObj: 'Annotation', InputObjs: [cube], PropertyName: 'Note1' }); const note = r.v?.[0];
    ck('SIAddProp', 'adds the property, names it, returns it, leaves the selection', ok(r) && r.v.length === 1 && note.type === 'annotation' && note.name === 'Note1' && cube.properties.includes(note) && cube.properties.length === k0 + 1 && eq(names(A.selection), ['vsphere']), [r, names(A.selection)]);
    A.undo(); ck('SIAddProp', 'undo removes it', cube.properties.length === k0); A.redo();
    r = run('SIAddPropEx'); ck('SIAddPropEx', 'default args: error, no property', /no property given/.test(r.err ?? ''), r);
    note.set('text', 'hello'); const s0 = sph.properties.length; r = run('SIAddPropEx', { InputObj: [sph], Property: 'vcube.Note1' }); const cp = r.v?.[0];
    ck('SIAddPropEx', 'puts a copy of the property on the object', ok(r) && cp !== note && cp.type === 'annotation' && cp.val('text') === 'hello' && sph.properties.includes(cp) && sph.properties.length === s0 + 1, r);
    A.undo(); ck('SIAddPropEx', 'undo', sph.properties.length === s0); A.redo();

    let i0 = A.log.length; A.select([cube]); r = run('RemoveProperties'); ck('RemoveProperties', 'default args (empty Type): nothing removed, logged', ok(r) && r.v === 0 && cube.properties.includes(note) && /RemoveProperties: not yet attested/.test(logSince(i0)), r);
    const before = names(cube.properties); r = run('RemoveProperties', { InputObjs: [cube], Type: 'annotation' }); ck('RemoveProperties', 'removes the properties of the type', ok(r) && r.v === 1 && !cube.properties.includes(note), r);
    r = run('RemoveProperties', { InputObjs: [cube], Type: 'visibility' }); ck('RemoveProperties', 'Visibility cannot be removed', ok(r) && r.v === 0 && !!cube.property('visibility'), r);
    A.undo(); ck('RemoveProperties', 'undo restores it at its place', eq(names(cube.properties), before), names(cube.properties));
    A.run('ApplyCns', { Preset: 'Position', InputObjs: [cube], Target: [nul] }); const withCns = names(cube.properties);
    A.select([cube]); r = run('RemoveAllProperties'); ck('RemoveAllProperties', 'default args: only Visibility and constraints stay', ok(r) && r.v === withCns.length - 2 && eq(names(cube.properties), ['Visibility', 'Position Cns']), names(cube.properties));
    A.undo(); ck('RemoveAllProperties', 'undo restores the list in order', eq(names(cube.properties), withCns), names(cube.properties));
    A.run('ParentObj', { Parent: 'vnull', Children: [sph] }); r = run('RemoveAllProperties', { InputObjs: [nul], BranchFlag: 'siBranch' }); ck('RemoveAllProperties', 'siBranch: descendants too', ok(r) && eq(names(sph.properties), ['Visibility']) && eq(names(nul.properties), ['Visibility']), names(sph.properties));
  }
  {
    const { cube, sph } = S(); const mats = () => A.scene.materials.map(m => m.name); A.select([sph]);
    let r = run('SIAssignMaterial'); ck('SIAssignMaterial', 'default args: error, no material', /no such material/.test(r.err ?? ''), r);
    // SICreateMaterial moved to the CMD-B15b contract (compare_propertytasks_b15b_commands.mjs); here it only supplies the material
    const m = run('SICreateMaterial', { PresetObj: 'Phong', Name: 'VMat', Objects: [cube] }).v;
    r = run('SIAssignMaterial', { Objects: [sph], Material: 'VMat' }); ck('SIAssignMaterial', 'assigns the named material', ok(r) && sph.material === m, r);
    A.undo(); ck('SIAssignMaterial', 'undo', sph.material === null); A.redo();
    r = run('SelectMaterialsUsedBy', { InputObjs: [sph] }); ck('SelectMaterialsUsedBy', 'selects the object\'s material', ok(r) && eq(names(A.selection), ['VMat']) && r.v[0] === m, names(A.selection));
    r = run('SelectObjectsUsingMaterial', { InputObjs: [m] }); ck('SelectObjectsUsingMaterial', 'selects the objects the material is assigned to', ok(r) && eq(names(A.selection).sort(), ['vcube', 'vsphere']), names(A.selection));
    r = run('SelectObjectsUsingMaterial', { InputObjs: 'Scene_Material' }); ck('SelectObjectsUsingMaterial', 'Scene_Material: its owner, the scene root', ok(r) && eq(names(A.selection), ['Scene_Root']), names(A.selection));
    A.select([sph]); r = run('SIUnAssignMaterial'); ck('SIUnAssignMaterial', 'default args: the selection goes back to the inherited material', ok(r) && sph.material === null && cube.material === m, r);
    A.undo(); ck('SIUnAssignMaterial', 'undo', sph.material === m); A.redo();
    A.select([sph]); r = run('SelectMaterialsUsedBy'); ck('SelectMaterialsUsedBy', 'default args: inherited material of the selection', ok(r) && eq(names(A.selection), ['Scene_Material']), names(A.selection));
    A.select([]); r = run('SelectObjectsUsingMaterial'); ck('SelectObjectsUsingMaterial', 'default args, nothing selected: empty selection', ok(r) && A.selection.length === 0, r);
  }
  {
    const { cube, sph, nul } = S(); A.select([sph]);
    let r = run('SIMakeLocal'); ck('SIMakeLocal', 'default args on the selection: its shared properties become local, selection untouched', ok(r) && r.v.length >= 1 && sph.properties.every(p => !p.shared) && eq(names(A.selection), ['vsphere']), r);
    A.undo(); ck('SIMakeLocal', 'undo restores the shared state', sph.property('display').shared === true);
    r = run('SIMakeLocal', { InputObjs: 'vcube.display' }); ck('SIMakeLocal', 'property by path', ok(r) && r.v.length === 1 && r.v[0] === cube.property('display') && cube.property('display').shared === false && cube.property('geomapprox').shared === true, r);
    const k0 = nul.properties.length; r = run('SIMakeLocal', { InputObjs: 'vnull.geomapprox' }); ck('SIMakeLocal', 'inherited property: the object gets its own local copy', ok(r) && r.v[0].type === 'geomapprox' && nul.properties.includes(r.v[0]) && r.v[0].shared === false, r);
    A.undo(); ck('SIMakeLocal', 'undo removes the local copy', nul.properties.length === k0);
    r = run('SIMakeLocal', { InputObjs: 'vcube.material' }); ck('SIMakeLocal', 'inherited material: the object gets its own material', ok(r) && r.v[0]?.kind === 'material' && cube.material === r.v[0] && cube.material !== A.scene.root.material, r);
    r = run('SIMakeLocal', { InputObjs: 'vcube.nonsense' }); ck('SIMakeLocal', 'not a shared property: error', /is not a shared property/.test(r.err ?? ''), r);
    A.select([]); r = run('MakeLocal'); ck('MakeLocal', 'default args, nothing selected: nothing to do', ok(r) && r.v.length === 0, r);
    r = run('MakeLocal', { InputObjs: 'vsphere.geomapprox' }); ck('MakeLocal', 'makes the property local and selects it', ok(r) && sph.property('geomapprox').shared === false && A.selection.length === 1 && A.selection[0] === sph.property('geomapprox'), names(A.selection));
    A.undo(); ck('MakeLocal', 'undo', sph.property('geomapprox').shared === true);
  }
  {
    const { cube, sph } = S(); const lvl = o => o.property('geomapprox').val('gapproxmordrsl'); A.select([cube]);
    const shared0 = cube.property('geomapprox').shared;
    let r = run('IncreaseSubdivision'); ck('IncreaseSubdivision', 'default args: selection goes one level up on a local Geometry Approximation', ok(r) && eq(r.v, [1]) && lvl(cube) === 1 && lvl(sph) === 0 && cube.property('geomapprox').shared === false, r);
    const view = cube.property('geomapprox').get('gapproxmosl'); if (view) ck('IncreaseSubdivision', 'the view level follows', view.value === 1, view.value);
    r = run('DecreaseSubdivision'); ck('DecreaseSubdivision', 'default args: one level down', ok(r) && eq(r.v, [0]) && lvl(cube) === 0, r);
    r = run('DecreaseSubdivision'); ck('DecreaseSubdivision', 'clamped at the minimum', ok(r) && eq(r.v, [0]) && lvl(cube) === 0, r);
    A.undo(); A.undo(); A.undo(); ck('IncreaseSubdivision', 'undo restores level and shared state', lvl(cube) === 0 && cube.property('geomapprox').shared === shared0);
    const max = cube.property('geomapprox').get('gapproxmordrsl').def.max; for (let i = 0; i < 9; i++) r = run('IncreaseSubdivision', { InputObjs: [cube, sph] });
    ck('IncreaseSubdivision', 'clamped at the maximum; explicit InputObjs', ok(r) && lvl(cube) === max && lvl(sph) === max, [lvl(cube), max]);

    A.autoInspect = false; r = run('AutoInspectEnabled'); ck('AutoInspectEnabled', 'default args: reports auto-inspect (off)', r.v === false, r);
    A.autoInspect = true; r = run('AutoInspectEnabled'); ck('AutoInspectEnabled', 'reports auto-inspect (on)', r.v === true, r); A.autoInspect = false;
    r = run('ToggleBooleanUserPref'); ck('ToggleBooleanUserPref', 'default args: error, no name', /no preference name given/.test(r.err ?? ''), r);
    r = run('ToggleBooleanUserPref', { UserPref: 'AutoInspect' }); ck('ToggleBooleanUserPref', 'AutoInspect toggles the App flag and returns it', r.v === true && A.autoInspect === true, r);
    r = run('ToggleBooleanUserPref', { UserPref: 'AutoInspect' }); ck('ToggleBooleanUserPref', 'toggles back', r.v === false && A.autoInspect === false, r);
    const a = run('ToggleBooleanUserPref', { UserPref: 'VEP_TEST_PREF' }), b2 = run('ToggleBooleanUserPref', { UserPref: 'VEP_TEST_PREF' }); ck('ToggleBooleanUserPref', 'any other preference: true, then false', a.v === true && b2.v === false, [a, b2]);

    A.select([sph]); const twist = A.run('ApplyOp', { PresetObj: 'Twist' })[0]; const seen = []; const off = A.events.on('inspect', n => seen.push(n));
    A.select([sph]); r = run('InspectLastOperator'); ck('InspectLastOperator', 'default args: the top operator of the selection is inspected', ok(r) && seen.length === 1 && seen[0] === twist, names(seen));
    r = run('InspectLastOperator', { InputObjs: [cube] }); ck('InspectLastOperator', 'explicit InputObjs: its generator', ok(r) && seen.length === 2 && seen[1] === cube.primitive.operators[0], names(seen)); off();
  }

  // --------------------------------------------------------------------------------------------- Constraint
  {
    const { cube, sph, nul } = S(); const cns = o => o.properties.filter(p => Array.isArray(p.targets));
    A.run('ApplyCns', { Preset: 'Position', InputObjs: [cube], Target: [nul] }); A.run('ApplyCns', { Preset: 'Orientation', InputObjs: [cube], Target: [nul] }); A.select([nul]);
    let r = run('GetConstrainedObjects'); ck('GetConstrainedObjects', 'default args: objects constrained to the selection; selection untouched', ok(r) && eq(names(r.v), ['vcube']) && eq(names(A.selection), ['vnull']), names(r.v));
    r = run('GetConstrainedObjects', { InputObj: 'vsphere' }); ck('GetConstrainedObjects', 'nothing constrained: empty', ok(r) && r.v.length === 0, r);
    r = run('SelectConstrainedObjects'); ck('SelectConstrainedObjects', 'default args: selects them', ok(r) && eq(names(A.selection), ['vcube']), names(A.selection));
    r = run('SelectConstrainedObjects', { ConstrainingObj: [sph] }); ck('SelectConstrainedObjects', 'nothing constrained: empty selection', ok(r) && A.selection.length === 0, r);
    let i0 = A.log.length; A.select([cube]); r = run('RemoveCnsType'); ck('RemoveCnsType', 'default args (empty Type): nothing removed, logged', ok(r) && r.v === 0 && cns(cube).length === 2 && /RemoveCnsType: not yet attested/.test(logSince(i0)), r);
    r = run('RemoveCnsType', { Type: 'Position', ConstrainedObj: [cube] }); ck('RemoveCnsType', 'by preset name', ok(r) && r.v === 1 && eq(names(cns(cube)), ['Orientation Cns']), names(cns(cube)));
    A.undo(); ck('RemoveCnsType', 'undo', eq(names(cns(cube)), ['Position Cns', 'Orientation Cns']), names(cns(cube)));
    r = run('RemoveCnsType', { Type: 'oricns' }); ck('RemoveCnsType', 'by constraint type, on the selection', ok(r) && r.v === 1 && eq(names(cns(cube)), ['Position Cns']), names(cns(cube))); A.undo();
    const order = names(cube.properties); r = run('RemoveAllCns'); ck('RemoveAllCns', 'default args: every constraint of the selection is removed', ok(r) && r.v === 2 && cns(cube).length === 0, r);
    A.undo(); ck('RemoveAllCns', 'undo restores them in place', eq(names(cube.properties), order), names(cube.properties));
    r = run('RemoveAllCns', { ConstrainedObj: 'vcube' }); ck('RemoveAllCns', 'explicit ConstrainedObj', ok(r) && cns(cube).length === 0 && run('GetConstrainedObjects', { InputObj: [nul] }).v.length === 0, r);

    for (const n of ['SIApplyCns', 'SIApplyConstraint']) {
      r = run(n); ck(n, 'default args: error, no preset', /no constraint preset given/.test(r.err ?? ''), r);
      r = run(n, { PresetObj: 'Position', ConstrainedObj: [sph] }); ck(n, 'no constraining object: the pick session is not yet attested', r.nya === true && /not yet attested: the pick session/.test(r.err ?? '') && cns(sph).length === 0, r);
      A.select([cube]); r = run(n, { PresetObj: 'Position', ConstrainedObj: [sph], ConstrainingObj: [nul] });
      ck(n, 'adds the constraint and returns it; selection untouched', ok(r) && cns(sph).length === 1 && r.v === cns(sph)[0] && r.v.type === 'poscns' && eq(names(r.v.targets), ['vnull']) && eq(names(A.selection), ['vcube']), r);
      A.undo(); ck(n, 'undo removes it', cns(sph).length === 0);
    }
    A.run('Translate', { InputObj: [sph], X: 3, Y: 0, Z: 0 });
    r = run('SIApplyCns', { PresetObj: 'Position', ConstrainedObj: 'vsphere', ConstrainingObj: 'vnull', Compensation: true }); ck('SIApplyCns', 'Compensation keeps the offset', ok(r) && near(r.v.val('offsetx'), 3), r.v?.val?.('offsetx')); A.undo();
    i0 = A.log.length; r = run('SIApplyConstraint', { PresetObj: 'Position', ConstrainedObj: [sph], ConstrainingObj: [nul], Offset1X: 1 }); ck('SIApplyConstraint', 'Offset arguments: constraint applied, offsets logged as not yet attested', ok(r) && cns(sph).length === 1 && /SIApplyConstraint: not yet attested: the Offset1/.test(logSince(i0)), r);
  }

  // Transport Control: CMD-B19d (compare_selection_b19d.mjs)

  // ------------------------------------------------------------------------------------------------ General
  {
    const { cube } = S();
    let r = run('EndUndo'); ck('EndUndo', 'default args without BeginUndo: silent no-op (CMD-B16c)', ok(r) && r.v === undefined, r);
    const u0 = A.undoStack.length; r = run('BeginUndo'); const r2 = run('EndUndo'); ck('BeginUndo', 'default args: an empty group adds nothing to the undo stack', ok(r) && ok(r2) && r2.v === undefined && A.undoStack.length === u0, [r, r2]);
    run('BeginUndo', { Name: 'VEP group' }); A.run('Translate', { InputObj: [cube], X: 1, Y: 0, Z: 0 }); A.run('Translate', { InputObj: [cube], X: 2, Y: 0, Z: 0 });
    ck('BeginUndo', 'commands inside the group still run', posx(cube) === 3 && A.undoStack.length === u0 + 2);
    r = run('EndUndo'); ck('EndUndo', 'folds the group into one named undo entry', ok(r) && r.v === undefined && A.undoStack.length === u0 + 1 && A.undoStack[A.undoStack.length - 1].label === 'VEP group', [r, A.undoStack.length - u0]);
    A.undo(); ck('EndUndo', 'one undo reverts the whole group', posx(cube) === 0 && A.undoStack.length === u0, posx(cube));
    A.redo(); ck('EndUndo', 'one redo replays it', posx(cube) === 3);
    run('BeginUndo', { Name: 'outer' }); A.run('Translate', { InputObj: [cube], X: 1, Y: 0, Z: 0 }); run('BeginUndo', { Name: 'inner' }); A.run('Translate', { InputObj: [cube], X: 1, Y: 0, Z: 0 }); const inner = run('EndUndo'); const outer = run('EndUndo');
    ck('BeginUndo', 'nested groups: the outermost collects everything', inner.v === undefined && outer.v === undefined && A.undoStack[A.undoStack.length - 1].label === 'outer' && A.undoStack.length === u0 + 2, [inner, outer]);
  }
  A.run('NewScene');
  return { registration, info, R, unused: COMMANDS.filter(n => !used.has(n)) };
}, { COMMANDS });
await b.close();

// ---------------------------------------------------------------- report
let checks = 0; const fails = [];
const line = (ok, text, detail) => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) fails.push(`${text}${detail ? ' — ' + detail : ''}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const r of got.registration) {
  const entries = registry[r.name] ?? [];
  if (!entries.length) { line(false, `${r.name}: is in data/commands_full.json`); continue; }
  line(r.found, `${r.name}: registered`);
  if (!r.found) continue;
  line(got.info.registered.includes(r.name), `${r.name}: registered by this batch (not left to another module)`, `skipped: ${got.info.skipped.join(',')}`);
  const hit = entries.find(e => same(e.args, r.args));
  line(!!hit, `${r.name}: argument names / defaults match a registry entry (${entries.length} overload${entries.length > 1 ? 's' : ''})`, `got ${JSON.stringify(r.args)} want ${JSON.stringify(entries[0].args)}`);
  line(entries.some(e => e.label === r.label && e.category === r.category), `${r.name}: label / category match the registry`, `got ${r.label} / ${r.category}; want ${entries.map(e => `${e.label} / ${e.category}`).join(' | ')}`);
}
for (const c of got.R) line(c.ok, `${c.cmd}: ${c.what}`, c.detail);
line(got.unused.length === 0, 'every command of the batch was exercised', got.unused.join(','));
line(same(got.info.registered.slice().sort(), COMMANDS.slice().sort()), 'the batch registers exactly the listed commands', `registered ${got.info.registered.length}, listed ${COMMANDS.length}, skipped ${got.info.skipped.join(',')}`);
line(pageErrors.length === 0, 'no page errors', pageErrors.join(' | '));

if (fails.length) {
  console.error(`FAIL view/edit/property inferred batch: ${fails.length} of ${checks} checks`);
  for (const f of fails) console.error('  ' + f);
  process.exit(1);
}
console.log(`OK view/edit/property inferred batch: ${checks} checks, ${COMMANDS.length} commands exercised (registry dump + reasoned contract; no analyst note, no golden)`);
