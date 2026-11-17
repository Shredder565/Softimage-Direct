// Ledger row CMD-B8d. Brief: docs/ghidra/cmd-b8d-primtasks-texture-binary.md, "Shared facts" and the "Wire contract"
// sections. Original code written from that prose contract only; no XSIBATCH golden exists for the row.
//
//   projection tasks  SIFindUniqueTextureName SICreateTexturePureImplicit SICreateTextureBasicGeo SICreateTextureProj
//                     SICreateTextureUVDomain SIConnectToSupport SIConnectToProjection SICameraTextureProj
//                     SICreateTextureSpatial SIGetTextureUVDomains ChangeUVInput
//   UVW editing       HealUVW MatchUVW CycleUVW FlipUVW RelaxUVW
//
// How the contract is mapped onto this build:
//  * The projection model is the one of row CMD-12a (src/core/textureProjectionScripts.ts): a `uvprojection` property
//    on the object's complete sample cluster, a `texturesupport` object, a `projdef` parameter set. The script
//    commands of CMD-12a (src/commands/textureProjectionScripts.ts) now call these commands instead of stand-ins.
//  * A projection definition is a `projdef` set named `<name>_Def` with the fields `definitionKind` (parameter 22 of
//    the contract, name not resolved: Q10) and `owner`; it is the `projdef` of every UV property it is attached to.
//  * This build has no evaluated UV operator stack. An operator of the contract is an Operator node appended to the
//    UV property's `operators` list, carrying the class id (`clsid`) and its connections (`ports`) in contract order.
//    Operator and parameter names are not in the contract (class ids only): the names used here are inferred.
//  * Output arguments: a command without a return value hands its in/out and output arguments back as a list that
//    is also keyed by argument name (the output-argument collection of a scripting caller). A command with only a
//    return value returns that value.
//  * Task status codes that are not failures (0, 1, 0x562e80c7) are kept in `app.primTasksTexture.lastStatus`;
//    failure statuses are thrown as SiStatusError. Message texts are not resolved (Q10): lines carry the id.
//  * An unset `InputObj` list stands for the selection (inferred: the collection argument handler).
// Earlier registrations of HealUVW / MatchUVW / CycleUVW / FlipUVW / RelaxUVW (moduleToolbar.ts placeholders) are
// replaced here.
import { App, CommandDef } from '../core/commands';
import { Node, X3DObject, Cluster, Property, Camera, Operator, MarkerNode, construction } from '../core/scene';
import { ParamSet, num, int } from '../core/params';
import * as TP from '../core/textureProjectionScripts';
import { sdkMsgBox } from '../ui/sdkHelpersModal';
import { SiStatusError } from './alembicSeqCam';

export const NOTE = 'docs/ghidra/cmd-b8d-primtasks-texture-binary.md';
export const S_OK = 0, S_FALSE = 1, S_NOTE = 0x562e80c7;
export const E_NOTIMPL = 0x80004001, E_POINTER = 0x80004003, E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057, E_UNEXPECTED = 0x8000ffff;
const CATEGORY = 'Texturing|Rendering';

/** Definition kinds (value of the definition's parameter 22). */
export const DEFINITION_KIND = { basicGeo: 0x62, camera: 0x63, pureImplicit: 0x69, uvDomain: 0x6e, spatial: 0x73 } as const;
/** Operator classes of the contract. */
export const OPERATOR_CLASS = {
  basicGeo: '{25d90fda-e843-45f3-8cd8-d67d787d72f6}',
  subProjection: '{d4559710-c7fb-4db3-a2fa-543f9781407c}',
  uvDomain: '{870ee6f2-0666-11d1-a8dd-00a024190119}',
  uvDomainSecond: '{0ff48093-8651-11d3-bc59-00a0c9612b97}',
  camera: '{7158c404-4f4e-11d3-b0c9-00a0c982dd9a}',
  spatial: '{27410380-4e87-11d3-b0c9-00a0c982dd9a}',
  legacyBasicGeo: '{870ee6f1-303c-11d1-a8dd-00a024190119}',
  heal: '{ed5f3308-465e-4725-a905-d2a28e85d8d5}',
  relax: '{32187e0b-b21c-464f-bb06-3c42954c35d7}',
  cycle: '{e2f1d19c-7b84-4b13-8f80-6be9ec486a77}',
  flip: '{8c3c4d1b-f326-42ad-9b80-0e26cd10af86}',
  match: '{9676235f-139b-4245-85ab-32d8babbd251}',
} as const;
// inferred: display names of the operators (the contract gives class ids only)
const OPERATOR_NAME: Record<string, string> = {
  [OPERATOR_CLASS.basicGeo]: 'TextureOp', [OPERATOR_CLASS.subProjection]: 'SubProjectionOp', [OPERATOR_CLASS.uvDomain]: 'UVDomainTextureOp',
  [OPERATOR_CLASS.uvDomainSecond]: 'UVDomainSupportOp', [OPERATOR_CLASS.camera]: 'CameraTextureOp', [OPERATOR_CLASS.spatial]: 'SpatialTextureOp',
  [OPERATOR_CLASS.heal]: 'HealUVWOp', [OPERATOR_CLASS.relax]: 'RelaxUVWOp', [OPERATOR_CLASS.cycle]: 'CycleUVWOp', [OPERATOR_CLASS.flip]: 'FlipUVWOp', [OPERATOR_CLASS.match]: 'MatchUVWOp',
};
const PROJECTION_CLASSES: string[] = [OPERATOR_CLASS.basicGeo, OPERATOR_CLASS.uvDomain, OPERATOR_CLASS.camera, OPERATOR_CLASS.spatial, OPERATOR_CLASS.legacyBasicGeo];

