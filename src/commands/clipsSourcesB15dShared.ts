// Ledger row CMD-B15d (image / model / file-cache sources and clips, audio import and clips): state and helpers shared
// by clipsSourcesB15d.ts (image side) and clipsSourcesB15dMedia.ts (model, file cache, audio).
// Brief: docs/ghidra/cmd-b15d-clips-sources.md and docs/re/WIRE_CORRECTIONS_B15.md items 30-34. Original code written from
// that prose only; there is no XSIBATCH golden.
//
// Stand-in model (original): this build has no source / clip containers, so the row keeps
//  * image sources, model sources and model clips in the stores of the UIXSI clips row (`app.uixsiClipsDisplayAddons`,
//    created by registerUixsiClipsDisplayAddonsCommands) so both rows see the same objects; a private store is used when
//    that row is not registered. Image clips are root properties of type `imageclip` (the shape CreateImageClip makes).
//  * file-cache sources / audio sources as model properties (types `filecachesource`, `audiosource`), mixer clips as
//    ClipX records on the model mixer (core/mixerActionScripts.ts).
//  * `app.clipsSourcesB15d`: lock flags of the sources / clips containers, the preference default image, the last audio
//    folder registry key, the project audio sample rate, hooks for what has no model here (see the Media file).
// Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B15d)".
import { App } from '../core/commands';
import { Property, Node, Model, X3DObject, Operator } from '../core/scene';
import { SiStatusError } from './alembicSeqCam';

