// Ledger row CMD-B15f: remaining script-implemented commands. Brief: docs/ghidra/cmd-b15f-misc-scripts.md ("Wire contract"
// of each command) and docs/re/WIRE_CORRECTIONS_B15.md items 38-39. Original TypeScript written from that prose only.
//
//   wizards (miscScriptsB15fWizards.ts): CreateCommandWizard GenerateCommandPlugin AddCommandToPlugin CreatePluginWizard
//     SIGeneratePlugin CreateToolbarWizard SIGenerateToolbar CreateTemplateWizard CreateMRShaderWizard (SPEC-PARTIAL)
//   here: GenerateLipSync UpgradeShaders "Get default camera" "OBJ Import..." "Save Zero Key Hot Key" (SPEC-PARTIAL)
//     GenNormalMap GenDiffuseMap (SPEC-PARTIAL: script not shipped)
//   already on the bus from earlier rows, names now literal: CreateInspectParticleTypeSphere / Blob / Billboard
//     (particleScripts.ts), syCachePaint1 / syCachePaint2 / SyGetMassMap / SyGetSpringMap (syflexScripts.ts); their
//     behaviour already matches the contract (create + inspect a particle type; select the Syflex weight map, no paint
//     tool, nothing returned).
//
// Mapping onto this build:
//  * GenerateLipSync calls the mixer / speech commands of other rows through the bus; a callee that is missing (or only
//    a placeholder registration) makes that phase fail with the phase's message, after a "not yet attested" log.
//  * UpgradeShaders: shader nodes here carry no CLSID; a node is obsolete when its `clsid` field (set by a loader or a
//    script) starts with one of the tabled CLSID prefixes (the note gives only the first group of most of them).
//    Replacement presets that this build has as SPDL shaders are built from it; the others are bare shader nodes holding
//    the tabled destination ports. Port animation (FCurves) is moved with the value.
import { App } from '../core/commands';
import { Node, X3DObject, Model, Null, Shader, Material, makeSiShader, Property } from '../core/scene';
import { num, int, bool, color, type Parameter } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { siString } from '../ui/si';
import { addonDocWizardState } from './addonDocWizard';
import { startPickSession } from './miscDsScriptsPick';
import { registerB15fWizardCommands, b15fState, interactive, logNya } from './miscScriptsB15fWizards';

const CUSTOM_LITERALS = [
  // names this row closes that earlier rows register (kept literal so the static scan sees them)
  'CreateInspectParticleTypeSphere', 'CreateInspectParticleTypeBlob', 'CreateInspectParticleTypeBillboard',
  'syCachePaint1', 'syCachePaint2', 'SyGetMassMap', 'SyGetSpringMap',
];

// ------------------------------------------------------------------ helpers
type DictName = 'XSIMSGCAT' | 'XSISCRIPTS' | 'XSIACTION2';
const msg = (dict: DictName, id: number, fallback: string) => (siString as any)(dict, id) ?? fallback;
const unset = (v: any) => v === undefined || v === null || v === '';
function raise(app: App, command: string, text: string): never {
  app.logMsg('error', `${command}: ${text}`);
  throw new Error(`${command}: ${text}`);
}
function listOf(app: App, v: any): any[] {
  if (unset(v)) return [];
  if (Array.isArray(v)) return v.flatMap(x => listOf(app, x));
  if (v instanceof Node) return [v];
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean).map(s => app.scene.find(s) ?? s);
  return [v];
}
/** A bus call; `done` false (after a log) when the command is missing or only a placeholder of another row. */
function call(app: App, by: string, name: string, positional: any[]): { done: boolean; result?: any } {
  const def = app.commands.get(name);
  if (!def) { logNya(app, by, `the command ${name} is not on the bus in this build`); return { done: false }; }
  const r = app.ExecuteCommand(name, positional);
  if (r && typeof r === 'object' && (r as any).command === name && 'args' in r) { logNya(app, by, `${name} is only a placeholder registration in this build`); return { done: false }; }
  return { done: true, result: r };
}
const descendants = (o: X3DObject): X3DObject[] => [...(o.descendants?.() ?? [])];

// ------------------------------------------------------------------ GenerateLipSync (note 3.11)
const LIPSYNC_TOKENS = ['SH_CH', 'UW_U', '_S_', 'RRR', 'UH_OO', 'MPB', 'AO_a', 'LLL', 'KG', 'TD_I', 'H_EST', 'FV', 'AE_AA'];
const RES_MESH: [string, string][] = [['h', 'H_DDS_HighRes'], ['m', 'H_DDS_MidRes'], ['l', 'H_DDS_LowRes'], ['c', 'H_DDS_CrowdRes']];

