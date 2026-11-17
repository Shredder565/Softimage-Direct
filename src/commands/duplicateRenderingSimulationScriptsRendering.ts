// Ledger row CMD-B6e, Rendering.vbs part. Brief: docs/ghidra/cmd-b6e-duplicate-rendering-simulation-scripts.md.
// Original code written from that contract only.
//
// CreateEmptyPartition, SICreatePartition, CreatePassWithPartition, GetPass, ConnectImageTo3DO, ShowNextOGLProjection,
// ShowPreviousOGLProjection, CreateCGFX, CreateFX, LaunchFlipbookForPass, ExportMI2File, ExportAllPassesToMI2,
// EditShaderCompoundPPGLogic, and the PPG-logic editor shared with EditICECompoundPPGLogic.
//
// Callees that are not on the bus and are produced here as documented stand-ins: SICreateEmptyPartition,
// MoveToPartition, SICreatePass, SetCurrentPass, SIGetPreset (hook), SIGetShaderOnCnxPoint, CreateMaterial for the
// FX presets, GetShaderCompoundProperties / SetShaderCompoundPropertiesEx (storage on the node).
import { App, type CommandDef } from '../core/commands';
import { Node, X3DObject, Property, Pass, Partition, Framebuffer, Light, Camera, Group, Material, Shader, makeVisibility } from '../core/scene';
import { str } from '../core/params';
import { getSource, currentMaterial, isImageClip, looksLikeImageFile, clipNameForFile, TextureLayer } from '../core/textureLayers';
import { resolveSoftimageResolvedFilename } from '../core/sceneRender';
import {
  stateOf, text, unset, truthy, info, warning, nya, cancel, enumName, trace, busCall, siName, collection, nodeOf, passOf,
  after, modalPage, withRootProperty, interactive, NOTE,
} from './duplicateRenderingSimulationScriptsShared';

type Reg = (def: CommandDef) => void;

