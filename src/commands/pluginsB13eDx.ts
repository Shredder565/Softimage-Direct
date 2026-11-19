// Ledger row CMD-B13e, part 4: DirectX .x export / import (DirectXExport.dll, DirectXImport.dll) and the realtime
// shader cache of HWParsers.dll.
//   DXExport DXImport ClearRealtimeShaderCache
// Brief: docs/ghidra/cmd-b13e-small-plugins-binary.md, sections 2.3, 2.4 and 3, and docs/re/WIRE_CORRECTIONS_B13.md.
// Original code from that prose. The `.x` writer and parser of the plug-ins were not read; the text written / read
// here follows the published DirectX .x file format (Microsoft DirectX SDK documentation, "X File Format Reference":
// the `xof 0303txt 0032` header, Frame / FrameTransformMatrix / Mesh data objects and the XSkinMeshHeader /
// VertexDuplicationIndices / SkinWeights template declarations). Geometry only; no handedness change (open question).
import * as THREE from 'three';
import { App } from '../core/commands';
import { Property, Null, threeOrder } from '../core/scene';
import { str, int, bool } from '../core/params';
import {
  stateOf, logNya, narrow, intArg, boolArg, unset, CFile, hostFs, isFile, deleteFile, parentPath,
  addObject, addProperty, meshObject, meshOf, X3DObject,
} from './pluginsB13eShared';

// ------------------------------------------------------------------ properties (section 2.3), created on the scene root
const P = (d: any) => ({ ...d, capabilities: 4 });   // siPersistable
const DX_EXPORT_DEFS = () => [
  P(str('Filename', '', 'Filename')), P(int('DXType', 0, 'Format Type')), P(bool('Anim', true, 'Export Animation')),
  P(int('FrameOffset', 1, 'Frame offset')), P(int('AnimType', 0, 'Type')), P(bool('Textures', true, 'Export textures')),
  P(bool('txtabsolute', false, 'Absolute Paths')), P(bool('txtsequences', false, 'Sequences')), P(bool('txtfiles', false, 'Copy Textures')),
  P(int('txtresizeX', 0, 'Resize X')), P(int('txtresizeY', 0, 'Resize Y')), P(int('txtformat', 0, 'Format')),
  P(bool('triangulate', false, 'Triangulate')), P(bool('plot', false, 'Plot Animation')), P(int('chains', 0, 'Chains')),
  P(bool('ExportHidden', false, 'Export Hidden Objects')), P(bool('CompressMesh', true, 'Compress Mesh')),
];
const DX_IMPORT_DEFS = () => [
  P(str('Filename', '', 'Filename')), P(bool('Anim', true, 'Import Animation')), P(bool('Textures', true, 'Import textures')),
  P(bool('InvertUV', false, 'Invert UVs')), P(bool('Reorient', false, 'Reorient Scene')), P(int('FrameOffset', 1, 'Animation frame offset')),
];
function rootProp(app: App, name: string, defs: () => any[]): Property {
  const root = app.scene.root;
  return root.properties.find(p => p.name === name) ?? addProperty(app, root, new Property(name, name, defs()));
}
function setP(app: App, prop: Property, name: string, v: any) { const p = prop.get(name); if (p && p.value !== v) app.setParam(p, v); }
/** Parameter lookup by a name spelled differently from the definition (case-insensitive). */
const paramCI = (prop: Property, name: string) => prop.params.find(p => p.name.toLowerCase() === name.toLowerCase());

/** The modal InspectObj(prop, "", <name>, 4, true): OK -> true. */
function inspectModal(app: App, C: string, prop: Property): boolean {
  const ok = stateOf(app).hooks.inspect?.(C, prop);
  if (ok === undefined) { logNya(app, C, `the modal property page of ${prop.name} (no dialog host); cancelled`); return false; }
  return !!ok;
}
/** "<drive><dir>\__tmp.xsi" next to the given file. */
const tmpPath = (file: string) => { const d = parentPath(file); return d ? `${d.replace(/[\\/]+$/, '')}\\__tmp.xsi` : '__tmp.xsi'; };
const fmt = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(6);

