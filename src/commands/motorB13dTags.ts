// Ledger row CMD-B13d (CDKMotionTransform.64.dll): the model-cleanup, frame-range and tag-template commands
// (CleanTagsFromRig, RemoveMOTOROperators, RemoveAllMotorPropsAndOps, RetargetExtractStartFrame, RetargetExtractEndFrame,
// LoadTagTemplateFile, InheritRetargetSetup, SaveTagTemplateFile). Brief: docs/ghidra/cmd-b13d-motiontransform-binary.md
// section 3. Original code from the prose contract; see motorB13dShared.ts for the stand-ins.
import { App } from '../core/commands';
import {
  stateOf, msg, logNya, progress, withCmdLogOff, modelArg, missing, textArg, findProp, ensureTagPPG, tagParams, setParamU, addParamU,
  setTemplateFile, setDirty, removeMotorOperators, removeNodeTags, removeTagData, deleteStructure, deleteNamed, addCustomProp,
  retargetData, structureOf, setStructure, readText, writeText, isXml, blobOf,
  TAG_PPG, TAG_FIRST, CDK_GLUE, CDK_MAP, PLOT_RETARGET_PPG, CDK_TAG, EMPTY_FIELD, TAGT_VERSION, TAGT_MIN_VERSION,
  X3DObject, Model,
} from './motorB13dShared';

const MODEL1 = [{ name: 'targetmodel' }], MODEL = [{ name: 'model' }];
const TEMPLATE_ARGS = [{ name: 'targetmodel' }, { name: 'template' }];

// ------------------------------------------------------------------ frame range (note 3, `0x180054970`)
const INT_MAX = 2147483647;
/** { ok, start, end } of a model: the CDKRetargetOp data when present, else the FCurve key range of its animated parameters. */
export function frameRange(app: App, m: Model): { ok: boolean; start: number; end: number } {
  const d = retargetData(m);
  if (d) { const start = Math.trunc(Number(d.start)); return { ok: true, start, end: start + Math.trunc(Number(d.length) || 0) }; }
  let start = INT_MAX, end = -INT_MAX;
  for (const [p, fc] of app.anim.fcurves) {
    if (fc.keys.length < 2 || !underModel(p.owner, m)) continue;
    start = Math.min(start, Math.trunc(fc.keys[0].time)); end = Math.max(end, Math.trunc(fc.keys[fc.keys.length - 1].time));
  }
  return { ok: start < end && start < INT_MAX, start, end };
}
function underModel(owner: any, m: Model): boolean {
  let n: any = owner; while (n && !(n instanceof X3DObject)) n = n.parent ?? null;
  for (let o: X3DObject | null = n; o; o = o.parentObj) if (o === m) return true;
  return false;
}

// ------------------------------------------------------------------ .tagt (note 2.6)
export interface TagtHead { structureName: string; pairs: { tag: string; value: string }[]; structureFile: string; version: number; rest: string[] }
/** Read the attested part of a `.tagt` file: line 1 structure name, N, N `<tag> <value>` lines, structure file path, version. */
export function parseTagt(text: string): TagtHead | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let i = 0; const next = () => (i < lines.length ? lines[i++] : null);
  const name = next(); if (name === null) return null;
  const nLine = next(); const n = nLine === null ? NaN : parseInt(nLine.trim(), 10); if (!Number.isFinite(n) || n < 0) return null;
  const pairs: { tag: string; value: string }[] = [];
  for (let k = 0; k < n; k++) {
    const l = next(); if (l === null) return null;
    const t = l.trim(); const sp = t.search(/\s/);
    pairs.push(sp < 0 ? { tag: t, value: '' } : { tag: t.slice(0, sp), value: t.slice(sp).trim() });
  }
  const structureFile = (next() ?? '').trim();
  const vLine = next(); const version = vLine === null ? NaN : parseInt(vLine.trim(), 10);
  const rest = lines.slice(i).filter(l => l.trim() !== '');
  return { structureName: name.trim(), pairs, structureFile, version, rest };
}
export function writeTagt(structureName: string, pairs: { tag: string; value: string }[], structureFile: string): string {
  let s = `${structureName}\n${pairs.length} \n`;
  for (const p of pairs) s += `${p.tag} ${p.value === '' ? EMPTY_FIELD : p.value}\n`;
  return s + `${structureFile}\n${TAGT_VERSION} \n`;
}

const findUnder = (m: Model, name: string): X3DObject | null => { for (const o of m.descendants()) if (o.name === name || o.fullName === name) return o; return null; };