export const ROW = 'CMD-B15d';
export const E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_ABORT = 0x80004004, E_INVALIDARG = 0x80070057, E_ACCESSDENIED = 0x80070005;
export const fail = (status: number, what: string) => new SiStatusError(status, what);
export const logNya = (app: App, command: string, what: string) => app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`);

export interface B15dState {
  /** Lock state of the sources container / clips container (the lock check of every creating command). */
  locks: { sources: boolean; clips: boolean };
  /** User preference "default image" (SIGetUserPrefDefaultImage). */
  defaultImage: string;
  /** Registry keys (last audio folder under `Nle\animmix\audio`). */
  registry: Record<string, string>;
  /** Content property "Project Audio Sample Rate", and whether the scene property reports a fixed rate. */
  audioSampleRate: number;
  audioRateFixed: boolean;
  /** Preference `simulation.cachetemplatefilename` (inferred default: model and object separated by `_`). */
  cacheTemplate: string;
  /** Interactive pick session of AddFileCacheSource (prompt XSIIMAGECLIP 0x24): null/absent = none available. Return the
   *  picked object, null for "nothing picked", or throw / return the string 'cancel' for a cancelled pick. */
  pick: null | ((app: App) => X3DObject | null | 'cancel');
  /** Restricted application edition (inferred: Foundation), where SIAddModelSource refuses. */
  restricted: boolean;
  /** Sub-image count of an image file (source vtable slot 12, inferred layers / views); default 1. */
  subImageCount: (file: string) => number;
  /** Private stores, used when the UIXSI row is absent. */
  own: { imageSources: Property[]; modelSources: Property[]; modelClips: Property[] };
  /** SICreateModelClip with its optional `Source` argument (not in the registry list, so not reachable through the bus). */
  createModelClip: (a: Record<string, any>) => Property;
  /** Name -> what the command did (for the compare script). */
  last: Record<string, any>;
}
export const b15d = (app: App): B15dState => {
  const a = app as any;
  return a.clipsSourcesB15d ?? (a.clipsSourcesB15d = {
    locks: { sources: false, clips: false }, defaultImage: '', registry: {}, audioSampleRate: 44100, audioRateFixed: false,
    cacheTemplate: '[model]_[object]', pick: null, restricted: false, subImageCount: () => 1,
    own: { imageSources: [], modelSources: [], modelClips: [] }, last: {}, createModelClip: () => { throw new Error('not registered'); },
  } as B15dState);
};
type Store = 'imageSources' | 'modelSources' | 'modelClips';
export function storeOf(app: App, which: Store): Property[] {
  const u = (app as any).uixsiClipsDisplayAddons;
  return u?.[which] ?? b15d(app).own[which];
}

// ------------------------------------------------------------------ small helpers
export const unset = (v: any) => v === undefined || v === null || v === '' || (typeof v === 'string' && /^\s*$/.test(v));
export const nameOf = (x: any): string => String(x?.fullName ?? x?.name ?? x ?? '');
/** Resolved full path used by the reuse rule: separators unified, compared case-insensitively. */
export const resolvePath = (file: string) => file.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/\.\//g, '/');
export const samePath = (a: string, b: string) => resolvePath(a).toLowerCase() === resolvePath(b).toLowerCase();
export const fileOnly = (file: string) => file.replace(/^.*[\\/]/, '');
export const dirOnly = (file: string) => /[\\/]/.test(file) ? file.replace(/[\\/][^\\/]*$/, '') : '';
export const baseName = (file: string) => fileOnly(file).replace(/\.[^.]*$/, '');
export const uniqueIn = (taken: Iterable<string>, base: string) => {
  const t = new Set(taken); if (!t.has(base)) return base; let i = 1; while (t.has(`${base}${i}`)) i++; return `${base}${i}`;
};
export const isImageSourceNode = (n: any): n is Property => n instanceof Property && n.type === 'imagesource';
export const isImageClipNode = (n: any): n is Property => n instanceof Property && n.type === 'imageclip';
export const isModelSourceNode = (n: any): n is Property => n instanceof Property && n.type === 'modelsource';
export const isAudioSourceNode = (n: any): n is Property => n instanceof Property && n.type === 'audiosource';

/** Lock check (step (a) of the usual steps): a locked container raises the lock error and nothing is created. */
export function lockCheck(app: App, command: string, which: 'sources' | 'clips') {
  if (b15d(app).locks[which]) throw fail(E_ACCESSDENIED, `${command}: the ${which} container is locked`);   // inferred HRESULT
}

/** Items of an object / collection argument as scene nodes: nodes pass, strings are looked up by name among the stores,
 *  the root properties and the scene objects. */
export function resolveAny(app: App, x: any): any {
  if (x instanceof Node) return x;
  if (x && typeof x === 'object' && 'name' in x && typeof x.name === 'string' && !Array.isArray(x)) x = x.fullName ?? x.name;
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim(); const last = s.replace(/^.*\./, '');
  const lists: Property[][] = [storeOf(app, 'imageSources'), storeOf(app, 'modelSources'), storeOf(app, 'modelClips'), app.scene.root.properties, mediaProps(app)];
  for (const l of lists) { const hit = l.find(p => p.name === s || p.fullName === s || p.name === last); if (hit) return hit; }
  return app.scene.find(s) ?? app.scene.find(last) ?? null;
}
export function listArg(app: App, v: any): any[] {
  if (Array.isArray(v)) return v.map(x => resolveAny(app, x)).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map(s => resolveAny(app, s)).filter(Boolean);
  const n = resolveAny(app, v); return n ? [n] : [];
}
export function mediaProps(app: App): Property[] {
  const out: Property[] = [];
  for (const m of [app.scene.root, ...allModelsOf(app)]) out.push(...m.properties);
  return out;
}
export function allModelsOf(app: App): Model[] {
  const out: Model[] = [];
  for (const o of app.scene.allObjects()) if (o instanceof Model) out.push(o);
  return out;
}
export const modelOfObject = (o: any): Model | null => o instanceof Model ? o : o instanceof X3DObject ? o.model : null;

/** Image-source operator and in-place image operator of a clip (operators stand-ins, kept on the clip). */
export class ClipImageOperator extends Operator {
  constructor(name: string, type: 'imagesourceop' | 'imageop', readonly clip: Property, public source: Property | null, readonly preset: string) {
    super(name, type, []);
  }
}
export const clipOps = (clip: Property): ClipImageOperator[] => (clip as any).imageOps ?? ((clip as any).imageOps = []);
