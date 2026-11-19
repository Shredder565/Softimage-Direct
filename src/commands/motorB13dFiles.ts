// Ledger row CMD-B13d (CDKMotionTransform.64.dll): the file commands (SaveMOTORAdjustmentPresetFile,
// LoadMOTORAdjustmentPresetFile, LoadMotorFile, RetargetBVH, RetargetC3DData, SaveC3DPoseMap).
// Brief: docs/ghidra/cmd-b13d-motiontransform-binary.md sections 2.6 and 3. Original code from the prose contract.
// XML goes through the browser DOM (DOMParser / XMLSerializer) in place of the plug-in's Xerces-C wrapper; the BVH
// reader follows the public BioVision BVH format (HIERARCHY / MOTION sections).
import { App } from '../core/commands';
import { Parameter } from '../core/params';
import {
  stateOf, msg, logNya, withCmdLogOff, modelArg, missing, textArg, findProp, addCustomProp, addParamU, setParamU, retargetData,
  mappedNodes, structureOf, blobOf, readText, writeText, isXml,
  RETARGET_ADJUST_PPG, ROTATION_OFFSET_PPG, ADJUST_HEADER, TAG_PPG, BVH_TOKEN, C3D_POSE_VERSION, C3D_DEF, C3D_UDB, CDK_MAP,
  SI_READONLY, SI_PERSISTABLE, SI_ANIMATABLE, SI_KEYABLE, VT, X3DObject, Model, Property, type C3DPoseRecord,
} from './motorB13dShared';
import { parseTagt } from './motorB13dTags';
import { hostFs } from '../core/sdkHelpersHostFs';

// ------------------------------------------------------------------ adjustment preset (note 2.6)
const capsOf = (p: Parameter) => (p.def.readOnly ? SI_READONLY : 0) | SI_PERSISTABLE | (p.animatable ? SI_ANIMATABLE : 0) | (p.keyable ? SI_KEYABLE : 0);
function valueTypeOf(p: Parameter): number {
  switch (p.def.type) { case 'int': return VT.int; case 'bool': return VT.bool; case 'string': return VT.string;
    case 'enum': return typeof p.value === 'string' ? VT.string : VT.int; default: return VT.double; }
}
function paramElement(doc: XMLDocument, p: Parameter): Element {
  const e = doc.createElement(p.name);
  e.setAttribute('Capabilities', String(capsOf(p))); e.setAttribute('Name', p.label); e.setAttribute('Description', p.def.desc ?? ''); e.setAttribute('DataType', String(valueTypeOf(p)));
  e.textContent = String(p.value ?? '');
  return e;
}
const childEls = (e: Element | null): Element[] => e ? Array.from(e.childNodes).filter((n): n is Element => n.nodeType === 1) : [];
const childEl = (e: Element | null, name: string): Element | null => childEls(e).find(c => c.nodeName === name) ?? null;
const serialize = (doc: XMLDocument) => '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n' + new XMLSerializer().serializeToString(doc.documentElement) + '\n';
function parseXml(text: string): XMLDocument | null {
  try { const d = new DOMParser().parseFromString(text, 'application/xml'); return d.getElementsByTagName('parsererror').length ? null : d; } catch { return null; }
}
function fromText(p: Parameter, t: string): any {
  switch (p.def.type) { case 'bool': return /^(true|1|-1)$/i.test(t.trim()); case 'string': return t; case 'enum': return typeof p.value === 'string' ? t : Number(t); default: return Number(t); }
}
const findUnder = (m: Model, name: string): X3DObject | null => { for (const o of m.descendants()) if (o.name === name) return o; return null; };

function presetArgs(app: App, C: string, a: Record<string, any>): Model | null {
  const r = modelArg(app, a.model);
  if (r.kind === 'missing') { msg(app, `${C} command missing target model.`); return null; }
  if (missing(a.filename)) { msg(app, `${C} command missing file path.`); return null; }
  if (r.kind === 'invalid') { msg(app, `${C} command invalid target model.`); return null; }
  if (!findProp(r.model, RETARGET_ADJUST_PPG)) { msg(app, 'No MOTOR Data loaded onto model.'); return null; }
  return r.model;
}

