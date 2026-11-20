// Ledger row CMD-B14e (Face Robot `FR.dll`): export stubs, game shader, weight clipping, shake fit, crawl to vertex,
// deformer / weight-map transfer, duplicate face, envelope aliasing and game hierarchy export. Brief: the "Wire contract"
// sections of docs/ghidra/cmd-b14e-fr-export-weights.md and docs/re/WIRE_CORRECTIONS_B14.md item 7. Original code written
// from that prose only; no XSIBATCH golden exists. The tongue / mouth commands are in faceRobotB14eTongue.ts.
//
// Stand-ins of this build: envelope weights are the EnvelopeOperator's per-point weights (normalised to 1; the FR
// commands work in percent, so they are scaled by 100 and back). Weight maps are `weightmap` properties on a point
// cluster (values: point -> weight).
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property, Model, Cluster, Material } from '../core/scene';
import { num, bool } from '../core/params';
import { envelopeOf, EnvelopeOperator } from '../core/envelope';
import { imageClips } from '../core/textureLayers';
import {
  frStore, faceMesh, faceModel, entryObject, unset, listOf, numArg, intArg, boolArg, arrayArg, objArg, resolve, findByName,
  fail, failLog, progress, msgBox, E_FAIL, DISP_E_MEMBERNOTFOUND, S_OK, addObject, isInScene,
} from './faceRobotB14Shared';
import { CAT, de, nyaE, wrap, deleteNode, setStatus, userDataBlob, reparent } from './faceRobotB14deShared';
import { registerFaceRobotB14eTongueCommands } from './faceRobotB14eTongue';

const sArg = (v: any) => (unset(v) ? '' : String(v));