// ------------------------------------------------------------------ DXExport
const X_TEMPLATES = [
  'template XSkinMeshHeader {', ' <3CF169CE-FF7C-44ab-93C0-F78F62D172E2>', ' WORD nMaxSkinWeightsPerVertex;', ' WORD nMaxSkinWeightsPerFace;', ' WORD nBones;', '}', '',
  'template VertexDuplicationIndices {', ' <B8D65549-D7C9-4995-89CF-53A9A8B031E3>', ' DWORD nIndices;', ' DWORD nOriginalVertices;', ' array DWORD indices[nIndices];', '}', '',
  'template SkinWeights {', ' <6F0D123B-BAD2-4167-A0D0-80224F25FABB>', ' STRING transformNodeName;', ' DWORD nWeights;', ' array DWORD vertexIndices[nWeights];',
  ' array FLOAT weights[nWeights];', ' Matrix4x4 matrixOffset;', '}', '',
];
const xName = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');
function xFrame(o: X3DObject, triangulate: boolean, ind: string): string[] {
  const out = [`${ind}Frame ${xName(o.name)} {`];
  const e = o.kinematics.localMatrix().elements;
  out.push(`${ind} FrameTransformMatrix {`, `${ind}  ${Array.from(e, fmt).join(',')};;`, `${ind} }`);
  const m = meshOf(o);
  if (m) {
    const polys = triangulate ? m.polygons.flatMap(f => f.slice(1, -1).map((_, i) => [f[0], f[i + 1], f[i + 2]])) : m.polygons;
    const n = m.positions.length / 3;
    out.push(`${ind} Mesh ${xName(o.name)}Mesh {`, `${ind}  ${n};`);
    for (let i = 0; i < n; i++) out.push(`${ind}  ${fmt(m.positions[i * 3])};${fmt(m.positions[i * 3 + 1])};${fmt(m.positions[i * 3 + 2])};${i === n - 1 ? ';' : ','}`);
    out.push(`${ind}  ${polys.length};`);
    polys.forEach((f, i) => out.push(`${ind}  ${f.length};${f.join(',')};${i === polys.length - 1 ? ';' : ','}`));
    out.push(`${ind} }`);
  }
  for (const c of o.children) out.push(...xFrame(c, triangulate, ind + ' '));
  out.push(`${ind}}`);
  return out;
}

