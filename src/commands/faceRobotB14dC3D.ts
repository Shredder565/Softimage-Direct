// Ledger row CMD-B14d (Face Robot mocap): the C3D / face-map commands fr_LoadC3D, fr_WriteC3D, fr_C3DDebugFace,
// fr_C3DToFaceRobot and fr_CreateFaceMap, plus the C3D reader / in-place writer of docs/ghidra/cmd-b14d-fr-retarget-mocap.md
// §2.4 and the name-file / face-map keywords of §2.5. Original code written from that prose; no XSIBATCH golden exists.
//
// File formats:
//  * C3D: the byte layout of §2.4 (header block, parameter records, point data), int16 always little-endian, the DEC
//    float conversion for processor type 85. Files live on the virtual host file system (one character per byte).
//  * Name file (§2.5): whitespace tokens `GlobalMotion [{] n1 n2 n3 [n4 n5 n6] }` and `Mapping [{] <marker> <frName> ... }`.
//  * `.fmap`: only its keywords are attested (Q4). This build writes and reads its own token layout: `FaceMap1.2`, three
//    4x4 transforms (16 numbers each), one vector, then `<label> <node> <x> <y> <z>` entries and `EndMapping`.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Model, Property, makePhong } from '../core/scene';
import { str } from '../core/params';
import {
  frState, frStore, faceModel, findByName, isFile, readBytes, writeBytes, hostFs, meshObject, addObject, addProperty, propNamed,
  ensureGroup, addToGroup, progress, frWarn, unset, boolArg,
} from './faceRobotB14Shared';
import {
  CAT, de, nyaD, wrap, deleteNode, userDataBlob, globalPos, locText, retargetBlob, retargetData, RETARGET_BLOB, setStatus,
} from './faceRobotB14deShared';

const sArg = (v: any) => (unset(v) ? '' : String(v));

// ================================================================== C3D codec (§2.4)
export interface C3DParam { group: string; name: string; type: number; dims: number[]; data: Uint8Array }
export interface C3DData {
  P: number; F: number; rawF: number; firstFrame: number; lastFrame: number; scale: number; rate: number; proc: number;
  paramBlock: number; dataBlock: number; labels: string[]; units: string | null; params: Map<string, C3DParam>;
  /** Point data after the axis conversion, the drop and the gap fill: F arrays of P*3 values. */
  frames: Float64Array[];
  /** Frames dropped at the start (k + 1, see §2.4 Validity); stored for the writer. */
  drop: number;
}

function decFloat(dv: DataView, off: number): number {
  const b = new Uint8Array([dv.getUint8(off + 2), dv.getUint8(off + 3), dv.getUint8(off), dv.getUint8(off + 1)]);
  return new DataView(b.buffer).getFloat32(0, true) * 0.25;
}
function decBytes(v: number): Uint8Array {
  const t = new Uint8Array(4); new DataView(t.buffer).setFloat32(0, v / 0.25, true);
  return new Uint8Array([t[2], t[3], t[0], t[1]]);
}
const readF = (dv: DataView, off: number, proc: number) => (proc === 85 ? decFloat(dv, off) : dv.getFloat32(off, true));

/** Axis conversion: 0 = +90 deg about Z then +90 deg about Y; 2 = -90 deg about X then -90 deg about Y; 1 = none.
 *  Quarter turns are exact axis permutations: mode 0 maps (x, y, z) to (z, x, y), mode 2 to (y, z, x). */
export function convertAxis(v: [number, number, number], mode: number): [number, number, number] {
  if (mode === 0) return [v[2], v[0], v[1]];
  if (mode === 2) return [v[1], v[2], v[0]];
  return [v[0], v[1], v[2]];
}
/** The inverse of axis mode 2 used by fr_WriteC3D: +90 deg about Y, then +90 deg about X: (a, b, c) -> (c, a, b). */
export function unconvertAxis2(v: [number, number, number]): [number, number, number] { return [v[2], v[0], v[1]]; }

function strings(p: C3DParam | undefined): string[] {
  if (!p || p.type !== -1) return [];
  const len = p.dims[0] ?? p.data.length; const count = p.dims.length > 1 ? p.dims.slice(1).reduce((a, b) => a * b, 1) : 1;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let s = ''; for (let j = 0; j < len; j++) s += String.fromCharCode(p.data[i * len + j] ?? 32);
    out.push(s.replace(/\s+$/, '').split(':').join('_'));
  }
  return out;
}

