// Ledger row CMD-12a. Brief: docs/ghidra/cmd-12a-texture-projection-scripts.md, "Wire contract". Original code written from that contract only.
//
// 12 script commands that create, connect, fit and show texture projections (UV properties) and their texture
// supports. The model half and the stand-ins for the C++ texture tasks (call shapes attested, behaviour open: Q4) are
// in src/core/textureProjectionScripts.ts.
//
// Conventions / known gaps (each is also logged or commented where it bites):
//  - In/out and output arguments are handed back as a plain object keyed by argument name (the output-argument list
//    of a scripting caller); commands without any output argument return nothing.
//  - The texture tasks are stand-ins built on this build's projection model; where a stand-in cannot do something
//    sensible it writes a "not yet attested" line to the log.
//  - The contour stretching operator is created, connected and parameterised, but its UV solve belongs to the
//    operator's own row: the UVs are left as they are and the log says so.
//  - The name is registered once (function entry: returns the operators). The interactive entry (corner picking,
//    auto-inspect) is Application.textureProjection.interactiveContourStretching(args).
//  - `projdef` values are stored on the UV property; this build's UV evaluation does not read them yet.
import { App, CommandDef, InteractiveTool } from '../core/commands';
import { Node, X3DObject, Cluster, Property, Operator, construction } from '../core/scene';
import { floatingWindows } from '../ui/floating';
import * as TP from '../core/textureProjectionScripts';
import type { Item, SubComponent } from '../core/textureProjectionScripts';

const CATEGORY = 'Texturing|Rendering';
const truthy = (v: any) => v === true || v === 1 || v === -1 || (typeof v === 'string' && /^(true|1|-1)$/i.test(v.trim()));
const text = (v: any) => (v === undefined || v === null ? '' : typeof v === 'string' ? v : v instanceof Node ? v.name : String(v));

type CompItem = Cluster | SubComponent;
const isComp = (it: any, kind: TP.CompTok): it is CompItem => TP.compKindOf(it) === kind;

/** Global scaling of an object per axis. */
function globalScale(o: X3DObject): [number, number, number] {
  const e = o.globalMatrix().elements;
  return [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])];
}

// ------------------------------------------------------------------ basic projection per object (shared helper)
function basicProjectionPerObject(app: App, command: string, items: Item[], supportName: string, proposed: string, parenting: boolean, type: number, plane: number, fitting: number): string {
  const owners: X3DObject[] = []; for (const it of items) { const o = TP.ownerOf(it); if (o && !owners.includes(o)) owners.push(o); }
  const unique = TP.findUniqueTextureName(owners, proposed);
  for (const it of items) {
    // parent of the new support: the item itself; a polygon cluster stands for its owning 3D object
    let parent: X3DObject | null = null;
    if (parenting) parent = it instanceof X3DObject ? it : TP.ownerOf(it); // inferred: other non-object items also use their owning object
    TP.createTextureBasicGeo(app, { command, input: [it], supportName, propertyName: unique, parent, type, plane, visible: true, existing: null, fitting });
  }
  return unique;
}

// ------------------------------------------------------------------ FitSubcomponentUVsToImage
function fitSubcomponentUVsToImage(app: App, props: Property[], subComp: Item[], explicit: boolean, maintainAspect: boolean) {
  for (const p of props) {
    const o = TP.ownerOf(p); const m = TP.meshOf(o); if (!o || !m) continue;
    const cl = p.parent instanceof Cluster ? p.parent : null;
    const inCluster = (s: number) => !cl || !!cl.val('alwayscomplete') || cl.elements.has(s); // sample index -> UV row goes through the sample cluster
    const samples = new Set<number>();
    for (const it of subComp) {
      const kind = TP.compKindOf(it);
      const invalid = kind === null || (kind !== 'sample' && TP.ownerOf(it) !== o);
      if (invalid) {
        app.logMsg('info', `BindProp: '${TP.itemText(it)}' is an invalid argument: expecting subcomponents of '${o.fullName}'`);
        const e: any = new Error(`'${TP.itemText(it)}' is not a sub-component of '${o.fullName}' (siErrCancelled)`); e.number = TP.siErrCancelled; throw e;
      }
      for (const s of TP.samplesOfItem(it as CompItem, m)) if (inCluster(s)) samples.add(s);
    }
    const uv = TP.propertyUVs(o, p); if (!uv) continue;
    const b = TP.uvBounds(uv, samples); if (!b.count) continue; // no sample found: the property is skipped
    let du = b.umax - b.umin, dv = b.vmax - b.vmin; if (du === 0) du = 1; if (dv === 0) dv = 1;
    if (maintainAspect) du = dv = Math.max(du, dv);
    if (explicit) {
      const su = 1 / du, sv = 1 / dv; const list = [...samples];
      // the U offset divides by sv, as the contract records it
      const U = -b.umin + ((1 - (b.umax - b.umin) * su) / 2) / sv, V = -b.vmin + ((1 - (b.vmax - b.vmin) * sv) / 2) / sv;
      TP.translateUVs(app, p, list, U, V);
      TP.scaleUVs(app, p, list, su, sv, [0, 0]);
    } else {
      const d = TP.projDefOf(p); const set = (n: string, v: number) => { const prm = d.get(n); if (prm) app.setParam(prm, v, 'SetValue'); };
      set('projtrsu', b.umin); set('projtrsv', b.vmin);
      if (b.umax !== b.umin) set('projsclu', du);
      if (b.vmax !== b.vmin) set('projsclv', dv);
      set('projrotu', 0); set('projrotv', 0);
    }
  }
}

