// Ledger row CMD-B17h: the script commands of command.js, rigs.vbs, Charac_Tools.js and Charac_LoadBipedGuide.vbs
//   EditCommand (SPEC-PARTIAL) CreateAndEditCommand (SPEC-PARTIAL) CreateSpine TagObject TagStepMarks GetProportionalGuide
// Brief: docs/ghidra/cmd-b17h-command-rigs-charac-duplicate-scripts.md sections 2-5 and the cmd-b17h section of
// docs/re/WIRE_CORRECTIONS_B17.md. Original code written from that prose only; no golden exists. The LOCK entries
// (Instantiate, CreateHierarchyFromBiped) are not touched.
// Replaces the older inferred bodies in inferredB10Scene.ts, model.ts / model2.ts, anim.ts and rigging.ts.
//
// How the contract is mapped onto this build (see also paramsToolsB17g.ts):
//  * Scripted operators (SpineCurve, FixedLength, SpinePointAt) are parameter-carrying stand-in operators (kit of row
//    CMD-B15e); the path constraints are stored as inert constraint properties (no evaluation in this build).
//  * Single picks use the synchronous PickElement command (app.tasksB11b.pickHook); modal dialogs use
//    app.cmdB17gh.hooks.inspect (no hook: OK with the values shown, logged).
//  * The guide preset models (BipedPropGuide / Biped_Guide / Biped_DogLeg_Guide .emdl) are not bundled: GetPresetModel
//    is called as the contract says; when it has no preset to load (or routes back here) this build's procedural guide
//    stands in for the preset content.
import * as THREE from 'three';
import { App, CommandDef } from '../core/commands';
import { X3DObject, Property, Primitive, Constraint, makeDisplay, makeGeomApprox, makeGeomOperator, Model } from '../core/scene';
import { num, bool, int, str } from '../core/params';
import type { Parameter } from '../core/params';
import { findNode, unset } from './viewEditPropertyHelpers';
import { mkNull, mkCurve, mkImplicit, applyOp, constrain, setP, setColor, gpos, setGlobalPos, addObject } from './rigScriptsB15eKit';
import { b17, modal, logInfo, logWarning, logError, logNya as logNyaG, scriptsText, customParamSet, deleteProp, objList } from './paramsToolsB17g';
import { findParam } from './index';

export const ROW_H = 'CMD-B17h';
const logNya = (app: App, command: string, what: string) => logNyaG(app, command, what, ROW_H);