/** Tag-template loader `0x1800624e0` (LoadTagTemplateFile, InheritRetargetSetup). */
function loadTemplate(app: App, command: string, m: Model | null, path: string): boolean {
  if (!m) { msg(app, 'It is ambiguous which character is to receive the inheritance.  Please select the desired character.'); return false; }
  if (!path) { msg(app, 'Please specify a tag template file (*.tagt)'); return false; }
  const text = readText(path);
  if (text !== null && isXml(text)) return true;   // old XML template: ignored
  progress(app, 'Reading Tag Template File ...');
  const ppg = ensureTagPPG(app, m);
  if (text === null) { setTemplateFile(app, ppg, path); return true; }
  removeMotorOperators(app, m); deleteNamed(app, m, PLOT_RETARGET_PPG); deleteNamed(app, m, CDK_GLUE);
  const head = parseTagt(text);
  if (!head) { logNya(app, command, 'reading a .tagt file whose header does not parse'); return false; }
  stateOf(app).lastTagt = head;
  // set the structure file (routine 0x180064600, inferred = SetStructureFile; not in this row): stand-in, the file must exist
  if (head.structureFile && readText(head.structureFile) !== null) setStructure(app, m, { name: head.structureName, file: head.structureFile });
  else logNya(app, command, 'SetStructureFile (structure file contents)');
  if (!structureOf(app, m)) { msg(app, 'Cannot find orriginal structure file :' + head.structureFile); return false; }
  progress(app, 'Applying Tags to Model ...');
  const values: string[] = [];
  head.pairs.forEach((pr, i) => {
    let v = pr.value === EMPTY_FIELD ? '' : pr.value;
    if (v) {
      const [node, extr] = v.split('|');
      if (!findUnder(m, node)) { msg(app, `Node ${node}`); v = ''; }
      else if (extr !== undefined && extr !== '' && !findUnder(m, extr)) { msg(app, `Extraction node ${extr}`); v = node; }
    }
    let p = ppg.params[i + TAG_FIRST];
    if (!p) { logNya(app, command, `TagPPG has no parameter at index ${i + TAG_FIRST}; added as "${pr.tag}" (tags come from the structure)`); p = addParamU(app, ppg, { name: pr.tag, type: 'string', value: '' }); }
    setParamU(app, p, v);
    if (p.name !== pr.tag) msg(app, `Failed to load template file: Tag name ${pr.tag}`);
    values.push(v);
  });
  if (!(head.version >= TAGT_MIN_VERSION)) { msg(app, 'Failed to inherit the template data. Template is out of date.'); setDirty(app, ppg); return false; }
  if (head.rest.length) logNya(app, command, 'the mocap / extraction tag section after the version line (match against the rig)');
  head.pairs.forEach((pr, i) => {
    const v = values[i]; if (!v || v === EMPTY_FIELD) return;
    const o = findUnder(m, v.split('|')[0]); if (!o) return;
    if (!findProp(o, CDK_TAG)) addCustomProp(app, o, CDK_TAG, [{ name: 'tagname', type: 'string', value: pr.tag }]);
  });
  logNya(app, command, 'rebuilding the structure, map and retarget operators after the tags are applied');
  setTemplateFile(app, ppg, path);
  return true;
}

function templateCommand(app: App, name: string, label: 'model' | 'destination model') {
  app.register({
    name, label: name, category: 'MOTOR', args: TEMPLATE_ARGS,
    execute(app, a) {
      const m = modelArg(app, a.targetmodel);
      if (m.kind === 'missing') { msg(app, `${name} command missing ${label}.`); return false; }
      if (m.kind === 'invalid') { msg(app, `${name} command invalid ${label}.`); return false; }
      if (missing(a.template)) { msg(app, `${name} command missing template file.`); return false; }
      return loadTemplate(app, name, m.model, textArg(a.template));
    },
  });
}