export type Definition = ParamSet & { definitionKind: number; owner: X3DObject | null };
export interface PrimTasksTextureState {
  lastStatus: { command: string; status: number } | null;
  /** Message boxes the commands showed (also shown as a modal box when the session is interactive). */
  messages: { command: string; text: string; title: string }[];
  quirks: {
    /** SICreateTextureProj, open question 1: the shared UnPackArg asks for arguments this entry does not declare.
     *  true (inferred reading of the note): the request fails and the command stops before Do.
     *  false: the requests answer with defaults and the command is SICreateTextureBasicGeo with support name `Texture_Support`. */
    createTextureProjFailsInUnPackArg: boolean;
  };
  DEFINITION_KIND: typeof DEFINITION_KIND; OPERATOR_CLASS: typeof OPERATOR_CLASS;
  definitionOf(p: Property): Definition | null;
  operatorsOf(p: Property): Operator[];
}
export const stateOf = (app: App): PrimTasksTextureState => (app as any).primTasksTexture;

// ------------------------------------------------------------------ small helpers
const interactive = (app: App) => (app as any).Interactive !== false;
const unset = (v: any) => v === undefined || v === null || v === '';
const text = (v: any) => (unset(v) ? '' : typeof v === 'string' ? v : v instanceof Node ? v.name : String(v));
const truthy = (v: any) => v === true || v === 1 || v === -1 || (typeof v === 'string' && /^(true|1|-1)$/i.test(v.trim()));
const hex = (n: number) => '0x' + (n >>> 0).toString(16);
const msgId = (id: number) => `message ${hex(id)}; text not yet attested, Q10`;
function fail(status: number, what: string, id?: number): SiStatusError { return new SiStatusError(status, id === undefined ? what : `${what} (${msgId(id)})`); }
function setStatus(app: App, command: string, status: number) { stateOf(app).lastStatus = { command, status }; }
function logNya(app: App, command: string, what: string, question = '') { app.logMsg('info', `${command}: not yet attested: ${what}${question ? ` (${NOTE} ${question})` : ''}`); }
/** The output-argument collection: a list in argument order that is also keyed by argument name. */
export function outputs(pairs: Record<string, any>): any[] & Record<string, any> { return Object.assign(Object.values(pairs), pairs); }
/** A message box of UnPackArg. What the command returns after it is not in the contract: it stops, nothing is created. */
function messageBox(app: App, command: string, message: string, title = 'Error') {
  stateOf(app).messages.push({ command, text: message, title });
  app.logMsg('error', `${command}: ${message}`);
  if (interactive(app) && typeof document !== 'undefined') sdkMsgBox(message, title, true).catch(() => undefined);
  logNya(app, command, 'the status returned after this message box; the command stops and nothing is created');
}
/** Run `f` with the construction mode forced to modeling (0), restored afterwards. */
function inModelingMode<T>(f: () => T): T { const saved = construction.mode; construction.mode = 'modeling'; try { return f(); } finally { construction.mode = saved; } }

type Usable = X3DObject | Cluster | TP.SubComponent;
const isUsable = (it: any): it is Usable => it instanceof X3DObject || it instanceof Cluster || TP.isSubComponent(it);
// inferred: registered filter 0x3a ("can carry a texture projection") = anything on an object with sample geometry
const projectable = (it: Usable) => !!TP.meshOf(TP.ownerOf(it));
const isSurfaceObject = (it: Usable) => it instanceof X3DObject && it.primitive?.type === 'surfmsh' && !!TP.meshOf(it);
function ownersOf(items: Usable[]): X3DObject[] { const out: X3DObject[] = []; for (const it of items) { const o = TP.ownerOf(it); if (o && !out.includes(o)) out.push(o); } return out; }

