// Ledger row CMD-B7c, Cache Manager add-on. Brief: docs/ghidra/cmd-b7c-addon-scripts.md, "Wire contract: CacheManager".
// Original code written from that contract only.
//
//   RemoveNumbering, AddToList, RemoveFromList, GetItemsAsString, SelectionValueToItemName, GetObjectsFromSource,
//   WriteCachesFile, ReadCachesFile, RefreshCachesPathProp, UpdateCacheManager, GetCacheOnFile
//
// Files are written to the session's virtual host file system. Mixer cache clips, the Cache Manager view and
// ICE node containers do not exist as build classes, so the commands read the documented members from
// whatever object they are given (see addonScriptsShared.ts).
import { App } from '../core/commands';
import { Node, Property } from '../core/scene';
import { ICETreeOperator } from '../core/ice';
import { hostFs } from '../core/sdkHelpersHostFs';
import {
  addonScriptsState as state, NOTE, GridData, addGrid, gridOf, ScriptLayout, layoutOf, listOf, fullNameOf, nameOf, typeOf, findByName,
  sceneExternalFiles, resolvedOf, fileExists, ROW_COLOR_VALID, ROW_COLOR_INVALID, delegate, trace, inspect, logNya, errDesc, type AddonView,
} from './addonScriptsShared';

export const CACHES_PATH_PROP = 'CachesPathProp';
export const CACHES_PATH_NAME = 'Scene Animation Cache Path';
export const CACHE_ON_FILE_PROP = 'CacheOnFileListProp';
export const CACHE_ON_FILE_NAME = 'Scene Simulation Cache on File nodes';
export const CACHE_MANAGER_VIEW = 'Cache Manager';

// ------------------------------------------------------------------ list-box helpers

/** `<n> : <text>` -> `<text>`; anything else unchanged. */
export function removeNumbering(s: string): string {
  const i = s.indexOf(':');
  const n = i < 0 ? NaN : parseInt(s.slice(0, Math.max(i - 1, 0)), 10);
  return n >= 0 ? s.slice(i + 2) : s;
}
const pairsOf = (item: any): any[] => [...listOf(item.UIItems)];
/** The layout item of a page by script name. */
function layoutItem(ppg: any, name: any): any {
  const layout = ppg.PPGLayout;
  return typeof layout.Item === 'function' ? layout.Item(name) : layout.Item[name];
}
function paramValue(obj: any, name: string): any {
  if (obj instanceof Node) return obj.val(name);
  const p = typeof obj.Parameters === 'function' ? obj.Parameters(name) : obj.Parameters?.[name] ?? obj[name];
  return p && typeof p === 'object' && 'Value' in p ? p.Value : p;
}

// ------------------------------------------------------------------ GetObjectsFromSource

function objectsFromSource(src: any): [string, string, string] {
  const mixer = src.Parent;
  const scanned = (state.scannedMixers ??= {});
  const table = (state.sourceObjects ??= {});
  if (typeOf(mixer) === 'Mixer' && !scanned[nameOf(mixer)]) {
    scanned[nameOf(mixer)] = true;
    for (const clip of listOf(mixer.Clips)) {
      if (typeOf(clip) !== 'mixercacheclip') continue;
      const key = nameOf(clip.Source);
      const rec = table[key] ?? { clips: [], objects: [] };
      rec.clips.push(fullNameOf(clip));
      for (const item of listOf(clip.MappedItems)) rec.objects.push(fullNameOf(item.Destination.Parent));   // inferred: an object joins the list by its full name
      table[key] = rec;
    }
  }
  const hit = table[nameOf(src)];
  return [fullNameOf(src), hit ? hit.clips.join(';') : '', hit ? hit.objects.join(';') : ''];
}

// ------------------------------------------------------------------ CachesPathProp

