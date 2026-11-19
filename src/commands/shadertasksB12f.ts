// Ledger row CMD-B12f (shadertasks.dll): shader object arrays, connection points, replace, instance data, rebind.
//   AddObjectsToShader RemoveObjectsFromShader RemoveShaderFromCnxPoint RemoveAllShadersFromCnxPoint UIMapButton
//   SIGetMaterialShader ReplaceShader ReplaceShaderWithPreset ReplaceShaderWithProgID SetInstanceDataValue
//   SIRebindByNameUserData RenamePropAndRebind_Internal
// Brief: docs/ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md, section 3. Original code from that prose only.
// Conventions (statuses, stand-ins, undo) are described in shadertasksB12Shared.ts.
import { App, CommandDef } from '../core/commands';
import { Node, Shader, Material, X3DObject, Property } from '../core/scene';
import type { ParamDef } from '../core/params';
import type { SiShaderDef } from '../core/shaders';
import {
  type PortRef, getSource, setSourceRaw, currentMaterial, makePresetShader, makeProgIdShader, isImageClip, uniqueNameIn,
  allMaterials, containerShaders, TextureLayer,
} from '../core/textureLayers';
import { applySelectionFilter } from './textureLayers';
import { isCompound, cloneDef } from '../core/shaderCompound';
import {
  S_OK, S_FALSE, SI_ABORT, E_INVALIDARG, E_POINTER, E_FAIL, NOTE_F,
  stateOf, fail, setStatus, raise, logNya, text, unset, boolOf, intOf, listOf, nodeOf, nodesOf, portOf,
  portLocked, lockError, connectRec, nestRec, usersOf, containerOf, deleteShaderRec, owningObject, isShaderLike, allShaders,
} from './shadertasksB12Shared';

// ------------------------------------------------------------------ object arrays (AddObjectsToShader / RemoveObjectsFromShader)

