// CMD-B16d: scnmgr.dll filter-map commands and rendercore.dll CopyPartition / RegenerateMaps.
// Contract: docs/ghidra/cmd-b16d-scnmgr-rendercore-corehelper-kinechain-gap.md (sections 2-3) and
// docs/re/WIRE_CORRECTIONS_B16.md items 29-34. Original code; no golden (nothing was executed in XSIBATCH).
//
// Filter-map commands (handler 48becc30, not a COM class): `Mesh Filter`, `Dice Object/Polygons`, `Delete Selected`
// (row 70a823e0), `Duplicate/Extrude Single`, `Duplicate/Extrude Multiple`, `Invert Polygons`, `Subdivide`,
// `Move Component Tool`. One generic executor reads each command's (SelFilter, OnFilterCmdMapClient, OnFilterCmdID,
// InputObjsArgName) groups from src/data/si/filter_maps.json (built from data/command_registry.json by
// tools/build_filter_maps.mjs) and runs the target commands already on the bus:
//   * argument 0 is the input; empty input = the current selection;
//   * groups are tested in registry order against the REMAINING input; a non-empty SelFilter returns the matching
//     subset, an empty SelFilter is a catch-all only as the last group;
//   * a non-empty subset runs the group's target command with the subset in the argument named InputObjsArgName
//     (none for an empty name); the dispatched items leave the remainder (inferred, contract step 4);
//   * so a mixed selection can run several targets, in group order.
// What each selection filter matches is in the filter DLL (not read); the predicates below are inferred from the
// filter names, the XSIFILTERMGR message strings (data/si/dict.json) and the public SDK filter list. Filters that
// name a component this build does not have (NurbsCurvePoint, UKnotCurve, VKnotCurve) match nothing.
// A target the bus does not have (a missing ApplyTopoOp preset, DirectManipTool) logs "not yet attested" and the
// executor goes on with the next group.
import { App, fmtCall, type CommandDef } from '../core/commands';
import { Node, X3DObject, Cluster, Partition, Pass } from '../core/scene';
import type { CompKind } from '../core/topology';
import { resolve, compString, filterKind, objectFilter, type CompRef } from './selectionGroupLayer';
import * as T from './selectionGroupLayerTopology';
import { SiStatusError } from './alembicSeqCam';
import data from '../data/si/filter_maps.json';

