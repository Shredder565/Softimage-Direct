// Shader-creation family of CLSID bbbbee29-9a74-46fc-8f43-bfebbabfd1bd (ledger row CMD-B15-ELSE):
//   CreateShaderFromCLSID CreateShaderFromProgID CreateShadersFromMaterialPreset
// There is NO wire contract: the handler DLL is still unlocated (docs/ghidra/cmd-b15c-particles.md section 2,
// cmd-b15b-propertytasks.md, cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md "Not implemented here"). What is attested:
//  * the registry argument lists (data/commands_full.json) and that all of them share one task and differ only by the
//    hidden `PrivateInvokeMethod` default (1 = from CLSID, 2 = from ProgID, 4 = from material preset), all returning a
//    Shader (data/command_registry.json; note B12f);
//  * the registry descriptions: "Add shader to a render tree from a CLSID / a ProgID", "Add a shader tree to a render
//    tree from a material preset".
// Everything else is inferred from those descriptions and from the shader commands already in src/ (CreateShaderFromPreset,
// ImportShaderTree, SIApplyShaderToCnxPoint2's ProgID parsing). Each inferred step is marked `// inferred`.
// AddShaderAttachedComment (method 3) is wired by another row and is not registered here.
import { App } from '../core/commands';
import { Node, Shader, Material } from '../core/scene';
import { makeSiShader } from '../core/scene';
import { uniqueNameIn, makeProgIdShader, makePresetShader } from '../core/textureLayers';
import { ShaderCompound } from '../core/shaderCompound';
import { SiStatusError } from './alembicSeqCam';
import { nodeOf, listOf, nestRec } from './shadertasksB12Shared';

const ROW = 'CMD-B15-ELSE';
const E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057;
const fail = (status: number, what: string) => new SiStatusError(status, what);
const nya = (app: App, C: string, what: string) => app.logMsg('info', `${C}: not yet attested: ${what} (${ROW}, CLSID bbbbee29 handler unlocated)`);

export interface ShaderCreationB15State {
  /** CLSID (lower case, no braces) → ProgID of a shader definition. Empty: no CLSID table is in the repo data. */
  clsids: Record<string, string>;
  /** PrivateInvokeMethod of the last call (1 CLSID, 2 ProgID, 4 material preset). */
  lastMethod: number | null;
}
export function shaderCreationB15(app: App): ShaderCreationB15State {
  return ((app as any).shaderCreationB15 ??= { clsids: {}, lastMethod: null } as ShaderCreationB15State);
}

const isContainer = (n: any): n is Node => n instanceof Material || n instanceof ShaderCompound;
/** Container: the first item, a render tree container (material or shader compound). // inferred: no selection fallback */
function containerArg(app: App, C: string, v: any): Node {
  const c = nodeOf(app, listOf(v)[0]);
  if (!isContainer(c)) throw fail(E_INVALIDARG, `${C}: Container is not a render tree container`);
  return c;
}
/** Nest a new shader (and the shaders plugged into it) in the container, names kept unique there. // inferred */
function nestTree(app: App, container: Node, root: Shader) {
  const seen: Shader[] = []; const names: string[] = [];
  const visit = (s: Shader) => { if (seen.includes(s)) return; seen.push(s); for (const x of s.inputs.values()) visit(x); };
  visit(root);
  for (const s of seen) { s.name = uniqueNameIn(container, s.name, names); names.push(s.name); }
  for (const s of seen) nestRec(app, container, s);
}
const nameArg = (v: any) => (v === undefined || v === null ? '' : String(v));

function fromProgId(app: App, a: Record<string, any>) {
  const C = 'CreateShaderFromProgID';
  shaderCreationB15(app).lastMethod = 2;
  const progId = nameArg(a.ProgID).trim();
  if (!progId) throw fail(E_INVALIDARG, `${C}: ProgID is empty`);                                   // inferred
  const container = containerArg(app, C, a.Container);
  const sh = makeProgIdShader(progId, nameArg(a.Name) || undefined);
  if (!sh) throw fail(E_FAIL, `${C}: no shader definition for ProgID "${progId}" in this build`);  // inferred
  (sh as any).progId = progId;
  nestTree(app, container, sh);
  a.Shader = sh;
  return sh;
}

function fromClsid(app: App, a: Record<string, any>) {
  const C = 'CreateShaderFromCLSID';
  const st = shaderCreationB15(app); st.lastMethod = 1;
  const m = /^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i.exec(nameArg(a.Clsid).trim());
  if (!m || /^[0-]+$/.test(m[1])) throw fail(E_INVALIDARG, `${C}: Clsid is not a shader class id`); // inferred: the null GUID default is not a class
  const container = containerArg(app, C, a.Container);
  const progId = st.clsids[m[1].toLowerCase()];
  if (!progId) { nya(app, C, `the CLSID → shader definition table (no entry for {${m[1]}} in this build's data)`); throw fail(E_FAIL, `${C}: shader class {${m[1]}} is not known in this build`); }
  const sh = makeProgIdShader(progId, nameArg(a.Name) || undefined);
  if (!sh) throw fail(E_FAIL, `${C}: shader class {${m[1]}} (${progId}) has no definition in this build`);
  (sh as any).progId = progId; (sh as any).clsid = m[1].toLowerCase();
  nestTree(app, container, sh);
  a.Shader = sh;
  return sh;
}

function fromMaterialPreset(app: App, a: Record<string, any>) {
  const C = 'CreateShadersFromMaterialPreset';
  shaderCreationB15(app).lastMethod = 4;
  const raw = nameArg(a.PresetObj).trim();
  if (!raw) throw fail(E_INVALIDARG, `${C}: PresetObj is empty`);                                   // inferred
  const container = containerArg(app, C, a.Container);
  // a preset path or name: "Materials\\Phong", "...\\Phong.Preset" -> Phong (inferred, as CreateShaderFromPreset)
  const key = raw.replace(/\.preset$/i, '').split(/[\\/]/).pop()!;
  const sh = makePresetShader(key) ?? makeSiShader(key);
  if (!sh) throw fail(E_FAIL, `${C}: material preset "${raw}" is not bundled`);
  nestTree(app, container, sh);
  nya(app, C, 'whether the preset\'s material-level parameters and port connections are also applied to the container');
  a.Shader = sh;
  return sh;
}

export function registerShaderCreationB15Commands(app: App) {
  shaderCreationB15(app);
  app.register({
    name: 'CreateShaderFromCLSID', label: 'Create Shader From CLSID', category: 'Rendering', description: 'Add shader to a render tree from a CLSID',
    args: [{ name: 'Clsid', default: '{00000000-0000-0000-0000-000000000000}' }, { name: 'Container', default: null }, { name: 'Name', default: '' }], execute: fromClsid,
  });
  app.register({
    name: 'CreateShaderFromProgID', label: 'Create Shader From ProgID', category: 'Rendering', description: 'Add shader to a render tree from a ProgID',
    args: [{ name: 'ProgID', default: '' }, { name: 'Container', default: null }, { name: 'Name', default: '' }], execute: fromProgId,
  });
  app.register({
    name: 'CreateShadersFromMaterialPreset', label: 'Create Shaders From Material Preset', category: 'Rendering', description: 'Add a shader tree to a render tree from a material preset',
    args: [{ name: 'PresetObj', default: null }, { name: 'Container', default: null }], execute: fromMaterialPreset,
  });
}
