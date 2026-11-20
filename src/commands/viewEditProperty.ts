// INFERRED batch: Softimage commands of the registry categories Viewing and Edit that were missing from the command bus
// (Property / Constraint / Transport Control / General live in viewEditPropertyMore.ts).
//
// There is no analyst note for these. Names, argument names, order and defaults are the entries of
// data/commands_full.json (overloads of one name are registered once, with the first / superset argument list).
// Behaviour is reasoned from the registry descriptions, the documented Softimage scripting conventions ("SI"-prefixed
// low-level variants do the same job without touching the selection or opening an editor) and from the related commands
// already on the bus (ToggleVisibility, HideSelection, UnhideAll, Duplicate, DeleteObj, ParentObj, DeleteOp, the
// SetObjectDisplay* / SetWireColor* palette commands and the view manager's display state). Every register call is
// marked `// inferred`; branches that could not be reasoned out log or raise "not yet attested".
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Node, Model, Null, Operator, Primitive } from '../core/scene';
import { registerViewEditPropertyMore } from './viewEditPropertyMore';
import { subComponentsOf, owningModelsOf, branchList, msgBoxB17b, localiseMaterialsOfCopy } from './chainsModelB17b';
import { siString } from '../ui/si';
import { deleteObjList } from './tasksB16c';
import {
  reg, nya, logNya, unset, siConst, numArg, boolArg, objs, nodes, findNode, findOperator, paramOf, paramsOf,
  ensureLocal, reparent, setLocalMatrix, isDescendant, copyNode, buildInstance, attach, hasGeometry, masterOfInstance,
} from './viewEditPropertyHelpers';

const vm = () => (window as any).__vm;
const ev = (name: string, detail?: any) => window.dispatchEvent(new CustomEvent(name, { detail }));

/** Registry DisplayMode keyword → the view manager's display mode name. */
const VIEW_MODES: Record<string, string> = {
  wireframe: 'Wireframe', bbox: 'Bounding Box', hiddenline: 'Hidden Line', constant: 'Constant', shaded: 'Shaded',
  textured: 'Textured', texturedecal: 'Texture Decal', depthcue: 'Wireframe',
};

export function registerViewEditPropertyCommands(app: App) {
  registerViewing(app);
  registerEdit(app);
  registerViewEditPropertyMore(app);
}