// ------------------------------------------------------------------ ModifyUVSetByContourStretching
/** A cluster for a sub-component item (the "cluster from sub-components" helper of the note). */
function clusterFromSubComponent(app: App, it: CompItem): Cluster {
  if (it instanceof Cluster) return it;
  const o = it.obj; // polygon and point items only (edges are filtered out before)
  const c = new Cluster(TP.uniqueClusterName(o, 'ContourStretch'), it.compKind, new Set<number | string>(it.elements)); (c as any).mode = 2;
  app.record('Create Cluster', () => o.addCluster(c), () => o.removeCluster(c));
  return c;
}
function contourStretching(app: App, command: string, a: Record<string, any>, onTop: boolean): Operator[] | null {
  const all = TP.resolveItems(app, a.InputObjs);
  const polys = all.filter((it): it is CompItem => isComp(it, 'poly'));
  if (polys.length < all.length) { app.logMsg('error', 'Some of the input objects are invalid.  Need mesh component selections.'); return null; }
  const prop = TP.resolveUVProperty(app, a.TextureProjection);
  if (!prop) { app.logMsg('error', 'Invalid UV texture coordinate'); return null; }
  const corners = TP.resolveItems(app, a.CornerPoints, false).filter((it): it is CompItem => isComp(it, 'pnt'));
  const mode = construction.mode; const switched = mode !== 'modeling';
  if (switched) app.run('SetConstructionMode', { Mode: 'modeling' });
  const ops: Operator[] = [];
  try {
    const preset = onTop ? 'PolyUVContourStretchingOnTopOp' : 'PolyUVContourStretchingOp';
    polys.forEach((item, i) => {
      try { // errors inside the loop are suppressed and the loop continues
        const polyCluster = clusterFromSubComponent(app, item);
        const cornerCluster = corners[i] ? clusterFromSubComponent(app, corners[i]) : null;
        const op = TP.makeContourStretchingOp(preset);
        // three port groups, in order: polygon cluster; the UV property; the corner cluster (empty when there are no corners)
        (op as any).ports = [[polyCluster], [prop], cornerCluster ? [cornerCluster] : []];
        const P = prop as any; const before: Operator[] = TP.uvOperatorsOf(prop);
        app.record('Apply Operator', () => { P.operators = [...before, op]; op.parent = prop; }, () => { P.operators = before; op.parent = null; });
        op.set('method', Number(a.ContourStretchingMethod) || 0);
        op.set('maintainaspect', truthy(a.MaintainAspect));
        ops.push(op);
      } catch { /* suppressed */ }
    });
  } finally { if (switched) app.run('SetConstructionMode', { Mode: mode }); }
  if (ops.length) TP.notAttested(app, command, `the UV solve of ${ops[0].name}; the operator is connected and its parameters are set, the UVs are unchanged`, 'Q3');
  return ops;
}

