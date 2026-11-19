// Ledger row CMD-B13a (bvrexport.dll), part 2: skills, BVH, render setup and actor files.
//   BvrMakeSkill BvrMakeLoop BvrRenderSetup BvrImportBVHAction BvrAddBVHAction BvrGenerateRenderSetup
//   extras: BvrSaveActor BvrLoadActor BvrImportBVHActor
// Brief: docs/ghidra/cmd-b13a-bvrexport-behavior-binary.md, section 3. Original code from that prose only.
import { App } from '../core/commands';
import { Group } from '../core/scene';
import { str } from '../core/params';
import { isActionSource } from '../core/mixerActionScripts';
import { findNode, unset } from './viewEditPropertyHelpers';
import { initWorker, setHomeWorker } from './bvrB13aActor';
import {
  stateOf, msgBox, fatal, logNya, progress, withCmdLogOff, inspect, gate, actorModel, actorRoot, nestedCheck, resolveCog, purgeTemp,
  ensureProp, findProp, makeTag, deleteProp, setVal, scaleCheck, applyHome, isAnimated, sourcesOfModel, body,
  makeSkill, makeLoopSkill, makeRenderSetup, makeBVHActor, MSG_GATE, MB_OKCANCEL, ID_CANCEL, X3DObject, Model, Property, Node,
} from './bvrB13aShared';

const ACTOR_FILTER = 'Actor (*.xsi)|*.xsi||';
const BVH_HELP = (page: string) => `<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/${page}`;

/** The selected node, or for an action source its model (then the source's index in the model's sources). */
function nodeOrSource(app: App, C: string, gateText: string): { node: X3DObject; source: Property | null } {
  const g = gate(app, C, gateText, true);
  if (g instanceof X3DObject) return { node: g, source: null };
  let m: any = g.parent; while (m && !(m instanceof Model)) m = m.parent ?? null;
  if (!m) return fatal(app, C, 'Failed to find the actor model.');
  return { node: m, source: g };
}
const sourceIndex = (m: Model, s: Property | null) => s ? sourcesOfModel(m).findIndex(x => x.name === s.name) : -1;
/** Nodes of the model carrying foot tags (inferred: RTKEffector, helper 0x18003aa30). */
const footTags = (m: X3DObject) => [...m.descendants()].filter(o => findProp(o, 'RTKEffector'));

