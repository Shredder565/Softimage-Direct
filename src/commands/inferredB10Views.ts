// Row CMD-B10 (INFERRED batch): tool activation, navigation and 3D-view commands of the registry categories
// Navigation, Viewing, Manipulation, Drawing, Paint and Selection that were missing from the command bus.
// See inferredB10Shared.ts for the sources. All registrations below are `// inferred`.
import * as THREE from 'three';
import { App, InteractiveTool } from '../core/commands';
import { X3DObject, Camera } from '../core/scene';
import { hostFs } from '../core/sdkHelpersHostFs';
import { tool as viewTool } from '../ui/viewManager';
import {
  b10, regB10, logNyaB10, unset, num, boolA, objsOf, findObj, moveComponents, vm, viewports, viewIndex, withView, orbitTarget, translateGlobal,
} from './inferredB10Shared';

const ev = (name: string, detail?: any) => window.dispatchEvent(new CustomEvent(name, { detail }));

/** Camera navigation tool commands → the view manager's navigation tool of the same name. */
const NAV: Record<string, string> = {
  Cam3dsMaxNavigTool: 'Navigation Tool', CamNavigTool: 'Navigation Tool', CamDollyTool: 'Dolly Tool', CamDriveTool: 'Drive Tool',
  CamFlyTool: 'Fly Tool', CamMayaZoomTool: 'Zoom Tool', CamOrbitTool: 'Orbit Tool', CamPanZoomTool: 'Pan & Zoom Tool',
  CamPivotTool: 'Pivot Tool', CamRectZoomTool: 'Rectangular Zoom Tool', CamRollTool: 'Roll Tool', CamTrackTool: 'Track Tool',
  CamWalkTool: 'Walk Tool', CamZoomTool: 'Zoom Tool',
};