// ------------------------------------------------------------------ weights (percent)
/** fr_ClipWeights' per-point rule on one block of weights in percent (in place). */
export function clipBlock(w: number[], clip: number) {
  const pos = w.map((v, i) => i).filter(i => w[i] > 0).sort((a, b) => w[b] - w[a]);
  if (pos.length > clip) {
    let R = 0; for (const i of pos.slice(clip)) { R += w[i]; w[i] = 0; }
    const kept = pos.slice(0, clip);
    if (R < 100) for (const i of kept) w[i] *= 100 / (100 - R);
    const sum = kept.reduce((s, i) => s + w[i], 0);
    if (kept.length && sum !== 100) w[kept[0]] += 100 - sum;
  } else if (pos.length) {
    // fewer deformers than the clip: steps 4 and 5 still run with R = 0
    const sum = pos.reduce((s, i) => s + w[i], 0);
    if (sum !== 100) w[pos[0]] += 100 - sum;
  }
}
function envelopeArray(op: EnvelopeOperator): number[] { const out: number[] = []; for (const w of op.weights) for (let k = 0; k < op.deformers.length; k++) out.push((w?.[k] ?? 0) * 100); return out; }
function putEnvelopeArray(app: App, op: EnvelopeOperator, owner: X3DObject, arr: number[]) {
  const D = op.deformers.length; const old = op.weights.map(w => Float32Array.from(w ?? []));
  const next = op.weights.map((_, i) => Float32Array.from(arr.slice(i * D, i * D + D).map(v => v / 100)));
  app.record('PutArray', () => { op.weights = next.map(w => Float32Array.from(w)); if (owner.primitive) owner.primitive.dirty = true; }, () => { op.weights = old.map(w => Float32Array.from(w)); if (owner.primitive) owner.primitive.dirty = true; });
}
/** Point positions of an object in global space. */
function globalPoints(o: X3DObject): THREE.Vector3[] {
  const m = o.primitive?.mesh(); if (!m) return []; const g = o.globalMatrix(); const out: THREE.Vector3[] = [];
  for (let i = 0; i < m.positions.length; i += 3) out.push(new THREE.Vector3(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(g));
  return out;
}
/** Closest-point correspondence with 3 samples (inferred): per target point, the 3 nearest source points and
 *  inverse-distance weights. */
function correspondence(src: THREE.Vector3[], tgt: THREE.Vector3[]): [number, number][][] {
  return tgt.map(p => {
    const d = src.map((q, i) => [i, p.distanceTo(q)] as [number, number]).sort((a, b) => a[1] - b[1]).slice(0, 3);
    if (d.length && d[0][1] < 1e-9) return [[d[0][0], 1]];
    const inv = d.map(([i, x]) => [i, 1 / x] as [number, number]); const s = inv.reduce((a, [, w]) => a + w, 0);
    return inv.map(([i, w]) => [i, w / s] as [number, number]);
  });
}

/** The transfer engine of fr_DeformerToWeightMap / fr_DeformerTransfer (weight-map path). */
function transferToWeightMap(app: App, C: string, src: X3DObject | null, tgt: X3DObject | null, fromDeformer: string, toCluster: string, complete: boolean): Property | null {
  if (!src || !tgt) return null;                                         // DISP_E_MEMBERNOTFOUND internally; only the return value shows it
  const env = envelopeOf(src); const k = env ? env.deformers.findIndex(d => d.name === fromDeformer || d.fullName === fromDeformer) : -1;
  if (!env || k < 0) { nyaE(app, C, `deformer selection when "${fromDeformer}" is not a deformer of the source`); return null; }
  const srcW = env.weights.map(w => w?.[k] ?? 0);
  const tgtN = tgt.primitive?.mesh() ? tgt.primitive.mesh()!.positions.length / 3 : 0; if (!tgtN) return null;
  let w: number[];
  if (src === tgt) w = srcW.slice(0, tgtN);
  else { const corr = correspondence(globalPoints(src), globalPoints(tgt)); w = corr.map(c => c.reduce((s, [i, x]) => s + (srcW[i] ?? 0) * x, 0)); }
  const points = complete ? w.map((_, i) => i) : w.map((v, i) => (v > 0 ? i : -1)).filter(i => i >= 0);   // inferred: CompleteCluster keeps every point
  let cl = tgt.cluster(toCluster);
  if (!cl || cl.elements.size !== points.length) {
    const nc = new Cluster(toCluster, 'pnt', new Set(points));
    app.record('AddCluster', () => tgt.addCluster(nc), () => tgt.removeCluster(nc)); cl = nc;
  }
  nyaE(app, C, 'weight-map writer 0x18019e900 (map name; "Weight_Map" is used)');
  let map = cl.properties.find(p => p.type === 'weightmap');
  if (!map) {
    const p = new Property('Weight_Map', 'weightmap', [num('weight', 1, 'Default Weight', { min: 0, max: 1 }), bool('paintable', true, 'Paintable')]);
    (p as any).values = new Map<number, number>(); const c = cl; app.record('CreateWeightMap', () => c.addProperty(p), () => c.removeProperty(p)); map = p;
  }
  const values: Map<number, number> = (map as any).values ?? ((map as any).values = new Map());
  const old = new Map(values);
  app.record('WeightMap', () => { values.clear(); for (const i of cl!.elements) values.set(Number(i), w[Number(i)] ?? 0); }, () => { values.clear(); for (const [a, b] of old) values.set(a, b); });
  return map;
}

// ------------------------------------------------------------------ crawl
function adjacency(polys: number[][], n: number): Set<number>[] {
  const adj = Array.from({ length: n }, () => new Set<number>());
  for (const f of polys) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; adj[a].add(b); adj[b].add(a); }
  return adj;
}
/** Walker 0x180196fe0 / step 0x180197210 (WIRE_CORRECTIONS_B15 item 8). The first listed vertex is not in the output;
 *  for each consecutive pair (a, b) the walk starts at a and appends each vertex it moves to, ending with b. Step rule:
 *  b a neighbour of the current vertex -> b. Otherwise the candidates are the current vertex's neighbours (other than
 *  itself) that have more than one neighbour; the first candidate that has b as a neighbour is taken at once; else the
 *  candidate whose neighbour direction (inferred: the normalised edge direction) has the largest dot product with the
 *  normalised pos(b) - pos(current), recomputed every step (ties keep the first). No candidate: the pair stops. At most
 *  1024 vertices are appended per pair. */
