// Ledger row CMD-B13e: shared state and helpers of the 22 small self-installing plug-in commands (PointOven MDD / LWO /
// scene / baker, CrowdFX FBX plotting, Ultimapper, ShapeWeight, HWParsers, DirectX .x, BoneCreateTool, polymatricks,
// FR ICE import). Brief: docs/ghidra/cmd-b13e-small-plugins-binary.md ("Shared facts" and "Contracts") and
// docs/re/WIRE_CORRECTIONS_B13.md. Original code written from that prose contract only; no XSIBATCH golden exists.
//
// How the contract is mapped onto this build:
//  * Failure HRESULTs are thrown as SiStatusError (message starts with the command name). The plug-ins' own log
//    lines are logged verbatim before the throw.
//  * Files live on the session's virtual host file system (src/core/sdkHelpersHostFs.ts, `app.hostFs`). It stores
//    text, so binary files (MDD, LWO2) are kept as one character per byte (code 0..255). C stdio open modes are
//    modelled: "rb" / "r+b" need an existing file, "wb" needs an existing folder and truncates.
//  * Commands whose return value is not enabled (WIRE_CORRECTIONS_B13: FindUltimapperDistance, GenerateUltimapper,
//    DXExport, BoneCreateTool_UpdateBone, Applypolymatricks) return nothing to the caller; a value the plug-in still
//    puts is kept in `app.pluginsB13e.lastPut` for inspection.
//  * Branches the analyst did not read log "<command>: not yet attested: <what> (CMD-B13e)".
import { App } from '../core/commands';
import { Node, X3DObject, Property, Operator, Primitive, makeDisplay, makeGeomApprox } from '../core/scene';
import { build, MeshData } from '../core/geometry';
import { hostFs } from '../core/sdkHelpersHostFs';
import { SiStatusError } from './alembicSeqCam';
import { findNode, unset } from './viewEditPropertyHelpers';
import { listOf } from './tasksB11cShared';
import { FrozenGeomOperator } from './model';

export { unset, listOf, hostFs, Node, X3DObject, Property, Operator };
export const NOTE = 'docs/ghidra/cmd-b13e-small-plugins-binary.md';
export const ROW = 'CMD-B13e';
export const S_OK = 0;
export const E_INVALIDARG = 0x80070057, E_FAIL = 0x80004005, E_ABORT = 0x80004004;

export interface BoneToolStandIn { currentBone: X3DObject | null; rootBone: X3DObject | null; rootPos: [number, number, number] }
export interface PluginsB13eState {
  /** Value a command put while its return value is not enabled. */
  lastPut: { command: string; value: any } | null;
  /** CrowdFX global export state (created on first use, freed by the shared _Term). */
  crowd: { listA: Node[]; listB: Node[]; mode: number; lastBegin: [Node[], Node[]] | null; exports: any[] } | null;
  /** HWParsers realtime-shader file cache stand-in. */
  shaderCache: { started: boolean; starts: number; shutdowns: number; headerFile: string; dataFile: string; entries: Map<string, string> };
  /** The live BoneCreateTool instance (plug-in global); null when the tool is not active. */
  boneTool: BoneToolStandIn | null;
  /** polymatricks plug-in global string list (filled from `stack`, cleared after the operator is created). */
  polymatricksStack: string[];
  /** fro_ShapeWeightOp / polymatricks operators created (in order). */
  operators: Operator[];
  /** dotXSIExportOptions values set by the last DXExport. */
  dxExportOptions: Record<string, any> | null;
  /** Progress bar captions shown (newest last). */
  progress: string[];
  /** Records of exports whose writer is not attested (FBX crowd export). */
  hooks: {
    /** File dialog: return a path, or null for Cancel. Without a hook the dialog is logged and cancelled. */
    fileDialog?: (command: string, title: string, filter: string) => string | null | undefined;
    /** Modal InspectObj: return true for OK. Without a hook it is logged and cancelled. */
    inspect?: (command: string, prop: Property) => boolean | undefined;
    /** Ultimapper depth map: channel-0 values of every pixel of the rendered depth map (the RenderMap is not attested). */
    depthMap?: (lowRes: X3DObject, highRes: X3DObject, prop: Property) => ArrayLike<number> | null | undefined;
  };
}

