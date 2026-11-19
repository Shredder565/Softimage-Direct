// Ledger row CMD-B11c (tasks.dll), part 2: presets and references.
//   CreatePreset SavePreset SILoadPreset InspectExternalReference SetReference
// Brief: docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md, section 3. Original code from that prose only.
//
// Preset files are JSON documents in the session's virtual host file system (PresetData in tasksB11cShared.ts): the
// class id (stand-in: the node type), the family, the writable parameter values, the description and whether a
// thumbnail was asked for. The binary preset format is not modelled.
import { App, CommandDef } from '../core/commands';
import { Node, Material, Shader } from '../core/scene';
import { Parameter } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { boolArg, findNode } from './viewEditPropertyHelpers';
import {
  S_OK, S_FALSE, SI_ABORT, E_INVALIDARG, E_POINTER, E_UNEXPECTED, E_ACCESSDENIED, STG_E_FILENOTFOUND,
  stateOf, fail, setStatus, raise, logNya, text, unset, nodeArg, enumArg, extOf, isAbsolute, installPath, interactive,
  familyOf, findFamily, classIdOf, readPreset, presetParams, resolvePresetFile, PresetObject, type PresetData,
} from './tasksB11cShared';

// inferred: siPresetLocation member numbers (the binary reads 0..4: 0/1 factory, 2 user, 3 workgroup, 4 project)
const PRESET_LOCATION: Record<string, number> = { siDefaultLocation: 0, siFactoryLocation: 1, siUserLocation: 2, siWorkgroupLocation: 3, siProjectLocation: 4 };
const LOCATION_TO_PATH = [3, 3, 1, 2, 0];
const PRESET_EXT = '.Preset';

function createPreset(app: App, a: Record<string, any>) {
  const C = 'CreatePreset';
  const name = text(a.Name), family = text(a.Family), path = text(a.Path);
  if (!name) throw fail(E_POINTER, `${C}: no preset name`);
  let fam: string | null = null;
  if (family) { fam = findFamily(family); if (!fam) { raise(app, C, '0x3eb', family); throw fail(E_INVALIDARG, `${C}: unknown preset family "${family}"`); } }
  const file = path ? hostFs.join(path, name) : name;
  // SICreateObjectFromPreset stand-in: the preset file must exist (resolved like SILoadPreset when it is not absolute)
  const found = resolvePresetFile(app, file, fam);
  const data = found ? readPreset(found) : null;
  if (!found || !data) {
    // 0x80030002, or 0x8000ffff with a known family: raise 0x1b with the name, return 1
    raise(app, C, '0x1b', name); setStatus(app, C, S_FALSE); a.PresetObj = null; return null;
  }
  const obj = new PresetObject(name, found, fam ?? data.family ?? null, data);
  a.PresetObj = obj; setStatus(app, C, S_FALSE);
  return obj;   // Undo / Redo do nothing
}