/** Input validation (base task slot 14 + class filter). Returns the filtered list, or null when nothing is valid
 *  (status 0x562e80c7, the caller does nothing). Throws 0x80004005 when no item survives the first stage. */
function validate(app: App, C: string, arg: any, filter: (it: Usable) => boolean = projectable): Usable[] | null {
  const given = TP.resolveItems(app, arg);
  const nothing = () => { app.logMsg('info', `${C}: no valid input (${msgId(0x36)})`); setStatus(app, C, S_NOTE); return null; };
  if (!given.length) return nothing();
  const kept = given.filter(it => typeof it !== 'string'); // inferred: the first stage drops what does not resolve to a scene element
  if (!kept.length) { app.logMsg('error', `${C}: ${msgId(0x36)}`); throw fail(E_FAIL, `${C}: none of the input items can be used`, 0x37); }
  const items = kept.filter((it): it is Usable => isUsable(it) && filter(it));
  if (!items.length) return nothing();
  if (items.length < given.length) { app.logMsg('info', `${C}: some input items were skipped (${msgId(0x36)})`); setStatus(app, C, S_FALSE); } else setStatus(app, C, S_OK);
  return items;
}

// ------------------------------------------------------------------ definition, operators
export const definitionOf = (p: Property): Definition | null => ((p as any).projdef as Definition | undefined) ?? null;
/** The projection definition `<name>_Def` with its definition kind and optional owner. */
function createDefinition(name: string, kind: number, owner: X3DObject | null): Definition {
  const d = TP.makeProjDef(`${name}_Def`) as Definition; d.definitionKind = kind; d.owner = owner; d.parent = owner;
  return d;
}
function attachDefinition(app: App, p: Property, d: Definition) {
  const P = p as any; const old = P.projdef;
  app.record('Attach Projection Definition', () => { P.projdef = d; }, () => { P.projdef = old; });
}
/** The operator-application task: an operator of class `cls` on UV property `p` with the given connections. */
function applyOperator(app: App, cls: string, p: Property, ports: any[], defs: any[] = []): Operator {
  return inModelingMode(() => {
    const op = new Operator(OPERATOR_NAME[cls] ?? cls, 'uvop', defs); (op as any).clsid = cls; (op as any).ports = ports;
    const P = p as any; const before: Operator[] = TP.uvOperatorsOf(p);
    app.record('Apply Operator', () => { P.operators = [...before, op]; op.parent = p; }, () => { P.operators = before; op.parent = null; });
    return op;
  });
}
const clusterOf = (p: Property): Cluster | null => (p.parent instanceof Cluster ? p.parent : null);
interface ProjectArgs { name: string; kind: string; support: X3DObject | null; mainSupport?: boolean; definition: Definition; cls: string; needsSupport: boolean; }
/** Texture operator application: per input object cluster + UV property, the definition, then the projection operator. */
function project(app: App, C: string, items: Usable[], a: ProjectArgs): Property[] {
  if (a.needsSupport && !a.support) throw fail(E_UNEXPECTED, `${C}: the operator needs a support and there is none`);
  const made: Property[] = [];
  // inferred: one property per owning object (several component items of one object share it)
  for (const o of ownersOf(items)) {
    const p = TP.newUVProperty(app, o, a.name, a.kind, a.support, a.mainSupport ?? true);
    attachDefinition(app, p, a.definition);
    const cl = clusterOf(p);
    // connections in contract order; the optional extra reference of a support whose flag parameter is set is not read (Q5)
    applyOperator(app, a.cls, p, a.needsSupport ? [o, a.support, p, a.definition, p, cl] : [o, p, o, a.definition, p, cl]);
    made.push(p);
  }
  // the closing task {d8b3c0e0-...} (arguments 0x402 / 0x800) is not read (Q4): nothing is done for it
  return made;
}
const isSupport = (o: any): o is X3DObject => o instanceof X3DObject && (o as any).type === 'texturesupport';
const isNurbsSupport = (s: X3DObject) => (s as any).projectionKind === 'UV';
function firstObject(app: App, arg: any): X3DObject | null {
  for (const it of TP.resolveItems(app, arg, false)) { const o = it instanceof X3DObject ? it : null; if (o) return o; } // inferred: an unset list is empty (not the selection)
  return null;
}