function generateLipSync(app: App, a: Record<string, any>): any {
  const C = 'GenerateLipSync';
  const ui = interactive(app) && !b15fState(app).lipSyncBatch;
  const items = listOf(app, a.InputObjs);
  const model = items.find(x => x instanceof Model) as Model | undefined;
  const cancelled = () => { app.logMsg('info', `WARNING : ${msg('XSISCRIPTS', 1520, 'Command cancelled.')}`); return undefined; };
  const invalid = (v: any) => raise(app, C, `${msg('XSIMSGCAT', 1020, 'Invalid argument')} "${v}"`);
  if (!ui) {
    if (!items.length || !(items[0] instanceof Model)) invalid(a.InputObjs);
    if (unset(a.AudioFileName) || !hostFs.isFile(a.AudioFileName)) invalid(a.AudioFileName);
    return lipSyncBody(app, a, items[0] as Model, String(a.AudioFileName));
  }
  const withAudio = (m: Model) => {
    let audio = String(a.AudioFileName ?? '');
    if (audio === '') {
      const dir = `${addonDocWizardState.factoryPath}\\FaceRobot\\Data\\FaceRobot\\Audio`;
      const hook = b15fState(app).hooks.browse;
      const got = hook ? hook(C, 'Select a file', dir, 'Wav Files (*.wav)') : undefined;
      if (got === undefined) logNya(app, C, 'the audio file browser without a browse hook; treated as Cancel');
      if (!got) return cancelled();
      audio = String(got);
    }
    if (!hostFs.isFile(audio)) raise(app, C, `${msg('XSIMSGCAT', 23, 'File not found')} ${audio}`);
    return lipSyncBody(app, a, m, audio);
  };
  if (model) return withAudio(model);
  // pick session "Select Model"
  let picked = false;
  const session = startPickSession(app, {
    command: C, kind: 'element', filter: 'Model', prompt: 'Select Model',   // the XSISCENEEXPLORER translation of "Select Model"
    fromClick: (_p: any, pick: any) => pick?.obj ?? null,
    onEnd: () => { if (!picked) cancelled(); },   // right button / Escape: not the left button
    onPick: (value: any, button: number) => {
      picked = true;
      if (button !== 1) { cancelled(); return false; }
      if (!(value instanceof Model)) { try { raise(app, C, msg('XSIMSGCAT', 28, 'The selected object is not a model')); } catch { /* reported */ } return false; }
      try { b15fState(app).lastLipSync = withAudio(value); } catch { /* reported */ }
      return false;
    },
  } as any);
  if (!session) return cancelled();
  return undefined;
}

