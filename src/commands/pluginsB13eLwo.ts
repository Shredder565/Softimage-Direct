// Ledger row CMD-B13e, part 3: PointOven import / export / baker (PO_XSI_ImportLWO.64.dll, PO_XSI_ExportLWO.64.dll,
// PO_XSI_Baker.64.dll).
//   PO_XSI_ImportLWO XSI_Import_POScene PO_XSI_ExportLWO PO_XSI_Baker
// Brief: docs/ghidra/cmd-b13e-small-plugins-binary.md, sections 2.2 (MDD), 2.5 (LWO2) and 3. Original code from that
// prose. The LWO2 chunk bodies follow the published LightWave Object File Format 2 (LWO2) specification (NewTek,
// "LWO2 object file format", lightwave SDK docs): IFF FORM, S0 strings padded to even length, VX indices, sub-chunk
// headers with a U2 size. Points are written as stored (no handedness change: open question to the analyst).
import { App } from '../core/commands';
import { Cluster, Null, Camera, Light, Material } from '../core/scene';
import {
  stateOf, fail, failLog, logNya, progress, narrow, numArg, intArg, boolArg, unset, resolve, CFile, BEWriter,
  isFolder, isFile, parentPath, addObject, meshObject, meshOf,
  E_FAIL, E_INVALIDARG, X3DObject,
} from './pluginsB13eShared';
import { mddBytes } from './pluginsB13eMdd';

// ------------------------------------------------------------------ LWO2 writer
const s0 = (w: BEWriter, s: string) => { for (let i = 0; i < s.length; i++) w.u8(s.charCodeAt(i) & 0xff); w.u8(0); if ((s.length + 1) & 1) w.u8(0); };
const vx = (w: BEWriter, i: number) => { if (i < 0xff00) w.u16(i); else w.u32((0xff000000 | i) >>> 0); };
const chunk = (out: BEWriter, tag: string, body: BEWriter) => { out.id4(tag).u32(body.length).bytes(body.toBytes()); if (body.length & 1) out.u8(0); };
const sub = (out: BEWriter, tag: string, body: BEWriter) => { out.id4(tag).u16(body.length).bytes(body.toBytes()); };

export interface LwoLayer { name: string; points: number[][]; polys: number[][]; surf: string[] }
interface LwoSurface { name: string; color: [number, number, number] }

/** The surface (material) of an object as gathered by the exporter: the diffuse colour of the Phong / Lambert / Blinn /
 *  Cook-Torrance / Strauss surface shader, the colour of a Constant one. */
function surfaceOf(app: App, o: X3DObject): LwoSurface {
  const m: Material | null = o.material ?? app.scene.root.material;
  const sh = m?.surface; const t = String(sh?.type ?? '').toLowerCase();
  let c: any = null;
  if (/phong|lambert|blinn|cooktorr|strauss/.test(t)) c = sh!.val('diffuse');
  else if (/constant/.test(t)) c = sh!.val('color');
  const col = (Array.isArray(c) ? c.slice(0, 3) : [0.7, 0.7, 0.7]).map(Number) as [number, number, number];
  return { name: m?.name ?? 'Default', color: col };
}

export function lwo2Bytes(layers: LwoLayer[], surfaces: LwoSurface[]): Uint8Array {
  const body = new BEWriter(); body.id4('LWO2');
  const tags = surfaces.map(s => s.name);
  { const t = new BEWriter(); for (const s of tags) s0(t, s); chunk(body, 'TAGS', t); }
  layers.forEach((L, li) => {
    { const w = new BEWriter(); w.u16(li).u16(0).f32(0).f32(0).f32(0); s0(w, L.name); chunk(body, 'LAYR', w); }
    { const w = new BEWriter(); for (const p of L.points) w.f32(p[0]).f32(p[1]).f32(p[2]); chunk(body, 'PNTS', w); }
    { const w = new BEWriter(); w.id4('FACE'); for (const f of L.polys) { w.u16(f.length & 0x3ff); for (const i of f) vx(w, i); } chunk(body, 'POLS', w); }
    { const w = new BEWriter(); w.id4('SURF'); L.polys.forEach((_, pi) => { vx(w, pi); w.u16(Math.max(0, tags.indexOf(L.surf[pi]))); }); chunk(body, 'PTAG', w); }
  });
  for (const s of surfaces) {
    const w = new BEWriter(); s0(w, s.name); s0(w, '');
    { const c = new BEWriter(); c.f32(s.color[0]).f32(s.color[1]).f32(s.color[2]); vx(c, 0); sub(w, 'COLR', c); }
    { const c = new BEWriter(); c.f32(1); vx(c, 0); sub(w, 'DIFF', c); }   // inferred: intensity 1 (writer body unread)
    { const c = new BEWriter(); c.f32(0); vx(c, 0); sub(w, 'SPEC', c); }   // inferred: 0
    chunk(body, 'SURF', w);
  }
  const out = new BEWriter(); out.id4('FORM').u32(body.length).bytes(body.toBytes());
  return out.toBytes();
}