// ====================================================================================================== Viewing
function registerViewing(app: App) {
  const visParam = (o: X3DObject, propName: any, param = 'viewvis') => {
    const key = unset(propName) ? 'visibility' : String(propName);
    return paramOf(o, `${key}.${param}`) ?? o.property('visibility')?.get(param);
  };
  const setVis = (o: X3DObject, propName: any, v: boolean, label: string) => { const p = visParam(o, propName); if (p) app.setParam(p, v, label); };

  // HideUnselected: CMD-B17a (selectionLayersB17a.ts)
  // inferred
  reg(app, {
    name: 'HideAndUnselect', label: 'Hide and Unselect', category: 'Viewing', description: 'Hides the selected objects and clears the selection',
    args: [{ name: 'Target', default: null }, { name: 'PropertyName', default: 'visibility' }],
    execute(app, a) {
      const list = objs(app, a.Target);
      for (const o of list) setVis(o, a.PropertyName, false, 'Hide');
      const before = [...app.selection]; const after = before.filter(n => !list.includes(n as any));
      app.record('Unselect', () => app.select(after), () => app.select(before));
    },
  });
  // SIHideObjects / SIUnhideObjects / UnghostAll: CMD-B17a (selectionLayersB17a.ts)

  // ---- isolation: the per-viewport isolate set the camera menu's "Isolate Selection" already drives (view state, not undoable)
  const viewports = (view: any, all = false): any[] => {
    const m = vm(); if (!m) throw new Error('no 3D view is available');
    const vps: any[] = m.viewports();
    if (all) return vps;
    const i = typeof view === 'number' ? view : -1;
    return [i >= 0 && i < vps.length ? vps[i] : m.active()];
  };
  const isolateEdit = (name: string, view: any, edit: (set: Set<X3DObject>, sel: X3DObject[]) => void) => {
    let n = 0;
    for (const vp of viewports(view)) { const x = vp.x; if (!x?.isolate) continue; edit(x.isolate, app.selectedObjects); n++; }
    if (!n) app.logMsg('info', `${name}: the view is not in isolation mode`);
  };
  // inferred: ends isolation (every object is shown again); All = every viewport, else the given / active one
  reg(app, {
    name: 'IsolateAll', label: 'Isolate All', category: 'Viewing', description: 'Isolate all objects', undoable: false,
    args: [{ name: 'All', default: true }, { name: 'View', default: -1 }],
    execute(app, a) { for (const vp of viewports(a.View, boolArg(a.All))) if (vp.x) vp.x.isolate = null; },
  });
  // inferred
  reg(app, {
    name: 'IsolateAddSelected', label: 'Isolate Add Selected', category: 'Viewing', description: 'Isolate add selected objects', undoable: false,
    args: [{ name: 'View', default: false }],
    execute(_app, a) { isolateEdit('IsolateAddSelected', a.View, (set, sel) => sel.forEach(o => set.add(o))); },
  });
  // inferred
  reg(app, {
    name: 'IsolateRemoveSelected', label: 'Isolate Remove Selected', category: 'Viewing', description: 'Isolate remove selected objects', undoable: false,
    args: [{ name: 'View', default: false }],
    execute(_app, a) { isolateEdit('IsolateRemoveSelected', a.View, (set, sel) => sel.forEach(o => set.delete(o))); },
  });
  // inferred
  reg(app, {
    name: 'IsolateToggleSelected', label: 'Isolate Toggle Selected', category: 'Viewing', description: 'Isolate toggle selected objects', undoable: false,
    args: [{ name: 'View', default: false }],
    execute(_app, a) { isolateEdit('IsolateToggleSelected', a.View, (set, sel) => sel.forEach(o => { if (set.has(o)) set.delete(o); else set.add(o); })); },
  });
  // ColorizeObject / ShadeObject: replaced by the CMD-B17g contract (tools.vbs pick loops, paramsToolsB17g.ts)

  const displayKey = (): string => {
    const m = vm(); const cur = String(m?.displayOf() ?? '');
    if (cur === 'wireframe' && m.flags()['Depth Cue']) return 'depthcue';
    return Object.keys(VIEW_MODES).find(k => k !== 'depthcue' && VIEW_MODES[k].toLowerCase() === cur) ?? cur;
  };
  const setDisplay = (key: any) => {
    const m = vm(); if (!m) throw new Error('no 3D view is available');
    const k = String(key ?? '').toLowerCase().replace(/[ _]/g, ''); const mode = VIEW_MODES[k];
    if (!mode) throw new Error(`unknown display mode "${key}"`);
    m.display(mode);
    // Depth cue is a wireframe with the view's Depth Cue flag; the other modes of the radio group switch it off.
    if (!!m.flags()['Depth Cue'] !== (k === 'depthcue')) ev('displaytoggle', { item: 'Depth Cue' });
    return k;
  };
  // inferred: display mode of the active 3D view (view state, not undoable)
  reg(app, {
    name: 'SetViewDisplayMode', label: 'Set Shaded Display Mode', category: 'Viewing', description: 'Sets the display mode of the active 3D view', undoable: false,
    args: [{ name: 'DisplayMode', default: 'shaded' }],
    execute(_app, a) { setDisplay(a.DisplayMode); },
  });
  // inferred: second mode unless the view already shows it, then the first
  reg(app, {
    name: 'ToggleViewDisplayMode', label: 'Toggle Shaded Display Mode', category: 'Viewing', description: 'Toggles the active 3D view between two display modes', undoable: false,
    args: [{ name: 'FirstDisplayMode', default: 'wireframe' }, { name: 'SecondDisplayMode', default: 'shaded' }],
    execute(_app, a) { const second = String(a.SecondDisplayMode).toLowerCase(); setDisplay(displayKey() === second ? a.FirstDisplayMode : a.SecondDisplayMode); },
  });
  // inferred
  reg(app, {
    name: 'ToggleWireOnShadedDisplay', label: 'Toggle Wire On Shaded Display', category: 'Viewing', description: 'Toggles wireframe-on-shaded in the active 3D view', undoable: false, args: [],
    execute() { const m = vm(); if (!m) throw new Error('no 3D view is available'); m.wireOnShaded(); },
  });
  // inferred
  reg(app, {
    name: 'ToggleHeadlightDisplayMode', label: 'Toggle Headlight Display Mode', category: 'Viewing', description: 'Toggles the headlight of the active 3D view', undoable: false, args: [],
    execute() { if (!vm()) throw new Error('no 3D view is available'); ev('displaytoggle', { item: 'Headlight' }); },
  });

  // inferred
  reg(app, {
    name: 'CenterSelection', label: 'Center Selection (All 3D Views)', category: 'Viewing', description: 'Center selection in all views', undoable: false,
    args: [{ name: 'AllObjects', default: false }, { name: 'AllViews', default: true }, { name: 'View', default: -1 }],
    execute(app, a) {
      const m = vm(); if (!m) throw new Error('no 3D view is available');
      if (boolArg(a.AllObjects)) logNya(app, 'CenterSelection', 'AllObjects=True (centring on every object); the selection is centred');
      const act = m.active(); const before = act.camera.position.clone();
      m.center(false);
      const delta = act.camera.position.clone().sub(before);
      if (!boolArg(a.AllViews)) return;
      // The view manager keeps one orbit target, so the other views are moved here: orthographic views slide in their
      // plane until the same centre is on their axis, other perspective views take the same offset.
      const c = new THREE.Vector3(); const sel = app.selectedObjects; if (!sel.length) return;
      for (const o of sel) c.add(new THREE.Vector3().setFromMatrixPosition(o.globalMatrix())); c.divideScalar(sel.length);
      for (const vp of m.viewports() as any[]) {
        if (vp === act) continue;
        if (vp.kind === 'ortho') { const dir = vp.camera.getWorldDirection(new THREE.Vector3()); const v = c.clone().sub(vp.camera.position); vp.camera.position.add(v.sub(dir.multiplyScalar(v.dot(dir)))); }
        else vp.camera.position.add(delta);
        vp.camera.updateMatrixWorld();
      }
    },
  });
  // inferred: frame the selection, or everything when nothing is selected
  reg(app, {
    name: 'FrameContextual', label: 'Frame Contextual (All 3D Views)', category: 'Viewing', description: 'Frame selection or all objects (if nothing is selected) in all views', undoable: false,
    args: [{ name: 'AllViews', default: true }, { name: 'View', default: -1 }],
    execute(app) { ev(app.selection.length ? 'framesel' : 'frameall'); },
  });

  // ---- user keywords / user tabs: per-node string annotations
  const words = (v: any): string[] => unset(v) ? [] : (Array.isArray(v) ? v : String(v).split(',')).map(s => String(s).trim()).filter(Boolean);
  const annotate = (field: 'userKeywords' | 'userTabs', n: Node, next: string[], label: string) => {
    const old: string[] = (n as any)[field] ?? []; const had = field in (n as any);
    app.record(label, () => { (n as any)[field] = next; }, () => { if (had) (n as any)[field] = old; else delete (n as any)[field]; });
  };
  const family = (field: 'userKeywords' | 'userTabs', what: 'Keyword' | 'Tab', noun: string) => {
    // inferred: Set replaces the list
    reg(app, {
      name: `SetUser${what}`, label: `Set User ${what}`, category: 'Viewing|Property', description: `Sets the ${noun}(s) on the input object(s)`,
      args: [{ name: 'InputObjs', default: null }, { name: 'Keywords', default: '' }],
      execute(app, a) { for (const n of nodes(app, a.InputObjs)) annotate(field, n, [...new Set(words(a.Keywords))], `Set User ${what}`); },
    });
    // inferred: comma separated text of the inputs' entries
    reg(app, {
      name: `GetUser${what}`, label: `Get User ${what}`, category: 'Viewing|Property', description: `Gets the ${noun}(s) on the input object(s)`, undoable: false,
      args: [{ name: 'InputObjs', default: null }, { name: 'Keywords', default: null }],
      execute(app, a) { const out: string[] = []; for (const n of nodes(app, a.InputObjs)) for (const w of ((n as any)[field] ?? []) as string[]) if (!out.includes(w)) out.push(w); return out.join(','); },
    });
    // inferred
    reg(app, {
      name: `RemoveUser${what}`, label: `Remove User ${what}`, category: 'Viewing|Property', description: `Removes the given ${noun}(s) from the input object(s)`,
      args: [{ name: 'InputObjs', default: null }, { name: 'Keywords', default: '' }],
      execute(app, a) { const drop = new Set(words(a.Keywords)); for (const n of nodes(app, a.InputObjs)) { const cur: string[] = (n as any)[field] ?? []; if (cur.some(w => drop.has(w))) annotate(field, n, cur.filter(w => !drop.has(w)), `Remove User ${what}`); } },
    });
    // inferred
    reg(app, {
      name: `ClearUser${what}`, label: `Clear User ${what}`, category: 'Viewing|Property', description: `Clears the ${noun}(s) on given object(s)`,
      args: [{ name: 'InputObjs', default: null }],
      execute(app, a) { for (const n of nodes(app, a.InputObjs)) if (((n as any)[field] ?? []).length) annotate(field, n, [], `Clear User ${what}`); },
    });
  };
  family('userKeywords', 'Keyword', 'user keyword');
  family('userTabs', 'Tab', 'user tab');
  // inferred: Add appends to the list (Set replaces it)
  reg(app, {
    name: 'AddUserTab', label: 'Add User Tab', category: 'Viewing|Property', description: 'Adds user tab(s) to the input object(s)',
    args: [{ name: 'InputObjs', default: null }, { name: 'Keywords', default: '' }],
    execute(app, a) { const add = words(a.Keywords); for (const n of nodes(app, a.InputObjs)) { const cur: string[] = (n as any).userTabs ?? []; const next = [...cur, ...add.filter(w => !cur.includes(w))]; if (next.length !== cur.length) annotate('userTabs', n, next, 'Add User Tab'); } },
  });
}

