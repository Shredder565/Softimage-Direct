// INFERRED batch, second half: Softimage commands of the registry categories Property, Constraint, Transport Control and
// General that were missing from the command bus. Same sourcing rules as viewEditProperty.ts: registry entries of
// data/commands_full.json for names / arguments / defaults, reasoned behaviour from the registry descriptions, the
// documented scripting conventions and the related commands on the bus (AddProp, AssignMaterial, UnAssignMaterial,
// MakeLocalMaterialsForHierarchy, ApplyCns, RemoveCns, SelectObjectsConstrained, the Play… commands, SetUserPref).
// Every register call is marked `// inferred`.
import { makeOwnMaterialCopy } from './chainsModelB17b';
import { App, UndoEntry } from '../core/commands';
import { X3DObject, Node, Property, Material, Constraint, makeSiShader } from '../core/scene';
import { addConstraint, CNS_PRESETS } from './constraints';
import { tasksB16c, NO_NAME_OPERATION } from './tasksB16c';
import {
  reg, nya, logNya, unset, siConst, boolArg, objs, nodes, findNode, findObject, findMaterial,
  materialOf, copyProperty, ensureLocal, removeProp,
} from './viewEditPropertyHelpers';

export function registerViewEditPropertyMore(app: App) {
  registerProperty(app);
  registerConstraint(app);
  registerTransport(app);
  registerGeneral(app);
}