// ------------------------------------------------------------------ LWO2 reader
export interface LwoRead { layers: LwoLayer[]; tags: string[]; uvMaps: string[]; morphs: string[]; weightMaps: string[] }
class Cursor {
  constructor(readonly d: DataView, public p: number, readonly end: number) {}
  get more() { return this.p < this.end; }
  u16() { const v = this.d.getUint16(this.p, false); this.p += 2; return v; }
  u32() { const v = this.d.getUint32(this.p, false); this.p += 4; return v; }
  f32() { const v = this.d.getFloat32(this.p, false); this.p += 4; return v; }
  id4() { let s = ''; for (let i = 0; i < 4; i++) s += String.fromCharCode(this.d.getUint8(this.p + i)); this.p += 4; return s; }
  vx() { const b = this.d.getUint8(this.p); if (b === 0xff) return this.u32() & 0x00ffffff; return this.u16(); }
  s0() { let s = ''; let c; while (this.p < this.end && (c = this.d.getUint8(this.p++)) !== 0) s += String.fromCharCode(c); if ((s.length + 1) & 1) this.p++; return s; }
}
type LwoError = 'open' | 'iff' | 'lwo2' | 'smallpoly';
export function readLwo2(bytes: Uint8Array): LwoRead | LwoError {
  if (bytes.length < 12) return 'iff';
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const c0 = new Cursor(d, 0, bytes.length);
  if (c0.id4() !== 'FORM') return 'iff';
  const formEnd = Math.min(bytes.length, 8 + c0.u32());
  if (c0.id4() !== 'LWO2') return 'lwo2';
  const res: LwoRead = { layers: [], tags: [], uvMaps: [], morphs: [], weightMaps: [] };
  const walk = (fn: (tag: string, c: Cursor) => void) => {
    let p = 12;
    while (p + 8 <= formEnd) {
      const h = new Cursor(d, p, formEnd); const tag = h.id4(); const size = h.u32();
      fn(tag, new Cursor(d, p + 8, Math.min(formEnd, p + 8 + size)));
      p += 8 + size;   // as read: no IFF even-byte padding is added (inferred quirk of the walker)
    }
  };
  // Pass 1: LAYR (each LAYR after the first starts a new layer), PNTS, POLS.
  const st: { cur: LwoLayer | null; seen: boolean; bad: boolean } = { cur: null, seen: false, bad: false };
  const layer = (): LwoLayer => {
    if (st.cur) return st.cur;
    const L: LwoLayer = { name: `Layer_${res.layers.length + 1}`, points: [], polys: [], surf: [] };
    res.layers.push(L); st.cur = L; return L;
  };
  walk((tag, c) => {
    if (tag === 'LAYR') { if (st.seen) st.cur = null; st.seen = true; const L = layer(); c.u16(); c.u16(); c.f32(); c.f32(); c.f32(); if (c.more) { const n = c.s0(); if (n) L.name = n; } }
    else if (tag === 'PNTS') { const L = layer(); while (c.p + 12 <= c.end) L.points.push([c.f32(), c.f32(), c.f32()]); }
    else if (tag === 'POLS') {
      const L = layer(); const type = c.id4(); if (type !== 'FACE') return;
      while (c.more) { const n = c.u16() & 0x3ff; const f: number[] = []; for (let i = 0; i < n; i++) f.push(c.vx()); if (n < 3) st.bad = true; L.polys.push(f); L.surf.push(''); }
    }
  });
  if (st.bad) return 'smallpoly';
  // Pass 2: LAYR, PTAG, VMAD, VMAP (TAGS read here too, inferred: the surface names live there).
  let li = -1;
  walk((tag, c) => {
    if (tag === 'TAGS') { while (c.more) res.tags.push(c.s0()); }
    else if (tag === 'LAYR') li++;
    else if (tag === 'PTAG') {
      const L = res.layers[Math.max(0, li)]; if (!L) return; const type = c.id4(); if (type !== 'SURF') return;
      while (c.more) { const pi = c.vx(); const t = c.u16(); if (pi < L.surf.length) L.surf[pi] = res.tags[t] ?? ''; }
    } else if (tag === 'VMAP' || tag === 'VMAD') {
      const type = c.id4(); c.u16(); const name = c.s0();
      if (type === 'TXUV') res.uvMaps.push(name); else if (type === 'MORF' || type === 'SPOT') res.morphs.push(name); else if (type === 'WGHT') res.weightMaps.push(name);
    }
  });
  return res;
}

