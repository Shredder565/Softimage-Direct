// Ledger row CMD-B18c (Face Robot JScript plug-ins LipSynch.js and Tongue.js): the 20 commands fr_ImportSpeech,
// fr_LoadVisemePose, fr_SaveVisemePose, fr_CopyVisemeLibrary, fr_CreateVisemeVariation, fr_CreateVisemeShape,
// fr_ImportVisemes, fr_PrepareForPhonemes, fr_EditVisemes, fr_AddLipSync, AddToGroup_tongue, GetCompounds_tongue,
// fr_SetupTongueMaps, fr_BuildTongueAfterSolve, fr_ScaleTongueMesh, fr_IsHeadMesh, GetTongueMarkers,
// fr_FitTongueAfterSolveStage, fr_SolveTongueAfterSolveStage, GetTongueScale.
// Brief: the "Wire contract" sections of docs/ghidra/cmd-b18c-fr-lipsynch-tongue-scripts.md and
// docs/re/WIRE_CORRECTIONS_B18.md items 1 and 8. These replace the argument-less shells of
// src/commands/faceRobotModule.ts. Original code written from that prose only; no golden exists.
//
// Mapping notes:
//  * The property pages' buttons are exposed as functions on `property.ppg` (this build draws generic pages for script
//    custom properties); modal dialogs go through `state.hooks.modal`.
//  * The mixer's `Sources › Viseme` folder is the model's viseme action sources (actionB11fModel.ts).
//  * Read-only file attributes do not exist on the virtual host file system, so "clear read-only" is a no-op.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property, Model, Cluster, Group, Primitive, mixerOf } from '../core/scene';
import { num, int, bool, str } from '../core/params';
import { build } from '../core/geometry';
import { makeCurve, evalCurve, curveDomain } from '../core/curves';
import { FrozenGeomOperator } from './model';
import { propNamed, addProperty, addObject, unset, listOf, isInScene, boolArg, numArg, msgBox, newNull, addToGroup, entryObject } from './faceRobotB14Shared';
import { deleteNode, globalPos, setGlobalPos, setKeywords, keywordsOf } from './faceRobotB14deShared';
import {
  CAT, b18, nyaC, siError, siInfo, scriptError, call, callStrict, inspect, inspectModal, getOrAddProp, newProp, setVal, isPolymesh,
  objOrName, setValue, addCluster, addClusterProp, getKeyedIn, faceModelB18, faceMeshB18, allControlsB18, sgetFaceModel, frFolder,
  folderExists, fileExists, listFiles, listFolders, join, makeFolder, copyFile, readTextFile, writeTextFile, ProgressBar,
} from './faceRobotB18bcShared';

// ================================================================== viseme library (§3.0)
export interface PhonemeRow { ipa: string; name: string; sound: string; type: number }
/** Language csv parse: LF lines; space / TAB / # first character skipped; fields IPA, name, sound, type (lenient int). */
export function parseLanguage(app: App, file: string): PhonemeRow[] | null {
  let text: string;
  try { if (!fileExists(file)) throw new Error('missing'); text = readTextFile(app, file) ?? (() => { throw new Error('unreadable'); })(); }
  catch { siError(app, `File <${file}> is invalid`); return null; }
  const rows: PhonemeRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.length || line[0] === ' ' || line[0] === '\t' || line[0] === '#') continue;
    const f = line.split(','); if (f.length < 2) continue;
    rows.push({ ipa: f[0], name: f[1], sound: f[2] ?? '', type: parseInt(f[3] ?? '', 10) });
  }
  return rows;
}
export const phonemeLabel = (r: PhonemeRow) => `${r.name}  ("${r.sound}")  ${r.ipa}`.replace(/0x0+/g, '0x');
const isPose = (f: string) => f.slice(f.lastIndexOf('.') + 1) === 'frpre';
const stripExt = (f: string) => (f.lastIndexOf('.') > 0 ? f.slice(0, f.lastIndexOf('.')) : f);
const visemeSources = (model: X3DObject | null) => (model?.properties ?? []).filter(p => p.type === 'actionsource' && (p as any).sourceClass === 'viseme');

