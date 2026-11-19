// Ledger row CMD-B11e: shared model and helpers of the action.dll commands wired in actionB11eMaps.ts and
// actionB11eSources.ts. Brief: docs/ghidra/cmd-b11e-action-maps-rules-sources-binary.md ("Wire contract" sections).
// Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
// How the contract is mapped onto this build:
//  * Mapping templates (connection maps, value maps) had no object model here: the mixer only kept name / active
//    records (`mix.cnxTemplates`, `mix.valueTemplates`, core/mixerActionScripts.ts). `MappingTemplate` below is a
//    small original stand-in: a Property under the model's Mixer that owns its rule list (From, To, Active,
//    PoseOffset). Each template also keeps the matching name / active record in the mixer lists, so the older
//    commands that switch templates off and on (FreezeAndReplaceClips) see it.
//  * Failure HRESULTs are thrown as SiStatusError (status + message); S_FALSE results are kept in
//    `app.actionB11e.lastStatus`. Message ids whose texts are not in the repo are logged with their id.
//  * Unread branches log "not yet attested ... (CMD-B11e)".
import { App, CommandDef } from '../core/commands';
import { Node, Property, Model, X3DObject } from '../core/scene';
import { str, int } from '../core/params';
import { mixerX, allModels, isActionSource, clipFullName, clipNode, ClipNode, type ClipRef, type MixerX } from '../core/mixerActionScripts';
import { SiStatusError } from './alembicSeqCam';

export const ROW = 'CMD-B11e';
export const NOTE = 'docs/ghidra/cmd-b11e-action-maps-rules-sources-binary.md';
export const S_OK = 0, S_FALSE = 1;
export const E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057, E_ACCESSDENIED = 0x80070005, DISP_E_EXCEPTION = 0x80020009;