// ===================================================================================================== Property
function registerProperty(app: App) {
  /** "siBranch" propagation = the objects and everything below them. */
  const withBranch = (list: X3DObject[], flag: any): X3DObject[] => {
    const f = siConst(flag);
    if (f === 'siBranch' || f === 'siBranchPropagation') { const out: X3DObject[] = []; for (const o of list) for (const x of [o, ...o.descendants()]) if (!out.includes(x)) out.push(x); return out; }
    return list;
  };

  // inferred: AddProp without the selection / inspection side effects; PropertyName renames, the new properties are returned
  reg(app, {
    name: 'SIAddProp', label: 'Add Property', category: 'Property', description: 'Add a property to object',
    args: [{ name: 'PresetObj', default: null }, { name: 'InputObjs', default: null }, { name: 'PropagationType', default: ':siDefaultPropagation:siPropagationType' }, { name: 'PropertyName', default: '' }, { name: 'Value', default: null }],
    execute(app, a) {
      if (unset(a.PresetObj)) throw new Error('SIAddProp: no property preset given');
      const list = withBranch(objs(app, a.InputObjs), a.PropagationType); if (!list.length) throw new Error('SIAddProp: no object given');
      const before = new Map(list.map(o => [o, new Set(o.allProperties())] as const));
      const sel = [...app.selection];
      app.run('AddProp', { PresetObj: String(a.PresetObj).replace(/\.Preset$/i, ''), InputObjs: list });
      app.select(sel);
      const made: Property[] = []; for (const o of list) for (const p of o.allProperties()) if (!before.get(o)!.has(p)) made.push(p);
      if (!unset(a.PropertyName)) for (const p of made) { const old = p.name, nn = String(a.PropertyName); app.record('Rename', () => { p.name = nn; }, () => { p.name = old; }); }
      return made;
    },
  });
  // inferred: puts a copy of an existing property on the object (the model has no multi-owner properties)
  reg(app, {
    name: 'SIAddPropEx', label: 'Add Property Ex', category: 'Property', description: 'Add property to object',
    args: [{ name: 'InputObj', default: null }, { name: 'Property', default: null }, { name: 'PropagationType', default: ':siDefaultPropagation:siPropagationType' }],
    execute(app, a) {
      const src = unset(a.Property) ? undefined : findNode(app, a.Property);
      if (!(src instanceof Property) || src instanceof Constraint) throw new Error('SIAddPropEx: no property given');
      const list = withBranch(objs(app, a.InputObj), a.PropagationType); if (!list.length) throw new Error('SIAddPropEx: no object given');
      const made: Property[] = [];
      for (const o of list) { if (o === src.parent) continue; const p = copyProperty(src); p.shared = false; app.record('Add property', () => { o.addProperty(p); }, () => { o.removeProperty(p); }); made.push(p); }
      return made;
    },
  });

  /** Properties a remove command may take off an object: not Visibility (every object has one), not constraints. */
  const removable = (o: X3DObject) => o.properties.filter(p => p.type !== 'visibility' && !(p instanceof Constraint));
  // inferred
  reg(app, {
    name: 'RemoveProperties', label: 'Remove Properties', category: 'Property', description: 'Removes the properties of a type from the input objects',
    args: [{ name: 'InputObjs', default: null }, { name: 'Type', default: '' }, { name: 'BranchFlag', default: ':siUnspecified:siBranchFlag' }],
    execute(app, a) {
      if (unset(a.Type)) { logNya(app, 'RemoveProperties', 'an empty Type; nothing is removed'); return 0; }
      const t = String(a.Type).toLowerCase(); let n = 0;
      for (const o of withBranch(objs(app, a.InputObjs), a.BranchFlag)) for (const p of removable(o)) if (p.type.toLowerCase() === t || p.name.toLowerCase() === t) { removeProp(app, o, p); n++; }
      return n;
    },
  });
  // inferred
  reg(app, {
    name: 'RemoveAllProperties', label: 'Remove All Properties', category: 'Property', description: 'Removes every local property from the input objects',
    args: [{ name: 'InputObjs', default: null }, { name: 'BranchFlag', default: ':siUnspecified:siBranchFlag' }],
    execute(app, a) { let n = 0; for (const o of withBranch(objs(app, a.InputObjs), a.BranchFlag)) for (const p of removable(o)) { removeProp(app, o, p); n++; } return n; },
  });

  // ---- materials
  const assign = (o: X3DObject, m: Material | null, label: string) => { const old = o.material; if (old === m) return; app.record(label, () => { o.setMaterial(m); }, () => { o.setMaterial(old); }); };
  // inferred: low-level AssignMaterial — the material is explicit, nothing is selected
  reg(app, {
    name: 'SIAssignMaterial', label: 'AssignMaterial', category: 'Property', description: 'Assigns a material to a list of objects',
    args: [{ name: 'Objects', default: null }, { name: 'Material', default: null }],
    execute(app, a) {
      const m = findMaterial(app, a.Material); if (!m) throw new Error(`SIAssignMaterial: no such material ${a.Material?.name ?? a.Material ?? ''}`.trim());
      for (const o of objs(app, a.Objects)) assign(o, m, 'Assign');
    },
  });
  // inferred
  reg(app, {
    name: 'SIUnAssignMaterial', label: 'UnAssignMaterial', category: 'Property', description: 'UnAssigns a material to a list of objects',
    args: [{ name: 'Objects', default: null }],
    execute(app, a) { for (const o of objs(app, a.Objects)) if (o !== app.scene.root) assign(o, null, 'Unassign'); },
  });
  // SICreateMaterial: replaced by the CMD-B15b contract (propertyTasksB15b.ts)

  // ---- make local
  const makeLocal = (cmd: string, a: Record<string, any>): Node[] => {
    const out: Node[] = [];
    const localProp = (p: Property) => { if (p.shared) app.record('Make local', () => { p.shared = false; }, () => { p.shared = true; }); out.push(p); };
    const inherited = (o: X3DObject, key: string): Node | null => {
      const k = key.toLowerCase();
      if (k === 'material') { if (!o.material) makeOwnMaterialCopy(app, o); return o.material; }   // the app's own-copy helper (MakeLocalMaterialsForHierarchy is the CMD-B17b contract)
      const type = k === 'display' ? 'display' : (k === 'geomapprox' || k === 'geometry approximation') ? 'geomapprox' : null;
      return type ? ensureLocal(app, o, type) : null;
    };
    const items = unset(a.InputObjs) ? [...app.selection] : (Array.isArray(a.InputObjs) ? a.InputObjs : String(a.InputObjs).split(',').map((s: string) => s.trim()).filter(Boolean));
    for (const x of items) {
      const n = x instanceof Node ? x : findNode(app, x);
      if (n instanceof X3DObject) { for (const p of n.properties) if (p.shared) localProp(p); continue; }
      if (n instanceof Material) {
        // "obj.material" on an object that only inherits it: give the object its own copy
        const owner = typeof x === 'string' && /\.material$/i.test(x) ? findObject(app, x.replace(/\.material$/i, '')) : undefined;
        if (owner && !owner.material) { const m = inherited(owner, 'material'); if (m) out.push(m); } else out.push(n);
        continue;
      }
      if (n instanceof Property && n.parent instanceof X3DObject) { localProp(n); continue; }
      if (!n && typeof x === 'string' && x.includes('.')) {
        const i = x.lastIndexOf('.'); const o = findObject(app, x.slice(0, i)); const made = o ? inherited(o, x.slice(i + 1)) : null;
        if (made) { out.push(made); continue; }
      }
      throw new Error(`${cmd}: ${typeof x === 'string' ? x : (x as any)?.name} is not a shared property`);
    }
    return out;
  };
  // inferred: low-level — the local properties are returned, the selection is untouched
  reg(app, {
    name: 'SIMakeLocal', label: 'Low Level Make Local', category: 'Property', description: 'Make a local copy of shared objects',
    args: [{ name: 'InputObjs', default: null }, { name: 'PropagationType', default: ':siDefaultPropagation:siPropagationType' }],
    execute(_app, a) { return makeLocal('SIMakeLocal', a); },
  });
  // inferred: SIMakeLocal, then the local properties are selected
  reg(app, {
    name: 'MakeLocal', label: 'Make Local', category: 'Property', description: 'Make local copy of shared objects',
    args: [{ name: 'InputObjs', default: null }, { name: 'PropagationType', default: ':siDefaultPropagation:siPropagationType' }],
    execute(app, a) { const out = makeLocal('MakeLocal', a); if (out.length) app.select(out); return out; },
  });

  // inferred: the materials the input objects render with (own or inherited)
  reg(app, {
    name: 'SelectMaterialsUsedBy', label: 'SelectMaterials', category: 'Property', description: 'Select all the materials used by the input object(s)', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) { const out: Material[] = []; for (const o of objs(app, a.InputObjs)) { const m = materialOf(app, o); if (m && !out.includes(m)) out.push(m); } app.select(out); return out; },
  });
  // inferred: the objects the input materials are assigned to (direct owners)
  reg(app, {
    name: 'SelectObjectsUsingMaterial', label: 'SelectObjectsUsingMaterial', category: 'Property', description: 'Select all the objects used by the input material(s)', undoable: false,
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      const mats = new Set<Material>();
      for (const n of nodes(app, a.InputObjs)) { if (n instanceof Material) mats.add(n); else if (n instanceof X3DObject) { const m = materialOf(app, n); if (m) mats.add(m); } }
      const out = [app.scene.root, ...app.scene.allObjects()].filter(o => !!o.material && mats.has(o.material));
      app.select(out); return out;
    },
  });

  // ---- subdivision level (Geometry Approximation)
  const subdivide = (a: Record<string, any>, step: number) => {
    const levels: number[] = [];
    for (const o of objs(app, a.InputObjs)) {
      if (!o.primitive) continue;
      const ga = ensureLocal(app, o, 'geomapprox'); const p = ga.get('gapproxmordrsl'); if (!p) continue;
      const next = Math.max(p.def.min ?? 0, Math.min(p.def.max ?? Infinity, Number(p.value) + step));
      app.setParam(p, next, 'Subdivision'); levels.push(next);
      // the OGL (view) level follows the render level, as the +/- keys change the level as a whole
      const view = ga.get('gapproxmosl'); if (view) app.setParam(view, Math.max(view.def.min ?? 0, Math.min(view.def.max ?? Infinity, next)), 'Subdivision');
    }
    return levels;
  };
  // inferred: returns the new level of each object
  reg(app, {
    name: 'IncreaseSubdivision', label: 'Change Subdivision Up', category: 'Property', description: 'Changes the subdivision level of the selected objects by one level up',
    args: [{ name: 'InputObjs', default: '.[obj].' }], execute: (_app, a) => subdivide(a, 1),
  });
  // inferred
  reg(app, {
    name: 'DecreaseSubdivision', label: 'Change Subdivision Down', category: 'Property', description: 'Changes the subdivision level of the selected objects by one level down',
    args: [{ name: 'InputObjs', default: '.[obj].' }], execute: (_app, a) => subdivide(a, -1),
  });

  // inferred
  reg(app, {
    name: 'AutoInspectEnabled', label: 'Auto Inspect Enabled', category: 'Property|Edit', description: 'Tells if auto-inspect is ON', undoable: false, args: [],
    execute: (app) => app.autoInspect,
  });
  // inferred: flips a boolean user preference and returns the new value (AutoInspect / AutoKey are the App flags SetUserPref writes)
  reg(app, {
    name: 'ToggleBooleanUserPref', label: 'MCP Setting: Toggle User Pref', category: 'Property', description: 'Toggles a boolean user preference', undoable: false,
    args: [{ name: 'UserPref', default: '' }],
    execute(app, a) {
      const k = String(a.UserPref ?? '').trim(); if (!k) throw new Error('ToggleBooleanUserPref: no preference name given');
      if (/^autoinspect$/i.test(k)) { app.autoInspect = !app.autoInspect; app.events.emit('selection'); return app.autoInspect; }
      if (/^autokey$/i.test(k)) { app.autoKey = !app.autoKey; app.events.emit('params'); return app.autoKey; }
      const bag: Record<string, any> = ((app as any).userPrefs ??= {});
      bag[k] = !boolArg(bag[k]); return bag[k];
    },
  });
  // InspectLastOperator: tasks.dll ee0d5df0, CMD-B19b (src/commands/tasksB19b.ts)
}