function makeCachesPathProp(): Property {
  const prop = new Property(CACHES_PATH_NAME, CACHES_PATH_PROP, []);
  addGrid(prop, 'CachePathGrid', ['Objects', 'User Path (Usr)', 'Valid', 'Resolved Path (Res)', 'Guid', 'Source', 'Clip']);
  const l: ScriptLayout = layoutOf(prop);
  l.AddGroup('');
  const buttons: [string, string][] = [['BntSelectSceneObjects', 'Select Scene Objects'], ['BntOpenMixer', 'Open Mixer'], ['BntBrowse', 'Browse Selected Path'],
    ['BntSearchAndReplace', 'Search and Replace'], ['BntDelete', 'Delete Sources/Clips'], ['BntDeleteUnusedSource', 'Delete Unused Sources']];
  buttons.forEach(([id, label], i) => { const b = l.AddButton(id, label); b.SetAttribute('siUICX', 130); if (i < buttons.length - 1) b.SetAttribute('siUIContinue', true); });
  l.EndGroup();
  const g = l.AddItem('CachePathGrid', '', 'siControlGrid');
  g.SetAttribute('siUINoLabel', true); g.SetAttribute('siUIGridSelectionMode', 'siSelectionHeader');
  g.SetAttribute('siUIGridReadOnlyColumns', '1:0:1:1:1:1:1'); g.SetAttribute('siUIGridHideColumns', '1:1:1:1:0:0:0');   // the second text lists the shown columns
  return prop;
}
/** Refill the grid of a CachesPathProp from the scene's external files of type Caches. */
export function fillCachesPathGrid(app: App, prop: Property) {
  const grid = gridOf(prop, 'CachePathGrid')!;
  grid.clear();
  state.scannedMixers = {}; state.sourceObjects = {};   // reset before the fill
  try {
    for (const f of sceneExternalFiles(app)) {
      if (f.FileType !== 'Caches') continue;
      const owner = listOf(f.Owners)[0];
      if (owner == null) continue;
      const row = grid.addRow();
      if (row === 0) grid.SetRowLabel(0, '    ');
      if (f.Path !== '') grid.SetCell(1, row, f.Path);
      const resolved = resolvedOf(f);
      grid.SetCell(3, row, resolved);
      const exists = fileExists(resolved);
      grid.SetCell(2, row, exists ? 'valid' : 'invalid');
      grid.SetRowBackgroundColor(row, exists ? ROW_COLOR_VALID : ROW_COLOR_INVALID);
      const [source, clips, objects] = objectsFromSource(owner);
      grid.SetCell(0, row, objects);
      grid.SetCell(5, row, source);
      if (source !== '') grid.SetCell(6, row, clips);
      grid.SetCell(4, row, f.GUID);
    }
  } finally { state.scannedMixers = null; state.sourceObjects = null; }   // discarded after the fill
}
function makeCacheOnFileListProp(): Property {
  const prop = new Property(CACHE_ON_FILE_NAME, CACHE_ON_FILE_PROP, []);
  addGrid(prop, 'CachePathGrid', ['Cache On File', 'Resolved Path (Res)']);
  const l = layoutOf(prop);
  l.AddGroup('Cache On File nodes');
  l.AddButton('BntSelectSceneObjects', 'Inspect').SetAttribute('siUICX', 130);
  const g = l.AddItem('CachePathGrid', '', 'siControlGrid');
  g.SetAttribute('siUINoLabel', true); g.SetAttribute('siUIGridSelectionMode', 'siSelectionHeader');
  g.SetAttribute('siUIGridReadOnlyColumns', '1:1'); g.SetAttribute('siUIGridHideColumns', '1:1');
  l.EndGroup();
  return prop;
}
const nodeParam = (n: any, name: string): any => {
  if (n?.params instanceof Node || typeof n?.params?.val === 'function') return n.params.val(name);
  const p = typeof n?.Parameters === 'function' ? n.Parameters(name) : n?.Parameters?.[name];
  return p && typeof p === 'object' && 'Value' in p ? p.Value : p !== undefined ? p : n?.[name];
};
/** Page-open logic of CacheOnFileListProp: one row per read-mode Cache on File node. */
export function fillCacheOnFileGrid(app: App, prop: Property) {
  const grid = gridOf(prop, 'CachePathGrid')!;
  grid.clear();
  for (const n of cacheOnFileNodes(app)) { const r = grid.addRow(); grid.SetCell(0, r, fullNameOf(n)); grid.SetCell(1, r, nodeParam(n, 'ResolvedFilePath')); }
}
const cachesPathProp = (): Property => (state.cachesPathProp ??= makeCachesPathProp());
const cacheOnFileListProp = (): Property => (state.cacheOnFileListProp ??= makeCacheOnFileListProp());