function savePreset(app: App, a: Record<string, any>) {
  const C = 'SavePreset';
  const obj = nodeArg(app, a.InputObj);
  const rawName = text(a.PresetName);
  if (!obj || !rawName) throw fail(E_INVALIDARG, `${C}: InputObj and PresetName are required`);
  if (obj instanceof Material || obj instanceof Shader) logNya(app, C, 'which parameter source replaces an object of a shader container; the object itself is saved');
  const family = familyOf(obj);
  // the file name: PresetName's own directory is kept when it exists
  const dirOfName = hostFs.parentPath(rawName);
  const baseName = hostFs.baseName(rawName).replace(/\.preset$/i, '');
  let file = '';
  if (dirOfName && isAbsolute(rawName) && hostFs.isFolder(dirOfName)) file = hostFs.join(dirOfName, baseName + PRESET_EXT);
  const presetPath = text(a.PresetPath);
  if (!file && presetPath) {
    if (!isAbsolute(presetPath)) { raise(app, C, '0x25', presetPath); throw fail(E_INVALIDARG, `${C}: PresetPath "${presetPath}" is relative`); }
    hostFs.ensureFolder(presetPath); file = hostFs.join(presetPath, baseName + PRESET_EXT);
  }
  if (!file) {
    const loc = enumArg(a.PresetLocation, PRESET_LOCATION) ?? 0;
    const root = installPath(app, LOCATION_TO_PATH[loc] ?? 3);
    if (!root) { logNya(app, C, `an empty install path for location ${loc}; nothing was written`); setStatus(app, C, S_OK); return null; }
    let dir = hostFs.join(root, 'Data\\DSPresets'); if (family) dir = hostFs.join(dir, family);
    hostFs.ensureFolder(dir); file = hostFs.join(dir, baseName + PRESET_EXT);
  }
  const existed = hostFs.isFile(file); const before = existed ? hostFs.readFile(file) : null;
  if (existed && !boolArg(a.Overwrite)) { raise(app, C, '0x3b', file); throw fail(E_ACCESSDENIED, `${C}: "${file}" exists`); }
  const data: PresetData = { preset: 1, classId: classIdOf(obj), family, name: baseName, params: presetParams(obj), description: text(a.Description), thumbnail: boolArg(a.CreateThumbnail) };
  if (data.thumbnail) logNya(app, C, 'the viewport thumbnail; only the request is recorded in the preset');
  const json = JSON.stringify(data);
  // Undo (inferred): restores the previous file, or deletes the written one
  app.record('SavePreset', () => hostFs.writeFile(file, json), () => { if (before === null) { try { hostFs.deleteFile(file); } catch { /* gone */ } } else hostFs.writeFile(file, before); });
  const out = new PresetObject(baseName, file, family, data);
  a.Value = out; setStatus(app, C, S_OK);
  return out;
}

function siLoadPreset(app: App, a: Record<string, any>) {
  const C = 'SILoadPreset';
  const name = text(a.FileName); const obj = nodeArg(app, a.InputObj);
  if (!name || !obj) throw fail(E_INVALIDARG, `${C}: FileName and InputObj are required`);
  const st = stateOf(app);
  const firstRun = !st.altMode;   // alternate mode forces the first-run flag to 0
  const family = familyOf(obj);
  let file = resolvePresetFile(app, name, family);
  if (!file) {
    if (!interactive(app)) throw fail(STG_E_FILENOTFOUND, `${C}: preset "${name}" not found`);
    raise(app, C, 'simsgcat 0x95', name);
    const picked = st.hooks.pickPresetFile?.(name);
    if (!picked) {
      if (!st.hooks.pickPresetFile) logNya(app, C, 'the preset file picker; no file was picked');
      setStatus(app, C, SI_ABORT); return;   // inferred: no file picked = cancelled
    }
    file = picked;
  }
  const data = readPreset(file);
  if (!data) throw fail(STG_E_FILENOTFOUND, `${C}: cannot open "${file}"`);
  if (!data.classId) throw fail(E_UNEXPECTED, `${C}: "${file}" has no class id`);
  if (data.classId !== classIdOf(obj)) { raise(app, C, '0x52', file); throw fail(E_INVALIDARG, `${C}: "${file}" is a ${data.classId} preset, ${obj.fullName} is a ${classIdOf(obj)}`); }
  const params = obj.params.filter(p => Object.prototype.hasOwnProperty.call(data.params ?? {}, p.name) && !p.def.readOnly);
  const old = new Map<Parameter, any>(params.map(p => [p, p.value]));   // OldPresetStream
  const apply = () => { for (const p of params) p.value = data.params[p.name]; app.events.emit('params'); };
  if (firstRun) app.record('SILoadPreset', apply, () => { for (const [p, v] of old) p.value = v; app.events.emit('params'); });
  else apply();
  // "save keys at current time" child task (inferred): animated parameters get a key at the current frame
  for (const p of params) {
    if (!app.anim.isAnimated(p)) continue;
    const t = app.anim.frame; const fc = app.anim.fcurve(p)!; const had = fc.keys.find(k => k.time === t); const hadV = had?.value;
    app.record('SaveKey', () => app.anim.setKey(p, t, p.value), () => { if (had) app.anim.setKey(p, t, hadV); else app.anim.removeKey(p, t); });
  }
  setStatus(app, C, S_OK);
}

/** Reference holders of InspectExternalReference (stand-ins, asked in this order). */
function referenceNames(app: App, n: Node): string[] | null {
  const own = (n as any).externalReferences;
  if (Array.isArray(own)) return own.map(String);
  const refs = stateOf(app).references.get(n);
  if (refs) return [...refs.values()].flat().map(v => text(v)).filter(Boolean);
  const fileParams = n.params.filter(p => p.def.type === 'string' && /file|path/i.test(p.name));
  if (fileParams.length) return fileParams.map(p => String(p.value ?? '')).filter(Boolean);
  return null;
}