/** Parse header + parameter section. Null when the file is too short to hold them. */
function parseHead(b: Uint8Array) {
  if (b.length < 512) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const paramBlock = b[0];
  const P = dv.getInt16(2, true), firstFrame = dv.getInt16(6, true), lastFrame = dv.getInt16(8, true);
  const dataBlock = dv.getInt16(16, true);
  for (let i = 0; i < 5; i++) dv.getInt16(294 + 2 * i, true);   // words 148-152: read, ignored
  const ps = (paramBlock - 1) * 512; if (ps < 0 || ps + 4 > b.length) return null;
  const proc = b[ps + 3];
  const scale = readF(dv, 12, proc), rate = readF(dv, 20, proc);   // header floats converted again once the type is known
  const groups = new Map<number, string>(); const raw: { gid: number; name: string; type: number; dims: number[]; data: Uint8Array }[] = [];
  let pos = ps + 4;
  while (pos + 2 <= b.length) {
    const n = dv.getInt8(pos); if (n === 0) break;
    const len = Math.abs(n); const gid = dv.getInt8(pos + 1);
    let name = ''; for (let i = 0; i < len; i++) name += String.fromCharCode(b[pos + 2 + i]);
    if (pos + 4 + len > b.length) break;
    const next = dv.getInt16(pos + 2 + len, true); let q = pos + 4 + len;
    if (gid < 0) { const dl = b[q]; q += 1 + dl; groups.set(-gid, name.toUpperCase()); }
    else {
      const type = dv.getInt8(q); const nd = b[q + 1]; const dims: number[] = []; for (let i = 0; i < nd; i++) dims.push(b[q + 2 + i]);
      q += 2 + nd; const size = Math.abs(type) * dims.reduce((a, c) => a * c, 1);
      raw.push({ gid, name: name.toUpperCase(), type, dims, data: b.slice(q, q + size) }); q += size;
      const dl = b[q] ?? 0; q += 1 + dl;
    }
    pos = q;                                  // the offset word is not used to seek
    if (next === 0) break;
  }
  const params = new Map<string, C3DParam>();
  for (const r of raw) { const g = groups.get(r.gid) ?? String(r.gid); params.set(`${g}:${r.name}`, { group: g, name: r.name, type: r.type, dims: r.dims, data: r.data }); }
  return { dv, P, firstFrame, lastFrame, rawF: lastFrame - firstFrame + 1, scale, rate, proc, paramBlock, dataBlock, params };
}

/** The C3D reader (`0x180137430`) with the given axis mode; null when the file cannot be read. */
export function readC3D(b: Uint8Array, axisMode = 2): C3DData | null {
  const h = parseHead(b); if (!h || h.P < 0 || h.rawF < 0) return null;
  const { dv, P, rawF, scale, proc } = h;
  const ds = (h.dataBlock - 1) * 512; const w = scale > 0 ? 2 : 4;
  if (ds < 0 || ds + rawF * P * 4 * w > b.length) return null;
  let frames: Float64Array[] = [];
  for (let f = 0; f < rawF; f++) {
    const fr = new Float64Array(P * 3);
    for (let p = 0; p < P; p++) {
      const o = ds + (f * P + p) * 4 * w; let v: [number, number, number];
      if (scale > 0) v = [dv.getInt16(o, true) * scale, dv.getInt16(o + 2, true) * scale, dv.getInt16(o + 4, true) * scale];
      else v = [readF(dv, o, proc), readF(dv, o + 4, proc), readF(dv, o + 8, proc)];
      const c = convertAxis(v, axisMode); fr[p * 3] = c[0]; fr[p * 3 + 1] = c[1]; fr[p * 3 + 2] = c[2];
    }
    frames.push(fr);
  }
  // validity: drop frames 0..k when the first fully valid frame k is > 0
  const valid = (fr: Float64Array, p: number) => fr[p * 3] ** 2 + fr[p * 3 + 1] ** 2 + fr[p * 3 + 2] ** 2 >= 1e-7;
  const k = frames.findIndex(fr => { for (let p = 0; p < P; p++) if (!valid(fr, p)) return false; return true; });
  let drop = 0; if (k > 0) { drop = k + 1; frames = frames.slice(drop); }
  gapFill(frames, P);
  return {
    P, F: frames.length, rawF, firstFrame: h.firstFrame, lastFrame: h.lastFrame, scale, rate: h.rate, proc, paramBlock: h.paramBlock, dataBlock: h.dataBlock,
    labels: strings(h.params.get('POINT:LABELS')).slice(0, P), units: h.params.has('POINT:UNITS') ? strings(h.params.get('POINT:UNITS'))[0] ?? '' : null,
    params: h.params, frames, drop,
  };
}

