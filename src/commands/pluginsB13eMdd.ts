// Ledger row CMD-B13e, part 1: PointOven MDD script tools (PO_MDDScriptTools.64.dll).
//   poMDDFrames poMDDPoints poMDDTimes poMDDFrameData
// Brief: docs/ghidra/cmd-b13e-small-plugins-binary.md, sections 2.2 (MDD layout) and 3. Original code from that prose.
//
// MDD layout (big-endian): int32 frameCount F, int32 pointCount P, F float32 times, then F frames of P (x, y, z)
// float32 points. Frame k (0-based) starts at 8 + 4F + 12Pk.
import { App } from '../core/commands';
import { E_FAIL, CFile, failLog, intArg, arrayArg, narrow, unset, logNya, BEWriter } from './pluginsB13eShared';

const frameOffset = (F: number, P: number, k: number) => 8 + 4 * F + k * P * 12;

/** Shared preamble of the four commands: the narrowed file name and the mode character ('' when none). */
function preamble(app: App, C: string, a: Record<string, any>) {
  const file = narrow(a.FileName, 512);
  const modeText = unset(a.Mode) ? '' : String(a.Mode);
  if (modeText.length > 2) throw failLog(app, C, E_FAIL, `${C}. Error, read mode flag in correct`);
  return { file, mode: modeText.charAt(0) };
}
const openFail = (app: App, C: string) => failLog(app, C, E_FAIL, `${C} failed to open file!`);

// ------------------------------------------------------------------ poMDDFrames
function mddFrames(app: App, a: Record<string, any>) {
  const C = 'poMDDFrames';
  const { file, mode } = preamble(app, C, a);
  const n = intArg(a.Value, 0);
  if (mode === 'r') {
    const f = CFile.open(file, 'rb'); if (!f) throw openFail(app, C);
    const v = f.readI32BE(); f.close();
    if (v === null) { logNya(app, C, 'the value read from a file shorter than 4 bytes; 0 returned'); return 0; }
    return v;
  }
  if (mode === 'w') {
    const f = CFile.open(file, 'wb'); if (!f) throw openFail(app, C);
    f.writeI32BE(n); f.close();   // "wb": the file is truncated to these 4 bytes
    return `${n} has been written to Frames`;
  }
  if (mode === 'm') {
    const f = CFile.open(file, 'r+b'); if (!f) throw openFail(app, C);
    f.seek(0); f.writeI32BE(n); f.close();
    return `${n} has been merged to Frames`;
  }
  return undefined;   // any other mode character: succeeds, does nothing
}

// ------------------------------------------------------------------ poMDDPoints
function mddPoints(app: App, a: Record<string, any>) {
  const C = 'poMDDPoints';
  const { file, mode } = preamble(app, C, a);
  const n = intArg(a.Value, 0);
  if (mode === 'r') {
    const f = CFile.open(file, 'rb'); if (!f) throw openFail(app, C);
    f.seek(4); const v = f.readI32BE(); f.close();
    if (v === null) { logNya(app, C, 'the value read from a file shorter than 8 bytes; 0 returned'); return 0; }
    return v;
  }
  if (mode === 'm') {
    const f = CFile.open(file, 'r+b'); if (!f) throw openFail(app, C);
    f.seek(4); f.writeI32BE(n); f.close();
    return `${n} has been written to points`;
  }
  return undefined;   // no 'w' branch: 'w' (and any other character) succeeds and does nothing
}

// ------------------------------------------------------------------ poMDDTimes
function mddTimes(app: App, a: Record<string, any>) {
  const C = 'poMDDTimes';
  const { file, mode } = preamble(app, C, a);
  if (!file) throw openFail(app, C);
  if (mode === 'r') {
    const f = CFile.open(file, 'rb'); if (!f) throw openFail(app, C);
    const out: number[] = [];
    const F = f.readI32BE() ?? 0; f.read(4);
    for (let i = 0; i < F; i++) { const t = f.readF32BE(); if (t === null) { logNya(app, C, 'times past the end of the file'); break; } out.push(t); }
    f.close();
    a.Value = out;
    return out;
  }
  if (mode === 'm') {
    const f = CFile.open(file, 'r+b'); if (!f) throw openFail(app, C);
    const vals = arrayArg(a.Value);
    if (!vals.length) throw failLog(app, C, E_FAIL, 'poMDDTimes failed. No data provided to put into file');
    f.seek(8); for (const v of vals) f.writeF32BE(Number(v));   // no check against F: a longer array overwrites frame data
    f.close();
    return `${vals.length} values have been written to times`;
  }
  return undefined;   // 'w': does nothing
}