// =================================================================================================== Constraint
function registerConstraint(app: App) {
  const cnsOf = (o: X3DObject) => o.properties.filter((p): p is Constraint => p instanceof Constraint);
  const constrainedBy = (targets: Set<X3DObject>) => [...app.scene.allObjects()].filter(o => cnsOf(o).some(c => c.targets.some(t => targets.has(t))));

  // inferred
  reg(app, {
    name: 'RemoveAllCns', label: 'Remove All Constraints', category: 'Constraint', description: 'Removes every constraint from the input objects',
    args: [{ name: 'ConstrainedObj', default: null }, { name: 'Propagation', default: 3 }],
    execute(app, a) { let n = 0; for (const o of objs(app, a.ConstrainedObj)) for (const c of cnsOf(o)) { removeProp(app, o, c); n++; } return n; },
  });
  // inferred: Type is a constraint preset name ("Position"), a constraint name ("Position Cns") or a type ("poscns")
  reg(app, {
    name: 'RemoveCnsType', label: 'Remove Constraints By Type', category: 'Constraint', description: 'Removes the constraints of a type from the input objects',
    args: [{ name: 'Type', default: '' }, { name: 'ConstrainedObj', default: null }],
    execute(app, a) {
      if (unset(a.Type)) { logNya(app, 'RemoveCnsType', 'an empty Type; nothing is removed'); return 0; }
      const t = String(a.Type).replace(/\.Preset$/i, '').toLowerCase();
      const preset = Object.keys(CNS_PRESETS).find(k => k.toLowerCase() === t);
      const match = (c: Constraint) => preset ? c.name === CNS_PRESETS[preset].label : (c.type.toLowerCase() === t || c.name.toLowerCase() === t);
      let n = 0; for (const o of objs(app, a.ConstrainedObj)) for (const c of cnsOf(o)) if (match(c)) { removeProp(app, o, c); n++; }
      return n;
    },
  });
  // inferred: OutputObjs is the output argument; the list is the return value here
  reg(app, {
    name: 'GetConstrainedObjects', label: 'Get Constrained Objects from Constraining', category: 'Constraint', description: 'Returns the objects constrained to the input object', undoable: false,
    args: [{ name: 'InputObj', default: null }, { name: 'OutputObjs', default: null }],
    execute(app, a) { return constrainedBy(new Set(objs(app, a.InputObj))); },
  });
  // inferred
  reg(app, {
    name: 'SelectConstrainedObjects', label: 'Select Constrained Objects from Constraining', category: 'Constraint', description: 'Selects the objects constrained to the input object(s)', undoable: false,
    args: [{ name: 'ConstrainingObj', default: null }],
    execute(app, a) { const out = constrainedBy(new Set(objs(app, a.ConstrainingObj))); app.select(out); return out; },
  });

  const apply = (cmd: string, a: Record<string, any>): Constraint | Constraint[] => {
    if (unset(a.PresetObj)) throw new Error(`${cmd}: no constraint preset given`);
    const preset = String(a.PresetObj).replace(/\.Preset$/i, '');
    if (unset(a.ConstrainingObj)) throw nya(cmd, 'the pick session for the constraining object', 'what the command does when ConstrainingObj is not given');
    const constrained = objs(app, a.ConstrainedObj), targets = objs(app, a.ConstrainingObj);
    if (!constrained.length || !targets.length) throw new Error(`${cmd}: need constrained and constraining objects`);
    const out = constrained.map(o => addConstraint(app, o, preset, targets, boolArg(a.Compensation)));
    return out.length === 1 ? out[0] : out;
  };
  // inferred: ApplyCns without the selection change
  reg(app, {
    name: 'SIApplyCns', label: 'Interactive Apply Constraints', category: 'Constraint', description: 'Constrains the objects to the constraining objects',
    args: [{ name: 'PresetObj', default: null }, { name: 'ConstrainedObj', default: null }, { name: 'ConstrainingObj', default: null }, { name: 'Compensation', default: false }],
    execute: (_app, a) => apply('SIApplyCns', a),
  });
  // inferred
  reg(app, {
    name: 'SIApplyConstraint', label: 'Constrain objects', category: 'Constraint', description: 'Constrains the objects to the constraining objects',
    args: [
      { name: 'PresetObj', default: null }, { name: 'ConstrainedObj', default: null }, { name: 'ConstrainingObj', default: null }, { name: 'Compensation', default: false },
      { name: 'Offset1X', default: null }, { name: 'Offset1Y', default: null }, { name: 'Offset1Z', default: null }, { name: 'Offset2X', default: null }, { name: 'Offset2Y', default: null }, { name: 'Offset2Z', default: null },
    ],
    execute(app, a) {
      const out = apply('SIApplyConstraint', a);
      if (['Offset1X', 'Offset1Y', 'Offset1Z', 'Offset2X', 'Offset2Y', 'Offset2Z'].some(k => !unset(a[k]))) logNya(app, 'SIApplyConstraint', 'the Offset1 / Offset2 arguments (which constraint parameters they write); they are not applied');
      return out;
    },
  });
}

