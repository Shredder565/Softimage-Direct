// Row CMD-B10 (INFERRED batch): tool activation, navigation and 3D-view commands of the registry categories
// Navigation, Viewing, Manipulation, Drawing, Paint and Selection that were missing from the command bus.
// See inferredB10Shared.ts for the sources. Registrations marked `// inferred` are reasoned; those marked `// B11h §…`
// follow the wire contracts of docs/ghidra/cmd-b11h-vm-view-commands-b10-confirmations-binary.md (vm.dll, read
// 2026-11-18) and docs/re/WIRE_CORRECTIONS_B11.md; open parts there keep `// inferred` and log "not yet attested".
import * as THREE from 'three';
import { App, InteractiveTool } from '../core/commands';
import { X3DObject, Camera, Property } from '../core/scene';
import { hostFs } from '../core/sdkHelpersHostFs';
import { tool as viewTool } from '../ui/viewManager';
import { iemsState } from '../core/importExportModelScripts';
import { looksLikeImageFile, isImageClip, imageClips } from '../core/textureLayers';
import { B10_ARGS } from './inferredB10Args';
import { tasksB16c, runPerformanceTest } from './tasksB16c';
import {
  b10, regB10, logNyaB10, unset, num, boolA, objsOf, findObj, moveComponents, vm, viewports, withView, orbitTarget,
  fail, setStatus, camState, camApply, camChange, setViewLabel, E_FAIL, E_INVALIDARG, S_FALSE, type VP,
} from './inferredB10Shared';

const ev = (name: string, detail?: any) => window.dispatchEvent(new CustomEvent(name, { detail }));

/** Camera navigation tool commands → the view manager's navigation tool of the same name. */
const NAV: Record<string, string> = {
  Cam3dsMaxNavigTool: 'Navigation Tool', CamNavigTool: 'Navigation Tool', CamDollyTool: 'Dolly Tool', CamDriveTool: 'Drive Tool',
  CamFlyTool: 'Fly Tool', CamMayaZoomTool: 'Zoom Tool', CamOrbitTool: 'Orbit Tool', CamPanZoomTool: 'Pan & Zoom Tool',
  CamPivotTool: 'Pivot Tool', CamRectZoomTool: 'Rectangular Zoom Tool', CamRollTool: 'Roll Tool', CamTrackTool: 'Track Tool',
  CamWalkTool: 'Walk Tool', CamZoomTool: 'Zoom Tool',
};

const isCam = (o: any): o is X3DObject => o instanceof X3DObject && (o instanceof Camera || o.type === 'camera');
/** View argument (B11h §2): -1 (or unset) = the active view, any other value a 0-based view index (siViewportA..D accepted);
 *  -1 when the view does not exist. */
export function viewAt(v: any): number {
  const V = vm(); if (!V) return -1;
  const all = viewports(); const letter = /siViewport([A-D])(?![a-z])/i.exec(String(v ?? ''))?.[1];
  const n = letter ? letter.toUpperCase().charCodeAt(0) - 65 : Math.trunc(num(v, -1));
  if (n === -1) return all.indexOf(V.active());
  return n >= 0 && n < all.length ? n : -1;
}
/** Grow a world box by an object's geometry points (or its centre). */
function expandByObject(box: THREE.Box3, o: X3DObject) {
  const M = o.globalMatrix(); const pos: ArrayLike<number> | undefined = o.primitive?.mesh?.()?.positions;
  if (pos && pos.length) { for (let k = 0; k < pos.length; k += 3) box.expandByPoint(new THREE.Vector3(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(M)); }
  else box.expandByPoint(new THREE.Vector3().setFromMatrixPosition(M));
}
/** Frame one view on objects: orthographic views centre and zoom on the box, perspective views keep their direction. */
export function frameView(vp: VP, objs: X3DObject[]) {
  const box = new THREE.Box3(); for (const o of objs) expandByObject(box, o); if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()); const size = Math.max(box.getSize(new THREE.Vector3()).length(), 2); const cam = vp.camera as any;
  if (vp.kind === 'ortho') { const dir = cam.getWorldDirection(new THREE.Vector3()); cam.position.copy(c).sub(dir.multiplyScalar(100)); cam._zoom = size * 0.6; cam.lookAt(c); }
  else { const t = vm()?.orbitTarget?.(); const d = cam.position.clone().sub(t ?? c); if (d.lengthSq() < 1e-12) d.set(0, 0, 1); d.normalize().multiplyScalar(size * 1.2); t?.copy(c); cam.position.copy(c).add(d); cam.lookAt(c); }
  cam.updateMatrixWorld();
}
/** The view looks through a scene camera and follows it (B11h §SetViewCamera); the attachment ends when the view changes. */
function poseFromCamera(vp: VP, cam: X3DObject) {
  const M = cam.globalMatrix(); const pos = new THREE.Vector3().setFromMatrixPosition(M);
  const fwd = new THREE.Vector3(0, 0, -1).transformDirection(M); const up = new THREE.Vector3(0, 1, 0).transformDirection(M);
  vp.camera.position.copy(pos); vp.camera.up.copy(up); vp.camera.lookAt(pos.clone().add(fwd)); vp.camera.updateMatrixWorld();
}
function attachCamera(vp: VP, cam: X3DObject) {
  (vp.x ??= {}).viewCamera = cam; (vp as any).viewCamera = cam.name; setViewLabel(vp, cam.name); poseFromCamera(vp, cam);
}
function clipOf(app: App, x: any): Property | undefined {
  if (isImageClip(x)) return x;
  if (typeof x !== 'string' || !x) return undefined;
  const n = x.replace(/^Clips\./, '').split('.').pop();
  return imageClips(app.scene).find(c => c.name === x || c.name === n);
}