// ------------------------------------------------------------------ command.js
const COMMAND_PROPS: [string, 'string' | 'bool', (d: CommandDef) => any][] = [
  // the documented Command object properties; values this build's command definitions do not carry are empty (inferred)
  ['Name', 'string', d => d.label ?? d.name], ['ScriptingName', 'string', d => d.name], ['Description', 'string', d => d.description ?? ''],
  ['Tooltip', 'string', () => ''], ['Category', 'string', d => d.category ?? ''], ['Language', 'string', () => ''], ['Handler', 'string', () => ''],
  ['FileName', 'string', () => ''], ['Code', 'string', () => ''], ['ReturnValue', 'bool', () => false], ['SupportsKeyAssignment', 'bool', () => true],
  ['CannotBeUsedInBatch', 'bool', () => false], ['IsNotLogged', 'bool', d => !!d.noLog], ['Enabled', 'bool', () => true],
];
const ARG_TYPES = [{ label: 'Input', value: 1 }, { label: 'Output', value: 2 }, { label: 'Input/Output', value: 3 }, { label: '', value: -1 }];   // siArgumentInput / Output / InputOutput
/** The command editor property (unattached CustomProperty named after the command). */
export function commandEditorProperty(def: CommandDef, builtin: boolean): Property {
  const p = new Property(def.label ?? def.name, 'customparamset', []); (p as any).preset = 'CustomProperty';
  for (const [name, type, get] of COMMAND_PROPS) {
    const ro = builtin;   // built-in commands are read-only (IsReadOnly not read: every property read-only on a built-in)
    p.add(type === 'bool' ? bool(name, !!get(def), name, { readOnly: ro }) : str(name, String(get(def)), name, { readOnly: ro }));
  }
  p.add(int('Embedded', 1, 'Embedded', { min: 0, max: 10 }));
  p.add(bool('Builtin', builtin, 'Builtin', { readOnly: true }));
  p.add(str('CodeBackup', '', 'CodeBackup'));
  const rows = def.args.map(a => ({ Name: a.name, Type: 1, 'Default Value': a.default ?? null, Handler: -1 }));   // flags / handlers: not carried by this build
  (p as any).grids = { Arguments: { columns: ['Name', 'Type', 'Default Value', 'Handler'], typeItems: ARG_TYPES, handlerItems: [] as string[], rows, hidden: rows.length === 0 } };
  (p as any).editorLayout = [{ tab: 'Description', items: [{ param: 'Name', label: 'Name' }, { param: 'ScriptingName' }] }];   // rest of the layout not read
  return p;
}
function findCommand(app: App, name: string): CommandDef | null {
  if (!name) return null;
  for (const d of app.commands.values()) if ((d.label ?? '') === name) return d;   // Application.Commands(name)
  return app.commands.get(name) ?? null;                                          // GetCommandByScriptingName
}
/** Shows the editor; returns True = cancelled. */
function editCommandDef(app: App, C: string, def: CommandDef, builtin: boolean, onOk?: () => void): boolean {
  const st = b17(app); const a = app as any;
  const cmdlog = a.cmdLog; a.cmdLog = false;   // preferences.scripting.cmdlog off while editing
  try {
    const prop = commandEditorProperty(def, builtin);
    st.last[C] = prop;
    const answer = st.hooks.inspect ? st.hooks.inspect(C, prop, def.label ?? def.name) : undefined;
    if (answer === undefined) { logNya(app, C, 'the modal inspect of the command editor; treated as Cancel'); return true; }
    st.dialogs.push({ command: C, prop: prop.name, title: def.label ?? def.name, ok: answer, values: Object.fromEntries(prop.params.map(q => [q.name, q.value])) });
    if (!answer) return true;
    logNya(app, C, 'writing the edited properties and arguments back to the command');
    onOk?.();
    return false;
  } finally { a.cmdLog = cmdlog; }   // inferred: the cmdlog preference is restored after the editor
}
function editCommand(app: App, a: Record<string, any>): boolean {
  const C = 'EditCommand'; const name = String(a.CommandName ?? '');
  const def = findCommand(app, name);
  if (!def) { logWarning(app, `'${name}' is not an editable command.`); return false; }
  return editCommandDef(app, C, def, true);
}
function createAndEditCommand(app: App): boolean {
  const C = 'CreateAndEditCommand';
  // GetUniqueCommandName not read; inferred: "NewCommand", then "NewCommand1", "NewCommand2", ...
  let name = 'NewCommand'; for (let i = 1; app.commands.has(name) || findCommand(app, name); i++) name = `NewCommand${i}`;
  const def: CommandDef = { name, label: name, category: '', description: '', args: [], execute: (app2) => { logNya(app2, name, 'the code of a command created with CreateAndEditCommand'); } };   // Application.CreateCommand
  b17(app).last.createdCommand = def;
  // EditNewCommand not read; inferred: the EditCommand editor, the command is added on OK
  return editCommandDef(app, C, def, false, () => app.register(def));
}