export interface B11eState {
  lastStatus: Record<string, number>;
  /** Stand-in for the user registry values the commands write (key -> value). */
  registry: Record<string, string>;
  /** File events fired by LoadActionPreset (`.eani`). */
  fileEvents: { id: number; type: number; file: string }[];
}
export function b11e(app: App): B11eState {
  return ((app as any).actionB11e ??= { lastStatus: {}, registry: {}, fileEvents: [] } as B11eState);
}
export function setStatus(app: App, cmd: string, s: number) { b11e(app).lastStatus[cmd] = s; }
export function fail(status: number, what: string): SiStatusError { return new SiStatusError(status, what); }
export function logNya(app: App, cmd: string, what: string) { app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`); }
export const unset = (v: any) => v === undefined || v === null || v === '';
export const numArg = (v: any, d: number) => { const n = Number(v); return unset(v) || typeof v === 'boolean' || !Number.isFinite(n) ? d : Math.trunc(n); };
export const boolArg = (v: any) => typeof v === 'string' ? /^(true|1|-1|yes)$/i.test(v.trim()) : !!v;

// ------------------------------------------------------------------ registry argument lists
/** data/command_registry.json argument lists (output-only return values, flag 0x200, left out). */
export const ARGS: Record<string, { name: string; default: any }[]> = {
  CreateConnectionMap: [{ name: 'Obj1', default: null }, { name: 'Obj2', default: null }, { name: 'MappingTemplate', default: null }],
  CreateEmptyConnectionMap: [{ name: 'Obj1', default: null }, { name: 'MappingTemplate', default: null }],
  CreateValueMap: [{ name: 'Obj1', default: null }, { name: 'Obj2', default: null }, { name: 'Mode', default: 4 }, { name: 'Scope', default: 1 }, { name: 'UseNames', default: false }, { name: 'MappingTemplate', default: null }],
  CreateEmptyValueMap: [{ name: 'Obj1', default: null }, { name: 'MappingTemplate', default: null }],
  AddMappingRule: [{ name: 'MappingTemplate', default: null }, { name: 'From', default: '' }, { name: 'To', default: '' }, { name: 'Index', default: 0 }],
  SetMappingRule: [{ name: 'MappingTemplate', default: null }, { name: 'From', default: '' }, { name: 'To', default: '' }, { name: 'Index', default: 0 }, { name: 'Active', default: -1 }, { name: 'PoseOffset', default: -1 }],
  DeleteMappingRule: [{ name: 'MappingTemplate', default: null }, { name: 'Index', default: 0 }],
  GetNumMappingRules: [{ name: 'MappingTemplate', default: null }],
  GetMappingRule: [{ name: 'MappingTemplate', default: null }, { name: 'Index', default: 0 }, { name: 'From', default: '' }, { name: 'To', default: '' }, { name: 'Active', default: false }, { name: 'PoseOffset', default: false }],
  RemoveActionItem: [{ name: 'Source', default: null }, { name: 'Name', default: '' }],
  GetStoreActionDefaults: [{ name: 'Model', default: null }, { name: 'InputObj', default: null }, { name: 'Mode', default: 1 }, { name: 'From', default: 0 }, { name: 'To', default: 0 }, { name: 'Size', default: 0 }, { name: 'Type', default: 'ReturnOnly' }],
  LoadActionPreset: [{ name: 'Model', default: null }, { name: 'FileName', default: null }, { name: 'Name', default: '' }, { name: 'ActionStorage', default: 0 }],
  CopySourceActionToFolder: [{ name: 'InputObj', default: null }, { name: 'Target', default: null }],
  AddPoseActionItems: [{ name: 'InputObjs', default: null }, { name: 'Name', default: 'OFFSET_ROOT' }],
  MergeClips: [{ name: 'InputObjs', default: null }],
};
const LABEL: Record<string, string> = {
  CreateConnectionMap: 'Create Connection Map', CreateEmptyConnectionMap: 'Create Empty Connection Map', CreateValueMap: 'Create Value Map',
  CreateEmptyValueMap: 'Create Empty Value Map', AddMappingRule: 'Add Mapping Rule', SetMappingRule: 'Set Mapping Rule', DeleteMappingRule: 'Delete Mapping Rule',
  GetNumMappingRules: 'Get Number of Mapping Rules', GetMappingRule: 'Get Mapping Rule', RemoveActionItem: 'RemoveActionItem',
  GetStoreActionDefaults: 'Get store Action defaults', LoadActionPreset: 'LoadActionPreset', CopySourceActionToFolder: 'Copy source action to folder',
  AddPoseActionItems: 'Add Pose Action Items', MergeClips: 'Merge clips into a new source',
};
export const registered: string[] = [];
/** Register with the registry argument list; replaces any earlier registration of the name. */
export function reg(app: App, name: string, def: Pick<CommandDef, 'execute'> & Partial<CommandDef>) {
  const args = ARGS[name]; if (!args) throw new Error(`${ROW}: no registry argument list for ${name}`);
  app.register({ name, label: LABEL[name] ?? name, category: name === 'RemoveActionItem' ? 'Action' : 'Animation Mixer', description: def.description ?? '', ...def, args: args.map(a => ({ ...a })) } as CommandDef);
  if (!registered.includes(name)) registered.push(name);
}

// ------------------------------------------------------------------ mapping templates
export interface MapRule { from: string; to: string; active: boolean; poseOffset: boolean }
export type MapKind = 'connection' | 'value';
export class MappingTemplate extends Property {
  readonly isMappingTemplate = true;
  readonly rules: MapRule[] = [];
  /** The template's rule-flag interface (Active / PoseOffset). inferred: both template kinds have it. */
  hasFlags = true;
  record: { name: string; active: boolean } | null = null;
  /** Flags a new rule gets (AddMappingRule only inserts; the defaults live in the template class, inferred values). */
  defaultFlags(): { active: boolean; poseOffset: boolean } { return { active: true, poseOffset: false }; }
  constructor(name: string, readonly mapKind: MapKind) { super(name, mapKind === 'connection' ? 'ConnectionMappingTemplate' : 'ValueMappingTemplate', []); }
  // contract slots of the rule-list interface (0-based positions)
  insert(pos: number, rules: MapRule[]) { this.rules.splice(pos, 0, ...rules); }
  remove(pos: number, n: number): MapRule[] { return this.rules.splice(pos, n); }
  count() { return this.rules.length; }
}
export const isTemplate = (x: unknown): x is MappingTemplate => x instanceof MappingTemplate;

/** Templates kept on a mixer (created on first use). */
export function templatesOf(mix: Property): MappingTemplate[] { const m = mix as any; return m.mappingTemplatesB11e ?? (m.mappingTemplatesB11e = []); }
function* allTemplates(app: App): Generator<MappingTemplate> {
  for (const model of allModels(app.scene)) { const mix = model.property('mixer'); if (mix) yield* templatesOf(mix); }
}
/** A MappingTemplate argument: the object, its full name or its name; unset = a selected template. */
export function templateArg(app: App, cmd: string, v: any): MappingTemplate {
  let t: MappingTemplate | undefined;
  if (isTemplate(v)) t = v;
  else if (unset(v)) t = app.selection.find(isTemplate);
  else if (typeof v === 'string') {
    const s = v.trim(); const all = [...allTemplates(app)];
    t = all.find(x => x.fullName === s) ?? all.find(x => s.endsWith(`.${x.parent?.name}.${x.name}`)) ?? all.find(x => x.name === s);
  }
  if (!t) throw fail(E_POINTER, `${cmd}: MappingTemplate is missing or is not a mapping template`);
  return t;
}
/** 1-based Index (0 = 1) clamped to the rule count: the 0-based position of Add / Set / Delete. */
export const rulePos = (index: number, count: number) => Math.min(Math.max(index, 1) - 1, count);

// ------------------------------------------------------------------ models and the mixer
export function findNode(app: App, x: any): Node | undefined {
  if (x instanceof Node) return x;
  if (typeof x !== 'string' || !x.trim()) return undefined;
  const s = x.trim();
  if (s === app.scene.root.name || s === 'Scene_Root') return app.scene.root;
  return app.scene.find(s) ?? app.scene.find(s.split('.').pop()!);
}
/** An object argument resolved to a model (DSQueryGenericObject); a non-model object gives its model (inferred). */
export function modelArg(app: App, v: any): Model | undefined {
  const n = findNode(app, v);
  if (n instanceof Model) return n;
  if (n instanceof X3DObject) return n.model ?? app.scene.root;
  return undefined;
}
/** The lock rule of map creation (contract section 2). This build has no lock model; a stand-in `lockFlags` field is honoured. */
export function checkLock(cmd: string, model: Model) {
  const flags = Number((model as any).lockFlags ?? 0);
  if ((flags & 0xffff) && !(model as any).referencedModel) throw fail(E_ACCESSDENIED, `${cmd}: ${model.name} is locked`);
}
/** F3DGetModelNLEContainer: the model's mixer, created (undoably) when missing. */
export function ensureMixer(app: App, model: Model): MixerX {
  const had = model.property('mixer');
  const mix = mixerX(model);
  if (!had) app.record('Create mixer', () => { if (!model.properties.includes(mix)) model.addProperty(mix); }, () => model.removeProperty(mix));
  return mix;
}
export function uniqueIn(names: Iterable<string>, base: string): string {
  const taken = new Set(names); if (!taken.has(base)) return base;
  let i = 1; while (taken.has(`${base}${i}`)) i++; return `${base}${i}`;
}
/** Create a mapping template on the model's mixer and append it (position -1 = end). */
export function createTemplate(app: App, cmd: string, model: Model, kind: MapKind): MappingTemplate {
  checkLock(cmd, model);
  const mix = ensureMixer(app, model);
  const list = templatesOf(mix);
  // inferred: the default names of new templates (the class ids at 0x1801352c8 / 0x1801352e8 were not read)
  const t = new MappingTemplate(uniqueIn(list.map(x => x.name), kind === 'connection' ? 'MappingTemplate' : 'ValueMappingTemplate'), kind);
  t.record = { name: t.name, active: true };
  const recs = kind === 'connection' ? (mix.cnxTemplates ??= []) : (mix.valueTemplates ??= []);
  app.record(cmd, () => { list.push(t); t.parent = mix as any; recs.push(t.record!); }, () => {
    const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); t.parent = null;
    const j = recs.indexOf(t.record!); if (j >= 0) recs.splice(j, 1);
  });
  return t;
}

// ------------------------------------------------------------------ action sources and clips
/** Every action source of the scene (sources live as properties of their model in this build). */
export function allSources(app: App): Property[] {
  const out: Property[] = [];
  for (const m of allModels(app.scene)) for (const p of m.properties) if (isActionSource(p)) out.push(p);
  return out;
}
export function sourceArg(app: App, x: any): Property | undefined {
  if (x instanceof Property) return isActionSource(x) ? x : undefined;
  if (typeof x !== 'string' || !x.trim()) return undefined;
  const s = x.trim();
  return allSources(app).find(p => p.fullName === s || p.name === s || s.endsWith(`.${p.name}`));
}
export const listOf = (v: any): any[] => unset(v) ? [] : Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(t => t.trim()).filter(Boolean) : [v];
export function modelOfSource(src: Property): Model | null { const p = src.parent as any; return p instanceof Model ? p : null; }

type ItemKeys = { time: number; value: number; interp?: number }[];
export function srcJson<T>(src: Property, key: string): T { try { return JSON.parse(src.val(key) || '{}'); } catch { return {} as T; } }
/** Item paths of a source, in storage order: static values, then curves, then expressions. */
export function itemsOf(src: Property): string[] {
  const v = srcJson<Record<string, number>>(src, 'data'), f = srcJson<Record<string, ItemKeys>>(src, 'fcurves'), e = srcJson<Record<string, string>>(src, 'expressions');
  return [...new Set([...Object.keys(v), ...Object.keys(f), ...Object.keys(e)])];
}
export interface SrcSnap { data: string; fcurves: string; expressions: string; items: number }
export function snapSource(src: Property): SrcSnap {
  return { data: src.val('data') ?? '{}', fcurves: src.val('fcurves') ?? '{}', expressions: src.val('expressions') ?? '{}', items: Number(src.val('items') ?? 0) };
}
export function writeSource(src: Property, s: SrcSnap) {
  for (const k of ['data', 'fcurves', 'expressions'] as const) if (src.get(k)) src.set(k, s[k]); else src.add(str(k, s[k], k, { readOnly: true }));
  if (src.get('items')) src.set('items', s.items); else src.add(int('items', s.items, 'Items', { readOnly: true }));
}
/** A new action source in this build's storage form. */
export function makeSource(name: string, values: Record<string, number>, curves: Record<string, ItemKeys>, extra: any[] = []): Property {
  const items = new Set([...Object.keys(values), ...Object.keys(curves)]).size;
  return new Property(name, 'actionsource', [
    str('data', JSON.stringify(values), 'Values', { readOnly: true }), str('fcurves', JSON.stringify(curves), 'FCurves', { readOnly: true }),
    str('expressions', '{}', 'Expressions', { readOnly: true }), int('items', items, 'Items', { readOnly: true }), int('mode', 1, 'Mode', { readOnly: true }), ...extra,
  ]);
}

/** Every clip of every mixer (top-level clips and compounds). */
export function* allClipRefs(app: App): Generator<ClipRef> {
  for (const model of allModels(app.scene)) {
    if (!model.property('mixer')) continue;
    const mix = mixerX(model);
    for (const clip of mix.clips) yield { clip, mix, model };
    for (const clip of mix.compounds) yield { clip, mix, model };
  }
}
export function clipArg(app: App, x: any): ClipNode | null {
  if (x instanceof ClipNode) { for (const r of allClipRefs(app)) if (r.clip === x.clip) return clipNode(r); return null; }
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim(); let short: ClipRef | null = null;
  for (const r of allClipRefs(app)) { if (clipFullName(r) === s) return clipNode(r); if (!short && r.clip.name === s) short = r; }
  return short ? clipNode(short) : null;
}
