// Ledger row CMD-B7c, sdkui add-on (External Files Manager, workgroup dialog). Brief:
// docs/ghidra/cmd-b7c-addon-scripts.md, "Wire contract: sdkui". Original code written from that contract only.
//
//   SIGetExternalFilesViewerProp, SISetExternalFilesManagerTarget, ConnectToWorkgroupUI
//
// The External Files viewer is a stand-alone property with two grids; its page logic ("when the page is open")
// is `openExternalFilesPage` / `closeExternalFilesPage` plus a change listener. The button logic of the page is
// outside this row. ConnectToWorkgroupUI opens AfterImage's modal page and returns a Promise (the command bus is
// synchronous); folders are looked up in the session's virtual host file system.
import { App } from '../core/commands';
import { Property, Model, Scene } from '../core/scene';
import { str, bool } from '../core/params';
import { resolveIePath } from '../core/importExportModelScripts';
import { sdkModal, sdkMsgBox, renderSdkLayout, type SdkDlgItem } from '../ui/sdkHelpersModal';
import { addonDocWizardState } from './addonDocWizard';
import {
  addonScriptsState as state, NOTE, addGrid, gridOf, layoutOf, listOf, fullNameOf, findByName, dictText, sceneExternalFiles, modelExtFiles,
  resolvedOf, fileExists, folderExists, ROW_COLOR_VALID, ROW_COLOR_INVALID, interactive, logWarning, errDesc, typeOf, type ExtFile,
} from './addonScriptsShared';

export const EXT_FILES_VIEWER = 'CExternalFilesViewer';
export const EXT_FILES_NAME = 'External Files Manager';
const FILE_TYPES: [string, string][] = [['All', 'All'], ['Actions', 'Actions'], ['Audio', 'Audio'], ['Caches', 'Caches'], ['Deltas', 'Deltas'], ['Models', 'Models'], ['Material Lib', 'MatLib'],
  ['Pictures', 'Pictures'], ['Render_Pictures', 'Render_Pictures'], ['Scenes', 'Scenes'], ['Scripts', 'Scripts'], ['Synoptic', 'Synoptic'], ['Thumbnails', 'Thumbnails']];
const REFILL_ON = new Set(['Target', 'Validateondisk', 'FileType', 'ShowRecords', 'RefreshMe']);

// ------------------------------------------------------------------ External Files viewer

function buildViewerLayout(prop: Property) {
  const l = layoutOf(prop); l.Clear();
  const flat = (pairs: [string, any][]) => pairs.flatMap(([a, b]) => [a, b]);
  const button = (id: string, label: string, w: number) => l.AddButton(id, label).SetAttribute('siUICX', w);
  l.AddGroup('');
  l.AddItem('Target', 'External Files For: ').SetAttribute('siUILabelPercentage', 20);
  l.EndGroup();
  l.AddRow();
  l.AddGroup('Options');
  l.AddEnumControl('FileType', flat(FILE_TYPES), 'FileType', 'siControlCombo').SetAttribute('siUICX', 100);
  l.AddItem('Validateondisk', 'View Resolved Paths');
  l.AddEnumControl('ShowRecords', ['Show All', 'All', '10', 10, '25', 25, '50', 50], 'Grid size', 'siControlCombo').SetAttribute('siUICX', 100);
  l.EndGroup();
  l.AddGroup('Actions');
  l.AddRow(); button('BntBrowse', 'Browse Selected Path...', 130); button('BntSearchAndReplace', 'Search and Replace...', 130); l.EndRow();
  l.AddRow(); button('BntSort', 'Sort Selected Column', 130); button('BntCopyUnderProject', 'Copy Files to Project...', 130); l.EndRow();
  l.EndGroup();
  l.AddGroup('Cleanup');
  button('BntDeleteAllMat', 'Delete Unused Materials', 210);
  button('BntDeleteImagesSourcesAndClips', 'Delete Unused Image Sources and Clips', 210);
  button('BntDeleteAnimationSources', 'Delete Unused Animation Sources', 210);
  button('BntDeleteAudioSources', 'Delete Unused Audio Sources', 210);
  button('BntDeleteCacheSources', 'Delete Unused Cache Sources', 210);
  l.EndGroup();
  if (state.alienbrain) {   // only when the Alienbrain helper object can be created
    l.AddGroup('AlienBrain');
    button('BntAddToAB', 'Add to Alienbrain', 110); button('BntGetLatest', 'Get Latest', 110);
    l.AddRow(); button('BntCO', 'Check out', 110); button('BntUNDOCO', 'Undo Check out', 110); l.EndRow();
    button('BntCI', 'Check in', 110);
    l.EndGroup();
  }
  l.AddButton('BntHelp', 'Help');
  l.EndRow();
  const g = l.AddItem('Files', '', 'siControlGrid');
  g.SetAttribute('siUINoLabel', true); g.SetAttribute('siUIGridSelectionMode', 'siSelectionHeader');
  g.SetAttribute('siUIGridReadOnlyColumns', '0:1:1:0:1:1:1:1:1');
  g.SetAttribute('siUIGridHideColumns', state.alienbrain ? '1:1:1:1:1:0:1:0:0' : '1:1:1:1:0:0:1:0:0');   // the text lists the shown columns
}