export function crawl(pos: Float32Array, polys: number[][], ids: number[]): number[] {
  const n = pos.length / 3; const adj = adjacency(polys, n); const P = (i: number) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const out: number[] = [];
  for (let k = 0; k + 1 < ids.length; k++) {
    const a = ids[k], b = ids[k + 1]; if (a < 0 || a >= n || b < 0 || b >= n) break;
    let cur = a;
    for (let s = 0; s < 1024 && cur !== b; s++) {
      let next = -1;
      if (adj[cur].has(b)) next = b;
      else {
        const cands = [...adj[cur]].filter(c => c !== cur && adj[c].size > 1);
        next = cands.find(c => adj[c].has(b)) ?? -1;
        if (next < 0 && cands.length) {
          const dir = P(b).sub(P(cur)).normalize();
          let best = cands[0], bestDot = P(cands[0]).sub(P(cur)).normalize().dot(dir);
          for (const c of cands.slice(1)) { const d = P(c).sub(P(cur)).normalize().dot(dir); if (d > bestDot) { bestDot = d; best = c; } }
          next = best;
        }
      }
      if (next < 0) break;   // no candidate: this pair's walk stops
      cur = next; out.push(cur);
    }
  }
  return out;
}

const SLOT_LABELS = ['DIFFUSE', 'SPECULAR', 'BACKDIFFUSE', 'NORMAL', 'WRINKLE'];
export const SHADER_PORTS = ['SpecularTextureSampler', 'WrinkleTextureSampler', 'NormalTextureSampler', 'BaseTextureSampler', 'AmbientSampler'];