function lipSyncBody(app: App, a: Record<string, any>, model: Model, audio: string): any {
  const C = 'GenerateLipSync'; const fs = hostFs;
  const notFound = (p: string) => raise(app, C, `${msg('XSIMSGCAT', 23, 'File not found')} ${p}`);
  const invalid = (v: any) => raise(app, C, `${msg('XSIMSGCAT', 1020, 'Invalid argument')} "${v}"`);
  const textFile = String(a.TextFileName ?? '');
  if (textFile !== '' && !fs.isFile(textFile)) notFound(textFile);
  let mapping = String(a.MappingProfilePath ?? '');
  if (mapping === '') mapping = `${addonDocWizardState.factoryPath}\\Application\\rsrc\\DefaultPhonVisMapping.xml`;
  if (!fs.isFile(mapping)) notFound(mapping);
  let lang = a.Language === undefined || a.Language === null ? 'en' : a.Language;
  if (typeof lang !== 'string') invalid(lang);
  lang = lang.toLowerCase(); if (lang !== 'en' && lang !== 'jp') invalid(lang);
  let res = a.Resolutions === undefined || a.Resolutions === null ? 'hmlc' : a.Resolutions;
  if (typeof res !== 'string') invalid(res);
  res = res.toLowerCase(); if (!/[hmlc]/.test(res)) invalid(res);
  let compact = '';
  const under = descendants(model);
  for (const [letter, mesh] of RES_MESH) {
    if (!res.includes(letter)) continue;
    if (under.some(o => o.name === mesh)) compact += letter;
    else app.logMsg('info', `WARNING : ${msg('XSIACTION2', 1091, 'Face mesh resolution not found')} ${mesh}`);
  }
  // base shape clips: the first clip of each clip container whose name carries a viseme token and a resolution letter
  const mixer = model.property('mixer') as any;
  const clips: string[] = [];
  for (const comp of (mixer?.compounds ?? []) as { clips: string[] }[]) {
    const first = comp.clips?.[0]; if (!first) continue;
    const tok = first.split('_')[0];
    if (LIPSYNC_TOKENS.some(t => first.includes(t)) && tok.length === 1 && compact.includes(tok)) clips.push(first);
  }
  const vis = call(app, C, 'SetupEvolverVisemes', [model, clips, mapping]);
  const keys: any[] = vis.done ? (vis.result?.KeyList ?? []) : [];
  if (!keys.length) raise(app, C, `${msg('XSIACTION2', 1091, 'Face mesh resolution not found')} ${a.Resolutions ?? 'hmlc'}`);
  const action = `EvolverSpeechAction_${compact}`;
  // audio source and tracks
  const src = call(app, C, 'ImportAudio', [model, audio]);
  if (!src.done || !src.result) raise(app, C, msg('XSIACTION2', 1088, 'Audio import failed'));
  const speechTrack = call(app, C, 'AddTrack', [model, null, 0, 'Phoneme_Speech']).result;
  const audioTrack = call(app, C, 'AddTrack', [model, null, 2, 'Phoneme_Audio']).result;
  for (const [t, k] of [[speechTrack, 'Phoneme,Speech'], [audioTrack, 'Phoneme,Audio']] as const) if (t && typeof t === 'object') (t as any).keywords = k;
  const aclip = call(app, C, 'AddAudioClip', [model, src.result, null, audioTrack, 0]).result;
  const tc = (k: string) => Number((aclip as any)?.val?.(`timectrl.${k}`) ?? (aclip as any)?.[k] ?? NaN);
  const start = Math.round(tc('startoffset')) || 0;
  const clipIn = (Number.isFinite(tc('clipin')) ? tc('clipin') : 0) + start; const clipOut = (Number.isFinite(tc('clipout')) ? tc('clipout') : 0) + start;
  if (!Number.isFinite(tc('clipin'))) logNya(app, C, 'the audio clip time control (clip-in / clip-out) of this build\'s audio clip; 0 is used');
  const anim = app.anim as any; const oldIn = anim.startFrame, oldOut = anim.endFrame;
  app.record('PlayControl', () => { anim.endFrame = clipOut; anim.startFrame = clipIn - 1; }, () => { anim.startFrame = oldIn; anim.endFrame = oldOut; });
  const sp = call(app, C, 'CreateEvolverSpeechAction', [model, action, keys]);
  if (!sp.done || !sp.result) {
    for (const t of [speechTrack, audioTrack, src.result]) if (t instanceof Node) call(app, C, 'DeleteObj', [t]);
    raise(app, C, msg('XSIACTION2', 1089, 'Speech action creation failed'));
  }
  const sclip = call(app, C, 'AddClip', [model, sp.result, null, speechTrack, 0]).result;
  if (sclip && typeof sclip === 'object') { (sclip as any).clipin = clipIn; (sclip as any).clipout = clipOut; }
  const guide = textFile !== '' && fs.isFile(textFile) ? fs.readFile(textFile).replace(/;/g, ' ') : '';
  const ex = call(app, C, lang === 'jp' ? 'ExtractPhonemesToSpeechOpJapanese' : 'ExtractPhonemesToSpeechOp', [sclip, audio, guide, 0, 10]);
  const rel = ex.done ? call(app, C, 'AddClipRelation', [sclip, aclip]) : { done: false };
  if (!ex.done || !rel.done) {
    for (const t of [sp.result, speechTrack, audioTrack, src.result]) if (t instanceof Node) call(app, C, 'DeleteObj', [t]);
    raise(app, C, msg('XSIACTION2', 1090, 'Phoneme recognition failed'));
  }
  return sclip;
}

