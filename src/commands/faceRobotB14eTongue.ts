// Ledger row CMD-B14e (Face Robot `FR.dll`): fr_FitTongue, fr_SolveTongue and fr_RegenerateMouth. Brief: the "Wire
// contract" sections of docs/ghidra/cmd-b14e-fr-export-weights.md and docs/re/WIRE_CORRECTIONS_B14.md items 4-6. These
// replace the inferred property-tag bodies that src/commands/faceRobotModule.ts registered before a contract existed.
// Original code written from that prose only; no XSIBATCH golden exists.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property, Operator } from '../core/scene';
import { bool, num, str } from '../core/params';
import {
  frStore, faceModel, faceMesh, faceConnections, entryObject, frGroup, addToGroup, newNull, nodesArg, objArg, boolArg,
  numArg, fail, msgBox, cuCompare, put, E_FAIL, S_OK, S_FALSE, FR_CAPTION, propNamed, addProperty, isInScene,
} from './faceRobotB14Shared';
import {
  CAT, de, nyaE, wrap, deleteNode, setStatus, setKeywords, getKeyed, globalPos, setGlobalPos, setGlobalMatrix, setLocal,
  reparent, fitNull, controlsList, controlNamed, retargetMute,
} from './faceRobotB14deShared';
import { switchFaceLayout } from './faceRobotB14d';

const TONGUE_PARTS = ['TongueBase', 'TongueBack', 'TongueFront', 'TongueTip'] as const;
const SRT6 = ['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz'];

function classify(markers: X3DObject[], suffix = ''): Record<string, X3DObject | undefined> {
  const out: Record<string, X3DObject | undefined> = {};
  for (const part of TONGUE_PARTS) out[part] = markers.find(m => m.name.includes(part + suffix));
  return out;
}
function setNullSize(app: App, o: X3DObject, size: number) { const q = o.properties.find(p => p.type === 'display' || p.get('size'))?.get('size') ?? (o as any).get?.('size'); if (q) app.setParam(q, size); else (o as any).nullSize = size; }

/** The stage refresh of cmd-b14e §2 (`0x180118890`), called by fr_SolveTongue. */
function stageRefresh(app: App, C: string) {
  try { switchFaceLayout(app, C, 0); } catch { /* layout missing: the refresh goes on */ }
  nyaE(app, C, 'stage refresh: Interaction.stickytoggle value and the user camera (fov 20, posy 1, posz 42, interestdist 42)');
  wrap(app, 'B14e', 'HideOptionalPanel', { Name: 'lipsync_stow' });
  nyaE(app, C, 'stage at which SetControlKeys and the TonguePlay compound update run');
  (app as any).__faceRobotInitialized = 1;   // DSSetFaceRobotInitialized(1)
}