// ------------------------------------------------------------------ SICreateTextureBasicGeo (and the legacy entry)
function createTextureBasicGeo(app: App, C: string, a: Record<string, any>) {
  const requested = text(a.PropertyName);
  const out = outputs({ PropertyName: requested, '3DObjTexture': null as X3DObject | null, Properties: [] as Property[] });
  const existing = unset(a.TextureProjection) ? null : TP.resolveItems(app, a.TextureProjection, false).find(TP.isUVProperty) ?? null;
  const items = validate(app, C, a.InputObj); if (!items) return out;
  const type = TP.enumValue(a.ProjectionType, TP.siProjPlanar), plane = TP.enumValue(a.ProjectionPlane, TP.siPlaneXY), fitting = TP.enumValue(a.Fitting, TP.siRelBestFit);
  const visible = unset(a.Visibility) ? true : truthy(a.Visibility);
  const parent = TP.resolveObject(app, a.Parent); // passed through as given; none = the scene root (inferred, shared facts)
  const supportName = text(a.SupportName); // empty = Texture_Support
  if (existing) {
    // sub-projection mode: support + fit, then operator {d4559710-...} on the existing property; no property, cluster or definition
    const owner = TP.ownerOf(existing);
    const attachedTo = clusterOf(existing); if (!attachedTo) throw fail(E_INVALIDARG, `${C}: the texture projection is not attached to an element`);
    const { support } = TP.createTextureBasicGeo(app, { command: C, input: items, supportName, propertyName: '', parent, type, plane, visible, existing, fitting });
    if (!support) throw fail(E_UNEXPECTED, `${C}: the operator needs a support and there is none`);
    for (const it of items) if (TP.ownerOf(it) === owner) applyOperator(app, OPERATOR_CLASS.subProjection, existing, [attachedTo, support, existing, null, existing, attachedTo]);
    out['3DObjTexture'] = out[1] = support;
    return out;
  }
  const unique = TP.findUniqueTextureName(ownersOf(items), requested);
  const { support, properties } = TP.createTextureBasicGeo(app, { command: C, input: items, supportName, propertyName: unique, parent, type, plane, visible, existing: null, fitting });
  if (!support) throw fail(E_UNEXPECTED, `${C}: the operator needs a support and there is none`);
  const def = createDefinition(unique, DEFINITION_KIND.basicGeo, support);
  for (const p of properties) {
    attachDefinition(app, p, def);
    applyOperator(app, OPERATOR_CLASS.basicGeo, p, [TP.ownerOf(p), support, p, def, p, clusterOf(p)]);
  }
  out['3DObjTexture'] = out[1] = support; out.Properties = out[2] = properties;
  return out; // PropertyName stays the requested name, not the uniquified one
}

// ------------------------------------------------------------------ UVW editing family
const LABEL: Record<string, string> = { pnt: 'Point', edge: 'Edge', poly: 'Polygon', sample: 'Sample' };
function uvwEdit(app: App, C: string, cls: string, a: Record<string, any>, param?: { name: string; guid: string; value: number; integer: boolean }): Operator | undefined {
  if (unset(a.TextureProjection) || unset(a.SubComp)) throw fail(E_POINTER, `${C}: TextureProjection and SubComp are required`);
  const prop = TP.resolveItems(app, a.TextureProjection, false).find(TP.isUVProperty) ?? null;
  const sub = TP.resolveItems(app, a.SubComp, false)[0];
  if (!prop || sub === undefined || typeof sub === 'string') throw fail(E_POINTER, `${C}: TextureProjection and SubComp are required`);
  const owner = TP.ownerOf(sub);
  if (!owner || owner.primitive?.type !== 'polymsh') { app.logMsg('info', `${C}: ${TP.itemText(sub)} is not on a polygon mesh (${msgId(0x29)})`); setStatus(app, C, S_FALSE); return undefined; }
  let cluster: Cluster;
  if (sub instanceof Cluster) cluster = sub; // element type 6
  else if (TP.isSubComponent(sub)) { // element type 7: a cluster is made from the index array first
    const c = new Cluster(TP.uniqueClusterName(owner, LABEL[sub.compKind] ?? 'Cluster'), sub.compKind, new Set<number | string>(sub.elements)); // inferred: the cluster name
    inModelingMode(() => app.record('Create Cluster', () => owner.addCluster(c), () => owner.removeCluster(c)));
    cluster = c;
  } else { setStatus(app, C, S_OK); return undefined; } // any other element type: nothing, status 0
  const ports: any[] = [prop, cluster];
  if (cls === OPERATOR_CLASS.relax) {
    logNya(app, C, 'the preparation of the relax operator (the derived element set, its extra texture-coordinate cluster and the third connection); the operator is applied with the two known connections', 'Q3');
    ports.push(null);
  }
  const defs = param ? [(param.integer ? int : num)(param.name, param.value, param.name)] : [];
  const op = applyOperator(app, cls, prop, ports, defs);
  if (param) (op as any).parameterGuid = param.guid;
  logNya(app, C, `the UV evaluation of ${op.name} (another module); the operator is connected and its parameter is set, the UVs are unchanged`);
  setStatus(app, C, S_OK);
  return op;
}