export function registerFaceRobotB14eCommands(app: App) {
  registerFaceRobotB14eTongueCommands(app);

  // ---------------------------------------------------------------- the six export stubs (one shared no-op handler)
  for (const name of ['fr_ExportLWScene', 'fr_ExportModel', 'fr_ExportMotionFile', 'fr_ExportPointOvenCache', 'fr_ExportPointOvenScene', 'fr_ExportShape']) {
    app.register({
      name, label: name, category: CAT, undoable: false,
      args: [{ name: 'path', default: null }, { name: 'filename', default: null }, { name: 'start', default: null }, { name: 'end', default: null }],
      execute(app, a) { void sArg(a.path); void sArg(a.filename); setStatus(app, 'B14e', name, S_OK); },
    });
  }

  // ---------------------------------------------------------------- fr_ApplyFaceRobotGameShader
  app.logMsg('info', 'Defining: fr_ApplyFaceRobotGameShader');
  app.register({
    name: 'fr_ApplyFaceRobotGameShader', label: 'fr_ApplyFaceRobotGameShader', category: CAT,
    args: [{ name: 'in_Target', default: null }, { name: 'API', default: 'OpenGL' }, { name: 'ClipCollection', default: null }],
    execute(app, a) {
      const C = 'fr_ApplyFaceRobotGameShader';
      const target = objArg(app, a.in_Target);
      if (!target) throw failLog(app, C, E_FAIL, 'Please select the target mesh');
      const api = sArg(a.API); const mode = api === 'OpenGL' ? 0 : api === 'DirectX' ? 1 : -1;
      if (mode < 0) throw failLog(app, C, E_FAIL, "Unrecognized API. Please specify either 'OpenGL' or 'DirectX'");
      const all = imageClips(app.scene); const items = listOf(a.ClipCollection);
      const slots: (Property | null)[] = [];
      for (let i = 0; i < 5; i++) {
        const x = items[i]; const clip = x instanceof Property && all.includes(x) ? x : typeof x === 'string' ? all.find(c => c.name === x || c.fullName === x || `Clips.${c.name}` === x) ?? null : null;
        slots.push(clip);
        app.logMsg('info', clip ? `Connecting clip: ${clip.name}` : `Specified clip for ${SLOT_LABELS[i]} not found.`);
      }
      // connector 0x18016ffd0
      const mats: Material[] = target.material ? [target.material] : [];
      progress(app, 'Applying Realtime Shader...'); de(app, 'B14e').shaderSteps = 7 * mats.length;
      const mat = mats.find(m => m.name === 'Constant');   // GetMaterials().GetItem("Constant"): a lookup by material name (WIRE_CORRECTIONS_B15 item 13)
      if (!mat) throw fail(E_FAIL, `${C}: no material item named "Constant"`);
      wrap(app, 'B14e', 'SetViewDisplayMode', { DisplayMode: mode === 0 ? 'OpenGL' : 'DirectX9' });
      progress(app, 'Constructing Shader UI');
      const rt = String(mat.val('realtime') ?? '');
      if (!rt) { nyaE(app, C, 'connector when the material\'s realtime input is not connected'); throw fail(E_FAIL, `${C}: the realtime input of ${mat.name} is not connected`); }
      const shaderName = rt.includes('.') ? rt : `${mat.fullName}.${rt}`;
      wrap(app, 'B14e', 'InspectObj', { InputObjs: shaderName });
      const conns: [string, string][] = [];
      slots.forEach((c, i) => {
        if (!c) return;
        const src = `Clips.${c.name}`, dst = `${shaderName}.${SHADER_PORTS[i]}`;
        conns.push([src, dst]); wrap(app, 'B14e', 'SIConnectShaderToCnxPoint', { Source: src, InputObjs: dst, DeleteOnLastDisconnection: false });
        progress(app, 'Connecting clips');
      });
      de(app, 'B14e').shaderConnections = conns;
    },
  });

  // ---------------------------------------------------------------- fr_ClipWeights
  app.register({
    name: 'fr_ClipWeights', label: 'fr_ClipWeights', category: CAT,
    args: [{ name: 'inMesh', default: null }, { name: 'inClip', default: 0 }, { name: 'inIndex', default: 0 }],
    execute(app, a) {
      const C = 'fr_ClipWeights'; const mesh = objArg(app, a.inMesh); const idx = intArg(a.inIndex, 0); const clip = intArg(a.inClip, 0);
      const env = mesh && idx === 0 ? envelopeOf(mesh) : null;           // one envelope per object in this build
      if (!mesh || !env) throw fail(E_FAIL, `${C}: no envelope at index ${idx}`);
      if (clip === 0) throw fail(E_FAIL, `${C}: inClip is 0`);
      const arr = envelopeArray(env); const D = env.deformers.length;
      if (!arr.length || !D) return;
      for (let p = 0; p * D < arr.length; p++) { const blk = arr.slice(p * D, p * D + D); clipBlock(blk, clip); for (let k = 0; k < D; k++) arr[p * D + k] = blk[k]; }
      putEnvelopeArray(app, env, mesh, arr);
    },
  });

  // ---------------------------------------------------------------- fr_ShakeFit
  app.register({
    name: 'fr_ShakeFit', label: 'fr_ShakeFit', category: CAT, description: 'Command that ends and applies a sculpting session',
    args: [{ name: 'goal', default: null }, { name: 'Bones', default: null }, { name: 'Weights', default: null }],
    execute(app, a) {
      const bones = listOf(a.Bones).map(x => resolve(app, x)).filter((x): x is X3DObject => x instanceof X3DObject);
      let w = arrayArg(a.Weights).map(Number);
      if (!w.length || w.length !== bones.length) w = bones.map(() => 100 / Math.max(1, bones.length));
      const g = arrayArg(a.goal).map(Number); const goal = new THREE.Vector3(g[0] || 0, g[1] || 0, g[2] || 0);
      // shake solver (passes 5, start 2, end 20): its result is discarded
      const passes = 5, start = 2, end = 20; const sum = w.reduce((s, x) => s + x, 0) || 1; const nw = w.map(x => x / sum);
      const pos = bones.map(b => new THREE.Vector3().setFromMatrixPosition(b.globalMatrix()));
      let fit = pos.reduce((acc, p, i) => acc.add(p.clone().multiplyScalar(nw[i])), new THREE.Vector3());
      for (let k = 0; k <= passes; k++) { const f = 1 / ((passes * start - k * start + k * end) / passes); fit = fit.clone().lerp(goal, Math.min(1, f)); }
      de(app, 'B14e').shakeDiscarded = [fit.x, fit.y, fit.z];
      setStatus(app, 'B14e', 'fr_ShakeFit', S_OK);
    },
  });

  // ---------------------------------------------------------------- fr_CrawlToVertex
  app.register({
    name: 'fr_CrawlToVertex', label: 'fr_CrawlToVertex', category: CAT, args: [{ name: 'Select', default: false }],
    execute(app, a) {
      const C = 'fr_CrawlToVertex';
      let text: any = app.commands.has('fr_GetPointsAsText') ? wrap(app, 'B14e', 'fr_GetPointsAsText', {}) : undefined;
      if (typeof text !== 'string') {
        // inferred stand-in for the fr_GetPointsAsText script command: the selected points as "<object>.pnt[i,j,...]"
        const cs = app.compSel; text = cs && cs.kind === 'point' && cs.points.size ? `${cs.obj.fullName}.pnt[${[...cs.points].join(',')}]` : '';
      }
      const [head, rest = ''] = String(text).split('[');
      const toks = head.split('.'); const objName = toks.slice(0, -1).join('.');
      const ids = rest.replace(/\].*$/, '').split(',').filter(s => s !== '').map(s => Math.trunc(Number.parseInt(s, 10)));
      const obj = objName ? findByName(app, objName) : null;
      const m = obj?.primitive?.mesh();
      const path = m ? crawl(m.positions, m.polygons, ids) : [];
      const result = `${objName}.pnt[${path.join(',')}]`;
      if (boolArg(a.Select, false)) wrap(app, 'B14e', 'SelectGeometryComponents', { SelectionList: result });
      return result;
    },
  });

  // ---------------------------------------------------------------- deformer transfers
  app.register({
    name: 'fr_DeformerToWeightMap', label: 'fr_DeformerToWeightMap', category: CAT,
    args: ['fromObject', 'toObject', 'fromDeformer', 'toCluster', 'CompleteCluster'].map(n => ({ name: n, default: null })),
    execute(app, a) {
      return transferToWeightMap(app, 'fr_DeformerToWeightMap', objArg(app, a.fromObject), objArg(app, a.toObject), sArg(a.fromDeformer), sArg(a.toCluster), boolArg(a.CompleteCluster, false));
    },
  });
  app.register({
    name: 'fr_DeformerTransfer', label: 'fr_DeformerTransfer', category: CAT,
    args: ['fromObject', 'toObject', 'fromDeformer', 'toDeformer', 'type', 'CompleteCluster', 'Clipping'].map(n => ({ name: n, default: null })),
    execute(app, a) {
      const C = 'fr_DeformerTransfer'; const src = objArg(app, a.fromObject), tgt = objArg(app, a.toObject);
      const type = intArg(a.type, 0);
      if (type === 0) { transferToWeightMap(app, C, src, tgt, sArg(a.fromDeformer), sArg(a.toDeformer), boolArg(a.CompleteCluster, false)); return; }
      nyaE(app, C, 'envelope writer 0x18019e380 (the weight column is replaced and the others rescaled)');
      if (!src || !tgt) return;
      const se = envelopeOf(src), te = envelopeOf(tgt); if (!se || !te) return;
      const ks = se.deformers.findIndex(d => d.name === sArg(a.fromDeformer)), kt = te.deformers.findIndex(d => d.name === sArg(a.toDeformer));
      if (ks < 0 || kt < 0) return;
      const sw = se.weights.map(w => (w?.[ks] ?? 0) * 100);
      const corr = src === tgt ? null : correspondence(globalPoints(src), globalPoints(tgt));
      const arr = envelopeArray(te); const D = te.deformers.length; const clip = intArg(a.Clipping, 0);
      for (let p = 0; p * D < arr.length; p++) {
        const v = corr ? corr[p].reduce((s, [i, x]) => s + (sw[i] ?? 0) * x, 0) : sw[p] ?? 0;
        const blk = arr.slice(p * D, p * D + D); const others = blk.reduce((s, x, i) => (i === kt ? s : s + x), 0);
        for (let k = 0; k < D; k++) blk[k] = k === kt ? v : others > 0 ? blk[k] * (100 - v) / others : 0;
        if (clip > 0) clipBlock(blk, clip);
        for (let k = 0; k < D; k++) arr[p * D + k] = blk[k];
      }
      putEnvelopeArray(app, te, tgt, arr);
    },
  });

  // ---------------------------------------------------------------- fr_DuplicateFace
  app.register({
    name: 'fr_DuplicateFace', label: 'fr_DuplicateFace', category: CAT,
    args: [{ name: 'dupmodelname', default: 'FaceDuplicate' }, { name: 'parts', default: 0 }, { name: 'options', default: 0 }, { name: 'method', default: 0 }],
    execute(app, a) {
      const C = 'fr_DuplicateFace'; const name = sArg(a.dupmodelname) || 'FaceDuplicate';
      const parts = intArg(a.parts, 0), options = intArg(a.options, 0), method = intArg(a.method, 0);
      const model = faceModel(app); const mesh = faceMesh(app);
      if (!model || (options !== 1 && !mesh)) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: no Face Robot FaceModel${model ? ' mesh' : ''}`);
      const dup = (o: X3DObject): X3DObject | null => { const r = app.run('Duplicate', { InputObjs: [o], NbCopies: 1 }); return Array.isArray(r) ? r[0] ?? null : null; };
      if (parts === 3) {
        nyaE(app, C, 'stress-mesh builder 0x180177550 (a plain duplicate of the face mesh named StressMesh is made)');
        if (!mesh) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: no face mesh`);
        const d = dup(mesh); if (d) { reparent(app, d, app.scene.root); d.name = app.scene.uniqueName('StressMesh'); }
        return d;
      }
      let sources: X3DObject[] = [];
      if (parts === 0) { nyaE(app, C, 'face-mesh part set 0x180176510 (face mesh + registry Tongue / UpperTeeth / LowerTeeth used)'); sources = [mesh, ...['Tongue', 'UpperTeeth', 'LowerTeeth'].map(k => entryObject(app, 'meshes', k))].filter((x): x is X3DObject => !!x); }
      else if (parts === 1) { nyaE(app, C, 'FaceModel part set 0x180176350 (the polygon meshes under the face model are used)'); sources = [...model.descendants()].filter(o => o.type === 'polymsh'); }
      else if (parts === 2) sources = mesh ? [mesh] : [];
      if (!sources.length) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: nothing to duplicate`);
      const out = new Model(app.scene.uniqueName(name)); addObject(app, out);
      if (method === 1) {
        nyaE(app, C, 'model-mode builder 0x180175da0 (the Mesh registry entry is duplicated into the model)');
        const src = entryObject(app, 'meshes', 'Mesh') ?? mesh; const d = src ? dup(src) : null; if (d) { reparent(app, d, out); d.name = src!.name; }
        return out;
      }
      for (const s of sources) {
        const d = dup(s); if (!d) continue;
        reparent(app, d, out); const old = d.name; app.record('Rename', () => { d.name = s.name; }, () => { d.name = old; });
        const doomed: Cluster[] = d.clusters.filter(c => c.compKind === 'pnt' || c.compKind === 'edge');
        nyaE(app, C, 'operator/object gatherer 0x180189310(obj, 1, 4) (every operator above the generator is deleted)');
        for (const op of (d.primitive?.operators ?? []).slice(1)) deleteNode(app, op);
        for (const p of [...d.properties]) if (p.type === 'customparamset' || p.type === 'UserDataBlob') deleteNode(app, p);
        for (const c of doomed) deleteNode(app, c);
      }
      return out;
    },
  });

  // ---------------------------------------------------------------- fr_EnvelopeAliasing
  app.register({
    name: 'fr_EnvelopeAliasing', label: 'fr_EnvelopeAliasing', category: CAT,
    args: [['intime', 0], ['outtime', 0], ['steptime', 1], ['shakepasses', 5], ['startshake', 2], ['endshake', 20], ['clipping', 0], ['optimize', 0], ['considerneighborhood', 1], ['iterations', 1]].map(([n, d]) => ({ name: n as string, default: d })),
    execute(app, a) {
      const C = 'fr_EnvelopeAliasing'; let step = intArg(a.steptime, 1); if (step === 0) step = 1;
      let tin = intArg(a.intime, 0), tout = intArg(a.outtime, 0);
      if (tin === tout) { tin = app.anim.startFrame; tout = app.anim.endFrame; }   // inferred: the scene timeline
      const frames = Math.trunc((tout - tin + 1) / step);
      const face = faceMesh(app);
      nyaE(app, C, 'game-mesh lookup 0x1801785b0 (the first enveloped polygon mesh other than the face mesh is used)');
      const game = [...app.scene.allObjects()].find(o => o !== face && o.type === 'polymsh' && !!envelopeOf(o)) ?? null;
      if (!face || !game) throw fail(DISP_E_MEMBERNOTFOUND, `${C}: ${face ? 'no enveloped game mesh' : 'no face mesh'}`);
      const env = envelopeOf(game)!;
      const prev = game.properties.find(p => p.name === 'UnFilteredEnvelope'); if (prev) deleteNode(app, prev);
      userDataBlob(app, game, 'UnFilteredEnvelope', envelopeArray(env));
      progress(app, 'Envelope Analysis');
      const nb = intArg(a.considerneighborhood, 1);
      if (nb !== 0) { const sel = app.selection; app.select([game]); wrap(app, 'B14e', 'SISmoothEnvWght', { PropObj: '', SubComp: game }); app.select(sel); nyaE(app, C, `neighborhooddepth = ${nb} on the smoothing operator (not an operator in this build)`); }
      for (const s of ['Get Mesh Correspondence', 'Build Goals On Mesh Along Timeline, Frame: ', 'Evaluate Error Along Timeline Frame: ', 'Get Deformer StaticKineStates', 'Get Deformer Indices per Point', 'Get Deformer Transformations Per Frame', 'Fit Envelopes : ', 'Best Refit']) progress(app, s);
      nyaE(app, C, `fitting stages of 0x1801792c0 over ${frames} frame(s) (shake ${intArg(a.shakepasses, 5)}/${intArg(a.startshake, 2)}/${intArg(a.endshake, 20)}) and the use of iterations (Q3)`);
      progress(app, 'Rewrite Weights');
      const clip = intArg(a.clipping, 0); const arr = envelopeArray(env); const D = env.deformers.length;
      if (clip !== 0 && D) for (let p = 0; p * D < arr.length; p++) { const blk = arr.slice(p * D, p * D + D); clipBlock(blk, clip); for (let k = 0; k < D; k++) arr[p * D + k] = blk[k]; }
      if (numArg(a.optimize, 0) !== 0) nyaE(app, C, 'optimize pass 0x180172d20');
      putEnvelopeArray(app, env, game, arr);
      de(app, 'B14e').aliasing = { tin, tout, step, frames, game: game.name };
    },
  });

  // ---------------------------------------------------------------- fr_ExportGameHierarchy
  app.register({
    name: 'fr_ExportGameHierarchy', label: 'fr_ExportGameHierarchy', category: CAT,
    args: [['lowResMesh', null], ['lowResTongueMesh', null], ['ApplyEnvelope', true], ['nbBonesPerPoint', 3], ['ApplyAnimation', true], ['IncludeEars', true], ['OptimizeStep', 0]].map(([n, d]) => ({ name: n as string, default: d })),
    execute(app, a) {
      const C = 'fr_ExportGameHierarchy'; const low = objArg(app, a.lowResMesh); let tongue = objArg(app, a.lowResTongueMesh);
      if (!low) { nyaE(app, C, 'driver 0x1801841c0 without a valid lowResMesh (nothing is exported)'); return null; }
      if (tongue && !entryObject(app, 'meshes', 'Tongue')) { app.logMsg('info', 'FaceRobot model has no valid tongue'); tongue = null; }
      progress(app, 'Game Export'); progress(app, 'Get Envelope Information');
      const existing = (): X3DObject | null => { const e = envelopeOf(low); return e?.deformers[0]?.model ?? null; };
      let result: X3DObject | null = null;
      const apply = boolArg(a.ApplyEnvelope, true);
      let createNew = apply;
      if (!apply) {
        progress(app, 'Get Existing Envelope');
        if (!envelopeOf(low)) { app.logMsg('info', 'Game Export Needs An Envelope'); return null; }
        result = existing();
      } else if (envelopeOf(low)) {
        app.logMsg('info', 'Game Export is already Enveloped');
        const ans = msgBox(app, 'Game Face is already Enveloped: Do you want to re-envelope?\nYes:\tReenvelope and continue\nNo:\tContinue with current envelope \nCancel:\tExit', 0x23, 'Autodesk|Face Robot');
        if (ans === 6) { const e = envelopeOf(low); if (e) deleteNode(app, e); }
        else if (ans === 7) { createNew = false; result = existing(); }
        else return null;
      }
      if (createNew) {
        progress(app, 'Create New Envelope');
        nyaE(app, C, 'GameFace builder 0x180181290 (find or create)');
        let gf = findByName(app, 'GameFace');
        if (!gf || !(gf instanceof Model)) { gf = new Model(app.scene.uniqueName('GameFace')); addObject(app, gf); }
        reparent(app, low, gf); result = gf;
      }
      const model = faceModel(app);
      for (const s of ['Get Maps: Parent, Locator, Spin', 'Create Rig Hierarchy', 'Get Export Envelope Nulls', 'Weighting Game Envelope ']) progress(app, s);
      void model; void tongue;
      nyaE(app, C, `rig / locator builders (maps Locators, Spin, JawParent, HeadParent, NeckParent; locator counting; bones per point ${intArg(a.nbBonesPerPoint, 3)}; ears ${boolArg(a.IncludeEars, true)}; optimize ${numArg(a.OptimizeStep, 0)}${boolArg(a.ApplyAnimation, true) ? '; animation plotting' : ''})`);
      return result && isInScene(app, result) ? result : result;
    },
  });
  void frStore;
}