// ------------------------------------------------------------------ poMDDFrameData
function mddFrameData(app: App, a: Record<string, any>) {
  const C = 'poMDDFrameData';
  const { file, mode } = preamble(app, C, a);
  if (!file) throw openFail(app, C);
  const frame = intArg(a.Frame, 0);
  if (mode === 'r') {
    const f = CFile.open(file, 'rb'); if (!f) throw openFail(app, C);
    const F = f.readI32BE() ?? 0, P = f.readI32BE() ?? 0;
    if (frame > F + 1) { f.close(); throw failLog(app, C, E_FAIL, 'poMDDFrameData error frame out of range'); }
    if (frame < 0) logNya(app, C, 'a negative Frame (offset before the frame records)');
    f.seek(frameOffset(F, P, frame));
    const out: number[] = [];
    for (let i = 0; i < 3 * P; i++) {
      const v = f.readF32BE();
      if (v === null) { logNya(app, C, `values past the end of the file (frame ${frame}); read stops`); break; }
      out.push(v);
    }
    f.close();
    a.Value = out;
    return out;
  }
  if (mode === 'm') {
    const vals = arrayArg(a.Value);
    if (!vals.length) throw failLog(app, C, E_FAIL, 'poMDDFrameData failed. No data provided to put into file');
    const f = CFile.open(file, 'r+b'); if (!f) throw openFail(app, C);
    const F = f.readI32BE() ?? 0;
    if (F < frame) { f.close(); throw failLog(app, C, E_FAIL, 'poMDDFrameData failed. Frame number to insert data is greater than total number of frames in header.'); }
    const P = f.readI32BE() ?? 0;
    // The check compares the element count with P, not 3P (as read).
    if (vals.length < P) { f.close(); throw failLog(app, C, E_FAIL, 'poMDDFrameData failed. Point count in file is greater than number of elements in user array.'); }
    if (vals.length < 3 * P) logNya(app, C, `elements ${vals.length}..${3 * P - 1} past the end of the user array (written as 0)`);
    f.seek(frameOffset(F, P, frame));
    for (let i = 0; i < 3 * P; i++) f.writeF32BE(i < vals.length ? Number(vals[i]) : 0);
    f.close();
    // inferred: <count> is the element count of the user array (open question to the analyst)
    return `${vals.length} values have been written to frame ${frame}'s data`;
  }
  return undefined;   // 'w': does nothing
}

/** A whole MDD file (section 2.2): times[f] in seconds, frames[f] = flat x, y, z of every point. The frame count is
 *  written as int32 (the readers' convention; the baker's float conversion is open question 3 of the note). */
export function mddBytes(times: number[], frames: ArrayLike<number>[], pointCount: number): Uint8Array {
  const w = new BEWriter();
  w.i32(times.length).i32(pointCount);
  for (const t of times) w.f32(t);
  for (const fr of frames) for (let i = 0; i < pointCount * 3; i++) w.f32(fr[i] ?? 0);
  return w.toBytes();
}

export function registerPluginsB13eMddCommands(app: App) {
  const cat = 'Custom';
  app.register({
    name: 'poMDDFrames', label: 'poMDDFrames', category: cat, description: 'Reads or writes the frame count of a PointOven MDD file.',
    args: [{ name: 'FileName', default: null }, { name: 'Mode', default: null }, { name: 'Value', default: null }], undoable: false, execute: mddFrames,
  });
  app.register({
    name: 'poMDDPoints', label: 'poMDDPoints', category: cat, description: 'Reads or writes the point count of a PointOven MDD file.',
    args: [{ name: 'FileName', default: null }, { name: 'Mode', default: null }, { name: 'Value', default: null }], undoable: false, execute: mddPoints,
  });
  app.register({
    name: 'poMDDTimes', label: 'poMDDTimes', category: cat, description: 'Reads or writes the frame times of a PointOven MDD file.',
    args: [{ name: 'FileName', default: '' }, { name: 'Mode', default: 'r' }, { name: 'Value', default: null }], undoable: false, execute: mddTimes,
  });
  app.register({
    name: 'poMDDFrameData', label: 'poMDDFrameData', category: cat, description: 'Reads or writes the points of one frame of a PointOven MDD file.',
    args: [{ name: 'FileName', default: null }, { name: 'Mode', default: null }, { name: 'Frame', default: null }, { name: 'Value', default: null }], undoable: false, execute: mddFrameData,
  });
}