// ============================================================================================ Transport Control
function registerTransport(app: App) {
  const A = app.anim as any;
  // Backward playback started here wraps (or stops, in "once" mode) at the first frame of the play range.
  app.anim.onFrame((f) => {
    if (!A._vepBackward) return;
    if (!app.anim.playing || A.dir >= 0) { A._vepBackward = false; return; }
    if (f < app.anim.startFrame) { if (app.anim.loopMode === 'once') { app.anim.frame = app.anim.startFrame; app.anim.stop(); } else if (app.anim.loopMode === 'loop') app.anim.frame = app.anim.endFrame; }
  });
  const start = (dir: 1 | -1) => { app.anim.stop(); A.dir = dir; A._vepBackward = dir < 0; app.anim.play(); };
  const transport = (cmd: string, a: Record<string, any>, expect: number) => { if (Number(a.Transport) !== expect) logNya(app, cmd, `Transport=${a.Transport} (the registry default ${expect} is used)`); };

  // inferred
  reg(app, {
    name: 'PlayBackwardsFromEnd', label: 'Play Backwards From End', category: 'Transport Control', description: 'Play backwards frame by frame from end', undoable: false,
    args: [{ name: 'Transport', default: 11 }],
    execute(app, a) { transport('PlayBackwardsFromEnd', a, 11); app.anim.stop(); app.anim.frame = app.anim.endFrame; start(-1); },
  });
  // inferred: starts playing, or reverses the direction when already playing
  reg(app, {
    name: 'PlayFrame', label: 'Play/Reverse Play', category: 'Transport Control', description: 'Start playing animation or reverse direction of playing ', undoable: false,
    args: [{ name: 'Transport', default: 4 }],
    execute(app, a) { transport('PlayFrame', a, 4); if (app.anim.playing) start(A.dir < 0 ? 1 : -1); else start(1); },
  });
  // inferred
  reg(app, {
    name: 'PlayRealTime', label: 'Play in Real Time', category: 'Transport Control', description: 'Start playing in real time', undoable: false,
    args: [{ name: 'Transport', default: 5 }],
    execute(app, a) { transport('PlayRealTime', a, 5); app.anim.realtime = true; start(1); },
  });
  // inferred
  reg(app, {
    name: 'PlayRealTimeFromStart', label: 'Play in Real Time From Start', category: 'Transport Control', description: 'Start playing in real time from the start', undoable: false,
    args: [{ name: 'Transport', default: 9 }],
    execute(app, a) { transport('PlayRealTimeFromStart', a, 9); app.anim.stop(); app.anim.realtime = true; app.anim.frame = app.anim.startFrame; start(1); },
  });
}