// ================================================================== fr_Visemes / fr_LipSync / TongueSetup properties
function factoryLibrary(app: App): string { return frFolder(app, 1, 'Viseme', true).replace(/[\\/]+$/, ''); }
function visemesDefs(app: App) {
  return [
    str('LibraryPath', factoryLibrary(app), 'LibraryPath'), str('Language', 'USEnglish', 'Language'), str('Phoneme', '', 'Phoneme'),
    str('Variation', 'Normal', 'Variation'), str('PhonemeName', '', 'PhonemeName', { readOnly: true }),
  ];
}
function attachVisemesPPG(app: App, prop: Property) {
  if ((prop as any).ppg) return (prop as any).ppg;
  const P = prop; const s = (n: string) => String(P.val(n) ?? '');
  const ppg: any = {
    help: 'propref_facebot_Visemes.htm',
    langFolder: () => join(s('LibraryPath'), s('Language')),
    rows: [] as PhonemeRow[], languages: [] as string[], variations: [] as string[], items: [] as { label: string; value: string }[], enabled: {} as Record<string, boolean>,
    row: () => ppg.rows.find((r: PhonemeRow) => r.ipa === s('Phoneme')),
    posePath: (r?: PhonemeRow) => { const x = r ?? ppg.row(); return x ? join(join(ppg.langFolder(), s('Variation')), `${x.ipa}_${x.name}.frpre`) : ''; },
    shapeName: () => `_${s('Phoneme')}_${s('PhonemeName')}_${s('Variation')}_Shape`,
    validate() {
      const lib = s('LibraryPath');
      ppg.languages = folderExists(lib) ? listFiles(lib).filter(f => /\.csv$/i.test(f)).map(stripExt) : [];
      if (!ppg.languages.includes(s('Language'))) P.set('Language', ppg.languages.includes('USEnglish') ? 'USEnglish' : ppg.languages[0] ?? '');
      ppg.variations = folderExists(ppg.langFolder()) ? listFolders(ppg.langFolder()) : [];
      if (!ppg.variations.includes(s('Variation'))) P.set('Variation', ppg.variations.includes('Normal') ? 'Normal' : ppg.variations[0] ?? '');
      ppg.rows = (s('Language') && fileExists(ppg.langFolder() + '.csv') ? parseLanguage(app, ppg.langFolder() + '.csv') : null) ?? [];
      if (!ppg.row()) P.set('Phoneme', ppg.rows[0]?.ipa ?? '');
      P.set('PhonemeName', ppg.row()?.name ?? '');
      ppg.items = ppg.rows.map((r: PhonemeRow) => ({ label: phonemeLabel(r) + (fileExists(ppg.posePath(r)) ? '' : '      <not defined>'), value: r.ipa }));
      const varFolder = join(ppg.langFolder(), s('Variation'));
      const shapeExists = (() => { const m = faceMeshB18(app, faceModelB18(app, 'fr_EditVisemes')); return !!m && shapeKeyExists(m, ppg.shapeName()); })();
      ppg.enabled = {
        Apply: fileExists(ppg.posePath()), 'New...': ppg.variations.length > 0, 'Save Viseme Pose': ppg.rows.length > 0, 'Create Corrective Shape': ppg.rows.length > 0,
        'Import Visemes...': folderExists(varFolder) && listFiles(varFolder).some(isPose),
      };
      ppg.correctiveLabel = shapeExists ? 'Edit Corrective Shape' : 'Create Corrective Shape';
    },
    apply() { return app.run('fr_LoadVisemePose', { FileName: ppg.posePath() }); },
    save() {
      const f = ppg.posePath();
      if (s('LibraryPath') === factoryLibrary(app) && fileExists(f) && msgBox(app, 'Warning, you are about to overwrite a factory installed visemes.  Continue?', 4, 'Overwrite Factory Viseme') !== 6) return;
      app.run('fr_SaveVisemePose', { FileName: f }); ppg.validate();
    },
    createLibrary() {
      const proj = b18(app).env.project; const to = proj ? join(proj, 'Viseme') : '';
      const tmp = addProperty(app, app.scene.root, newProp('Create_New_Library', [str('FromLibraryPath', s('LibraryPath'), 'FromLibraryPath'), str('ToLibraryPath', to === s('LibraryPath') ? '' : to, 'ToLibraryPath'), bool('Overwrite', false, 'Overwrite'), bool('CopyVisemes', true, 'CopyVisemes')]));
      try {
        if (!inspectModal(app, tmp)) return;
        const dest = String(tmp.val('ToLibraryPath'));
        app.run('fr_CopyVisemeLibrary', { From: tmp.val('FromLibraryPath'), To: dest || null, Overwrite: tmp.val('Overwrite'), CopyVisemes: tmp.val('CopyVisemes') });
        if (dest && folderExists(dest)) { P.set('LibraryPath', dest); ppg.validate(); }
      } finally { deleteNode(app, tmp); }
    },
    newVariation() {
      if (s('LibraryPath') === factoryLibrary(app) && msgBox(app, 'Warning, you are about to add a new variation to the factory installed visemes.  Continue?', 4, 'Add Factory Viseme') !== 6) return;
      const tmp = addProperty(app, app.scene.root, newProp('New_Variation', [str('Variation', '', 'Variation'), str('CopyFrom', '<none>', 'CopyFrom')]));
      try {
        if (!inspectModal(app, tmp)) return;
        const raw = String(tmp.val('Variation')); const name = raw.replace(/[\t\v\n\r\f\\/ _.]/g, '');
        if (name !== raw) siInfo(app, 'Removed illegal characters from variation name');
        if (!name) { siError(app, 'Variation name not specified'); return; }
        if (folderExists(join(ppg.langFolder(), name))) { siError(app, `Variation "${name}" already exists`); return; }
        const cf = String(tmp.val('CopyFrom'));
        app.run('fr_CreateVisemeVariation', { Variation: join(ppg.langFolder(), name), CopyFrom: cf && cf !== '<none>' ? join(ppg.langFolder(), cf) : null });
        ppg.validate();
      } finally { deleteNode(app, tmp); }
    },
    corrective() {
      const shape = ppg.shapeName(); app.run('fr_CreateVisemeShape', { ShapeName: shape });
      const m = faceMeshB18(app, faceModelB18(app, 'fr_EditVisemes')); if (m) app.select([m]);
      setValue(app, 'Shape Manager.selectedshape', shape); ppg.validate();
    },
    importVisemes() {
      const tmp = addProperty(app, app.scene.root, newProp('Import_Visemes', [int('ImportAll', 1, 'ImportAll', { desc: 'radio: All Variations 1 / <Variation> Variation Only 0' }), bool('Overwrite', true, 'Overwrite')]));
      try {
        if (!inspectModal(app, tmp)) return;
        app.run('fr_ImportVisemes', { Library: ppg.langFolder(), Variation: Number(tmp.val('ImportAll')) ? null : s('Variation'), Overwrite: tmp.val('Overwrite') });
      } finally { deleteNode(app, tmp); }
    },
  };
  (prop as any).ppg = ppg;
  let busy = false;
  prop.onChange(() => { if (busy) return; busy = true; try { ppg.validate(); } finally { busy = false; } });
  return ppg;
}
function lipSyncDefs(app: App) {
  const a: any = app.anim;
  return [
    int('Language', 0, 'Language', { min: 0, max: 1, desc: 'radio: English 0 / Japanese 1' }), str('Audio', '', 'Audio'), str('Text', '', 'Text'), str('TextText', '', 'TextText'),
    num('Offset', 1, 'Clip Offset', { min: -10000, max: 10000, uimin: Number(a.startFrame ?? 1), uimax: Number(a.endFrame ?? 100) }),
    int('TrailingSilenceDuration', 10, 'Silence Duration', { min: 1, max: 120 }),
  ];
}
function attachLipSyncPPG(app: App, prop: Property) {
  if ((prop as any).ppg) return (prop as any).ppg;
  const P = prop; const s = (n: string) => String(P.val(n) ?? '');
  const audioFolder = frFolder(app, 1, 'Audio', true);
  const ppg: any = {
    help: 'propref_facebot_LipSync.htm', audioFolder, textFilter: 'Text files (*.txt *.text)|*.txt:*.text|All Files (*.*)|*.*||',
    reload() { const f = s('Text'); if (!f) { siError(app, 'No filename specified.'); return; } P.set('TextText', readTextFile(app, f) ?? ''); },
    save() {
      const f = s('Text'); if (!f) { siError(app, 'No filename specified.'); return; }
      if (fileExists(f) && msgBox(app, `Overwrite existing file: ${f}?`, 4, 'Overwrite File') !== 6) return;
      writeTextFile(app, f, s('TextText')); P.set('TextText', readTextFile(app, f) ?? '');
    },
    current() { P.set('Offset', Number((app.anim as any).frame ?? 1)); },
    create() {
      const act = app.run('fr_ImportSpeech', { AudioFileName: s('Audio'), TextFileName: s('Text'), Offset: P.val('Offset'), Language: P.val('Language'), SilenceDuration: P.val('TrailingSilenceDuration') });
      if (act) { setValue(app, 'InspectObj', `${act.fullName ?? act.name}.SpeechBlend`); call(app, 'ShowOptionalPanel', { Name: 'lipsync_stow' }); }
      return act;
    },
  };
  (prop as any).ppg = ppg;
  let busy = false;
  prop.onChange((q) => {
    if (busy) return; busy = true;
    try {
      if (q.name === 'Audio') { const a = s('Audio'); P.set('Text', a ? a.replace(/\.[^.\\/]*$/, '') + '.txt' : ''); const t = s('Text'); P.set('TextText', t && fileExists(t) ? readTextFile(app, t) ?? '' : ''); }
      else if (q.name === 'Text') { const t = s('Text'); P.set('TextText', t && fileExists(t) ? readTextFile(app, t) ?? '' : ''); }
    } finally { busy = false; }
  });
  return ppg;
}
function tongueSetupDefs() { return [str('TongueMesh', '', 'Tongue_Mesh'), bool('Rescale', false, 'Rescale'), bool('DeleteMesh', false, 'Delete tongue mesh')]; }
function attachTongueSetupPPG(app: App, prop: Property) {
  if ((prop as any).ppg) return (prop as any).ppg;
  const ppg: any = {
    help: 'propref_facebot_TongueSetup.htm',
    hideUnhideFace() {
      const fm = sgetFaceModel(app); const gv = fm ? propNamed(fm, 'GroupVisibility') : undefined; if (!gv) { nyaC(app, 'fr_BuildTongueAfterSolve', 'GroupVisibility property missing on the face model'); return; }
      const v = !gv.val('Face'); for (const n of ['Face', 'Controls', 'Eyes', 'LookAt']) setVal(app, gv, n, v);
    },
    remove() { const r = call(app, 'fr_RemoveTongue', { DeleteMesh: prop.val('DeleteMesh') }); if (!r) siError(app, 'Failed to remove tongue'); },
    setToSelected() {
      const meshes = app.selectedObjects.filter(isPolymesh);
      if (!meshes.length) { siError(app, 'Tongue must be of polymesh type, no tongue found\n\tSelect Polymesh tongue and try again'); return; }
      if (meshes.length > 1) siInfo(app, 'Only one tongue is allowed on tongue rigging process, will use the first item in selection');
      setVal(app, prop, 'TongueMesh', meshes[0].fullName);
    },
    importTongue() {
      const C = 'fr_BuildTongueAfterSolve';
      let parent: X3DObject | null = getKeyedIn(app, ['Jaw', 'Bone'])[0] ?? null;
      if (!parent) { siError(app, 'Jaw Bone was not found.'); parent = faceModelB18(app, C); }
      call(app, 'DeselectAll', {});
      const f = frFolder(app, 1, 'Parts', true) + 'Tongue.tongue.emdl';
      if (!fileExists(f)) { siError(app, 'Tongue Mesh Could not be identified in scene or found in parts folders'); return; }
      call(app, 'ImportModel', { FileName: f });
      throw scriptError(C, 'Import tongue adds the parent as a child of itself and deletes the imported model before reading its first child (shipped defect, inferred)');
    },
    fit() { return app.run('fr_FitTongueAfterSolveStage', { TongueMesh: prop.val('TongueMesh') }); },
    solve() { return app.run('fr_SolveTongueAfterSolveStage', {}); },
  };
  (prop as any).ppg = ppg; return ppg;
}
function shapeKeyExists(mesh: X3DObject, name: string): boolean {
  return mesh.properties.some(p => p.type === 'shapekey' && p.name === name) || mesh.clusters.some(c => c.properties.some(p => p.name === name));
}