// ------------------------------------------------------------------ UpgradeShaders (note 3.12)
type Port = [string, string];
interface Upgrade { name: string; clsid: string; preset: string; ports: Port[]; fixed?: Record<string, any>; special?: 'mix8' | 'mixcolor' | 'scalarmix' | 'xcolor' | 'hair' }
const UPGRADES: Upgrade[] = [
  { name: 'sib_color_mix8', clsid: '{7C4301B1-42E0-11D3-811D-00A0C983039A}', preset: 'Mixers\\Mix_8colors', special: 'mix8',
    ports: [['base_color', 'base_color'], ...[1, 2, 3, 4, 5, 6, 7].flatMap(i => [[`mode${i}`, `mode${i}`], [`color${i}`, `color${i}`], [`weight${i}`, `weight${i}`], [`alpha${i}`, `alpha${i}`]] as Port[])] },
  { name: 'sib_color_mix_color', clsid: '{86C2DE3E-BCFA-11D1-90E9-0000F804EB21}', preset: 'Mixers\\Mix_2colors', special: 'mixcolor', ports: [['color1', 'base_color'], ['color2', 'color1'], ['mix', 'weight1']], fixed: { alpha1: false, mode1: 1 } },
  { name: 'sib_scalar_mix_color', clsid: '{86EB6638', preset: 'Mixers\\Mix_2colors', special: 'scalarmix', ports: [['color1', 'base_color'], ['color2', 'color1'], ['mix', 'weight1']], fixed: { alpha1: false, mode1: 1 } },
  { name: 'sib_color_invert', clsid: '{87AEE70C', preset: 'Image_Processing\\Invert', ports: [['input', 'input'], ['alpha', 'alpha']] },
  { name: 'sib_scalar_invert', clsid: '{875B74BE', preset: 'Math\\Scalar_Invert', ports: [['input', 'input']] },
  { name: 'sib_color_bias', clsid: '{876C2534', preset: 'Math\\Color_Math_Exponent', ports: [['input', 'input'], ['bias', 'factor'], ['alpha', 'alpha']], fixed: { op: 2 } },
  { name: 'sib_scalar_bias', clsid: '{8725CFD5', preset: 'Math\\Scalar_Math_Exponent', ports: [['input', 'input'], ['bias', 'factor']], fixed: { op: 2 } },
  { name: 'sib_color_gain', clsid: '{878EB74D', preset: 'Math\\Color_Math_Exponent', ports: [['input', 'input'], ['gain', 'factor'], ['alpha', 'alpha']], fixed: { op: 3 } },
  { name: 'sib_scalar_gain', clsid: '{87426C0D', preset: 'Math\\Scalar_Math_Exponent', ports: [['input', 'input'], ['gain', 'factor']], fixed: { op: 3 } },
  { name: 'sib_color_X_color', clsid: '{8645B2C9', preset: 'Math\\Color_Math_Basic', special: 'xcolor', ports: [['color1', 'input1'], ['color2', 'input2']], fixed: { op: 2 } },
  { name: 'sib_color_X_scalar', clsid: '{862451DD', preset: 'Math\\Color_Math_Basic', ports: [['color', 'input1'], ['scalar', 'input2'], ['alpha', 'alpha']], fixed: { op: 2 } },
  { name: 'sib_color_to_boolean', clsid: '{22C05651-FEAE-11D1-8A0D-00A0C9892542}', preset: 'Math\\Color_Math_Logic', ports: [['input', 'input1'], ['threshold', 'input2'], ['alpha', 'alpha']], fixed: { op: 2 } },
  { name: 'sib_scalar_to_boolean', clsid: '{22C05658', preset: 'Math\\Scalar_Math_Logic', ports: [['input', 'input1'], ['threshold', 'input2']], fixed: { op: 2 } },
  { name: 'sib_color_switch_opp', clsid: '{85E2C132', preset: 'Switch\\Boolean_switch', ports: [['input1', 'input2'], ['input2', 'input1'], ['switch', 'switch']] },
  { name: 'sib_color_add_clipping', clsid: '{491EEA85-AA7D-11D2-AFD4-00A024191B9D}', preset: 'Mixers\\Mix_2colors', ports: [['input1', 'base_color'], ['input2', 'color1']], fixed: { weight1: [1, 1, 1, 1], alpha1: false, mode1: 0 } },
  { name: 'sib_render_hair', clsid: '{1F51ED00-474B-4860-9428-447E9D4BFB74}', preset: 'Hair_Renderer', special: 'hair',
    ports: [['diffuse_root', 'DiffuseRoot'], ['diffuse_tip1', 'DiffuseTipA'], ['diffuse_tip2', 'DiffuseTipB'], ['diffuse_balance', 'TipBalance'], ['diffuse_crossover_point', 'DiffuseCrossoverCenter'],
      ['diffuse_crossover_range', 'DiffuseCrossoverRange'], ['color_varation', 'DiffuseVariation'], ['specular_inuse', 'specular_inuse'], ['specular', 'specular'], ['specular_decay', 'specular_decay'],
      ['transparency_inuse', 'transparency_inuse'], ['transparency_root', 'transparency_root'], ['transparency_tip', 'transparency_tip'], ['transparency_crossover_point', 'transparency_crossover_center'],
      ['transparency_crossover_range', 'transparency_crossover_range'], ['radiance', 'Irradiance']] },
];
/** Presets this build has as SPDL shaders (key of src/data/si/shaders.json). */
const PRESET_SPDL: Record<string, string> = { 'Image_Processing\\Invert': 'sib_color_invert', 'Math\\Color_Math_Basic': 'sib_color_math_basic', 'Mixers\\Mix_2colors': 'sib_color_2mix' };