// ------------------------------------------------------------------ BvrMakeSkill (SPEC-PARTIAL)
const makeSkillCmd = body((app) => {
  const C = 'BvrMakeSkill';
  const { node, source } = nodeOrSource(app, C, 'The Make Skill action requires selecting a single node or action source in the actor description.');
  const model = actorModel(app, C, node);
  const root = actorRoot(app, C, model);
  const sources = sourcesOfModel(model);
  if (!sources.length) fatal(app, C, 'The Make Skill action requires the actor to have associated action sources.');
  if (!findProp(root, 'RTKNode')) fatal(app, C, 'The Make Skill action requires the actor to be initialized.');   // inferred: the elided start of the note's text
  if (!findProp(root, 'RTKHomePose')) fatal(app, C, 'The Make Skill action requires the actor home pose being set (Set Home).');   // inferred: the elided start
  const sk = ensureProp(app, root, 'Skill', makeSkill);
  try {
    const idx = sourceIndex(model, source); if (idx >= 0) setVal(app, sk, 'Source', idx);   // inferred: the selected source index
    if (!inspect(app, C, sk, 'Make Skill', 4, true)) return;
    const threshold = Number(sk.val('Threshold')), skill = Number(sk.val('Skill')), transfer = !!sk.val('Transfer');
    withCmdLogOff(app, C, () => {
      const feet = footTags(model);
      if (skill === 2 && !transfer && !feet.length) { msgBox(app, C, 'To create a locomotion skill the actor must have foot tags. Please tag the feet and try again.'); return; }
      const src = sources[Number(sk.val('Source'))] ?? sources[0];
      logNya(app, C, `the value written to the source's type parameter (source ${src.name})`);
      if (transfer) {
        if (isAnimated(app, root)) { logNya(app, C, 'the text of the source FCurves message box'); if (msgBox(app, C, 'Source FCurves (text not yet attested)', MB_OKCANCEL) === ID_CANCEL) return; }
        const st = stateOf(app);
        const picked = st.hooks.pick?.('Select Target Model', C) ?? null;
        if (picked === null) { logNya(app, C, 'PickObject "Select Target Model" (no pick session); cancelled'); return; }
        let tm: any = picked; while (tm && !(tm instanceof Model)) tm = tm.parentObj ?? tm.parent ?? null;
        if (tm === model) { msgBox(app, C, 'The target actor for a skill transfer cannot be the same as the source actor.'); return; }
        const kids = tm instanceof Model ? tm.children : [];
        if (!(tm instanceof Model) || tm === app.scene.root || kids.length !== 1) { msgBox(app, C, 'The target for the skill transfer is not a valid actor (bad root node).'); return; }
        const troot = kids[0];
        if (!findProp(troot, 'RTKNode')) { msgBox(app, C, 'The target for the skill transfer is not initialized for Behavior.'); return; }   // inferred: the elided start
        if (isAnimated(app, troot)) { logNya(app, C, 'the text of the target FCurves message box'); if (msgBox(app, C, 'Target FCurves (text not yet attested)', MB_OKCANCEL) === ID_CANCEL) return; }
        if (skill === 2 && !footTags(tm).length) { logNya(app, C, 'the message for a locomotion transfer without target foot tags'); return; }
        progress(app, C, 'Transferring Skill');
        st.workers.push({ command: C, worker: 'transfer', args: { source: src.name, target: tm.name, skill, threshold, start: src.val('FrameStart'), end: src.val('FrameEnd') } });
        logNya(app, C, 'the skill transfer core (0x18000f980) and Cleanup (0x180004690)');
      } else {
        if (!findProp(root, 'RTKActor') || !(skill > 0)) return;
        let convert = true;
        if (isAnimated(app, root)) { logNya(app, C, 'the text of the rig FCurves message box'); convert = msgBox(app, C, 'Rig FCurves (text not yet attested)', MB_OKCANCEL) !== ID_CANCEL; }
        if (!convert) return;
        stateOf(app).workers.push({ command: C, worker: `skill${skill}`, args: { source: src.name, threshold } });
        logNya(app, C, `skill conversion ${skill} (${['', '0x18002e6d0', '0x180033a30', '0x1800360b0'][skill]})`);
      }
    });
  } finally { if (sk.parent) deleteProp(app, sk); }   // always deleted, also after Cancel
});

// ------------------------------------------------------------------ BvrMakeLoop
const makeLoop = body((app) => {
  const C = 'BvrMakeLoop';
  const { node, source } = nodeOrSource(app, C, MSG_GATE('Loop Locomotion'));
  const model = actorModel(app, C, node);
  const root = actorRoot(app, C, model);
  if (!sourcesOfModel(model).length) fatal(app, C, 'The Loop Skill action requires the actor to have associated action sources.');
  const p = ensureProp(app, root, 'LoopSkill', makeLoopSkill);
  const idx = sourceIndex(model, source); if (idx >= 0) setVal(app, p, 'Source', idx);   // inferred: the selected source index
  inspect(app, C, p, 'Loop Skill', 1, false);
  logNya(app, C, 'the looping itself (LoopSkill_PPGEvent)');
});

// ------------------------------------------------------------------ BvrRenderSetup
const renderSetup = body((app) => {
  const C = 'BvrRenderSetup';
  const p = ensureProp(app, app.scene.root, 'RenderSetup', makeRenderSetup);
  inspect(app, C, p, 'Render Setup', 3, false);
});