// ------------------------------------------------------------------ partitions and passes
/** Properties added to a partition (this build's Partition node has members only). */
export const partitionProperties = (p: Partition): Property[] => ((p as any).properties ??= []);
const isLightPartition = (p: Partition) => (p as any).partitionType === 'siLightPartition';
function uniquePartitionName(pass: Pass, base: string): string {
  const taken = new Set(pass.partitions.map(p => p.name));
  if (!taken.has(base)) return base;
  let i = 1; while (taken.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}
/** Stand-in for the C++ `SICreateEmptyPartition Target, Name, Type, Value`. */
function createEmptyPartition(app: App, target: unknown, name: unknown, type: unknown): Partition {
  trace(app, 'SICreateEmptyPartition', [target, name, type], 'stand-in');
  const pass = passOf(app, target);
  if (!pass) throw new Error(`SICreateEmptyPartition: no pass "${String((target as any)?.name ?? target)}"`);
  const t = enumName(type);
  if (typeof t === 'number') nya(app, 'SICreateEmptyPartition', `numeric partition type ${t} (siPartitionType values are not attested); an object partition is made`);
  const light = t === 'siLightPartition';
  // inferred: an empty name falls back to the callee's default; uniqueness inside the pass is the callee's
  const p = new Partition(uniquePartitionName(pass, unset(name) ? 'Partition' : String(name)));
  (p as any).partitionType = light ? 'siLightPartition' : 'siObjectPartition';
  app.record('Create partition', () => { p.parent = pass as any; pass.partitions.push(p); }, () => { const i = pass.partitions.indexOf(p); if (i >= 0) pass.partitions.splice(i, 1); p.parent = null; });
  return p;
}
/** Stand-in for `MoveToPartition <partition>, <objects>, Target`: membership is exclusive among the pass's partitions. */
function moveToPartition(app: App, part: Partition, items: Node[], target: unknown) {
  trace(app, 'MoveToPartition', [part, items, target], 'stand-in');
  const pass = (part as any).parent as Pass;
  const before = pass.partitions.map(p => [p, [...p.members]] as const);
  app.record('Move to partition', () => { for (const p of pass.partitions) for (const o of items) p.members.delete(o as X3DObject); for (const o of items) part.members.add(o as X3DObject); },
    () => { for (const [p, m] of before) { p.members.clear(); for (const o of m) p.members.add(o); } });
}
function siCreatePartition(app: App, a: Record<string, any>): Partition | undefined {
  // 1. the two lists. An empty InputObjs is the current selection (inferred from the filter command's convention).
  const input = collection(app, a.InputObjs) ?? [];
  const objects = input.filter(n => (n instanceof X3DObject || n instanceof Group) && !(n instanceof Light) && !(n instanceof Camera));
  const lights = input.filter(n => n instanceof Light);
  let last: Partition | undefined;
  if (objects.length) { last = createEmptyPartition(app, a.Target, a.Name, 'siObjectPartition'); moveToPartition(app, last, objects, a.Target); }
  if (lights.length) { last = createEmptyPartition(app, a.Target, a.Name, 'siLightPartition'); moveToPartition(app, last, lights, a.Target); }
  if (!objects.length && !lights.length) last = createEmptyPartition(app, a.Target, a.Name, undefined);
  stateOf(app).out.SICreatePartition = { Value: last };
  app.events.emit('scene');
  return last;   // output argument Value: the last partition created (the light partition when both are made)
}
/** Stand-in for `SICreatePass PresetObj, Name` and `SetCurrentPass`: the newest pass is this build's current pass. */
function createPass(app: App, preset: unknown, name: unknown, keepCurrent = false): Pass {
  trace(app, 'SICreatePass', [preset, name], 'stand-in');
  const presetName = String(preset ?? 'Pass').split(/[\\/]/).pop()!.replace(/\.preset$/i, '') || 'Pass';
  if (presetName !== 'Pass') nya(app, 'SICreatePass', `pass preset "${presetName}": only the default pass is modelled, the preset's partitions and shaders are not applied`);
  const scene = app.scene; const before = (scene as any).currentPass;
  const pass = new Pass(scene.uniqueName(unset(name) ? presetName : String(name)));   // inferred: an empty name gives the preset's name
  app.record('Create pass', () => {
    pass.parent = scene;
    // "the last pass" is this build's current pass: a pass that must not become current goes in front of it
    if (keepCurrent && scene.passes.length) scene.passes.splice(scene.passes.length - 1, 0, pass); else scene.passes.push(pass);
  }, () => { const i = scene.passes.indexOf(pass); if (i >= 0) scene.passes.splice(i, 1); pass.parent = null; (scene as any).currentPass = before; });
  return pass;
}
function setCurrentPass(app: App, pass: Pass) {
  trace(app, 'SetCurrentPass', [pass], 'stand-in');
  const scene = app.scene as any; const before = scene.currentPass; const list = app.scene.passes; const order = [...list];
  // The rest of this build reads "the last pass" as the current one, so the pass is also moved to the end of the list.
  app.record('Set current pass', () => { scene.currentPass = pass; const i = list.indexOf(pass); if (i >= 0 && i !== list.length - 1) { list.splice(i, 1); list.push(pass); } },
    () => { scene.currentPass = before; list.splice(0, list.length, ...order); });
}

// ------------------------------------------------------------------ ConnectImageTo3DO
function connectImageTo3DO(app: App, a: Record<string, any>) {
  const file = String(a.FileName ?? '');
  const objs = collection(app, a.InputObjs) ?? [];
  // 1. image clip (SICreateImageClip is `CreateImageClip` in this build)
  const sel = [...app.selection]; let clip: any = null;
  trace(app, 'SICreateImageClip', [file], 'bus');
  // a name that is not an image file is a clip failure (same test as the texture-layer commands of this build)
  if (looksLikeImageFile(file)) { try { clip = app.run('CreateImageClip', { FileName: file.trim(), Name: clipNameForFile(file) }); } catch { clip = null; } }
  app.selection = sel;
  if (!isImageClip(clip)) { warning(app, `Could not create image clip '${file}'`); return undefined; }
  // 2. blend in one Image layer per default texture port
  const layers: unknown[] = busCall(app, 'BlendInTextureLayers', {
    PresetNames: 'Image', InputObjs: objs, SharedMatAction: 3, NotifyNoResult: true, Mode: ':siBlendInTextureLayers:siBlendInTextureLayersModes',
    Ambient: true, Diffuse: true, Transparency: false, Reflection: false,
  }) ?? [];
  // 3. the shader on <layer>.color takes the clip on its tex port
  const shaders: Shader[] = [];
  for (const layer of layers) {
    if (!(layer instanceof TextureLayer)) continue;
    trace(app, 'SIGetShaderOnCnxPoint', [`${layer.fullName}.color`], 'stand-in');
    const sh = getSource({ owner: layer, name: 'color' });
    if (!(sh instanceof Shader)) continue;
    busCall(app, 'SIConnectShaderToCnxPoint', { Source: clip, InputObjs: [{ owner: sh, name: 'tex' }] }, [clip, `${sh.fullName}.tex`]);
    shaders.push(sh);
  }
  // 4. one InspectObj on the comma-joined list
  if (shaders.length) {
    trace(app, 'InspectObj', [shaders.map(s => s.fullName).join(',')], 'stand-in');   // the bus InspectObj resolves scene objects only
    if (interactive(app)) app.events.emit('inspect', shaders[0]);
  }
  return layers;
}

// ------------------------------------------------------------------ ShowNextOGLProjection / ShowPreviousOGLProjection
const isUvProperty = (p: Property) => p.type === 'uvspace' || p.type === 'uvprojection';   // 'uvprojection' is this build's type name for UV properties
function cycleProjection(app: App, dir: 1 | -1) {
  busCall(app, 'ActivateObjectSelTool', {});
  const objs = app.selection.filter((n): n is X3DObject => n instanceof X3DObject && !!n.primitive && ((n.primitive as any).operators?.length ?? 0) > 0);
  for (const o of objs) {
    const samples = o.clusters.filter(c => c.compKind === 'sample');
    if (!samples.length) continue;
    const mat = currentMaterial(app.scene, o); const uv = mat?.get('UV'); if (!mat || !uv) continue;
    const current = String(uv.value ?? '');
    // the list is restarted for each cluster: in effect that of the last sample cluster carrying UV properties
    let names: string[] = [];
    for (const c of samples) { const found = c.properties.filter(isUvProperty).map(p => p.name.split('.').pop()!); if (found.length) names = found; }
    let next = '';   // inferred: no UV property at all writes an empty name
    if (names.length) {
      const at = Math.max(0, names.indexOf(current));   // inferred: a name that is not in the list counts as the first entry
      next = names[(at + dir + names.length) % names.length];
    }
    app.setParam(uv, next, 'Set UV property');
  }
  return undefined;
}

// ------------------------------------------------------------------ CreateCGFX / CreateFX
function createFxMaterial(app: App, command: 'CreateCGFX' | 'CreateFX', a: Record<string, any>) {
  const file = String(a.FileName ?? '');
  let preset = 'CgFX.preset';
  if (command === 'CreateFX') {
    // 1. scan every line for `technique10`; a file that cannot be opened fails the command (the engine's own error text is not attested)
    const body: string = (app as any).hostFs.readFile(file);
    preset = body.split(/\r?\n/).some(line => line.includes('technique10')) ? 'DX10FX.Preset' : 'DXFX2.Preset';
  }
  // 2. library: this build has one material library, which is also the active one
  const libName = String(a.Library ?? '');
  if (libName && !/^(Sources\.Materials\.)?DefaultLib$/i.test(libName)) info(app, `${command}: no material library named "${libName}", the active library is used`);
  // 3. name: after the last backslash (or forward slash when there is none), cut at the first dot
  const leaf = file.includes('\\') ? file.slice(file.lastIndexOf('\\') + 1) : file.slice(file.lastIndexOf('/') + 1);
  const dot = leaf.indexOf('.');
  if (dot < 0) { nya(app, command, `a file name without a dot ("${leaf}") has no defined result; nothing is created`, 'Q4'); return undefined; }
  const name = leaf.slice(0, dot);
  // 4. material from the preset. The presets' parameters are open (Q4): the shader carries the attested `filename` only.
  trace(app, 'CreateMaterial', [preset, name, libName], 'stand-in');
  const shaderName = preset.replace(/\.preset$/i, '');
  const shader = new Shader(shaderName, shaderName, [str('filename', '', 'filename')]);
  const mat = new Material(app.scene.uniqueName(name || 'Material'));
  mat.setSurface(shader);   // inferred: the realtime shader is shown as the material's first shader
  (mat as any).preset = preset;
  app.record('Create material', () => { app.scene.materials.push(mat); }, () => { const i = app.scene.materials.indexOf(mat); if (i >= 0) app.scene.materials.splice(i, 1); });
  trace(app, 'SetValue', [`${mat.name}.${shader.name}.filename`, file], 'stand-in');
  app.setParam(shader.get('filename')!, file);
  // 5. assignment
  if (!unset(a.Model)) {
    trace(app, 'GetValue', [a.Model], 'stand-in');
    const target = nodeOf(app, a.Model);
    if (!(target instanceof X3DObject)) throw new Error(`${command}: cannot resolve "${String(a.Model)}"`);
    const old = target.material;
    app.record('Assign material', () => target.setMaterial(mat), () => target.setMaterial(old));
  }
  stateOf(app).out[command] = { Material: mat };
  app.events.emit('scene');
  return undefined;
}

// ------------------------------------------------------------------ LaunchFlipbookForPass
const FRAME_SENTINEL = 987654321;
function resolvedPath(app: App, pass: Pass, fb: Framebuffer): string {
  // GetResolvedPath with an empty argument leaves the frame token unresolved. inferred: the token is spelled `[Frame]`.
  const ro = app.scene.renderOptions;
  const full = resolveSoftimageResolvedFilename(String(ro.val('OutputDir') ?? ''), String(fb.val('Filename') ?? ''), FRAME_SENTINEL, 1, String(fb.val('Format') ?? 'pic'), pass.name, fb.name);
  return full.replace(String(FRAME_SENTINEL), '[Frame]');
}
function launchFlipbookForPass(app: App, a: Record<string, any>) {
  const A = app.anim as any;
  let pass: Pass | undefined, fb: Framebuffer | undefined;   // not reset between items, as in the script
  const lines: string[] = [];
  for (const item of collection(app, a.InputObj) ?? []) {
    if (item instanceof Pass) { pass = item; fb = item.framebuffers.find(f => f.name === 'Main'); }
    else if (item instanceof Framebuffer) { fb = item; pass = (item as any).parent as Pass; }
    else { info(app, `${siName(app, item)} is not a pass or a framebuffer`); if (!pass || !fb) continue; }
    if (!pass || !fb) continue;
    const src: Node = Number(pass.val('FrameRangeSource')) === 3 ? app.scene.renderOptions : pass;
    const mode = Number(src.val('FrameRangeSource'));
    let start: number, end: number, step: number;
    if (mode === 1) { info(app, `${src === pass ? pass.name : 'RenderOptions'} is set to use frame set as frame range. Flipbook needs a sequence.`); continue; }
    if (mode === 2) { start = A.startFrame; end = A.endFrame; step = Number(A.step ?? 1); }
    else { start = Number(src.val('FrameStart')); end = Number(src.val('FrameEnd')); step = Number(src.val('FrameStep')); }
    const line = `-m -s "${resolvedPath(app, pass, fb)}" ${start} ${end} ${step} ${A.fps}`;
    lines.push(line);
    // The bus Flipbook command takes no command line: it opens the viewer. It is run in an interactive session only.
    trace(app, 'Flipbook', [line], interactive(app) && app.commands.has('Flipbook') ? 'bus' : 'stand-in');
    if (interactive(app) && app.commands.has('Flipbook')) app.run('Flipbook', {});
  }
  stateOf(app).out.LaunchFlipbookForPass = { commandLines: lines };
  return undefined;
}

// ------------------------------------------------------------------ ExportMI2File
const supplied = (v: unknown) => !unset(v) && !(typeof v === 'number' && Number.isNaN(v));
const isMentalRay = (v: unknown) => String(v ?? '').trim().toLowerCase() === 'mental ray';
function exportMI2File(app: App, a: Record<string, any>) {
  const input = collection(app, a.InputObjs) ?? [];
  if (!input.length) return undefined;
  const globalRenderer = app.scene.renderOptions.val('Renderer');
  const passes = input.filter((n): n is Pass => n instanceof Pass && (isMentalRay(n.val('Renderer')) || (String(n.val('Renderer') ?? '') === '' && isMentalRay(globalRenderer))));
  if (!passes.length) return undefined;
  const saved: [{ value: any }, any][] = [];
  const override = (set: Node | Property, name: string, value: any, kind: 'string' | 'bool') => {
    let p = set.params.find(q => q.name.toLowerCase() === name.toLowerCase());
    // inferred: this build's Pass has no archive parameters of its own; the parameter is added on first use
    if (!p) p = set.add(kind === 'string' ? str(name, '', name) : { name, type: 'bool', value: false, label: name });
    saved.push([p, p.value]); p.value = value;
  };
  const ascii = truthy(a.AsciiOutput);
  for (const pass of passes) {
    if (supplied(a.FileName)) override(pass, 'ArchiveFilename', String(a.FileName).replace(/\.mi2$/i, ''), 'string');
    if (supplied(a.ApproximatePolygons)) override(pass.mentalray, 'ArchiveApproximatePolygons', ascii, 'bool');   // the AsciiOutput value, as shipped
    if (supplied(a.ApproximateFaces)) override(pass.mentalray, 'ArchiveApproximateNURBS', ascii, 'bool');         // the AsciiOutput value, as shipped
    if (supplied(a.AsciiOutput)) override(pass.mentalray, 'ArchiveAsciiOutput', ascii, 'bool');
    if (supplied(a.VerbatimTextures)) override(pass.mentalray, 'ArchiveEmbedTextures', truthy(a.VerbatimTextures), 'bool');
    if (supplied(a.Incremental)) override(pass, 'ArchiveMultiFrame', truthy(a.Incremental), 'bool');
  }
  stateOf(app).out.ExportMI2File = { overridden: saved.map(([p]) => [(p as any).fullName, p.value]) };
  let error: unknown = null;
  const num = (v: unknown) => (supplied(v) ? Number(v) : null);
  try { busCall(app, 'ExportRenderArchive', { Passes: passes.map(p => p.name).join(','), StartFrame: num(a.StartFrame), EndFrame: num(a.EndFrame), StepFrame: num(a.StepFrame) }, [passes, num(a.StartFrame), num(a.EndFrame), num(a.StepFrame)]); }
  catch (e) { error = e; nya(app, 'ExportMI2File', 'the export failed; the overridden pass parameters are restored here, whether the script does so is open', 'Q5'); }
  for (const [p, v] of saved.reverse()) p.value = v;
  if (error) throw error;
  return undefined;
}

// ------------------------------------------------------------------ PPG logic editors (shader and ICE compounds)
export interface LogicEditorSpec {
  command: string; getter: string; setter: string; minLength: number; logicIndex: number; languageIndex: number; propName: string; titleId: number;
  /** Arguments of the write-back call: named, or positional in the contract's order. */
  setterArgs(node: Node, values: unknown[], logic: string, language: string): { named?: Record<string, unknown>; positional?: unknown[] };
}
/** inferred storage for a compound's property array while the C++ getters / setters are not on the bus. */
export const compoundProperties = (n: Node): unknown[] | undefined => (n as any).compoundProperties;
export function editCompoundLogic(app: App, spec: LogicEditorSpec, input: unknown) {
  const st = stateOf(app); const cmd = spec.command;
  const node = (collection(app, input) ?? [])[0];
  const done = (result: boolean) => { st.out[cmd] = { result }; return undefined; };   // the registry declares no return value
  // 1. current values
  let values: unknown[] = [];
  if (node) {
    if (app.commands.has(spec.getter)) { const r = busCall(app, spec.getter, { InputObj: node }); values = Array.isArray(r) ? r : []; }
    else {
      trace(app, spec.getter, [node], 'stand-in');
      values = compoundProperties(node) ?? [];
      if (!compoundProperties(node)) nya(app, cmd, `${spec.getter} is not on the bus and ${siName(app, node)} carries no compound property array`, 'Q11');
    }
  }
  if (values.length < spec.minLength) return done(false);
  const language = String(values[spec.languageIndex] ?? '') || 'VBScript';
  // 2. temporary property
  const prop = new Property(spec.propName, 'customparamset', [str('Language', language, 'Language'), str('Logic', String(values[spec.logicIndex] ?? ''), 'Logic')]);
  const remove = withRootProperty(app, prop);
  // 3. layout: a language combo and a text editor; the page logic keeps the editor's syntax language on the Language value
  const build = (body: HTMLElement) => {
    const group = (title: string) => { const g = document.createElement('fieldset'); g.className = 'sdkh-group'; g.dataset.group = title; const l = document.createElement('legend'); l.textContent = title; g.appendChild(l); body.appendChild(g); return g; };
    const combo = document.createElement('select'); combo.className = 'drs-logic-language';
    for (const v of ['VBScript', 'JScript', 'Python']) { const o = document.createElement('option'); o.value = v; o.textContent = v; combo.appendChild(o); }
    combo.value = language;
    const editor = document.createElement('textarea'); editor.className = 'drs-logic-editor'; editor.value = String(prop.val('Logic') ?? ''); editor.spellcheck = false;
    editor.style.cssText = 'box-sizing:border-box;width:600px;height:600px;max-width:100%;max-height:60vh;font-family:Tahoma,sans-serif;resize:none';
    // attested editor attributes; a plain text area cannot show all of them
    Object.assign(editor.dataset, { lineNumbering: '1', marginWidth: '6', folding: '1', font: 'Tahoma', commentFont: 'Comic Sans MS', preprocessorColor: '128', commentColor: '32768', language });
    combo.onchange = () => { prop.set('Language', combo.value); editor.dataset.language = combo.value; };
    editor.oninput = () => { prop.set('Logic', editor.value); };
    group('Scripting Language').appendChild(combo); group('Logic').appendChild(editor);
  };
  // 4. modal page
  let ok: boolean | Promise<boolean>;
  try { ok = modalPage(app, cmd, text(spec.titleId), prop, build); } catch (e) { remove(); throw e; }
  return after(ok, (okay) => {
    try {
      if (!okay) return done(false);
      // 5. write back
      const logic = String(prop.val('Logic') ?? ''), lang = String(prop.val('Language') ?? '');
      const args = spec.setterArgs(node, values, logic, lang);
      const shown = args.positional ?? Object.values(args.named ?? {});
      if (app.commands.has(spec.setter)) { trace(app, spec.setter, shown, 'bus'); if (args.positional) app.ExecuteCommand(spec.setter, args.positional); else app.run(spec.setter, args.named as Record<string, any>); }
      else {
        trace(app, spec.setter, shown, 'stand-in');
        const store = compoundProperties(node);
        if (store) { store[spec.logicIndex] = logic; store[spec.languageIndex] = lang; }
      }
      return done(true);
    } finally { remove(); }   // 6. DeleteObj in both cases
  });
}
const SHADER_LOGIC: LogicEditorSpec = {
  command: 'EditShaderCompoundPPGLogic', getter: 'GetShaderCompoundProperties', setter: 'SetShaderCompoundPropertiesEx', minLength: 10, logicIndex: 8, languageIndex: 9,
  propName: 'Shader Compound PPG Logic', titleId: 1177,
  // ModifyFlags 768 = 0x300; only PPGLogic and PPGLogicLanguage are supplied
  setterArgs: (node, _values, logic, language) => ({ named: { InputObj: node, ModifyFlags: 768, PPGLogic: logic, PPGLogicLanguage: language } }),
};

// ------------------------------------------------------------------ registration
export function registerRenderingScriptCommands(app: App, reg: Reg) {
  const CAT = 'Rendering';
  reg({
    name: 'CreateEmptyPartition', label: 'Create Empty Partition', category: CAT, description: 'Create a new empty partition of specified type and inspect it',
    args: [{ name: 'Target', default: 'Passes.Current' }, { name: 'Name', default: 'Partition' }, { name: 'Type', default: ':siObjectPartition:siPartitionType' }, { name: 'Value', default: null }],
    execute(app, a) {
      const part = createEmptyPartition(app, a.Target, a.Name, a.Type);
      stateOf(app).out.CreateEmptyPartition = { Value: part };
      trace(app, 'SelectObj', [part], 'stand-in'); app.select([part]);   // the bus SelectObj resolves scene objects only
      trace(app, 'AutoInspect', [part], 'stand-in'); if (app.autoInspect && interactive(app)) app.events.emit('inspect', part);
      app.events.emit('scene');
      return part;
    },
  });
  reg({
    name: 'SICreatePartition', label: 'New Partition', category: CAT, description: 'Create a new object and/or light partition and add the specified objects',
    args: [{ name: 'Target', default: '' }, { name: 'Name', default: 'Partition' }, { name: 'InputObjs', default: '' }, { name: 'Value', default: null }],
    execute: (app, a) => siCreatePartition(app, a),
  });
  reg({
    name: 'CreatePassWithPartition', label: 'New Pass with Partition', category: CAT, description: 'Create a new pass and set visibility on background partition',
    args: [{ name: 'PresetObj', default: 'Pass' }, { name: 'Name', default: '' }, { name: 'ParamName', default: '' }, { name: 'InputObjs', default: null }, { name: 'Value', default: null }],
    execute(app, a) {
      const objs = collection(app, a.InputObjs) ?? [];   // resolved before the selection changes
      const pass = createPass(app, a.PresetObj, a.Name);
      stateOf(app).out.CreatePassWithPartition = { Value: pass };
      setCurrentPass(app, pass);
      // An empty InputObjs would make SICreatePartition read the selection again, which is the same list at this point.
      busCall(app, 'SICreatePartition', { Target: '', Name: a.ParamName, InputObjs: objs.length ? objs : '' }, [undefined, a.ParamName, objs]);
      const background = pass.partitions.find(p => p.name === 'Background_Objects_Partition')!;
      trace(app, 'SelectObj', [`${pass.name}.Partitions.Background_Objects_Partition`], 'stand-in'); app.select([background]);
      trace(app, 'AddProp', ['Visibility'], 'stand-in');   // the bus AddProp resolves scene objects only
      const vis = makeVisibility(); const props = partitionProperties(background);
      app.record('Add property', () => { vis.parent = background; props.push(vis); }, () => { const i = props.indexOf(vis); if (i >= 0) props.splice(i, 1); vis.parent = null; });
      app.select([background]); app.events.emit('scene');
      return pass;
    },
  });
  reg({
    name: 'GetPass', label: 'More Passes...', category: CAT, description: 'Browse for passes',
    args: [{ name: 'PresetObj', default: '' }, { name: 'Name', default: '' }],
    execute(app, a) {
      trace(app, 'SIGetPreset', ['', 'siPassFamily'], 'stand-in');
      const browse = stateOf(app).browsePreset;
      if (!browse) nya(app, 'GetPass', 'the preset browser is not available in this build (set app.duplicateRenderingSimulationScripts.browsePreset to answer it); nothing is chosen');
      const chosen = browse ? browse('siPassFamily', '') : null;
      if (unset(chosen)) return cancel('GetPass');
      stateOf(app).out.GetPass = { PresetObj: chosen };
      createPass(app, chosen, a.Name, true);   // no current-pass change
      app.events.emit('scene');
      return undefined;
    },
  });
  reg({
    name: 'ConnectImageTo3DO', label: 'Blend in image Preset and create the image clip to Default Texture Ports',
    description: 'Connect image presets through blenders to all the default texture ports of several objects, inspect',
    args: [{ name: 'InputObjs', default: null }, { name: 'FileName', default: '' }], execute: (app, a) => connectImageTo3DO(app, a),
  });
  reg({ name: 'ShowNextOGLProjection', label: 'Show Next OGL Projection', category: 'Viewing', args: [], execute: (app) => cycleProjection(app, 1) });
  reg({ name: 'ShowPreviousOGLProjection', label: 'Show Previous OGL Projection', category: 'Viewing', args: [], execute: (app) => cycleProjection(app, -1) });
  const FX_ARGS = [{ name: 'FileName', default: '' }, { name: 'Library', default: '' }, { name: 'Model', default: '' }];
  reg({ name: 'CreateCGFX', label: 'Creates a CGFX material', category: 'File', description: 'Imports a .cgfx file in the current scene', args: FX_ARGS, execute: (app, a) => createFxMaterial(app, 'CreateCGFX', a) });
  reg({ name: 'CreateFX', label: 'Creates an FX material', category: 'File', description: 'Imports an .fx file in the current scene', args: FX_ARGS, execute: (app, a) => createFxMaterial(app, 'CreateFX', a) });
  reg({
    name: 'LaunchFlipbookForPass', label: 'Launch Flipbook For Pass', category: 'File|Rendering', description: 'Automatic Set Render File Paths',
    args: [{ name: 'InputObj', default: null }], undoable: false, execute: (app, a) => launchFlipbookForPass(app, a),
  });
  reg({
    name: 'ExportMI2File', label: 'Export To MI2 File', category: 'File|Rendering', description: 'Export current scene to mi2 file', undoable: false,
    args: ['InputObjs', 'PresetObj', 'StartFrame', 'EndFrame', 'StepFrame'].map(name => ({ name, default: null }))
      .concat([{ name: 'FileName', default: '' as any }], ['ApproximatePolygons', 'ApproximateFaces', 'AsciiOutput', 'VerbatimTextures', 'MultipleFiles', 'Incremental'].map(name => ({ name, default: null }))),
    execute: (app, a) => exportMI2File(app, a),
  });
  reg({
    name: 'ExportAllPassesToMI2', label: 'Export All Passes To MI2', category: CAT, description: 'Export all passes to MI2 files',
    args: [{ name: 'PassCentric', default: true }], undoable: false,
    // SPEC-PARTIAL: a stale registration. The handler procedure does not exist in the shipped scripts, so invoking the
    // command can only fail at handler lookup (inferred; the exact error text is open, Q6).
    execute() { throw new Error(`handler ExportAllPassesToMI2Proc not found in Rendering.vbs (stale registration; error text not yet attested, ${NOTE} Q6)`); },
  });
  reg({
    name: 'EditShaderCompoundPPGLogic', label: 'EditShaderCompoundPPGLogic', category: CAT, description: 'Edit Shader Compound PPG Logic with a modal text editor.',
    args: [{ name: 'InputObj', default: null }], execute: (app, a) => editCompoundLogic(app, SHADER_LOGIC, a.InputObj),
  });
}