type Owner = { kind: 'shader'; node: Shader; port: string } | { kind: 'material'; node: Material; port: string };
function allShaders(app: App): { shader: Shader; owners: Owner[] }[] {
  const map = new Map<Shader, Owner[]>();
  const walk = (s: Shader) => { if (!map.has(s)) map.set(s, []); for (const [port, c] of s.inputs) { const fresh = !map.has(c); if (fresh) map.set(c, []); map.get(c)!.push({ kind: 'shader', node: s, port }); if (fresh) walk(c); } };
  const mats = new Set<Material>(app.scene.materials);
  for (const o of app.scene.allObjects()) if (o.material) mats.add(o.material);
  for (const m of mats) if (m.surface) { walk(m.surface); map.get(m.surface)!.push({ kind: 'material', node: m, port: 'surface' }); }
  return [...map].map(([shader, owners]) => ({ shader, owners }));
}
const ptype = (p: Parameter | undefined): string => {
  if (!p) return '';
  const t = String((p.def as any).type ?? '');
  if (t === 'color' || Array.isArray(p.value)) return 'color';
  if (t === 'bool' || typeof p.value === 'boolean') return 'boolean';
  if (t === 'int' || t === 'enum') return 'integer';
  if (t === 'double' || t === 'float' || t === 'number' || typeof p.value === 'number') return 'scalar';
  return '';
};
function defFor(name: string, type: string, value: any) {
  if (type === 'color') return color(name, Array.isArray(value) ? value.slice(0, 3) as any : [0, 0, 0], name);
  if (type === 'boolean') return bool(name, !!value, name);
  if (type === 'integer') return int(name, Number(value) || 0, name);
  return num(name, Number(value) || 0, name);
}
function makeReplacement(app: App, up: Upgrade, old: Shader): Shader | null {
  const key = PRESET_SPDL[up.preset];
  if (key) { const s = makeSiShader(key, old.name); if (s) return s; app.logMsg('info', `WARNING : FCreateShader: could not create object from preset ${up.preset}`); return null; }
  // bare node: the destination ports carry the source types (the preset's own parameter set is not in this build)
  const defs: any[] = []; const seen = new Set<string>();
  for (const [src, dst] of up.ports) { if (seen.has(dst)) continue; seen.add(dst); const p = old.get(src); defs.push(defFor(dst, ptype(p) || 'scalar', p?.value)); }
  for (const [k, v] of Object.entries(up.fixed ?? {})) if (!seen.has(k)) { seen.add(k); defs.push(defFor(k, Array.isArray(v) ? 'color' : typeof v === 'boolean' ? 'boolean' : 'integer', v)); }
  if (up.special === 'mix8') for (let i = 1; i <= 7; i++) defs.push(bool(`inuse${i}`, false, `inuse${i}`));
  const s = new Shader(old.name, up.preset.split('\\').pop()!, defs);
  (s as any).presetPath = up.preset;
  return s;
}
function bareShader(type: string, ports: [string, string, any][]): Shader { return new Shader(type, type, ports.map(([n, t, v]) => defFor(n, t, v))); }