export function registerInferredB10Views(app: App) {
  const st = b10(app);
  // views attached to a scene camera follow it (SetViewCamera)
  const follow = () => {
    for (const vp of viewports()) {
      const cam: X3DObject | null | undefined = vp.x?.viewCamera; if (!cam) continue;
      if (vp.name !== cam.name || ![...app.scene.allObjects()].includes(cam)) { vp.x.viewCamera = null; continue; }
      poseFromCamera(vp, cam);
    }
  };
  for (const e of ['params', 'frame', 'scene'] as const) app.events.on(e, follow);

  // ================================================================ navigation tools
  for (const [name, label] of Object.entries(NAV)) {
    regB10(app, name, { // inferred: activates (never toggles off) the view manager's navigation tool; leaves any modal tool
      label, undoable: false,
      execute(app) {
        if (app.activeTool) app.setTool(null);
        const nt = (window as any).__navTool;
        if (nt) nt.set(label);
        else { app.logMsg('info', `${name}: no 3D view is open; the tool is remembered`); }
        if (name === 'Cam3dsMaxNavigTool' || name === 'CamMayaZoomTool') logNyaB10(app, name, `the ${name === 'Cam3dsMaxNavigTool' ? '3ds Max' : 'Maya'}-style mouse mapping; the generic ${label} is used`);
        st.tool.current = name;
        return label;
      },
    });
  }

  // ================================================================ auxiliary tools
  /** Arm an interactive tool and remember it for LastTool. */
  const arm = (name: string, a: Record<string, any>, t: Omit<InteractiveTool, 'onFinish' | 'onCancel'> & { onFinish?: () => void }) => {
    (window as any).__navTool?.set(null);
    const it: InteractiveTool = {
      ...t,
      onFinish() { t.onFinish?.(); if (app.activeTool === it) app.setTool(null); },
      onCancel() { if (app.activeTool === it) app.activeTool = null; },
    };
    app.setTool(it);
    st.tool.current = name; // the last auxiliary tool is the tool manager's (CMD-B16a, src/core/toolManager.ts)
    (app as any).armedTool = { label: t.name, clsid: a.Clsid ?? null };
    return it;
  };

  regB10(app, 'ManipulateTool', { // inferred: shows the 3D manipulators on the selection (MCP "Manipulate Tool" state)
    label: 'Manipulate Tool', undoable: false,
    execute(app, a) {
      (app as any).hideManip = false; (window as any).__mcp?.('manip', true);
      st.tool.current = 'ManipulateTool'; void a; // Manipulate is excluded from the last auxiliary tool (WIRE_CORRECTIONS_B16 item 4)
      app.events.emit('selection');
      return true;
    },
  });
  regB10(app, 'DirectManipTool', { // inferred: picks a point of a curve / mesh and drags it on the construction plane
    label: 'Direct Manip Tool', undoable: false,
    execute(app, a) {
      let picked: { obj: X3DObject; item: number; start: [number, number, number] } | null = null;
      return arm('DirectManipTool', a, {
        name: 'Direct Manip Tool', prompt: 'Direct Manip Tool: click a point, then click where it goes (Esc to leave)', pickKind: 'point',
        onClick(p, pick) {
          if (!picked) { if (pick && typeof pick.item === 'number') picked = { obj: pick.obj, item: pick.item, start: pick.worldPoint }; return; }
          const d = new THREE.Vector3(p[0] - picked.start[0], p[1] - picked.start[1], p[2] - picked.start[2]);
          app.selectComponents(picked.obj, 'point', [picked.item]);
          const o = picked.obj; const local = d.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(o.globalMatrix()).invert());
          moveComponents(app, o, [picked.item], [local.x, local.y, local.z], 'DirectManip');
          picked = null;
        },
      });
    },
  });
  regB10(app, 'TimeSliderTool', { // inferred: horizontal motion scrubs the current frame (one construction-plane unit = one frame)
    label: 'Time Slider Tool', undoable: false,
    execute(app, a) {
      let origin: number | null = null; let f0 = app.anim.frame;
      return arm('TimeSliderTool', a, {
        name: 'Time Slider Tool', prompt: 'Time Slider Tool: click and move left / right to change the current frame',
        onClick(p) { origin = p[0]; f0 = app.anim.frame; },
        onMove(p) { if (origin === null) return; const f = Math.round(f0 + (p[0] - origin)); app.anim.frame = Math.max(app.anim.startFrame, Math.min(app.anim.endFrame, f)); },
      });
    },
  });
  regB10(app, 'VirtualSliderTool', { // inferred: horizontal motion changes the marked parameters of the selection
    label: 'Virtual Slider Tool', undoable: false,
    execute(app, a) {
      let origin: number | null = null; let base = new Map<any, number>();
      const marked = () => [...app.anim.marked].filter(p => typeof p.value === 'number' && !p.def.readOnly);
      if (!marked().length) app.logMsg('info', 'Virtual Slider Tool: mark parameters to slide');
      return arm('VirtualSliderTool', a, {
        name: 'Virtual Slider Tool', prompt: 'Virtual Slider Tool: click and move left / right to change the marked parameters',
        onClick(p) { origin = p[0]; base = new Map(marked().map(q => [q, Number(q.value)])); },
        onMove(p) { if (origin === null) return; const d = (p[0] - origin) * 0.1; for (const [q, v] of base) { q.value = v + d; app.events.emit('params', q); } },
        onFinish() { for (const [q, v] of base) { const now = Number(q.value); q.value = v; app.setParam(q, now, 'VirtualSlider'); } },
      });
    },
  });
  for (const [name, label, cmd] of [['2D Chain Tool', 'Draw 2D Chain', 'Create2DSkeleton'], ['3D Chain Tool', 'Draw 3D Chain', 'Create2DSkeleton']] as const) {
    regB10(app, name, { // inferred: the chain drawing tool of the Create > Skeleton menu; both build the chain through Create2DSkeleton
      label: name, undoable: false,
      execute(app, a) {
        const pts: [number, number, number][] = [];
        if (name === '3D Chain Tool') logNyaB10(app, name, 'joint placement in depth (the 3D chain differs from the 2D chain in how joints follow the view); points on the construction plane are used');
        return arm(name, a, {
          name: label, prompt: `${label}: click the root, then each joint; Enter or right-click to finish, Esc to cancel`,
          onClick(p) { pts.push(p); }, preview: () => [pts],
          onFinish() { if (pts.length >= 2 && app.commands.has(cmd)) app.run(cmd, { Points: pts.slice() }); else app.logMsg('info', `${label}: need at least two points`); },
        });
      },
    });
  }
  regB10(app, 'AddParticleTool', { // inferred: each click adds one point to the selected point cloud
    label: 'Add Particle Tool', undoable: false,
    execute(app, a) {
      return arm('AddParticleTool', a, {
        name: 'Add Particle Tool', prompt: 'Add Particle Tool: click to add particles to the selected point cloud',
        onClick(p) {
          const cloud = app.selectedObjects.find(o => o.type === 'pointcloud');
          if (!cloud) { app.logMsg('info', 'Add Particle Tool: select a point cloud'); return; }
          const list: [number, number, number][] = ((cloud as any).addedParticles ??= []);
          app.record('Add Particle', () => { list.push(p); }, () => { list.pop(); });
          logNyaB10(app, 'AddParticleTool', 'writing the particle into the point cloud geometry (ICE / particle state); the position is stored on the object');
        },
      });
    },
  });
  regB10(app, 'PickDeformerByVertexTool', { // inferred: picking a point selects the envelope deformer that weighs it most
    label: 'Pick Deformer By Vertex Tool', undoable: false,
    execute(app, a) {
      return arm('PickDeformerByVertexTool', a, {
        name: 'Pick Deformer By Vertex Tool', prompt: 'Pick Deformer By Vertex Tool: click a point of an enveloped object', pickKind: 'point',
        onClick(_p, pick) {
          if (!pick || typeof pick.item !== 'number') return;
          const env = pick.obj.allProperties().find(q => /envelope/i.test(q.type) || /envelope/i.test(q.name)) as any;
          const w: Record<string, ArrayLike<number>> | undefined = env?.weights;
          if (!env || !w) { logNyaB10(app, 'PickDeformerByVertexTool', `envelope weights of ${pick.obj.name}`); return; }
          let best = '', bw = -1; for (const [k, arr] of Object.entries(w)) { const v = Number(arr[pick.item] ?? 0); if (v > bw) { bw = v; best = k; } }
          const d = findObj(app, best); if (d) app.select([d]);
        },
      });
    },
  });
  regB10(app, 'PaintSelectTool', { // inferred: brush selection of components (each click adds the component under the cursor)
    label: 'Paint Select Tool', category: 'Paint', undoable: false,
    execute(app, a) {
      const kind = app.selMode === 'object' ? 'point' : app.selMode as 'point' | 'edge' | 'polygon';
      if (boolA(a.KeyboardProcess) === false) logNyaB10(app, 'PaintSelectTool', 'KeyboardProcess = False');
      return arm('PaintSelectTool', a, {
        name: 'Paint Select Tool', prompt: 'Paint Select Tool: click components to add them (Shift: toggle)', pickKind: kind,
        onClick(_p, pick, e) { if (pick) app.selectComponents(pick.obj, pick.kind, [pick.item], e.shift ? 'toggle' : 'add'); },
      });
    },
  });
  regB10(app, 'PaintTextureTool', { // inferred: arms texture painting on the selection (the XSI paint stand-in has no pixel renderer)
    label: 'Paint Texture Tool', category: 'Paint', undoable: false,
    execute(app, a) {
      return arm('PaintTextureTool', a, {
        name: 'Paint Texture Tool', prompt: 'Paint Texture Tool: paint on the selected object\'s texture',
        onClick(_p, pick) { logNyaB10(app, 'PaintTextureTool', `painting pixels of the texture of ${pick?.obj.name ?? 'the selection'}`); },
      });
    },
  });
  // LastTool: toolmanager.dll activation command with Clsid GUID_NULL (CMD-B16a, toolsB16a.ts).

  // ================================================================ standard views
  for (const [name, view] of [['Front View', 'Front'], ['Back View', 'Back'], ['Right View', 'Right']] as const) {
    regB10(app, name, { // inferred: like the existing Top / Left / Bottom View keys: the active view shows that orthographic view
      label: name, undoable: false,
      execute(app) { const V = vm(); if (!V) { app.logMsg('info', `${name}: no 3D view is open`); return null; } V.view(view); return view; },
    });
  }
  // ---------------------------------------------------------------- B11h (vm.dll) view commands
  const B11H = 'CMD-B11h';
  /** STD direction codes of AlignViewCamera (B11h: +Y 0, -Y 1, +Z 2, -Z 3, +X 4, -X 5 = Top, Bottom, Front, Back, Right, Left):
   *  direction from the interest to the camera, and the camera up vector. */
  const STD_DIR: [number, number, number, number, number, number][] = [[0, 1, 0, 0, 0, -1], [0, -1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0], [1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0]];
  const ALIGN_CODE: Record<number, number> = { 1: 4, [-1]: 5, 2: 0, [-2]: 1, 3: 2, [-3]: 3 };
  regB10(app, 'AlignViewCamera', { // B11h §AlignViewCamera: Axis 1/2/3 = X/Y/Z (NegativeAxis negates), 0 = restore the pre-alignment camera
    undoable: false,
    execute(app, a) {
      let axis = Math.trunc(num(a.Axis)); if (boolA(a.NegativeAxis)) axis = -axis;
      if (axis !== 0 && !(axis in ALIGN_CODE)) throw fail('AlignViewCamera', E_FAIL, `Axis ${a.Axis} is not 0, 1, 2 or 3`);
      const i = viewAt(a.View); const vp = viewports()[i];
      if (!vp) return; // B11h §2: no view = success, nothing done
      const x = vp.x ?? (vp.x = {});
      if (axis === 0) { // restore the camera saved before the first alignment, clear it
        if (x.alignSaved) { camChange(app, i, 'Reset XYZ'); camApply(vp, x.alignSaved); x.alignSaved = null; }
        x.alignState = 0; return;
      }
      if (!x.alignSaved) x.alignSaved = camState(vp); // saved once, before the first alignment
      const code = ALIGN_CODE[axis]; const [dx, dy, dz, ux, uy, uz] = STD_DIR[code];
      // reference frame: identity, or the first selected object's axes with AlignSelected (B11h; not its centre)
      const q = new THREE.Quaternion(); const first = boolA(a.AlignSelected) ? app.selectedObjects[0] : undefined;
      if (first) first.globalMatrix().decompose(new THREE.Vector3(), q, new THREE.Vector3());
      camChange(app, i, 'Align'); // inferred: label of the alignment camera change (not named in the note)
      const cam = vp.camera; const target = orbitTarget(); const dist = Math.max(1e-6, cam.position.distanceTo(target));
      cam.position.copy(target).addScaledVector(new THREE.Vector3(dx, dy, dz).applyQuaternion(q), dist);
      cam.up.copy(new THREE.Vector3(ux, uy, uz).applyQuaternion(q)); cam.lookAt(target); cam.updateMatrixWorld();
      x.alignState = { 1: 1, 2: 2, 3: 4 }[Math.abs(axis)]; x.alignDirection = code;
    },
  });
  regB10(app, 'CameraUndo', { undoable: false, execute(app, a) { const i = viewAt(a.View); if (i >= 0) withView(i, () => vm().undoCamera()); } }); // B11h §CameraUndo: steps the view camera history back
  regB10(app, 'CameraRedo', { undoable: false, execute(app, a) { const i = viewAt(a.View); if (i >= 0) withView(i, () => vm().redoCamera()); } }); // B11h §CameraRedo
  regB10(app, 'Frame Contextual', { // B11h §Frame Contextual: frame selection when something is selected, else frame all; one view unless AllViews
    undoable: false,
    execute(app, a) {
      const all = viewports(); const sel = app.selectedObjects.length > 0 || !!app.compSel;
      const objs = sel ? (app.selectedObjects.length ? app.selectedObjects : [app.compSel!.obj]) : [...app.scene.allObjects()].filter(o => o.visible);
      const which = boolA(a.AllViews) ? all.map((_, k) => k) : [viewAt(a.View)].filter(k => k >= 0);
      for (const k of which) { camChange(app, k, 'Frame'); frameView(all[k], objs); }
    },
  });
  /** B11h §ResetAllViews / CMD-B17i `Reset Camera`: every view (AllViews) or one goes to its home camera; undoable. */
  const resetViews = (app: App, a: Record<string, any>) => {
      const all = viewports(); const which = boolA(a.AllViews) ? all.map((_, k) => k) : [viewAt(a.View)].filter(k => k >= 0);
      if (!which.length) return;
      const saved = which.map(k => ({ cam: camState(all[k]), attached: all[k].x?.viewCamera ?? null, label: (all[k] as any).viewCamera }));
      const home = which.map(k => all[k].x?.viewCamera ? 'Camera' : all[k].name); // inferred: a view looking through a scene camera goes back to the user camera
      app.record('Reset', () => {
        which.forEach((k, j) => { const vp = all[k]; if (vp.x) vp.x.viewCamera = null; delete (vp as any).viewCamera; camChange(app, k, 'Reset'); withView(k, () => vm().view(home[j])); });
      }, () => {
        which.forEach((k, j) => { const vp = all[k]; camApply(vp, saved[j].cam); if (saved[j].attached) { (vp.x ??= {}).viewCamera = saved[j].attached; (vp as any).viewCamera = saved[j].label; } });
      });
  };
  regB10(app, 'ResetAllViews', { label: 'Reset (All 3D Views)', execute: resetViews });
  // CMD-B17i correction 9: `Reset Camera` (CameraReset) is the same vm.dll handler 0461b2b4 with AllViews false.
  app.register({
    name: 'CameraReset', label: 'Reset Camera', category: 'Viewing', description: 'Reset the camera',
    args: [{ name: 'View', default: -1 }, { name: 'AllViews', default: false }], execute: resetViews,
  });

  // ================================================================ CMD-B17i vm.dll 0461b2b6: Frame Selection / Frame All
  // One handler, four commands that differ only by defaults (AllObjects, AllViews, View). AllViews false: the target
  // view (-1 = active) is framed inside a camera-change bracket labelled "Frame" (per-view camera undo history);
  // AllViews true: every 3D view is framed with the label "Frame" and no bracket; View is then ignored. Missing view:
  // nothing, no error. No command undo, no log line, no return value.
  const frameObjects = (allObjects: boolean): X3DObject[] => allObjects
    ? [...app.scene.allObjects()].filter(o => o.visible) // inferred: hidden objects are not framed
    : (app.selectedObjects.length ? app.selectedObjects : app.compSel ? [app.compSel.obj] : []);
  const redraw = () => { vm()?.redraw?.(); };
  const frameCmd = (_app: App, a: Record<string, any>) => {
    const all = viewports(); const objs = frameObjects(boolA(a.AllObjects));
    if (boolA(a.AllViews)) {
      all.forEach((vp, k) => { st.camLabels.push({ view: k, label: 'Frame' }); frameView(vp, objs); });
    } else {
      const i = viewAt(a.View); if (i < 0) return undefined;
      camChange(app, i, 'Frame'); frameView(all[i], objs);
    }
    redraw();
    return undefined;
  };
  const FRAME: [name: string, label: string, desc: string, allObjects: boolean, allViews: boolean][] = [
    ['Frame Selection', 'Frame Selection', 'Frame current selection', false, false],
    ['FrameSelection', 'Frame Selection (All 3D Views)', 'Frame selection in all views', false, true],
    ['Frame All', 'Frame All', '', true, false],
    ['FrameAll', 'Frame All (All 3D Views)', 'Frame all in all views', true, true],
  ];
  for (const [name, label, description, ao, av] of FRAME) {
    app.register({
      name, label, category: 'Viewing', description, undoable: false, noLog: true,
      args: [{ name: 'AllObjects', default: ao }, { name: 'AllViews', default: av }, { name: 'View', default: -1 }],
      execute: frameCmd,
    });
  }
  // ================================================================ CMD-B17i vm.dll 0461b2c2: Show/Hide Grid
  // The active 3D view's grid visibility is inverted and that view redrawn; no active view = nothing. Not undoable.
  app.register({
    name: 'Show/Hide Grid', label: 'Show/Hide Grid', category: 'Viewing', description: '', args: [], undoable: false,
    execute() {
      const i = viewAt(-1); const vp = viewports()[i]; if (!vp) return undefined;
      vp.flags['Grid'] = !vp.flags['Grid'];
      redraw();
      return undefined;
    },
  });
  regB10(app, 'GetViewIndex', { // B11h §GetViewIndex: 0-based index of the active 3D view; no active view = error
    undoable: false,
    execute() { const V = vm(); const i = V ? viewports().indexOf(V.active()) : -1; if (i < 0) throw fail('GetViewIndex', E_FAIL, 'no active 3D view'); return i; },
  });
  /** Render pass camera: the Camera parameter of the current pass (scene.currentPass, else the last pass). */
  const passCamera = (): X3DObject | undefined => {
    const s = app.scene as any; const pass = s.currentPass ?? app.scene.passes[app.scene.passes.length - 1];
    const n = pass?.val?.('Camera'); const o = n ? findObj(app, String(n)) : undefined;
    return o && isCam(o) ? o : undefined;
  };
  const KEYWORD_VIEW: Record<string, string> = { user: 'User', top: 'Top', front: 'Front', right: 'Right' };
  regB10(app, 'SetViewCamera', { // B11h §SetViewCamera: the view looks through the camera (stays attached); keywords user/top/front/right/render [pass]
    undoable: false,
    execute(app, a) {
      const all = viewports(); const i = viewAt(a.View); const vp = all[i];
      if (!vp) return; // no view: success, nothing done
      const name = String(a.CameraName ?? ''); const obj = name ? findObj(app, name) : undefined;
      const kw = name.trim().toLowerCase();
      let cam: X3DObject | undefined = obj && isCam(obj) && (obj.fullName === name || obj.name === name) ? obj : undefined;
      if (!cam && (kw === 'render' || kw === 'render pass')) {
        cam = passCamera();
        if (!cam) { logNyaB10(app, 'SetViewCamera', 'the render pass camera when the current pass names no camera object of the scene', B11H); return; }
      }
      if (cam) { camChange(app, i, 'Set Camera'); attachCamera(vp, cam); return; }
      const view = KEYWORD_VIEW[kw];
      if (!view) throw fail('SetViewCamera', E_FAIL, `${name || '(no name)'} is not a camera of the view or a view camera keyword`);
      camChange(app, i, 'Set Camera'); if (vp.x) vp.x.viewCamera = null; delete (vp as any).viewCamera;
      withView(i, () => vm().view(view));
    },
  });
  regB10(app, 'Hide Back Facing Polygons', { // B11h §Hide Back Facing Polygons: toggles display flag 5 of the active view
    undoable: false,
    execute(app) {
      const vp = viewports()[viewAt(-1)]; if (!vp) return;
      const k = 'Hide Back Facing Polygons'; vp.flags[k] = !vp.flags[k];
      logNyaB10(app, k, 'drawing with back faces culled (meaning of display flag 5 assumed from the name; the view manager draws double-sided); the view flag is toggled', B11H);
    },
  });
  regB10(app, 'ToggleMuteSolo', { // B11h §ToggleMuteSolo: Target 0..3 = view A..D, 4 = active view, > 4 nothing; Mode 0 mute, 1 solo
    undoable: false,
    execute(app, a) {
      const all = viewports(); const t = Math.trunc(num(a.Target, 4)); const idx = t === 4 ? viewAt(-1) : t;
      if (!(idx >= 0 && idx < 4)) return;
      const vp = all[idx]; if (!vp) return;
      const x = vp.x ?? (vp.x = {}); x.muted = !!x.muted; x.solo = !!x.solo;
      if (num(a.Mode) === 1) { x.solo = !x.solo; for (const v of all) if (v !== vp && v.x) v.x.solo = false; } // inferred: solo is exclusive (view-manager internal, unread)
      else x.muted = !x.muted;
    },
  });
  /** World-space bounding box of the selection: selected objects' geometry, or the selected components' points. */
  const selectionBox = (): THREE.Box3 => {
    const box = new THREE.Box3(); const cs = app.compSel as any;
    if (cs && cs.obj?.primitive?.mesh?.()) {
      const m = cs.obj.primitive.mesh(); const M = cs.obj.globalMatrix(); const pts = new Set<number>();
      if (cs.kind === 'point') for (const p of cs.points) pts.add(p);
      else if (cs.kind === 'polygon') for (const f of cs.polygons) for (const v of m.polygons[f] ?? []) pts.add(v);
      else for (const e of cs.edges ?? []) for (const v of String(e).split('-')) pts.add(Number(v));
      for (const p of pts) box.expandByPoint(new THREE.Vector3(m.positions[p * 3], m.positions[p * 3 + 1], m.positions[p * 3 + 2]).applyMatrix4(M));
      return box;
    }
    for (const o of app.selectedObjects) expandByObject(box, o);
    return box;
  };
  const nudge = (name: string) => regB10(app, name, { // B11h §ViewTranslate: X / Y in window pixels on the projected selection box centre, applied through Translate
    execute(app, a) {
      const all = viewports(); const i = viewAt(a.View); const vp = all[i];
      if (!vp) throw fail(name, E_INVALIDARG, 'no 3D view');
      const box = selectionBox(); if (box.isEmpty()) return; // empty selection: nothing
      const c = box.getCenter(new THREE.Vector3()); const cam = vp.camera as any; cam.updateMatrixWorld();
      const el = (vp as any).el as HTMLElement | undefined; const w = Math.max(2, el?.clientWidth || 2), h = Math.max(2, el?.clientHeight || 2);
      const ndc = c.clone().project(cam); const hw = (w - 1) / 2, hh = (h - 1) / 2;
      const moved = new THREE.Vector3((ndc.x * hw + num(a.X)) / hw, (ndc.y * hh + num(a.Y)) / hh, ndc.z).unproject(cam);
      const d = moved.sub(c);
      // inferred: RefMode bit 0x800 from the private preference 3D_TRANSFO_REFERENTIAL_CHANGED is not modelled (siGlobal only)
      app.run('Translate', { X: d.x, Y: d.y, Z: d.z, Delta: 'siRelative', RefMode: 'siGlobal', AxesFilter: 7, Mode: 'siRelative' });
    },
  });
  for (const n of ['ViewNudgeDown', 'ViewNudgeLeft', 'ViewNudgeRight', 'ViewNudgeUp', 'ViewTranslate']) nudge(n);
  // CMD-B16c (tasks.dll c57f98e2): the viewer controller is set to Time (frames, in the scene time format) and a refresh
  // of the views is queued; an unset Time keeps the current frame (inferred). No return value, not undoable.
  regB10(app, 'DelayedRefresh', {
    undoable: false,
    execute(app, a) {
      const t = unset(a.Time) ? null : num(a.Time);
      if (t !== null && !Number.isFinite(t)) throw new Error(`DelayedRefresh: Time ${a.Time} is not a frame`);
      st.delayedRefresh.push(t);
      setTimeout(() => { if (t !== null && t !== app.anim.frame) app.anim.frame = t; app.events.emit('scene'); app.events.emit('params'); }, 0);
    },
  });
  // CMD-B16c (tasks.dll b5097d5a row 14): resets the display driver's device; this build draws with WebGL, so the
  // equivalent is a redraw of the views. No args, not undoable.
  regB10(app, 'ResetDirectX', {
    undoable: false,
    execute(app) { app.events.emit('scene'); app.logMsg('info', 'ResetDirectX: this build draws with WebGL; the views were refreshed'); },
  });
  // CMD-B16c (tasks.dll e0a73360): sets the text of the drag-and-drop service; a non-string Message is stored empty.
  regB10(app, 'SetDropMessage', {
    undoable: false,
    execute(app, a) { const m = typeof a.Message === 'string' ? a.Message : ''; st.dropMessage = m; tasksB16c(app).dropMessage = m; },
  });
  // CMD-B16c (tasks.dll 0ed17cf6): the report header is appended to FileName, then a playback (Type 0 / 2) or drawing
  // (1 / 3) test runs for at least Duration seconds; other Types write the header with "unknown" only; no file = no test.
  regB10(app, 'RunPerformanceTest', {
    undoable: false,
    execute(app, a) {
      const r = runPerformanceTest(app, a, {
        draw: () => { app.events.emit('scene'); vm()?.redraw?.(); for (const v of viewports() as any[]) v?.render?.(); },
        setTime: (f) => { app.anim.frame = f; for (const o of app.scene.allObjects()) o.primitive?.geom(); },
        views: () => {
          if (!vm()) return null;
          const DISP: Record<string, string> = { wireframe: 'WIREFRAME', shaded: 'SHADE', 'shaded with wireframe': 'SURFACE_LINES', textured: 'TEXTURE', 'texture decal': 'TEXTURE DECAL', 'bounding box': 'BBOX', 'hidden line': 'HIDDEN_LINE', constant: 'CONSTANT', realtime: 'REALTIME SHADERS' };
          return viewports().map((vp: any, k) => ({
            letter: 'ABCD'[k] ?? '?', index: k, width: vp.el?.clientWidth ?? 0, height: vp.el?.clientHeight ?? 0,
            cameraKind: vp.x?.viewCamera || vp.name === 'Camera' ? 'SCENE' : 'VIEWPOINT', cameraName: vp.name, // inferred mapping
            display: DISP[String(vp.display ?? '').toLowerCase()] ?? 'AUTO', quality: 'FULL',
            frustumCull: 0, xray: vp.flags?.['XRay Surfaces'] ? 1 : 0, transp: 0,
          }));
        },
        gl: () => {
          const c = document.querySelector('canvas'); const g = (c?.getContext('webgl2') ?? c?.getContext('webgl')) as WebGLRenderingContext | null;
          return g ? { version: String(g.getParameter(g.VERSION)), vendor: String(g.getParameter(g.VENDOR)), renderer: String(g.getParameter(g.RENDERER)) } : null;
        },
      });
      if (r) { st.perf = { type: r.type, frames: r.frames, seconds: r.seconds, fps: r.fps }; app.logMsg('info', `RunPerformanceTest: ${r.frames} frames, ${r.seconds.toFixed(3)} s`); }
    },
  });
  regB10(app, 'Show3DContextMenu', { // B11h §Show3DContextMenu: the viewer controller shows the 3D view context menu
    undoable: false,
    execute(app) {
      const vp = viewports()[viewAt(-1)] as any; const el: HTMLElement | undefined = vp?.el;
      if (!el) { app.logMsg('info', 'Show3DContextMenu: no 3D view is open'); return; }
      const r = el.getBoundingClientRect(); // inferred: shown at the view centre (the controller's position is not in the note)
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));
    },
  });
  regB10(app, 'StartTimedPlayback', { // B11h §StartTimedPlayback: Target is 1-based (<= 0 = active view); plays the range once, logs the elapsed ms
    undoable: false,
    execute(app, a) {
      const t = Math.trunc(num(a.Target, -1)); const i = t <= 0 ? viewAt(-1) : t - 1;
      const A = app.anim; const saved = { frame: A.frame, start: A.startFrame, end: A.endFrame }; const t0 = performance.now();
      try { for (let f = A.startFrame; f <= A.endFrame; f++) { A.frame = f; for (const o of app.scene.allObjects()) o.primitive?.geom(); } }
      finally { A.startFrame = saved.start; A.endFrame = saved.end; A.frame = saved.frame; }
      const ms = performance.now() - t0;
      app.logMsg('info', `StartTimedPlayback: ${Math.round(ms)} ms`);
      logNyaB10(app, 'StartTimedPlayback', `the text of message XSIVM 0x13e (the elapsed time is logged as is)${t > 0 ? `; playing in view ${i} only (this build evaluates the scene, not one view)` : ''}`, B11H);
    },
  });
  for (const name of ['SaveFastPlaybackCache', 'LoadFastPlaybackCache'] as const) {
    regB10(app, name, { // B11h §Save / LoadFastPlaybackCache (SPEC-PARTIAL): the display driver's image cache, saved to / loaded from FileName
      undoable: false,
      execute(app, a) {
        const save = name === 'SaveFastPlaybackCache'; let file = String(a.FileName ?? '');
        if (!file) { // empty FileName: modal file browser (*.cache, <install>\Render_Pictures); cancel ends the command
          const title = save ? 'Save Fast Playback Cache' : 'Load Fast Playback Cache';
          const got = iemsState.fileBrowser?.(title, 'Fast Playback Cache (*.cache)|*.cache|All Files (*.*)|*.*', save ? 'save' : 'open');
          if (typeof got !== 'string') { logNyaB10(app, name, `the modal file browser "${title}" (no file browser in this build; treated as cancelled)`, B11H); return; }
          if (!got) return; file = got;
        }
        const i = viewAt(a.View); if (i < 0) { setStatus(app, name, S_FALSE); return; } // no view: S_FALSE
        if (save) {
          const frames: number[] = []; for (let f = app.anim.startFrame; f <= app.anim.endFrame; f++) frames.push(f);
          try { hostFs.writeFile(file, JSON.stringify({ view: i, frames })); } catch (e: any) { throw fail(name, E_FAIL, String(e?.message ?? e)); }
          st.playbackCaches.set(i, { frames, file });
          logNyaB10(app, name, 'the cache file layout (display driver); a frame-list stand-in is written', B11H);
        } else {
          let d: any; try { d = JSON.parse(hostFs.readFile(file)); } catch (e: any) { throw fail(name, E_FAIL, `cannot load ${file}`); }
          st.playbackCaches.set(i, { frames: Array.isArray(d?.frames) ? d.frames : [], file });
          logNyaB10(app, name, 'playing back the cached images (display driver); the frame-list stand-in is loaded', B11H);
        }
        setStatus(app, name, S_FALSE); // success returns S_FALSE
      },
    });
  }
  // ---------------------------------------------------------------- ExportImageClip (B11h, new)
  const MOVIE = /\.(avi|mov|qt|mpe?g|mp4)$/i; // inferred: the movie formats of the image writers
  B10_ARGS.ExportImageClip ??= [{ name: 'Clip', default: null }, { name: 'FileName', default: '' }, { name: 'StartFrame', default: 1 }, { name: 'EndFrame', default: 1 }, { name: 'StepFrame', default: 1 }];
  regB10(app, 'ExportImageClip', { // B11h §ExportImageClip: writes the clip's images for Start..End by Step to FileName
    label: 'Export Image Clip', category: 'Rendering', undoable: false,
    execute(app, a) {
      const C = 'ExportImageClip';
      const clip = clipOf(app, a.Clip); if (!clip) throw fail(C, E_INVALIDARG, 'Argument 1 must be an image clip');
      const file = String(a.FileName ?? '');
      if (!file || !(looksLikeImageFile(file) || MOVIE.test(file))) throw fail(C, E_INVALIDARG, 'Argument 2 must specify a image file name');
      let s = Math.trunc(num(a.StartFrame, 1)), e = Math.trunc(num(a.EndFrame, 1)), step = Math.trunc(num(a.StepFrame, 1)) || 1;
      if ((step < 0 && s < e) || (step > 0 && e < s)) [s, e] = [e, s];
      const count = Math.abs(Math.trunc((e - s + 1) / step));
      let out = file;
      if (count > 1 && !MOVIE.test(file) && !file.includes('[')) { // sequence token before the first '.' of the file name
        const cut = Math.max(file.lastIndexOf('\\'), file.lastIndexOf('/')) + 1; const dot = file.indexOf('.', cut);
        out = dot < 0 ? `${file}.[${s}..${e}]` : `${file.slice(0, dot)}.[${s}..${e}]${file.slice(dot)}`;
      }
      app.logMsg('info', `Writting ${out}`);
      const images: number[] = [];
      for (let f = s; f <= e; f += step) { if (count > 1) app.logMsg('info', ` Frame ${f}`); images.push(f); }
      if (!images.length) return; // a negative step leaves Start > End: nothing written
      const size = { width: Number(clip.val('XRes') ?? clip.val('ResX') ?? 0) || null, height: Number(clip.val('YRes') ?? clip.val('ResY') ?? 0) || null };
      try { hostFs.writeFile(out, JSON.stringify({ clip: clip.name, source: clip.val('filename') ?? '', frames: images, ...size })); }
      catch { throw fail(C, E_FAIL, "Couldn't open file for writting"); }
      logNyaB10(app, C, 'the image pixels of the clip (image data is not modelled; a stand-in listing the written frames is saved)', B11H);
    },
  });

  // ================================================================ manipulation toggles
  regB10(app, 'Toggle Snapping', { // inferred: the MCP snap "ON" button
    undoable: false,
    execute() { const S = (viewTool as any).snap ?? ((viewTool as any).snap = {}); S.on = !S.on; app.events.emit('selection'); return !!S.on; },
  });
  // `Toggle Manipulator mode`: CMD-B17i, src/commands/toolsB17i.ts (manipulator manager setting).
  void objsOf;
}
