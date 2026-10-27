// Assemble NurbsMesh (SCM) — siuitasks.dll RT_DIALOG 201.
// Control titles, the dialog title and the MS Sans Serif face are the committed PE template.
// The merge itself stays ApplyGenOp MeshMerge. Nothing here is transcribed from a decompiler.
import { App } from '../core/commands';
import { Cluster, Operator, Property, X3DObject } from '../core/scene';
import { fromPolys, toPolys } from '../core/topology';
import { openFloating } from './floating';

type V3 = [number, number, number];

/** Holds an evaluated mesh after the assemble options rewrite it. Same role as a frozen geometry op. */
class HeldGeom extends Operator {
  constructor(readonly data: any) { super('Frozen Geometry', 'geom', []); }
  apply() { return this.data; }
}

function selectedMeshes(app: App): X3DObject[] {
  return app.selectedObjects.filter(o => !!o.primitive?.mesh());
}

function copyClustersLocally(result: X3DObject, inputs: X3DObject[]) {
  const out = result.primitive?.mesh();
  if (!out) return;
  const pointLimit = out.positions.length / 3;
  const polyLimit = out.polygons.length;
  let pointBase = 0;
  let polyBase = 0;
  for (const src of inputs) {
    const mesh = src.primitive?.mesh();
    for (const cl of src.clusters) {
      const base = cl.compKind === 'poly' ? polyBase : pointBase;
      const limit = cl.compKind === 'poly' ? polyLimit : pointLimit;
      const els = new Set<number | string>();
      if (cl.compKind === 'pnt' || cl.compKind === 'poly' || cl.compKind === 'sample') {
        for (const e of cl.elements) if (typeof e === 'number' && e + base >= 0 && e + base < limit) els.add(e + base);
      }
      if (!els.size) continue;
      const copy = new Cluster(cl.name, cl.compKind, els);
      result.addCluster(copy);
      for (const prop of cl.properties) {
        copy.addProperty(new Property(prop.name, prop.type, prop.params.map(p => ({ ...p.def, value: Array.isArray(p.value) ? [...p.value] : p.value }))));
      }
    }
    pointBase += mesh ? mesh.positions.length / 3 : 0;
    polyBase += mesh ? mesh.polygons.length : 0;
  }
}

function centerToGeometricCenter(app: App, obj: X3DObject) {
  const prim = obj.primitive;
  const mesh = prim?.mesh();
  if (!prim || !mesh?.positions?.length) return;
  let n = 0;
  const c: V3 = [0, 0, 0];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    c[0] += mesh.positions[i]; c[1] += mesh.positions[i + 1]; c[2] += mesh.positions[i + 2]; n++;
  }
  if (!n) return;
  c[0] /= n; c[1] /= n; c[2] /= n;
  const { verts, faces } = toPolys(mesh);
  const shifted = fromPolys(verts.map(v => [v[0] - c[0], v[1] - c[1], v[2] - c[2]] as V3), faces);
  const op = new HeldGeom(shifted);
  const old = [...prim.operators];
  app.record('Center To Geometric Center', () => {
    prim.operators.splice(0, prim.operators.length, op);
    op.parent = prim;
    prim.dirty = true;
    const k = obj.kinematics.local;
    for (const [axis, d] of [['posx', c[0]], ['posy', c[1]], ['posz', c[2]]] as const) {
      const p = k.get(axis);
      if (p) p.value = Number(p.value) + d;
    }
  }, () => {
    prim.operators.splice(0, prim.operators.length, ...old);
    prim.dirty = true;
    const k = obj.kinematics.local;
    for (const [axis, d] of [['posx', c[0]], ['posy', c[1]], ['posz', c[2]]] as const) {
      const p = k.get(axis);
      if (p) p.value = Number(p.value) - d;
    }
  });
}

export type AssembleNurbsChoice = {
  toleranceText: string;
  copyClusters: boolean;
  copyMats: boolean;
  center: boolean;
};

/** Merge plus the dialog options: tolerance, local clusters, materials, geometric center. */
export function applyAssembleNurbs(app: App, choice: AssembleNurbsChoice): void {
  const inputs = selectedMeshes(app);
  let obj: X3DObject | null = null;
  try {
    obj = app.run('ApplyGenOp', { PresetObj: 'MeshMerge', Target: 'NurbsSurface' }) as X3DObject | null;
  } catch (e: any) {
    app.logMsg('error', 'Assemble NurbsMesh (SCM): ' + (e?.message ?? e));
    return;
  }
  if (!obj) return;
  const tolText = choice.toleranceText.trim();
  if (tolText !== '') {
    const tol = Number(tolText);
    const gen = obj.primitive?.operators.find(op => op.get('tolerance'));
    if (gen && Number.isFinite(tol)) gen.set('tolerance', tol);
  }
  if (choice.copyMats && inputs[0]?.material) obj.setMaterial(inputs[0].material);
  if (choice.copyClusters) copyClustersLocally(obj, inputs);
  if (choice.center) centerToGeometricCenter(app, obj);
  app.events.emit('scene');
}

/** siuitasks.dll dialog 201. Opens from Create > Surf. Mesh > Assemble.
 *  With `preset`, the UI-pass template already collected the options, so this only applies them. */
export function openAssembleNurbsDialog(app: App, preset?: AssembleNurbsChoice): void {
  if (preset) {
    applyAssembleNurbs(app, preset);
    return;
  }
  openFloating('Assemble NurbsMesh (SCM)', (body, win) => {
    body.classList.add('soft-dialog');
    body.style.fontFamily = '"MS Sans Serif", sans-serif';
    body.innerHTML = `<label>SCM Tolerance<input class="scm-tol" type="text" value=""/></label>
      <label class="row"><input class="scm-clusters" type="checkbox"/> Copy User Clusters Locally</label>
      <label class="row"><input class="scm-mats" type="checkbox"/> Copy Materials and Textures Locally</label>
      <label class="row"><input class="scm-center" type="checkbox"/> Center To Geometric Center</label>
      <div class="row"><button class="scm-ok">OK</button><button class="scm-cancel">Cancel</button><button class="scm-help">Help</button></div>`;
    body.querySelector('.scm-cancel')!.addEventListener('click', () => win.close());
    body.querySelector('.scm-help')!.addEventListener('click', () => {
      app.logMsg('info', 'Assemble NurbsMesh (SCM)');
    });
    body.querySelector('.scm-ok')!.addEventListener('click', () => {
      applyAssembleNurbs(app, {
        toleranceText: (body.querySelector('.scm-tol') as HTMLInputElement).value,
        copyClusters: (body.querySelector('.scm-clusters') as HTMLInputElement).checked,
        copyMats: (body.querySelector('.scm-mats') as HTMLInputElement).checked,
        center: (body.querySelector('.scm-center') as HTMLInputElement).checked,
      });
      win.close();
    });
  }, { w: 340, h: 230, key: 'assemble-nurbs-scm' });
}
