// CMD-B15f part 4: "Get default camera", "OBJ Import...", "Save Zero Key Hot Key", GenNormalMap, GenDiffuseMap
// (note sections 3.15-3.18) and WIRE_CORRECTIONS_B15 item 39 (GPUSurfaceFX.js is not shipped: both commands fail
// to find their script). The four Syflex map pickers (syCachePaint1/2, SyGetMassMap, SyGetSpringMap) were wired by
// CMD-B7b (syflexScripts.ts) and already match the note and item 38 (no paint tool, nothing returned); this row
// re-checks them in its compare script and does not register them again.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property } from '../core/scene';
import { str } from '../core/params';
import { iemsState } from '../core/importExportModelScripts';
import { nya, regB15f, miscState, interactive } from './miscScriptsB15fShared';

const OBJ_FILTER = 'Wavefront (*.obj)|*.obj|All Files (*.*)|*.*';

function getDefaultCamera(app: App, a: Record<string, any>): any {
  const name = a.Name ? String(a.Name) : 'Camera';
  const preset = String(a.PresetObj ?? 'Camera').replace(/^\{[^}]*\}:/, '') || 'Camera';
  const parent = a.Parent ? String(a.Parent) : '';
  // SIGetPrim("CameraRoot", <name>_Root, Parent, 1): a null of the camera-root type
  const root = app.run('GetPrim', { PresetObj: 'Null', Name: `${name}_Root`, Parent: parent }) as X3DObject;
  (root as any).type = 'CameraRoot';
  const r = app.run('SIGetPrimCamera', { PresetObj: preset, Name: name, InterestName: `${name}_Interest`, Parent: parent });
  const cam: X3DObject = r['3DObjCamera'], interest: X3DObject = r['3DObjCameraInterest'];
  // move the root's global position to the camera's, then parent camera and interest under the root (their global positions stay)
  const cp = new THREE.Vector3().setFromMatrixPosition(cam.globalMatrix()); const ip = new THREE.Vector3().setFromMatrixPosition(interest.globalMatrix());
  const place = (o: X3DObject, w: THREE.Vector3) => { const q = w.clone(); if (o.parentObj) q.applyMatrix4(o.parentObj.globalMatrix().invert()); const l = o.kinematics.local; l.set('posx', q.x); l.set('posy', q.y); l.set('posz', q.z); };
  place(root, cp);
  for (const [o, w] of [[cam, cp], [interest, ip]] as [X3DObject, THREE.Vector3][]) {
    const old = o.parentObj; app.record('Parent', () => { root.addChild(o); place(o, w); }, () => { (old ?? app.scene.root).addChild(o); place(o, w); });
  }
  miscState(app).camera = { Primitive: r.PrimObjCamera ?? cam.primitive, '3DObjCamera': cam, '3DObjCameraInterest': interest };
  return root;   // outputs (primitive, camera, interest) are in app.miscScriptsB15f.camera
}

async function browseObj(app: App): Promise<string> {
  const title = 'Select a .OBJ file';
  if (iemsState.fileBrowser) return String((await iemsState.fileBrowser(title, OBJ_FILTER, 'open')) ?? '');
  if (!interactive(app) || typeof document === 'undefined') return '';
  const { sdkModal, renderSdkLayout } = await import('../ui/sdkHelpersModal');
  const set = new Property('FileBrowser', 'CustomProperty', [str('Path', '', 'File')]);
  const ok = await sdkModal(title, body => renderSdkLayout(body, set as any, [{ param: 'Path', control: 'file', filter: OBJ_FILTER }]), { w: 420, cls: 'b15f-browser' });
  return ok ? String(set.val('Path') ?? '') : '';
}

function objImportMenu(app: App): any {
  const importWith = (FileName: string, Group: any, hrc: any, Material: any, UV: any, UserNormal: any, UVwrapping?: any, disp?: Record<string, any>) => {
    const objs = app.run('ObjImport', { FileName, Group, hrc, Material, UV, UserNormal, UVwrapping });
    if (disp && String(disp.DisplImage ?? '') !== '')
      app.run('SetupDisplacement', { InputObjs: objs, FileName: disp.DisplImage, DisplDepth: disp.DisplDepth, FlipVert: disp.DisplFlipVert, DisplViewDep: disp.DisplViewDep, DisplSubDLevel: disp.DisplSubDLevel });
  };
  if (iemsState.licence === 'Avid 3D') return browseObj(app).then(f => { importWith(f, 1, 2, true, true, false); });   // no empty check
  // command logging is switched off around the options dialog and restored by setting the preference true twice
  const A = app as any; A.cmdLog = false;
  const restore = () => { A.cmdLog = true; A.cmdLog = true; };
  let r: any; try { r = app.run('SI_InspectWavefrontImportOptions', { FileName: '' }); } catch (e) { restore(); throw e; }
  const done = (a: Record<string, any>) => { restore(); if (a && String(a.FileName ?? '') !== '') importWith(String(a.FileName), a.Group, a.hrc, a.Material, a.UV, a.UserNormal, a.UVwrapping, a); };
  return r instanceof Promise ? r.then(done, e => { restore(); throw e; }) : done(r);
}

export function registerMiscB15fMiscCommands(app: App) {
  regB15f(app, {
    name: 'Get default camera', label: 'Get default camera', category: '', description: '',
    args: [{ name: 'PresetObj', default: '{42FC2493-732F-11d2-AC52-00A02485CECB}:Camera' }, { name: 'Name', default: '' }, { name: 'Parent', default: '' }, { name: 'Primitive', default: null }, { name: '3DObjCamera', default: null }, { name: '3DObjCameraInterest', default: null }, { name: 'Value', default: null }],
    execute: (app2, a) => getDefaultCamera(app2, a),
  });
  regB15f(app, {
    name: 'OBJ Import...', label: 'OBJ Import...', category: 'File', description: 'Import Wavefront OBJ file', args: [], undoable: false,
    execute: app2 => objImportMenu(app2),
  });
  regB15f(app, {
    name: 'Save Zero Key Hot Key', label: 'Save Zero Key Hot Key', category: 'Animation', description: 'Save Zero key hot key', args: [], undoable: false,
    execute(app2) { nya(app2, 'Save Zero Key Hot Key', 'SaveZeroKeyHotKeyProc (uixsiscripts.vbs was not read; note Q2): nothing is keyed'); },
  });
  // GPUSurfaceFX.js is not in the install (WIRE_CORRECTIONS_B15 item 39): invoking either command fails to find its script.
  for (const [name, label, proc, extra] of [
    ['GenNormalMap', 'GPUSurfaceFX - Generate the normal map', 'XSI_GenerateNormalMap', [{ name: 'GenNormalMapM', default: false }, { name: 'GenNormalMapT', default: false }, { name: 'GenTangents', default: false }]],
    ['GenDiffuseMap', 'GPUSurfaceFX - Generate the surface map', 'XSI_GenerateDiffuseMap', []],
  ] as [string, string, string, { name: string; default: any }[]][]) {
    regB15f(app, {
      name, label, category: 'Property|Rendering', description: '', undoable: false,
      args: [{ name: 'PSet', default: null }, { name: 'InputObj', default: null }, ...extra, { name: 'Value', default: null }],
      execute() { throw new Error(`script file GPUSurfaceFX.js not found (procedure ${proc} cannot be run: the script is not shipped in the install)`); },
    });
  }
}