// ================================================================== tongue helpers
/** Global translation of a GetKeyed set's first item. */
const keyedPos = (o: X3DObject) => globalPos(o);
function vectors(v: any): THREE.Vector3[] | null {
  const list = Array.isArray(v) ? v : ArrayBuffer.isView(v) ? Array.from(v as any) : typeof v?.toArray === 'function' ? v.toArray() : null;
  if (!list) return null;
  const out: THREE.Vector3[] = [];
  for (const x of list) {
    if (x instanceof THREE.Vector3) out.push(x.clone());
    else if (Array.isArray(x) && x.length >= 3) out.push(new THREE.Vector3(Number(x[0]), Number(x[1]), Number(x[2])));
    else if (x && typeof x === 'object' && 'x' in x) out.push(new THREE.Vector3(Number(x.x), Number(x.y), Number(x.z)));
    else return null;
  }
  return out;
}
function weightMap(name: string, rgb: [number, number, number], n: number): Property {
  const p = new Property(name, 'wtmap', [num('min', 0, 'Minimum'), num('max', 1, 'Maximum'), int('red', rgb[0], 'red'), int('green', rgb[1], 'green'), int('blue', rgb[2], 'blue')]);
  (p as any).values = new Map(Array.from({ length: n }, (_, i) => [i, 1])); (p as any).label = 'Weight Map Property'; return p;
}