/** Corner picking session of the interactive entry; calls `done` with one point item (or undefined) per polygon item. */
function pickCorners(app: App, polys: CompItem[], given: (CompItem | undefined)[], done: (corners: (CompItem | undefined)[]) => void) {
  const savedSel = [...app.selection], savedComp = app.compSel, savedMode = app.selMode;
  const result = [...given]; let cancelledAll = false;
  const finishAll = () => {
    app.setTool(null);
    app.selMode = savedMode; app.compSel = savedComp; app.select(savedSel); // the original selection is restored
    if (app.commands.has('SetSelFilter')) { try { app.run('SetSelFilter', { SelFilter: 'Object' }); } catch { /* filter stays */ } }
    done(result);
  };
  const next = (i: number) => {
    while (i < polys.length && (result[i] || cancelledAll)) i++;
    if (i >= polys.length) { finishAll(); return; }
    const item = polys[i]; const o = TP.ownerOf(item)!;
    app.select([]); app.selectComponents(o, 'polygon', TP.elementsOf(item), 'replace'); (app as any).selFilter = 'Polygon';
    const picked = new Set<number>(); let picks = 0, ended = false;
    const end = () => {
      if (ended) return; ended = true;
      if (picks === 0) cancelledAll = true; // the very first pick of an item was cancelled: picking stops for the remaining items
      else if (picked.size) result[i] = TP.subComponent(o, 'pnt', [...picked]);
      queueMicrotask(() => next(i + 1));
    };
    const tool: InteractiveTool = {
      name: 'Pick Corner Point', prompt: 'Pick Corner Point (left)  /  Unpick Corner Point (middle; Ctrl+click here)', pickKind: 'point',
      onClick(_p, pick, e) {
        if (!pick || pick.obj !== o || pick.kind !== 'point') return;
        picks++; const v = Number(pick.item);
        if (e.ctrl) picked.delete(v); else picked.add(v); // inferred: Ctrl+click stands in for the middle button of the pick session
      },
      onFinish: end, onCancel: end,
      preview: () => [],
    };
    app.setTool(tool);
  };
  next(0);
}

// ------------------------------------------------------------------ SetCheckerboardMode: views
export interface ViewRef { classId: number; kind: 'view'; type: string; name: string; el: HTMLElement | null; attributes: Record<string, string>; views: ViewRef[]; }
const viewOfEl = new WeakMap<HTMLElement, ViewRef>();
function viewFor(el: HTMLElement, type: string, name: string): ViewRef {
  let v = viewOfEl.get(el);
  if (!v) { v = { classId: TP.siViewID, kind: 'view', type, name, el, attributes: {}, views: [] }; viewOfEl.set(el, v); }
  v.type = type; v.name = name;
  v.views = Array.from(el.querySelectorAll<HTMLElement>('.frame[data-view]')).filter(f => f !== el && f.parentElement?.closest('.frame[data-view]') === (el.matches('.frame[data-view]') ? el : null)).map(f => viewFor(f, f.dataset.view ?? '', f.dataset.name ?? f.dataset.view ?? ''));
  return v;
}
/** Views of the active layout: floating windows and docked frames, each with its sub-views. */
function activeLayoutViews(): ViewRef[] {
  if (typeof document === 'undefined') return [];
  const out: ViewRef[] = [];
  for (const w of floatingWindows()) out.push(viewFor(w.el, w.title, String(w.data?.key ?? w.title)));
  for (const f of Array.from(document.querySelectorAll<HTMLElement>('.frame[data-view]'))) if (!f.closest('.ppg-float') && !f.parentElement?.closest('.frame[data-view]')) out.push(viewFor(f, f.dataset.view ?? '', f.dataset.name ?? f.dataset.view ?? ''));
  return out;
}
function setViewAttribute(v: ViewRef, name: string, value: string) {
  v.attributes[name] = value;
  if (v.el) v.el.dataset[name] = value;
}

