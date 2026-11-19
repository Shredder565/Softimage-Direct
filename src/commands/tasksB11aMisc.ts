// Row CMD-B11a (part 3): presets, custom property layouts, the OBJ custom-command bridge, key map, preference import
// and the pick-position session of tasks.dll. Brief: docs/ghidra/cmd-b11a-tasks-cache-preset-pick-binary.md.
//
//   RenameCPSetLayoutItems, CreateObjectFromPreset, ObjImport, SIObjExport, SetDefaultKeyMap, ImportPrefs, PickPosition
//
// How the contracts are mapped onto this build:
//  * A custom property's layout is its PPG layout tree (`ParamSet.layout`); a custom property without one gets the
//    default layout of one item per parameter (inferred). Only the layout named "Default" exists (inferred).
//  * CreateObjectFromPreset: the preset classes of this build are the SPDL property sets (src/data/si/propsets.json);
//    any other preset gives a property stand-in of that type. Objects go to `app.tasksB11a.transient`.
//  * The OBJ bridge loads plug-ins from `app.tasksB11a.hooks.plugins`; customcommands.dll (the OBJ reader / writer,
//    ledger row CMD-01-OBJ-BIN) is not in this build.
//  * PickPosition cannot block the bus: it returns its output record at once and fills it when the pick ends
//    (`app.tasksB11a.lastPick`); `hooks.pickPosition` answers synchronously.
import { App } from '../core/commands';
import { Node, Property } from '../core/scene';
import type { LayoutNode } from '../core/opdefs';
import { SI_PROPSETS, siPropDefs, siPropLayout } from '../core/opdefs';
import { hostFs } from '../core/sdkHelpersHostFs';
import { siString } from '../ui/si';
import { setKeymap, keymapNames, currentKeymap } from '../ui/keymap';
import { startPickSession } from './miscDsScriptsPick';
import { B11A_SPECS } from './tasksB11aArgs';
import {
  b11a, reg, fail, setStatus, logNya, interactive, unset, text, nodeArg, rawItems,
  S_OK, S_FALSE, E_FAIL, E_UNEXPECTED, E_INVALIDARG, DISP_E_PARAMNOTFOUND, DISP_E_EXCEPTION,
} from './tasksB11aShared';

// ------------------------------------------------------------------ custom property layouts
const isCustomProperty = (n: any): n is Property => n instanceof Property && /^custom/i.test(n.type);
function layoutOf(p: Property, name: string): LayoutNode[] | null {
  if (name !== 'Default') return ((p as any).ppgLayouts?.[name] as LayoutNode[] | undefined) ?? null;
  if (!p.layout) p.layout = p.params.map(q => ({ param: q.name })); // inferred: the default layout, one item per parameter
  return p.layout as LayoutNode[];
}
/** The layout items in order (PPGLayout.Item(i)): every node of the tree, depth first. */
function layoutItems(nodes: LayoutNode[]): LayoutNode[] { const out: LayoutNode[] = []; const walk = (l: LayoutNode[]) => { for (const n of l) { out.push(n); if (n.items) walk(n.items); } }; walk(nodes); return out; }
const labelOf = (n: LayoutNode): string | undefined => n.param !== undefined || n.button !== undefined ? n.label : n.group ?? n.tab ?? n.row ?? n.label;
function setLabel(n: LayoutNode, v: string | undefined) {
  if (n.param !== undefined || n.button !== undefined) { if (v === undefined) delete n.label; else n.label = v; return; }
  if (n.group !== undefined) n.group = v ?? ''; else if (n.tab !== undefined) n.tab = v ?? ''; else if (n.row !== undefined) n.row = v ?? ''; else if (v === undefined) delete n.label; else n.label = v;
}

// ------------------------------------------------------------------ presets
function presetName(v: any): string { if (v instanceof Node) return v.name; const s = text(Array.isArray(v) ? v[0] : v).trim(); return s; }
function presetKey(name: string): string | null {
  const base = name.replace(/^.*[\\/]/, '').replace(/\.preset$/i, '');
  return Object.keys(SI_PROPSETS).find(k => k === base || SI_PROPSETS[k].label === base) ?? null;
}

