// Ledger row CMD-B11c (tasks.dll), part 1: scene save, export, cache copy, preferences, keyboard, undo helpers.
//   SaveSceneAs SaveBackupScene ExportCustomFile CopyCacheFiles2 GetUserPref GetKeyboardState
//   SISaveDuplicateXformForUndo TagForDelete
// Brief: docs/ghidra/cmd-b11c-tasks-scene-preset-curve-inspect-binary.md, section 3. Original code from that prose only.
import { App, CommandDef } from '../core/commands';
import { X3DObject } from '../core/scene';
import { hostFs } from '../core/sdkHelpersHostFs';
import { pref } from './uixsiKeysSourcesMaterialsShared';
import { boolArg } from './viewEditPropertyHelpers';
import {
  S_OK, S_FALSE, SI_ABORT, E_INVALIDARG, E_POINTER, E_FAIL, E_UNEXPECTED, EV_BEGIN_EXPORT, EV_END_EXPORT,
  stateOf, fail, setStatus, raise, logNya, text, unset, nodesArg, enumArg, extOf, isAbsolute, frameworkSaveScene, findConverter, fireEvent,
  runConverter, currentSceneName, ownerModel, type ConverterCtx,
} from './tasksB11cShared';
import { alembicState } from './alembicSeqCam';

// inferred: siExternalFilesOperation member numbers (the binary accepts 0..2)
const COPY_EXT: Record<string, number> = { siDoNotCopyExtFiles: 0, siCopyExtFilesUnderProject: 1, siCopyExtFilesUnderScene: 2 };

/** Save the scene to `file` (.scn / .exp through the save entry, other extensions through a custom converter). */
function saveTo(app: App, C: string, file: string, allowNoExt: boolean): number {
  const ext = extOf(file).toLowerCase(); const alt = stateOf(app).altMode;
  if (ext === 'scn' || (alt && ext === 'exp') || (allowNoExt && ext === '')) return frameworkSaveScene(app, C, file);
  const conv = findConverter(app, ext);
  if (!conv) throw fail(E_INVALIDARG, `${C}: no custom export converter for ".${ext}"`);
  return runConverter(app, conv, { fileName: file, target: [app.scene.root], frame: app.anim.frame, userData: null, command: C });
}

/** DS_SZ_SEGMENT_PATHNAME: the current scene's path. This build keeps no scene path of its own: the last path a save
 *  command wrote, else `<project>\Scenes\<scene name>.scn` (inferred). */
function currentScenePath(app: App): string {
  const own = (app as any).scenePath; if (typeof own === 'string' && own) return own;
  const saved = stateOf(app).savedScenes; if (saved.length) return saved[saved.length - 1];
  return hostFs.join(hostFs.join(alembicState.projectPath, 'Scenes'), `${currentSceneName()}.scn`);
}
/** External-file copy helper 0x180083750: runs CopyExtFilesIntoProject (Models "", UpdateSourcePaths true,
 *  ConsiderOnlyFilesUnderProject = mode 2, Overwrite default). NULL path E_POINTER, mode 0 E_INVALIDARG; returns its HRESULT. */
function copyExtFiles(app: App, path: string, mode: number): number {
  if (!path) return E_POINTER;
  if (mode === 0) return E_INVALIDARG;
  try {
    app.run('CopyExtFilesIntoProject', { SceneFileName: path, Models: '', UpdateSourcePaths: true, ConsiderOnlyFilesUnderProject: mode === 2 });
    return S_OK;
  } catch (e: any) { return Number(e?.status) || E_FAIL; }
}