/** The shader-object-array check. // inferred: every shader node of this build carries the "objects" array. */
const hasObjectArray = (n: any): n is Shader => n instanceof Shader;
function arrayOf(app: App, sh: Shader): (Node | null)[] { const m = stateOf(app).objectArrays; let a = m.get(sh); if (!a) m.set(sh, a = []); return a; }
/** SIAddArrayElement sub-task: appends an empty element and returns its index. */
function siAddArrayElement(app: App, sh: Shader): number {
  const arr = arrayOf(app, sh); const idx = arr.length;
  app.record('SIAddArrayElement', () => { arr.splice(idx, 0, null); }, () => { arr.splice(idx, 1); });
  return idx;
}
/** SetReference2 sub-task: element (component kind 0x402, index) -> reference to the object. */
function setReference2(app: App, sh: Shader, idx: number, obj: Node | null) {
  const arr = arrayOf(app, sh); const old = arr[idx] ?? null;
  app.record('SetReference2', () => { arr[idx] = obj; }, () => { arr[idx] = old; });
}
function siRemoveArrayElement(app: App, sh: Shader, idx: number) {
  const arr = arrayOf(app, sh); const old = arr[idx] ?? null;
  app.record('SIRemoveArrayElement', () => { arr.splice(idx, 1); }, () => { arr.splice(idx, 0, old); });
}
function objectArrayArgs(app: App, C: string, a: Record<string, any>): { items: any[]; shader: Shader } {
  if (unset(a.InputObjs)) throw fail(E_INVALIDARG, `${C}: InputObjs is required`);
  const t = listOf(a.Target); const shader = t.length ? nodeOf(app, t[0]) : null;
  if (!shader) throw fail(E_INVALIDARG, `${C}: Target does not resolve to a shader`);
  if (!hasObjectArray(shader)) throw fail(E_INVALIDARG, `${C}: ${shader.name} has no object array`);
  return { items: listOf(a.InputObjs), shader };
}
function addObjectsToShader(app: App, a: Record<string, any>) {
  const C = 'AddObjectsToShader';
  const { items, shader } = objectArrayArgs(app, C, a);
  for (const it of items) {
    const obj = nodeOf(app, it);   // inferred: an item that does not resolve becomes an element referencing nothing
    const idx = siAddArrayElement(app, shader);
    setReference2(app, shader, idx, obj);
  }
  setStatus(app, C, S_OK);
}
function removeObjectsFromShader(app: App, a: Record<string, any>) {
  const C = 'RemoveObjectsFromShader';
  const { items, shader } = objectArrayArgs(app, C, a);
  for (const it of items) {
    const obj = nodeOf(app, it);
    const arr = arrayOf(app, shader);
    for (let i = arr.length - 1; i >= 0; i--) {   // walked from the end so the recorded indices stay valid
      const el = arr[i];
      if ((obj && el === obj) || (!el && !obj)) siRemoveArrayElement(app, shader, i);
    }
  }
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ connection points

/** Disconnect `src` from the given points (lock-checked); returns the number of points disconnected. */
function disconnectFrom(app: App, C: string, src: Node, points: PortRef[]): number {
  let n = 0;
  for (const p of points) {
    if (portLocked(app, p)) { lockError(app, C, `${p.owner.name}.${p.name}`); continue; }
    if (getSource(p) !== src) continue;
    connectRec(app, p, null); n++;
  }
  return n;
}
/** The RemoveShaderFromCnxPoint worker; `del` = DeleteOnLastDisconnection. Returns [status, CreatedObj]. */
function removeFromCnxPoints(app: App, C: string, src: Node, points: PortRef[], del: boolean): [number, Node | null] {
  const n = disconnectFrom(app, C, src, points);
  if (!n) return [S_FALSE, null];
  if (del && src instanceof Shader && !usersOf(app, src).length) { deleteShaderRec(app, src); return [S_OK, null]; }
  if (del && isImageClip(src)) return [S_OK, usersOf(app, src).length ? src : null];   // inferred: image clips stay in the scene's clip list
  return [S_OK, src];
}
function removeShaderFromCnxPoint(app: App, a: Record<string, any>) {
  const C = 'RemoveShaderFromCnxPoint';
  if (unset(a.InputObjs) || unset(a.Source)) throw fail(E_INVALIDARG, `${C}: Source and InputObjs are required`);
  const src = nodesOf(app, a.Source).find(n => n instanceof Shader) ?? null;
  if (!src) throw fail(E_INVALIDARG, `${C}: Source holds no shader`);
  const points = listOf(a.InputObjs).map(x => portOf(app, x)).filter((p): p is PortRef => !!p);
  const [st, created] = removeFromCnxPoints(app, C, src, points, boolOf(a.DeleteOnLastDisconnection, true));
  a.CreatedObj = created; setStatus(app, C, st);
  return created;
}
// siShaderCnxPointType (note: bit 1 shader nodes, bit 2 image clips, inferred); the registry default is siShaderCnxPointAll
const CNX_TYPE: Record<string, number> = { siShaderCnxPointNone: 0, siShaderCnxPointBasePorts: 1, siShaderCnxPointTextureLayerPorts: 2, siShaderCnxPointAll: 0xffff };
function removeAllShadersFromCnxPoint(app: App, a: Record<string, any>) {
  const C = 'RemoveAllShadersFromCnxPoint';
  if (unset(a.InputObjs)) throw fail(E_INVALIDARG, `${C}: InputObjs is required`);
  const t = intOf(typeof a.Type === 'string' && CNX_TYPE[String(a.Type).replace(/^:([^:]+):.*$/, '$1')] !== undefined ? CNX_TYPE[String(a.Type).replace(/^:([^:]+):.*$/, '$1')] : a.Type, 0xffff);
  if (!(t & 3)) throw fail(E_INVALIDARG, `${C}: Type ${t} selects neither shaders nor image clips`);
  const removed: Node[] = [];
  for (const x of listOf(a.InputObjs)) {
    const p = portOf(app, x); if (!p) { app.logMsg('error', `${C}: ${text(x)} is not a connection point`); break; }   // unresolved -> stop
    if (portLocked(app, p)) { lockError(app, C, `${p.owner.name}.${p.name}`); continue; }
    // the undo branch: candidates are shader nodes / texture-layer-like objects (image clips count as shader nodes here)
    const s = getSource(p); if (!s || !isShaderLike(s)) continue;
    const clip = isImageClip(s);
    if (!((t & 1 && !clip) || (t & 2 && clip))) continue;
    removeFromCnxPoints(app, 'RemoveShaderFromCnxPoint', s, [p], false);   // sub-task, DeleteOnLastDisconnection false
    removed.push(s);
  }
  setStatus(app, C, S_OK);
  return removed;
}

// ------------------------------------------------------------------ UIMapButton

function popupAnchor(app: App): { x: number; y: number } {
  const st = stateOf(app); const { x, y } = st.pointer;
  try {
    const el = document.elementFromPoint(x, y)?.closest('button');
    if (el) { const r = el.getBoundingClientRect(); return { x: Math.round(r.right), y: Math.round(r.top + r.height / 3) }; }
  } catch { /* no DOM */ }
  return { x, y };
}
function uiMapButton(app: App, a: Record<string, any>) {
  const C = 'UIMapButton';
  const st = stateOf(app);
  const flags = intOf(a.Flags, 0);
  const anchor = popupAnchor(app);   // UnPackArg: never fails
  const items = unset(a.InputObjs) ? [...app.selection] : nodesOf(app, a.InputObjs);
  const filtered = applySelectionFilter(String(a.Type ?? ''), items);
  const input = filtered.accepted[0] ?? null;
  if (!input) throw fail(E_POINTER, `${C}: no input object`);
  logNya(app, C, `the items of the shader pop-up menu (C3DShaderMenuHelper) for ${input.name} and the meaning of Flags=${flags}; an empty menu is shown`);
  let picked: number | null = null; let guard = 0; let status = S_FALSE;
  do {
    const items: string[] = [];   // the helper's items are not attested
    const r = st.hooks.popupMenu?.(items, anchor, C);
    if (r === SI_ABORT) { status = SI_ABORT; break; }   // the helper's interactive-pick result is passed back
    picked = typeof r === 'number' && r >= 0 && r < items.length ? r : null;
    st.popups.push({ command: C, anchor, items, picked, flags });
    if (picked === null) break;
  } while (st.keyboard.shift && ++guard < 64);   // repeats while Shift is held and the item asks to stay open
  setStatus(app, C, status);
  return undefined;
}

// ------------------------------------------------------------------ SIGetMaterialShader

// inferred: siMaterialPorts numbering in SDK order; the parameter each number reads is not attested past the name list
export const MATERIAL_PORTS = ['surface', 'volume', 'environment', 'contour', 'displacement', 'shadow', 'photon', 'photonvolume', 'normal', 'lightmap'];
const MATERIAL_PORT_NAMES: Record<string, number> = {
  siMaterialPortSurface: 0, siMaterialPortVolume: 1, siMaterialPortEnvironment: 2, siMaterialPortContour: 3, siMaterialPortDisplacement: 4,
  siMaterialPortShadow: 5, siMaterialPortPhoton: 6, siMaterialPortPhotonVolume: 7, siMaterialPortBumpMap: 8, siMaterialPortLightMap: 9,
};
function siGetMaterialShader(app: App, a: Record<string, any>) {
  const C = 'SIGetMaterialShader';
  const raw = typeof a.Port === 'string' ? String(a.Port).replace(/^:([^:]+):.*$/, '$1') : a.Port;
  const port = typeof raw === 'string' && MATERIAL_PORT_NAMES[raw] !== undefined ? MATERIAL_PORT_NAMES[raw] : intOf(raw, 0);
  if (port > 9 || port < 0) throw fail(E_INVALIDARG, `${C}: Port ${port} is out of range`);
  const inputs = unset(a.InputObjs) ? [...app.selection] : nodesOf(app, a.InputObjs);   // inferred: the selection by default
  const out: Node[] = [];
  let empty = 0;
  for (const n of inputs) {
    const m = n instanceof Material ? n : n instanceof X3DObject ? currentMaterial(app.scene, n) : null;
    if (!m) continue;
    const s = getSource({ owner: m, name: MATERIAL_PORTS[port] });
    if (s) out.push(s); else empty++;
  }
  if (port !== 0) logNya(app, C, `the parameter port ${port} reads (inferred: ${MATERIAL_PORTS[port]})`);
  if (empty) logNya(app, C, `what is appended for an unconnected port; ${empty} material(s) contributed nothing`);
  a.OutputObjs = out; setStatus(app, C, S_OK);
  return out;
}

// ------------------------------------------------------------------ ReplaceShader

/** The replace worker: users of `src` move to `dst`, then `src` goes. */
export function replaceShaderWorker(app: App, C: string, src: Shader | null, dst: Shader | null) {
  if (!src || !dst || src === dst) throw fail(E_INVALIDARG, `${C}: Source and Target must be two different shaders`);
  const srcHome = containerOf(app, src);
  const users = usersOf(app, src);
  const dstUsers = usersOf(app, dst);
  const dstHome = containerOf(app, dst);
  // inferred reading of "the source is the only user path and the target is still attached elsewhere"
  if (dstUsers.length && dstHome && srcHome && dstHome !== srcHome) {
    raise(app, C, 0x40, `${dst.name} is attached in another shader container`);
    throw fail(E_FAIL, `${C}: ${dst.name} is attached in another shader container`);
  }
  const targetWasFree = !dstUsers.length;
  if (srcHome && !dstHome) nestRec(app, srcHome, dst);
  for (const r of users) connectRec(app, r, dst);
  if (targetWasFree) {
    // transfer helpers (0x180035230 / 0x180035450): inferred rules: same-name inputs move, same-name same-type values copy
    for (const name of [...src.inputs.keys()]) {
      const s = getSource({ owner: src, name }); if (!s || !dst.get(name) || getSource({ owner: dst, name })) continue;
      connectRec(app, { owner: src, name }, null); connectRec(app, { owner: dst, name }, s);
    }
    for (const p of src.params) { const q = dst.get(p.name); if (q && q.def.type === p.def.type && !q.def.readOnly) app.setParam(q, Array.isArray(p.value) ? [...p.value] : p.value); }
    logNya(app, C, 'the exact rules of the input / value transfer helpers; same-name inputs and same-name, same-type values were moved');
  }
  deleteShaderRec(app, src);
}
function replaceShader(app: App, a: Record<string, any>) {
  const C = 'ReplaceShader';
  const tItems = listOf(a.Target); const dst = nodeOf(app, tItems[0]);
  const listMode = Array.isArray(a.Target) || tItems.length > 1;   // inferred: "Target resolves as a list form"
  if (!listMode) {
    const src = nodeOf(app, listOf(a.Source)[0]);
    if (!(src instanceof Shader)) throw fail(E_INVALIDARG, `${C}: Source is not a shader`);
    replaceShaderWorker(app, C, src, dst instanceof Shader ? dst : null);
  } else {
    if (!(dst instanceof Shader)) throw fail(E_INVALIDARG, `${C}: Target is not a shader`);
    const objs = nodesOf(app, a.Source); if (!objs.length) throw fail(E_INVALIDARG, `${C}: Source is empty`);
    for (const o of objs) {
      // the shader the object uses (query ab9c2622-...): inferred: a shader itself, else its material's surface shader
      const used = o instanceof Shader ? o : o instanceof Material ? o.surface : o instanceof X3DObject ? currentMaterial(app.scene, o)?.surface ?? null : null;
      if (used && used !== dst) replaceShaderWorker(app, C, used, dst);
    }
  }
  setStatus(app, C, S_OK);
  return dst;
}
function replaceShaderWithPreset(app: App, a: Record<string, any>) {
  const C = 'ReplaceShaderWithPreset';
  if (unset(a.Source) || unset(a.PresetObj)) throw fail(E_INVALIDARG, `${C}: Source and PresetObj are required`);
  const src = nodeOf(app, listOf(a.Source)[0]);
  if (!(src instanceof Shader)) throw fail(E_INVALIDARG, `${C}: Source is not a shader`);
  const p = Array.isArray(a.PresetObj) ? a.PresetObj[0] : a.PresetObj;
  const presetName = p instanceof Node ? ((p as any).data?.name ?? (p as any).file ?? p.name) : p;   // a CreatePreset object or a preset name
  const sh = makePresetShader(presetName);
  if (!sh) throw fail(E_INVALIDARG, `${C}: no shader could be built from preset "${text(presetName)}"`);
  const home = containerOf(app, src);
  if (home) { sh.name = uniqueNameIn(home, sh.name); nestRec(app, home, sh); }
  replaceShaderWorker(app, 'ReplaceShader', src, sh);   // the ReplaceShader sub-task
  setStatus(app, C, S_OK);
  return sh;
}

// ------------------------------------------------------------------ definition swap (ReplaceShaderWithProgID, ReplaceShadersDefinition)

export interface NewDefinition { type: string; spdl?: SiShaderDef; defs: ParamDef[]; layout?: any[] }
/** The "change definition" sub-task: rebuilds the shader's parameters on a new definition, in place. Values of
 *  same-name same-type parameters and connections of ports that still exist are kept (inferred). Returns the log. */
export function changeDefinitionRec(app: App, sh: Shader, nd: NewDefinition): string[] {
  const s = sh as any; const log: string[] = [];
  const before = { type: s.type, spdl: s.spdl, layout: s.layout, params: [...sh.params], byName: new Map(s.byName) };
  const cons = [...new Set([...sh.inputs.keys(), ...sh.params.map(p => p.name)])].map(name => [name, getSource({ owner: sh, name })] as const).filter(([, v]) => !!v) as [string, Node][];
  const oldBy = new Map(sh.params.map(p => [p.name, p]));
  const plan = nd.defs.map(d => { const o = oldBy.get(d.name); const keep = !!o && o.def.type === d.type; log.push(`${d.name}: ${o ? keep ? 'kept' : 'type changed, reset' : 'added'}`); return { def: cloneDef(d), value: keep ? o!.value : undefined }; });
  for (const p of sh.params) if (!nd.defs.some(d => d.name === p.name)) log.push(`${p.name}: removed`);
  let after: { params: any[]; byName: Map<string, any> } | null = null;
  const keptCons = cons.filter(([name]) => nd.defs.some(d => d.name === name) || !!nd.spdl?.params.some(p => p.sn === name && p.dir === 'input'));
  const apply = () => {
    for (const [name] of cons) setSourceRaw({ owner: sh, name }, null);
    s.type = nd.type; s.spdl = nd.spdl; s.layout = nd.layout;
    if (!after) {
      sh.params.splice(0); s.byName = new Map();
      for (const p of plan) { const np = sh.add(p.def); if (p.value !== undefined) np.value = Array.isArray(p.value) ? [...p.value] : p.value; }
      after = { params: [...sh.params], byName: new Map(s.byName) };
    } else { sh.params.splice(0, sh.params.length, ...after.params); s.byName = new Map(after.byName); }
    for (const [name, src] of keptCons) setSourceRaw({ owner: sh, name }, src);
  };
  const revert = () => {
    for (const [name] of keptCons) setSourceRaw({ owner: sh, name }, null);
    s.type = before.type; s.spdl = before.spdl; s.layout = before.layout;
    sh.params.splice(0, sh.params.length, ...before.params); s.byName = new Map(before.byName);
    for (const [name, src] of cons) setSourceRaw({ owner: sh, name }, src);
  };
  app.record('Change shader definition', apply, revert);
  for (const [name] of cons) if (!keptCons.some(([n]) => n === name)) log.push(`${name}: connection removed`);
  return log;
}
export function definitionFromProgId(progId: string): NewDefinition | null {
  const t = makeProgIdShader(progId); if (!t) return null;
  return { type: t.type, spdl: t.spdl, defs: t.params.map(p => cloneDef(p.def)), layout: t.layout as any };
}
function replaceShaderWithProgID(app: App, a: Record<string, any>) {
  const C = 'ReplaceShaderWithProgID';
  const sh = nodeOf(app, listOf(a.ShaderToReplace)[0]);
  const progId = typeof a.ProgID === 'string' ? a.ProgID.trim() : '';
  if (!(sh instanceof Shader) || isCompound(sh) || !progId) throw fail(E_INVALIDARG, `${C}: ShaderToReplace must be a shader and ProgID a non-empty string`);
  const nd = definitionFromProgId(progId);   // the shader-definition manager lookup
  if (!nd) throw fail(E_INVALIDARG, `${C}: no shader definition for ProgID "${progId}"`);
  changeDefinitionRec(app, sh, nd);
  logNya(app, C, 'what the definition swap keeps (inferred to match ReplaceShadersDefinition: same-name values and still-existing connections)');
  setStatus(app, C, S_OK);
  return sh;
}

// ------------------------------------------------------------------ SetInstanceDataValue

function setInstanceDataValue(app: App, a: Record<string, any>) {
  const C = 'SetInstanceDataValue';
  const sel = unset(a.InputObjs) || /^\{7834CB8C-5252-11d2-A5CC-00A0C91412DE\}:?$/i.test(String(a.InputObjs));
  const holders = sel ? [...app.selection] : nodesOf(app, a.InputObjs);
  const obj = unset(a.InputObj) ? null : nodeOf(app, listOf(a.InputObj)[0]);
  if (!holders.length || !obj) throw fail(E_POINTER, `${C}: ${!holders.length ? 'no instance-data holder' : 'InputObj does not resolve'}`);
  const owner = owningObject(obj) ?? obj;
  const store = stateOf(app).instanceData;
  for (const h of holders) {   // inferred: every holder of the list gets the value
    let m = store.get(h); if (!m) store.set(h, m = new Map());
    const map = m; const had = map.has(owner); const old = map.get(owner); const v = a.Value;
    app.record('SetInstanceDataValue', () => { map.set(owner, v); }, () => { if (had) map.set(owner, old); else map.delete(owner); });
  }
  if (holders.length > 1) logNya(app, C, 'how a list of holders is walked; each holder got the value');
  logNya(app, C, 'what kind of instance data (texture projection / user data) slot 0x50 writes; the value is kept per holder and object');
  setStatus(app, C, S_OK);
}

// ------------------------------------------------------------------ SIRebindByNameUserData / RenamePropAndRebind_Internal

/** String parameters of a material and of every shader in it (the "shader references" of the rebind helpers, inferred). */
function referenceParams(m: Material | null) {
  const owners: Node[] = m ? [m, ...containerShaders(m)] : [];
  const out: { p: any; owner: Node }[] = [];
  for (const o of owners) for (const p of o.params) if (p.def.type === 'string' && !p.def.readOnly && typeof p.value === 'string' && p.value) out.push({ p, owner: o });
  return out;
}
function siRebindByNameUserData(app: App, a: Record<string, any>) {
  const C = 'SIRebindByNameUserData';
  const m = nodeOf(app, listOf(a.Material)[0]);
  if (!(m instanceof Material)) throw fail(E_POINTER, `${C}: Material is not a material`);
  const srcRaw = a['Source User Data Collection'], dstRaw = a['Target User Data Collection'];
  const src = nodesOf(app, srcRaw), dst = nodesOf(app, dstRaw);
  if (unset(srcRaw) || unset(dstRaw) || src.length !== listOf(srcRaw).length || dst.length !== listOf(dstRaw).length) throw fail(E_INVALIDARG, `${C}: the user data collections do not resolve`);
  const byName = new Map(dst.map(d => [d.name, d]));   // the name map
  let rebound = 0, orphans = 0;
  for (const s of src) {
    const d = byName.get(s.name); if (!d) { orphans++; continue; }
    for (const { p } of referenceParams(m)) {
      if (p.value === s.fullName) { app.setParam(p, d.fullName); rebound++; }
      else if (p.value === s.name && d.name !== s.name) { app.setParam(p, d.name); rebound++; }
    }
  }
  logNya(app, C, `the matching rule and the fate of entries with no partner (${orphans} left as they were); ${rebound} reference(s) rebound by full name`);
  setStatus(app, C, S_OK);
}
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
function renamePropAndRebind(app: App, a: Record<string, any>) {
  const C = 'RenamePropAndRebind_Internal';
  if (unset(a.Properties)) throw fail(E_INVALIDARG, `${C}: Properties is required`);
  if (typeof a.PropertyName !== 'string') throw fail(E_INVALIDARG, `${C}: PropertyName is not a string`);
  const props = nodesOf(app, a.Properties);
  const name = a.PropertyName;
  const updateRefs = boolOf(a.UpdateRefs, true), updateWild = boolOf(a.UpdateWildcards, true);
  for (const p of props) {
    const siblings: Node[] = ((p.parent as any)?.properties ?? []).filter((x: Node) => x !== p);
    // name check (inferred condition): a valid script name not used by a sibling
    if (!VALID_NAME.test(name) || siblings.some(s => s.name === name)) { raise(app, C, 0x6f, name); throw fail(E_FAIL, `${C}: "${name}" is not a valid name for ${p.name}`); }
    const oldName = p.name, oldFull = p.fullName;
    // the SetValue sub-task on <property>.Name
    const old = p.name; app.record('SetValue', () => { p.name = name; }, () => { p.name = old; });
    if (updateRefs) {
      const newFull = p.fullName;
      for (const m of allMaterials(app.scene)) for (const { p: q } of referenceParams(m)) {
        if (q.value === oldFull) app.setParam(q, newFull);
        else if (q.value === oldName) app.setParam(q, name);
        else if (typeof q.value === 'string' && q.value.endsWith('.' + oldName) && !/[*?]/.test(q.value)) app.setParam(q, q.value.slice(0, -oldName.length) + name);
      }
    }
    if (updateWild) logNya(app, C, `the wildcard reference rewrite rules; wildcard references to "${oldName}" were left as they were`);
  }
  setStatus(app, C, S_OK);
  return props;
}

// ------------------------------------------------------------------ registration

const NONE = null;
export const B12F_COMMANDS = ['AddObjectsToShader', 'RemoveObjectsFromShader', 'RemoveShaderFromCnxPoint', 'RemoveAllShadersFromCnxPoint', 'UIMapButton',
  'SIGetMaterialShader', 'ReplaceShader', 'ReplaceShaderWithPreset', 'ReplaceShaderWithProgID', 'SetInstanceDataValue', 'SIRebindByNameUserData', 'RenamePropAndRebind_Internal'];
export const UIMAPBUTTON_FILTER = 'sceneobject,cluster,group,layer,~chain_element,~camera,~control_object,~curve,~light,~null,max=1,min=1';

export function registerShadertasksB12fCommands(app: App) {
  const st = stateOf(app);
  try { window.addEventListener('mousemove', e => { st.pointer = { x: e.clientX, y: e.clientY }; st.keyboard.shift = e.shiftKey; }, { passive: true }); } catch { /* no DOM */ }
  const reg = (def: CommandDef) => app.register({ category: 'Rendering', ...def });
  reg({ name: 'AddObjectsToShader', label: 'Add Objects To Shader', description: 'Adds objects to the object list of a shader', args: [{ name: 'InputObjs', default: NONE }, { name: 'Target', default: NONE }], execute: (app, a) => addObjectsToShader(app, a) });
  reg({ name: 'RemoveObjectsFromShader', label: 'Remove Objects From Shader', description: 'Removes objects from the object list of a shader', args: [{ name: 'InputObjs', default: NONE }, { name: 'Target', default: NONE }], execute: (app, a) => removeObjectsFromShader(app, a) });
  reg({ name: 'RemoveShaderFromCnxPoint', label: 'Remove Shader From Connection Point', description: 'Disconnects a shader from connection points', args: [{ name: 'Source', default: NONE }, { name: 'InputObjs', default: NONE }, { name: 'DeleteOnLastDisconnection', default: true }], execute: (app, a) => removeShaderFromCnxPoint(app, a) });
  reg({ name: 'RemoveAllShadersFromCnxPoint', label: 'Remove All Shaders From Connection Point', description: 'Disconnects every shader from connection points', args: [{ name: 'InputObjs', default: NONE }, { name: 'Type', default: ':siShaderCnxPointAll:siShaderCnxPointType' }], execute: (app, a) => removeAllShadersFromCnxPoint(app, a) });
  // registered twice in Softimage (Flags defaults 0 and 1, same task); the bus keeps one name: the first registration
  reg({ name: 'UIMapButton', label: 'UIMapButton', description: 'Shader pop-up menu of a map button', undoable: false, args: [{ name: 'InputObjs', default: NONE }, { name: 'Flags', default: 0 }, { name: 'Type', default: UIMAPBUTTON_FILTER }], execute: (app, a) => uiMapButton(app, a) });
  (st as any).uiMapButton1 = (args: Record<string, any> = {}) => app.run('UIMapButton', { Flags: 1, ...args });
  reg({ name: 'SIGetMaterialShader', label: 'Get Material Shader', description: 'Returns the shader connected to a material port', undoable: false, args: [{ name: 'InputObjs', default: NONE }, { name: 'Port', default: ':siMaterialPortSurface:siMaterialPorts' }], execute: (app, a) => siGetMaterialShader(app, a) });
  reg({ name: 'ReplaceShader', label: 'Replace Shader', description: 'Replaces a shader by another one', args: [{ name: 'Source', default: NONE }, { name: 'Target', default: NONE }], execute: (app, a) => replaceShader(app, a) });
  reg({ name: 'ReplaceShaderWithPreset', label: 'Replace Shader With Preset', description: 'Replaces a shader by a new shader built from a preset', args: [{ name: 'Source', default: NONE }, { name: 'PresetObj', default: NONE }], execute: (app, a) => replaceShaderWithPreset(app, a) });
  reg({ name: 'ReplaceShaderWithProgID', label: 'Replace Shader With ProgID', description: 'Changes the definition of a shader', args: [{ name: 'ShaderToReplace', default: NONE }, { name: 'ProgID', default: '' }], execute: (app, a) => replaceShaderWithProgID(app, a) });
  reg({ name: 'SetInstanceDataValue', label: 'Set Instance Data Value', description: 'Sets the per-object instance value of a shader or property', args: [{ name: 'InputObjs', default: '{7834CB8C-5252-11d2-A5CC-00A0C91412DE}:' }, { name: 'InputObj', default: NONE }, { name: 'Value', default: NONE }], execute: (app, a) => setInstanceDataValue(app, a) });
  reg({ name: 'SIRebindByNameUserData', label: 'Rebind User Data By Name', description: 'Rebinds the user data references of a material by name', args: [{ name: 'Material', default: NONE }, { name: 'Source User Data Collection', default: NONE }, { name: 'Target User Data Collection', default: NONE }], execute: (app, a) => siRebindByNameUserData(app, a) });
  reg({ name: 'RenamePropAndRebind_Internal', label: 'RenamePropAndRebind_Internal', description: 'Renames properties and updates the shader references to them', args: [{ name: 'Properties', default: NONE }, { name: 'PropertyName', default: '' }, { name: 'UpdateRefs', default: true }, { name: 'UpdateWildcards', default: true }], execute: (app, a) => renamePropAndRebind(app, a) });
  void NOTE_F; void allShaders; void TextureLayer; void Property; void E_FAIL;
}