/** Move one port: value + animation, or the connected shader (with a converter when the types differ). */
function transferPort(app: App, from: Shader, src: string, to: Shader, dst: string): boolean {
  const sp = from.get(src);
  if (!sp) return true;   // nothing to carry (port absent on this node)
  let dp = to.get(dst);
  const st = ptype(sp);
  if (!dp) { dp = to.add(defFor(dst, st, sp.value)); }
  const dt = ptype(dp);
  if (!st || !dt) { app.logMsg('info', `WARNING : Cannot transfer ${from.name}.${src} to ${to.name}.${dst}: Unknown type(s)`); return false; }
  const shaded = from.inputs.get(src) ?? null;
  const fc = app.anim.fcurves.get(sp);
  const copyAnim = (target: Parameter) => { if (fc) { app.anim.fcurves.set(target, fc); } };
  if (st === dt) {
    if (shaded) { from.connect(src, null); to.connect(dst, shaded); from.inputs.set(src, shaded); }
    else { dp.value = Array.isArray(sp.value) ? [...sp.value] : sp.value; copyAnim(dp); }
    return true;
  }
  if (st === 'scalar' && dt === 'color') {
    if (shaded) { const conv = bareShader('Scalar2color', [['input', 'scalar', 0], ['alpha', 'scalar', 0]]); from.connect(src, null); conv.connect('input', shaded); to.connect(dst, conv); from.inputs.set(src, shaded); }
    else { const v = Number(sp.value) || 0; dp.value = Array.isArray(dp.value) ? dp.value.map(() => v) : [v, v, v]; }
    return true;
  }
  if (st === 'integer' && dt === 'scalar') {
    if (shaded) { const conv = bareShader('Integer2scalar', [['input', 'integer', 0]]); from.connect(src, null); conv.connect('input', shaded); to.connect(dst, conv); from.inputs.set(src, shaded); }
    else { dp.value = Number(sp.value) || 0; copyAnim(dp); }
    return true;
  }
  if (st === 'color' && dt === 'scalar') {
    // as shipped the converter is applied and the transfer then reports failure (reversed test; WIRE_CORRECTIONS_B15 38)
    if (!shaded) { const v = sp.value as number[]; dp.value = (v[0] + v[1] + v[2]) / 3; }
    return false;
  }
  app.logMsg('info', `WARNING : Cannot convert ${st} to ${dt}`);
  return false;
}

function upgradeOne(app: App, up: Upgrade, old: Shader, owners: Owner[]): boolean {
  if (up.special === 'hair' && !(owners.length && owners.every(o => o.kind === 'material'))) { app.logMsg('info', `WARNING : Failed to upgrade ${old.name}`); return false; }
  app.logMsg('info', `Upgrading ${old.name}`);
  const neu = makeReplacement(app, up, old);
  if (!neu) { app.logMsg('info', `WARNING : FApplyShaderToCnxPoint: could not create ${up.preset}`); app.logMsg('info', `WARNING : Failed to upgrade ${old.name}`); return false; }
  let ok = true;
  for (const [src, dst] of up.ports) {
    if (up.special === 'mix8' && /^weight|^alpha|^mode|^color/.test(src) && !old.get(src)) continue;
    if (!transferPort(app, old, src, neu, dst)) ok = false;
  }
  for (const [k, v] of Object.entries(up.fixed ?? {})) { const p = neu.get(k); if (p) p.value = Array.isArray(v) ? (Array.isArray(p.value) ? v.slice(0, p.value.length) : v) : v; }
  if (up.special === 'mix8') {
    const count = old.get('count');
    if (old.inputs.get('count')) logNya(app, 'UpgradeShaders', 'the Integer2scalar / Scalar_Math_Logic chain on inuse<i> for a driven count (not built here)');
    else for (let i = 1; i <= 7; i++) neu.set(`inuse${i}`, i <= (Number(count?.value) || 0));
  }
  if ((up.special === 'mixcolor' || up.special === 'scalarmix') && neu.get('weight1')) {
    const w = neu.get('weight1')!; const alphaFlag = !!old.val('alpha');
    if (old.inputs.get('alpha') || old.inputs.get('mix')) logNya(app, 'UpgradeShaders', 'the Color_Math_Basic / Boolean_switch / Scalar_switch insertion for a shaded mix or alpha flag');
    else if (Array.isArray(w.value)) { const v = up.special === 'scalarmix' ? Number(old.val('mix')) || 0 : null; const arr = [...w.value]; if (v !== null) arr.fill(v); if (arr.length > 3 && !alphaFlag) arr[3] = 0; w.value = arr; }
  }
  if (up.special === 'xcolor' && old.inputs.get('color1') && old.inputs.get('color2')) {
    const zero = bareShader('Zero_Alpha', [['input1', 'color', [0, 0, 0]], ['input2', 'color', [1, 1, 1]], ['alpha', 'boolean', true], ['op', 'integer', 2]]);
    const c1 = neu.inputs.get('input1'); if (c1) { zero.connect('input1', c1); neu.connect('input1', zero); }
  }
  if (!ok) { app.logMsg('info', `WARNING : Failed to upgrade ${old.name}`); return false; }   // the new shader stays (inferred)
  // move the outputs and delete the old shader
  for (const o of owners) {
    if (o.kind === 'shader') { o.node.connect(o.port, neu); }
    else if (up.special === 'hair') { o.node.setSurface(neu); for (const port of ['surface', 'shadow', 'volume', 'photonvolume']) o.node.portConnections.set(port, 'out'); }
    else o.node.setSurface(neu);
  }
  if (up.special === 'hair') app.logMsg('info', `Upgraded ${old.name} to new hair shader. Shading model was changed to 'Fur'.`);
  return true;
}