export function registerInferredB10Views(app: App) {
  const st = b10(app);

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
    st.tool.current = name; st.tool.lastAux = { name, args: { ...a } };
    (app as any).armedTool = { label: t.name, clsid: a.Clsid ?? null };
    return it;
  };

  regB10(app, 'ManipulateTool', { // inferred: shows the 3D manipulators on the selection (MCP "Manipulate Tool" state)
    label: 'Manipulate Tool', undoable: false,
    execute(app, a) {
      (app as any).hideManip = false; (window as any).__mcp?.('manip', true);
      st.tool.current = 'ManipulateTool'; st.tool.lastAux = { name: 'ManipulateTool', args: { ...a } };
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
  regB10(app, 'LastTool', { // inferred: re-activates the last auxiliary tool this session used
    label: 'Last Auxiliary Tool', undoable: false,
    execute(app) {
      const last = st.tool.lastAux;
      if (!last) { app.logMsg('info', 'LastTool: no auxiliary tool has been used yet'); return null; }
      return app.run(last.name, last.args);
    },
  });

  // ================================================================ standard views
  for (const [name, view] of [['Front View', 'Front'], ['Back View', 'Back'], ['Right View', 'Right']] as const) {
    regB10(app, name, { // inferred: like the existing Top / Left / Bottom View keys: the active view shows that orthographic view
      label: name, undoable: false,
      execute(app) { const V = vm(); if (!V) { app.logMsg('info', `${name}: no 3D view is open`); return null; } V.view(view); return view; },
    });
  }
  regB10(app, 'AlignViewCamera', { // inferred: Axis 0/1/2 = X/Y/Z; the view camera looks down that axis at its interest (or the selection)
    undoable: false,
    execute(app, a) {
      const all = viewports(); const i = viewIndex(a.View); const vp = all[i];
      if (!vp) { app.logMsg('info', 'AlignViewCamera: no 3D view is open'); return null; }
      const ax = Math.max(0, Math.min(2, Math.trunc(num(a.Axis)))); const sgn = boolA(a.NegativeAxis) ? -1 : 1;
      let target = orbitTarget();
      if (boolA(a.AlignSelected) && app.selectedObjects.length) { target = new THREE.Vector3(); for (const o of app.selectedObjects) target.add(new THREE.Vector3().setFromMatrixPosition(o.globalMatrix())); target.divideScalar(app.selectedObjects.length); }
      const cam = vp.camera; const dist = Math.max(1, cam.position.distanceTo(target));
      const dir = new THREE.Vector3(); dir.setComponent(ax, sgn);
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.up.set(0, 1, 0); if (ax === 1) cam.up.set(0, 0, -sgn);
      cam.lookAt(target); cam.updateMatrixWorld();
      if (boolA(a.AlignSelected)) vm().orbitTarget?.()?.copy(target);
      return ['X', 'Y', 'Z'][ax];
    },
  });
  regB10(app, 'CameraUndo', { undoable: false, execute(app, a) { const i = viewIndex(a.View); if (i < 0) return null; withView(i, () => vm().undoCamera()); return i; } }); // inferred
  regB10(app, 'CameraRedo', { undoable: false, execute(app, a) { const i = viewIndex(a.View); if (i < 0) return null; withView(i, () => vm().redoCamera()); return i; } }); // inferred
  regB10(app, 'Frame Contextual', { // inferred: Frame Selection with a selection, Frame All without
    undoable: false,
    execute(app, a) {
      const sel = app.selectedObjects.length > 0;
      if (!boolA(a.AllViews) && viewports().length > 1) logNyaB10(app, 'Frame Contextual', 'framing one view only; the view manager frames all 3D views');
      ev(sel ? 'framesel' : 'frameall');
      return sel ? 'selection' : 'all';
    },
  });
  regB10(app, 'ResetAllViews', { // inferred: each view camera goes back to its view's default position
    label: 'Reset (All 3D Views)', undoable: false,
    execute(app, a) {
      const all = viewports(); if (!all.length) return 0;
      const which = boolA(a.AllViews) ? all.map((_, i) => i) : [viewIndex(a.View)];
      for (const i of which) if (all[i]) withView(i, () => vm().view(all[i].name));
      return which.length;
    },
  });
  regB10(app, 'GetViewIndex', { undoable: false, execute() { return viewIndex(-1); } }); // inferred: 0..3 = views A..D, -1 without a view manager
  regB10(app, 'SetViewCamera', { // inferred: the view looks through the named camera (the view takes the camera's name)
    undoable: false,
    execute(app, a) {
      const all = viewports(); const i = viewIndex(a.View); const vp = all[i];
      const name = String(a.CameraName ?? '');
      const cam = findObj(app, name);
      if (!cam || !(cam instanceof Camera || cam.type === 'camera')) throw new Error(`SetViewCamera: ${name || '(no name)'} is not a camera`);
      if (!vp) { app.logMsg('info', 'SetViewCamera: no 3D view is open'); return null; }
      const M = cam.globalMatrix(); const pos = new THREE.Vector3().setFromMatrixPosition(M);
      const fwd = new THREE.Vector3(0, 0, -1).transformDirection(M);
      vp.camera.position.copy(pos); vp.camera.lookAt(pos.clone().add(fwd)); vp.camera.updateMatrixWorld();
      (vp as any).viewCamera = cam.name;
      logNyaB10(app, 'SetViewCamera', 'keeping the view attached to the camera when it moves; the view takes its pose once');
      return cam.name;
    },
  });
  regB10(app, 'Hide Back Facing Polygons', { // inferred: per-view toggle
    undoable: false,
    execute(app) {
      const vp = viewports()[viewIndex(-1)]; if (!vp) return null;
      const k = 'Hide Back Facing Polygons'; vp.flags[k] = !vp.flags[k];
      logNyaB10(app, k, 'drawing with back faces culled (the view manager draws double-sided); the view flag is toggled');
      return vp.flags[k];
    },
  });
  regB10(app, 'ToggleMuteSolo', { // inferred: Target 0..3 = view A..D, other = active view; Mode 0 = mute, 1 = solo
    undoable: false,
    execute(app, a) {
      const all = viewports(); const t = num(a.Target, 4); const i = t >= 0 && t < all.length ? t : viewIndex(-1); const vp = all[i];
      if (!vp) return null;
      const x = vp.x ?? (vp.x = { muted: false, solo: false });
      if (num(a.Mode) === 1) { x.solo = !x.solo; for (const v of all) if (v !== vp && v.x) v.x.solo = false; } else x.muted = !x.muted;
      return num(a.Mode) === 1 ? !!x.solo : !!x.muted;
    },
  });
  const nudge = (name: string) => regB10(app, name, { // inferred: X / Y in half pixels of the view; selected objects move in view space
    execute(app, a) {
      const all = viewports(); const vp = all[viewIndex(a.View)];
      const objs = app.selectedObjects; if (!objs.length) return 0;
      if (!vp) { app.logMsg('info', `${name}: no 3D view is open`); return 0; }
      const cam = vp.camera as any; const h = Math.max(1, (vp as any).el?.clientHeight || 400);
      const target = orbitTarget();
      const unit = vp.kind === 'ortho' ? ((cam._zoom ?? 20) * 2) / h : (2 * Math.tan(THREE.MathUtils.degToRad((cam.fov ?? 45) / 2)) * cam.position.distanceTo(target)) / h;
      const half = name === 'ViewTranslate' ? 1 : 0.5;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const d = right.multiplyScalar(num(a.X) * unit * half).add(up.multiplyScalar(num(a.Y) * unit * half));
      translateGlobal(app, objs, d, name);
      if (name === 'ViewTranslate') logNyaB10(app, name, 'the unit of X / Y (pixels of the view are used)');
      return objs.length;
    },
  });
  for (const n of ['ViewNudgeDown', 'ViewNudgeLeft', 'ViewNudgeRight', 'ViewNudgeUp', 'ViewTranslate']) nudge(n);
  regB10(app, 'DelayedRefresh', { // inferred: the views refresh after the running script returns
    undoable: false,
    execute(app, a) {
      const t = unset(a.Time) ? null : num(a.Time);
      st.delayedRefresh.push(t);
      setTimeout(() => { if (t !== null && t !== app.anim.frame) app.anim.frame = t; app.events.emit('scene'); app.events.emit('params'); }, 0);
      return true;
    },
  });
  regB10(app, 'ResetDirectX', { // inferred: WebGL has no DirectX device; the views are redrawn
    undoable: false,
    execute(app) { app.events.emit('scene'); app.logMsg('info', 'ResetDirectX: this build draws with WebGL; the views were refreshed'); return true; },
  });
  regB10(app, 'SetDropMessage', { // inferred
    undoable: false,
    execute(app, a) { st.dropMessage = String(a.Message ?? ''); logNyaB10(app, 'SetDropMessage', 'where the message is shown while dragging onto a 3D view'); return st.dropMessage; },
  });
  regB10(app, 'Show3DContextMenu', { // inferred: opens the 3D view context menu at the active view
    undoable: false,
    execute(app) {
      const vp = viewports()[viewIndex(-1)] as any; const el: HTMLElement | undefined = vp?.el;
      if (!el) { app.logMsg('info', 'Show3DContextMenu: no 3D view is open'); return false; }
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 2 }));
      return true;
    },
  });
  regB10(app, 'StartTimedPlayback', { // inferred: plays the scene range once in the target view and reports the frame rate
    undoable: false,
    execute(app, a) {
      const A = app.anim; const t0 = performance.now(); const saved = A.frame; let n = 0;
      for (let f = A.startFrame; f <= A.endFrame; f++) { A.frame = f; n++; }
      A.frame = saved;
      const s = (performance.now() - t0) / 1000; const fps = s > 0 ? n / s : n;
      if (num(a.Target, -1) >= 0) logNyaB10(app, 'StartTimedPlayback', 'restricting the playback to one view');
      app.logMsg('info', `StartTimedPlayback: ${n} frames in ${s.toFixed(3)} s (${fps.toFixed(1)} fps)`);
      return fps;
    },
  });
  regB10(app, 'RunPerformanceTest', { // inferred: Type 0 evaluates the frame range for Duration seconds and reports the rate
    undoable: false,
    execute(app, a) {
      const type = num(a.Type); const dur = Math.max(0.01, Math.min(num(a.Duration, 5), 30));
      if (type !== 0) logNyaB10(app, 'RunPerformanceTest', `test Type ${type}; the scene evaluation test (Type 0) is run`);
      const A = app.anim; const saved = A.frame; const t0 = performance.now(); let n = 0; let f = A.startFrame;
      while ((performance.now() - t0) / 1000 < dur && n < 100000) { A.frame = f; for (const o of app.scene.allObjects()) o.primitive?.geom(); n++; f = f >= A.endFrame ? A.startFrame : f + 1; }
      A.frame = saved;
      const s = (performance.now() - t0) / 1000; st.perf = { type, frames: n, seconds: s, fps: n / s };
      const text = `Performance test: ${n} frames, ${s.toFixed(3)} s, ${(n / s).toFixed(2)} fps`;
      app.logMsg('info', text);
      if (!unset(a.FileName)) try { hostFs.writeFile(String(a.FileName), text + '\n'); } catch (e: any) { app.logMsg('error', `RunPerformanceTest: ${e?.message ?? e}`); }
      return st.perf.fps;
    },
  });
  for (const name of ['SaveFastPlaybackCache', 'LoadFastPlaybackCache'] as const) {
    regB10(app, name, { // inferred: the cache holds the frames last played in the view; stored in the session file system
      undoable: false,
      execute(app, a) {
        const i = viewIndex(a.View); const file = String(a.FileName ?? '');
        if (!file) throw new Error(`${name}: FileName is required`);
        if (name === 'SaveFastPlaybackCache') {
          const frames: number[] = []; for (let f = app.anim.startFrame; f <= app.anim.endFrame; f++) frames.push(f);
          st.playbackCaches.set(i, { frames, file });
          hostFs.writeFile(file, JSON.stringify({ view: i, frames }));
          logNyaB10(app, name, 'the cached images (the frame list is saved)');
          return frames.length;
        }
        const d = JSON.parse(hostFs.readFile(file));
        st.playbackCaches.set(i, { frames: d.frames ?? [], file });
        logNyaB10(app, name, 'playing back cached images (the frame list is loaded)');
        return (d.frames ?? []).length;
      },
    });
  }

  // ================================================================ manipulation toggles
  regB10(app, 'Toggle Snapping', { // inferred: the MCP snap "ON" button
    undoable: false,
    execute() { const S = (viewTool as any).snap ?? ((viewTool as any).snap = {}); S.on = !S.on; app.events.emit('selection'); return !!S.on; },
  });
  regB10(app, 'Toggle Manipulator mode', { // inferred: shows / hides the SRT manipulators set by the current transform mode
    undoable: false,
    execute(app) { const A = app as any; A.hideManip = !A.hideManip; app.events.emit('selection'); return !A.hideManip; },
  });
  void objsOf;
}