// ========================================================================================================= Edit
function registerEdit(app: App) {
  // inferred
  reg(app, {
    name: 'ToggleSelectability', label: 'Toggle Selectability', category: 'Edit|Selection', description: 'Toggles the selectability of selected objects',
    args: [{ name: 'InputObjects', default: null }, { name: 'Parameter', default: 'visibility.selectability' }],
    execute(app, a) {
      for (const o of objs(app, a.InputObjects)) { const p = paramOf(o, String(a.Parameter || 'visibility.selectability')); if (!p) throw new Error(`${o.name} has no parameter ${a.Parameter}`); app.setParam(p, !p.value, 'Selectability'); }
    },
  });
  // MakeAllUnselectable: CMD-B17a (selectionLayersB17a.ts)
  // inferred
  reg(app, {
    name: 'ParentObjects', label: 'Parent Objects', category: 'Edit', description: 'Parent objects under last object in the list',
    args: [{ name: 'Objects', default: null }],
    execute(app, a) {
      const list = objs(app, a.Objects);
      if (list.length < 2) throw new Error('ParentObjects needs at least two objects (the last one becomes the parent)');
      const parent = list[list.length - 1];
      for (const c of list.slice(0, -1)) {
        if (isDescendant(parent, c)) throw new Error(`cannot parent ${c.name} under its own descendant ${parent.name}`);
        reparent(app, c, parent);
      }
    },
  });

  // ---- clone / instance / duplicate
  const DUP_ARGS = [
    { name: 'InputObjs', default: null }, { name: 'NbItems', default: 1 },
    { name: 'Hierarchy', default: ':siNoParent:siDupParent' }, { name: 'Grouping', default: ':siNoGrouping:siDupGroup' },
    { name: 'Properties', default: ':siDuplicateProperties:siDupProperty' }, { name: 'Animation', default: ':siDuplicateAnimation:siDupAnimation' },
    { name: 'Constraints', default: ':siDuplicateConstraints:siDupConstraint' }, { name: 'Selection', default: ':siSetSelection:siDupSelection' },
    { name: 'Xfrom', default: ':siGlobalXForm:siDupTransform' },
    { name: 'Sx', default: '' }, { name: 'Sy', default: '' }, { name: 'Sz', default: '' }, { name: 'Rx', default: '' }, { name: 'Ry', default: '' }, { name: 'Rz', default: '' },
    { name: 'Tx', default: '' }, { name: 'Ty', default: '' }, { name: 'Tz', default: '' }, { name: 'TrackXform', default: '' },
  ];
  const count = (v: any) => Math.max(1, Math.round(numArg(v) ?? 1));
  /** Where a copy goes (Hierarchy) and whether it keeps the source's global pose (Xfrom). */
  const placeCopy = (cmd: string, a: Record<string, any>, src: X3DObject, c: X3DObject, i: number) => {
    const h = siConst(a.Hierarchy);
    let parent = src.parentObj ?? app.scene.root;
    if (h === 'siNoParent' || h === 0) parent = app.scene.root;
    else if (!(h === 'siSharedParent' || h === 1 || h === -1 || h === null)) logNya(app, cmd, `Hierarchy ${a.Hierarchy}; the copy shares the source's parent`);
    attach(app, c, parent, cmd);
    const x = siConst(a.Xfrom);
    if (parent !== src.parentObj && (x === 'siGlobalXForm' || x === -1 || x === null)) {
      const g = (src.parentObj ? src.parentObj.globalMatrix() : new THREE.Matrix4()).multiply(src.kinematics.localMatrix());
      setLocalMatrix(app, c, parent.globalMatrix().invert().multiply(g), cmd);
    }
    // Sx..Tz: the transform between successive copies (copy i gets it i times), as in the Duplicate/Clone options
    const l = c.kinematics.local; const t = (k: string) => numArg(a[k]);
    for (const ax of ['x', 'y', 'z']) {
      const s = t('S' + ax), r = t('R' + ax), p = t('T' + ax);
      if (s !== null && s !== 1) app.setParam(l.get('scl' + ax)!, l.val('scl' + ax) * Math.pow(s, i), cmd);
      if (r) app.setParam(l.get('rot' + ax)!, l.val('rot' + ax) + r * i, cmd);
      if (p) app.setParam(l.get('pos' + ax)!, l.val('pos' + ax) + p * i, cmd);
    }
    if (boolArg(a.TrackXform)) logNya(app, cmd, 'TrackXform');
  };
  const selectCopies = (a: Record<string, any>, made: X3DObject[]) => {
    const s = siConst(a.Selection);
    if (s === 'siNoSelection') return;
    app.select(made, s === 'siAddSelection' ? 'add' : 'replace');
  };
  const instantiate = (cmd: string, src: X3DObject, name?: string): Model => {
    if (!(src instanceof Model) || src === app.scene.root) throw new Error(`${cmd}: ${src.name} is not a model (only models can be instantiated)`);
    if (masterOfInstance(src)) throw new Error(`${cmd}: ${src.name} is itself an instance`);
    return buildInstance(app, src, name);
  };

  // inferred: a clone is a new object whose generator reads the master's evaluated geometry (CopyOperator)
  reg(app, {
    name: 'Clone', label: 'Clone Single', category: 'Edit', description: 'Creates clones of the input objects: copies whose geometry follows the original',
    args: DUP_ARGS,
    execute(app, a) {
      const made: X3DObject[] = [];
      for (const o of objs(app, a.InputObjs)) {
        if (o === app.scene.root) continue;
        for (let i = 1; i <= count(a.NbItems); i++) {
          const c = copyNode(app, o, { clone: true, asModel: o instanceof Model });
          if (hasGeometry(o)) (c as any).cloneMaster = o;
          if (o.children.length && i === 1) logNya(app, 'Clone', `cloning the children of ${o.name} (branch); only the node itself is cloned`);
          placeCopy('Clone', a, o, c, i); made.push(c);
        }
      }
      if (!made.length) throw new Error('Clone: select the object(s) to clone');
      selectCopies(a, made);
      return made;
    },
  });
  // inferred: the obsolete high-level instantiate (same options as Clone), models only
  reg(app, {
    name: 'Instance', label: 'Old Instance Command (Obsolete)', category: 'Edit', description: 'Creates instances of the input models',
    args: DUP_ARGS.map(d => ['Hierarchy', 'Grouping', 'Properties', 'Animation', 'Constraints', 'Selection', 'Xfrom'].includes(d.name) ? { name: d.name, default: -1 } : d),
    execute(app, a) {
      const made: X3DObject[] = [];
      const list = objs(app, a.InputObjs); if (!list.length) throw new Error('Instance: select the model(s) to instantiate');
      for (const o of list) for (let i = 1; i <= count(a.NbItems); i++) { const c = instantiate('Instance', o); placeCopy('Instance', a, o, c, i); made.push(c); }
      selectCopies(a, made);
      return made;
    },
  });
  // inferred: low-level instantiate — no selection change, optional name
  reg(app, {
    name: 'SIInstantiate', label: 'Low Level Instantiate Command', category: 'Edit', description: 'Creates instances of the input models',
    args: [{ name: 'InputObjs', default: null }, { name: 'NbItems', default: 1 }, { name: 'Name', default: '' }],
    execute(app, a) {
      const made: X3DObject[] = [];
      const list = objs(app, a.InputObjs); if (!list.length) throw new Error('SIInstantiate: no model given');
      for (const o of list) for (let i = 1; i <= count(a.NbItems); i++) { const c = instantiate('SIInstantiate', o, a.Name || undefined); attach(app, c, o.parentObj ?? app.scene.root, 'SIInstantiate'); made.push(c); }
      return made;
    },
  });
  // inferred
  reg(app, {
    name: 'GetMaster', label: 'Find Master of Instance Command', category: 'Edit', description: 'Returns the master model(s) of the input instance(s)', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) { const out: X3DObject[] = []; for (const o of objs(app, a.InputObjs)) { const m = masterOfInstance(o); if (m && !out.includes(m)) out.push(m); } return out; },
  });
  // inferred
  reg(app, {
    name: 'GetInstances', label: 'Get Instances of Master Command', category: 'Edit', description: 'Returns the instances of the input master model(s)', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) { const masters = new Set<X3DObject>(objs(app, a.InputObjs)); return [...app.scene.allObjects()].filter(o => { const m = masterOfInstance(o); return !!m && masters.has(m); }); },
  });
  // inferred: low-level Duplicate — same copies as the Duplicate command, selection untouched
  reg(app, {
    name: 'SIDuplicate', label: 'Low Level Duplicate Command', category: 'Edit', description: 'Duplicates the input objects without changing the selection',
    args: [
      { name: 'InputObjs', default: null }, { name: 'NbItems', default: 1 }, { name: 'PropagationType', default: ':siUnspecified:siBranchFlag' },
      { name: 'History', default: '2' }, { name: 'Hierarchy', default: '1' }, { name: 'Grouping', default: '1' }, { name: 'Properties', default: '0' },
      { name: 'Animation', default: '0' }, { name: 'Constraints', default: '1' }, { name: 'TextureSupports', default: '0' },
    ],
    execute(app, a) {
      const list = objs(app, a.InputObjs).filter(o => o !== app.scene.root); if (!list.length) throw new Error('SIDuplicate: no object given');
      const defaults: Record<string, string> = { History: '2', Hierarchy: '1', Grouping: '1', Properties: '0', Animation: '0', Constraints: '1', TextureSupports: '0' };
      const odd = Object.keys(defaults).filter(k => String(a[k]) !== defaults[k]);
      if (odd.length) logNya(app, 'SIDuplicate', `option value(s) ${odd.map(k => `${k}=${a[k]}`).join(', ')}; the Duplicate command's behaviour is used`);
      const sel = [...app.selection];
      const made = app.run('Duplicate', { InputObjs: list, NbCopies: count(a.NbItems) }) as X3DObject[];
      app.select(sel);
      return made;
    },
  });

  // ---- models from objects
  const duplicateModel = (m: Model, parent: X3DObject): Model => {
    const copy = copyNode(app, m, { clone: false, asModel: true }) as Model;
    attach(app, copy, parent, 'Duplicate');
    for (const ch of [...m.children]) {
      if (ch instanceof Model) { duplicateModel(ch, copy); continue; }
      // the Duplicate command copies an object together with its children
      const c = (app.run('Duplicate', { InputObjs: [ch] }) as X3DObject[])[0]; if (c) reparent(app, c, copy);
    }
    return copy;
  };
  // CMD-B17b (Model.vbs DuplicateModelFromObjectProc): sub-components -> message box 1082 and stop; the owning model of
  // each 3D object in branch (the object itself under the scene root) is duplicated with TextureSupports 1, then each
  // copy gets material localisation (no selection filter) and clip duplication.
  reg(app, {
    name: 'DuplicateModelFromObj', label: 'Duplicate Model from Object', category: 'Edit', description: 'Duplicates the model that contains the input object',
    args: [{ name: 'InputObj', default: null }],
    execute(app, a) {
      if (subComponentsOf(app, a.InputObj).length) { msgBoxB17b(app, siString('XSISCRIPTS', 1082) ?? 'Invalid selection, Please select objects'); return undefined; }
      const list = owningModelsOf(app, a.InputObj);
      if (!list) { app.logMsg('info', 'invalid selection, please select an object'); return undefined; }
      if (!list.length) return undefined;
      // Duplicate "B:<names>" with TextureSupports 1: this build's Duplicate has no option arguments; a model is copied
      // with its hierarchy, any other object through Duplicate (which copies its children)
      logNya(app, 'DuplicateModelFromObj', `Duplicate "${branchList(list)}" option arguments (only TextureSupports = 1 is set by the script; the others are the defaults)`);
      const copies: X3DObject[] = [];
      for (const o of list) {
        if (o instanceof Model) copies.push(duplicateModel(o, o.parentObj ?? app.scene.root));
        else { const c = (app.run('Duplicate', { InputObjs: [o] }) as X3DObject[] | undefined)?.[0]; if (c) copies.push(c); }
      }
      if (copies.length) app.select(copies);
      for (const c of copies) localiseMaterialsOfCopy(app, c);
      return copies.length === 1 ? copies[0] : copies;
    },
  });
  // CMD-B17b (Model.vbs DeleteModelFromObjectProc): sub-components -> polygons DeleteComponent, else DissolveComponent;
  // otherwise every item must be a 3D object, and the owning models (objects under the scene root) are deleted in branch.
  reg(app, {
    name: 'DeleteModelFromObj', label: 'Delete Model from Object', category: 'Edit', description: 'Deletes the model that contains the input object',
    args: [{ name: 'InputObj', default: null }],
    execute(app, a) {
      const subs = subComponentsOf(app, a.InputObj);
      if (subs.length) {
        const polys = subs.some(x => x.polygons);
        const preset = polys ? 'DeleteComponent' : 'DissolveComponent';
        const use = polys ? subs.filter(x => x.polygons) : subs;
        if (!unset(a.InputObj)) app.selectComponents(use[0].obj, use[0].kind, use[0].indices);   // this build's ApplyTopoOp reads the component selection
        const topo: any = app.commands.get('ApplyTopoOp'); const alias = polys ? 'Delete Component' : 'Dissolve Component';
        const name = topo?.supported?.({ PresetObj: preset }) ? preset : topo?.supported?.({ PresetObj: alias }) ? alias : null;
        if (!name) { logNya(app, 'DeleteModelFromObj', `ApplyTopoOp "${preset}", "${use.map(x => x.text).join(',')}" (no ${preset} topology operator in this build)`); return undefined; }
        return app.run('ApplyTopoOp', { PresetObj: name, ConnectionSet: use.map(x => x.text).join(',') });
      }
      const list = owningModelsOf(app, a.InputObj);
      if (!list) { app.logMsg('info', 'Invalid selection, Please select polygons or an object'); return undefined; }
      if (!list.length) return undefined;
      app.run('DeleteObj', { InputObj: branchList(list) });
      return undefined;
    },
  });
  // inferred: Confirm asks first (the wording of Softimage's own dialog is not attested)
  reg(app, {
    name: 'DeleteAll', label: 'Delete All', category: 'Edit', description: 'Delete all objects in the scene',
    args: [{ name: 'Confirm', default: true }],
    execute(app, a) {
      const all = [...app.scene.root.children]; if (!all.length) return false;
      if (boolArg(a.Confirm) && !window.confirm('Delete all objects in the scene?')) return false;
      // CMD-B17j Q17: the tasks.dll worker's "delete all" mode bit 0x8 (internal callers) skips the camera guard (inferred caller)
      deleteObjList(app, 'DeleteAll', all, 0x8);
      return true;
    },
  });
  // inferred: deletes like DeleteObj; what "permanently" adds is not attested
  reg(app, {
    name: 'DeleteObjPermanent', label: 'Delete Selected Permanently', category: 'Edit', description: 'Deletes the input objects',
    args: [{ name: 'InputObj', default: null }],
    execute(app, a) {
      const list = objs(app, a.InputObj).filter(o => o !== app.scene.root); if (!list.length) return;
      app.run('DeleteObj', { InputObj: list });
      logNya(app, 'DeleteObjPermanent', 'what "permanently" does beyond DeleteObj');
    },
  });
  // inferred
  reg(app, {
    name: 'ToggleParameterValue', label: 'Toggle Parameter Values', category: 'Edit', description: 'Toggles boolean parameter values of input objects',
    args: [{ name: 'InputObjects', default: null }, { name: 'Parameters', default: '' }],
    execute(app, a) {
      if (unset(a.Parameters)) throw new Error('ToggleParameterValue: no parameter given');
      const { found, missing } = paramsOf(app, objs(app, a.InputObjects), a.Parameters);
      if (missing.length) throw new Error(`ToggleParameterValue: parameter not found: ${missing.join(', ')}`);
      const bad = found.filter(p => p.def.type !== 'bool'); if (bad.length) throw new Error(`ToggleParameterValue: not a boolean parameter: ${bad.map(p => p.name).join(', ')}`);
      for (const p of found) app.setParam(p, !p.value, 'Toggle');
      return found.length;
    },
  });

  // ---- operator stack order (Primitive.operators: generator first, evaluation order)
  const stackOf = (cmd: string, objArg: any, ...opArgs: any[]): { prim: Primitive; ops: Operator[] } => {
    let prim: Primitive | null = null;
    const n = unset(objArg) ? undefined : findNode(app, objArg);
    if (n instanceof Primitive) prim = n; else if (n instanceof X3DObject) prim = n.primitive; else if (n instanceof Operator) prim = n.parent as Primitive;
    for (const x of opArgs) if (!prim && x instanceof Operator) prim = x.parent as Primitive;
    for (const x of opArgs) if (!prim && typeof x === 'string') { const f = findNode(app, x); if (f instanceof Operator) prim = f.parent as Primitive; }
    if (!prim) throw new Error(`${cmd}: no object with an operator stack given`);
    const ops = opArgs.map(x => { const op = findOperator(prim, x); if (!op) throw new Error(`${cmd}: operator ${x?.name ?? x} is not in the stack of ${(prim!.parent as any)?.name ?? prim!.name}`); return op; });
    return { prim, ops };
  };
  const reorder = (label: string, prim: Primitive, next: Operator[], regions: Map<Operator, Operator['region']>) => {
    const old = [...prim.operators]; const oldRegions = new Map(old.map(op => [op, op.region] as const));
    app.record(label, () => { prim.operators.splice(0, prim.operators.length, ...next); for (const [op, r] of regions) op.region = r; prim.dirty = true; },
      () => { prim.operators.splice(0, prim.operators.length, ...old); for (const [op, r] of oldRegions) op.region = r; prim.dirty = true; });
  };
  const move = (cmd: string, a: Record<string, any>, after: boolean) => {
    const { prim, ops: [op, ref] } = stackOf(cmd, a.Object, a.OperatorToMove, a.OperatorReference);
    if (op === ref) throw new Error(`${cmd}: the operator and the reference are the same`);
    if (prim.operators[0] === op) throw new Error(`${cmd}: the generator operator cannot be moved`);
    if (!after && prim.operators[0] === ref) throw new Error(`${cmd}: nothing can be moved before the generator operator`);
    const next = prim.operators.filter(x => x !== op); next.splice(next.indexOf(ref) + (after ? 1 : 0), 0, op);
    reorder(cmd, prim, next, new Map([[op, prim.operators[0] === ref ? op.region : ref.region]]));
  };
  // inferred: "after" = evaluated right after the reference (one step up the stack)
  reg(app, {
    name: 'MoveOperatorAfter', label: 'MoveOperatorAfter', category: 'Edit', description: 'move an item after another in the stack',
    args: [{ name: 'Object', default: null }, { name: 'OperatorToMove', default: null }, { name: 'OperatorReference', default: null }],
    execute(_app, a) { move('MoveOperatorAfter', a, true); },
  });
  // inferred: "before" = evaluated right before the reference
  reg(app, {
    name: 'MoveOperatorBefore', label: 'MoveOperatorBefore', category: 'Edit', description: 'move an item before another in the stack',
    args: [{ name: 'Object', default: null }, { name: 'OperatorToMove', default: null }, { name: 'OperatorReference', default: null }],
    execute(_app, a) { move('MoveOperatorBefore', a, false); },
  });
  // inferred
  reg(app, {
    name: 'SwapOperators', label: 'SwapOperators', category: 'Edit', description: 'exchange order of operators',
    args: [{ name: 'Object', default: null }, { name: 'Operator1', default: null }, { name: 'Operator2', default: null }],
    execute(_app, a) {
      const { prim, ops: [p, q] } = stackOf('SwapOperators', a.Object, a.Operator1, a.Operator2);
      if (p === q) throw new Error('SwapOperators: the two operators are the same');
      if (prim.operators[0] === p || prim.operators[0] === q) throw new Error('SwapOperators: the generator operator cannot be moved');
      const next = [...prim.operators]; const i = next.indexOf(p), j = next.indexOf(q); next[i] = q; next[j] = p;
      reorder('SwapOperators', prim, next, new Map([[p, q.region], [q, p.region]]));
    },
  });
  // inferred: sets Mute on every operator evaluated after the given one
  reg(app, {
    name: 'DeactivateAbove', label: 'DeactivateAbove', category: 'Edit', description: 'Deactivate above operator',
    args: [{ name: 'Operator', default: null }, { name: 'Mute', default: false }],
    execute(app, a) {
      const { prim, ops: [op] } = stackOf('DeactivateAbove', null, a.Operator);
      const above = prim.operators.slice(prim.operators.indexOf(op) + 1); let n = 0;
      for (const x of above) { const m = x.get('mute'); if (m) { app.setParam(m, boolArg(a.Mute), 'Mute'); n++; } else app.logMsg('info', `DeactivateAbove: ${x.name} has no mute parameter`); }
      prim.dirty = true;
      return n;
    },
  });

  // ---- transform groups
  // inferred: a null that becomes the parent of the input objects (their global pose is kept)
  reg(app, {
    name: 'CreateTransformGroup', label: 'Create Transform Group', category: 'Edit', description: 'Creates a transform group: a null parent for the input objects',
    args: [{ name: 'Name', default: 'transfogroup' }, { name: 'InputObjs', default: null }],
    execute(app, a) {
      const list = objs(app, a.InputObjs).filter(o => o !== app.scene.root);
      if (!list.length) throw new Error('CreateTransformGroup: select the object(s) to group');
      const top = list.filter(o => !list.some(p => p !== o && isDescendant(o, p)));
      const g = new Null(app.scene.uniqueName(String(a.Name || 'transfogroup'))); (g as any).transformGroup = true;
      attach(app, g, app.scene.root, 'Create');
      for (const o of top) reparent(app, o, g, true);
      app.select([g]);
      return g;
    },
  });
  // inferred: children go back to the group's parent (global pose kept), the group null is deleted
  reg(app, {
    name: 'RemoveTransformGroup', label: 'Remove Transform Group', category: 'Edit', description: 'Removes the transform group of the input objects',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const groups: X3DObject[] = [];
      for (const o of objs(app, a.InputObjs)) { const g = (o as any).transformGroup ? o : (o.parentObj as any)?.transformGroup ? o.parentObj! : null; if (g && !groups.includes(g)) groups.push(g); }
      if (!groups.length) throw new Error('RemoveTransformGroup: no transform group in the input');
      const freed: X3DObject[] = [];
      for (const g of groups) {
        const up = g.parentObj ?? app.scene.root;
        for (const c of [...g.children]) { reparent(app, c, up, true); freed.push(c); }
        const idx = up.children.indexOf(g);
        app.record('Remove ' + g.name, () => { up.removeChild(g); }, () => { up.addChild(g); up.children.splice(up.children.indexOf(g), 1); up.children.splice(idx, 0, g); });
      }
      app.select(freed);
    },
  });
}