// ------------------------------------------------------------------ BVH
function bvhPage(app: App, C: string, host: X3DObject, page: string, title: string): Property | null {
  const p = ensureProp(app, host, 'BVHActor', makeBVHActor);
  logNya(app, C, 'the value written to BVHActor.Mode');
  (p as any).helpFile = BVH_HELP(page);
  return inspect(app, C, p, title, 4, true) ? p : null;
}
const importBVHAction = body((app) => {
  const C = 'BvrImportBVHAction';
  const n = gate(app, C, 'The Import BVH Action command requires selecting a single node in the target actor description.') as X3DObject;
  const model = actorModel(app, C, n);
  const p = bvhPage(app, C, model, 'behave12.htm', 'Import BVH Action'); if (!p) return;
  app.run('BvrAddBVHAction', { arg0: model, arg1: String(p.val('BVHFile')), arg2: String(p.val('ActionName')), arg3: Number(p.val('Scale')), arg4: !!p.val('Optimize'),
    arg5: String(p.val('Filter')), arg6: String(p.val('Remove')), arg7: !!p.val('Root') });
});
const addBVHAction = body((app, a) => {
  const C = 'BvrAddBVHAction';
  const model = findNode(app, a.arg0);
  // positional types must be exactly siRef, siString, siString, siDouble, siBool; otherwise nothing happens
  if (!(model instanceof Node) || typeof a.arg1 !== 'string' || typeof a.arg2 !== 'string' || typeof a.arg3 !== 'number' || typeof a.arg4 !== 'boolean') return;
  const args = { model: model.fullName, file: a.arg1, name: a.arg2, scale: Math.fround(a.arg3), optimize: a.arg4,
    filter: unset(a.arg5) ? '' : String(a.arg5), remove: unset(a.arg6) ? '' : String(a.arg6), root: unset(a.arg7) ? true : !!a.arg7 };
  withCmdLogOff(app, C, () => {
    stateOf(app).workers.push({ command: C, worker: 'bvhAction', args });
    logNya(app, C, 'the BVH action importer (0x18003f0d0; inferred: an action source named after arg2 from the MOTION block)');
  });
});

// ------------------------------------------------------------------ BvrGenerateRenderSetup (SPEC-PARTIAL)
const generateRenderSetup = body((app, a) => {
  const C = 'BvrGenerateRenderSetup';
  const missing = (x: string, i: number) => { app.logMsg('error', `RenderSetupGenerate command missing ${x} parameter (${i}).`); };
  if (typeof a.filename !== 'string' || !a.filename) return missing('filename', 0);
  const g = a.target instanceof Group ? a.target : typeof a.target === 'string' ? app.scene.groupList.find(x => x.name === a.target || x.fullName === a.target) : undefined;
  if (!g) return missing('target group', 1);
  if (!Number.isInteger(a.start)) return missing('start', 2);
  if (!Number.isInteger(a.end)) return missing('end', 3);
  if (typeof a.domap !== 'boolean') return missing('domap', 4);
  const args = { filename: a.filename, target: g.name, start: a.start, end: a.end, domap: a.domap, classname: unset(a.classname) ? '' : String(a.classname), doui: unset(a.doui) ? false : !!a.doui };
  stateOf(app).workers.push({ command: C, worker: 'renderSetupWriter', args });
  logNya(app, C, 'the render-setup file writer (0x180027b40)');
});