/** The files of the viewer's target; raises when the target text does not resolve. */
function targetFiles(app: App, target: string): ExtFile[] {
  if (target === 'Scene') return sceneExternalFiles(app);
  const first = String(target).split(',')[0].trim();
  const obj = findByName(app, first);
  if (obj === undefined) throw new Error(`script error: "${target}" does not resolve to an object`);   // inferred text
  if (obj instanceof Scene || typeOf(obj) === 'Scene') return sceneExternalFiles(app);
  if (obj instanceof Model || typeOf(obj) === '#model') return modelExtFiles(app, obj);
  return [];   // inferred: an object of another type lists nothing
}
const isRefLocked = (owner: any): boolean => owner?.LockType === 'siLockTypeRefModel' || (owner instanceof Model && !!(owner as any).ref);   // inferred: a referenced model of this build counts as ref-locked

/** Refill both grids. `fromPage`: the fill runs from the open page and also sets the grid height. */
export function fillExternalFilesGrid(app: App, prop: Property, fromPage = false) {
  const files = gridOf(prop, 'Files')!, cache = gridOf(prop, 'FilesCache')!;
  files.clear(); cache.clear();
  const type = String(prop.val('FileType')); const validate = !!prop.val('Validateondisk');
  const project = state.projectPath.replace(/[\\/]+$/, '') + '\\';
  for (const f of targetFiles(app, String(prop.val('Target')))) {
    if (type !== 'All' && type !== f.FileType) continue;
    const r = files.addRow(); if (r === 0) files.SetRowLabel(0, '    ');
    const resolved = resolvedOf(f);
    const exists = fileExists(resolved);
    files.SetCell(0, r, f.Path);
    files.SetCell(1, r, f.FileType);
    files.SetCell(2, r, exists ? 'valid' : 'invalid');
    files.SetRowBackgroundColor(r, exists ? ROW_COLOR_VALID : ROW_COLOR_INVALID);
    files.SetCell(3, r, validate ? resolved : '?');
    // The Alienbrain texts other than "not installed" need the Alienbrain helper, which this build does not have.
    files.SetCell(4, r, validate ? (state.alienbrain ? 'Alienbrain integration needs update' : 'Alienbrain is not installed') : '?');
    files.SetCell(5, r, f.GUID);
    const owners = listOf(f.Owners);
    const ref = owners.some(isRefLocked);
    files.SetCell(7, r, ref);
    files.SetCell(6, r, owners.map(fullNameOf).join(',') + (ref ? ' (ref lock)' : ''));   // inferred: owners are written as full names joined by ","
    files.SetCell(8, r, resolved.startsWith(project));
    const c = cache.addRow(); cache.SetCell(0, c, f.Path);
  }
  if (fromPage) {
    const item = layoutOf(prop).Item('Files')!;
    const show = prop.val('ShowRecords');
    const n = Number(show);
    if (show === 'All' || files.RowCount < n) delete item.attrs.siUICY; else item.SetAttribute('siUICY', 21 * n + 21);
  }
}