// ------------------------------------------------------------------ rigs.vbs: CreateSpine
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** Polygon mesh cube (AddGeometry "Cube", "MeshSurface") with the given length. */
export function meshCube(app: App, name: string, parent: X3DObject | null, length: number, at?: THREE.Vector3): X3DObject {
  const o = new X3DObject(app.scene.uniqueName(name), 'polymsh'); const prim = new Primitive('Polygon Mesh', 'polymsh');
  const g = makeGeomOperator('Cube'); if (g.get('length')) g.set('length', length); else g.add(num('length', length, 'Length'));
  prim.addOperator(g); o.setPrimitive(prim); o.addProperty(makeDisplay(false)); o.addProperty(makeGeomApprox());
  addObject(app, o, parent ?? app.scene.root); if (at) setGlobalPos(o, at);
  return o;
}
const bezier = (P: THREE.Vector3[], t: number) => { const u = 1 - t; return P[0].clone().multiplyScalar(u * u * u).add(P[1].clone().multiplyScalar(3 * u * u * t)).add(P[2].clone().multiplyScalar(3 * u * t * t)).add(P[3].clone().multiplyScalar(t * t * t)); };
/** Length of the cubic curve with 4 control points (sampled). */
function curveLength(P: THREE.Vector3[]): number { let L = 0; let prev = P[0]; for (let i = 1; i <= 256; i++) { const q = bezier(P, i / 256); L += q.distanceTo(prev); prev = q; } return L; }
/** Expression `text` on `p`, the references resolved through `refs` first (undoable). */
function setExpr(app: App, p: Parameter, text: string, refs: Record<string, Parameter>) {
  app.record('SetExpr', () => app.anim.setExpression(p, text, s => refs[s] ?? findParam(app, s)), () => { app.anim.expressions.delete(p); });
}
const pickOne = (app: App, text: string): X3DObject | null | undefined => {
  const r = app.run('PickElement', { SelFilter: 'object', LeftMessage: text, MiddleMessage: text }) as { PickedElement: any; ButtonPressed: number } | undefined;
  if (!r || !r.ButtonPressed) return undefined;   // right click / Esc
  const n = findNode(app, r.PickedElement); return n instanceof X3DObject ? n : null;
};
function createSpine(app: App, a: Record<string, any>): Property | undefined {
  const C = 'CreateSpine'; const st = b17(app);
  let hip = objList(app, unset(a.Hip) ? [] : a.Hip)[0] ?? null, chest = objList(app, unset(a.Chest) ? [] : a.Chest)[0] ?? null;
  let n = Math.max(1, Math.trunc(Number(a.NumVertebrae ?? 3)) || 3);
  let implicitV = a.ImplicitVertebrae === true || /^true$/i.test(String(a.ImplicitVertebrae));
  const interactive = a.Interactive === undefined || a.Interactive === true || /^true$/i.test(String(a.Interactive));
  if (interactive) {
    const h = pickOne(app, scriptsText(1127, 'Select Hip Object'));   // id 1127 wording inferred (1128 is "Select Chest Object")
    if (!h) return undefined;
    const c = pickOne(app, scriptsText(1128, 'Select Chest Object'));
    if (!c) return undefined;
    hip = h; chest = c;
    const dlg = customParamSet(app, app.scene.root, 'Spine_Maker Keys', [
      int('NumberOfVertebra', 3, 'NumberOfVertebra', { min: 1, max: 100, uimin: 1, uimax: 20 }), bool('ImplicitVertebra', false, 'ImplicitVertebra'),
    ]);
    const ok = modal(app, C, dlg, 'Spine_Maker Keys', ROW_H);
    if (!ok) { deleteProp(app, dlg); return undefined; }
    n = Math.max(1, Number(dlg.val('NumberOfVertebra'))); implicitV = !!dlg.val('ImplicitVertebra');
    deleteProp(app, dlg);
  }
  if (!hip || !chest) { logNya(app, C, 'a non-interactive run without both Hip and Chest objects'); return undefined; }
  // 2. preferences
  const ai = app.autoInspect, comp = st.prefs.SI3D_CONSTRAINT_COMPENSATION_MODE;
  app.autoInspect = false; st.prefs.SI3D_CONSTRAINT_COMPENSATION_MODE = 0;
  let control: Property;
  try {
    // 3. curve and depth nulls
    const P0 = gpos(hip), P3 = gpos(chest), P1 = P0.clone().lerp(P3, 0.40), P2 = P0.clone().lerp(P3, 0.60);
    const P = [P0, P1, P2, P3];
    const curve = mkCurve(app, app.scene.uniqueName('spineCurve'), app.scene.root, P, { degree: 3 });
    const hipDepth = mkNull(app, app.scene.uniqueName('hipDepth'), hip, P1);
    const chestDepth = mkNull(app, app.scene.uniqueName('chestDepth'), chest, P2);
    const dist = P0.distanceTo(P3); const len = curveLength(P);
    // 4. Spine_Control, SpineCurve operator
    control = customParamSet(app, curve, 'Spine_Control', [num('scale', 1, 'scale', { min: 0.01, max: 10000, uimin: 0.01, uimax: 10, animatable: true, group: 'visualization' })]);
    const scale = control.get('scale')!; const scaleRef = `${curve.name}.Spine_Control.scale`;
    const refs: Record<string, Parameter> = { [scaleRef]: scale };
    const spineOp = applyOp(app, curve, 'SpineCurve', { lScale: 1, lgoal: len }, [curve, hip, hipDepth, chestDepth, chest]);
    setExpr(app, spineOp.get('lScale')!, scaleRef, refs);
    const mkVertebra = (length: number) => implicitV
      ? (() => { const o = mkImplicit(app, app.scene.uniqueName('vertebra'), curve, 'Cube', P0, length); setP(o.primitive!, 'length', length); return o; })()   // AddPrimitive "Cube"
      : meshCube(app, 'vertebra', curve, length, P0);   // AddGeometry "Cube", "MeshSurface"
    // 5. top vertebra (inferred: the same implicit / mesh choice as the other vertebrae)
    const top = mkVertebra(dist / n * 0.8);
    const topCns = constrain(app, top, 'Path', [curve], { cnscomp: false, tangent: true, upvct_active: true, perc: 100 })!;   // perc 100: the FixedLength result (stand-in, inferred)
    setGlobalPos(top, bezier(P, 1));
    const fixed = applyOp(app, top, 'FixedLength', { init_length: len, lScale: 1 }, [top, curve]);
    setExpr(app, fixed.get('lScale')!, scaleRef, refs);
    const topPerc = `${top.name}.kine.pathcns.perc`; refs[topPerc] = topCns.get('perc')!;
    // 6. vertebrae
    const verts: X3DObject[] = [];
    for (let i = 0; i < n; i++) {
      const v = mkVertebra(dist / n * 0.6);
      const cns = constrain(app, v, 'Path', [curve], { tangent: true, upvct_active: true, perc: 0 })!;
      const k = Math.round(((i + 1) / (n + 1)) * 1e6) / 1e6;
      setExpr(app, cns.get('perc')!, `${topPerc} * ${k.toString()}`, refs);   // "." decimal separator
      setGlobalPos(v, bezier(P, k));
      verts.push(v);
    }
    verts.forEach((v, i) => applyOp(app, v, 'SpinePointAt', { slider: 1 - i / (n + 1) - 1 / (n + 1) }, [v, chest, hip]));
    applyOp(app, top, 'SpinePointAt', { slider: 0 }, [top, chest, hip]);
    st.last[C] = { curve, hipDepth, chestDepth, top, vertebrae: verts, control, spineOp, fixed };
  } finally {
    // 7. restore the preferences
    app.autoInspect = ai; st.prefs.SI3D_CONSTRAINT_COMPENSATION_MODE = comp;
  }
  if (interactive) app.run('InspectObj', { InputObjs: control });
  // the Interactive argument is set False by reference so a logged replay does not prompt; inferred: the picked
  // objects and the dialog values are written back the same way
  a.Interactive = false; a.Hip = hip.name; a.Chest = chest.name; a.NumVertebrae = n; a.ImplicitVertebrae = implicitV;
  st.outputs[C] = { Interactive: false, Hip: hip.name, Chest: chest.name, NumVertebrae: n, ImplicitVertebrae: implicitV };
  return control;
}