// ------------------------------------------------------------------ registration
export function registerTextureProjectionScriptCommands(app: App) {
  const reg = (def: CommandDef) => app.register({ category: CATEGORY, ...def });

  reg({
    name: 'CreateTextureProj', label: 'Create Texture Projection',
    description: 'Gives each input a planar XY texture projection with its own texture support.',
    args: [{ name: 'InputObjs' }, { name: 'ProjectionName', default: 'Texture_Projection' }, { name: 'Parenting', default: true }, { name: 'ProjectionType', default: ':siProjPlanar:siTxtProjType' }, { name: 'ProjectionPlane', default: ':siPlaneXY:siTxtProjPlane' }],
    execute(app, a) {
      const items = TP.resolveItems(app, a.InputObjs);
      const proposed = text(a.ProjectionName);
      // ProjectionType and ProjectionPlane are accepted but ignored: the result is always planar XY
      const used = basicProjectionPerObject(app, 'CreateTextureProj', items, proposed, proposed, truthy(a.Parenting), TP.siProjPlanar, TP.siPlaneXY, TP.siRelDefault);
      return { ProjectionName: used };
    },
  });

  reg({
    name: 'CreateSubprojection', label: 'Create Texture Subprojection',
    description: 'Adds a sub-projection for a set of components to an existing UV property.',
    args: [{ name: 'InputObjs' }, { name: 'TextureProjection' }, { name: 'Type', default: ':siProjPlanar:siTxtProjType' }, { name: 'Plane', default: ':siPlaneXY:siTxtProjPlane' }, { name: 'SupportName', default: '' },
      { name: 'Parenting', default: true }, { name: 'Fitting', default: ':siRelBestFit:siTxtProjFitMethod' }, { name: 'FitToImage', default: false }, { name: 'MaintainAspect', default: false }, { name: 'TextureAspectRatio', default: 1 }, { name: '3DObjTexture' }],
    execute(app, a) {
      const items = TP.resolveItems(app, a.InputObjs).filter(it => !TP.isUVProperty(it)); // a selected UV property is the projection, not something to project
      if (!items.length) { app.logMsg('error', 'Please select items to project'); return { '3DObjTexture': null }; }
      const prop = TP.resolveUVProperty(app, a.TextureProjection);
      if (!prop) { app.logMsg('error', 'Please select a UV property to create the subprojection on'); return { '3DObjTexture': null }; }
      const type = TP.enumValue(a.Type, TP.siProjPlanar), plane = TP.enumValue(a.Plane, TP.siPlaneXY), fitting = TP.enumValue(a.Fitting, TP.siRelBestFit);
      if (![TP.siProjPlanar, TP.siProjCylindrical, TP.siProjSpherical, TP.siProjLollipop, TP.siProjCubic].includes(type)) { app.logMsg('error', `Subprojection type ${type} not supported.`); return { '3DObjTexture': null }; }
      // 1. parent of the support: the first input item, else the scene root
      const parent = truthy(a.Parenting) ? (TP.ownerOf(items[0]) ?? app.scene.root) : app.scene.root; // inferred: a component item stands for its object
      // 2. one support for the whole input, projected into the existing property
      const { support } = TP.createTextureBasicGeo(app, { command: 'CreateSubprojection', input: items, supportName: text(a.SupportName), propertyName: '', parent, type, plane, visible: true, existing: prop, fitting });
      const o = TP.ownerOf(prop); const m = TP.meshOf(o);
      const samples = () => { const s = new Set<number>(); if (o && m) for (const it of items) if (TP.ownerOf(it) === o && (it instanceof X3DObject || it instanceof Cluster || TP.isSubComponent(it))) for (const x of TP.samplesOfItem(it, m)) s.add(x); return [...s]; };
      // 3. aspect correction
      if (truthy(a.MaintainAspect) && support) {
        const gs = globalScale(support); const geo = (ax: string, i: number) => Number(support.primitive?.val(ax) ?? support.primitive?.val('size') ?? 1) * gs[i];
        let gx = geo('GeoX', 0), gy = geo('GeoY', 1), gz = geo('GeoZ', 2); const A = Number(a.TextureAspectRatio);
        const normalise = (su: number, sv: number): [number, number] => sv > su ? [su / sv, 1] : [1, sv / su];
        if (type === TP.siProjCylindrical) {
          const h = plane === TP.siPlaneXZ ? gz : gy;
          const [su, sv] = normalise(h > 1e-5 ? (3.1415926 * gx) / h : 1, A);
          if (su !== 1 || sv !== 1) TP.scaleUVs(app, prop, samples(), su, sv, null);
        } else if (type === TP.siProjSpherical) {
          const [su, sv] = normalise(1, 0.5 * A);
          TP.scaleUVs(app, prop, samples(), su, sv, null);
        } else if (type === TP.siProjPlanar || type === TP.siProjCubic) {
          if (plane === TP.siPlaneXZ) gz *= A; else gy *= A;
          const mx = Math.max(gx, gy, gz); const f = (g: number) => (g > 0 ? mx / g : 1); // inferred: a zero extent is left alone
          app.run('Scale', { InputObj: [support], X: f(gx), Y: f(gy), Z: f(gz) });
        } // lollipop: nothing
      }
      // 4. fit to image
      if (truthy(a.FitToImage)) app.run('FitSubcomponentUVsToImage', { Properties: [prop], SubComp: items, Explicit: true, MaintainAspect: truthy(a.MaintainAspect) });
      return { '3DObjTexture': support };
    },
  });

  reg({
    name: 'CameraTextureProj', label: 'Create Camera Projection',
    description: 'Projects the texture from a camera and makes the projection swim.',
    args: [{ name: 'InputObjs' }, { name: 'Name', default: 'Texture_Projection' }, { name: 'Camera', default: '' }],
    execute(app, a) {
      const items = TP.resolveItems(app, a.InputObjs);
      const out: Record<string, any> = { Name: a.Name, Camera: a.Camera };
      const r = TP.cameraTextureProj(app, 'CameraTextureProj', items, text(a.Name), a.Camera);
      if (!r) return out;
      out.Camera = r.camera; out.Name = r.PropertyName;
      // swim: for every input that is a 3D object, the first property of that name on each of its sample clusters
      for (const it of items) {
        if (!(it instanceof X3DObject)) continue;
        for (const c of it.clusters) {
          if (c.compKind !== 'sample') continue;
          const p: any = c.properties.find(x => x.name === r.PropertyName); if (!p) continue;
          const old = p.uvInputAction;
          app.record('Swim UV', () => { p.uvInputAction = 0; p.swim = true; }, () => { p.uvInputAction = old; p.swim = old === 0; }); // siChangeUVInputActionSwim = 0; inferred: recorded on the property (this build has no UV operator stack)
        }
      }
      return out;
    },
  });

  reg({
    name: 'ConnectToTextureProj', label: 'Connect to Texture Support',
    description: 'Creates a projection on the inputs that reuses an existing texture support.',
    args: [{ name: 'InputObjs' }, { name: 'Name', default: '' }, { name: 'TextureSupport', default: '' }],
    execute(app, a) {
      const all = TP.resolveItems(app, a.InputObjs); const sup = TP.resolveObject(app, a.TextureSupport);
      const r = TP.connectToSupport(app, 'ConnectToTextureProj', all.filter(it => it !== sup), text(a.Name), a.TextureSupport);
      return r ? { Name: r.PropertyName, TextureSupport: r.support } : { Name: a.Name, TextureSupport: a.TextureSupport };
    },
  });

  reg({
    name: 'CreateTextureSpatial', label: 'Geometry to Texture', category: '',
    description: 'Spatial texture coordinates taken from the object\'s own geometry.',
    args: [{ name: 'InputObjs' }, { name: 'Name', default: '' }],
    execute(app, a) {
      const r = TP.createTextureSpatialTask(app, TP.resolveItems(app, a.InputObjs), text(a.Name));
      return { Name: r ? r.PropertyName : a.Name }; // the created object reported by the task is discarded
    },
  });

  reg({
    name: 'CreateTextureUVDomain', label: 'Create Texture UVDomain',
    description: 'NURBS UV-domain texture support for surfaces.',
    args: [{ name: 'InputObjs' }, { name: 'SupportName', default: '' }, { name: 'PropertyName', default: '' }],
    execute(app, a) {
      const supportName = text(a.SupportName); let propertyName = text(a.PropertyName);
      if (!propertyName && supportName) propertyName = supportName;
      TP.createTextureUVDomainTask(app, 'CreateTextureUVDomain', 'NurbsTextureCtrl', TP.resolveItems(app, a.InputObjs), supportName, propertyName, true);
      return { SupportName: supportName, PropertyName: propertyName }; // the names are not read back from the task
    },
  });

  reg({
    name: 'FitSubcomponentUVsToImage', label: 'Fit Subcomponent UVs To Image',
    description: 'Makes the UVs of the given components fill the 0..1 image square.',
    args: [{ name: 'Properties' }, { name: 'SubComp' }, { name: 'Explicit', default: false }, { name: 'MaintainAspect', default: false }],
    execute(app, a) {
      const props = TP.resolveItems(app, a.Properties).filter(TP.isUVProperty);
      const sub = TP.resolveItems(app, a.SubComp).filter(it => !TP.isUVProperty(it) || a.SubComp); // from the selection, the UV properties are the Properties argument
      fitSubcomponentUVsToImage(app, props, sub, truthy(a.Explicit), truthy(a.MaintainAspect));
    },
  });

  reg({
    name: 'ModifyUVSetByContourStretching', label: 'Modify by Contour Stretching UVW',
    description: 'Re-lays existing UVs of polygon regions by contour stretching between corner points.',
    args: [{ name: 'InputObjs' }, { name: 'TextureProjection' }, { name: 'ContourStretchingMethod', default: 0 }, { name: 'MaintainAspect', default: false }, { name: 'CornerPoints' }],
    // inferred: the bus holds one definition per name; this is the function entry (returns the operators, no picking, no inspection)
    execute: (app, a) => contourStretching(app, 'ModifyUVSetByContourStretching', a, false), // inferred (Q2): the unregistered "on top" value is empty, so the normal preset
  });

  for (const [name, label, type] of [['HideTextureUVDomains', 'Hide Texture Supports', 0], ['UnhideTextureUVDomains', 'Show Texture Supports', 1], ['ToggleVisibilityOfTextureUVDomains', 'Hide/Unhide Texture Supports', -1]] as const) {
    reg({
      name, label, description: 'Sets or toggles the view visibility of the texture supports used by the input.',
      args: [{ name: 'InputObjs' }, { name: 'Type', default: type }],
      execute(app, a) {
        const t = Number(a.Type); // the value, not the command name, decides
        for (const sup of TP.getTextureUVDomains(TP.resolveItems(app, a.InputObjs))) {
          const p = sup.property('visibility')?.get('viewvis'); if (!p) continue;
          app.setParam(p, t === -1 ? !p.value : t !== 0, 'SetValue'); // inferred: toggled directly (this build's ToggleValue is a view-toggle stand-in); render visibility untouched
        }
      },
    });
  }

  reg({
    name: 'SetCheckerboardMode', label: 'Set Checkerboard Mode', category: 'Texturing', undoable: false,
    description: 'Switches the checkerboard background of Texture Editor views.',
    args: [{ name: 'Checkerboard', default: false }, { name: 'TextureEditor' }],
    execute(app, a) {
      const value = a.Checkerboard === true ? 'True' : 'False';
      const te = a.TextureEditor;
      if (te === undefined || te === null || te === '') {
        const visit = (views: ViewRef[]) => { for (const v of views) { if (v.type === 'Texture Editor') setViewAttribute(v, 'checkerboard', value); if (v.views.length) visit(v.views); } };
        visit(activeLayoutViews());
      } else if (typeof te === 'object' && te.classId === TP.siViewID && te.type === 'Texture Editor' && te.attributes) setViewAttribute(te as ViewRef, 'checkerboard', value);
      // anything else is ignored silently
      app.events.emit('frame');
    },
  });

  // ---- scripting-side helpers (the interactive entry, the view list, the model functions for the check script)
  (app as any).textureProjection = {
    ...TP,
    views: activeLayoutViews,
    /** "Interactive Modify by Contour Stretching UVW": corner picking for polygon items without corners, then the
     *  operators, then auto-inspect. `onDone` receives { CornerPoints, operators } when the session is over. */
    interactiveContourStretching(args: Record<string, any> = {}, onDone?: (r: { CornerPoints: Item[]; operators: Operator[] }) => void) {
      const all = TP.resolveItems(app, args.InputObjs);
      const polys = all.filter((it): it is CompItem => isComp(it, 'poly'));
      const finish = (corners: Item[]) => {
        const ops = (app.run('ModifyUVSetByContourStretching', { ...args, InputObjs: all.length ? all : undefined, CornerPoints: corners.length ? corners : undefined }) ?? []) as Operator[];
        if (ops.length) for (const op of ops) app.events.emit('inspect', op); // AutoInspect of the operators created
        onDone?.({ CornerPoints: corners, operators: ops });
      };
      const given = TP.resolveItems(app, args.CornerPoints, false).filter((it): it is CompItem => isComp(it, 'pnt'));
      // invalid input or an invalid UV property: the checks of the shared steps report it, no picking
      if (polys.length < all.length || !TP.resolveUVProperty(app, args.TextureProjection)) { finish(given); return; }
      const prop = TP.resolveUVProperty(app, args.TextureProjection);
      const withProp = { ...args, TextureProjection: prop };
      pickCorners(app, polys, polys.map((_, i) => given[i]), (corners) => {
        // items without corners keep an empty slot so that the pairing by index survives
        const ops: Operator[] = [];
        polys.forEach((item, i) => {
          const r = app.run('ModifyUVSetByContourStretching', { ...withProp, InputObjs: [item], CornerPoints: corners[i] ? [corners[i]] : undefined }) as Operator[] | null;
          if (r) ops.push(...r);
        });
        for (const op of ops) app.events.emit('inspect', op);
        onDone?.({ CornerPoints: corners.filter((c): c is CompItem => !!c), operators: ops });
      });
    },
  };
}