/** Menu item "Cache Manager...": fresh property instances, then the Cache Manager view. */
export function openCacheManager(app: App) {
  state.cachesPathProp = makeCachesPathProp();
  state.cacheOnFileListProp = makeCacheOnFileListProp();
  delegate(app, 'Cache Manager...', 'OpenView', { ViewName: CACHE_MANAGER_VIEW }, [CACHE_MANAGER_VIEW]);
}

// ------------------------------------------------------------------ GetCacheOnFile

function iceTrees(app: App): any[] {
  const out: any[] = [];
  for (const o of app.scene.allObjects()) for (const op of o.primitive?.operators ?? []) if (op instanceof ICETreeOperator) out.push(op);
  return [...out, ...state.extraIceTrees];
}
const childNodes = (n: any): any[] | null => {
  if (n instanceof ICETreeOperator) return n.nodes;
  if (n?.Nodes !== undefined) return listOf(n.Nodes);   // a node container
  return null;
};
export function cacheOnFileNodes(app: App): any[] {
  const found: any[] = [];
  const walk = (n: any) => {
    const name = n instanceof ICETreeOperator ? n.name : n?.Name ?? n?.name ?? n?.type;
    if (name === 'Cache on File' && Number(nodeParam(n, 'filemode')) === 2) found.push(n);
    const kids = childNodes(n);
    if (kids) for (const k of kids) walk(k);
  };
  for (const t of iceTrees(app)) walk(t);
  return found;
}

// ------------------------------------------------------------------ registration