function upgradeShaders(app: App): boolean {
  let any = false;
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (const up of UPGRADES) {
      const prefix = up.clsid.toUpperCase();
      for (const { shader, owners } of allShaders(app)) {
        const id = String((shader as any).clsid ?? '').toUpperCase();
        if (!id || !id.startsWith(prefix)) continue;
        if (upgradeOne(app, up, shader, owners)) { changed = true; any = true; }
        else (shader as any).clsid = `${id}#failed`;   // not retried in the next pass
      }
    }
    if (!changed) break;
  }
  app.events.emit('scene');
  return any;
}

// ------------------------------------------------------------------ "Get default camera" (note 3.15)
function getDefaultCamera(app: App, a: Record<string, any>): any {
  const C = 'Get default camera';
  const name = unset(a.Name) ? 'Camera' : String(a.Name);
  const parentArg = unset(a.Parent) ? null : (a.Parent instanceof X3DObject ? a.Parent : app.scene.find(String(a.Parent)));
  const parent: X3DObject = (parentArg as X3DObject) ?? app.scene.root;
  const root = new Null(app.scene.uniqueName(`${name}_Root`)); (root as any).type = 'CameraRoot';
  app.record(C, () => parent.addChild(root), () => parent.removeChild(root));
  const r = app.run('SIGetPrimCamera', { PresetObj: unset(a.PresetObj) ? 'Camera' : a.PresetObj, Name: name, InterestName: `${name}_Interest`, Parent: parentArg ?? null });
  const cam: X3DObject | undefined = r?.['3DObjCamera']; const interest: X3DObject | undefined = r?.['3DObjCameraInterest'];
  if (!cam || !interest) { logNya(app, C, 'SIGetPrimCamera gave no camera'); return root; }
  // the root moves to the camera's global position, then camera and interest go under it (keeping their global poses)
  const cg = cam.globalMatrix().elements; const pg = parent === app.scene.root ? null : parent.globalMatrix().clone().invert();
  const pos = [cg[12], cg[13], cg[14]] as [number, number, number];
  if (pg) { const e = pg.elements; const [x, y, z] = pos; pos[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
  ['posx', 'posy', 'posz'].forEach((k, i) => app.setParam(root.kinematics.local.get(k)!, pos[i], C));
  for (const child of [cam, interest]) {
    const old = child.parentObj!; const before = ['posx', 'posy', 'posz'].map(k => child.kinematics.local.val(k));
    const g = child.globalMatrix().elements; const rg = root.globalMatrix().clone().invert().elements;
    const l = [rg[0] * g[12] + rg[4] * g[13] + rg[8] * g[14] + rg[12], rg[1] * g[12] + rg[5] * g[13] + rg[9] * g[14] + rg[13], rg[2] * g[12] + rg[6] * g[13] + rg[10] * g[14] + rg[14]];
    app.record('Parent', () => { root.addChild(child); ['posx', 'posy', 'posz'].forEach((k, i) => child.kinematics.local.set(k, l[i])); }, () => { old.addChild(child); ['posx', 'posy', 'posz'].forEach((k, i) => child.kinematics.local.set(k, before[i])); });
  }
  app.events.emit('scene');
  const out: any = root;
  (b15fState(app) as any).lastDefaultCamera = { Primitive: r?.PrimObjCamera ?? cam.primitive, '3DObjCamera': cam, '3DObjCameraInterest': interest };
  return out;
}

// ------------------------------------------------------------------ "OBJ Import..." (note 3.16)
function objImportMenu(app: App): any {
  const C = 'OBJ Import...';
  const ie = (app as any).importExportModelScripts;
  if (ie?.licence === 'Avid 3D') {
    const hook = b15fState(app).hooks.browse;
    const file = hook ? hook(C, 'Select a .OBJ file', (addonDocWizardState as any).userPath ?? '', 'Wavefront (*.obj)|*.obj|All Files (*.*)') : undefined;
    if (file === undefined) logNya(app, C, 'the open-file browser without a browse hook; treated as an empty file name');
    app.run('ObjImport', { FileName: file ?? '', Group: 1, hrc: 2, Material: true, UV: true, UserNormal: false });   // no empty check (note)
    return undefined;
  }
  // command logging is switched off around the options page: a nested bus call is never logged in this build
  const r: any = app.run('SI_InspectWavefrontImportOptions', {});
  const after = (o: any) => {
    if (!o || unset(o.FileName)) return undefined;
    const objs = app.run('ObjImport', { FileName: o.FileName, Group: o.Group, hrc: o.hrc, Material: o.Material, UV: o.UV, UserNormal: o.UserNormal, UVwrapping: o.UVwrapping });
    if (!unset(o.DisplImage)) app.run('SetupDisplacement', { InputObjs: objs, FileName: o.DisplImage, DisplDepth: o.DisplDepth, FlipVert: o.DisplFlipVert, DisplViewDep: o.DisplViewDep, DisplSubDLevel: o.DisplSubDLevel });
    return undefined;
  };
  if (r && typeof r.then === 'function') return r.then(after);
  return after(r);
}

// ------------------------------------------------------------------ registration
export function registerMiscScriptsB15fCommands(app: App) {
  registerB15fWizardCommands(app);
  const st = b15fState(app);
  st.literals = CUSTOM_LITERALS.filter(n => app.commands.has(n));
  st.upgrades = UPGRADES.map(u => ({ name: u.name, clsid: u.clsid, preset: u.preset }));

  app.register({
    name: 'GenerateLipSync', label: 'GenerateLipSync', category: 'Animation', description: 'Generate lip-sync animation for an Evolver character',
    args: [{ name: 'InputObjs', default: null }, { name: 'AudioFileName', default: '' }, { name: 'TextFileName', default: '' }, { name: 'Language', default: 'en' },
      { name: 'Resolutions', default: 'hmlc' }, { name: 'MappingProfilePath', default: '' }],
    execute: (app2, a) => generateLipSync(app2, a),
  });
  app.register({
    name: 'UpgradeShaders', label: 'Upgrade Shaders', category: 'Rendering', description: 'Upgrade all obsolete shaders in the current scene', args: [],
    execute: app2 => upgradeShaders(app2),
  });
  app.register({
    name: 'Get default camera', label: 'Get default camera', category: '',
    args: [{ name: 'PresetObj', default: 'Camera' }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, { name: 'Primitive', default: null }, { name: '3DObjCamera', default: null }, { name: '3DObjCameraInterest', default: null }],
    execute: (app2, a) => getDefaultCamera(app2, a),
  });
  app.register({
    name: 'OBJ Import...', label: 'OBJ Import...', category: 'File', description: 'Import Wavefront OBJ file', args: [], undoable: false,
    execute: app2 => objImportMenu(app2),
  });
  // SPEC-PARTIAL (note 3.17, Q2): uixsiscripts.vbs was not read.
  app.register({
    name: 'Save Zero Key Hot Key', label: 'Save Zero Key Hot Key', category: 'Animation', description: 'Save Zero key hot key', args: [], undoable: false,
    execute(app2) { logNya(app2, 'Save Zero Key Hot Key', 'SaveZeroKeyHotKeyProc (uixsiscripts.vbs unread); nothing is keyed', 'Q2'); return undefined; },
  });
  // SPEC-PARTIAL (note 3.18, Q3; WIRE_CORRECTIONS_B15 39): GPUSurfaceFX.js is not shipped, the commands fail to find their script.
  const missingScript = (name: string, proc: string) => (app2: App) => {
    app2.logMsg('error', `${name}: script file GPUSurfaceFX.js not found (procedure ${proc})`);   // inferred wording
    throw new Error(`${name}: script file GPUSurfaceFX.js not found`);
  };
  app.register({
    name: 'GenNormalMap', label: 'GPUSurfaceFX - Generate the normal map', category: 'Property|Rendering', undoable: false,
    description: 'Generates the normal map of a low resolution model based on a group of high resolution models',
    args: [{ name: 'PSet', default: null }, { name: 'InputObj', default: null }, { name: 'GenNormalMapM', default: false }, { name: 'GenNormalMapT', default: false }, { name: 'GenTangents', default: false }],
    execute: missingScript('GenNormalMap', 'XSI_GenerateNormalMap'),
  });
  app.register({
    name: 'GenDiffuseMap', label: 'GPUSurfaceFX - Generate the surface map', category: 'Property|Rendering', undoable: false,
    description: 'Generates the surface map of a low resolution model based on a group of high resolution models',
    args: [{ name: 'PSet', default: null }, { name: 'InputObj', default: null }],
    execute: missingScript('GenDiffuseMap', 'XSI_GenerateDiffuseMap'),
  });
}
