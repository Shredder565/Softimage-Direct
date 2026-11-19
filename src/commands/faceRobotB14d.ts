// Ledger row CMD-B14d (Face Robot `FR.dll`): retarget / mocap / stage commands. Brief: the "Wire contract" sections of
// docs/ghidra/cmd-b14d-fr-retarget-mocap.md and docs/re/WIRE_CORRECTIONS_B14.md items 1-3. Original code written from
// that prose only; no XSIBATCH golden exists. The C3D / face-map commands are in faceRobotB14dC3D.ts.
//
// Stand-ins of this build:
//  * The `Face Robot` layout (facerobot.xsily) is the Face Robot Control Panel tray; `de(app,'B14d').layoutPresent`
//    says whether it exists, PutActiveLayout enables Face Robot and opens the Control Panel. The tray's stage tabs (1..6)
//    follow the layout switch; fr_GetCurrentStage returns the scene's stage code (0, 10, 15, 30, 40, 50, 60).
//  * `General.undo` is the app's undo level (`app.maxUndo`).
//  * `DSMustHideFaceRobotUI()` is `app.__frMustHideUI`; "interactive" is `frState(app).interactive`.
//  * The `.frpre` pose layout is not attested (Q4): fr_SaveFacePose / fr_ApplyFacePose use this build's own token layout.
import { App } from '../core/commands';
import { X3DObject, Property } from '../core/scene';
import {
  frState, faceModel, stageCode, frWarn, progress, unset, numArg, intArg, boolArg, isFile, hostFs, propNamed, addProperty,
  fail, failLog, E_FAIL, S_OK, S_FALSE, findByName,
} from './faceRobotB14Shared';
import {
  CAT, de, nyaD, wrap, deleteNode, openPanel, setStatus, faceCalibrateDefs, facePlotDefs, findOrAddProp, controlsList,
  retargetBlob, retargetData, locText, CALIB_AREAS,
} from './faceRobotB14deShared';
import { registerFaceRobotB14dC3DCommands, readC3D } from './faceRobotB14dC3D';
import { buildSampleFace, meshObject, newNull, ensureGroup } from './faceRobotB14Shared';
import { makeConstant, Operator } from '../core/scene';
import { EnvelopeOperator } from '../core/envelope';
import { setFaceRobotStage } from '../ui/faceRobotController';
import { setFaceRobotEnabled } from './faceRobotModule';

const sArg = (v: any) => (unset(v) ? '' : String(v));
const openView = (name: string) => { try { window.dispatchEvent(new CustomEvent('openview', { detail: { name } })); } catch { /* no UI */ } };

// fr_CalibrateFace argument -> FaceCalibrateProperties parameter, in argument order
export const CALIBRATE_ARGS: [string, string][] = [
  ['Uulipscale', 'UpULipScale'], ['Uulippitch', 'UpULipPitch'], ['Ullipscale', 'UpLLipScale'], ['Ullippitch', 'UpLLipPitch'],
  ['Ujawscale', 'UpJawScale'], ['Ujawpitch', 'UpJawPitch'], ['Unosescale', 'UpNoseScale'], ['Unosepitch', 'UpNosePitch'],
  ['Ueyesscale', 'UpEyesScale'], ['Ueyspitch', 'UpEyesPitch'],
  ['Dulipscale', 'DownULipScale'], ['Dulippitch', 'DownULipPitch'], ['Dllipscale', 'DownLLipScale'], ['Dllippitch', 'DownLLipPitch'],
  ['Djawscale', 'DownJawScale'], ['Djawpitch', 'DownJawPitch'], ['Dnosescale', 'DownNoseScale'], ['Dnosepitch', 'DownNosePitch'],
  ['Deyesscale', 'DownEyesScale'], ['Deyspitch', 'DownEyesPitch'],
];
void CALIB_AREAS;