/** Gap fill, "hold" mode (`0x180136d00`). */
export function gapFill(frames: Float64Array[], P: number) {
  const F = frames.length; const miss = (f: number, p: number) => frames[f][p * 3] ** 2 + frames[f][p * 3 + 1] ** 2 + frames[f][p * 3 + 2] ** 2 < 1e-6;
  for (let p = 0; p < P; p++) {
    let f = 0;
    while (f < F) {
      if (!miss(f, p)) { f++; continue; }
      const s = f; while (f < F && miss(f, p)) f++;
      if (s === 0) continue;                                 // no valid frame before the run: left as read
      const a = s - 1;
      if (f >= F) { for (let i = s; i < F; i++) for (let c = 0; c < 3; c++) frames[i][p * 3 + c] = frames[a][p * 3 + c]; break; }
      const e = f + 1 < F ? f + 1 : f;                       // the frame after the first valid frame that follows the run
      for (let i = s; i < f; i++) { const t = (i - a) / (e - a); for (let c = 0; c < 3; c++) frames[i][p * 3 + c] = frames[a][p * 3 + c] + t * (frames[e][p * 3 + c] - frames[a][p * 3 + c]); }
    }
  }
}

/** The in-place writer (`0x180136300`). `samples` maps a point label to N (x, y, z) values in C3D axes. Returns an error
 *  text or null. */
export function writeC3DInPlace(b: Uint8Array, samples: Map<string, [number, number, number][]>, drop: number, span: number): string | null {
  const h = parseHead(b); if (!h) return 'Cannot read C3D file.';
  if (span > h.rawF) return 'Can not modify the specified range of C3D data';
  const { dv, P, scale, proc } = h; const w = scale > 0 ? 2 : 4; const ds = (h.dataBlock - 1) * 512;
  const labels = strings(h.params.get('POINT:LABELS'));
  for (let p = 0; p < P; p++) {
    const s = samples.get(labels[p]); if (!s || !s.length) continue;
    const N = s.length;
    for (let f = drop; f < drop + span && f < h.rawF; f++) {
      const src = s[Math.min(N - 1, Math.floor((f - drop) * (N / span)))];
      const o = ds + (f * P + p) * 4 * w; if (o + 3 * w > b.length) continue;
      for (let c = 0; c < 3; c++) {
        if (scale > 0) dv.setInt16(o + c * 2, Math.trunc(src[c] / scale), true);
        else if (proc === 85) b.set(decBytes(src[c]), o + c * 4);
        else dv.setFloat32(o + c * 4, src[c], true);
      }
    }
  }
  return null;
}

// ================================================================== name file (§2.5)
export interface NameFile { globalMotion: string[]; mapping: [string, string][] }
/** Parse a name file against the marker objects; returns the parsed file or the error text. */
export function parseNameFile(text: string, markers: X3DObject[]): NameFile | string {
  const tok = text.split(/\s+/).filter(Boolean); const nf: NameFile = { globalMotion: [], mapping: [] };
  const find = (n: string) => markers.find(m => m.name.toLowerCase() === n.toLowerCase());
  for (let i = 0; i < tok.length; i++) {
    const t = tok[i].toLowerCase();
    if (t === 'globalmotion') {
      i++; if (tok[i] === '{') i++;
      const names: string[] = [];
      while (i < tok.length && tok[i] !== '}' && names.length < 6) {
        if (!find(tok[i])) return `Error parsing the name file: GlobalMotion has bad head frame node ${tok[i]}`;
        names.push(tok[i]); i++;
      }
      if (names.length < 3) return `Error parsing the name file: GlobalMotion has bad head frame node ${tok[i] ?? ''}`;
      if (tok[i] !== '}') return 'Error parsing the name file: GlobalMotion requires ending curly brace.';
      nf.globalMotion = names;
    } else if (t === 'mapping') {
      i++; if (tok[i] === '{') i++;
      while (i < tok.length && tok[i] !== '}') {
        const m = tok[i], fr = tok[i + 1] ?? '';
        if (!find(m)) return `Error parsing the name file: Failed to find the marker node ${m}`;
        nf.mapping.push([find(m)!.name, fr]); i += 2;
      }
    }
  }
  return nf;
}