// ------------------------------------------------------------------ actor files (extras)
function actorFileProp(app: App): Property {
  return ensureProp(app, app.scene.root, 'ActorFile', () => makeTag('ActorFile', [str('InitDir', String((app as any).installationPath ?? ''), 'InitDir')]));
}
function fileDialog(app: App, C: string, title: string): string | null {
  const st = stateOf(app); const p = actorFileProp(app);
  const path = st.hooks.fileDialog?.(title, ACTOR_FILTER, String(p.val('InitDir')), C) ?? null;
  if (!path) { logNya(app, C, `the "${title}" file dialog (no file browser in this build without a hook); cancelled`); return null; }
  const dir = path.replace(/[\\/][^\\/]*$/, ''); setVal(app, p, 'InitDir', dir);
  st.lastPaths.push({ command: C, path });
  return path;
}
const saveActor = body((app) => {
  const C = 'BvrSaveActor';
  const n = gate(app, C, MSG_GATE('Save Actor')) as X3DObject;
  const model = actorModel(app, C, n);
  const root = actorRoot(app, C, model);
  progress(app, C, 'Scanning Hierarchy');
  purgeTemp(app, model);
  nestedCheck(app, C, root);
  resolveCog(app, C, root);
  if (!findProp(root, 'RTKActor')) fatal(app, C, 'The actor must be properly generated before it can be saved. Please try the Generate action and save the resultant actor.');
  if (!scaleCheck(app, C, root, 'Save action', false)) return;
  logNya(app, C, 'rig preparation (0x18000d070, 0x18000ce30) and weight-map collection (0x18000d250)');
  progress(app, C, 'Processing Weight Map');
  if (sourcesOfModel(model).length) logNya(app, C, 'source clean-up (0x180004690)');
  applyHome(app, model, false);
  const loop = findProp(root, 'LoopSkill'); if (loop) deleteProp(app, loop);
  app.run('SelectObj', { InputObjs: [model] });
  const path = fileDialog(app, C, 'Save Actor'); if (!path) return;
  stateOf(app).workers.push({ command: C, worker: 'SIExportDotXSIFile', args: { model: model.name, path, options: { output_file_format_version: 360, tesselation: true, polymesh: true, nrbscrv: true, animall: true, custompset: true, animplot: false, textures: true, txtfiles: true, txtformat: 5, txtresizex: 0, txtresizey: 0, txtabsolute: false, txtsequences: false } } });
  logNya(app, C, 'SIExportDotXSIFile of the actor model and the .wgmp sidecar');
});
const loadActor = body((app) => {
  const C = 'BvrLoadActor';
  const path = fileDialog(app, C, 'Load Actor'); if (!path) return;
  stateOf(app).workers.push({ command: C, worker: 'SIImportDotXSIFile', args: { path, wgmp: path.slice(0, -3) + 'wgmp' } });
  logNya(app, C, 'SIImportDotXSIFile, the .wgmp sidecar and the weight-map apply (0x180009080)');
  app.run('DeselectAll');
});
const importBVHActor = body((app) => {
  const C = 'BvrImportBVHActor';
  const p = bvhPage(app, C, app.scene.root, 'behave11.htm', 'Import BVH Actor'); if (!p) return;
  const args = Object.fromEntries(['BVHFile', 'ActorName', 'Filter', 'Remove', 'Root', 'Box', 'Scale'].map(k => [k, p.val(k)]));
  withCmdLogOff(app, C, () => {
    stateOf(app).workers.push({ command: C, worker: 'bvhActor', args });
    logNya(app, C, 'building the actor model from the BVH file (0x180040450, 0x180039200)');
  });
});
/** Initialize (Shift behaviour) then SetHome (no Shift) on a model built from a BVH file (note: ImportBVHActor). */
export function finishBvhActor(app: App, C: string, model: Model) {
  const top = model.children[0]; if (!top) return;
  initWorker(app, C, top, true);
  setHomeWorker(app, C, top, true);
}

export function registerBvrB13aSkillCommands(app: App) {
  const reg = (name: string, label: string, description: string, args: string[], execute: (app: App, a: Record<string, any>) => any) =>
    app.register({ name, label, category: 'Animate|Behavior', description, args: args.map(n => ({ name: n })), noLog: true, execute });
  reg('BvrMakeSkill', 'Make Skill', 'Converts an action source of the actor into a Behavior skill.', [], makeSkillCmd);
  reg('BvrMakeLoop', 'Make Loop', 'Opens the Loop Skill page for an action source of the actor.', [], makeLoop);
  reg('BvrRenderSetup', 'Render Setup', 'Opens the Behavior Render Setup page.', [], renderSetup);
  reg('BvrImportBVHAction', 'Import BVH Action', 'Imports a Biovision BVH file as an action of the actor.', [], importBVHAction);
  reg('BvrAddBVHAction', 'AddBVHAction', 'Adds an action read from a BVH file to a model.', ['arg0', 'arg1', 'arg2', 'arg3', 'arg4', 'arg5', 'arg6', 'arg7'], addBVHAction);
  reg('BvrGenerateRenderSetup', 'GenerateRenderSetup', 'Writes a Behavior render-setup file for a group.', ['filename', 'target', 'start', 'end', 'domap', 'classname', 'doui'], generateRenderSetup);
  reg('BvrSaveActor', 'Save Actor', 'Saves the generated actor as a dotXSI file.', [], saveActor);
  reg('BvrLoadActor', 'Load Actor', 'Loads an actor dotXSI file.', [], loadActor);
  reg('BvrImportBVHActor', 'Import BVH Actor', 'Builds an actor from a Biovision BVH file.', [], importBVHActor);
}
export { isActionSource };