export function registerMotorB13dTagCommands(app: App) {
  app.register({
    name: 'CleanTagsFromRig', label: 'CleanTagsFromRig', category: 'MOTOR', args: MODEL1,
    execute(app, a) {
      const C = 'CleanTagsFromRig'; const r = modelArg(app, a.targetmodel);
      if (r.kind === 'missing') { msg(app, `${C} command missing model.`); return false; }
      if (r.kind === 'invalid') { msg(app, `${C} command invalid model.`); return false; }
      const m = r.model; const ppg = ensureTagPPG(app, m);
      progress(app, 'Removing MOTOR setup data from model ...');
      for (const p of tagParams(ppg)) setParamU(app, p, '');
      removeMotorOperators(app, m);
      removeNodeTags(app, m); deleteNamed(app, m, CDK_GLUE); deleteNamed(app, m, CDK_MAP); deleteNamed(app, m, PLOT_RETARGET_PPG);
      return true;
    },
  });
  app.register({
    name: 'RemoveMOTOROperators', label: 'RemoveMOTOROperators', category: 'MOTOR', args: MODEL,
    execute(app, a) {
      const C = 'RemoveMOTOROperators'; const r = modelArg(app, a.model);
      if (r.kind === 'missing') { msg(app, `${C} command missing target model.`); return undefined; }
      if (r.kind === 'invalid') { msg(app, `${C} command invalid target model.`); return undefined; }
      removeMotorOperators(app, r.model);
      return undefined;
    },
  });
  app.register({
    name: 'RemoveAllMotorPropsAndOps', label: 'RemoveAllMotorPropsAndOps', category: 'MOTOR', args: MODEL,
    execute(app, a) {
      const C = 'RemoveAllMotorPropsAndOps'; const r = modelArg(app, a.model);
      if (r.kind === 'missing') { msg(app, `${C} command missing target model.`); return undefined; }
      if (r.kind === 'invalid') { msg(app, `${C} command invalid target model.`); return undefined; }
      const m = r.model;
      logNya(app, C, 'closing the MOTOR views (View.PutState on a view named from a global prefix; second view helper unread)');
      withCmdLogOff(app, () => {
        progress(app, 'Removing MOTOR setup data from model ....');
        removeMotorOperators(app, m);
        removeTagData(app, m, C);
        removeNodeTags(app, m); deleteNamed(app, m, CDK_GLUE); deleteNamed(app, m, CDK_MAP); deleteStructure(app, m); deleteNamed(app, m, PLOT_RETARGET_PPG);
      });
      return undefined;   // the init sets a command flag instead of enabling a return value (WIRE_CORRECTIONS_B13)
    },
  });
  for (const [name, which] of [['RetargetExtractStartFrame', 'start'], ['RetargetExtractEndFrame', 'end']] as const) {
    app.register({
      name, label: name, category: 'MOTOR', args: MODEL, undoable: false,
      execute(app, a) {
        const r = modelArg(app, a.model);
        if (r.kind === 'missing') { msg(app, `${name} command missing source model.`); return false; }
        if (r.kind === 'invalid') { msg(app, `${name} command invalid source model.`); return false; }
        const fr = frameRange(app, r.model);
        return fr.ok ? fr[which] : 0;
      },
    });
  }
  templateCommand(app, 'LoadTagTemplateFile', 'model');
  templateCommand(app, 'InheritRetargetSetup', 'destination model');
  app.register({
    name: 'SaveTagTemplateFile', label: 'SaveTagTemplateFile', category: 'MOTOR', args: [{ name: 'model' }, { name: 'tag_template_filename' }],
    execute(app, a) {
      const C = 'SaveTagTemplateFile'; const r = modelArg(app, a.model);
      if (r.kind === 'missing') { msg(app, `${C} command missing model.`); return false; }
      if (r.kind === 'invalid') { msg(app, `${C} command invalid model.`); return false; }
      if (missing(a.tag_template_filename)) { msg(app, `${C} command missing template file.`); return false; }
      const m = r.model; const path = textArg(a.tag_template_filename);
      if (!path) return false;
      const ppg = findProp(m, TAG_PPG);
      if (!ppg) { msg(app, 'Model not tagged. Please tag the model.'); return false; }
      if (blobOf(m, CDK_MAP) === null && !findProp(m, CDK_MAP)) { msg(app, 'Incorrect tagging. Please re-tag.'); return false; }
      if (ppg.val('dirty') === true) logNya(app, C, 'rebuilding the tag data of a dirty TagPPG (0x18005eef0)');
      logNya(app, C, 'building the map from the structure and the structure / map sections after the version line');
      const s = structureOf(app, m);
      const body = writeTagt(s?.name ?? '', tagParams(ppg).map(p => ({ tag: p.name, value: String(p.value ?? '') })), s?.file ?? '');
      if (!writeText(path, body)) { msg(app, 'You do not have permission to save to this directory.  File not saved.'); return false; }
      setTemplateFile(app, ppg, path);
      return true;
    },
  });
}