// ================================================================== registration
export function registerFaceRobotB18cCommands(app: App) {
  const reg = (name: string, args: [string, any][], execute: (app: App, a: Record<string, any>) => any, extra: Record<string, any> = {}) =>
    app.register({ name, label: name, category: CAT, description: '', args: args.map(([n, d]) => ({ name: n, default: d })), execute, ...extra });

  // ---------------------------------------------------------------- fr_ImportSpeech
  reg('fr_ImportSpeech', [['AudioFileName', null], ['TextFileName', null], ['Offset', null], ['Language', null], ['SilenceDuration', 10]], (app, a) => {
    const model = faceModelB18(app, 'fr_ImportSpeech');
    const audio = unset(a.AudioFileName) ? '' : String(a.AudioFileName), textF = unset(a.TextFileName) ? '' : String(a.TextFileName);
    if (!audio || !textF || !fileExists(audio) || !fileExists(textF)) { siError(app, 'ImportSpeech: invalid audio/text files'); return null; }
    let mesh: X3DObject | null = getKeyedIn(app, ['Face', 'Mesh'], model)[0] ?? null;
    if (!mesh) { mesh = faceMeshB18(app, model); if (mesh) setKeywords(app, mesh, `${keywordsOf(mesh).join(',')},Face,Mesh`); }   // AddUserKeyword(mesh, "Face,Mesh") (cmd-b18d §3)
    if (!mesh || !model) { siError(app, 'ImportSpeech: no face mesh found'); return null; }
    const offset = numArg(a.Offset, 0); const silence = numArg(a.SilenceDuration, 10);
    const bar = new ProgressBar(app, 'Create Speech Clip', 4, false);
    bar.step('Import Audio');
    const src = call(app, 'ImportAudio', { Model: model, FileName: audio });
    if (!src) { siError(app, 'ImportSpeech: import audio file failed'); bar.hide(); return null; }
    const mixer = mixerOf(model as any);
    const speechTrack = call(app, 'AddTrack', { Model: model, Compound: mixer.fullName, Type: 0, Name: 'Phoneme_Speech' });
    if (speechTrack) call(app, 'SetUserKeyword', { InputObjs: [speechTrack], Keywords: 'Phoneme,Speech' });
    const audioTrack = call(app, 'AddTrack', { Model: model, Compound: mixer.fullName, Type: 2, Name: 'Phoneme_Audio' });
    if (audioTrack) call(app, 'SetUserKeyword', { InputObjs: [audioTrack], Keywords: 'Phoneme,Audio' });
    const trackSet = [speechTrack, audioTrack].filter(Boolean);
    bar.step('Add Speech Clip');
    const aclip = call(app, 'AddAudioClip', { Model: model, Source: src, Track: audioTrack, Time: offset });
    const tc = (n: string) => { const v = aclip?.timectrl?.val?.(n) ?? aclip?.val?.(n) ?? aclip?.[n]; return Number.isFinite(Number(v)) ? Number(v) : undefined; };
    let sOff = tc('startoffset'), cin = tc('clipin'), cout = tc('clipout');
    if (sOff === undefined || cin === undefined || cout === undefined) { nyaC(app, 'fr_ImportSpeech', 'the audio clip time control (startoffset / clipin / clipout) in this build; the offset is used for both ends'); sOff = offset; cin = 0; cout = cout ?? 0; }
    const s = Math.round(sOff), tin = Math.round(cin) + s, tout = Math.round(cout) + s;
    // SetValue PlayControl.Out, then PlayControl.In (this build's play control = the animation start / end frames)
    { const an: any = app.anim; const o0 = an.endFrame, i0 = an.startFrame; app.record('SetValue PlayControl', () => { an.endFrame = tout; an.startFrame = tin - 1; }, () => { an.endFrame = o0; an.startFrame = i0; }); setValue(app, 'PlayControl.Out', tout); setValue(app, 'PlayControl.In', tin - 1); }
    const action = call(app, 'CreateSpeechAction', { Face: mesh });
    if (!action) { siError(app, 'ImportSpeech: unable to create speech action'); for (const t of trackSet) call(app, 'DeleteObj', { InputObj: t }); call(app, 'DeleteObj', { InputObj: src }); bar.hide(); return null; }
    const clip = call(app, 'AddClip', { Model: model, Source: action, Track: speechTrack, Time: offset });
    const cn = clip?.fullName ?? clip?.name ?? 'clip';
    setValue(app, `${cn}.actionclip.timectrl.clipin`, tin); setValue(app, `${cn}.actionclip.timectrl.clipout`, tout);
    bar.step('Recognizing Phonemes');
    try {
      const text = readTextFile(app, textF); if (text === null) throw new Error('unreadable transcript');
      const extractor = numArg(a.Language, 0) > 0 ? 'ExtractPhonemesToSpeechOpJapanese' : 'ExtractPhonemesToSpeechOp';
      callStrict(app, extractor, { InputObj: clip, FileName: audio, GuideText: text.replace(/;/g, ' '), FrameOffset: offset, SilenceDuration: silence });
      call(app, 'AddClipRelation', { From: [clip, aclip] });   // CMD-B20a: a two-item From gives master and slave
    } catch {
      siError(app, 'ImportSpeech: phoneme recognition failed');
      for (const t of trackSet) call(app, 'DeleteObj', { InputObj: t }); call(app, 'DeleteObj', { InputObj: action }); call(app, 'DeleteObj', { InputObj: src });
      bar.hide(); return null;
    }
    bar.hide();
    return action;
  });

  // ---------------------------------------------------------------- fr_LoadVisemePose / fr_SaveVisemePose
  reg('fr_LoadVisemePose', [['FileName', null]], (app, a) => {
    const f = unset(a.FileName) ? '' : String(a.FileName);
    if (!fileExists(f)) { siError(app, `Pose "${f}" not found`); return null; }
    return app.run('fr_ApplyFacePose', { posefile: f });
  });
  reg('fr_SaveVisemePose', [['FileName', null]], (app, a) => {
    app.select(allControlsB18(app));
    app.run('fr_SaveFacePose', { selectiononly: true, filename: a.FileName });
  });

  // ---------------------------------------------------------------- fr_CopyVisemeLibrary (always null)
  reg('fr_CopyVisemeLibrary', [['From', null], ['To', null], ['Overwrite', null], ['CopyVisemes', null]], (app, a) => {
    const from = unset(a.From) ? '' : String(a.From); const ow = boolArg(a.Overwrite, false), cv = boolArg(a.CopyVisemes, false);
    if (!folderExists(from)) { siError(app, `Source library "${from}" does not exist`); return null; }
    if (unset(a.To)) { siError(app, 'No destination library specified.'); return null; }
    const to = String(a.To);
    if (!folderExists(to) && !makeFolder(to)) { siError(app, `Unable to create destination library "${to}"`); return null; }
    if (from === to) { siError(app, 'Source and destination is the same directory'); return null; }
    const langs = listFiles(from).filter(f => /\.csv$/i.test(f));
    if (!langs.length) { siError(app, `No language files found under "${from}"`); return null; }
    for (const csv of langs) {
      const x = stripExt(csv);
      if (ow || !fileExists(join(to, csv))) if (!copyFile(join(from, csv), join(to, csv))) { siError(app, `Unable to copy language file"${csv}"`); continue; }
      const sdir = join(from, x), ddir = join(to, x);
      if (!folderExists(sdir)) { siError(app, `Missing source language directory "${sdir}"`); continue; }
      if (!folderExists(ddir) && !makeFolder(ddir)) { siError(app, `Unable to create destination language directory "${ddir}"`); continue; }
      if (!cv) { const n = join(ddir, 'Normal'); if (!folderExists(n) && !makeFolder(n)) siError(app, `Unable to create variation folder "${n}"`); continue; }
      for (const v of listFolders(sdir)) {
        const dv = join(ddir, v); if (!folderExists(dv) && !makeFolder(dv)) { siError(app, `Unable to create variation folder "${dv}"`); continue; }
        for (const f of listFiles(join(sdir, v)).filter(isPose)) {
          if (!ow && fileExists(join(dv, f))) continue;
          if (!copyFile(join(join(sdir, v), f), join(dv, f))) siError(app, `Unable to copy viseme file"${join(join(sdir, v), f)}"`);
        }
      }
    }
    return null;
  });

  // ---------------------------------------------------------------- fr_CreateVisemeVariation
  reg('fr_CreateVisemeVariation', [['Variation', null], ['CopyFrom', null]], (app, a) => {
    const v = unset(a.Variation) ? '' : String(a.Variation); const cf = unset(a.CopyFrom) || a.CopyFrom === '' ? '' : String(a.CopyFrom);
    if (folderExists(v)) { siError(app, `Variation folder "${v}" already exists`); return null; }
    if (cf && !folderExists(cf)) { siError(app, `Based on variation folder "${cf}" not found`); return null; }
    if (!makeFolder(v)) { siError(app, `Unable to create variation directory "${v}"`); return null; }
    if (cf) for (const f of listFiles(cf).filter(isPose)) if (!copyFile(join(cf, f), join(v, f))) siError(app, `Unable to copy viseme file"${join(cf, f)}"`);
    return null;
  });

  // ---------------------------------------------------------------- fr_CreateVisemeShape
  reg('fr_CreateVisemeShape', [['ShapeName', null]], (app, a) => {
    const name = unset(a.ShapeName) ? '' : String(a.ShapeName); if (!name) return null;
    const mesh = faceMeshB18(app, faceModelB18(app, 'fr_CreateVisemeShape'));
    if (!mesh || shapeKeyExists(mesh, name)) return null;
    const r = call(app, 'StoreShapeKey', { InputObj: [mesh], Name: name, RefMode: 'siShapeLocalReferenceMode', Content: 'siShapeContentSecondaryShape', Bake: true });
    if (r) { setValue(app, `${mesh.fullName}.clustershapecombiner.ShowResult`, false); setValue(app, `${mesh.fullName}.clustershapecombiner.SoloIndex`, 1); }
    else siError(app, `Failed to create corrective shape : ${name}`);
    return null;
  });

  // ---------------------------------------------------------------- fr_ImportVisemes
  reg('fr_ImportVisemes', [['Library', null], ['Variation', null], ['Overwrite', null]], (app, a) => {
    const C = 'fr_ImportVisemes';
    const model = faceModelB18(app, C); const lib = unset(a.Library) ? '' : String(a.Library); const ow = boolArg(a.Overwrite, false);
    const existing = () => visemeSources(model);
    const vars = !unset(a.Variation) && a.Variation !== '' ? [String(a.Variation)] : (folderExists(lib) ? listFolders(lib) : []);
    const table = parseLanguage(app, lib + '.csv') ?? [];
    const ctrls = allControlsB18(app);
    const params = ctrls.flatMap(c => ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz'].map(p => c.kinematics.local.get(p)!));
    const reset = () => { for (const c of ctrls) for (const p of ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz']) app.setParam(c.kinematics.local.get(p)!, 0); };
    reset();
    for (const v of vars) {
      const dir = join(lib, v);
      if (!folderExists(dir)) throw scriptError(C, `variation folder "${dir}" cannot be enumerated (inferred)`);
      for (const f of listFiles(dir).filter(isPose)) {
        const path = join(dir, f); const ipa = f.split('_')[0]; const row = table.find(r => r.ipa === ipa);
        if (!row || !(row.type >= 0)) { siInfo(app, `Viseme "${path}" not found in language file - ignoring`); continue; }
        const name = `_${stripExt(f)}_${v}`; const old = existing().find(p => p.name === name);
        if (!ow && old) continue;
        try { app.run('fr_ApplyFacePose', { posefile: path }); } catch { /* ignored */ }
        if (old) deleteNode(app, old);
        call(app, 'StoreViseme', { Model: model, InputObj: params, Name: name, PhonemeType: row.type });
        reset();
      }
    }
    return null;
  });

  // ---------------------------------------------------------------- fr_PrepareForPhonemes (SPEC-PARTIAL)
  reg('fr_PrepareForPhonemes', [], (app) => {
    const C = 'fr_PrepareForPhonemes';
    (app as any).cmdLog = false; setValue(app, 'preferences.scripting.cmdlog', false);   // never restored
    call(app, 'SetControlKeys', {});
    setValue(app, 'Views.ViewB.UserCamera.camvis.attrseluserkeywords', true);
    const markers = app.run('GetTongueMarkers', {});
    if (!app.commands.has('AddTongue')) {
      nyaC(app, C, 'AddTongue(null, <markers>) is not a registered command (an older tongue builder?)');
      throw scriptError(C, 'AddTongue is not defined (inferred: the command fails after the markers were made)');
    }
    return app.run('AddTongue', { Parent: null, Markers: markers });
  });

  // ---------------------------------------------------------------- fr_EditVisemes / fr_AddLipSync
  reg('fr_EditVisemes', [], (app) => {
    const m = faceModelB18(app, 'fr_EditVisemes'); if (!m) throw scriptError('fr_EditVisemes', 'no face model');
    const p = getOrAddProp(app, m, 'fr_Visemes', () => visemesDefs(app));
    attachVisemesPPG(app, p).validate(); inspect(app, p);
    return p;
  });
  reg('fr_AddLipSync', [], (app) => {
    const m = faceModelB18(app, 'fr_AddLipSync'); if (!m) throw scriptError('fr_AddLipSync', 'no face model');
    const p = getOrAddProp(app, m, 'fr_LipSync', () => lipSyncDefs(app));
    attachLipSyncPPG(app, p); inspect(app, p);
  });

  // ================================================================ Tongue.js
  reg('AddToGroup_tongue', [['Model', null], ['gname', null], ['members', null]], (app, a) => {
    const C = 'AddToGroup_tongue';
    const model = objOrName(app, a.Model); if (!model) throw scriptError(C, 'Model is not an object');
    const name = unset(a.gname) ? '' : String(a.gname);
    const members = listOf(a.members).flatMap(x => typeof x === 'string' ? x.split(',') : [x]).map(x => objOrName(app, typeof x === 'string' ? x.trim() : x)).filter((x): x is X3DObject => !!x);
    let g = app.scene.groupList.find(x => x.name === name && ((x as any).model === model || x.parent === (model as any)));
    if (g) { for (const o of members) addToGroup(app, g, o); return g; }
    const ng = new Group(name); ng.parent = model as any; (ng as any).model = model;
    app.record('AddGroup ' + name, () => app.scene.groupList.push(ng), () => { const i = app.scene.groupList.indexOf(ng); if (i >= 0) app.scene.groupList.splice(i, 1); });
    for (const o of members) addToGroup(app, ng, o);
    g = ng; return g;
  });
  reg('GetCompounds_tongue', [['compound1', null], ['compound2', null]], (app, a) => {
    const dir = frFolder(app, 2, 'Compounds', false); if (!dir) return null;
    const out: string[] = [];
    for (const n of [a.compound1, a.compound2]) { const p = dir + (unset(n) ? '' : String(n)); if (!fileExists(p)) { siError(app, `Missing Compound <${p}>`); return null; } out.push(p); }
    return out;
  });
  reg('fr_SetupTongueMaps', [['ControlObjects', null], ['Mesh', null]], (app, a) => {
    const C = 'fr_SetupTongueMaps';
    const ctrls = listOf(a.ControlObjects).map(x => objOrName(app, x)).filter((x): x is X3DObject => !!x);
    const mesh = objOrName(app, a.Mesh); if (!isPolymesh(mesh)) throw scriptError(C, 'Mesh is not a polygon mesh');
    if (ctrls.length < 2) throw scriptError(C, `a curve needs control objects (${ctrls.length} given)`);
    if (ctrls.length < 4) nyaC(app, C, `the degree-3 curve with fewer than 4 control objects (${ctrls.length}); this build lowers the degree`);
    const crvData = makeCurve(ctrls.map(c => { const p = globalPos(c); return [p.x, p.y, p.z] as [number, number, number]; }), 3, false);
    const curve = new X3DObject(app.scene.uniqueName('temptonguecurve'), 'crvlist'); const prim = new Primitive('NURBS Curve List', 'crvlist');
    prim.addOperator(new FrozenGeomOperator(crvData, 'Curve')); curve.setPrimitive(prim); addObject(app, curve);
    let cls = mesh.clusters.find(c => c.name === 'TongueCluster' && c.isComplete);
    const n = (mesh.primitive?.mesh()?.positions.length ?? 0) / 3;
    if (!cls) cls = addCluster(app, mesh, 'TongueCluster', 'pnt', Array.from({ length: n }, (_, i) => i), true);
    const getMap = (name: string, rgb: [number, number, number]) => {
      let p = cls!.properties.find(x => x.name === name && (x.type === 'wtmap' || x.type === 'weightmap'));
      if (!p) p = addClusterProp(app, cls!, weightMap(name, rgb, n));
      p.set('red', rgb[0]); p.set('green', rgb[1]); p.set('blue', rgb[2]);
      (p as any).values = new Map(Array.from({ length: n }, (_, i) => [i, 1])); return p;
    };
    const umap = getMap('UMap', [255, 125, 0]);
    const [u0, u1] = curveDomain(crvData); const S = 64 * Math.max(1, crvData.cvs.length);
    const samples = Array.from({ length: S + 1 }, (_, i) => { const u = u0 + (u1 - u0) * i / S; return { u, p: new THREE.Vector3(...evalCurve(crvData, u)) }; });
    const pos = mesh.primitive!.mesh()!.positions; const g = mesh.globalMatrix(); const vals = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const w = new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(g);
      let best = Infinity, bu = u0; for (const s of samples) { const d = s.p.distanceToSquared(w); if (d < best) { best = d; bu = s.u; } }
      vals.set(i, (bu - u0) / (u1 - u0 || 1));
    }
    (umap as any).values = vals;
    const blend = getMap('Blend', [125, 255, 0]);
    b18(app).calls.push({ name: 'FreezeObj', args: { InputObjs: umap.fullName } });
    deleteNode(app, curve);
    return [umap, blend];
  });
  reg('fr_BuildTongueAfterSolve', [], (app) => {
    const m = faceModelB18(app, 'fr_BuildTongueAfterSolve');
    if (!m) { siError(app, 'FaceRobot model was not found.'); return undefined; }
    const p = getOrAddProp(app, m, 'TongueSetup', tongueSetupDefs);
    attachTongueSetupPPG(app, p); inspect(app, p);
    return p;
  });
  reg('fr_ScaleTongueMesh', [['Mesh', null], ['Markers', null]], (app, a) => {
    const C = 'fr_ScaleTongueMesh';
    const mesh = objOrName(app, a.Mesh); if (!mesh) return false;
    const mk = vectors(a.Markers); if (!mk || !mk.length) throw scriptError(C, 'Markers is not an array of vectors');
    setGlobalPos(app, mesh, mk[0]);
    const T = mesh.globalMatrix().clone(); const Ti = T.clone().invert();
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity); for (const v of mk) max.max(v);
    const pos = mesh.primitive?.mesh()?.positions; if (!pos) return true;
    const box = new THREE.Box3(); for (let i = 0; i < pos.length; i += 3) box.expandByPoint(new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]));
    const c = box.getCenter(new THREE.Vector3()), e = box.getSize(new THREE.Vector3()); const h = c.clone().addScaledVector(e, 0.5);
    const d = max.clone().sub(mk[0]); const sc = new THREE.Vector3(d.z / h.z, d.y / h.y, d.z / h.z);
    const out: number[][] = [];
    for (let i = 0; i < pos.length; i += 3) { const w = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(T).sub(mk[0]).multiply(sc).add(mk[0]).applyMatrix4(Ti); out.push([w.x, w.y, w.z]); }
    const polys = mesh.primitive!.mesh()!.polygons.map(f => f.slice()); const prim = mesh.primitive!;
    const op = new FrozenGeomOperator(build(out, polys), 'Geometry'); const old = [...prim.operators];
    app.record('FreezeObj + Geometry.Set', () => { prim.operators.splice(0, prim.operators.length, op); op.parent = prim; prim.dirty = true; }, () => { prim.operators.splice(0, prim.operators.length, ...old); prim.dirty = true; });
    return true;
  });
  reg('fr_IsHeadMesh', [['Mesh', null]], (app, a) => {
    const mesh = objOrName(app, a.Mesh); if (!mesh) throw scriptError('fr_IsHeadMesh', 'Mesh is empty');
    const fc = mesh.model ? propNamed(mesh.model, 'FaceConnections') : undefined; const v = fc?.get('Mesh') ? String(fc.val('Mesh') ?? '') : null;
    if (v !== null && v.includes('.') && v.slice(v.indexOf('.') + 1) === mesh.name) return true;
    return !!mesh.primitive?.operators.some(op => op.name === 'Facial Soft Tissue');
  });
  reg('GetTongueMarkers', [], (app) => getTongueMarkers(app), { noLog: true });
  reg('fr_FitTongueAfterSolveStage', [['TongueMesh', null]], (app, a) => {
    const head = entryObject(app, 'hpoints', 'HeadNull'); const markers = app.run('GetTongueMarkers', {});
    let r: any;
    try { r = callStrict(app, 'fr_FitTongue', { HeadNull: head, TongueMesh: a.TongueMesh, TongueMarkers: markers, MustDeleteMarkers: true }); } catch { r = undefined; }
    if (!r || (Array.isArray(r) && !r.length)) siError(app, 'Failed to fit tongue');
  });
  reg('fr_SolveTongueAfterSolveStage', [], (app) => {
    call(app, 'DeselectAll', {});
    const r = call(app, 'fr_SolveTongue', {}); if (!r) siError(app, 'Failed to solve tongue');
  });
  reg('GetTongueScale', [['MarkerVectors', null]], (app, a) => {
    const C = 'GetTongueScale';
    if (unset(a.MarkerVectors)) throw scriptError(C, 'MarkerVectors is missing (the Tongue,Base / Tongue,Tip fallback is never reached)');
    const mk = vectors(a.MarkerVectors);
    if (!mk || !mk.length) { nyaC(app, C, 'argument marshalling of a list without `length` (a SAFEARRAY from VBScript / Python / C++)'); return undefined; }
    return mk[mk.length - 1].clone().sub(mk[0]);
  });
}