function dxExport(app: App, a: Record<string, any>) {
  const C = 'DXExport';
  const prop = rootProp(app, 'DXExportProperty', DX_EXPORT_DEFS);
  // Arguments 1..16 in order. As read in the binary (WIRE_CORRECTIONS_B13): DX_OptionsExportHiddenObjects goes into
  // `chains` and DX_OptionsChains into `ExportHidden` - the two are swapped, kept here as read (do not "fix").
  const map: [string, any][] = [
    ['DXType', intArg(a.DX_Format, 0)], ['Anim', boolArg(a.DX_AnimationExport, true)], ['FrameOffset', intArg(a.DX_AnimationFrameOffset, 1)],
    ['AnimType', intArg(a.DX_AnimationType, 0)], ['Textures', boolArg(a.DX_TexturesExport, true)], ['txtabsolute', boolArg(a.DX_TexturesAbsolutePaths, false)],
    ['txtsequences', boolArg(a.DX_TexturesSequences, false)], ['txtfiles', boolArg(a.DX_TexturesCopyTextures, false)], ['txtresizeX', intArg(a.DX_TexturesResizeX, 0)],
    ['txtresizeY', intArg(a.DX_TexturesResizeY, 0)], ['txtformat', intArg(a.DX_TexturesFormat, 0)], ['triangulate', boolArg(a.DX_OptionsTriangulate, false)],
    ['plot', boolArg(a.DX_OptionsPlotAnimation, false)],
    ['chains', intArg(a.DX_OptionsExportHiddenObjects, 0)],          // swapped in the binary
    ['ExportHidden', boolArg(a.DX_OptionsChains, false)],           // swapped in the binary
    ['CompressMesh', boolArg(a.DX_OptionsCompressMesh, true)],
  ];
  for (const [k, v] of map) setP(app, prop, k, v);
  const file = unset(a.DX_Filename) ? '' : String(a.DX_Filename);
  if (!file) { if (!inspectModal(app, C, prop)) return undefined; }
  else setP(app, prop, 'Filename', file);
  exportX(app, C, prop);
  return undefined;   // Init does not enable a return value; status always OK
}
function exportX(app: App, C: string, prop: Property) {
  const file = String(prop.val('Filename') ?? '');
  if (!file) return;
  // The export reads the parameter as "Triangulate" (capital T) while the property defines "triangulate"
  // (open question 4 of the note). Reproduced as read; this build's lookup for that name ignores case.
  const triangulate = !!paramCI(prop, 'Triangulate')?.value;
  const chains = Number(prop.val('chains')) || 0, hidden = !!prop.val('ExportHidden');
  const opts: Record<string, any> = {
    output_file_format_version: 300, animall: 1, tesselation: triangulate, animplot: !!prop.val('plot'), constraint: 0, fcurveKind: 20,
    interpolation: 3, envelope: 1, ik: chains !== 0, output_file_format: 1,
    textures: prop.val('Textures'), txtabsolute: prop.val('txtabsolute'), txtfiles: prop.val('txtfiles'), txtformat: prop.val('txtformat'),
    txtresizeX: prop.val('txtresizeX'), txtresizeY: prop.val('txtresizeY'), txtsequences: prop.val('txtsequences'), sceneroot: !hidden,
  };
  stateOf(app).dxExportOptions = opts;
  // Target: the scene root with ExportHidden, else the current selection (saved and restored around the call).
  const sel = [...app.selection];
  const targets: X3DObject[] = hidden ? [...app.scene.root.children] : sel.filter((n): n is X3DObject => n instanceof X3DObject);
  const tmp = tmpPath(file);
  let tmpOk = false;
  try { hostFs.writeFile(tmp, `dotXSI stand-in for ${targets.map(t => t.name).join(',')}\n`); tmpOk = true; } catch { tmpOk = false; }
  app.select(sel);
  if (!tmpOk) app.logMsg('error', 'Path error');
  else {
    if (!prop.val('CompressMesh')) logNya(app, C, 'the mesh pass run when CompressMesh is false');
    if (Number(prop.val('DXType'))) logNya(app, C, `DXType ${prop.val('DXType')} (inferred: binary .x); text written`);
    if (prop.val('Anim')) logNya(app, C, 'AnimationSet / AnimationKey output of the .x writer');
    const f = CFile.open(file, 'wb');
    if (!f) app.logMsg('error', 'Error creating/writing file... aborting export');
    else {
      const lines = ['xof 0303txt 0032', '', ...X_TEMPLATES, ...targets.flatMap(t => xFrame(t, triangulate, ''))];
      const s = lines.join('\n') + '\n';
      f.write(Uint8Array.from(s, ch => ch.charCodeAt(0) & 0xff)); f.close();
    }
  }
  if (tmpOk && !deleteFile(tmp)) app.logMsg('error', `Unable to delete temporary file: ${tmp}`);
}