export function stateOf(app: App): PluginsB13eState {
  const a: any = app;
  if (a.pluginsB13e) return a.pluginsB13e;
  const st: PluginsB13eState = {
    lastPut: null, crowd: null,
    shaderCache: { started: false, starts: 0, shutdowns: 0, headerFile: '', dataFile: '', entries: new Map() },
    boneTool: null, polymatricksStack: [], operators: [], dxExportOptions: null, progress: [], hooks: {},
  };
  a.pluginsB13e = st;
  return st;
}

// ------------------------------------------------------------------ status, errors, log
export const fail = (status: number, what: string) => new SiStatusError(status, what);
/** Log the plug-in's own error line, then fail with `status`. */
export function failLog(app: App, command: string, status: number, text: string): SiStatusError {
  app.logMsg('error', text);
  return fail(status, `${command}: ${text}`);
}
export function logNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${ROW})`); }
export function put(app: App, command: string, value: any) { stateOf(app).lastPut = { command, value }; }
export function progress(app: App, caption: string) { stateOf(app).progress.push(caption); app.logMsg('info', caption); }

// ------------------------------------------------------------------ arguments
/** Character-by-character narrowing into a fixed C buffer: each UTF-16 unit keeps its low byte, the text is cut to
 *  size-1 characters (the terminating zero). */
export function narrow(v: any, size: number): string {
  const s = unset(v) ? '' : String(v);
  let out = ''; for (let i = 0; i < s.length && i < size - 1; i++) out += String.fromCharCode(s.charCodeAt(i) & 0xff);
  return out;
}
export function numArg(v: any, dflt: number): number { if (unset(v)) return dflt; const n = Number(v); return Number.isFinite(n) ? n : dflt; }
/** C conversion of a variant to int (truncation toward zero). */
export const intArg = (v: any, dflt = 0) => Math.trunc(numArg(v, dflt));
export function boolArg(v: any, dflt: boolean): boolean {
  if (unset(v)) return dflt;
  if (typeof v === 'string') return !/^(false|0|no)$/i.test(v.trim());
  return !!v;
}
/** An array argument (a JS array, a typed array, or a single value). */
export function arrayArg(v: any): any[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v;
  if (ArrayBuffer.isView(v)) return Array.from(v as any);
  if (typeof v === 'object' && typeof (v as any).toArray === 'function') return (v as any).toArray();
  return [v];
}
export const resolve = (app: App, x: any): Node | null => findNode(app, x) ?? null;
export function objArg(app: App, v: any): X3DObject | null { const n = resolve(app, v); return n instanceof X3DObject ? n : null; }
export function nodesArg(app: App, v: any): Node[] {
  const out: Node[] = [];
  for (const x of listOf(v)) { const n = resolve(app, x); if (n && !out.includes(n)) out.push(n); }
  return out;
}

// ------------------------------------------------------------------ binary files on the virtual host file system
const bytesToStr = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const strToBytes = (s: string) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
export function isFile(path: string): boolean { try { return !!path && hostFs.isFile(path); } catch { return false; } }
export function isFolder(path: string): boolean { try { return !!path && hostFs.isFolder(path.replace(/[\\/]+$/, '') || path); } catch { return false; } }
export function parentPath(path: string): string { try { return hostFs.parentPath(path); } catch { return ''; } }
export function readBytes(path: string): Uint8Array { return strToBytes(hostFs.readFile(path)); }
export function writeBytes(path: string, b: Uint8Array) { hostFs.writeFile(path, bytesToStr(b)); }
export function deleteFile(path: string): boolean { try { hostFs.deleteFile(path); return true; } catch { return false; } }

/** A C stdio stream over a virtual file: open modes "rb", "wb", "r+b"; null when fopen fails. */
export class CFile {
  private constructor(readonly path: string, public data: Uint8Array, readonly writable: boolean, public pos = 0) {}
  static open(path: string, mode: 'rb' | 'wb' | 'r+b'): CFile | null {
    try {
      if (!path) return null;
      if (mode === 'wb') {
        const dir = hostFs.parentPath(path); if (!dir || !hostFs.isFolder(dir) || hostFs.isFolder(path)) return null;
        writeBytes(path, new Uint8Array(0)); return new CFile(path, new Uint8Array(0), true);
      }
      if (!hostFs.isFile(path)) return null;
      return new CFile(path, readBytes(path), mode === 'r+b');
    } catch { return null; }
  }
  seek(p: number) { this.pos = p; }
  /** fread of n bytes; fewer when the end of the file is reached. */
  read(n: number): Uint8Array { const b = this.data.slice(this.pos, this.pos + n); this.pos += b.length; return b; }
  write(b: Uint8Array) {
    const end = this.pos + b.length;
    if (end > this.data.length) { const g = new Uint8Array(end); g.set(this.data); this.data = g; }   // writing past the end extends (zeros between)
    this.data.set(b, this.pos); this.pos = end;
  }
  readI32BE(): number | null { const b = this.read(4); return b.length < 4 ? null : new DataView(b.buffer).getInt32(0, false); }
  readF32BE(): number | null { const b = this.read(4); return b.length < 4 ? null : new DataView(b.buffer).getFloat32(0, false); }
  writeI32BE(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v | 0, false); this.write(b); }
  writeF32BE(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, false); this.write(b); }
  close() { if (this.writable) writeBytes(this.path, this.data); }
}

/** Big-endian byte builder (IFF / MDD writers). */
export class BEWriter {
  private parts: number[] = [];
  get length() { return this.parts.length; }
  u8(v: number) { this.parts.push(v & 0xff); return this; }
  u16(v: number) { return this.u8(v >> 8).u8(v); }
  u32(v: number) { return this.u8(v >>> 24).u8(v >>> 16).u8(v >>> 8).u8(v); }
  i32(v: number) { return this.u32(v >>> 0); }
  f32(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, false); b.forEach(x => this.u8(x)); return this; }
  id4(s: string) { for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i) || 0x20); return this; }
  bytes(b: ArrayLike<number>) { for (let i = 0; i < b.length; i++) this.u8(b[i]); return this; }
  toBytes() { return Uint8Array.from(this.parts); }
}

// ------------------------------------------------------------------ objects
/** Undoable addition of an object under a parent (the scene root by default). */
export function addObject(app: App, obj: X3DObject, parent?: X3DObject | null) {
  const p = parent ?? app.scene.root;
  app.record('Add ' + obj.name, () => p.addChild(obj), () => p.removeChild(obj));
  return obj;
}
/** A polygon mesh object holding fixed geometry. */
export function meshObject(app: App, name: string, verts: number[][], faces: number[][]): X3DObject {
  const obj = new X3DObject(app.scene.uniqueName(name), 'polymsh');
  const prim = new Primitive('Polygon Mesh', 'polymsh');
  prim.addOperator(new FrozenGeomOperator(build(verts, faces), 'Geometry')); obj.setPrimitive(prim);
  obj.addProperty(makeDisplay()); obj.addProperty(makeGeomApprox());
  return obj;
}
export const meshOf = (o: X3DObject): MeshData | null => o.primitive?.mesh() ?? null;
/** Undoable addition of a property. */
export function addProperty(app: App, owner: X3DObject, p: Property) {
  app.record('AddProp', () => owner.addProperty(p), () => owner.removeProperty(p));
  return p;
}
export const propNamed = (o: X3DObject, name: string) => o.properties.find(p => p.name.toLowerCase() === name.toLowerCase());