const ROW = 'CMD-B16d';
const nya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${ROW})`);
const unset = (v: any) => v === undefined || v === null || v === '';
export const E_POINTER = 0x80004003;
export const E_INVALIDARG = 0x80070057;
/** rendercore RegenerateMaps: empty Properties list, nothing done. */
export const S_NOTHING_TO_DO = 0x562e80d2;

interface Group { filter: string; filterRef: string; mapClient: string; cmdId: string; inputArgName: string; }
interface FilterMapCommand { name: string; guid: string; category: string; description: string; tooltip: string; flags: number; inputArg: string; wellFormed: boolean; groups: Group[]; args: [string, any][]; }
interface Target { name: string; scripting: string; handler: string; args: [string, any][]; script: string; }
const DATA = data as unknown as { commands: FilterMapCommand[]; targets: Record<string, Target> };

/** One input item: a node, or the components of one object. */
type Item = { node: Node } | { comp: CompRef };
const isComp = (it: Item): it is { comp: CompRef } => 'comp' in it;

/** Per-run record of what the executor dispatched (read by tools/compare_filtermap_b16d.mjs). */
export interface DispatchRecord { command: string; group: number; filter: string; target: string; run: string | null; preset?: string; input: string[]; skipped?: string; }
export interface B16dState { dispatches: DispatchRecord[]; out: Record<string, Record<string, any>>; lastStatus: Record<string, number>; ambient: Record<string, any>; }
export const stateOf = (app: App): B16dState => ((app as any).filterMapB16d ??= { dispatches: [], out: {}, lastStatus: {}, ambient: {} });

// ------------------------------------------------------------------ selection filters (inferred predicates)

const meshObj = (o: X3DObject | null | undefined) => !!o && (o.type === 'polymsh' || o.primitive?.type === 'polymsh');
const curveObj = (o: X3DObject | null | undefined) => !!o && (o.type === 'crvlist' || o.primitive?.type === 'crvlist' || !!o.primitive?.curve?.());
const particleObj = (o: X3DObject | null | undefined) => !!o && /^(pointcloud|particlecloud|cloud)$/i.test(o.type);
const clusterObj = (c: Cluster) => c.obj;

/** The predicate of one SelFilter name, or null when the name is unknown to this build. */
function filterPredicate(app: App, name: string): ((it: Item) => boolean) | null {
  const s = name.trim().toLowerCase().replace(/[\s_]/g, '');
  switch (s) {
    // inferred: XSIFILTERMGR 1066 "polygon mesh component (Vertex, Polygon, Edge) or cluster"
    case 'meshcomponent': return it => isComp(it) ? meshObj(it.comp.obj) : it.node instanceof Cluster && meshObj(clusterObj(it.node));
    // inferred: a user-created cluster node (Delete Selected tests it before the component groups)
    case 'usercluster': return it => !isComp(it) && it.node instanceof Cluster;
    // inferred: NURBS curve control points = point components of a curve object
    case 'nurbscurvecv': return it => isComp(it) && it.comp.kind === 'point' && curveObj(it.comp.obj);
    // inferred: knots / knot curves are not selectable components in this build: nothing matches
    case 'nurbscurvepoint': case 'uknotcurve': case 'vknotcurve': return () => false;
    // inferred: point components of a particle / point cloud
    case 'particlepoint': return it => isComp(it) && it.comp.kind === 'point' && particleObj(it.comp.obj);
    // inferred: a curve object, or any component on one (the registry spelling "Anyting" is kept)
    case 'curveoranytingonacurve': case 'curveoranythingonacurve': return it => isComp(it) ? curveObj(it.comp.obj) : it.node instanceof X3DObject && curveObj(it.node);
  }
  const k = filterKind(name);
  if (k === 'object') return it => !isComp(it) && it.node instanceof X3DObject;
  if (k === 'point' || k === 'edge' || k === 'polygon') return it => isComp(it) && it.comp.kind === k;
  const of = objectFilter(app, name);   // polygon_mesh and the other object-type filters (selectionGroupLayer)
  if (of) return it => !isComp(it) && it.node instanceof X3DObject && of(it.node);
  return null;
}

// ------------------------------------------------------------------ input

function currentSelectionItems(app: App): Item[] {
  const c = app.compSel;
  if (c) {
    const items = [...(c.kind === 'point' ? c.points : c.kind === 'edge' ? c.edges : c.polygons)];
    if (items.length) return [{ comp: { obj: c.obj, kind: c.kind, items } }];
  }
  return app.selection.map(node => ({ node }));
}
function inputItems(app: App, v: any): Item[] {
  if (unset(v) || (Array.isArray(v) && !v.length)) return currentSelectionItems(app);   // empty input = current selection
  const r = resolve(app, v);
  const items: Item[] = [...r.comps.map(comp => ({ comp })), ...r.nodes.map(node => ({ node }))];
  return items.length ? items : currentSelectionItems(app);
}
function itemText(it: Item): string {
  if (!isComp(it)) return it.node.fullName;
  const m = it.comp.obj.primitive?.mesh?.();
  if (!m) return `${it.comp.obj.name}.${it.comp.kind}[${it.comp.items.join(',')}]`;
  return compString(it.comp.obj, T.adjacencyOf(m), it.comp.kind, it.comp.items);
}

/** Make the subset the selection the target command reads (ApplyTopoOp and the tools read app.compSel / selection). */
function bindSelection(app: App, subset: Item[]) {
  const comp = subset.find(isComp);
  if (comp) {
    const { obj, kind, items } = comp.comp;
    if (subset.filter(isComp).some(c => c.comp.obj !== obj || c.comp.kind !== kind)) nya(app, 'filter map', 'a component subset spanning several objects or kinds; the target gets the first one as its selection');
    app.compSel = { obj, kind: kind as CompKind, points: new Set(), edges: new Set(), polygons: new Set() };
    const set: Set<any> = kind === 'point' ? app.compSel.points : kind === 'edge' ? app.compSel.edges : app.compSel.polygons;
    items.forEach(x => set.add(x));
    app.selection = [obj]; app.events.emit('selection');
    return;
  }
  app.compSel = null; app.select(subset.map(it => (it as { node: Node }).node));
}

// ------------------------------------------------------------------ the executor

/** Run one target command; returns its result, or undefined with a "not yet attested" line when the bus lacks it. */
function runTarget(app: App, fm: FilterMapCommand, k: number, g: Group, subset: Item[], rec: DispatchRecord): any {
  const t = DATA.targets[g.cmdId];
  if (!t) { rec.skipped = 'target GUID not in the registry'; nya(app, fm.name, `target command {${g.cmdId}} (not in the registry)`); return undefined; }
  const cmd = t.scripting || t.name;
  const def = app.commands.get(cmd);
  if (!def) { rec.skipped = `${cmd} not on the bus`; nya(app, fm.name, `${t.name} (${cmd}) is not on the bus in this build; group ${k + 1} (${g.filter || 'catch-all'}) skipped`); return undefined; }
  const args: Record<string, any> = {};
  const declared = new Set(def.args.map(a => a.name));
  for (const [n, d] of t.args) if (d !== null && d !== undefined && !n.startsWith('_') && declared.has(n)) args[n] = d;   // the target preset's own defaults
  if (cmd === 'ApplyTopoOp') {
    const reg = String(args.PresetObj ?? '');
    const preset = [reg, t.name].find(p => p && (def.supported ? def.supported({ PresetObj: p }) : true));
    if (!preset) { rec.skipped = `ApplyTopoOp preset ${reg} not in this build`; nya(app, fm.name, `the "${t.name}" topology preset (${reg}) is not in this build; group ${k + 1} (${g.filter || 'catch-all'}) skipped`); return undefined; }
    args.PresetObj = preset; rec.preset = preset;
  }
  if (/Wizard/i.test(t.script)) nya(app, fm.name, `the options dialog of "${t.name}" (${t.script}); the target runs with its defaults`);
  if (g.inputArgName) {
    bindSelection(app, subset);
    const nodesOnly = subset.every(it => !isComp(it));
    args[g.inputArgName] = nodesOnly ? subset.map(it => (it as { node: Node }).node) : subset.map(itemText).join(',');
  }
  rec.run = cmd;
  const r = app.run(cmd, args);
  // the filter-map command has no scripting name: the target is what the command log shows (inferred)
  if (!def.noLog && (app as any).cmdLog !== false) {
    const alias = (n: string) => n === 'InputObj' ? 'InputObjs' : n === 'InputObjs' ? 'InputObj' : n;
    app.logMsg('cmd', fmtCall(cmd, def.args.map(a => args[a.name] ?? args[alias(a.name)] ?? a.default), (app as any).scriptLang));
  }
  return r;
}

/** The generic filter-map executor (scnmgr command manager slot 0x88). */
export function executeFilterMap(app: App, fm: FilterMapCommand, a: Record<string, any>): any {
  if (!fm.wellFormed || !fm.groups.length) return undefined;   // count < 5 or (count - 1) % 4 != 0: nothing runs
  let remaining = inputItems(app, a[fm.inputArg]);
  const st = stateOf(app);
  let result: any;
  for (let k = 0; k < fm.groups.length; k++) {
    const g = fm.groups[k];
    let subset: Item[];
    if (!g.filter) {
      if (k !== fm.groups.length - 1) continue;   // an empty filter is a catch-all only as the last group
      subset = remaining;
    } else {
      const pred = filterPredicate(app, g.filter);
      if (!pred) { nya(app, fm.name, `what the selection filter "${g.filter}" matches; group ${k + 1} skipped`); continue; }
      subset = remaining.filter(pred);
    }
    if (!subset.length) continue;   // an empty subset skips the group
    const rec: DispatchRecord = { command: fm.name, group: k, filter: g.filter, target: DATA.targets[g.cmdId]?.name ?? g.cmdId, run: null, input: subset.map(itemText) };
    st.dispatches.push(rec);
    remaining = remaining.filter(it => !subset.includes(it));   // inferred: dispatched items leave the remainder
    const r = runTarget(app, fm, k, g, subset, rec);
    if (r !== undefined) result = r;   // inferred: the last target's result is handed back
  }
  return result;
}

// ------------------------------------------------------------------ rendercore helpers

function nodesOf(app: App, v: any): any[] {
  if (unset(v)) return [];
  if (Array.isArray(v)) return v.flatMap(x => nodesOf(app, x));
  if (v instanceof Node) return [v];
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean).map(s => findNode(app, s)).filter(Boolean);
  return [v];
}
function findNode(app: App, name: string): any {
  const o = app.scene.find(name); if (o) return o;
  for (const p of app.scene.passes) { if (p.name === name || `Passes.${p.name}` === name) return p; for (const q of p.partitions) if (`${p.name}.${q.name}` === name || `Passes.${p.name}.${q.name}` === name) return q; }
  for (const x of app.scene.allObjects()) for (const p of x.properties) if (p.fullName === name || `${x.name}.${p.name}` === name) return p;
  return undefined;
}
/** Ambient values: the shared uitasks store when present (cmd-b7a), else this row's own. */
const ambient = (app: App): Record<string, any> => (app as any).uiGroupViewTasks?.ambient ?? stateOf(app).ambient;
/** Current local time as a Windows FILETIME (100 ns ticks since 1601-01-01), as a bigint. */
const fileTimeNow = () => { const d = new Date(); const local = d.getTime() - d.getTimezoneOffset() * 60000; return (BigInt(local) + 11644473600000n) * 10000n; };

export function registerFilterMapB16dCommands(app: App) {
  const reg = (def: CommandDef) => app.register(def);

  // ---------------------------------------------------------------- the eight filter-map commands
  for (const fm of DATA.commands) {
    reg({
      name: fm.name, label: fm.tooltip || fm.name, category: fm.category, description: fm.description,
      args: fm.args.map(([name, d]) => ({ name, default: d })),
      // the target command is what the log shows (logged by the executor); the filter-map command itself is not
      noLog: true,
      supported: () => true,
      execute: (app2, a) => executeFilterMap(app2, fm, a),
    });
  }

  // ---------------------------------------------------------------- CopyPartition (rendercore.dll)
  // Target = passes, InputObjs = partitions, used as given (no current-pass / all-passes fallback). For every
  // partition x pass a new duplicate is added (never merged into a same-named partition): same parameters, same
  // members, named like the source. Returns nothing (inferred). Undoable.
  reg({
    name: 'CopyPartition', label: 'Copy Partition', category: 'Rendering', description: 'Copy partitions to the passes',
    args: [{ name: 'Target', default: null }, { name: 'InputObjs', default: null }],
    execute(app2, a) {
      const C = 'CopyPartition';
      // inferred: the pass interface d233acd7 = Pass; partitions of kind 5 / 6 = object / light partitions (every Partition here)
      const passes = nodesOf(app2, a.Target).filter((x): x is Pass => x instanceof Pass);
      const parts = nodesOf(app2, a.InputObjs).filter((x): x is Partition => x instanceof Partition);
      if (!passes.length || !parts.length) { stateOf(app2).lastStatus[C] = 0; return undefined; }
      for (const part of parts) for (const pass of passes) {
        // 1. Low Level Duplicate of the partition: parameters copied
        const copy = new Partition(part.name);
        for (const p of part.params) { const q = copy.get(p.def.name); if (q && !p.def.readOnly) q.value = p.value; }
        // 2-3. added to the target pass
        // 4. its members written back and moved into the copy (inferred: the Move Objects To Layer task 1c7c2c98
        //    re-parents them, so in the target pass every member leaves the partition that held it)
        const members = [...part.members];
        const takenFrom = pass.partitions.map(q => [q, members.filter(m => q.members.has(m))] as const).filter(([, ms]) => ms.length);
        app2.record(C, () => {
          pass.partitions.push(copy); copy.parent = pass;
          for (const [q, ms] of takenFrom) ms.forEach(m => q.members.delete(m));
          members.forEach(m => copy.members.add(m));
        }, () => {
          const i = pass.partitions.indexOf(copy); if (i >= 0) pass.partitions.splice(i, 1);
          members.forEach(m => copy.members.delete(m));
          for (const [q, ms] of takenFrom) ms.forEach(m => q.members.add(m));
        });
        // 5. SetValue Name = the source partition's name (the copy is constructed with it)
      }
      stateOf(app2).lastStatus[C] = 0;
      app2.events.emit('scene');
      return undefined;
    },
  });

  // ---------------------------------------------------------------- RegenerateMaps (rendercore.dll)
  // Properties required (E_INVALIDARG when missing; the registry's selection handler 7834cb8c fills it from the
  // selection); TileSize clamped to 8..512 with a warning (XSIRENDERCORE 0x59, text not in the data); an empty list
  // does nothing and returns 0x562e80d2; PATH_TEMPLATE_SYSTEM_TIME is set for the run. The job builder and the
  // rendering are the renderer's: not in this build.
  reg({
    name: 'RegenerateMaps', label: 'RegenerateMaps', category: 'Rendering', description: 'Regenerates the selected Render Maps.', undoable: false,
    args: [{ name: 'Properties', default: null }, { name: 'TileSize', default: 32 }],
    execute(app2, a) {
      const C = 'RegenerateMaps'; const st = stateOf(app2);
      let given: any = a.Properties;
      if (unset(given)) given = app2.selection.length ? app2.selection.slice() : null;   // registry arg handler 7834cb8c
      if (unset(given)) { st.lastStatus[C] = E_INVALIDARG; throw new SiStatusError(E_INVALIDARG, `${C}: Properties is required`); }
      let tile = Math.trunc(Number(a.TileSize)); if (!Number.isFinite(tile)) tile = 32;
      if (tile < 8 || tile > 512) {
        tile = Math.min(512, Math.max(8, tile));
        app2.logMsg('info', `WARNING : ${C}: TileSize clamped to ${tile} (XSIRENDERCORE message 0x59)`);
      }
      const props = nodesOf(app2, given);
      st.out[C] = { TileSize: tile, Properties: props };
      if (!props.length) { st.lastStatus[C] = S_NOTHING_TO_DO; return undefined; }
      const amb = ambient(app2);
      amb.PATH_TEMPLATE_SYSTEM_TIME = fileTimeNow();
      st.out[C].systemTime = amb.PATH_TEMPLATE_SYSTEM_TIME;
      try {
        for (const p of props) nya(app2, C, `the render-map job for ${(p as any)?.fullName ?? p} (accepted property types, output paths; tile size ${tile}); no renderer in this build`);
      } finally { delete amb.PATH_TEMPLATE_SYSTEM_TIME; }
      st.lastStatus[C] = 0;
      return undefined;
    },
  });
}