function saveSceneAs(app: App, a: Record<string, any>) {
  // Batch 12 (note Q2): an empty SceneFileName saves to the current scene path; the normalised name is written back into
  // the argument and the extension test uses it. CopyExtFiles 1 / 2 run CopyExtFilesIntoProject (2: files under the
  // project only); its result is ignored.
  const C = 'SaveSceneAs';
  const st = stateOf(app); st.progress.push('');   // the progress bar is reset
  const mode = enumArg(a.CopyExtFiles, COPY_EXT) ?? 0;
  if (mode < 0 || mode > 2) throw fail(E_INVALIDARG, `${C}: CopyExtFiles must be 0..2`);
  const given = text(a.SceneFileName);
  if (mode !== 0) copyExtFiles(app, given, mode);   // 1. argument 0 as given
  // 2. pending operations: none are queued in this build
  // 3. target file name: the given name, or the current scene path; normalised by the path object, written back
  let file = given || currentScenePath(app);
  try { file = hostFs.normalize(file); } catch { /* the path object keeps an unnormalisable name as given (inferred) */ }
  a.SceneFileName = file;
  a.CopyExtFiles = mode;
  const r = saveTo(app, C, file, false);
  if (r !== S_OK) { raise(app, C, 'XSITASKS 0x43a', file); throw fail(E_FAIL, `${C}: could not save "${file}"`); }
  setStatus(app, C, S_FALSE);
  return file;
}

function saveBackupScene(app: App, a: Record<string, any>) {
  const C = 'SaveBackupScene';
  let name = text(a.SceneFileName);
  if (!name) name = text(pref(app, 'data_management.manual_backup_project_path', pref(app, 'preferences.data_management.manual_backup_project_path', '')));
  if (!name) { raise(app, C, '0x24'); throw fail(E_FAIL, `${C}: no backup path`); }
  let file: string;
  try { file = hostFs.normalize(name); } catch { raise(app, C, '0x24', name); throw fail(E_FAIL, `${C}: invalid path "${name}"`); }
  const project = hostFs.normalize(alembicState.projectPath);   // the project manager of this build knows one project
  const inProject = file.toLowerCase() === project.toLowerCase() || file.toLowerCase().startsWith(project.toLowerCase() + '\\');
  if (!inProject) { raise(app, C, '0x24', file); throw fail(E_FAIL, `${C}: "${file}" is not in a project`); }
  const alt = stateOf(app).altMode; let ext = extOf(file);
  if (!ext) {
    const dir = hostFs.join(project, 'Backup_Manual'); const e = alt ? '.exp' : '.scn'; const scene = currentSceneName();
    let n = 1; let f = '';
    do { f = hostFs.join(dir, `${scene}_Backup${String(n).padStart(2, '0')}${e}`); n++; } while (hostFs.exists(f));
    file = f; ext = e.slice(1);
  } else if (alt && ext.toLowerCase() === 'scn') file = file.slice(0, -3) + 'exp';
  a.SceneFileName = file;
  const r = saveTo(app, C, file, true);
  if (r !== S_OK) { raise(app, C, 'XSITASKS 0x43b', file); throw fail(E_FAIL, `${C}: could not save "${file}"`); }
  setStatus(app, C, S_FALSE);
  return file;
}

function exportCustomFile(app: App, a: Record<string, any>) {
  const C = 'ExportCustomFile';
  const file = text(a.FileName); const ext = extOf(file);
  // DSValidateWriteDestination stand-in: an invalid path is refused (0xa0), a missing folder is "not writable" (0x51)
  let valid = !!file && isAbsolute(file); try { if (valid) hostFs.normalize(file); } catch { valid = false; }
  if (!valid) { app.logMsg('error', `${C}: [0xa0] ${file}`); throw fail(E_INVALIDARG, `${C}: invalid destination "${file}"`); }
  if (!hostFs.isFolder(hostFs.parentPath(file))) { app.logMsg('error', `${C}: [0x51] ${file}`); throw fail(E_INVALIDARG, `${C}: destination "${file}" is not writable`); }
  const conv = findConverter(app, ext);
  if (!conv) { app.logMsg('error', `${C}: [XSITASKS 0x427] ${ext}`); throw fail(E_INVALIDARG, `${C}: no custom converter for ".${ext}"`); }
  let target = nodesArg(app, a.Target, false); if (!target.length) target = [app.scene.root];
  const frame = Math.trunc(unset(a.Frame) ? app.anim.frame : Number(a.Frame) || 0);   // inferred: an omitted Frame is the current frame
  const ctx: ConverterCtx = { fileName: file, target, frame, userData: a.UserData ?? null, command: C };
  const st = stateOf(app);
  const b = fireEvent(app, EV_BEGIN_EXPORT, 'siOnBeginFileExport', ctx, st.beginExportHandlers);
  if (b === SI_ABORT) { setStatus(app, C, SI_ABORT); return; }
  const r = runConverter(app, conv, ctx);
  fireEvent(app, EV_END_EXPORT, 'siOnEndFileExport', ctx);
  setStatus(app, C, r);
  if (r !== S_OK && r !== S_FALSE) throw fail(r, `${C}: the converter "${conv.name}" failed`);
}