// ------------------------------------------------------------------ .motor XML (note 2.6)
export interface MotorFile {
  header: Record<string, string>; nodes: { valid: boolean; name: string; length: number }[];
  planes: { name: string; span: number; mid: number; anchor: number; bones: number[] }[];
  pose: number[][][]; fcurves: { name: string; channels: { name: string; keys: number[] }[] }[];
}
export function parseMotorXml(text: string, errors: string[]): MotorFile | null {
  const doc = parseXml(text); if (!doc) { errors.push('DOMElement : <ROOT'); return null; }
  const root = doc.documentElement;
  const el = (p: Element | null, n: string) => { const e = childEl(p, n); if (!e) errors.push(`DOMElement : <${n}`); return e; };
  const at = (e: Element, n: string) => { if (!e.hasAttribute(n)) { errors.push(`Atribute : <${n}`); return ''; } return e.getAttribute(n)!; };
  const header: Record<string, string> = {};
  const H = el(root, 'HEADER');
  for (const n of ['VERSION', 'AnimationLength', 'legLength', 'hipOffset', 'numNodes', 'numPlanes', 'structure_type']) { const e = el(H, n); if (e) header[n] = (e.textContent ?? '').trim(); }
  const nodes = childEls(el(root, 'NODES')).map(e => ({ valid: /^(true|1)$/i.test(at(e, 'obj_IsValid')), name: at(e, 'name'), length: Number(at(e, 'length')) }));
  const planes = childEls(el(root, 'PLANES')).map(e => {
    const nb = parseInt(at(e, 'numbones'), 10) || 0; const bones = childEls(e).slice(0, nb).map(b => parseInt(at(b, 'boneindex'), 10));
    if (bones.length < nb) errors.push('DOMElement : <bone');
    return { name: at(e, 'name'), span: parseInt(at(e, 'span'), 10), mid: parseInt(at(e, 'mid'), 10), anchor: parseInt(at(e, 'anchor_index'), 10), bones };
  });
  const len = parseInt(header.AnimationLength, 10) || 0, nn = parseInt(header.numNodes, 10) || 0;
  const frames = childEls(el(root, 'POSE_VALUES'));
  if (frames.length < len) errors.push('DOMElement : <frame');
  const pose = frames.slice(0, len).map(f => {
    const ns = childEls(f); if (ns.length < nn) errors.push('DOMElement : <node');
    return ns.slice(0, nn).map(n => {
      const v = (n.getAttribute('global') ?? '').split(',').map(Number);
      if (v.length !== 7 || v.some(x => !Number.isFinite(x))) { errors.push('Error reading CTransformation Attribute : <global'); return []; }
      return v;
    });
  });
  const FK = el(root, 'FCURVE_KEYS'); if (FK) at(FK, 'num_nodes_with_fcurve_keys');
  const fcurves = childEls(FK).map(n => ({
    name: at(n, 'name'),
    channels: childEls(n).map(c => {
      const nk = parseInt(at(c, 'numkeys'), 10) || 0; const keys = childEls(c).slice(0, nk).map(k => Number(at(k, 'keytime')));
      if (!['posx', 'posy', 'posz', 'rotx', 'roty', 'rotz'].includes(c.getAttribute('name') ?? '')) errors.push(`Atribute : <name`);
      return { name: c.getAttribute('name') ?? '', keys };
    }),
  }));
  return errors.length ? null : { header, nodes, planes, pose, fcurves };
}