// ------------------------------------------------------------------ PO_XSI_ImportLWO
export function importLwo(app: App, a: Record<string, any>) {
  const C = 'PO_XSI_ImportLWO';
  const file = narrow(a.FileName, 512).replace(/\\/g, '/');
  progress(app, 'Point Oven Import LWO....');
  const f = CFile.open(file, 'rb');
  if (!f) throw failLog(app, C, E_FAIL, 'POXSI_LWOImport. Error, cannot open file');
  const r = readLwo2(f.data);
  if (r === 'iff') throw failLog(app, C, E_FAIL, 'POXSI_LWOImport. Error, bad header, not IFF');
  if (r === 'lwo2') throw failLog(app, C, E_FAIL, 'POXSI_LWOImport. Error, bad header, not LWO2');
  if (r === 'smallpoly') throw failLog(app, C, E_FAIL, 'POXSI_LWOImport. Error, 1 or 2 point polygons found, please remove them in LW');
  if (typeof r === 'string') throw fail(E_FAIL, `${C}: ${r}`);
  const scale = numArg(a.Scale, 1);
  const out: X3DObject[] = [];
  r.layers.forEach((L, li) => {
    // inferred: %i is the 0-based layer index (builder unread; open question to the analyst)
    const o = meshObject(app, `Layer_${li}`, L.points.map(p => [p[0] * scale, p[1] * scale, p[2] * scale]), L.polys);
    addObject(app, o);
    if (intArg(a.Import_Surfaces, 0)) {
      for (const tag of [...new Set(L.surf.filter(Boolean))]) {
        const c = new Cluster(tag, 'poly', new Set(L.surf.map((s, i) => s === tag ? i : -1).filter(i => i >= 0)));
        app.record('CreateCluster', () => o.addCluster(c), () => o.removeCluster(c));
      }
      if (L.surf.some(Boolean)) logNya(app, C, 'the %s_Phong / %s_Material surface materials of the polygon clusters');
    }
    out.push(o);
  });
  if (intArg(a.Import_UVs, 0) && r.uvMaps.length) logNya(app, C, `UV maps (${r.uvMaps.join(', ')}) as %s_UVMaps texture projections`);
  if (intArg(a.Weights, 0) && r.weightMaps.length) logNya(app, C, `weight maps (${r.weightMaps.join(', ')}) as %s_WeightMaps`);
  if ((intArg(a.Import_Morphs, 0) || intArg(a.Import_Morphs_to_Mixer, 0)) && r.morphs.length) logNya(app, C, `morphs (${r.morphs.join(', ')}) as %sShapeKeys / mixer clips`);
  return out;
}

// ------------------------------------------------------------------ XSI_Import_POScene
function importPoScene(app: App, a: Record<string, any>) {
  const C = 'XSI_Import_POScene';
  const file = narrow(a.File, 256);
  const search = [a.SearchPath1, a.SearchPath2, a.SearchPath3, a.SearchPath4].map(s => narrow(s, 255));
  const f = CFile.open(file, 'rb');
  if (!f) throw fail(E_INVALIDARG, `${C}: cannot open ${file || '(no file)'}`);   // silent: no log line of its own
  progress(app, 'Point Oven Import PO Scene....');
  logNya(app, C, `the PO scene reader and builder (scene file grammar); search paths ${JSON.stringify(search)}`);
  return [];
}