/** Cache path template: tokens [model] [object] [version] [frame] (inferred spelling; the resolver was not read). */
function resolveTemplate(tpl: string, t: { model: string; object: string; version: string; frame: number }): string | null {
  const out = tpl.replace(/\[(model|object|version|frame)\]/gi, (_, k: string) => String((t as any)[k.toLowerCase()]));
  return /\[[^\]]*\]/.test(out) ? null : out;
}
function copyCacheFiles2(app: App, a: Record<string, any>) {
  const C = 'CopyCacheFiles2';
  const src = text(a.SourcePath), dst = text(a.TargetPath);
  if (!src || !dst) throw fail(E_INVALIDARG, `${C}: SourcePath and TargetPath are required`);
  const overwrite = boolArg(a.Overwrite), progress = boolArg(a.ShowProgressbar), version = text(a.Version);
  const st = stateOf(app);
  // cache entries (0x180076730 not opened): inferred: one per object, scene play range
  logNya(app, C, 'the cache entry list builder; one entry per object over the play range is used');
  const entries = nodesArg(app, a.ObjectsToCache).filter((n): n is X3DObject => n instanceof X3DObject)
    .map(o => ({ model: ownerModel(o), object: o.name, start: app.anim.startFrame, count: app.anim.endFrame - app.anim.startFrame + 1 }));
  if (progress) st.progress.push('[XSITASKS 0x433]');
  let failed = 0, copied = 0;
  for (const e of entries) {
    if (progress) st.progress.push(`Copying cache files for ${e.model}.${e.object}`);
    const tok = (frame: number) => ({ model: e.model, object: e.object, version, frame });
    const firstDst = resolveTemplate(dst, tok(e.start));
    if (firstDst === null) throw fail(E_UNEXPECTED, `${C}: unresolved token in "${dst}"`);
    try { hostFs.ensureFolder(hostFs.parentPath(firstDst)); } catch { app.logMsg('error', `${C}: [XSITASKS 0x420] ${hostFs.parentPath(firstDst)}`); failed++; continue; }
    const once = /\.pc2$/i.test(src);
    for (let i = 0; i < (once ? 1 : e.count); i++) {
      const f = e.start + i; const s = resolveTemplate(src, tok(f)), d = resolveTemplate(dst, tok(f));
      if (s === null || d === null) throw fail(E_UNEXPECTED, `${C}: unresolved token in a cache path template`);
      if (!hostFs.isFile(s)) { app.logMsg('error', `${C}: [XSITASKS 0x420] ${s}`); failed++; continue; }
      if (hostFs.exists(d) && !overwrite) { failed++; continue; }   // CopyFileW fail-if-exists
      try { hostFs.writeFile(d, hostFs.readFile(s)); copied++; } catch { failed++; }
    }
  }
  if (failed || !copied) { app.logMsg('error', `${C}: [XSITASKS 0x41c]`); app.logMsg('error', `${C}: [XSITASKS 0x41d]`); }
  setStatus(app, C, S_FALSE);
  return { Copied: copied, Failed: failed };
}