// ------------------------------------------------------------------ BVH (public BioVision format)
export interface BvhJoint { name: string; offset: number[]; channels: string[]; children: BvhJoint[]; end?: boolean }
export function parseBvh(text: string): { root: BvhJoint; frames: number; frameTime: number; data: number[][] } | null {
  const tok = text.split(/\s+/).filter(Boolean); let i = 0;
  const peek = () => tok[i], next = () => tok[i++];
  if (next() !== 'HIERARCHY' || next() !== 'ROOT') return null;
  let nCh = 0;
  const joint = (name: string, end = false): BvhJoint | null => {
    if (next() !== '{') return null;
    const j: BvhJoint = { name, offset: [], channels: [], children: [], end };
    while (i < tok.length && peek() !== '}') {
      const k = next();
      if (k === 'OFFSET') j.offset = [Number(next()), Number(next()), Number(next())];
      else if (k === 'CHANNELS') { const n = parseInt(next(), 10); for (let c = 0; c < n; c++) j.channels.push(next()); nCh += n; }
      else if (k === 'JOINT') { const c = joint(next()); if (!c) return null; j.children.push(c); }
      else if (k === 'End') { const c = joint(next(), true); if (!c) return null; j.children.push(c); }
      else return null;
    }
    return next() === '}' ? j : null;
  };
  const root = joint(next()); if (!root) return null;
  if (next() !== 'MOTION' || next() !== 'Frames:') return null;
  const frames = parseInt(next(), 10); if (next() !== 'Frame' || next() !== 'Time:') return null;
  const frameTime = Number(next()); if (!Number.isFinite(frames) || !Number.isFinite(frameTime)) return null;
  const data: number[][] = [];
  for (let f = 0; f < frames; f++) { const row: number[] = []; for (let c = 0; c < nCh; c++) { const v = Number(next()); if (!Number.isFinite(v)) return null; row.push(v); } data.push(row); }
  return { root, frames, frameTime, data };
}

/** Application.Version (the build's value; '13.2.163.0' = Softimage 2015 SP2, as in addonDocWizard.ts, inferred). */
const appVersion = (app: App): string => { const v = (app as any).Version; return typeof v === 'function' ? String(v.call(app)) : typeof v === 'string' ? v : '13.2.163.0'; };
/** Whether `_wfopen(.., "wt")` can open the path: its folder exists and it is not a folder. */
const canOpen = (path: string) => { try { return hostFs.isFolder(hostFs.parentPath(path)) && !hostFs.isFolder(path); } catch { return false; } };

// ------------------------------------------------------------------ .c3dpose writer (note 2.6)
const fmtNum = (n: number) => String(n);   // the plug-in's number formatter 0x18006c380 is not attested
export function writeC3DPose(tagString: string, upDir: number, markers: string[], records: C3DPoseRecord[]): string {
  let s = `${C3D_POSE_VERSION}\n${tagString} ${upDir} \n${markers.length} ${records.length} \n`;
  for (const m of markers) s += `${m}\n`;
  for (const r of records) {
    s += `${r.idx.join(' ')} \n`;
    s += [...r.xf1, ...r.vec].map(fmtNum).join(' ') + ' \n';
    s += r.xf2.map(fmtNum).join(' ') + ' \n';
  }
  return s;
}