/** GetTongueMarkers body (cmd-b18c §4). */
function getTongueMarkers(app: App): X3DObject[] | null {
  const C = 'GetTongueMarkers';
  const model = faceModelB18(app, C); if (!model) throw scriptError(C, 'no face model');
  const fit = [...model.descendants()].find(o => o.name === 'Fit') ?? newNull(app, 'Fit', model);
  const have = [...fit.descendants()].filter(o => o.name.startsWith('Tongue'));
  if (have.length) return have;
  const sets = [['Control', 'Jaw', 'End'], ['Control', 'Lower', 'Mouth'], ['Control', 'Upper', 'Mouth'], ['Control', 'Head']];
  const objs: X3DObject[] = [];
  for (const k of sets) { const o = getKeyedIn(app, k, model)[0]; if (!o) { siError(app, `Object Keyed [${k.join(',')}] not found`); siError(app, 'Control not found'); return null; } objs.push(o); }
  const [A, B, Cc, D] = objs.map(keyedPos);
  const lerp = (p: THREE.Vector3, q: THREE.Vector3, t: number) => p.clone().lerp(q, t);
  const b = lerp(A, D, 0.5); b.y = lerp(A, B, 0.4).y;
  const k = lerp(A, b, 0.8); k.y = lerp(B, Cc, 0.8).y;
  const f = lerp(B, k, 0.6); f.y = Cc.y;
  const t = lerp(B, f, 0.5);
  const sel = app.selection.slice(); const out: X3DObject[] = [];
  for (const [n, p] of [['TongueBase', b], ['TongueBack', k], ['TongueFront', f], ['TongueTip', t]] as [string, THREE.Vector3][]) { const o = newNull(app, n, fit); setGlobalPos(app, o, p); out.push(o); }
  app.select(sel);
  return out;
}
export { getTongueMarkers, isInScene, Model, Cluster };