/** GetUserPref: preferences manager, then ambient values, then the CPM helper; the remapped name for all three (batch 12). */
function getUserPref(app: App, a: Record<string, any>) {
  const C = 'GetUserPref';
  const name = typeof a.Target === 'string' ? a.Target : unset(a.Target) ? '' : null;
  if (name === null) throw fail(E_INVALIDARG, `${C}: Target must be a string`);
  if (!name) throw fail(E_POINTER, `${C}: no preference name`);
  const remapped = name;   // SIRemapUserPref: the legacy name table was not read (identity)
  const mgr: Record<string, () => any> = { autoinspect: () => app.autoInspect, autokey: () => app.autoKey };
  const bag: Record<string, any> = (app as any).userPrefs ?? {};
  const hit = Object.keys(bag).find(k => k.toLowerCase() === remapped.toLowerCase());
  let v: any;
  if (mgr[remapped.toLowerCase()]) v = mgr[remapped.toLowerCase()]();
  else if (hit !== undefined) v = bag[hit];
  else {
    const amb = pref(app, remapped, undefined) ?? pref(app, 'preferences.' + remapped, undefined);
    if (amb !== undefined) v = amb;
    else if (/^operationmode$/i.test(remapped)) v = (app as any).immediate ? 1 : 0;   // CPM helper (remapped name; also after an S_FALSE ambient answer): the MCP's Immed flag (stand-in)
    else { logNya(app, C, `the legacy-name table and the CPM helper; "${remapped}" is not known`); throw fail(E_FAIL, `${C}: unknown preference "${remapped}"`); }
  }
  a.Value = v; setStatus(app, C, S_FALSE);
  return v;
}

let keyboardHooked = false;
function hookKeyboard(app: App) {
  if (keyboardHooked || typeof window === 'undefined') return; keyboardHooked = true;
  const st = stateOf(app);
  const upd = (e: KeyboardEvent | MouseEvent) => { st.keyboard.shift = e.shiftKey; st.keyboard.ctrl = e.ctrlKey; st.keyboard.alt = e.altKey; };
  window.addEventListener('keydown', upd, true); window.addEventListener('keyup', upd, true);
  window.addEventListener('mousemove', e => { upd(e); st.pointer = { x: e.clientX, y: e.clientY }; }, true);
  window.addEventListener('blur', () => { st.keyboard.shift = st.keyboard.ctrl = st.keyboard.alt = false; });
}

const XFORM_KEYS = ['sx', 'sy', 'sz', 'rx', 'ry', 'rz', 'tx', 'ty', 'tz'];
/** Preferences.Duplicate transform block (the CMD-B7 operators-scripts store, or this row's fallback). */
const duplicatePrefs = (app: App): Record<string, number> => (app as any).operatorsScripts?.prefs?.duplicate ?? stateOf(app).duplicatePrefs;