// ------------------------------------------------------------------ DXImport
interface XFrame { name: string; matrix: number[] | null; mesh: { verts: number[][]; faces: number[][] } | null; children: XFrame[] }
function tokenize(s: string): string[] {
  const out: string[] = []; const re = /\/\/[^\n]*|#[^\n]*|<[^>]*>|"[^"]*"|[{};,]|[^\s{};,"<]+/g; let m;
  while ((m = re.exec(s))) { const t = m[0]; if (t.startsWith('//') || t.startsWith('#')) continue; out.push(t); }
  return out;
}
/** Frames of a text .x file (published format). Unnamed frames are named frame%d. */
function parseX(text: string, counter: { n: number }): XFrame[] | null {
  if (!/^xof \d{4}txt /.test(text)) return null;
  const t = tokenize(text.slice(16)); let i = 0;
  const skipBlock = () => { let depth = 0; while (i < t.length) { const x = t[i++]; if (x === '{') depth++; else if (x === '}' && --depth <= 0) return; } };
  const nums = (n: number): number[] => { const v: number[] = []; while (i < t.length && v.length < n) { const x = t[i++]; if (x === '}') { i--; break; } const k = Number(x); if (x !== ';' && x !== ',' && Number.isFinite(k)) v.push(k); } return v; };
  const mesh = (): XFrame['mesh'] => {
    if (t[i] !== '{') i++; i++;   // optional name, then '{'
    const nv = nums(1)[0] ?? 0; const verts: number[][] = []; for (let v = 0; v < nv; v++) verts.push(nums(3));
    const nf = nums(1)[0] ?? 0; const faces: number[][] = []; for (let q = 0; q < nf; q++) { const c = nums(1)[0] ?? 0; faces.push(nums(c)); }
    while (i < t.length && t[i] !== '}') { if (t[i] === '{') skipBlock(); else i++; }   // MeshNormals, MeshTextureCoords, ...: skipped
    i++;
    return { verts, faces };
  };
  const other = () => { while (i < t.length && t[i] !== '{') i++; skipBlock(); };
  const frame = (): XFrame => {
    let name = ''; if (t[i] !== '{') name = t[i++]; if (t[i] === '{') i++;
    const f: XFrame = { name: name || `frame${counter.n++}`, matrix: null, mesh: null, children: [] };
    while (i < t.length && t[i] !== '}') {
      const k = t[i];
      if (k === 'Frame') { i++; f.children.push(frame()); }
      else if (k === 'FrameTransformMatrix') { i++; while (t[i] !== '{') i++; i++; f.matrix = nums(16); while (i < t.length && t[i] !== '}') i++; i++; }
      else if (k === 'Mesh') { i++; f.mesh = mesh(); }
      else if (t[i + 1] === '{' || t[i + 2] === '{') other();
      else i++;
    }
    i++;
    return f;
  };
  const roots: XFrame[] = [];
  while (i < t.length) {
    if (t[i] === 'Frame') { i++; roots.push(frame()); }
    else if (t[i] === 'Mesh') { i++; roots.push({ name: `frame${counter.n++}`, matrix: null, mesh: mesh(), children: [] }); }   // inferred: a top-level mesh gets an unnamed frame
    else if (t[i] === 'template' || t[i + 1] === '{' || t[i + 2] === '{') other();
    else i++;
  }
  return roots;
}

function build(app: App, f: XFrame, parent: X3DObject): X3DObject {
  const o = f.mesh && f.mesh.faces.length ? meshObject(app, f.name, f.mesh.verts, f.mesh.faces) : new Null(app.scene.uniqueName(f.name));
  if (f.matrix && f.matrix.length === 16) {
    const M = new THREE.Matrix4().fromArray(f.matrix); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    M.decompose(p, q, s); const L = o.kinematics.local; const e = new THREE.Euler().setFromQuaternion(q, threeOrder(L.val('rotorder'))); const r = 180 / Math.PI;
    const vals: [string, number][] = [['posx', p.x], ['posy', p.y], ['posz', p.z], ['rotx', e.x * r], ['roty', e.y * r], ['rotz', e.z * r], ['sclx', s.x], ['scly', s.y], ['sclz', s.z]];
    for (const [k, v] of vals) L.set(k, v);
  }
  addObject(app, o, parent);
  for (const c of f.children) build(app, c, o);
  return o;
}