// ------------------------------------------------------------------ layout switch (0x18011c320)
export const STAGE_VIEWS: Record<number, string[]> = {
  1: ['stage1'], 2: ['stage2'], 3: ['stage3'], 4: ['stage4'], 5: ['stage5', 'stage5library', 'stage5lower'], 6: ['stage6', 'stage6mid', 'stage6lower'],
};
/** The fr_SwitchFaceLayout logic. Throws E_FAIL when the Face Robot layout is missing. */
export function switchFaceLayout(app: App, command: string, idIn: number) {
  const st = de(app, 'B14d');
  if (!frState(app).interactive || (app as any).__frMustHideUI) return;
  let id = idIn === 0 ? stageCode(app) : idIn;
  if (id < 10) id *= 10;
  const n = Math.trunc(id / 10);
  if (st.activeLayout !== 'Face Robot' && !st.layoutPresent) {
    nyaD(app, command, 'the text in parentheses after "Terminating."');
    throw failLog(app, command, E_FAIL, 'Unable to locate Face Robot layout.  Terminating.');
  }
  // Desktop.PutActiveLayout, every call
  st.activeLayout = 'Face Robot'; st.putActiveLayoutCalls++;
  setFaceRobotEnabled(app, true); openView('Face Robot Control Panel');
  if (id === 50) { wrap(app, 'B14d', 'ShowOptionalPanel', { Name: 'timeline' }); wrap(app, 'B14d', 'ShowOptionalPanel', { Name: 'toolset' }); }
  const names = STAGE_VIEWS[n] ?? [];
  st.stageViews = names.map(v => ({ name: v, refresh: true, visible: v === 'stage5' ? false : null }));
  if (names.some(v => v !== 'stage5')) nyaD(app, command, 'PutVisible value of the stage views');
  st.lastLayoutId = id; st.lastStage = n;
  st.titleFrame = `views\\stage${n}_titleframe.html`;   // built, not used (inferred)
  if (n >= 1 && n <= 6) setFaceRobotStage(app, n);
}

// ------------------------------------------------------------------ pose files (own layout)
const POSE_TAG = 'FRPosePreset';
const POSE_NODES = ['Head_Control', 'Tongue', 'Nose', 'ComboMarker'];