// ====================================================================================================== General
function registerGeneral(app: App) {
  interface Group { name: string; top: UndoEntry | null; len: number }
  const open = (): Group[] => ((app as any)._vepUndoGroups ??= []);
  // CMD-B16c (tasks.dll, b5097d5a rows 6 / 7): BeginUndo opens a named group, EndUndo closes the innermost one. While
  // Undo / Redo steps run the undo manager refuses groups (state query non-zero; inferred) and both do nothing.
  // inferred: the commands run until the matching EndUndo become one entry of the undo stack; an empty group adds nothing.
  reg(app, {
    name: 'BeginUndo', label: 'begin undo', category: 'General', description: 'Starts an undo group', undoable: false,
    args: [{ name: 'Name', default: '' }],
    execute(app, a) {
      const name = a.Name === undefined || a.Name === null || String(a.Name) === '' ? NO_NAME_OPERATION : String(a.Name);
      if (tasksB16c(app).undoing) return;
      open().push({ name, top: app.undoStack[app.undoStack.length - 1] ?? null, len: app.undoStack.length });
    },
  });
  reg(app, {
    name: 'EndUndo', label: 'end undo', category: 'General', description: 'Ends the undo group started by BeginUndo', undoable: false, args: [],
    execute(app) {
      if (tasksB16c(app).undoing) return;
      const g = open().pop(); if (!g) return; // no group open: silent no-op
      if (open().length) return; // inferred: nested group, the outermost one collects everything
      const at = g.top ? app.undoStack.lastIndexOf(g.top) : -1;
      const from = at >= 0 ? at + 1 : Math.min(g.len, app.undoStack.length);
      const entries = app.undoStack.splice(from); if (!entries.length) return;
      app.undoStack.push({ label: g.name, undo: () => { for (const u of [...entries].reverse()) u.undo(); }, redo: () => { for (const u of entries) u.redo(); } });
      app.events.emit('undo');
    },
  });
}