export function registerCacheManagerCommands(app: App) {
  const CAT = 'Custom';
  (state as any).openCacheManager = () => openCacheManager(app);

  app.register({
    name: 'RemoveNumbering', label: 'RemoveNumbering', category: CAT, description: '',
    args: [{ name: 'inString', default: null }], undoable: false, noLog: true,
    execute(_a, a) {
      if (typeof a.inString !== 'string') throw new Error(`script error: RemoveNumbering needs a string (${NOTE})`);   // inferred: a non-string argument is a script error
      return removeNumbering(a.inString);
    },
  });

  app.register({
    name: 'AddToList', label: 'AddToList', category: CAT, description: '',
    args: [{ name: 'PPG', default: null }, { name: 'dataArray', default: null }, { name: 'ppgItem', default: null }, { name: 'multiInstance', default: null }],
    undoable: false, noLog: true,
    execute(_a, a) {
      const item = a.ppgItem;
      const pairs = pairsOf(item);   // a wrong item is a script error (no guard)
      const existing = new Set<string>();
      for (let i = 0; i < pairs.length; i += 2) existing.add(removeNumbering(String(pairs[i])));
      const had = pairs.length > 0;
      for (const el of listOf(a.dataArray)) {
        const text = removeNumbering(String(el));
        if (had && !a.multiInstance && existing.has(text)) continue;
        const n = pairs.length / 2;
        pairs.push(`${n} : ${text}`, `${n}:`);
      }
      item.UIItems = pairs;
      a.PPG.Refresh();
    },
  });

  app.register({
    name: 'RemoveFromList', label: 'RemoveFromList', category: CAT, description: '',
    args: [{ name: 'PPG', default: null }, { name: 'in_FromList', default: null }, { name: 'selected', default: null }],
    undoable: false, noLog: true,
    execute(_a, a) {
      try {
        const item = layoutItem(a.PPG, a.in_FromList);
        const pairs = pairsOf(item);
        const sel = a.selected === null || a.selected === undefined ? paramValue(a.PPG.Inspected(0), String(a.in_FromList)) : a.selected;
        const text = String(sel ?? '');
        if (text === '') return;
        const gone = new Set(text.split(';'));
        const kept: any[] = [];
        for (let i = 0; i < pairs.length; i += 2) {
          if (gone.has(String(pairs[i + 1]))) continue;
          const k = kept.length / 2;
          kept.push(`${k} : ${removeNumbering(String(pairs[i]))}`, `${k}:`);
        }
        item.UIItems = kept;
        a.PPG.Refresh();
      } catch { /* every failure is swallowed */ }
    },
  });

  app.register({
    name: 'GetItemsAsString', label: 'GetItemsAsString', category: CAT, description: '',
    args: [{ name: 'PPG', default: null }, { name: 'in_ItemName', default: null }], undoable: false, noLog: true,
    execute(_a, a) {
      try {
        const pairs = pairsOf(layoutItem(a.PPG, a.in_ItemName));
        const labels: string[] = [];
        for (let i = 0; i < pairs.length; i += 2) labels.push(removeNumbering(String(pairs[i])));
        return labels.join(',');
      } catch { return ''; }
    },
  });

  app.register({
    name: 'SelectionValueToItemName', label: 'SelectionValueToItemName', category: CAT, description: '',
    args: [{ name: 'PPG', default: null }, { name: 'in_splitSel', default: null }, { name: 'in_FromList', default: null }], undoable: false, noLog: true,
    execute(_a, a) {
      const pairs = pairsOf(layoutItem(a.PPG, a.in_FromList));   // a missing item is a script error (no guard)
      const out: string[] = [];
      for (const v of listOf(a.in_splitSel)) {
        for (let i = 0; i < pairs.length; i += 2) if (pairs[i + 1] === v) { out.push(pairs[i]); break; }
      }
      return out;
    },
  });

  app.register({
    name: 'GetObjectsFromSource', label: 'GetObjectsFromSource', category: CAT, description: '',
    args: [{ name: 'inSource', default: null }], undoable: false, noLog: true,
    execute(_a, a) { return objectsFromSource(a.inSource); },
  });

  const fileArgs = ['FileName', 'objects', 'StartFrame', 'EndFrame', 'Step', 'Type', 'ResolvedPath'].map(name => ({ name, default: null }));
  app.register({
    name: 'WriteCachesFile', label: 'WriteCachesFile', category: CAT, description: '',
    args: fileArgs, undoable: false,
    execute(_a, a) {
      if (typeof a.objects !== 'string') throw new Error(`script error: WriteCachesFile needs the object names as one string (${NOTE})`);   // inferred text
      const lines = ['[General]', `Start=${a.StartFrame}`, `End=${a.EndFrame}`, `Step=${a.Step}`, `Type=${a.Type}`, `Path=${a.ResolvedPath}`, '[Parts]',
        ...a.objects.split(',').map((p: string) => `${p}=${p}`)];
      hostFs.writeFile(a.FileName, lines.map(l => l + '\r\n').join(''));   // inferred: WriteLine ends a line with CR LF (Q1)
    },
  });
  app.register({
    name: 'ReadCachesFile', label: 'ReadCachesFile', category: CAT, description: '',
    args: fileArgs, undoable: false,
    execute() { /* the procedure body is empty */ },
  });

  app.register({
    name: 'RefreshCachesPathProp', label: 'Refresh CachesPathProp', category: CAT, description: '',
    args: [], undoable: false, noLog: true,
    execute(app2) {
      // inferred: no guard, so without an instance the call ends in a script error. The engine's wording is not attested.
      if (!state.cachesPathProp) throw new Error(`script error: there is no ${CACHES_PATH_PROP} instance (${NOTE})`);
      fillCachesPathGrid(app2, state.cachesPathProp);
    },
  });

  app.register({
    name: 'UpdateCacheManager', label: 'Update Cache Manager', category: CAT, description: '',
    args: [], undoable: false, noLog: true,
    execute(app2) {
      const put = (v: AddonView, sub: string, value: string) => { (v.subViews[sub] ??= { attrs: {} }).attrs.targetcontent = value; };
      for (const v of state.views) {
        if (v.type !== CACHE_MANAGER_VIEW) continue;
        put(v, 'WriteAnimationTab', fullNameOf(findByName(app2, 'WriteAnimation')));
        put(v, 'ReadAnimationPPG', fullNameOf(findByName(app2, 'ReadAnimation')));
        put(v, 'CachesPathPPG', fullNameOf(cachesPathProp()));
        const sim = findByName(app2, 'Environments.Environment.simtimectrl');
        if (sim !== undefined) {
          trace('SetValue', ['Environments.Environment.simtimectrl.cacheppg', true], 'stand-in');
          if (sim instanceof Node) { if (sim.get('cacheppg')) sim.set('cacheppg', true); else logNya(app2, 'UpdateCacheManager', 'the simulation time control has no "cacheppg" parameter in this build'); }
          else sim.cacheppg = true;
          put(v, 'SimulationPPG', fullNameOf(sim));
        } else put(v, 'SimulationPPG', '');
        put(v, 'CacheOnFilePPG', fullNameOf(cacheOnFileListProp()));
      }
    },
  });

  app.register({
    name: 'GetCacheOnFile', label: 'GetCacheOnFile', category: CAT, description: '',
    args: [], undoable: false, noLog: true,
    execute(app2) { return cacheOnFileNodes(app2); },
  });
}