export function registerMotorB13dFileCommands(app: App) {
  app.register({
    name: 'SaveMOTORAdjustmentPresetFile', label: 'SaveMOTORAdjustmentPresetFile', category: 'MOTOR', args: [{ name: 'model' }, { name: 'filename' }], undoable: false,
    execute(app, a) {
      const C = 'SaveMOTORAdjustmentPresetFile'; const m = presetArgs(app, C, a); if (!m) return undefined;
      const doc = document.implementation.createDocument(null, 'ROOT', null); const root = doc.documentElement;
      const H = doc.createElement('HEADER'); H.appendChild(doc.createTextNode(ADJUST_HEADER));
      const V = doc.createElement('VERSION'); V.textContent = appVersion(app); H.appendChild(V); root.appendChild(H);
      const D = doc.createElement('ADJUST_PPG_DATA'); for (const p of findProp(m, RETARGET_ADJUST_PPG)!.params) D.appendChild(paramElement(doc, p)); root.appendChild(D);
      const rd = retargetData(m);
      if (rd) {
        const R = doc.createElement('ROTATION_OFFSETS');
        for (const n of mappedNodes(rd)) {
          const o = findUnder(m, n); const ro = o && findProp(o, ROTATION_OFFSET_PPG); if (!ro) continue;
          const e = doc.createElement(n); for (const p of ro.params) e.appendChild(paramElement(doc, p)); R.appendChild(e);
        }
        root.appendChild(R);
      }
      if (!writeText(textArg(a.filename), serialize(doc))) logNya(app, C, 'the message when the preset file cannot be written');
      return undefined;
    },
  });
  app.register({
    name: 'LoadMOTORAdjustmentPresetFile', label: 'LoadMOTORAdjustmentPresetFile', category: 'MOTOR', args: [{ name: 'model' }, { name: 'filename' }],
    execute(app, a) {
      const C = 'LoadMOTORAdjustmentPresetFile'; const m = presetArgs(app, C, a); if (!m) return undefined;
      const text = readText(textArg(a.filename)); const doc = text === null ? null : parseXml(text);
      if (!doc) { logNya(app, C, 'the behaviour when the preset file cannot be read or parsed'); return undefined; }
      const root = doc.documentElement; const rd = retargetData(m);
      const D = childEl(root, 'ADJUST_PPG_DATA');
      const applyInto = (ps: Property, e: Element) => { for (const c of childEls(e)) { const p = ps.get(c.nodeName); if (p) setParamU(app, p, fromText(p, c.textContent ?? '')); } };
      if (D && rd) {
        applyInto(findProp(m, RETARGET_ADJUST_PPG)!, D);   // matched by script name (inferred)
        logNya(app, C, 'pushing the RetargetAdjustPPG values to the retarget data (0x180073150 / 0x18004cd70)');
      }
      const R = childEl(root, 'ROTATION_OFFSETS');
      if (R) {
        const mapped = mappedNodes(rd);
        for (const e of childEls(R)) {
          const k = mapped.indexOf(e.nodeName); if (k < 0) continue;
          const o = findUnder(m, e.nodeName); if (!o) continue;
          // the property is added from the element's attribute set when missing (stand-in: the PPG's definition is not attested)
          const ro = findProp(o, ROTATION_OFFSET_PPG) ?? addCustomProp(app, o, ROTATION_OFFSET_PPG, childEls(e).map(c => {
            const dt = Number(c.getAttribute('DataType')); const type = dt === VT.bool ? 'bool' : dt === VT.int ? 'int' : dt === VT.string ? 'string' : 'double';
            return { name: c.nodeName, label: c.getAttribute('Name') ?? c.nodeName, desc: c.getAttribute('Description') ?? '', type, value: type === 'bool' ? false : type === 'string' ? '' : 0 } as any;
          }));
          if (k === 0) { const p = ro.get('IsCog') ?? addParamU(app, ro, { name: 'IsCog', type: 'bool', value: false }); setParamU(app, p, true); }
          logNya(app, C, `the capability flag set on ${e.nodeName}.Reduce (values not legible)`);
          applyInto(ro, e);
        }
        if (mapped.length) logNya(app, C, 'pushing the RotationOffsetPPG values to the retarget data (0x180051370)');
      }
      return undefined;
    },
  });
  app.register({
    name: 'LoadMotorFile', label: 'LoadMotorFile', category: 'MOTOR', args: [{ name: 'targetmodel' }, { name: 'motorfile' }, { name: 'start' }],
    execute(app, a) {
      const C = 'LoadMotorFile'; const r = modelArg(app, a.targetmodel);
      if (r.kind === 'missing') { msg(app, `${C} command missing destination model.`); return false; }
      if (r.kind === 'invalid') { msg(app, `${C} command invalid destination model.`); return false; }
      if (missing(a.motorfile)) { msg(app, `${C} command missing motorfile.`); return false; }
      void Number(a.start);   // read and converted, never used (WIRE_CORRECTIONS_B13)
      const text = readText(textArg(a.motorfile));
      if (text === null) { logNya(app, C, 'the behaviour when the motor file cannot be opened'); return false; }
      if (!isXml(text)) { logNya(app, C, 'the legacy (non-XML) .motor reader 0x18001f340'); return false; }
      const errors: string[] = []; const mf = parseMotorXml(text, errors);
      if (!mf) { for (const e of errors) msg(app, e); return false; }
      stateOf(app).lastMotor = mf;
      const m = r.model; const s = structureOf(app, m); const map = blobOf(m, CDK_MAP);
      const names: string[] = s && Array.isArray(map) ? map : s && Array.isArray(map?.names) ? map.names : [];   // stand-in model map (inferred)
      if (!names.length) { msg(app, 'Failed to read destmodel map from source model.'); return false; }
      logNya(app, C, 'building the retarget setup on the target and applying the motion');
      return true;
    },
  });
  app.register({
    name: 'RetargetBVH', label: 'RetargetBVH', category: 'MOTOR', args: [{ name: 'targetmodel' }, { name: 'bvhfile' }, { name: 'mapfile' }],
    execute(app, a) {
      const C = 'RetargetBVH'; const r = modelArg(app, a.targetmodel);
      if (r.kind === 'missing') { msg(app, `${C} command missing destination model.`); return false; }
      if (r.kind === 'invalid') { msg(app, `${C} command invalid destination model.`); return false; }
      if (missing(a.bvhfile)) { msg(app, `${C} command missing bvhfile.`); return false; }
      if (missing(a.mapfile)) { msg(app, `${C} command missing mapfile.`); return false; }
      const mapPath = textArg(a.mapfile); const map = readText(mapPath);
      if (!map) { msg(app, 'Could not read mapfile.'); return false; }
      if (/\.tagt$/i.test(mapPath)) { if (!parseTagt(map)) { logNya(app, C, 'a .tagt map file whose tag header does not parse'); return false; } }
      else if (map.trim().split(/\s+/)[0] !== BVH_TOKEN) { msg(app, 'To retarget a BVH file the mapfile must be built from the corresponding BVH ref pose'); return false; }
      return withCmdLogOff(app, () => {
        logNya(app, C, 'reading the mocap tag section of the map file');
        const text = readText(textArg(a.bvhfile)); const bvh = text === null ? null : parseBvh(text);
        if (!bvh) { msg(app, 'Failed to load the BVH file.'); return false; }
        stateOf(app).lastBvh = bvh;
        logNya(app, C, 'the mocap tag process, source structure, model map and retarget solver');
        return false;
      });
    },
  });
  app.register({
    name: 'RetargetC3DData', label: 'RetargetC3DData', category: 'MOTOR', args: [{ name: 'c3dfile' }, { name: 'mapfile' }],
    execute(app, a) {
      const C = 'RetargetC3DData';
      if (missing(a.c3dfile)) { msg(app, `${C} command missing the c3d file.`); return false; }
      if (missing(a.mapfile)) { msg(app, `${C} command missing the map  file.`); return false; }
      if (readText(textArg(a.mapfile)) === null) return false;
      if (!textArg(a.c3dfile)) return false;
      return withCmdLogOff(app, () => { logNya(app, C, 'the C3D importer (C3DData model), C3DRig fitting and pose-map apply'); return false; });
    },
  });
  app.register({
    name: 'SaveC3DPoseMap', label: 'SaveC3DPoseMap', category: 'MOTOR', args: [{ name: 'c3dmodel' }, { name: 'ESR_rig' }, { name: 'Map_file' }],
    execute(app, a) {
      const C = 'SaveC3DPoseMap'; const c = modelArg(app, a.c3dmodel);
      if (c.kind === 'missing') { msg(app, `${C} command missing the c3dmodel`); return false; }
      if (c.kind === 'invalid') { msg(app, `${C} command invalid c3dmodel`); return false; }
      const g = modelArg(app, a.ESR_rig);
      if (g.kind === 'missing') { msg(app, `${C} command missing the ESR rig`); return false; }
      if (g.kind === 'invalid') { msg(app, `${C} command invalid ESR rig`); return false; }
      if (missing(a.Map_file)) { msg(app, `${C} command missing the Map file`); return false; }
      const path = textArg(a.Map_file); const cm = c.model, rig = g.model;
      if (!path) return false;
      const def = findProp(cm, C3D_DEF);
      if (!findProp(cm, C3D_UDB) || !def) return false;
      if (def.val('pose') !== true) return false;
      if (!findProp(rig, TAG_PPG) || !canOpen(path)) return false;
      const poseP = def.get('pose')!; setParamU(app, poseP, false);
      const gc = rig.children[0]?.children[0] ?? null; const saved = gc ? gc.kinematics.local.params.map(p => p.value) : null;
      const recs = stateOf(app).hooks.c3dFit?.(cm, rig);
      if (!recs) logNya(app, C, 'fitting the rig to the C3D markers (no fitted entries written)');
      logNya(app, C, 'the TagPPG parameter written on line 2 and the number formatter');
      const markers = [...cm.descendants()].slice(1).map(o => o.name);
      const ok = writeText(path, writeC3DPose('', Number(def.val('upDir') ?? 0), markers, recs ?? []));
      if (gc && saved) gc.kinematics.local.params.forEach((p, i) => { p.value = saved[i]; });
      return ok;
    },
  });
}