export function registerFaceRobotB14eTongueCommands(app: App) {
  // ---------------------------------------------------------------- fr_FitTongue
  app.register({
    name: 'fr_FitTongue', label: 'fr_FitTongue', category: CAT, description: '',
    args: [{ name: 'HeadNull', default: null }, { name: 'TongueMesh', default: null }, { name: 'TongueMarkers', default: [] }, { name: 'MustDeleteMarkers', default: false }, { name: 'Scale', default: 1.0 }],
    execute(app, a) {
      const C = 'fr_FitTongue'; const store = frStore(app);
      const mesh = objArg(app, a.TongueMesh);
      const passed = nodesArg(app, a.TongueMarkers).filter((n): n is X3DObject => n instanceof X3DObject);
      if (!mesh) throw fail(E_FAIL, `${C}: TongueMesh is not valid`);
      if (passed.length < 4) throw fail(E_FAIL, `${C}: fewer than 4 TongueMarkers`);
      const head = objArg(app, a.HeadNull) ?? entryObject(app, 'hpoints', 'HeadNull');
      if (!head) throw fail(E_FAIL, `${C}: no HeadNull`);
      const cur = store.raw('meshes', 'Tongue');
      if (cur !== undefined && cur !== '') { setStatus(app, 'B14e', C, S_FALSE); return; }
      store.put('meshes', 'Tongue', mesh);
      const g = frGroup(app, 'Tongue'); if (g) addToGroup(app, g, mesh);
      // tongue fit (0x180060750)
      setKeywords(app, mesh, 'Tongue,Mesh');
      const kids = TONGUE_PARTS.map(n => mesh.children.find(c => c.name === n));
      const own = kids.every(k => !!k);
      let markers: X3DObject[];
      if (own) { markers = kids as X3DObject[]; wrap(app, 'B14e', 'HideAndUnselect', { Target: markers }); }
      else markers = passed;
      if (markers.length !== 4) { put(app, C, []); return []; }
      const cls = classify(markers);
      if (!own && cls.TongueBase && cls.TongueTip) {
        const B = globalPos(cls.TongueBase), T = globalPos(cls.TongueTip);
        if (cls.TongueBack) setGlobalPos(app, cls.TongueBack, B.clone().multiplyScalar(0.67).add(T.clone().multiplyScalar(0.33)));
        if (cls.TongueFront) setGlobalPos(app, cls.TongueFront, B.clone().multiplyScalar(0.34).add(T.clone().multiplyScalar(0.66)));
      }
      const fit = fitNull(app);
      if (!fit) nyaE(app, C, 'fit without the registry Fit null (the nulls go under the scene root)');
      nyaE(app, C, 'null builder 0x180007870 (suffix "_Marker", display constant 0x14c) and the use of Scale (Q4)');
      const size = cls.TongueBase && cls.TongueTip ? 0.08 * globalPos(cls.TongueTip).distanceTo(globalPos(cls.TongueBase)) : 0;
      const made: X3DObject[] = [];
      for (const mk of [...markers].sort((x, y) => cuCompare(x.name, y.name))) {
        const p = globalPos(mk); const n = newNull(app, `${mk.name}_Marker`, fit ?? null);
        setGlobalPos(app, n, p); setNullSize(app, n, size); made.push(n);
      }
      if (boolArg(a.MustDeleteMarkers, false)) for (const m of passed) deleteNode(app, m);
      void numArg(a.Scale, 1);
      setStatus(app, 'B14e', C, S_OK);
      return made;
    },
  });

  // ---------------------------------------------------------------- fr_SolveTongue
  app.register({
    name: 'fr_SolveTongue', label: 'fr_SolveTongue', category: CAT, description: '',
    args: [{ name: 'Rescale', default: false }],
    execute(app, a) {
      const C = 'fr_SolveTongue';
      if (getKeyed(app, ['Tongue', 'Base']).length) { setStatus(app, 'B14e', C, S_OK); return true; }
      // solver 0x180097780
      let failed = false; let refs: X3DObject[] = [];
      const mesh = entryObject(app, 'meshes', 'Tongue');
      const fit = fitNull(app);
      if (mesh) {
        const parent = controlNamed(app, 'JawEnd_Control') ?? getKeyed(app, ['Jaw', 'Bone'])[0] ?? faceModel(app);
        if (parent && parent !== mesh) reparent(app, mesh, parent);
        wrap(app, 'B14e', 'fr_IsHeadMesh', {});
        const markers = fit ? [...fit.descendants()].filter(o => /^Tongue.*Marker$/.test(o.name)) : [];
        if (markers.length < 4) { app.logMsg('info', 'Tongue markers are missing'); failed = true; }
        else {
          const cls = classify(markers, '_Marker');
          if (boolArg(a.Rescale, false)) { wrap(app, 'B14e', 'fr_ScaleTongueMesh', {}); nyaE(app, C, 'scale passed to fr_ScaleTongueMesh'); }
          for (const part of TONGUE_PARTS) {
            const n = newNull(app, `${part}_Control`, parent ?? null);
            const mk = cls[part]; if (mk) setGlobalPos(app, n, globalPos(mk));   // inferred: the control starts at its marker
            setKeywords(app, n, `Tongue,${part.slice('Tongue'.length)}`);
            refs.push(n);
          }
          wrap(app, 'B14e', 'SetValue', { Target: 'Views.ViewB.UserCamera.camvis.objnulls', Value: true });
          nyaE(app, C, 'display constant 0x15e of the controls, the parameter tagging and the envelope / bind helpers 0x1801a7d20, 0x1800961e0, 0x180096f80');
        }
      }   // no registered tongue mesh: the solver stops early, no failure flag is set (cmd-b15 Q1)
      // step 3: delete the Tongue*Marker nulls under Fit
      if (fit && isInScene(app, fit)) for (const o of [...fit.descendants()]) if (/^Tongue.*Marker$/.test(o.name) && isInScene(app, o)) deleteNode(app, o);
      if (failed && refs.length <= 3) { setStatus(app, 'B14e', C, S_FALSE); return false; }
      const g = frGroup(app, 'Tongue'); const tm = entryObject(app, 'meshes', 'Tongue');
      // without meshes/Tongue (or the group) the group and FaceConnections step is skipped: nothing is written (cmd-b15 Q1)
      if (g && tm) {
        addToGroup(app, g, tm);
        const fcV = frStore(app).raw('psets', 'FaceConnections'); const fc = fcV instanceof Property ? fcV : faceConnections(faceModel(app));
        const q = fc?.get('Tongue');
        if (q) app.setParam(q, q.def.type === 'string' ? tm.name : true);   // value inferred: the mesh reference
      }
      stageRefresh(app, C);
      setStatus(app, 'B14e', C, S_OK);
      return true;
    },
  });

  // ---------------------------------------------------------------- fr_RegenerateMouth
  app.register({
    name: 'fr_RegenerateMouth', label: 'fr_RegenerateMouth', category: CAT, args: [],
    execute(app) {
      const C = 'fr_RegenerateMouth';
      const ans = msgBox(app, 'Regenerate will delete all mouth sculpts.  Are you sure you want to continue?', 0x23, FR_CAPTION);
      if (ans !== 6) { setStatus(app, 'B14e', C, S_OK); return; }
      wrap(app, 'B14e', 'ActivateObjectSelTool');
      const hp = controlNamed(app, 'Head_Control')?.parentObj ?? null;
      const saved = hp ? hp.globalMatrix().clone() : null;
      if (hp) setGlobalMatrix(app, hp, new THREE.Matrix4());
      const mute = retargetMute(app, true);
      if (!mute.ok) { if (hp && saved) setGlobalMatrix(app, hp, saved); setStatus(app, 'B14e', C, S_FALSE); return; }
      const ctrls = controlsList(app);
      nyaE(app, C, 'order of the six kine.local parameters');
      for (const c of ctrls) {
        for (const p of SRT6) wrap(app, 'B14e', 'ActivateFCurve', { InputObjs: `${c.fullName}.kine.local.${p}`, Activate: false });
        for (const p of SRT6) setLocal(app, c, p, 0);
      }
      const m = faceModel(app);
      // the deleted blobs are `ZeroPoseO` and `ZeroPose` (cmd-b15 Q2)
      if (m) for (const n of ['ZeroPoseO', 'ZeroPose']) { const p = propNamed(m, n); if (p) deleteNode(app, p); }
      nyaE(app, C, 'mouth re-fit 0x1800e34e0 (Fit / HeadNull / JawStart and the lip, corner and jaw markers)');
      buildMetaMouth(app, C);
      nyaE(app, C, 'calibration pass 0x18015da60 (flags 0 and 1)');
      retargetMute(app, mute.previous);
      for (const c of ctrls) for (const p of SRT6) wrap(app, 'B14e', 'ActivateFCurve', { InputObjs: `${c.fullName}.kine.local.${p}`, Activate: true });
      if (hp && saved) setGlobalMatrix(app, hp, saved);
      setStatus(app, 'B14e', C, S_OK);
    },
  });
}