// ------------------------------------------------------------------ Charac_Tools.js
const tagged = (o: X3DObject, tag: string) => o.properties.some(p => p.name === tag);
function tagObject(app: App, a: Record<string, any>) {
  const tag = unset(a.TagStr) ? 'Tag' : String(a.TagStr);
  const list = objList(app, a.InputObj);
  if (!list[0]) { logWarning(app, 'Please select an object to tag first'); return undefined; }
  for (const o of list) {
    if (!tagged(o, tag)) { customParamSet(app, o, tag); logInfo(app, `${o.name} tagged as ${tag}`); }   // AddProperty("Custom_parameter_list", False, TagStr)
    else logInfo(app, `${o.name} already tagged as ${tag}`);
  }
  return undefined;
}
function findTagged(root: X3DObject, tag: string): X3DObject | null {
  for (const o of root.descendants()) if (tagged(o, tag)) return o;
  return null;
}
function tagStepMarks(app: App, _a: Record<string, any>) {
  const C = 'TagStepMarks'; const st = b17(app);
  // the global selection is used, not InputObj (WIRE_CORRECTIONS_B17)
  const first = app.selection[0];
  const model: X3DObject = !first ? app.scene.root : first instanceof Model ? first : first instanceof X3DObject ? (first.model ?? app.scene.root) : app.scene.root;
  const rf = findTagged(model, 'RightFoot'), lf = findTagged(model, 'LeftFoot'), cog = findTagged(model, 'CenterOfGravity');
  logInfo(app, `RFoot: ${rf?.name ?? ''}`); logInfo(app, `LFoot: ${lf?.name ?? ''}`); logInfo(app, `cog: ${cog?.name ?? ''}`);
  const dlg = customParamSet(app, app.scene.root, 'Test_step_detection', [
    int('Start', app.anim.startFrame, 'Start'), int('End', app.anim.endFrame, 'End'), num('velocity_threshold', 0.2, 'velocity_threshold', { min: 0, max: 100 }),
  ]);
  let start = 0, end = -1, thr = 0.2;
  if (modal(app, C, dlg, scriptsText(1050, 'Test Step Detection'), ROW_H)) { start = Number(dlg.val('Start')); end = Number(dlg.val('End')); thr = Number(dlg.val('velocity_threshold')); }
  else logError(app, 'Command was cancelled !');   // continues with no frame range
  deleteProp(app, dlg);
  const steps = mkNull(app, app.scene.uniqueName('Foot_Steps'), app.scene.root);
  const pairs: { foot: string; start: THREE.Vector3; end: THREE.Vector3; objs: X3DObject[] }[] = [];
  const pair = (foot: X3DObject, s: THREE.Vector3, e: THREE.Vector3) => {
    const a1 = meshCube(app, 'StartStep', steps, 0.1, s); setColor(a1, 302);
    const a2 = meshCube(app, 'EndStep', steps, 0.1, e); setColor(a2, 302);
    const crv = mkCurve(app, app.scene.uniqueName('crvlist'), steps, [s.clone(), e.clone()], { degree: 1 }); setColor(crv, 1022);
    (crv as any).nurbs = { knots: [0, 1], closed: false, parameterization: 'siNonUniformParameterization', type: 'siSINurbs' };
    pairs.push({ foot: foot.name, start: s.clone(), end: e.clone(), objs: [a1, a2, crv] });
  };
  const frame0 = app.anim.frame;
  try {
    for (const foot of [rf, lf]) {
      if (!foot || end < start) continue;
      let prev: THREE.Vector3 | null = null; let locked = false; let spanStart: THREE.Vector3 | null = null; let count = 0;
      for (let f = start; f <= end; f++) {
        app.anim.frame = f; const pos = gpos(foot);
        if (f === start || f === end) pair(foot, pos, pos);
        else if (prev) {
          if (pos.distanceTo(prev) < thr) { if (!locked) { locked = true; spanStart = prev.clone(); count = 2; } else count++; }   // the second frame counts double
          else if (locked) { pair(foot, spanStart!, pos); locked = false; spanStart = null; count = 0; }
        }
        prev = pos;
      }
      void count;
    }
  } finally { app.anim.frame = frame0; }   // inferred: the current frame is restored
  st.last[C] = { model, rf, lf, cog, steps, pairs };
  return undefined;
}