/** SetReference Target -> (owner, descriptor). The descriptor's meaning was not read (open question 3). */
function referenceTarget(app: App, v: any): { owner: Node; descriptor: string } | null {
  if (v instanceof Node) return { owner: v, descriptor: 'Reference' };
  const s = text(v); if (!s) return null;
  const n = findNode(app, s); if (n) return { owner: n, descriptor: 'Reference' };   // inferred default descriptor
  const i = s.lastIndexOf('.');
  const owner = i > 0 ? findNode(app, s.slice(0, i)) : undefined;
  return owner ? { owner, descriptor: s.slice(i + 1) } : null;
}

export function registerTasksB11cPresetCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);

  reg({
    name: 'CreatePreset', label: 'Create Preset', category: '', description: 'Create a preset using the path/name and family',
    args: [{ name: 'Name', default: '' }, { name: 'Family', default: '' }, { name: 'Path', default: '' }],
    execute: (app, a) => createPreset(app, a),
  });
  reg({
    name: 'SavePreset', label: 'Save Preset', category: 'File|Property', description: 'Save an object in a preset',
    args: [{ name: 'InputObj', default: null }, { name: 'PresetName', default: null }, { name: 'PresetPath', default: '' }, { name: 'PresetLocation', default: ':siDefaultLocation:siPresetLocation' },
      { name: 'Overwrite', default: true }, { name: 'CreateThumbnail', default: true }, { name: 'Description', default: '' }],
    execute: (app, a) => savePreset(app, a),
  });
  reg({
    name: 'SILoadPreset', label: 'Load Preset', category: 'File|Property', description: 'Load the preset in the object',
    args: [{ name: 'FileName', default: '' }, { name: 'InputObj', default: null }],
    execute: (app, a) => siLoadPreset(app, a),
  });
  reg({
    name: 'InspectExternalReference', label: 'Inspect External Reference', category: '',
    args: [{ name: 'Target', default: null }],
    execute(app, a) {
      const C = 'InspectExternalReference';
      const t = nodeArg(app, a.Target);
      if (!t) throw fail(E_POINTER, `${C}: no target`);
      a.Value = '';
      const names = referenceNames(app, t);
      if (!names) throw fail(E_INVALIDARG, `${C}: ${t.fullName} holds no external references`);
      a.Value = names.join(','); setStatus(app, C, S_OK);
      return a.Value;
    },
  });
  reg({
    name: 'SetReference', label: 'Set Reference', category: 'Edit',
    args: [{ name: 'Target', default: null }, { name: 'Value', default: null }, { name: 'Time', default: null }],
    execute(app, a) {
      const C = 'SetReference';
      const t = referenceTarget(app, a.Target);
      if (!t) throw fail(E_INVALIDARG, `${C}: no target`);
      logNya(app, C, `what kind of reference the descriptor "${t.descriptor}" of ${t.owner.fullName} names; the value is kept in this build's reference store`);
      if ((t.owner as any).locked === true) throw fail(E_ACCESSDENIED, `${C}: ${t.owner.fullName} is locked`);
      if (!Array.isArray(a.Value)) throw fail(E_INVALIDARG, `${C}: Value must be an array`);
      const seconds = unset(a.Time) ? app.anim.frame / app.anim.fps : Number(a.Time) / app.anim.fps;
      const refs = stateOf(app).references; const now = [...a.Value];
      const byOwner = refs.get(t.owner); const had = byOwner?.has(t.descriptor) ?? false; const old = byOwner?.get(t.descriptor) ?? [];
      const write = (v: any[] | null) => {
        let m = refs.get(t.owner); if (!m) refs.set(t.owner, m = new Map());
        if (v === null) { m.delete(t.descriptor); if (!m.size) refs.delete(t.owner); } else m.set(t.descriptor, [...v]);
        (t.owner as any).referenceTime = seconds; app.events.emit('scene');   // refresh
      };
      app.record('SetReference', () => write(now), () => write(had ? old : null));
      setStatus(app, C, S_OK);
    },
  });
}