// ------------------------------------------------------------------ page behaviour (for the view, not part of the commands)

/** Selected rows of a grid, or none. */
const selectedRows = (g: GridData): number[] => [...g.selectedRows];
/** Button logic of the CachesPathProp page, as far as the contract describes it. */
export function cachesPathButton(app: App, prop: Property, id: string): void {
  const grid = gridOf(prop, 'CachePathGrid')!;
  const rows = selectedRows(grid);
  const namesIn = (col: number) => rows.flatMap(r => String(grid.GetCell(col, r) ?? '').split(';')).filter(n => n !== '');
  if (id === 'BntSelectSceneObjects' || id === 'BntOpenMixer') {
    const names = namesIn(0);
    if (names.length) delegate(app, 'CachesPathProp', 'SelectObj', { InputObjs: names.join(',') }, [names.join(',')]);
    if (id === 'BntOpenMixer') delegate(app, 'CachesPathProp', 'OpenView', { ViewName: 'Animation Mixer' }, ['Animation Mixer']);
  } else if (id === 'BntDelete') {
    const names = namesIn(5);
    if (names.length) { trace('DeleteObj', [names.join(',')], 'stand-in'); logNya(app, 'CachesPathProp', `deleting the cache sources / clips ${names.join(',')} (no cache sources in this build)`); }
    fillCachesPathGrid(app, prop);
  } else if (id === 'BntDeleteUnusedSource') {
    delegate(app, 'CachesPathProp', 'DeleteUnusedCacheSources', {}, []);
    fillCachesPathGrid(app, prop);
  } else if (id === 'BntSearchAndReplace') {
    try { logNya(app, 'CachesPathProp', 'the "Search and Replace Strings in Paths" dialog over the selected rows (CSearchAndReplaceDialog is outside this row)'); }
    catch (e) { app.logMsg('error', `Failed to perform SearchAndReplacePath - ${errDesc(e)}`); }
    fillCachesPathGrid(app, prop);
  } else if (id === 'BntBrowse') {
    logNya(app, 'CachesPathProp', 'the "Select a File" browser for the selected rows (no host file dialog in this build)');
  } else if (id === 'Inspect') {
    inspect(app, rows.map(r => grid.GetCell(0, r)));
  }
}
/** Editing a user path writes it to the external file with that GUID and rebuilds the rows. */
export function cachesPathEdited(app: App, prop: Property, row: number, path: string) {
  const grid = gridOf(prop, 'CachePathGrid')!;
  const guid = grid.GetCell(4, row);
  const f = sceneExternalFiles(app).find(x => x.GUID === guid);
  if (f) f.Path = path;
  fillCachesPathGrid(app, prop);
}