// ------------------------------------------------------------------ Charac_LoadBipedGuide.vbs
const SYM_NAMES: Record<number, string[]> = {
  1: ['RibCageEnd', 'RArmPitTop', 'LArmPitTop', 'RArmPitBase'],
  2: ['LLeg', 'RLeg', 'RLowerThigh', 'RHipBottom', 'RHipTop', 'RKnee', 'RFemur', 'RTibia', 'RMetatarsal', 'RFoot1', 'RFoot2', 'RFoot3', 'RFoot4'],
};
function removeSymmetry(app: App, o: X3DObject): number {
  let n = 0;
  for (const c of [...o.properties]) if (c instanceof Constraint && c.type === 'symmetrycns') { deleteProp(app, c); n++; }
  return n;
}
function getProportionalGuide(app: App, a: Record<string, any>): any {
  const C = 'GetProportionalGuide'; const st = b17(app) as any;
  const name = unset(a.ModelName) ? 'Biped_DogLeg_Guide' : String(a.ModelName);
  let style = Math.trunc(Number(a.GuideStyle ?? 0)) || 0, sym = Math.trunc(Number(a.GuideSymmetry ?? 0)) || 0;
  // GetPresetModel routed back here: the preset content stand-in (this build's procedural guide)
  if (st.guideLoading) return (app as any).buildProportionalGuideStandIn?.(name, style);
  // UseDialog: 0 for "Get Skeleton Biped Guide" (BipedPropGuide), 1 for the other entries (the catalogue has no argument for it)
  const useDialog = name === 'BipedPropGuide' ? 0 : 1;
  if (useDialog) {
    const dlg = customParamSet(app, app.scene.root, 'BipedGuide', [int('Style', style, 'Style'), int('Symmetry', sym, 'Symmetry')]);   // preset content not read (inferred parameters)
    let ok = false; try { ok = modal(app, C, dlg, scriptsText(1047, 'Create Biped Guide'), ROW_H); } catch { ok = false; }
    if (!ok) { deleteProp(app, dlg); return undefined; }
    style = Number(dlg.val('Style')); sym = Number(dlg.val('Symmetry'));
    deleteProp(app, dlg);
  }
  const finish = (guide: X3DObject | null) => {
    if (!(guide instanceof X3DObject)) { logNya(app, C, `the guide preset model ${name} (GetPresetModel returned no model)`); app.run('DeselectAll'); return; }
    // 3. detailed guide visibility
    const viewvis = style === 0 ? 2 : 0;
    const part = name === 'BipedPropGuide' ? 'DetailedGuideVisible' : 'DetailedGuide';
    const grp = app.scene.groupList.find(g => g.name === part && ((g as any).rigModel === guide || (g as any).parent === guide));
    const target = grp ?? [...guide.descendants()].find(o => o.name === part) ?? guide.properties.find(p => p.name === part) ?? null;
    let vp = target?.get('viewvis') ?? (target instanceof X3DObject ? target.property('visibility')?.get('viewvis') : undefined);
    if (!vp && grp) { grp.add(int('viewvis', 1, 'View Visibility')); vp = grp.get('viewvis'); }
    if (vp) app.setParam(vp, vp.def.type === 'bool' ? viewvis !== 0 : viewvis, C);
    else logNya(app, C, `SetValue ${guide.name}.${part}.viewvis, ${viewvis}: the guide of this build has no ${part} group`);
    // 4. symmetry removal
    let removed = 0;
    if (sym === 1 || sym === 2) for (const n of SYM_NAMES[sym]) { const o = [...guide.descendants()].find(x => x.name === n); if (o) removed += removeSymmetry(app, o); }
    else if (sym === 3) removed += removeSymmetry(app, guide);
    st.last[C] = { guide, viewvis, part, style, symmetry: sym, removed };
    app.run('DeselectAll');
  };
  // 2. GetPresetModel(ModelName, ModelName)
  let res: any;
  st.guideLoading = true;
  try { res = app.run('GetPresetModel', { ModelName: name, Name: name }); }
  catch (e: any) { res = null; logNya(app, C, `GetPresetModel ${name}: ${e?.message ?? e}; this build's procedural guide stands in for the preset`); }
  finally { st.guideLoading = false; }
  const fallback = () => (app as any).buildProportionalGuideStandIn?.(name, style) ?? null;
  if (res && typeof res.then === 'function') {
    res.then((m: any) => finish(m instanceof X3DObject ? m : app.scene.root.children.find(c => c.name === name) ?? fallback())).catch(() => finish(fallback()));
    return undefined;
  }
  finish(res instanceof X3DObject ? res : (res === null ? fallback() : app.scene.root.children.find(c => c.name === name) ?? fallback()));
  return undefined;   // the procedure is a Sub (WIRE_CORRECTIONS_B17)
}