// ------------------------------------------------------------------ PO_XSI_ExportLWO
function exportLwo(app: App, a: Record<string, any>) {
  const C = 'PO_XSI_ExportLWO';
  const file = narrow(a.FileName, 256).replace(/\\/g, '/');
  const f = CFile.open(file, 'wb');
  if (!f) throw failLog(app, C, E_INVALIDARG, `POXSI_LWOExport. Error, cannot open file: ${file}`);
  const names = unset(a.Objects) ? [] : String(a.Objects).split(',');
  progress(app, 'Point Oven Export LWO....Getting Data...');
  const layers: LwoLayer[] = [], surfaces: LwoSurface[] = [];
  for (const n of names) {
    const o = resolve(app, n.trim()); if (!(o instanceof X3DObject)) continue;
    const m = meshOf(o); if (!m) continue;
    const s = surfaceOf(app, o); if (!surfaces.some(x => x.name === s.name)) surfaces.push(s);
    const pts: number[][] = []; for (let i = 0; i < m.positions.length; i += 3) pts.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
    layers.push({ name: o.name, points: pts, polys: m.polygons.map(p => [...p]), surf: m.polygons.map(() => s.name) });   // inferred: one layer per object
  }
  progress(app, 'Point Oven Export LWO....Writing Data...');
  f.write(lwo2Bytes(layers, surfaces)); f.close();
  logNya(app, C, 'UV (VMAP TXUV from uvspace) and VMAD data: this build keeps no UV sets on meshes');
  return undefined;   // return value enabled, nothing put
}

// ------------------------------------------------------------------ PO_XSI_Baker
const BAKER_ARGS = ['PO_ObjString', 'PO_FilePath', 'PO_StartFrame', 'PO_EndFrame', 'PO_ObjPreFix', 'PO_MDDAct', 'PO_LWOAct', 'PO_LWOString', 'PO_EMDLAct',
  'PO_EMDLString', 'PO_LWSAct', 'PO_LWSString', 'PO_MELAct', 'PO_MELString', 'PO_FXSAct', 'PO_FXSString', 'PO_XSIAct', 'PO_XSIString', 'PO_MAXAct',
  'PO_MAXString', 'PO_MOTAct', 'PO_MOTSep', 'PO_MOTString', 'PO_CAMAct', 'PO_LIGHTAct', 'PO_NULLAct', 'PO_OBJECTAct', 'PO_LOCALSPACE'];
const PATH_CHECKS: [string, string, 'dir' | 'file', string][] = [
  ['PO_MDDAct', 'PO_FilePath', 'dir', 'MDD'], ['PO_LWOAct', 'PO_LWOString', 'dir', 'LWO'], ['PO_EMDLAct', 'PO_EMDLString', 'dir', 'EMDL'],
  ['PO_LWSAct', 'PO_LWSString', 'file', 'LWS'], ['PO_MELAct', 'PO_MELString', 'file', 'MEL'], ['PO_FXSAct', 'PO_FXSString', 'file', 'FXS'],
  ['PO_XSIAct', 'PO_XSIString', 'dir', 'XSI'], ['PO_MAXAct', 'PO_MAXString', 'file', 'PSC'], ['PO_MOTSep', 'PO_MOTString', 'dir', 'MOT'],
];
/** A writable directory (a trailing slash is ignored); the virtual file system has no read-only entries. */
const dirOk = (p: string) => !!p && isFolder(p.replace(/[\\/]+$/, ''));
/** A file path: not an existing directory; an existing file must be writable; otherwise its parent must be a directory. */
const fileOk = (p: string) => !!p && !isFolder(p) && (isFile(p) || dirOk(parentPath(p)));