function makeViewer(app: App): Property {
  const prop = new Property(EXT_FILES_NAME, EXT_FILES_VIEWER, [
    str('Target', 'Scene', 'Target', { readOnly: true }), str('FileType', 'All', 'FileType'), str('ShowRecords', 'All', 'ShowRecords'),
    bool('Validateondisk', true, 'Validateondisk'), bool('RefreshMe', false, 'RefreshMe', { inspectable: false }),
  ]);
  const g = addGrid(prop, 'Files', [dictText('XSIPLUGINUI', 8000), dictText('XSIPLUGINUI', 8001), dictText('XSIPLUGINUI', 8002), dictText('XSIPLUGINUI', 8003),
    dictText('XSIPLUGINUI', 8004), 'Guid', dictText('XSIPLUGINUI', 8005), 'Reference', 'Local To Project']);
  addGrid(prop, 'FilesCache', ['Path']);   // inferred: the label of the single cache column
  g.SetRowLabel(0, '    ');
  buildViewerLayout(prop);
  fillExternalFilesGrid(app, prop);   // filled once at definition time
  prop.onChange((p) => {
    if (!(prop as any).pageOpen || !REFILL_ON.has(p.name)) return;
    try { fillExternalFilesGrid(app, prop, true); } catch (e) { app.logMsg('error', `External Files Manager: ${errDesc(e)}`); }
    (prop as any).pageRefreshes = ((prop as any).pageRefreshes ?? 0) + 1;
  });
  return prop;
}
/** Opening the page: a Target that no longer resolves is reset to Scene, then the grid is refilled. */
export function openExternalFilesPage(app: App, prop: Property) {
  (prop as any).pageOpen = true;
  try { targetFiles(app, String(prop.val('Target'))); } catch { (prop as any).pageOpen = false; prop.set('Target', 'Scene'); (prop as any).pageOpen = true; }
  fillExternalFilesGrid(app, prop, true);
}
export function closeExternalFilesPage(prop: Property) { (prop as any).pageOpen = false; }

// ------------------------------------------------------------------ ConnectToWorkgroupUI

const sdkExampleWorkgroup = () => [addonDocWizardState.factoryPath, 'XSISDK', 'examples', 'workgroup'].join('\\');