// ------------------------------------------------------------------ registration
type Arg = { name: string; default: any };
const A = (...l: [string, any][]): Arg[] => l.map(([name, d]) => ({ name, default: d }));
export function registerRigsCharacB17hCommands(app: App) {
  b17(app);
  app.register({ name: 'EditCommand', label: 'Edit Command', category: 'Customization', description: 'Edit a command', undoable: false, args: A(['CommandName', '']), execute: editCommand });
  app.register({ name: 'CreateAndEditCommand', label: 'Create And Edit Command', category: 'Customization', description: 'Create a command and edit it', undoable: false, args: [], execute: (app2) => createAndEditCommand(app2) });
  app.register({ name: 'CreateSpine', label: 'Create Spine', category: 'Animation', description: 'Create a spine between a hip and a chest object', args: A(['Hip', null], ['Chest', null], ['NumVertebrae', 3], ['ImplicitVertebrae', false], ['Interactive', true]), execute: createSpine });
  app.register({ name: 'TagObject', label: 'Character - Tag Center of Gravity', category: 'Property', description: 'Tag objects with a named custom property', args: A(['InputObj', null], ['TagStr', 'CenterOfGravity']), execute: tagObject });
  app.register({ name: 'TagStepMarks', label: 'Character - Tag Step Marks', category: 'Animation', description: 'Create foot step markers from the tagged feet', args: A(['InputObj', null]), execute: tagStepMarks });
  app.register({ name: 'GetProportionalGuide', label: 'Get Skeleton Biped Dog Leg Guide', category: 'Primitive', description: 'Get a biped guide', args: A(['ModelName', 'Biped_DogLeg_Guide'], ['GuideStyle', 0], ['GuideSymmetry', 0]), execute: getProportionalGuide });
}