function baker(app: App, a: Record<string, any>) {
  const C = 'PO_XSI_Baker';
  const on = (k: string) => boolArg(a[k], false);
  for (const [flag, arg, kind, label] of PATH_CHECKS) {
    if (!on(flag)) continue;
    const p = unset(a[arg]) ? '' : String(a[arg]);
    if (!(kind === 'dir' ? dirOk(p) : fileOk(p))) {
      logNya(app, C, 'the exact wording of the path error after the label');
      throw failLog(app, C, E_INVALIDARG, `PO_XSI_Baker - The ${label} path is not valid: ${p}`);
    }
  }
  const objs = (unset(a.PO_ObjString) ? [] : String(a.PO_ObjString).split(',')).map(n => resolve(app, n.trim())).filter((o): o is X3DObject => o instanceof X3DObject);
  const meshes = objs.filter(o => !!meshOf(o)), nulls = objs.filter(o => o instanceof Null), cams = objs.filter(o => o instanceof Camera), lights = objs.filter(o => o instanceof Light);
  const start = intArg(a.PO_StartFrame, 0), end = intArg(a.PO_EndFrame, 0); const n = end - start + 1;
  if (on('PO_MOTAct')) logNya(app, C, `per-frame motion buffers (objects ${on('PO_OBJECTAct')}, cameras ${on('PO_CAMAct')}, lights ${on('PO_LIGHTAct')}, nulls ${on('PO_NULLAct')}; ${nulls.length + cams.length + lights.length} resolved)`);
  // Sample all frames.
  const local = on('PO_LOCALSPACE');
  const samples = new Map<X3DObject, Float32Array[]>();
  const f0 = app.anim.frame;
  try {
    for (let k = 0; k < Math.max(0, n); k++) {
      if (meshes.length) app.anim.frame = start + k;
      for (const o of meshes) {
        const m = meshOf(o)!; const pts = new Float32Array(m.positions);
        if (!local) { const e = o.globalMatrix().elements; for (let i = 0; i < pts.length; i += 3) { const x = pts[i], y = pts[i + 1], z = pts[i + 2]; pts[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; pts[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pts[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; } }
        (samples.get(o) ?? (samples.set(o, []), samples.get(o)!)).push(pts);
      }
    }
  } finally { if (app.anim.frame !== f0) app.anim.frame = f0; }
  if (on('PO_LWOAct')) logNya(app, C, 'the LWO writer of the baker');
  if (on('PO_EMDLAct')) logNya(app, C, 'the EMDL writer');
  if (on('PO_MDDAct')) {
    const dir = String(a.PO_FilePath ?? ''); const prefix = unset(a.PO_ObjPreFix) ? '' : String(a.PO_ObjPreFix);
    const times: number[] = []; for (let fr = start; fr <= end; fr++) times.push(fr / app.anim.fps);
    for (const o of meshes) {
      const path = `${dir}/${prefix}${o.name}.mdd`;
      const fh = CFile.open(path, 'wb');
      if (!fh) throw failLog(app, C, E_INVALIDARG, `PO_XSI_Baker - The MDD file cannot be created. Make sure the file name and prefix are valid: ${path}`);
      const frames = samples.get(o) ?? [];
      fh.write(mddBytes(times, frames, (frames[0]?.length ?? meshOf(o)!.positions.length) / 3)); fh.close();
    }
  }
  progress(app, 'Point Oven Export Processing....');
  if (on('PO_LWSAct')) logNya(app, C, 'the LWS scene writer');
  if (on('PO_FXSAct')) logNya(app, C, 'the FXS writer');
  if (on('PO_MAXAct')) logNya(app, C, 'the 3ds Max .psc writer');
  if (on('PO_MELAct')) logNya(app, C, 'the MEL writer');
  if (on('PO_MOTAct') && on('PO_MOTSep')) logNya(app, C, 'the MOT writer');
  // PO_XSIAct only validates its path (no writer is called).
  stateOf(app).lastPut = null;
  return undefined;
}

export function registerPluginsB13eLwoCommands(app: App) {
  const cat = 'Custom';
  app.register({
    name: 'PO_XSI_ImportLWO', label: 'PO_XSI_ImportLWO', category: cat, description: 'Point Oven: imports a LightWave LWO2 object.',
    args: ['FileName', 'Import_Morphs', 'Import_Morphs_to_Mixer', 'Import_UVs', 'Import_Surfaces', 'Weights', 'Scale'].map(name => ({ name, default: null })),
    execute: importLwo,
  });
  app.register({
    name: 'XSI_Import_POScene', label: 'XSI_Import_POScene', category: cat, description: 'Point Oven: imports a PO scene file.',
    args: ['File', 'SearchPath1', 'SearchPath2', 'SearchPath3', 'SearchPath4'].map(name => ({ name, default: null })),
    execute: importPoScene,
  });
  app.register({
    name: 'PO_XSI_ExportLWO', label: 'PO_XSI_ExportLWO', category: cat, description: 'Point Oven: exports objects to one LightWave LWO2 file.',
    args: [{ name: 'Objects', default: null }, { name: 'FileName', default: null }], undoable: false, execute: exportLwo,
  });
  app.register({
    name: 'PO_XSI_Baker', label: 'PO_XSI_Baker', category: cat, description: 'Point Oven: bakes objects to MDD / LWO / scene files.',
    args: BAKER_ARGS.map(name => ({ name, default: null })), undoable: false, execute: baker,
  });
}
