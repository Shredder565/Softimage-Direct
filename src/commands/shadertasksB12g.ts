// Ledger row CMD-B12g (shadertasks.dll): shader compounds, shader trees and shader definitions.
//   CreateShaderCompound NestShaders UnnestShaders AddShaderCompoundPort RemoveShaderCompoundPort MoveShaderCompoundPort
//   RenameShaderCompoundPort ExportShaderCompound ImportShaderCompound ExplodeShaderCompound SetShaderCompoundProperties
//   SetShaderCompoundPortProperties GetShaderCompoundPortProperties ExportShaderTree ImportShaderTree
//   ExportShaderDefinition ReplaceShadersDefinition
// Brief: docs/ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md, section 3. Original code from that prose only.
// The compound model and the stand-in file format (the real formats belong to shaderhelper.dll, row
// CMD-B12-SHADERHELPER, not read) are in src/core/shaderCompound.ts. Conventions: shadertasksB12Shared.ts.
import { App, CommandDef } from '../core/commands';
import { Node, Shader, Material } from '../core/scene';
import { hostFs } from '../core/sdkHelpersHostFs';
import { SI_SHADERS } from '../core/shaders';
import {
  type PortRef, getSource, uniqueShaderContainer, uniqueNameIn, portExists, makeProgIdShader, makePresetShader, nestedShaders,
} from '../core/textureLayers';
import {
  ShaderCompound, CompoundPort, isCompound, COMPOUND_FIELDS, PORT_FIELDS, RT_COMPOUND_TAG, SHADER_TREE_TAG,
  Writer, writeCompound, fileText, parseFile, readCompound, readShaders, definitionOf, definitionId, cloneDef, type CompoundRec,
} from '../core/shaderCompound';
import { changeDefinitionRec, definitionFromProgId, type NewDefinition } from './shadertasksB12f';
import {
  S_OK, S_FALSE, E_INVALIDARG, E_FAIL, E_UNEXPECTED, E_ACCESSDENIED, NOTE_G,
  stateOf, fail, setStatus, raise, logNya as logNyaF, text, unset, boolOf, intOf, listOf, nodeOf, nodesOf, portOf, compoundOf, compoundPortOf,
  lockedAny, lockError, connectRec, nestRec, unnestRec, renameRec, setFieldRec, usersOf, containerOf, deleteShaderRec,
} from './shadertasksB12Shared';

const logNya = (app: App, C: string, what: string) => logNyaF(app, C, what, NOTE_G);

// ------------------------------------------------------------------ port primitives

function addPortRec(app: App, c: ShaderCompound, port: CompoundPort, index = c.exposed.length) {
  app.record('Add compound port', () => { if (!c.exposed.includes(port)) c.exposed.splice(Math.min(index, c.exposed.length), 0, port); c.addPortParam(port); },
    () => { const i = c.exposed.indexOf(port); if (i >= 0) c.exposed.splice(i, 1); c.removePortParam(port.name); });
}
function removePortRec(app: App, c: ShaderCompound, port: CompoundPort) {
  const index = c.exposed.indexOf(port); if (index < 0) return;
  const param = c.get(port.name); const def = param ? { ...param.def } : null; const v = param?.value;
  app.record('Remove compound port', () => { const i = c.exposed.indexOf(port); if (i >= 0) c.exposed.splice(i, 1); c.removePortParam(port.name); },
    () => { c.exposed.splice(index, 0, port); if (def && !c.get(port.name)) { const p = c.add(def); p.value = v; } else c.addPortParam(port); });
}
/** The outside ports wired through an output port (header of src/core/shaderCompound.ts). */
function outputUsers(app: App, c: ShaderCompound, port: CompoundPort): PortRef[] {
  const all = usersOf(app, c);
  const outs = c.exposed.filter(p => p.direction === 'output');
  if (outs.length === 1) return all;
  const mine = all.filter(r => port.users.some(u => u.owner === r.owner && u.name === r.name));
  if (port === outs[0]) for (const r of all) if (!outs.some(o => o.users.some(u => u.owner === r.owner && u.name === r.name)) && !mine.includes(r)) mine.push(r);   // inferred: unclaimed users go to the first output
  return mine;
}
const isShaderContainer = (n: any) => n instanceof Material || n instanceof ShaderCompound;
const shadersArg = (app: App, v: any) => nodesOf(app, v).filter((n): n is Shader => n instanceof Shader);