function dxImport(app: App, a: Record<string, any>) {
  const C = 'DXImport';
  const prop = rootProp(app, 'DXImportProperty', DX_IMPORT_DEFS);
  setP(app, prop, 'Anim', boolArg(a.DX_AnimationImport, true)); setP(app, prop, 'Textures', boolArg(a.DX_TexturesImport, true));
  setP(app, prop, 'InvertUV', boolArg(a.DX_OptionsInvertUVs, false)); setP(app, prop, 'Reorient', boolArg(a.DX_OptionsReorientScene, false));
  setP(app, prop, 'FrameOffset', intArg(a.DX_AnimationFrameOffset, 1));
  const file = unset(a.DX_Filename) ? '' : String(a.DX_Filename);
  if (!file) { if (!inspectModal(app, C, prop)) return undefined; }
  else setP(app, prop, 'Filename', file);
  importX(app, C, prop);
  return undefined;   // status always OK
}
function importX(app: App, C: string, prop: Property) {
  const file = String(prop.val('Filename') ?? '');
  if (!file) return;
  const f = CFile.open(narrow(file, 1024), 'rb');
  if (!f) { logNya(app, C, `the error reported for an unreadable .x file (${file})`); return; }
  const text = Array.from(f.data, b => String.fromCharCode(b)).join('');
  const roots = parseX(text, { n: 0 });
  if (!roots) { logNya(app, C, 'binary / compressed .x files, or a file without the xof text header'); return; }
  const tmp = tmpPath(file);
  try { hostFs.writeFile(tmp, `dotXSI stand-in: originator Softimage .X Importer\n`); }
  catch { app.logMsg('error', 'Error writing to intermediate scene in the directory specified'); return; }
  if (prop.val('Reorient')) logNya(app, C, 'Reorient Scene');
  if (prop.val('InvertUV')) logNya(app, C, 'Invert UVs (UV import)');
  if (prop.val('Anim')) logNya(app, C, 'animation import (AnimationSet) and FrameOffset');
  if (roots.length) app.logMsg('info', 'Frame template found');
  // SIImportDotXSIFile(tmp): the frames become objects under the scene root.
  const made = roots.map(r => build(app, r, app.scene.root));
  if (!deleteFile(tmp)) app.logMsg('error', `Unable to delete temporary file: ${tmp}`);
  stateOf(app).lastPut = { command: C, value: made };
}

// ------------------------------------------------------------------ ClearRealtimeShaderCache
function clearShaderCache(app: App) {
  const c = stateOf(app).shaderCache;
  // Under the cache lock: start if not started, shut down, delete the header and data files, start again.
  if (!c.started) { c.started = true; c.starts++; }
  c.started = false; c.shutdowns++;
  for (const p of [c.headerFile, c.dataFile]) if (p && isFile(p)) deleteFile(p);
  c.entries.clear();
  c.started = true; c.starts++;
  return undefined;   // no return value is put
}

export function registerPluginsB13eDxCommands(app: App) {
  app.register({
    name: 'DXExport', label: 'DXExport', category: 'Export', description: 'DirectX Export',
    args: [
      { name: 'DX_Filename', default: '' }, { name: 'DX_Format', default: 0 }, { name: 'DX_AnimationExport', default: true }, { name: 'DX_AnimationFrameOffset', default: 1 },
      { name: 'DX_AnimationType', default: 0 }, { name: 'DX_TexturesExport', default: true }, { name: 'DX_TexturesAbsolutePaths', default: false },
      { name: 'DX_TexturesSequences', default: false }, { name: 'DX_TexturesCopyTextures', default: false }, { name: 'DX_TexturesResizeX', default: 0 },
      { name: 'DX_TexturesResizeY', default: 0 }, { name: 'DX_TexturesFormat', default: 0 }, { name: 'DX_OptionsTriangulate', default: false },
      { name: 'DX_OptionsPlotAnimation', default: false }, { name: 'DX_OptionsExportHiddenObjects', default: 0 }, { name: 'DX_OptionsChains', default: false },
      { name: 'DX_OptionsCompressMesh', default: true },
    ],
    execute: dxExport,
  });
  app.register({
    name: 'DXImport', label: 'DXImport', category: 'Import', description: 'DirectX Import',
    args: [
      { name: 'DX_Filename', default: '' }, { name: 'DX_AnimationImport', default: true }, { name: 'DX_TexturesImport', default: true },
      { name: 'DX_OptionsInvertUVs', default: false }, { name: 'DX_OptionsReorientScene', default: false }, { name: 'DX_AnimationFrameOffset', default: 1 },
    ],
    execute: dxImport,
  });
  app.register({
    name: 'ClearRealtimeShaderCache', label: 'ClearRealtimeShaderCache', category: 'Rendering', description: 'Clear Realtime Shader Cache',
    args: [], undoable: false, execute: clearShaderCache,
  });
}