// ================================================================== face map (own token layout, Q4)
export interface FaceMapEntry { label: string; node: string; v: [number, number, number] }
export const FMAP_TAG = 'FaceMap1.2';
export function writeFaceMap(entries: FaceMapEntry[]): string {
  const I = '1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1';
  return `${FMAP_TAG}\n${I}\n${I}\n${I}\n0 0 0\n${entries.map(e => `${e.label} ${e.node} ${e.v.join(' ')}`).join('\n')}${entries.length ? '\n' : ''}EndMapping\n`;
}
/** Read a face map; 'old' when the version tag is older, null when it is not a face map. */
export function readFaceMap(text: string): FaceMapEntry[] | 'old' | null {
  const t = text.split(/\s+/).filter(Boolean);
  if (!t.length || !t[0].startsWith('FaceMap')) return null;
  if (t[0] !== FMAP_TAG) return 'old';
  let i = 1 + 48 + 3; const out: FaceMapEntry[] = [];
  while (i < t.length && t[i] !== 'EndMapping') { out.push({ label: t[i], node: t[i + 1], v: [Number(t[i + 2]), Number(t[i + 3]), Number(t[i + 4])] }); i += 5; }
  return out;
}

// ================================================================== helpers
function fileDialog(app: App, command: string, title: string, filter: string, start: string): string {
  const r = frState(app).hooks.fileDialog?.(command, title, filter);
  app.logMsg('info', `${command}: file dialog "${title}" (${filter}) in "${start}"${r ? ': ' + r : ': cancelled'}`);
  return r ?? '';
}
const readText = (p: string) => { try { return isFile(p) ? hostFs.readFile(p) : null; } catch { return null; } };
const dirOf = (p: string) => p.replace(/[\\/][^\\/]*$/, '');
export function c3dModel(app: App): X3DObject | null { return findByName(app, 'C3DFaceData'); }
function cubeMesh(app: App, name: string, length: number): X3DObject {
  const h = length / 2; const V = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]];
  const Fc = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const o = meshObject(app, name, V, Fc); o.primitive?.get('length') && (o.primitive.get('length')!.value = length);
  return o;
}
/** Face-map check shared by fr_C3DDebugFace / fr_C3DToFaceRobot: version and ear markers. False after a message. */
function checkFaceMap(app: App, fm: FaceMapEntry[] | 'old' | null, labels: string[]): fm is FaceMapEntry[] {
  if (fm === 'old') { frWarn(app, 'FaceMap file is out of date.  Please generate a new one.'); return false; }
  if (!fm) { frWarn(app, 'FaceMap file is out of date.  Please generate a new one.'); return false; }
  const ears = fm.filter(e => /^(LEar_Control|REar_Control|Ears)$/.test(e.node));
  if (ears.length && !ears.every(e => labels.includes(e.label))) { frWarn(app, 'The fmap and the C3D file are mismatched.  The ear markers could not be found by name.'); return false; }
  return true;
}