// ------------------------------------------------------------------ CreateShaderCompound / Nest / Unnest

function createShaderCompound(app: App, a: Record<string, any>) {
  const C = 'CreateShaderCompound';
  const items = listOf(a.InputObj); const shaders = shadersArg(app, a.InputObj);
  // input validation (helper 0x180014bc0, not read): inferred: every input is a shader and all share one container
  const container = shaders.length && shaders.length === items.length ? uniqueShaderContainer(app.scene, shaders) : null;
  if (!container) throw fail(E_INVALIDARG, `${C}: InputObj must be shaders of one shader container`);
  const comp = new ShaderCompound(uniqueNameIn(container, text(a.Name) || 'ShaderCompound'));   // inferred default name
  nestRec(app, container, comp);
  const set = new Set<Shader>(shaders);
  // record the crossing connections: input side, then output side
  const ins: { ref: PortRef; src: Node }[] = [];
  for (const s of shaders) for (const name of new Set([...s.inputs.keys(), ...s.params.map(p => p.name)])) {
    const src = getSource({ owner: s, name }); if (src && !(src instanceof Shader && set.has(src))) ins.push({ ref: { owner: s, name }, src });
  }
  const outs: { ref: PortRef; inner: Shader }[] = [];
  for (const s of shaders) for (const r of usersOf(app, s)) if (!(r.owner instanceof Shader && set.has(r.owner))) outs.push({ ref: r, inner: s });
  // expose a compound port for each (port names: inferred, the inner parameter name / "out", made unique)
  const inPorts = ins.map(x => { const p = new CompoundPort(comp.uniquePortName(x.ref.name), comp, 'input', x.ref); addPortRec(app, comp, p); return p; });
  const outPort = new Map<Shader, CompoundPort>();
  for (const x of outs) if (!outPort.has(x.inner)) { const p = new CompoundPort(comp.uniquePortName('out'), comp, 'output', { owner: x.inner, name: 'out' }); addPortRec(app, comp, p); outPort.set(x.inner, p); }
  // disconnect, move, reconnect through the ports
  for (const x of ins) connectRec(app, x.ref, null);
  for (const x of outs) connectRec(app, x.ref, null);
  for (const s of shaders) { const home = containerOf(app, s); if (home && home !== comp) unnestRec(app, home, s); nestRec(app, comp, s); }
  ins.forEach((x, i) => connectRec(app, { owner: comp, name: inPorts[i].name }, x.src));
  for (const x of outs) { connectRec(app, x.ref, comp); const p = outPort.get(x.inner)!; const users = p.users; app.record('Port user', () => users.push(x.ref), () => { users.splice(users.indexOf(x.ref), 1); }); }
  logNya(app, C, 'the input validation rules, the default name and how exposed ports are named (inferred: "ShaderCompound", the inner parameter name, "out")');
  a.ShaderCompound = comp; setStatus(app, C, S_OK);
  return comp;
}
function moveShaders(app: App, C: string, shaders: Shader[], dest: Node) {
  for (const s of shaders) {
    const from = containerOf(app, s); if (from === dest) continue;
    if (from) unnestRec(app, from, s);
    if (nestedShaders(dest).some(x => x !== s && x.name === s.name)) renameRec(app, s, uniqueNameIn(dest, s.name));   // inferred: names stay unique
    nestRec(app, dest, s);
  }
  logNya(app, C, 'the worker body; the shaders were moved and connections crossing the container boundary were left as they were');
}
function nestShaders(app: App, a: Record<string, any>) {
  const C = 'NestShaders';
  const shaders = shadersArg(app, a.InputObjs); const dest = nodeOf(app, listOf(a.ShaderContainer)[0]);
  if (!shaders.length || !isShaderContainer(dest)) throw fail(E_INVALIDARG, `${C}: InputObjs must be shaders and ShaderContainer a shader container`);
  moveShaders(app, C, shaders.filter(s => s !== dest), dest!);
  setStatus(app, C, S_OK);
}
function unnestShaders(app: App, a: Record<string, any>) {
  const C = 'UnnestShaders';
  const shaders = shadersArg(app, a.InputObjs).filter(s => isCompound(containerOf(app, s)));
  if (!shaders.length) throw fail(E_INVALIDARG, `${C}: InputObjs holds no shader inside a compound`);
  const given = unset(a.ShaderContainer) ? null : nodeOf(app, listOf(a.ShaderContainer)[0]);
  if (given && !isShaderContainer(given)) throw fail(E_INVALIDARG, `${C}: ShaderContainer is not a shader container`);
  for (const s of shaders) { const comp = containerOf(app, s) as ShaderCompound; const dest = given ?? containerOf(app, comp); if (dest) moveShaders(app, C, [s], dest); }   // inferred: default = the compound's own container
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ compound ports

function innerPortOf(app: App, x: any): { ref: PortRef; dir: 'input' | 'output' } | null {
  const r = portOf(app, x); if (r && r.owner instanceof Shader) return { ref: r, dir: 'input' };
  const s = typeof x === 'string' ? x : x && typeof x === 'object' && typeof x.name === 'string' ? `${x.owner instanceof Node ? '' : x.owner}.${x.name}` : '';
  const owner = x && typeof x === 'object' && x.owner instanceof Node ? x.owner : nodeOf(app, s.slice(0, s.lastIndexOf('.')));
  const name = s.slice(s.lastIndexOf('.') + 1);
  if (owner instanceof Shader && (name === 'out' || !!owner.spdl?.params.some(p => p.sn === name && p.dir === 'output'))) return { ref: { owner, name }, dir: 'output' };
  return null;
}
function addShaderCompoundPort(app: App, a: Record<string, any>) {
  const C = 'AddShaderCompoundPort';
  const comp = compoundOf(app, a.ShaderCompound);
  const raw = listOf(a.ShaderPort)[0];
  const ip = raw === undefined ? null : innerPortOf(app, raw);
  const label = ip ? `${ip.ref.owner.name}.${ip.ref.name}` : text(raw);
  if (!comp || !ip || !comp.shaders().includes(ip.ref.owner as Shader)) {
    app.logMsg('error', `AddCompoundPort Failed for ${label}`);
    throw fail(E_FAIL, `${C}: AddCompoundPort Failed for ${label}`);   // inferred status
  }
  const port = new CompoundPort(comp.uniquePortName(ip.ref.name), comp, ip.dir, ip.ref);
  addPortRec(app, comp, port);
  logNya(app, C, 'the final worker method and the naming of the new port (inferred: the inner port name, made unique)');
  a.ShaderCompoundPort = port; setStatus(app, C, S_OK);
  return port;
}
function lockedPort(app: App, C: string, port: CompoundPort): boolean {
  if (!lockedAny(app, port, port.compound)) return false;
  lockError(app, C, port.compound.name); return true;
}
function removeShaderCompoundPort(app: App, a: Record<string, any>) {
  const C = 'RemoveShaderCompoundPort';
  if (unset(a.InputObj)) throw fail(E_INVALIDARG, `${C}: InputObj is required`);
  const port = compoundPortOf(app, a.InputObj);
  if (!port) { app.logMsg('error', 'Unable to resolve reference in RemoveShaderCompoundPortTask'); throw fail(E_INVALIDARG, `${C}: Unable to resolve reference in RemoveShaderCompoundPortTask`); }
  if (lockedPort(app, C, port)) throw fail(E_ACCESSDENIED, `${C}: ${port.compound.name} is locked`);
  const c = port.compound;
  const outside: PortRef[] = []; const inside: PortRef[] = [port.inner];
  if (port.direction === 'input') { const src = getSource({ owner: c, name: port.name }); if (src) { outside.push({ owner: c, name: port.name }); connectRec(app, { owner: c, name: port.name }, null); } }
  else for (const r of outputUsers(app, c, port)) { outside.push(r); connectRec(app, r, null); }
  removePortRec(app, c, port);
  setStatus(app, C, S_OK);
  return { outside, inside };
}
function moveShaderCompoundPort(app: App, a: Record<string, any>) {
  const C = 'MoveShaderCompoundPort';
  const step = intOf(a.Step, 1);
  const port = unset(a.InputObj) ? null : compoundPortOf(app, a.InputObj);
  if (!port || !step) throw fail(E_INVALIDARG, `${C}: ${!port ? 'InputObj is not a compound port' : 'Step is 0'}`);
  if (lockedPort(app, C, port)) throw fail(E_ACCESSDENIED, `${C}: ${port.compound.name} is locked`);
  const list = port.compound.exposed; const from = list.indexOf(port); const to = from + step;
  if (from < 0 || to < 0 || to >= list.length) { setStatus(app, C, S_FALSE); return; }   // inferred: the compound refuses moves out of range
  app.record('Move compound port', () => { list.splice(list.indexOf(port), 1); list.splice(to, 0, port); }, () => { list.splice(list.indexOf(port), 1); list.splice(from, 0, port); });
  setStatus(app, C, S_OK);
}
function renameShaderCompoundPort(app: App, a: Record<string, any>) {
  const C = 'RenameShaderCompoundPort';
  const name = typeof a.Name === 'string' ? a.Name : text(a.Name); const display = text(a.DisplayName);
  const port = unset(a.InputObj) ? null : compoundPortOf(app, a.InputObj);
  if (!port || !name) { a.NewName = ''; setStatus(app, C, S_OK); return ''; }   // no change, no error
  if (lockedPort(app, C, port)) throw fail(E_ACCESSDENIED, `${C}: ${port.compound.name} is locked`);
  if (port.name !== name || port.displayName !== display) {
    const c = port.compound; const oldName = port.name, oldDisplay = port.displayName;
    const newName = c.uniquePortName(name, port);   // the compound may give another name when this one is taken (inferred numbering)
    app.record('Rename compound port', () => { port.name = newName; port.displayName = display; c.renamePortParam(port, oldName); },
      () => { port.name = oldName; port.displayName = oldDisplay; c.renamePortParam(port, newName); });
  }
  a.NewName = port.name; setStatus(app, C, S_OK);
  return port.name;
}
function setShaderCompoundPortProperties(app: App, a: Record<string, any>) {
  const C = 'SetShaderCompoundPortProperties';
  const port = compoundPortOf(app, a.InputObj);
  if (!port) throw fail(E_INVALIDARG, `${C}: InputObj is not a compound port`);
  const flags = intOf(a.ModifyFlags, 255);
  PORT_FIELDS.forEach((f, i) => {
    if (!(flags & (1 << i))) return;
    const v = /Visible$/.test(f) ? boolOf(a[f], false) : text(a[f]);
    setFieldRec(app, port.props, f, v);
  });
  setStatus(app, C, S_OK);
}
function getShaderCompoundPortProperties(app: App, a: Record<string, any>) {
  const C = 'GetShaderCompoundPortProperties';
  const port = compoundPortOf(app, a.InputObj);
  if (!port) throw fail(E_INVALIDARG, `${C}: InputObj is not a compound port`);
  const out = [port.name, port.displayName, ...PORT_FIELDS.map(f => port.props[f])];
  logNya(app, C, 'the order of the values in OutputArgs (inferred: Name, DisplayName, then the SetShaderCompoundPortProperties fields)');
  a.OutputArgs = out; setStatus(app, C, S_OK);
  return out;
}
function setShaderCompoundProperties(app: App, a: Record<string, any>) {
  const C = 'SetShaderCompoundProperties';
  const comp = compoundOf(app, a.InputObj);
  if (!comp) throw fail(E_INVALIDARG, `${C}: InputObj is not a shader compound`);
  let flags = intOf(a.ModifyFlags, 2047);
  if (a.Editable === undefined) flags &= ~(1 << 11);   // the hidden Editable argument is not on this bus: bit 11 is always forced off
  COMPOUND_FIELDS.forEach((f, i) => {
    if (!(flags & (1 << i))) return;
    if (f === 'Name') { const n = text(a.Name); if (n) renameRec(app, comp, n); return; }
    const v = f === 'VersionMajor' || f === 'VersionMinor' || f === 'BackgroundColor' ? intOf(a[f], 0) : f === 'Editable' ? boolOf(a[f], true) : text(a[f]);
    setFieldRec(app, comp.props, f, v);
  });
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ files

function writeOut(app: App, C: string, path: string, body: string): boolean {
  try { if (!path) return false; hostFs.ensureFolder(hostFs.parentPath(path)); hostFs.writeFile(path, body); return true; }
  catch (e: any) { app.logMsg('error', `${C}: ${e?.description ?? e?.message ?? e}`); return false; }
}
function loadRef(path: string): CompoundRec | null { try { const d = parseFile(hostFs.readFile(path)); return d?.compound ?? null; } catch { return null; } }
function registerLibrary(app: App, type: string, name: string, path: string) {
  const lib = stateOf(app).library; const i = lib.findIndex(e => e.path.toLowerCase() === path.toLowerCase());
  if (i >= 0) lib.splice(i, 1); lib.push({ type, name, path });
}
function exportShaderCompound(app: App, a: Record<string, any>) {
  const C = 'ExportShaderCompound';
  const comp = compoundOf(app, a.Compound);
  if (!comp) throw fail(E_UNEXPECTED, `${C}: Compound is not a shader compound`);
  if (!comp.name) { raise(app, C, 0xd0); throw fail(E_FAIL, `${C}: the compound has no name`); }
  const path = text(a.FullPath); const embed = boolOf(a.ForceEmbedded, false);
  if (!writeOut(app, C, path, fileText(RT_COMPOUND_TAG, { compound: writeCompound(comp, embed) }))) { raise(app, C, 0xce, path); throw fail(E_FAIL, `${C}: could not save "${path}"`); }
  a.Output = path;
  registerLibrary(app, RT_COMPOUND_TAG, comp.name, path);   // so the Render Tree compound list shows it
  setStatus(app, C, S_OK);
  return path;
}
/** Path handling shared by the two imports: an existing file, else a preset name of the family. */
function resolveImport(app: App, C: string, raw: string, type: string, folder: string, ext: string): string {
  let p = raw; try { p = hostFs.normalize(raw); } catch { /* a bare preset name */ }
  if (hostFs.isFile(p)) return p;
  // SIFindPresetPath stand-in: the library registrations, then <user>\Data\DSPresets\<folder>\<name>[.ext] (inferred)
  const base = raw.replace(/\.[^.\\/]*$/, '').toLowerCase();
  const hit = stateOf(app).library.find(e => e.type === type && (e.name.toLowerCase() === base || hostFs.baseName(e.path).replace(/\.[^.]*$/, '').toLowerCase() === base));
  if (hit && hostFs.isFile(hit.path)) return hit.path;
  for (const f of [hostFs.join(hostFs.join(stateOf(app).presetRoot, folder), raw), hostFs.join(hostFs.join(stateOf(app).presetRoot, folder), raw + ext)]) if (hostFs.isFile(f)) return f;
  throw fail(E_FAIL, `${C}: "${raw}" is neither a file nor a preset`);
}
function importContainer(app: App, C: string, v: any): Node {
  const c = nodeOf(app, listOf(v)[0]);
  if (!isShaderContainer(c)) throw fail(E_INVALIDARG, `${C}: Container is not a render tree container`);
  return c!;
}
function importShaderCompound(app: App, a: Record<string, any>) {
  const C = 'ImportShaderCompound';
  a.Compound = null;
  const raw = text(a.Path); if (!raw) throw fail(E_INVALIDARG, `${C}: Path is empty`);
  const container = importContainer(app, C, a.Container);
  const file = resolveImport(app, C, raw, RT_COMPOUND_TAG, 'RTCompounds', '.xsirtcompound');
  const d = (() => { try { return parseFile(hostFs.readFile(file)); } catch { return null; } })();
  if (!d || d.type !== RT_COMPOUND_TAG || !d.compound) throw fail(E_FAIL, `${C}: "${file}" could not be loaded`);
  const comp = readCompound(d.compound, loadRef); comp.sourceFile = file;
  comp.name = uniqueNameIn(container, comp.name);
  nestRec(app, container, comp);
  a.Compound = comp; setStatus(app, C, S_OK);
  return comp;
}
function explodeShaderCompound(app: App, a: Record<string, any>) {
  const C = 'ExplodeShaderCompound';
  const comp = compoundOf(app, a.InputObj);
  if (!comp) throw fail(E_UNEXPECTED, `${C}: InputObj is not a shader compound`);
  const container = containerOf(app, comp);
  if (!container) throw fail(E_FAIL, `${C}: ${comp.name} is not in a shader container`);   // inferred
  const inner = [...comp.shaders()];
  const plan = comp.exposed.map(p => ({ p, users: p.direction === 'output' ? outputUsers(app, comp, p) : [] as PortRef[], src: p.direction === 'input' ? getSource({ owner: comp, name: p.name }) : null }));
  // rewire every connection through each compound port directly
  for (const x of plan) {
    if (x.p.direction === 'input') { if (x.src) { connectRec(app, { owner: comp, name: x.p.name }, null); connectRec(app, x.p.inner, x.src); } }
    else for (const r of x.users) connectRec(app, r, x.p.inner.owner);
  }
  // move the inner shaders to the compound's container (names kept unique, inferred) and delete the compound
  for (const s of inner) { unnestRec(app, comp, s); if (uniqueNameIn(container, s.name) !== s.name) renameRec(app, s, uniqueNameIn(container, s.name)); nestRec(app, container, s); }
  deleteShaderRec(app, comp);
  logNya(app, C, 'the exact sub-task order and how inner shader names are kept unique (inferred: numbered suffix)');
  a.OutputObjs = inner; setStatus(app, C, S_OK);
  return inner;
}
function exportShaderTree(app: App, a: Record<string, any>) {
  const C = 'ExportShaderTree';
  if (unset(a.Shaders)) throw fail(E_INVALIDARG, `${C}: Shaders is required`);
  const w = new Writer(boolOf(a.ForceEmbedded, false));
  const ports: { port: string; root: number }[] = [];
  for (const x of listOf(a.Shaders)) {
    const n = nodeOf(app, x);
    if (n instanceof Shader) { w.idOf(n); continue; }
    const r = portOf(app, x); const src = r ? getSource(r) : null;
    if (r && src instanceof Shader) { ports.push({ port: r.name, root: w.idOf(src) }); continue; }
    throw fail(E_INVALIDARG, `${C}: ${text(x)} is neither a shader nor a connected port`);
  }
  const path = text(a.FullPath);
  const body = fileText(SHADER_TREE_TAG, { tree: { displayName: text(a.DisplayName), category: text(a.Category), shaders: w.recs, ports } });
  if (!writeOut(app, C, path, body)) { raise(app, C, 0xce, path); throw fail(E_FAIL, `${C}: could not save "${path}"`); }   // inferred: as ExportShaderCompound
  logNya(app, C, 'the worker body (error messages, preset registration); errors follow ExportShaderCompound and nothing is registered');
  a.Output = path; setStatus(app, C, S_OK);
  return path;
}
function importShaderTree(app: App, a: Record<string, any>) {
  const C = 'ImportShaderTree';
  a.CreatedShaders = [];
  const raw = text(a.Path); if (!raw) throw fail(E_INVALIDARG, `${C}: Path is empty`);
  const container = importContainer(app, C, a.Container);
  const file = resolveImport(app, C, raw, SHADER_TREE_TAG, 'Shaders', '.Preset');
  const d = (() => { try { return parseFile(hostFs.readFile(file)); } catch { return null; } })();
  if (!d || d.type !== SHADER_TREE_TAG || !d.tree) throw fail(E_FAIL, `${C}: "${file}" could not be loaded`);
  const byId = readShaders(d.tree.shaders ?? [], loadRef);
  const created = [...byId.values()];
  const names: string[] = [];
  for (const s of created) { s.name = uniqueNameIn(container, s.name, names); names.push(s.name); nestRec(app, container, s); }
  for (const p of d.tree.ports ?? []) { const ref = { owner: container, name: p.port }; const root = byId.get(p.root); if (root && portExists(ref)) connectRec(app, ref, root); }   // inferred: the saved ports are reconnected on the container
  a.CreatedShaders = created; setStatus(app, C, S_OK);
  return created;
}
function definitionShader(app: App, x: any): Shader | null {
  const n = nodeOf(app, x); if (n instanceof Shader) return n;
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim();
  return makeProgIdShader(s) ?? makePresetShader(s) ?? (SI_SHADERS[s] ? makePresetShader(s) : null);
}
function exportShaderDefinition(app: App, a: Record<string, any>) {
  const C = 'ExportShaderDefinition';
  const sh = definitionShader(app, listOf(a.ShaderDefinition)[0]);
  if (!sh || isCompound(sh)) throw fail(E_INVALIDARG, `${C}: ShaderDefinition does not resolve to a shader definition`);
  const path = text(a.FullPath);
  if (!writeOut(app, C, path, fileText('ShaderDefinition', { ShaderDefinition: definitionOf(sh) }))) throw fail(E_FAIL, `${C}: could not write "${path}"`);   // inferred status
  logNya(app, C, 'the worker body and the definition file format (stand-in JSON, element "ShaderDefinition")');
  a.Output = path; setStatus(app, C, S_OK);
  return path;
}
function parseNewDefinition(app: App, v: any): NewDefinition | null {
  const x = Array.isArray(v) ? v[0] : v;
  if (x instanceof Shader && !isCompound(x)) return { type: x.type, spdl: x.spdl, defs: x.params.map(p => cloneDef(p.def)), layout: x.layout as any };
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim();
  let file = ''; try { file = hostFs.normalize(s); } catch { /* not a path */ }
  if (file && hostFs.isFile(file)) {
    const d = (() => { try { return parseFile(hostFs.readFile(file)); } catch { return null; } })();
    const rec = d?.type === 'ShaderDefinition' ? d.ShaderDefinition : null; if (!rec || !Array.isArray(rec.defs)) return null;
    const spdl = rec.spdl ? SI_SHADERS[rec.spdl] : undefined;
    return { type: rec.type, spdl, defs: rec.defs.map(cloneDef), layout: undefined };
  }
  const n = nodeOf(app, s); if (n instanceof Shader && !isCompound(n)) return parseNewDefinition(app, n);
  return definitionFromProgId(s);
}
function replaceShadersDefinition(app: App, a: Record<string, any>) {
  const C = 'ReplaceShadersDefinition';
  const items = listOf(a.Shaders); const shaders = shadersArg(app, a.Shaders).filter(s => !isCompound(s));
  if (!shaders.length || shaders.length !== items.length || new Set(shaders.map(definitionId)).size !== 1) {
    const msg = 'Invalid Target instance was supplied. All targeted instances must share the same definition.';
    app.logMsg('error', `${C}: ${msg}`); throw fail(E_INVALIDARG, `${C}: ${msg}`);   // inferred status
  }
  const nd = parseNewDefinition(app, a.NewDefinition);
  if (!nd) { const msg = 'Failed to upgrade the shader. The new definition could not be parsed.'; app.logMsg('error', `${C}: ${msg}`); throw fail(E_FAIL, `${C}: ${msg}`); }
  const method = intOf(a.InvokeMethod, 2);
  if (method !== 2) logNya(app, C, `the meaning of InvokeMethod ${method}; handled like the default 2`);
  const lines: string[] = [];
  for (const s of shaders) for (const l of changeDefinitionRec(app, s, nd)) lines.push(`${s.name}.${l}`);
  logNya(app, C, 'the update rules and the log format (inferred: same-name values and existing ports keep their connections; one line per port)');
  const log = lines.join('\n'); a.OutputLog = log; setStatus(app, C, S_OK);
  return log;
}

// ------------------------------------------------------------------ registration

const NONE = null;
export const B12G_COMMANDS = ['CreateShaderCompound', 'NestShaders', 'UnnestShaders', 'AddShaderCompoundPort', 'RemoveShaderCompoundPort', 'MoveShaderCompoundPort',
  'RenameShaderCompoundPort', 'ExportShaderCompound', 'ImportShaderCompound', 'ExplodeShaderCompound', 'SetShaderCompoundProperties', 'SetShaderCompoundPortProperties',
  'GetShaderCompoundPortProperties', 'ExportShaderTree', 'ImportShaderTree', 'ExportShaderDefinition', 'ReplaceShadersDefinition'];

export function registerShadertasksB12gCommands(app: App) {
  const reg = (def: CommandDef) => app.register({ category: 'Rendering', ...def });
  reg({ name: 'CreateShaderCompound', label: 'Create Shader Compound', description: 'Creates a shader compound from shaders', args: [{ name: 'InputObj', default: NONE }, { name: 'Name', default: '' }], execute: (app, a) => createShaderCompound(app, a) });
  reg({ name: 'NestShaders', label: 'Nest Shaders', description: 'Moves shaders into a shader container', args: [{ name: 'InputObjs', default: NONE }, { name: 'ShaderContainer', default: NONE }], execute: (app, a) => nestShaders(app, a) });
  reg({ name: 'UnnestShaders', label: 'Unnest Shaders', description: 'Moves shaders out of their compound', args: [{ name: 'InputObjs', default: NONE }, { name: 'ShaderContainer', default: NONE }], execute: (app, a) => unnestShaders(app, a) });
  reg({ name: 'AddShaderCompoundPort', label: 'Add Shader Compound Port', description: 'Exposes a port of an inner shader on its compound', args: [{ name: 'ShaderPort', default: NONE }, { name: 'ShaderCompound', default: NONE }], execute: (app, a) => addShaderCompoundPort(app, a) });
  reg({ name: 'RemoveShaderCompoundPort', label: 'Remove Shader Compound Port', description: 'Removes an exposed port of a shader compound', args: [{ name: 'InputObj', default: NONE }], execute: (app, a) => removeShaderCompoundPort(app, a) });
  reg({ name: 'MoveShaderCompoundPort', label: 'Move Shader Compound Port', description: 'Moves an exposed port in the port order', args: [{ name: 'InputObj', default: NONE }, { name: 'Step', default: 1 }], execute: (app, a) => moveShaderCompoundPort(app, a) });
  reg({ name: 'RenameShaderCompoundPort', label: 'Rename Shader Compound Port', description: 'Renames an exposed port', args: [{ name: 'InputObj', default: NONE }, { name: 'Name', default: '' }, { name: 'DisplayName', default: '' }], execute: (app, a) => renameShaderCompoundPort(app, a) });
  reg({ name: 'ExportShaderCompound', label: 'Export Shader Compound', description: 'Saves a shader compound to a file', undoable: false, args: [{ name: 'Compound', default: NONE }, { name: 'FullPath', default: '' }, { name: 'ForceEmbedded', default: false }], execute: (app, a) => exportShaderCompound(app, a) });
  reg({ name: 'ImportShaderCompound', label: 'Import Shader Compound', description: 'Loads a shader compound file into a render tree container', args: [{ name: 'Container', default: NONE }, { name: 'Path', default: '' }], execute: (app, a) => importShaderCompound(app, a) });
  reg({ name: 'ExplodeShaderCompound', label: 'Explode Shader Compound', description: 'Moves the shaders out of a compound and deletes it', args: [{ name: 'InputObj', default: NONE }], execute: (app, a) => explodeShaderCompound(app, a) });
  reg({ name: 'SetShaderCompoundProperties', label: 'Set Shader Compound Properties', description: 'Sets the properties of a shader compound', args: [
    { name: 'InputObj', default: NONE }, { name: 'Name', default: '' }, { name: 'Category', default: '' }, { name: 'Description', default: '' }, { name: 'Author', default: '' },
    { name: 'Date', default: '' }, { name: 'VersionTag', default: '' }, { name: 'VersionMajor', default: 0 }, { name: 'VersionMinor', default: 0 }, { name: 'PPGLogic', default: '' },
    { name: 'PPGLogicLanguage', default: '' }, { name: 'BackgroundColor', default: 0 }, { name: 'ModifyFlags', default: 2047 }], execute: (app, a) => setShaderCompoundProperties(app, a) });
  reg({ name: 'SetShaderCompoundPortProperties', label: 'Set Shader Compound Port Properties', description: 'Sets the properties of an exposed port', args: [
    { name: 'InputObj', default: NONE }, { name: 'PPGMinValue', default: '' }, { name: 'PPGMaxValue', default: '' }, { name: 'PPGEnumValues', default: '' }, { name: 'PPGLayoutVisible', default: false },
    { name: 'PPGLayoutGroup', default: '' }, { name: 'PPGLayoutTab', default: '' }, { name: 'RTLayoutVisible', default: false }, { name: 'RTLayoutGroup', default: '' }, { name: 'ModifyFlags', default: 255 }],
    execute: (app, a) => setShaderCompoundPortProperties(app, a) });
  reg({ name: 'GetShaderCompoundPortProperties', label: 'Get Shader Compound Port Properties', description: 'Returns the properties of an exposed port', undoable: false, args: [{ name: 'InputObj', default: NONE }], execute: (app, a) => getShaderCompoundPortProperties(app, a) });
  reg({ name: 'ExportShaderTree', label: 'Export Shader Tree', description: 'Saves a shader tree to a file', undoable: false, args: [{ name: 'Shaders', default: NONE }, { name: 'FullPath', default: '' }, { name: 'DisplayName', default: '' }, { name: 'Category', default: '' }, { name: 'ForceEmbedded', default: false }], execute: (app, a) => exportShaderTree(app, a) });
  reg({ name: 'ImportShaderTree', label: 'Import Shader Tree', description: 'Loads a shader tree file into a render tree container', args: [{ name: 'Container', default: NONE }, { name: 'Path', default: '' }], execute: (app, a) => importShaderTree(app, a) });
  reg({ name: 'ExportShaderDefinition', label: 'Export Shader Definition', description: 'Writes a shader definition to a file', undoable: false, args: [{ name: 'ShaderDefinition', default: NONE }, { name: 'FullPath', default: '' }], execute: (app, a) => exportShaderDefinition(app, a) });
  reg({ name: 'ReplaceShadersDefinition', label: 'Replace Shaders Definition', description: 'Rebuilds shader instances on a new definition', args: [{ name: 'Shaders', default: NONE }, { name: 'NewDefinition', default: NONE }, { name: 'InvokeMethod', default: 2 }], execute: (app, a) => replaceShadersDefinition(app, a) });
}