// ------------------------------------------------------------------ custom command bridge
function bridgeCall(app: App, command: string, a: Record<string, any>) {
  const st = b11a(app); const spec = B11A_SPECS[command];
  // Category 4 is not a GUID: the bridge class comes from the handler CLSID (242679d3-...), one bridge for both
  const plugin = spec.script ?? text(a._ScriptName); const name = text(a.Name) || spec.label;
  const values = spec.args.filter(d => !(spec.flags[d.name] & 1)).map(d => a[d.name]); // every argument that is not hidden
  if (!/\.(dll|so)$/i.test(plugin)) throw fail(E_UNEXPECTED, `${command}: ${plugin} is not a dll or so plug-in`);
  const rec = { plugin, name, args: values, ret: undefined as any }; st.bridgeCalls.push(rec);
  const lib = Object.entries(st.hooks.plugins).find(([k]) => k.toLowerCase() === plugin.toLowerCase())?.[1];
  if (!lib) {
    if (/^customcommands\.dll$/i.test(plugin)) {
      logNya(app, command, `the ${name} worker of customcommands.dll (OBJ ${command === 'ObjImport' ? 'reader' : 'writer'}, ledger row CMD-01-OBJ-BIN); nothing is ${command === 'ObjImport' ? 'imported' : 'exported'}`);
      setStatus(app, command, S_OK); return command === 'ObjImport' ? [] : undefined;
    }
    const msg = (siString('XSITASKS', 0x416) ?? 'Failed to load custom command handler %s (Error 0x%x)').replace('%s', plugin).replace('%x', (E_FAIL >>> 0).toString(16));
    app.logMsg('error', msg); throw fail(DISP_E_EXCEPTION, `${command}: ${msg}`);
  }
  if (typeof lib.XSIOnCommand !== 'function') throw fail(E_FAIL, `${command}: ${plugin} has no XSIOnCommand export`);
  rec.ret = lib.XSIOnCommand(name, values);
  setStatus(app, command, S_OK);
  return rec.ret; // the return-value argument (flag bit 9)
}