// ================================================================== commands
export function registerFaceRobotB14dC3DCommands(app: App) {
  // ---------------------------------------------------------------- fr_LoadC3D
  app.register({
    name: 'fr_LoadC3D', label: 'fr_LoadC3D', category: CAT,
    args: [{ name: 'namefile', default: null }, { name: 'initDir', default: null }, { name: 'frameCamera', default: null }],
    execute(app, a) {
      const C = 'fr_LoadC3D'; const st = de(app, 'B14d');
      const initDir = sArg(a.initDir);
      let path = initDir;
      if (!(path.length > 4 && /\.c3d$/i.test(path))) { path = fileDialog(app, C, 'Select C3D File', 'Select C3D File (*.c3d)|*.c3d||', initDir); if (!path) return ''; }
      for (const n of ['C3DFaceData', 'ZeroFace']) { let o; while ((o = findByName(app, n))) deleteNode(app, o); }
      if (!isFile(path)) { app.logMsg('error', 'Cannot open C3D file for reading.'); return path; }
      const d = readC3D(readBytes(path), 2);
      if (!d) { app.logMsg('error', 'Cannot read C3D file.'); return path; }
      // frame offset: FR setting mods/offset, read once and removed
      const store = frStore(app); let offset = Math.trunc(Number(store.raw('mods', 'offset') ?? 0)) || 0; store.delete('mods', 'offset');
      const count = Math.floor(d.F * app.anim.fps / (d.rate > 0 ? d.rate : app.anim.fps) + 0.5);
      if (offset >= count) { app.logMsg('info', 'Offset value is too large for this mocap.  It will be ignored.'); offset = 0; }
      const N = Math.max(0, count - offset);
      const oldOut = app.anim.endFrame; app.record('Play Control.Out', () => { app.anim.endFrame = N; }, () => { app.anim.endFrame = oldOut; });   // inferred: Out = N
      const model = new Model('C3DFaceData'); addObject(app, model);
      if (d.units !== null) addProperty(app, model, new Property('C3D_Parameters', 'customparamset', [str('units', d.units, 'Units', { desc: 'Units used in C3D file' })]));
      // marker size: 0.008 x the bounding-box diagonal at the middle frame (diagonal floored at 1.0)
      const mid = d.frames[Math.floor(d.F / 2)]; const box = new THREE.Box3();
      if (mid) for (let p = 0; p < d.P; p++) box.expandByPoint(new THREE.Vector3(mid[p * 3], mid[p * 3 + 1], mid[p * 3 + 2]));
      const diag = Math.max(1.0, box.isEmpty() ? 0 : box.getSize(new THREE.Vector3()).length()); const length = 0.008 * diag;
      nyaD(app, C, 'geometry approximation.gapproxmosl value set on the marker cubes (Q2)');
      const grp = ensureGroup(app, 'C3D_Markers_Group');
      const sh = makePhong('Phong');
      for (const [n, v] of [['diffuse', [0.2, 0.8, 1.0]], ['ambient', [0.7, 0.7, 0.7]]] as const) { const q = sh.get(n); if (q) q.value = Array.isArray(q.value) && q.value.length === 4 ? [...v, q.value[3]] : [...v]; }
      const mat = app.scene.newMaterial('C3DMarkerMaterial', sh); (grp as any).material = mat;
      app.record('C3DMarkerMaterial', () => { if (!app.scene.materials.includes(mat)) app.scene.materials.push(mat); }, () => { const i = app.scene.materials.indexOf(mat); if (i >= 0) app.scene.materials.splice(i, 1); });
      progress(app, locText(app, 'pbar_import_motion'));
      nyaD(app, C, 'per-frame sampler 0x180135fa0 (linear interpolation between C3D frames is used)');
      const cubes: X3DObject[] = [];
      for (let p = 0; p < d.P; p++) {
        const cube = cubeMesh(app, d.labels[p] || `Marker${p}`, length); addObject(app, cube, model); addToGroup(app, grp, cube);
        const old = cube.material; app.record('SetMaterial', () => cube.setMaterial(mat), () => cube.setMaterial(old));
        const data = new Float64Array(N * 3);
        for (let i = 0; i < N; i++) {
          const t = d.F > 0 && N > 0 ? (i + offset) * d.F / N : 0; const f0 = Math.min(d.F - 1, Math.floor(t)), f1 = Math.min(d.F - 1, f0 + 1), u = t - Math.floor(t);
          for (let c = 0; c < 3; c++) data[i * 3 + c] = f0 < 0 ? 0 : d.frames[f0][p * 3 + c] * (1 - u) + d.frames[f1][p * 3 + c] * u;
        }
        userDataBlob(app, cube, 'c3dudb', data);
        ['posx', 'posy', 'posz'].forEach((pn, c) => {
          const q = cube.kinematics.local.get(pn)!;
          for (let i = 0; i < N; i++) app.anim.setKey(q, i, data[i * 3 + c]);
          if (N) q.value = data[c];
        });
        cubes.push(cube);
      }
      st.c3d = { path, drop: d.drop, F: d.F, rawF: d.rawF, N, offset, labels: d.labels, rate: d.rate };
      if (boolArg(a.frameCamera, false)) { app.select([...grp.members]); wrap(app, 'B14d', 'FrameSelection'); }
      // the name file
      let mapped = false; const nfPath = sArg(a.namefile);
      if (nfPath) {
        const text = readText(nfPath);
        if (text !== null) {
          const nf = parseNameFile(text, cubes);
          if (typeof nf === 'string') app.logMsg('error', nf);
          else {
            mapped = true; st.nameFile = nf;
            const keep = new Set([...nf.globalMotion.map(s => s.toLowerCase()), ...nf.mapping.map(m => m[0].toLowerCase())]);
            for (const c of cubes) if (!keep.has(c.name.toLowerCase())) deleteNode(app, c);   // inferred: unmapped markers are deleted
          }
        }
      }
      if (mapped) {
        nyaD(app, C, 'name of the custom property added to C3DFaceData after the name-map pass (Q2)');
        const ref = findByName(app, 'RefFace'); app.select(ref ? [ref, ...ref.descendants()] : []);
      }
      wrap(app, 'B14d', 'FrameAll'); wrap(app, 'B14d', 'DeselectAll');
      return path;
    },
  });

  // ---------------------------------------------------------------- fr_WriteC3D
  app.register({
    name: 'fr_WriteC3D', label: 'fr_WriteC3D', category: CAT,
    args: [{ name: 'inputfile', default: null }, { name: 'outputfile', default: null }],
    execute(app, a) {
      const C = 'fr_WriteC3D'; const input = sArg(a.inputfile), output = sArg(a.outputfile);
      const rd = retargetData(retargetBlob(app));
      if (!rd) { setStatus(app, 'B14d', C, 0); return; }                   // no retarget blob: nothing happens
      nyaD(app, C, `name of the retarget UserDataBlob (Q3; this build: payload "retarget", created as ${RETARGET_BLOB})`);
      if (!isFile(input)) { app.logMsg('error', 'Cannot open C3D file for reading.'); return; }
      nyaD(app, C, 'source of the byte copy written to outputfile (inputfile is copied)');
      try { writeBytes(output, readBytes(input)); } catch { app.logMsg('error', 'Cannot open C3D file for reading.'); return; }
      nyaD(app, C, 'face-map path suffix (Q3; <inputfile minus .c3d>.fmap is used)');
      const fm = readFaceMap(readText(input.replace(/\.c3d$/i, '') + '.fmap') ?? '');
      const entries: FaceMapEntry[] = [
        ...['NoseBridge', 'LForehead', 'RForehead'].map(n => ({ label: n, node: n, v: [0, 0, 0] as [number, number, number] })),
        ...(Array.isArray(fm) ? fm : []),
      ];
      const nodes = entries.map(e => ({ e, o: findByName(app, e.node) })).filter(x => !!x.o);
      const samples = new Map<string, [number, number, number][]>();
      for (const x of nodes) samples.set(x.e.label, []);
      progress(app, 'Extracting motion ...');
      const cur = app.anim.frame;
      for (let f = rd.start; f < rd.start + rd.count; f++) {
        app.anim.frame = f;
        for (const x of nodes) { const g = globalPos(x.o!); samples.get(x.e.label)!.push(unconvertAxis2([g.x, g.y, g.z])); }
      }
      app.anim.frame = cur;
      const b = readBytes(output); const h = readC3D(b, 1);
      if (!h) { app.logMsg('error', 'Cannot open C3D file for reading.'); return; }
      const err = writeC3DInPlace(b, samples, h.drop, h.rawF - h.drop);
      if (err) { app.logMsg('error', err); return; }
      writeBytes(output, b);
      setStatus(app, 'B14d', C, 0);
    },
  });

  // ---------------------------------------------------------------- fr_C3DDebugFace
  app.register({
    name: 'fr_C3DDebugFace', label: 'fr_C3DDebugFace', category: CAT,
    args: [{ name: 'facemap', default: null }, { name: 'initdir', default: null }],
    execute(app, a) {
      const C = 'fr_C3DDebugFace';
      const path = fileDialog(app, C, 'Select C3D File', 'Select C3D File (*.c3d)|*.c3d||', sArg(a.initdir));
      if (!path) return '';
      const d = isFile(path) ? readC3D(readBytes(path), 2) : null;
      const fm = readFaceMap(readText(sArg(a.facemap)) ?? '');
      if (!checkFaceMap(app, fm, d?.labels ?? [])) return path;
      nyaD(app, C, 'debug builder 0x180141680 (marker positions, length, wirecol, keys and the fourth marker)');
      for (const n of ['LeftLipZero', 'LipZero', 'RightLipZero']) { const o = findByName(app, n); if (o) deleteNode(app, o); addObject(app, cubeMesh(app, n, 0.1)); }
      return path;
    },
  });

  // ---------------------------------------------------------------- fr_C3DToFaceRobot
  app.register({
    name: 'fr_C3DToFaceRobot', label: 'fr_C3DToFaceRobot', category: CAT,
    args: [{ name: 'c3dfile', default: null }],
    execute(app, a) {
      const C = 'fr_C3DToFaceRobot'; const f = sArg(a.c3dfile);
      if (!f || !/\.c3d$/i.test(f)) { app.logMsg('error', 'fr_C3DToFaceRobot: missing c3d file.'); return false; }
      const model = faceModel(app);
      if (!model) { frWarn(app, 'Failed to auto-find a valid Face Robot. Please select the desired target Face Robot.'); return false; }
      let fmPath = f.replace(/\.c3d$/i, '') + '.fmap';
      if (!isFile(fmPath)) { nyaD(app, C, 'second face-map location (<directory of c3dfile> + suffix, Q3)'); fmPath = ''; }
      if (!fmPath) { frWarn(app, 'Could not find a valid face map for the C3D file.  Please generate a new\nface map for the C3D file and its associated set.'); return false; }
      const d = isFile(f) ? readC3D(readBytes(f), 2) : null;
      const fm = readFaceMap(readText(fmPath) ?? '');
      if (!checkFaceMap(app, fm, d?.labels ?? [])) return false;
      const store = frStore(app);
      void store.raw('_', 'keep_adjust_keys'); void store.raw('_', 'Stabilize_motion_on_retargeting');
      nyaD(app, C, 'retarget builder 0x1801456c0 (fro_FaceRetargetOp* set-up on the rig, use of keep_adjust_keys / Stabilize_motion_on_retargeting)');
      // inferred: the builder leaves the retarget blob that fr_WriteC3D, fr_PlotRetargetedFace and the retarget mute read
      const N = d ? Math.floor(d.F * app.anim.fps / (d.rate > 0 ? d.rate : app.anim.fps) + 0.5) : 0;
      const old = retargetBlob(app, model); if (old) deleteNode(app, old);
      userDataBlob(app, model, RETARGET_BLOB, { retarget: { start: 0, count: N, muted: false, c3dfile: f, fmap: fmPath } });
      return true;
    },
  });

  // ---------------------------------------------------------------- fr_CreateFaceMap
  app.register({
    name: 'fr_CreateFaceMap', label: 'fr_CreateFaceMap', category: CAT,
    args: [{ name: 'namefile', default: null }, { name: 'initdir', default: null }],
    execute(app, a) {
      const C = 'fr_CreateFaceMap';
      const c3d = c3dModel(app);
      if (!c3d) { frWarn(app, 'A C3D data model is required to create the name map/face map. Please\nload a C3D file and try again.'); return ''; }
      const text = readText(sArg(a.namefile));
      const markers = [...c3d.descendants()];
      const nf = text === null ? null : parseNameFile(text, markers);
      if (!nf) { app.logMsg('error', 'Bad namefile for the CreateFaceMap command.'); return ''; }
      if (typeof nf === 'string') { app.logMsg('error', nf); return ''; }
      const out = fileDialog(app, C, 'Save Face Map', 'Save Face Map (*.fmap)|*.fmap||', sArg(a.initdir));
      if (!out) return '';
      const entries: FaceMapEntry[] = nf.mapping.map(([m, n]) => { const o = markers.find(x => x.name === m)!; const g = globalPos(o); return { label: m, node: n, v: [g.x, g.y, g.z] }; });
      try { hostFs.writeFile(out, writeFaceMap(entries)); } catch { app.logMsg('error', `Failed to create the facemap file ${out} with write access.`); return ''; }
      nyaD(app, C, 'face-map builder 0x1801593a0 (the transforms, vector and per-component fitting; _GroupMap_.gfmap content)');
      try { hostFs.writeFile(dirOf(out) + '\\_GroupMap_.gfmap', entries.map(e => e.node).join('\n') + '\nEndMapping\n'); } catch { /* best effort */ }
      return out;
    },
  });
}
export { propNamed };