export function registerFaceRobotB14dCommands(app: App) {
  registerFaceRobotB14dC3DCommands(app);
  // helpers for tools/compare_fr_b14de_commands.mjs (the sample face and stand-in objects)
  (app as any).frB14de = { buildSampleFace, stageCode, readC3D, meshObject, newNull, ensureGroup, makeConstant, EnvelopeOperator, Property, Operator };

  // ---------------------------------------------------------------- calibration
  app.register({
    name: 'fr_CalibrateFace', label: 'fr_CalibrateFace', category: CAT,
    args: CALIBRATE_ARGS.map(([n]) => ({ name: n, default: null })),
    execute(app, a) {
      const m = faceModel(app); if (!m) return;
      const p = findOrAddProp(app, m, 'FaceCalibrateProperties', faceCalibrateDefs);
      for (const [arg, pn] of CALIBRATE_ARGS) { const q = p.get(pn); if (q) app.setParam(q, numArg(a[arg], 0)); }   // an empty value converts to 0 (inferred)
    },
  });
  app.register({
    name: 'fr_LogFaceCalibration', label: 'fr_LogFaceCalibration', category: CAT, args: [],
    execute(app) {
      const m = faceModel(app); if (!m) return;
      const p = findOrAddProp(app, m, 'FaceCalibrateProperties', faceCalibrateDefs);
      nyaD(app, 'fr_LogFaceCalibration', 'separators and value order of the log line (fr_CalibrateFace argument order, ", " used)');
      app.logMsg('info', `CalibrateFace(${CALIBRATE_ARGS.map(([, pn]) => String(p.val(pn))).join(', ')})`);
    },
  });

  // ---------------------------------------------------------------- panels
  app.register({
    name: 'fr_AdjustRetargetedFace', label: 'fr_AdjustRetargetedFace', category: CAT, args: [],
    execute(app) {
      const m = faceModel(app); const p = m ? propNamed(m, 'FaceAdjustProperties') : undefined;
      if (!m || !p) { frWarn(app, 'Select a model with retargeted motion.'); return; }
      de(app, 'B14d').adjustModel = m.fullName;
      openPanel(app, 'B14d', 'fr_AdjustRetargetedFace', p, 'FaceAdjust', 15, 15);
    },
  });
  app.register({
    name: 'fr_CalibrateRetargetedFace', label: 'fr_CalibrateRetargetedFace', category: CAT, args: [],
    execute(app) {
      const m = faceModel(app); if (m) de(app, 'B14d').calibrateModel = m.fullName;
      let p = m ? propNamed(m, 'FaceCalibrateProperties') : undefined;
      if (!m || !p) { frWarn(app, 'Could not find a face model with retargeted motion or a facial preset pose.'); return; }
      if (!p.get('DownLLipScale')) { deleteNode(app, p); p = addProperty(app, m, new Property('FaceCalibrateProperties', 'customparamset', faceCalibrateDefs())); }
      openPanel(app, 'B14d', 'fr_CalibrateRetargetedFace', p, 'FaceCalibrate', 15, 15);
    },
  });
  app.register({
    name: 'fr_FacialMocapTools', label: 'fr_FacialMocapTools', category: CAT, args: [],
    execute(app) {
      const root = app.scene.root;
      let p = propNamed(root, 'FacialMocapTools');
      if (!p) {
        nyaD(app, 'fr_FacialMocapTools', 'C3DDir default (Application.InstallationPath enum, Q4)');
        p = addProperty(app, root, new Property('FacialMocapTools', 'customparamset', [
          { name: 'C3DDir', label: 'C3DDir', type: 'string', value: '', animatable: false },
          { name: 'FaceNameFile', label: 'FaceNameFile', type: 'string', value: '', animatable: false },
        ]));
      }
      openPanel(app, 'B14d', 'fr_FacialMocapTools', p, 'FacialMocapTools', 150, 150);
    },
  });

  // ---------------------------------------------------------------- flush
  app.register({
    name: 'fr_FlushRetargetedFace', label: 'fr_FlushRetargetedFace', category: CAT, args: [],
    execute(app) {
      const C = 'fr_FlushRetargetedFace'; const m = faceModel(app); if (!m) return;
      nyaD(app, C, 'un-retarget body 0x18014a050 (steps inferred from its strings)');
      progress(app, locText(app, 'pbar_clear_retarget'));
      const OPS = ['fro_FaceRetargetOp', 'fro_FaceRetargetOp2', 'fro_FaceRetargetHeadNullOp', 'fro_FaceRetargetLocalOp', 'fro_FaceRetargetCompensateOp'];
      for (const o of [m, ...m.descendants()]) {
        for (const op of [...(o.primitive?.operators ?? [])]) if (OPS.includes(op.type)) deleteNode(app, op);
        const ro: string[] | undefined = (o as any).retargetOps;
        if (ro?.length) { const old = [...ro]; app.record('RemoveRetarget', () => { (o as any).retargetOps = ro.filter(t => !OPS.includes(t)); }, () => { (o as any).retargetOps = old; }); }
      }
      const layer = app.scene.layers.find(l => l.name === 'Head_ControlLayer');
      if (layer) { const i = app.scene.layers.indexOf(layer); app.record('DeleteLayer', () => app.scene.layers.splice(app.scene.layers.indexOf(layer), 1), () => app.scene.layers.splice(i, 0, layer)); }
      const g = app.scene.groupList.find(x => x.name === 'Controls' || x.name === 'controls');
      if (g) for (const o of g.members) { const q = o.property('visibility')?.get('viewvis'); if (q) app.setParam(q, true); }   // restored value inferred: visible
      wrap(app, 'B14d', 'fr_ResetAll');
    },
  });

  // ---------------------------------------------------------------- plot
  const plotEngine = (app: App, C: string, start: number, end: number, step: number, clip: boolean, split: boolean): boolean => {
    const m = faceModel(app);
    if (!m) { app.logMsg('error', 'Could not find a Face Robot rig.'); return false; }
    if (!retargetData(retargetBlob(app, m))) { app.logMsg('error', 'Could not find a Face Robot rig with retargeted motion.'); return false; }
    progress(app, locText(app, 'pbar_plot_motion'));
    const nodes = [...controlsList(app)];
    for (const n of ['Head_Control', 'Tongue', 'ComboMarker']) for (const o of m.descendants()) if (o.name === n && !nodes.includes(o)) nodes.push(o);
    const frames: number[] = [];
    if (step <= 0) { nyaD(app, C, 'plot engine with step 0 (only the start frame is plotted)'); frames.push(start); }
    else for (let f = start; f <= end; f += step) frames.push(f);
    const PS = ['sclx', 'scly', 'sclz', 'rotx', 'roty', 'rotz', 'posx', 'posy', 'posz'];
    const cur = app.anim.frame;
    for (const f of frames) {
      app.anim.frame = f;
      for (const o of nodes) for (const pn of PS) { const q = o.kinematics.local.get(pn)!; const v = Number(q.value); const fc = app.anim.fcurve(q, true)!; const had = fc.hasKey(f); const old = fc.keys.find(k => k.time === f)?.value; app.record('Plot', () => fc.addKey(f, v), () => { if (had) fc.addKey(f, old!); else fc.removeKey(f); }); }
    }
    app.anim.frame = cur;
    de(app, 'B14d').lastPlot = { frames, nodes: nodes.map(o => o.name) };
    nyaD(app, C, 'plot engine 0x180161290 (kine.global plotting, retarget evaluation)');
    if (clip) nyaD(app, C, 'PlotToActionClip: StoreAction into <name>_Clip');
    if (split) nyaD(app, C, 'SplitTracks: CutClipInSpace / CreateCompound');
    return true;
  };
  app.register({
    name: 'fr_PlotRetargetedFace', label: 'fr_PlotRetargetedFace', category: CAT,
    args: ['Start', 'End', 'IntervalStep', 'PlotToActionClip', 'SplitTracks'].map(n => ({ name: n, default: null })),
    execute(app, a) {
      const C = 'fr_PlotRetargetedFace';
      const start = intArg(a.Start, 0), end = intArg(a.End, 100); let step = intArg(a.IntervalStep, 0);
      if (step < 1 || end <= start) step = 0;
      if (end - start < step) throw failLog(app, C, E_FAIL, 'Error in inputs Step is too large: fr_PlotRetargetedFace(Start, End, Step)');
      const r = plotEngine(app, C, start, end, step, boolArg(a.PlotToActionClip, false), boolArg(a.SplitTracks, false));
      setStatus(app, 'B14d', C, r ? S_OK : S_FALSE);
      return r;
    },
  });
  app.register({
    name: 'fr_PlotRetargetedFaceUI', label: 'fr_PlotRetargetedFaceUI', category: CAT, args: [],
    execute(app) {
      const C = 'fr_PlotRetargetedFaceUI'; const m = faceModel(app);
      if (!m) throw fail(E_FAIL, `${C}: no face model`);
      const p = findOrAddProp(app, m, 'FacePlotProperties', facePlotDefs);
      for (const [n, v] of [['Start', 0], ['End', 0], ['IntervalStep', 1], ['PlotToActionClip', false], ['SplitTracks', false]] as const) { const q = p.get(n); if (q) app.setParam(q, v); }
      const ok = de(app, 'B14d').hooks.inspect?.(C, p, 'Plot Tool');
      app.logMsg('info', `${C}: InspectObj "Plot Tool" (siModal) ${ok ? 'OK' : 'cancelled'}`);
      const args = ok
        ? { Start: p.val('Start'), End: p.val('End'), IntervalStep: p.val('IntervalStep'), PlotToActionClip: p.val('PlotToActionClip'), SplitTracks: p.val('SplitTracks') }
        : { Start: 0, End: 0, IntervalStep: 1, PlotToActionClip: false, SplitTracks: false };
      deleteNode(app, p);
      const r = app.run('fr_PlotRetargetedFace', args);
      setStatus(app, 'B14d', C, de(app, 'B14d').lastStatus['fr_PlotRetargetedFace'] ?? S_OK);
      return r;
    },
  });

  // ---------------------------------------------------------------- face poses
  app.register({
    name: 'fr_SaveFacePose', label: 'fr_SaveFacePose', category: CAT,
    args: [{ name: 'selectiononly', default: null }, { name: 'filename', default: null }],
    execute(app, a) {
      const C = 'fr_SaveFacePose';
      let file = sArg(a.filename);
      if (!file) { file = frState(app).hooks.fileDialog?.(C, 'Save Pose Preset', 'Save Pose Preset (*.frpre)|*.frpre||') ?? ''; app.logMsg('info', `${C}: file dialog "Save Pose Preset"${file ? ': ' + file : ': cancelled'}`); if (!file) return; }
      const m = faceModel(app); const cal = m ? propNamed(m, 'FaceCalibrateProperties') : undefined;
      if (!m || !cal) { app.logMsg('error', 'Could not find the calibration data.'); return; }
      nyaD(app, C, 'pose writer 0x1801639b0 and the .frpre layout (Q4; this build writes its own token layout)');
      progress(app, locText(app, 'pbar_save_pose'));
      app.logMsg('info', `posefile saving: ${file}`);
      let nodes = [...controlsList(app)];
      for (const n of POSE_NODES) { const o = [...m.descendants()].find(x => x.name === n); if (o && !nodes.includes(o)) nodes.push(o); }
      if (boolArg(a.selectiononly, false)) nodes = nodes.filter(o => app.selection.includes(o));
      const lines = [POSE_TAG, `Calibration ${CALIBRATE_ARGS.map(([, pn]) => String(cal.val(pn))).join(' ')}`];
      for (const o of nodes) {
        app.logMsg('info', `processing marker: ${o.name}`);
        const l = o.kinematics.local;
        app.logMsg('info', `\tZeroPose for Node ${o.name}`); app.logMsg('info', `\tGlobalPose for Node ${o.name}`);
        lines.push(`<Add> ${o.name} ${['rotx', 'roty', 'rotz', 'posx', 'posy', 'posz'].map(p => String(l.val(p))).join(' ')}`);
      }
      lines.push('RefOnly');
      try { hostFs.writeFile(file, lines.join('\n') + '\n'); } catch { app.logMsg('error', `${C}: cannot write ${file}`); }
    },
  });
  app.register({
    name: 'fr_ApplyFacePose', label: 'fr_ApplyFacePose', category: CAT,
    args: [{ name: 'posefile', default: null }, { name: 'selectOnApplication', default: null }],
    execute(app, a) {
      const C = 'fr_ApplyFacePose'; const f = sArg(a.posefile);
      if (!f) { app.logMsg('error', 'fr_ApplyFacePose: missing pose file.'); return []; }
      wrap(app, 'B14d', 'fr_ResetAll');
      const m = faceModel(app);
      if (!m) { app.logMsg('error', 'Could not find a Face Robot rig.'); return []; }
      const cal = propNamed(m, 'FaceCalibrateProperties');
      if (!cal) { app.logMsg('error', 'Could not find the calibration values.'); return []; }
      let text: string | null = null; try { text = isFile(f) ? hostFs.readFile(f) : null; } catch { text = null; }
      const lines = (text ?? '').split(/\r?\n/);
      if (lines[0] !== POSE_TAG) { app.logMsg('error', `Invalid Pose File: ${f}`); return []; }
      nyaD(app, C, 'pose applier 0x180154d40 (calibration scaling, OldFormat, RotateHead / TranslateHead)');
      progress(app, locText(app, 'pbar_apply_pose'));
      const out: X3DObject[] = [];
      for (const line of lines) {
        const t = line.split(/\s+/); if (t[0] !== '<Add>') continue;
        const o = [...m.descendants()].find(x => x.name === t[1]) ?? findByName(app, t[1]); if (!o) continue;
        ['rotx', 'roty', 'rotz', 'posx', 'posy', 'posz'].forEach((p, i) => { const q = o.kinematics.local.get(p); const v = Number(t[2 + i]); if (q && Number.isFinite(v)) app.setParam(q, v); });
        out.push(o);
      }
      if (boolArg(a.selectOnApplication, false)) app.select(out);
      return out;
    },
  });

  // ---------------------------------------------------------------- FaceRobot / stage / layout
  app.register({
    name: 'FaceRobot', label: 'FaceRobot', category: CAT,
    args: [{ name: 'cmd', default: null }, { name: 'arg', default: null }, { name: 'id', default: null }],
    execute(app, a) {
      const C = 'FaceRobot'; const st = de(app, 'B14d');
      app.select([]);
      let cmd = sArg(a.cmd), arg = sArg(a.arg); void sArg(a.id);
      if (cmd === 'analyze' || cmd === 'solve') { cmd = ''; arg = ''; }
      if (cmd === '' || cmd === 'next') arg = '';
      const A = app as any; let saved = A.maxUndo ?? 50;
      if (saved === 0 && cmd === '') saved = 50;
      A.maxUndo = 0; st.undoDuring = A.maxUndo;
      try {
        let s = stageCode(app); st.faceRobotStage = s;
        if (cmd === 'id') { app.logMsg('info', 'Autodesk|FACE ROBOT 2.0'); return; }
        if (cmd !== '' && cmd !== 'clear' && cmd !== 'next') { app.logMsg('info', `Unknown Face Robot command: ${cmd}`); return; }
        if (cmd === '' || cmd === 'clear') {
          const flag = cmd === 'clear' && arg === 'type' && s <= 29; st.clearFlag = flag;
          nyaD(app, C, `settings reset 0x180027660(${flag}) and 0x18002d0e0(${s}, false)`);
        } else {
          if (s === 15) nyaD(app, C, 'stage 15 "next" action 0x1800222e0');
          else if (s === 30 || s === 35) { nyaD(app, C, `PickPoints expected child count and the analyze step 0x1800114c0(${arg})`); s = 30; }
          else if (s === 40 || s === 45) nyaD(app, C, `solve step 0x18001d9e0(${arg})`);
        }
        try { switchFaceLayout(app, C, s); } catch { /* the status of FaceRobot is always OK */ }
      } finally {
        A.maxUndo = saved;   // inferred: restored on every path ("for the duration")
      }
    },
  });
  app.register({
    name: 'fr_GetCurrentStage', label: 'fr_GetCurrentStage', category: CAT, args: [], undoable: false, noLog: true,
    execute(app) { return stageCode(app); },
  });
  app.register({
    name: 'fr_SwitchFaceLayout', label: 'fr_SwitchFaceLayout', category: CAT, args: [{ name: 'inLayoutID', default: null }], undoable: false, noLog: true,
    execute(app, a) {
      const raw = a?.inLayoutID;
      switchFaceLayout(app, 'fr_SwitchFaceLayout', intArg(raw, 0));
      // return value disabled: nothing is returned
    },
  });
}