export function registerTasksB11aMisc(app: App) {
  reg(app, 'RenameCPSetLayoutItems', {
    execute(app, a) {
      const C = 'RenameCPSetLayoutItems';
      if (unset(a.InputObj)) throw fail(E_INVALIDARG, `${C}: InputObj is required`);
      const p = nodeArg(app, a.InputObj); const lname = text(a.LayoutName) || 'Default'; const name = text(a.Name);
      const layout = isCustomProperty(p) ? layoutOf(p, lname) : null;
      if (!layout) throw fail(DISP_E_PARAMNOTFOUND, `${C}: ${text(a.InputObj)} has no layout "${lname}"`);
      const items = layoutItems(layout); const idx = rawItems(a.Indices).map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < items.length);
      const saved = idx.map(i => labelOf(items[i])); // first run: the current labels, for undo
      const refresh = () => { app.events.emit('params'); app.events.emit('scene'); };
      app.record(C, () => { for (const i of idx) setLabel(items[i], name); refresh(); }, () => { idx.forEach((i, k) => setLabel(items[i], saved[k])); refresh(); });
      setStatus(app, C, S_OK);
    },
  });

  reg(app, 'CreateObjectFromPreset', {
    execute(app, a) {
      const C = 'CreateObjectFromPreset'; const st = b11a(app);
      const preset = presetName(a.PresetObj);
      if (!preset) throw fail(E_INVALIDARG, `${C}: PresetObj is required`);
      const key = presetKey(preset);
      let obj: Property;
      if (key) { obj = new Property(SI_PROPSETS[key].label, key, siPropDefs(key)); const l = siPropLayout(key); if (l) obj.layout = l as any; }
      else { obj = new Property(preset.replace(/^.*[\\/]/, '').replace(/\.preset$/i, ''), preset, []); logNya(app, C, `the object class and parameters behind preset "${preset}" (SICreateObjectAndUpgradeFromPreset); a property stand-in is made`); }
      const name = text(a.Name); if (name) (obj as any).name = name;
      const file = /[\\/]/.test(preset) || /\.preset$/i.test(preset) ? preset : ''; // SIGetFilePathFromPreset (inferred: a path argument is its own file)
      app.record(C, () => { st.transient.push(obj); st.presetRecords.push({ file, object: obj }); }, () => {
        const i = st.transient.indexOf(obj); if (i >= 0) st.transient.splice(i, 1);
        const j = st.presetRecords.findIndex(r => r.object === obj); if (j >= 0) st.presetRecords.splice(j, 1);
      });
      setStatus(app, C, S_OK);
      return obj;
    },
  });

  reg(app, 'ObjImport', { undoable: false, execute(app, a) { return bridgeCall(app, 'ObjImport', a); } });
  reg(app, 'SIObjExport', { undoable: false, execute(app, a) { return bridgeCall(app, 'SIObjExport', a); } });

  reg(app, 'SetDefaultKeyMap', {
    execute(app, a) {
      const C = 'SetDefaultKeyMap'; const name = text(a.Name); const saved = currentKeymap;
      const known = keymapNames().includes(name);
      if (!known) logNya(app, C, `what the keyboard-mapping manager does with the key map name "${name}" (not one of this build's key maps); the default key map is kept`);
      app.record(C, () => { if (known) setKeymap(name); }, () => { setKeymap(saved); });
      return setStatus(app, C, S_FALSE); // 1 on the first run
    },
  });

  reg(app, 'ImportPrefs', {
    undoable: false,
    execute(app, a) {
      const C = 'ImportPrefs'; const st = b11a(app);
      if (unset(a.FileName)) throw fail(E_INVALIDARG, `${C}: FileName is required`);
      const file = text(Array.isArray(a.FileName) ? a.FileName[0] : a.FileName);
      const valid = () => /\.DSPrefs$/i.test(file) && hostFs.isFile(file);
      const wrongKind = () => { const m = (siString('XSIMSGCAT', 0x33) ?? 'Wrong file kind: < %s >').replace(/^\d+\$/, '').replace('%s', file); app.logMsg('error', m); return m; };
      if (!valid()) throw fail(E_INVALIDARG, `${C}: ${wrongKind()}`);
      // Do posts request 0x1bb0 to the deferred-execution service with this task as callback (inferred: deferred)
      const req = { id: 0x1bb0, file, done: false }; st.prefRequests.push(req);
      setTimeout(() => {
        if (!valid()) { wrongKind(); return; }
        logNya(app, C, `the framework preference loader (the .DSPrefs file format); ${file} is not applied`);
        req.done = true;
      }, 0);
      setStatus(app, C, S_OK);
    },
  });

  reg(app, 'PickPosition', {
    undoable: false,
    execute(app, a) {
      const C = 'PickPosition'; const st = b11a(app);
      const isStr = (v: any) => v === undefined || v === null || typeof v === 'string';
      if (!isStr(a.LeftMessage) || !isStr(a.MiddleMessage)) throw fail(E_INVALIDARG, `${C}: LeftMessage and MiddleMessage must be strings`);
      const statusText = `\n${text(a.LeftMessage)}\n${text(a.MiddleMessage)}\n${siString('XSITASKS', 0x40f) ?? 'End'}`;
      const out = { PosX: 0, PosY: 0, PosZ: 0, ButtonPressed: 0, statusText };
      st.lastPick = out; setStatus(app, C, S_OK);
      if (st.hooks.pickPosition) {
        const r = st.hooks.pickPosition(statusText);
        if (r) { [out.PosX, out.PosY, out.PosZ] = r.pos; out.ButtonPressed = r.button; }
        return out;
      }
      if (!interactive(app)) return out; // the interaction service cannot start a session: outputs 0
      startPickSession(app, {
        command: C, kind: 'position', prompt: text(a.LeftMessage), middlePrompt: text(a.MiddleMessage),
        fromClick: (p) => p,
        onPick: (v, button) => { const p = Array.isArray(v) ? v : [0, 0, 0]; out.PosX = Number(p[0]) || 0; out.PosY = Number(p[1]) || 0; out.PosZ = Number(p[2]) || 0; out.ButtonPressed = button; return false; },
        onEnd: () => { app.events.emit('selection'); }, // a cancelled pick leaves ButtonPressed 0 (inferred)
      });
      return out;
    },
  });
}