/** MetaMouth builder (`0x1800a3030`): rebuilds the `fro_MetaMouthOp2` operator named `MetaMouthOperator`. */
function buildMetaMouth(app: App, C: string) {
  const mesh = faceMesh(app); if (!mesh?.primitive) return;
  const blobs = mesh.properties.filter(p => p.type === 'UserDataBlob');
  nyaE(app, C, 'names of the MetaMouth blobs (the first two UserDataBlobs of the face mesh are used) and of the reference custom property');
  if (blobs.length < 2) return;
  if (blobs.length < 3) { const b = new Property('MetaMouthData', 'UserDataBlob', []); (b as any).hidden = true; addProperty(app, mesh, b); }
  const L = controlNamed(app, 'LMouthCorner_Control'), R = controlNamed(app, 'RMouthCorner_Control');
  const fivePct = L && R ? 0.05 * Math.abs(globalPos(L).x - globalPos(R).x) : 0;
  const refs = propNamed(mesh, 'MetaMouthRefs') ?? addProperty(app, mesh, new Property('MetaMouthRefs', 'customparamset', [
    num('RURef', fivePct, 'RURef'), num('RLRef', fivePct, 'RLRef'), num('LURef', fivePct, 'LURef'), num('LLRef', fivePct, 'LLRef'), num('Ping', 0, 'Ping'),
  ]));
  const old = mesh.primitive.operators.find(o => o.name === 'MetaMouthOperator'); if (old) deleteNode(app, old);
  if (!propNamed(mesh, 'LipStiction')) addProperty(app, mesh, new Property('LipStiction', 'customparamset', [str('Right', '', 'Right'), str('Left', '', 'Left')]));
  const op = new Operator('MetaMouthOperator', 'fro_MetaMouthOp2', [bool('UpdateInnerMouth', true, 'UpdateInnerMouth')]);
  (op as any).inputs = { blobs: blobs.map(b => b.name), refs: refs.name, HeadNull: entryObject(app, 'hpoints', 'HeadNull')?.name ?? null, JawStart: entryObject(app, 'externs', 'JawStart')?.name ?? null };
  const prim = mesh.primitive;
  app.record('AddCustomOp', () => prim.addOperator(op), () => prim.removeOperator(op));
  nyaE(app, C, 'MetaMouth operator inputs beyond the blobs / HeadNull / JawStart (lip and corner controls, teeth, BlendingMap, stiction) and its evaluation');
  de(app, 'B14e').metaMouth = op;
}