/** The "Connect to Workgroup" dialog; resolves to the directory on OK, null on Cancel. */
function workgroupDialog(app: App): Promise<string | null> {
  const prop = new Property('ConnectWorkgroup', 'CustomProperty', [str('Directory', state.lastWorkgroupPath, 'Directory')]);
  const layout: SdkDlgItem[] = [{ group: '', items: [{ text: 'Pick the root location of an existing workgroup' }, { param: 'Directory', control: 'folder', opts: ['NoLabel'] }] }];
  const example = sdkExampleWorkgroup();
  const offer = folderExists(example) && !addonDocWizardState.workgroups.includes(example);
  if (offer) prop.add(str('SDKExampleWorkgroupPath', example, 'SDKExampleWorkgroupPath', { inspectable: false }));
  (prop as any).sdkLayout = layout; (prop as any).layoutDictionary = 'XSIPLUGINUI';
  app.scene.root.addProperty(prop); app.events.emit('scene');
  return sdkModal('Connect to Workgroup', (body) => {
    const host = document.createElement('div');
    const draw = () => { host.textContent = ''; renderSdkLayout(host, prop, layout); };
    draw(); body.appendChild(host);
    if (offer) {
      const sp = document.createElement('div'); sp.className = 'sdkh-spacer'; sp.style.height = '8px';
      const b = document.createElement('button'); b.className = 'addon-button'; b.dataset.button = 'SDKWorkgroup'; b.textContent = 'Try SDK Example Workgroup';
      b.onclick = () => { prop.set('Directory', prop.val('SDKExampleWorkgroupPath')); draw(); };
      body.append(sp, b);
    }
  }, { w: 440, cls: 'sdkh-ppg addon-ConnectWorkgroup' }).then(ok => {
    const dir = String(prop.val('Directory') ?? '');
    if (ok) state.lastWorkgroupPath = dir;
    app.scene.root.removeProperty(prop); app.events.emit('scene');   // the property is deleted afterwards
    return ok ? dir : null;
  });
}
function box(text: string): Promise<boolean> {
  state.messages.push(text); if (state.messages.length > 100) state.messages.shift();
  return sdkMsgBox(text, 'Softimage');   // inferred: the caption of the script's message boxes
}
async function connectToWorkgroup(app: App): Promise<string | undefined> {
  for (;;) {
    const dir = await workgroupDialog(app);
    if (dir === null || dir === '') return undefined;
    const resolved = resolveIePath(dir);
    if (!folderExists(resolved)) { await box(`${dictText('XSIPLUGINUI', 7158, 'This workgroup directory does not exist')}\n${dir}`); continue; }
    const trimmed = app.commands.has('TrimString') ? String(app.run('TrimString', { StringToTrim: dir })) : dir.trim();
    if (addonDocWizardState.workgroups.includes(resolved)) { await box('This workgroup is already in the list'); return ''; }
    try {
      const add: ((path: string) => void) | undefined = (state as any).addWorkgroup;   // Application.AddWorkgroup; a hook may stand in for it
      if (add) add(trimmed); else addonDocWizardState.workgroups.push(trimmed);
    } catch (e) { await box(`${dictText('XSIPLUGINUI', 7191)} ${errDesc(e)}`); return ''; }   // inferred: how the error description joins the text
    logWarning(app, dictText('XSIPLUGINUI', 7164));
    const pm = state.views.find(v => v.type === 'Plugin Manager');
    if (pm) pm.attrs.refresh = '';
    return trimmed;
  }
}

// ------------------------------------------------------------------ registration

export function registerSdkuiViewerCommands(app: App) {
  const CAT = 'Custom';

  app.register({
    name: 'SIGetExternalFilesViewerProp', label: 'SIGetExternalFilesViewerProp', category: CAT, description: '',
    args: [], undoable: false, noLog: true,
    execute(app2) { return (state.externalFilesViewer ??= makeViewer(app2)); },
  });

  app.register({
    name: 'SISetExternalFilesManagerTarget', label: 'SISetExternalFilesManagerTarget', category: CAT, description: '',
    args: [{ name: 'Target', default: '' }], undoable: false, noLog: true,
    execute(app2, a) {
      try {
        const viewer = state.externalFilesViewer;
        if (!viewer) throw new Error('no viewer instance yet');
        const target = String(a.Target ?? '');
        if (target !== '') viewer.set('Target', target);
        else {
          try { targetFiles(app2, String(viewer.val('Target'))); } catch { viewer.set('Target', 'Scene'); }
          viewer.set('RefreshMe', !viewer.val('RefreshMe'));
        }
      } catch { app2.logMsg('info', 'Error running SISetExternalFilesManagerTarget. Try re-opening the view'); }
    },
  });

  app.register({
    name: 'ConnectToWorkgroupUI', label: 'ConnectToWorkgroupUI', category: CAT, description: 'Ask user to pick a workgroup and connect to it',
    args: [], undoable: false, noLog: true,
    execute(app2) {
      // siCannotBeUsedInBatch. The engine's wording of the refusal is not attested.
      if (!interactive(app2)) throw new Error(`ConnectToWorkgroupUI cannot be used in batch mode (${NOTE})`);   // inferred text
      return connectToWorkgroup(app2);
    },
  });
}