export function registerTasksB11cSceneCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);
  hookKeyboard(app);

  reg({
    name: 'SaveSceneAs', label: 'Save Scene As', category: 'File', undoable: false,
    args: [{ name: 'SceneFileName', default: null }, { name: 'CopyExtFiles', default: ':siDoNotCopyExtFiles:siExternalFilesOperation' }],
    execute: (app, a) => saveSceneAs(app, a),
  });
  // CopyExtFilesIntoProject (modeltasks.dll per docs/re/COMMAND_DLL_MAP.md): named by the batch-12 SaveSceneAs answer and
  // missing from the bus. Registry arguments; the body is outside tasks.dll, so the call is recorded and logged.
  if (!app.commands.has('CopyExtFilesIntoProject')) reg({
    name: 'CopyExtFilesIntoProject', label: 'Copy External Files Into Project', category: 'File', undoable: false,
    args: [{ name: 'SceneFileName', default: '' }, { name: 'Overwrite', default: false }, { name: 'Models', default: null }, { name: 'UpdateSourcePaths', default: true },
      { name: 'Files', default: '' }, { name: 'IgnoreFilesFromRefModel', default: true }, { name: 'ConsiderOnlyFilesUnderProject', default: false },
      { name: 'ExcludedPaths', default: 'ExcludedPaths_UsePrefValue' }, { name: 'ForceUseToken', default: false }],
    execute(app, a) {
      const C = 'CopyExtFilesIntoProject';
      ((stateOf(app) as any).copyExtCalls ??= []).push({ ...a });
      logNya(app, C, 'the external-file copy itself (modeltasks.dll); the request is recorded in app.tasksB11c.copyExtCalls');
      setStatus(app, C, S_OK);
    },
  });
  reg({
    name: 'SaveBackupScene', label: 'Save Backup Scene', category: 'File', undoable: false,
    args: [{ name: 'SceneFileName', default: '' }],
    execute: (app, a) => saveBackupScene(app, a),
  });
  reg({
    name: 'ExportCustomFile', label: 'Custom File Export', category: '', undoable: false,
    args: [{ name: 'FileName', default: '' }, { name: 'Target', default: null }, { name: 'Frame', default: null }, { name: 'UserData', default: null }],
    execute: (app, a) => exportCustomFile(app, a),
  });
  reg({
    name: 'CopyCacheFiles2', label: 'Copy Cache Files', category: 'File', description: 'Copy the external files under the current project', undoable: false,
    args: [{ name: 'ObjectsToCache', default: null }, { name: 'SourcePath', default: '' }, { name: 'TargetPath', default: '' }, { name: 'Overwrite', default: false },
      { name: 'ShowProgressbar', default: true }, { name: 'Version', default: 'A' }],
    execute: (app, a) => copyCacheFiles2(app, a),
  });
  reg({
    name: 'GetUserPref', label: 'Get User Preference', category: '', description: 'Get user preference value', undoable: false,
    args: [{ name: 'Target', default: '' }],
    execute: (app, a) => getUserPref(app, a),
  });
  reg({
    name: 'GetKeyboardState', label: 'GetKeyboardState', category: '', description: 'Retrieve the current status of all the virtual keys', undoable: false,
    args: [{ name: 'KeyCode', default: 0 }, { name: 'Shift', default: 0 }],
    execute(app, a) {
      const k = stateOf(app).keyboard;
      const shift = (k.shift ? 1 : 0) | (k.ctrl ? 2 : 0) | (k.alt ? 4 : 0);
      a.Shift = shift; a.KeyCode = 0;   // KeyCode is never written
      setStatus(app, 'GetKeyboardState', S_FALSE);
      return { KeyCode: 0, Shift: shift };
    },
  });
  reg({
    name: 'SISaveDuplicateXformForUndo', label: 'SISaveDuplicateXformForUndo', category: 'Edit',
    args: [],
    execute(app) {
      const prefs = duplicatePrefs(app);
      const saved: Record<string, number> = {}; for (const k of XFORM_KEYS) saved[k] = Number(prefs[k] ?? (k[0] === 's' ? 1 : 0));
      let undone: Record<string, number> | null = null;
      const write = (b: Record<string, number>) => { for (const k of XFORM_KEYS) prefs[k] = b[k]; };
      app.record('SISaveDuplicateXformForUndo',
        () => { if (undone) write(undone); },   // inferred: the generic redo re-applies the block that undo replaced
        () => { undone = {}; for (const k of XFORM_KEYS) undone[k] = Number(prefs[k]); write(saved); });
      setStatus(app, 'SISaveDuplicateXformForUndo', S_OK);
    },
  });
  reg({
    name: 'TagForDelete', label: 'Tag for Delete during Undo', category: '',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const tagged = nodesArg(app, a.InputObjs).filter((n): n is X3DObject => n instanceof X3DObject && n !== app.scene.root);
      // Undo: the child delete task (removal from the parent); later redos / undos replay it
      let removed: { o: X3DObject; p: X3DObject; i: number }[] = [];
      app.record('TagForDelete',
        () => { for (const r of [...removed].reverse()) { r.p.addChild(r.o); const c = r.p.children; c.splice(c.indexOf(r.o), 1); c.splice(r.i, 0, r.o); } removed = []; },
        () => {
          removed = [];
          for (const o of tagged) { const p = o.parentObj; if (!p) continue; removed.push({ o, p, i: p.children.indexOf(o) }); p.removeChild(o); }
          app.select(app.selection.filter(n => !removed.some(r => r.o === n)));
        });
      setStatus(app, 'TagForDelete', S_OK);
    },
  });
}