// ------------------------------------------------------------------ registration
export function registerPrimTasksTextureCommands(app: App) {
  const st: PrimTasksTextureState = {
    lastStatus: null, messages: [], quirks: { createTextureProjFailsInUnPackArg: true },
    DEFINITION_KIND, OPERATOR_CLASS, definitionOf, operatorsOf: TP.uvOperatorsOf,
  };
  (app as any).primTasksTexture = st;
  const reg = (def: CommandDef) => app.register({ category: CATEGORY, ...def });
  const TYPE = ':siProjPlanar:siTxtProjType', PLANE = ':siPlaneXY:siTxtProjPlane', FIT = ':siRelBestFit:siTxtProjFitMethod', PRESET = '{42FC2493-732F-11d2-AC52-00A02485CECB}:Texture';

  reg({
    name: 'SIFindUniqueTextureName', label: 'Find a unique texture projection name', undoable: false,
    description: 'Proposes a UV property name that is free on all inputs.',
    args: [{ name: 'InputObj', default: null }, { name: 'PropertyName', default: '' }],
    execute(app, a) {
      const C = 'SIFindUniqueTextureName'; const given = text(a.PropertyName);
      // own class filter (objects and component kinds); inferred to accept what filter 0x3a accepts
      const items = validate(app, C, a.InputObj);
      return outputs({ PropertyName: items ? TP.findUniqueTextureName(ownersOf(items), given) : given });
    },
  });

  reg({
    name: 'SICreateTexturePureImplicit', label: 'Create a purely implicit texture',
    description: 'Gives each input a UV property that carries only a projection definition.',
    args: [{ name: 'InputObj', default: null }, { name: 'PropertyName', default: null }],
    execute(app, a) {
      const C = 'SICreateTexturePureImplicit'; const given = text(a.PropertyName);
      const out = outputs({ PropertyName: given }); // written back as passed in
      const items = validate(app, C, a.InputObj); if (!items) return out; // own class filter (Q6), inferred as above
      const unique = TP.findUniqueTextureName(ownersOf(items), given);
      const def = createDefinition(given, DEFINITION_KIND.pureImplicit, null); // named after the name as passed
      for (const o of ownersOf(items)) {
        const p = TP.newUVProperty(app, o, unique, 'UV', null); // inferred: this build's kind for a property without projection
        attachDefinition(app, p, def);
      }
      return out;
    },
  });

  reg({
    name: 'SICreateTextureBasicGeo', label: 'Create a texture using basic geometry as a support',
    description: 'Creates a texture support and projects the inputs through it, into a new UV property or as a sub-projection of an existing one.',
    args: [{ name: 'PresetObj', default: PRESET }, { name: 'InputObj', default: null }, { name: 'SupportName', default: null }, { name: 'PropertyName', default: null }, { name: 'Parent', default: null },
      { name: 'ProjectionType', default: TYPE }, { name: 'ProjectionPlane', default: PLANE }, { name: 'Visibility', default: true }, { name: 'TextureProjection', default: null },
      { name: '3DObjTexture', default: null }, { name: 'Properties', default: null }, { name: 'Fitting', default: FIT }],
    execute: (app, a) => createTextureBasicGeo(app, 'SICreateTextureBasicGeo', a),
  });

  reg({
    name: 'SICreateTextureProj', label: 'Create a texture primitive object',
    description: 'Legacy entry of the basic-geometry texture task.',
    args: [{ name: 'PresetObj', default: PRESET }, { name: 'InputObj', default: null }, { name: 'Name', default: '' }, { name: 'Parent', default: null },
      { name: '3DObjTexture', default: null }, { name: 'PrimObjTexture', default: null }, { name: 'PropertyName', default: '' }],
    execute(app, a) {
      const C = 'SICreateTextureProj';
      logNya(app, C, 'how the exec context answers the shared UnPackArg\'s by-name requests for SupportName, Visibility, ProjectionType, ProjectionPlane and Fitting, which this entry does not declare', 'open question 1');
      if (st.quirks.createTextureProjFailsInUnPackArg) throw fail(E_FAIL, `${C}: UnPackArg stops on an argument this entry does not declare (inferred; the status is not in the contract)`); // inferred
      // the other reading: defaults for the undeclared arguments; `Name` is never asked for, `PrimObjTexture` never written
      const r = createTextureBasicGeo(app, C, { InputObj: a.InputObj, PropertyName: a.PropertyName, Parent: a.Parent });
      return outputs({ '3DObjTexture': r['3DObjTexture'], PrimObjTexture: null, PropertyName: r.PropertyName });
    },
  });

  reg({
    name: 'SICreateTextureUVDomain', label: 'Create a nurbs texture support object',
    description: 'For each NURBS input creates a UV-domain texture support and a UV property driven by it.',
    args: [{ name: 'PresetObj', default: null }, { name: 'InputObj', default: null }, { name: 'SupportName', default: null }, { name: 'PropertyName', default: null }, { name: 'Visibility', default: true },
      { name: 'OutputObjs', default: null }, { name: 'Properties', default: null }],
    execute(app, a) {
      const C = 'SICreateTextureUVDomain'; const given = text(a.PropertyName);
      const out = outputs({ PropertyName: given, OutputObjs: [] as X3DObject[], Properties: [] as Property[] });
      const items = validate(app, C, a.InputObj, isSurfaceObject) as X3DObject[] | null; if (!items) return out;
      const unique = TP.findUniqueTextureName(items, given); // once for the whole list
      const visible = unset(a.Visibility) ? true : truthy(a.Visibility);
      const preset = text(a.PresetObj);
      let logged = false;
      for (const o of items) {
        const sup = TP.makeSupport(app, text(a.SupportName), TP.siProjPlanar, TP.siPlaneXY, o, o.globalMatrix(), [-1, -1, -1], [1, 1, 1], visible); // inferred: created as a child of its surface
        (sup as any).projectionKind = 'UV'; (sup as any).preset = preset;
        const def = createDefinition(unique, DEFINITION_KIND.uvDomain, sup);
        const p = project(app, C, [o], { name: unique, kind: 'UV', support: sup, mainSupport: false, definition: def, cls: OPERATOR_CLASS.uvDomain, needsSupport: true })[0];
        applyOperator(app, OPERATOR_CLASS.uvDomainSecond, p, [null, null, null]); // three connections, not read
        if (!logged) { logged = true; logNya(app, C, 'the setup sub-task that consumes Visibility (the view visibility of the support is set), the three connections of the second operator and the entry that takes an existing support', 'open question 2'); }
        out.OutputObjs.push(sup); out.Properties.push(p);
      }
      return out;
    },
  });

  reg({
    name: 'SIConnectToSupport', label: 'Connect texture projection',
    description: 'Projects the inputs through an existing texture support.',
    args: [{ name: 'InputObj', default: null }, { name: 'PropertyName', default: null }, { name: 'PrimObjTexture', default: null }, { name: '3DObjTexture', default: null }],
    execute(app, a) {
      const C = 'SIConnectToSupport'; const given = text(a.PropertyName);
      const out = outputs({ PropertyName: given, '3DObjTexture': null as X3DObject | null });
      const first = firstObject(app, a.PrimObjTexture); const sup = isSupport(first) ? first : null; // inferred: usable = a texture support object
      if (!sup) { messageBox(app, C, 'There were no valid texture control selected'); return out; }
      // the class filter also tests the inputs against the support's existing definition; that test is not read (Q6)
      const items = validate(app, C, a.InputObj); if (!items) return out;
      const unique = TP.findUniqueTextureName(ownersOf(items), given);
      const nurbs = isNurbsSupport(sup);
      const def = createDefinition(unique, nurbs ? DEFINITION_KIND.uvDomain : DEFINITION_KIND.basicGeo, sup);
      const type = (sup as any).projectionType as number | undefined;
      const kind = nurbs ? 'UV' : type !== undefined ? TP.KIND_OF_TYPE[type] ?? 'Planar XY' : 'Planar XY';
      project(app, C, items, { name: unique, kind, support: sup, mainSupport: !nurbs, definition: def, cls: nurbs ? OPERATOR_CLASS.uvDomain : OPERATOR_CLASS.basicGeo, needsSupport: true });
      out.PropertyName = out[0] = unique; out['3DObjTexture'] = out[1] = sup;
      return out;
    },
  });

  reg({
    name: 'SIConnectToProjection', label: 'Share Projection Definition',
    description: 'Gives the inputs a new UV property that reuses the projection definition of an existing texture projection.',
    args: [{ name: 'InputObj', default: null }, { name: 'PropertyName', default: null }, { name: 'TextureProjection', default: null }],
    execute(app, a) {
      const C = 'SIConnectToProjection'; const given = text(a.PropertyName);
      const sources = TP.resolveItems(app, a.TextureProjection, false).filter((it): it is Property => TP.isUVProperty(it) && !!definitionOf(it));
      const out = outputs({ PropertyName: given, TextureProjection: sources[0] ?? null });
      if (sources.length !== 1) { messageBox(app, C, 'There were no valid texture projection selected'); return out; }
      const source = sources[0]; const def = definitionOf(source)!;
      const items = validate(app, C, a.InputObj); if (!items) return out;
      const unique = TP.findUniqueTextureName(ownersOf(items), given);
      let cls = (TP.uvOperatorsOf(source).find(op => PROJECTION_CLASSES.includes((op as any).clsid)) as any)?.clsid as string | undefined;
      if (!cls) { app.logMsg('error', `${C}: ${msgId(0x37)}`); throw fail(E_FAIL, `${C}: the texture projection has no projection operator`, 0x37); }
      if (cls === OPERATOR_CLASS.legacyBasicGeo) cls = OPERATOR_CLASS.basicGeo;
      const srcOwner = TP.ownerOf(source);
      const support = (srcOwner ? TP.supportsOfProperty(srcOwner, source)[0] : null) ?? ((source as any).supports?.[0] as X3DObject | undefined) ?? null;
      logNya(app, C, 'where the support connection of the new operator comes from; the support of the source projection is connected', 'open question 7');
      const needsSupport = cls !== OPERATOR_CLASS.spatial;
      project(app, C, items, { name: unique, kind: String(source.val('kind')), support, mainSupport: String(source.val('support') ?? '') !== '', definition: def, cls, needsSupport });
      out.PropertyName = out[0] = unique;
      return out;
    },
  });

  reg({
    name: 'SICameraTextureProj', label: 'Use Camera for texture projection',
    description: 'Camera projection: a UV property projected from a scene camera.',
    args: [{ name: 'InputObj', default: null }, { name: 'PropertyName', default: null }, { name: 'PrimObjTexture', default: null }, { name: '3DObjCamera', default: null }],
    execute(app, a) {
      const C = 'SICameraTextureProj'; const given = text(a.PropertyName);
      const out = outputs({ PropertyName: given, '3DObjCamera': null as X3DObject | null });
      const cam = firstObject(app, a.PrimObjTexture);
      if (!cam) { messageBox(app, C, 'There were no valid camera selected'); return out; }
      const items = validate(app, C, a.InputObj); if (!items) return out;
      const sceneCameras: X3DObject[] = [...app.scene.allObjects()].filter(o => o instanceof Camera); // SIGetListOfSceneCameras
      if (!sceneCameras.includes(cam)) { app.logMsg('error', `${C}: ${cam.name} is not a scene camera (${msgId(0x117)})`); return out; }
      const unique = TP.findUniqueTextureName(ownersOf(items), given);
      const def = createDefinition(unique, DEFINITION_KIND.camera, null);
      project(app, C, items, { name: unique, kind: 'Camera Projection', support: cam, definition: def, cls: OPERATOR_CLASS.camera, needsSupport: true }); // the camera sits in the support position
      out.PropertyName = out[0] = unique; out['3DObjCamera'] = out[1] = cam;
      return out;
    },
  });

  reg({
    name: 'SICreateTextureSpatial', label: 'Geometry to Texture Task', category: '',
    description: 'UV property computed from the object\'s own geometry, without a support.',
    args: [{ name: 'InputObj', default: null }, { name: 'PropertyName', default: null }, { name: 'CreatedObj', default: null }],
    execute(app, a) {
      const C = 'SICreateTextureSpatial'; const given = text(a.PropertyName);
      const out = outputs({ PropertyName: given, CreatedObj: null }); // CreatedObj is never written
      const items = validate(app, C, a.InputObj); if (!items) return out;
      const unique = TP.findUniqueTextureName(ownersOf(items), given);
      const def = createDefinition(unique, DEFINITION_KIND.spatial, null);
      project(app, C, items, { name: unique, kind: 'Spatial', support: null, definition: def, cls: OPERATOR_CLASS.spatial, needsSupport: false });
      out.PropertyName = out[0] = unique;
      return out;
    },
  });

  reg({
    name: 'SIGetTextureUVDomains', label: 'Get Texture UV Domains', undoable: false,
    description: 'Get Texture UV Domains for a collection of objects',
    args: [{ name: 'InputObjs', default: null }],
    execute(app, a) {
      // A null list (0x80004003) cannot reach this point: an unset list stands for the selection. The walk (clusters ->
      // UV properties -> operators -> connected supports) was established from the call sequence only: the order of
      // the result and the once-each rule are inferred (open question 7).
      setStatus(app, 'SIGetTextureUVDomains', S_OK);
      return TP.getTextureUVDomains(TP.resolveItems(app, a.InputObjs));
    },
  });

  reg({
    name: 'ChangeUVInput', label: 'Change UV Input', category: 'Texturing',
    description: 'Change where the UV generator reads from',
    args: [{ name: 'TextureProjection', default: null }, { name: 'MoveAction', default: ':siChangeUVInputActionSwim:siChangeUVInputActions' }],
    execute(app, a) {
      const C = 'ChangeUVInput';
      if (unset(a.TextureProjection)) throw fail(E_POINTER, `${C}: no texture projection`);
      const prop = TP.resolveItems(app, a.TextureProjection, false).find(TP.isUVProperty) ?? null;
      if (!prop) throw fail(E_POINTER, `${C}: no texture projection`);
      const s = String(a.MoveAction); const action = /siChangeUVInputActionSwim/.test(s) ? 0 : Number(a.MoveAction);
      const generator = TP.uvOperatorsOf(prop).find(op => PROJECTION_CLASSES.includes((op as any).clsid)) ?? TP.uvOperatorsOf(prop)[0];
      const owner = TP.ownerOf(prop);
      if (!generator || !owner) throw fail(E_UNEXPECTED, `${C}: no operator writes ${prop.name}`);
      if (!Number.isFinite(action) || action < 0 || action > 2) throw fail(E_NOTIMPL, `${C}: MoveAction ${a.MoveAction}`);
      const P = prop as any; const old = { action: P.uvInputAction, swim: P.swim, marker: P.uvInputMarker, side: P.uvInputSide };
      let marker: MarkerNode | null = null, side: number | undefined;
      if (action !== 0) {
        // F3DFindMarkerOperator: a construction-region marker of the owner; which one is not in the contract
        const markers = (owner.primitive?.explorerChildren() ?? []).filter((n): n is MarkerNode => n instanceof MarkerNode);
        marker = markers.find(m => m.mode === 'modeling') ?? markers[0] ?? null; // inferred: the modeling marker
        if (!marker) throw fail(E_UNEXPECTED, `${C}: no construction-region marker on ${owner.name}`);
        side = action === 1 ? 2 : 1;
        logNya(app, C, `the names of move actions 1 and 2 and the move task itself (another module); the request is recorded on the property (mode 1, side code ${side})`, 'open question 8');
      }
      // mode 0, no marker: the UV generator is moved to the top of the stack (swim)
      app.record('Change UV Input', () => { P.uvInputAction = action; P.swim = action === 0; P.uvInputMarker = marker; P.uvInputSide = side; },
        () => { P.uvInputAction = old.action; P.swim = old.swim; P.uvInputMarker = old.marker; P.uvInputSide = old.side; });
      setStatus(app, C, S_OK);
    },
  });

  // ---- UVW editing family: TextureProjection, SubComp[, scalar], OutputObj (the return value: the operator)
  const UVW = [{ name: 'TextureProjection', default: null }, { name: 'SubComp', default: null }];
  reg({ name: 'HealUVW', label: 'Heal UVW', category: 'Texturing', description: 'Heal the given unshared UVWs', args: UVW,
    execute: (app, a) => uvwEdit(app, 'HealUVW', OPERATOR_CLASS.heal, a) });
  reg({ name: 'RelaxUVW', label: 'Relax UVW', category: 'Texturing', description: 'Relax the UVWs to fit polygon proportions', args: UVW,
    execute: (app, a) => uvwEdit(app, 'RelaxUVW', OPERATOR_CLASS.relax, a) });
  reg({ name: 'MatchUVW', label: 'Match UVW', category: 'Texturing', description: 'Match the UVWs that are almost equal', args: [...UVW, { name: 'Tolerance', default: 0.02 }],
    execute: (app, a) => uvwEdit(app, 'MatchUVW', OPERATOR_CLASS.match, a, { name: 'tolerance', guid: '{8e9cc20a-4371-4d44-a563-174120fc777b}', value: Number(a.Tolerance), integer: false }) });
  reg({ name: 'CycleUVW', label: 'Cycle UVW', category: 'Texturing', description: 'Cycle the UVWs around the given polygons', args: [...UVW, { name: 'Offset', default: 1 }],
    execute: (app, a) => uvwEdit(app, 'CycleUVW', OPERATOR_CLASS.cycle, a, { name: 'offset', guid: '{45733896-ec8f-47b2-8010-e89e9a091209}', value: Math.trunc(Number(a.Offset)), integer: true }) });
  reg({ name: 'FlipUVW', label: 'Flip UVW', category: 'Texturing', description: 'Flip the UVWs around the given polygons', args: [...UVW, { name: 'Pivot', default: 1 }],
    execute: (app, a) => uvwEdit(app, 'FlipUVW', OPERATOR_CLASS.flip, a, { name: 'pivot', guid: '{6f963cfb-00ef-40c5-9133-4ff8f43a12cc}', value: Math.trunc(Number(a.Pivot)), integer: true }) });
}
