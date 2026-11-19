// CMD-B13d (CDKMotionTransform.64.dll, MOTOR plug-in): the 14 commands of src/commands/motorB13d*.ts. There is no
// XSIBATCH golden for the row: this is a contract check against docs/ghidra/cmd-b13d-motiontransform-binary.md.
//   1. every name is registered with the catalogue argument list (data/command_registry.json does not list the
//      plug-in commands, so the list comes from data/commands_full.json; return values left out);
//   2. every command runs with its default arguments on the sample scene (cube selected) without throwing and logs
//      its "missing ..." message naming the command (the plug-in logs argument errors and returns OK);
//   3. the contract's stated results (return values, removed properties / operators, file contents, messages, undo).
// Needs `vite preview` (SI_URL, default :4173). Usage: node tools/compare_motor_b13d_commands.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const NAMES = [
  'CleanTagsFromRig', 'InheritRetargetSetup', 'LoadMOTORAdjustmentPresetFile', 'LoadMotorFile', 'LoadTagTemplateFile', 'RemoveAllMotorPropsAndOps',
  'RemoveMOTOROperators', 'RetargetBVH', 'RetargetC3DData', 'RetargetExtractEndFrame', 'RetargetExtractStartFrame', 'SaveC3DPoseMap',
  'SaveMOTORAdjustmentPresetFile', 'SaveTagTemplateFile',
];
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'commands_full.json'), 'utf8'));
const registry = Object.fromEntries(NAMES.map(n => {
  const c = reg.find(x => (x.scripting_name || x.name) === n);
  const f = full.find(x => (x.scripting_name || x.name) === n); const fd = Object.fromEntries((f?.args ?? []).map(a => [a.name, a.default]));
  if (c) return [n, c.args.filter(a => !(a.flags & 0x200)).map(a => [a.name, a.default ?? fd[a.name] ?? null])];
  return [n, f ? f.args.filter(a => !((a.flags ?? 0) & 0x200)).map(a => [a.name, a.default ?? null]) : null];
}));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
await page.waitForFunction(() => !!window.Application?.commands?.get('SaveC3DPoseMap') && !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
await page.waitForTimeout(500);

const got = await page.evaluate(({ NAMES }) => {
  const A = window.Application; A.autoInspect = false; A.maxUndo = 1000;
  const S = A.motorB13d, X = S.api, FS = X.fs;
  const out = { reg: {}, defaults: {}, checks: [] };
  const ok = (name, cond, detail = '') => out.checks.push([name, !!cond, cond ? '' : JSON.stringify(detail)]);
  const run = (n, a = {}) => { const m = A.log.length; try { return { v: A.run(n, a), log: A.log.slice(m).map(l => l.text) }; } catch (e) { return { err: String(e?.message ?? e), log: A.log.slice(m).map(l => l.text) }; } };
  const has = (r, s) => r.log.some(l => typeof s === 'string' ? l === s : s.test(l));
  const nya = (r) => r.log.some(l => /not yet attested/.test(l));
  const cube = A.scene.find('cube');
  const reset = () => A.select([cube]);
  const BASE = new Set(['Visibility', 'Mixer', 'Display', 'Geometry Approximation']);
  const props = (o) => o.properties.map(p => p.name);
  const extra = (o) => props(o).filter(n => !BASE.has(n));
  const clear = (o) => { for (const p of [...o.properties]) if (!BASE.has(p.name)) o.removeProperty(p); };
  const topUndo = (n) => A.undoStack.at(-1)?.label === n;

  // 1. registration
  for (const n of NAMES) { const d = A.commands.get(n); out.reg[n] = d ? d.args.map(a => [a.name, a.default ?? null]) : null; }
  // 2. default runs (cube selected)
  for (const n of NAMES) {
    reset(); const u0 = A.undoStack.length; const r = run(n);
    while (A.undoStack.length > u0) A.undo();
    out.defaults[n] = r.err ? 'ERROR: ' + r.err : r.log.some(l => l.startsWith(n + ' command missing')) ? 'ok' : 'NO-MESSAGE: ' + JSON.stringify(r.log);
  }

  // ---------------- fixture: model MotorRig { hip { knee }, spine }
  A.select([]);
  const mkModel = (name) => { A.select([]); const m = A.run('CreateModel', { InputObj: '', Name: name }); A.select([]); return m; };
  const mkNull = (name, parent) => A.run('GetPrim', { PresetObj: 'Null', Name: name, Parent: parent });
  const rig = mkModel('MotorRig'); const hip = mkNull('hip', rig.name); const knee = mkNull('knee', hip.name); const spine = mkNull('spine', rig.name);
  ok('fixture: rig model with hip / knee / spine', rig.kind === 'model' && hip.parentObj === rig && knee.parentObj === hip && spine.parentObj === rig, [rig.name, hip.name, knee.name, spine.name]);
  const opsFixture = (m, h) => {
    X.addCustomProp(m, 'RetargetAdjustPPG', [{ name: 'Blend', type: 'double', value: 0.5 }]);
    X.attachRetarget(m, { start: 5, length: 20, mapNames: [h.name, 'Hips'], chains: [] });
    X.addBlob(m, 'CDKRefFrames', {});
    X.addKineOp(m, 'local', 'RetargetOperator'); X.addKineOp(m, 'local', 'RetargetOp');
    X.addKineOp(h, 'global', 'RetargetGlobalOp'); X.addKineOp(h, 'global', 'RetargetUpVOp');
    X.addKineOp(h, 'local', 'RetargetSpineOp'); X.addKineOp(h, 'local', 'RetargetDecompOp');
    X.addCustomProp(h, 'RotationOffsetPPG', [{ name: 'rotx', type: 'double', value: 10 }]);
  };
  const tagFixture = (m, h, k) => {
    const ppg = X.ensureTagPPG(m);
    for (const [t, v] of [['Hips', h.name], ['LeftLeg', `${k.name}|${h.name}`], ['Head', '']]) ppg.add({ name: t, type: 'string', value: v });
    X.addCustomProp(h, 'CDKTag', [{ name: 'tagname', type: 'string', value: 'Hips' }]); X.addCustomProp(k, 'CDKExtractionTag');
    X.addCustomProp(m, 'CDKGlue'); X.addBlob(m, 'CDKMap', [h.name, 'Hips']); X.addCustomProp(m, 'PlotRetargetPPG');
    X.addBlob(m, 'TagData', {}); X.setStructure(m, { name: 'Biped', file: 'C:\\motorb13d\\biped.struct' }); X.addCustomProp(m, 'CDKStructTag');
    return ppg;
  };
  const opsLeft = () => [X.kineOps(rig, 'local').join(), X.kineOps(hip, 'global').join(), X.kineOps(hip, 'local').join()];

  // ================= RemoveMOTOROperators
  {
    opsFixture(rig, hip); X.ensureTagPPG(rig);
    const u0 = A.undoStack.length; const d0 = S.deleted.length;
    const r = run('RemoveMOTOROperators', { model: rig });
    ok('RemoveMOTOROperators: returns nothing', r.v === undefined && !r.err, r);
    ok('RemoveMOTOROperators: RetargetAdjustPPG, CDKRetargetOp, CDKRefFrames deleted, TagPPG kept', JSON.stringify(extra(rig)) === '["TagPPG"]', props(rig));
    ok('RemoveMOTOROperators: deletes RetargetOperator only (RetargetOp stays, as read)', JSON.stringify(opsLeft()) === '["RetargetOp","",""]', opsLeft());
    ok('RemoveMOTOROperators: RotationOffsetPPG of the rig nodes deleted', !props(hip).includes('RotationOffsetPPG'));
    ok('RemoveMOTOROperators: DeleteObj order (note 2.4)', JSON.stringify(S.deleted.slice(d0).map(s => s.split('.').slice(-1)[0])) === JSON.stringify(['RetargetAdjustPPG', 'CDKRetargetOp', 'CDKRefFrames', 'RetargetOperator', 'RetargetGlobalOp', 'RetargetUpVOp', 'RetargetSpineOp', 'RetargetDecompOp', 'RotationOffsetPPG']), S.deleted.slice(d0));
    ok('RemoveMOTOROperators: one undo step', topUndo('RemoveMOTOROperators') && A.undoStack.length <= u0 + 1);
    A.undo(); ok('RemoveMOTOROperators: undo restores', props(rig).includes('RetargetAdjustPPG') && opsLeft()[0] === 'RetargetOperator,RetargetOp' && props(hip).includes('RotationOffsetPPG'), [props(rig), opsLeft()]);
    A.redo();
    const d1 = S.deleted.length; const r2 = run('RemoveMOTOROperators', { model: rig });
    ok('RemoveMOTOROperators: no RetargetAdjustPPG -> nothing happens', !r2.err && S.deleted.length === d1);
    ok('RemoveMOTOROperators: missing model message', has(run('RemoveMOTOROperators'), 'RemoveMOTOROperators command missing target model.'));
    ok('RemoveMOTOROperators: invalid model message (not a Model)', has(run('RemoveMOTOROperators', { model: cube }), 'RemoveMOTOROperators command invalid target model.'));
    ok('RemoveMOTOROperators: model by name', !run('RemoveMOTOROperators', { model: rig.name }).log.some(l => /invalid/.test(l)));
  }
  // ================= CleanTagsFromRig
  {
    const k0 = X.kineOps(rig, 'local').length; opsFixture(rig, hip); const ppg = tagFixture(rig, hip, knee);
    const p0 = S.progress.length; const u0 = A.undoStack.length;
    const r = run('CleanTagsFromRig', { targetmodel: rig });
    ok('CleanTagsFromRig: returns true', r.v === true, r);
    ok('CleanTagsFromRig: tags kept, emptied', ppg.params.slice(4).map(p => p.name).join() === 'Hips,LeftLeg,Head' && ppg.params.slice(4).every(p => p.value === ''), ppg.params.map(p => [p.name, p.value]));
    ok('CleanTagsFromRig: operators removed (2.4)', !props(rig).includes('RetargetAdjustPPG') && X.kineOps(hip, 'global').length === 0);
    ok('CleanTagsFromRig: CDKTag / CDKExtractionTag, CDKGlue, CDKMap, PlotRetargetPPG deleted', !props(hip).includes('CDKTag') && !props(knee).includes('CDKExtractionTag') && !['CDKGlue', 'CDKMap', 'PlotRetargetPPG'].some(n => props(rig).includes(n)), [props(rig), props(hip), props(knee)]);
    ok('CleanTagsFromRig: TagData, CDKStructure, CDKStructTag left in place', ['TagData', 'CDKStructure', 'CDKStructTag'].every(n => props(rig).includes(n)), props(rig));
    ok('CleanTagsFromRig: progress caption', S.progress[p0] === 'Removing MOTOR setup data from model ...', S.progress.slice(p0));
    A.undo(); ok('CleanTagsFromRig: undo restores the tags and properties', ppg.val('Hips') === hip.name && props(hip).includes('CDKTag') && props(rig).includes('CDKGlue'), ppg.val('Hips'));
    A.redo();
    const m2 = mkModel('MotorTagless'); const r2 = run('CleanTagsFromRig', { targetmodel: m2 });
    ok('CleanTagsFromRig: TagPPG added when missing', r2.v === true && props(m2).includes('TagPPG'), props(m2));
    ok('CleanTagsFromRig: missing / invalid -> false with message', run('CleanTagsFromRig').v === false && has(run('CleanTagsFromRig', { targetmodel: cube }), 'CleanTagsFromRig command invalid model.'));
    void k0;
  }
  // ================= RemoveAllMotorPropsAndOps
  {
    clear(rig);
    opsFixture(rig, hip); const ppg = tagFixture(rig, hip, knee);
    const cl = A.cmdLog; const p0 = S.progress.length;
    const r = run('RemoveAllMotorPropsAndOps', { model: rig });
    ok('RemoveAllMotorPropsAndOps: returns nothing (no return value enabled)', r.v === undefined && !r.err, r);
    ok('RemoveAllMotorPropsAndOps: only TagPPG left, stripped to its 4 fixed parameters', JSON.stringify(extra(rig)) === '["TagPPG"]' && ppg.params.length === 4, [props(rig), ppg.params.map(p => p.name)]);
    ok('RemoveAllMotorPropsAndOps: tags and operators of the rig nodes removed', !props(hip).includes('CDKTag') && !props(knee).includes('CDKExtractionTag') && X.kineOps(hip, 'local').length === 0);
    ok('RemoveAllMotorPropsAndOps: progress caption (four dots)', S.progress[p0] === 'Removing MOTOR setup data from model ....');
    ok('RemoveAllMotorPropsAndOps: command logging restored; unread view / parameter steps logged', A.cmdLog === cl && nya(r) && r.log.some(l => /^RemoveAllMotorPropsAndOps\(/.test(l) || /RemoveAllMotorPropsAndOps/.test(l)), r.log);
    A.undo(); ok('RemoveAllMotorPropsAndOps: undo restores the tags', ppg.params.length === 7 && props(rig).includes('CDKStructure'), ppg.params.length);
    A.redo();
    ok('RemoveAllMotorPropsAndOps: missing / invalid messages', has(run('RemoveAllMotorPropsAndOps'), 'RemoveAllMotorPropsAndOps command missing target model.') && has(run('RemoveAllMotorPropsAndOps', { model: 'NoSuchB13d' }), 'RemoveAllMotorPropsAndOps command invalid target model.'));
  }
  // ================= RetargetExtractStartFrame / RetargetExtractEndFrame
  {
    const st = (m) => run('RetargetExtractStartFrame', { model: m }).v, en = (m) => run('RetargetExtractEndFrame', { model: m }).v;
    ok('RetargetExtract*: no animation, no retarget data -> 0', st(rig) === 0 && en(rig) === 0, [st(rig), en(rig)]);
    const px = hip.kinematics.local.get('posx'), ry = knee.kinematics.local.get('roty'), sx = spine.kinematics.local.get('posy'), cz = cube.kinematics.local.get('posz');
    A.anim.setKey(px, 3.7, 0); A.anim.setKey(px, 40.2, 1); A.anim.setKey(ry, 10, 0); A.anim.setKey(ry, 12, 5);
    A.anim.setKey(sx, -10, 0);                             // one key only: ignored
    A.anim.setKey(cz, -50, 0); A.anim.setKey(cz, 500, 1);  // outside the model
    ok('RetargetExtract*: FCurve range of the model\'s animated parameters (>= 2 keys, int of key times)', st(rig) === 3 && en(rig) === 40, [st(rig), en(rig)]);
    X.attachRetarget(rig, { start: 7, length: 30, mapNames: [], chains: [] });
    ok('RetargetExtract*: CDKRetargetOp data -> start, start + length', st(rig) === 7 && en(rig) === 37, [st(rig), en(rig)]);
    for (const p of [px, ry, sx, cz]) A.anim.removeAnimation(p);
    rig.removeProperty(rig.properties.find(p => p.name === 'CDKRetargetOp'));
    ok('RetargetExtract*: missing / invalid -> false with message', run('RetargetExtractStartFrame').v === false && has(run('RetargetExtractEndFrame', { model: cube }), 'RetargetExtractEndFrame command invalid source model.') && has(run('RetargetExtractStartFrame'), 'RetargetExtractStartFrame command missing source model.'));
  }
  // ================= SaveTagTemplateFile
  const DIR = 'C:\\motorb13d'; FS.ensureFolder(DIR);
  const TAGT = DIR + '\\rig.tagt', STRUCT = DIR + '\\biped.struct';
  {
    clear(rig);
    for (const o of [hip, knee]) clear(o);
    const ppg = tagFixture(rig, hip, knee);
    const r = run('SaveTagTemplateFile', { model: rig, tag_template_filename: TAGT });
    const want = `Biped\n3 \nHips ${hip.name}\nLeftLeg ${knee.name}|${hip.name}\nHead <EmptyFieldxsi>\n${STRUCT}\n8 \n`;
    ok('SaveTagTemplateFile: returns true', r.v === true, r);
    ok('SaveTagTemplateFile: .tagt layout (name, N, pairs, <EmptyFieldxsi>, structure file, version 8)', FS.isFile(TAGT) && FS.readFile(TAGT) === want, FS.isFile(TAGT) ? FS.readFile(TAGT) : null);
    ok('SaveTagTemplateFile: TagPPG.TemplateFile = path; trailing sections logged', ppg.val('TemplateFile') === TAGT && nya(r));
    ok('SaveTagTemplateFile: cannot open -> permission message, false', (() => { const x = run('SaveTagTemplateFile', { model: rig, tag_template_filename: 'C:\\nofolderb13d\\x.tagt' }); return x.v === false && has(x, 'You do not have permission to save to this directory.  File not saved.'); })());
    ok('SaveTagTemplateFile: empty path -> false, silent', (() => { const x = run('SaveTagTemplateFile', { model: rig, tag_template_filename: '' }); return x.v === false && !x.log.some(l => /command|permission/.test(l) && !/^SaveTagTemplateFile\(/.test(l)); })());
    const m2 = mkModel('MotorUntagged');
    ok('SaveTagTemplateFile: no TagPPG -> message, false', has(run('SaveTagTemplateFile', { model: m2, tag_template_filename: TAGT }), 'Model not tagged. Please tag the model.'));
    X.ensureTagPPG(m2);
    ok('SaveTagTemplateFile: no CDKMap -> message, false', has(run('SaveTagTemplateFile', { model: m2, tag_template_filename: TAGT }), 'Incorrect tagging. Please re-tag.'));
    ok('SaveTagTemplateFile: missing messages', has(run('SaveTagTemplateFile', { model: rig }), 'SaveTagTemplateFile command missing template file.') && has(run('SaveTagTemplateFile', { model: cube, tag_template_filename: TAGT }), 'SaveTagTemplateFile command invalid model.'));
  }
  // ================= LoadTagTemplateFile / InheritRetargetSetup
  {
    FS.writeFile(STRUCT, 'structure stand-in');
    const rig2 = mkModel('MotorRig2'); const h2 = mkNull('hip', rig2.name); const k2 = mkNull('knee', h2.name);
    const text = `Biped\n3 \nHips ${h2.name}\nLeftLeg ${k2.name}|${h2.name}\nHead <EmptyFieldxsi>\n${STRUCT}\n8 \n`;
    FS.writeFile(DIR + '\\rig2.tagt', text);
    X.addCustomProp(rig2, 'RetargetAdjustPPG'); X.addCustomProp(rig2, 'CDKGlue'); X.addCustomProp(rig2, 'PlotRetargetPPG');
    const ppg = X.ensureTagPPG(rig2); for (const t of ['Hips', 'LeftLeg', 'Head']) ppg.add({ name: t, type: 'string', value: 'old' });
    const p0 = S.progress.length; const u0 = A.undoStack.length;
    const r = run('LoadTagTemplateFile', { targetmodel: rig2, template: DIR + '\\rig2.tagt' });
    ok('LoadTagTemplateFile: returns true', r.v === true, r);
    ok('LoadTagTemplateFile: values written into TagPPG from index 4', JSON.stringify(ppg.params.slice(4).map(p => p.value)) === JSON.stringify([h2.name, `${k2.name}|${h2.name}`, '']), ppg.params.map(p => p.value));
    ok('LoadTagTemplateFile: operators, PlotRetargetPPG, CDKGlue removed first', !['RetargetAdjustPPG', 'CDKGlue', 'PlotRetargetPPG'].some(n => props(rig2).includes(n)), props(rig2));
    ok('LoadTagTemplateFile: CDKTag with tagname on tagged nodes', h2.properties.find(p => p.name === 'CDKTag')?.val('tagname') === 'Hips' && k2.properties.find(p => p.name === 'CDKTag')?.val('tagname') === 'LeftLeg');
    ok('LoadTagTemplateFile: TemplateFile set; progress captions; rebuild logged', ppg.val('TemplateFile') === DIR + '\\rig2.tagt' && S.progress.slice(p0).join('|') === 'Reading Tag Template File ...|Applying Tags to Model ...' && nya(r), S.progress.slice(p0));
    ok('LoadTagTemplateFile: one undo step', topUndo('LoadTagTemplateFile') && A.undoStack.length <= u0 + 1);
    A.undo(); ok('LoadTagTemplateFile: undo', ppg.val('Hips') === 'old' && props(rig2).includes('CDKGlue') && !h2.properties.some(p => p.name === 'CDKTag'));
    FS.writeFile(DIR + '\\miss.tagt', `Biped\n2 \nHips nosuchnode\nLeftLeg ${k2.name}|nosuchextr\n${STRUCT}\n8 \n`);
    const rm = run('LoadTagTemplateFile', { targetmodel: rig2, template: DIR + '\\miss.tagt' });
    ok('LoadTagTemplateFile: node not found -> logged, blanked; extraction node not found -> node only', rm.v === true && has(rm, 'Node nosuchnode') && has(rm, 'Extraction node nosuchextr') && ppg.val('Hips') === '' && ppg.val('LeftLeg') === k2.name, [rm.log, ppg.val('LeftLeg')]);
    FS.writeFile(DIR + '\\name.tagt', `Biped\n1 \nNeck ${h2.name}\n${STRUCT}\n8 \n`);
    const rn = run('LoadTagTemplateFile', { targetmodel: rig2, template: DIR + '\\name.tagt' });
    ok('LoadTagTemplateFile: tag name differs -> message, value still written', rn.v === true && has(rn, 'Failed to load template file: Tag name Neck') && ppg.val('Hips') === h2.name);
    FS.writeFile(DIR + '\\old.tagt', `Biped\n0 \n${STRUCT}\n6 \n`);
    ppg.set('dirty', false);
    const ro = run('LoadTagTemplateFile', { targetmodel: rig2, template: DIR + '\\old.tagt' });
    ok('LoadTagTemplateFile: version < 7 -> out of date, dirty, false', ro.v === false && has(ro, 'Failed to inherit the template data. Template is out of date.') && ppg.val('dirty') === true);
    FS.writeFile(DIR + '\\nostruct.tagt', `Biped\n0 \nC:\\motorb13d\\gone.struct\n8 \n`);
    const rig3 = mkModel('MotorRig3');
    const rs = run('LoadTagTemplateFile', { targetmodel: rig3, template: DIR + '\\nostruct.tagt' });
    ok('LoadTagTemplateFile: structure file not found -> message, false', rs.v === false && has(rs, 'Cannot find orriginal structure file :C:\\motorb13d\\gone.struct'), rs.log);
    FS.writeFile(DIR + '\\xml.tagt', '<?xml version="1.0"?><x/>');
    const before = ppg.params.map(p => p.value).join('|');
    ok('LoadTagTemplateFile: <?xml template ignored, true', run('LoadTagTemplateFile', { targetmodel: rig2, template: DIR + '\\xml.tagt' }).v === true && ppg.params.map(p => p.value).join('|') === before);
    const ru = run('LoadTagTemplateFile', { targetmodel: rig3, template: DIR + '\\absent.tagt' });
    ok('LoadTagTemplateFile: unopenable file -> TagPPG.TemplateFile = path, true', ru.v === true && rig3.properties.find(p => p.name === 'TagPPG')?.val('TemplateFile') === DIR + '\\absent.tagt');
    ok('LoadTagTemplateFile: empty path -> loader message', has(run('LoadTagTemplateFile', { targetmodel: rig2, template: '' }), 'Please specify a tag template file (*.tagt)'));
    ok('LoadTagTemplateFile: missing / invalid messages', has(run('LoadTagTemplateFile', { targetmodel: rig2 }), 'LoadTagTemplateFile command missing template file.') && has(run('LoadTagTemplateFile', { targetmodel: cube, template: TAGT }), 'LoadTagTemplateFile command invalid model.'));
    const ri = run('InheritRetargetSetup', { targetmodel: rig2, template: DIR + '\\rig2.tagt' });
    ok('InheritRetargetSetup: same loader', ri.v === true && ppg.val('LeftLeg') === `${k2.name}|${h2.name}`);
    ok('InheritRetargetSetup: own messages', has(run('InheritRetargetSetup'), 'InheritRetargetSetup command missing destination model.') && has(run('InheritRetargetSetup', { targetmodel: cube, template: 'x' }), 'InheritRetargetSetup command invalid destination model.') && has(run('InheritRetargetSetup', { targetmodel: rig2 }), 'InheritRetargetSetup command missing template file.'));
  }
  // ================= Save / LoadMOTORAdjustmentPresetFile
  {
    clear(rig);
    for (const o of [hip, knee]) clear(o);
    const adj = X.addCustomProp(rig, 'RetargetAdjustPPG', [{ name: 'Blend', label: 'Blend Amount', type: 'double', value: 0.5, desc: 'blend' }, { name: 'Lock', type: 'bool', value: true }, { name: 'Mode', type: 'int', value: 2, animatable: false }]);
    X.attachRetarget(rig, { start: 1, length: 10, mapNames: [hip.name, 'Hips', knee.name, 'LeftLeg'], chains: [] });
    const rot = X.addCustomProp(hip, 'RotationOffsetPPG', [{ name: 'rotx', type: 'double', value: 10, keyable: true }]);
    const F = DIR + '\\adjust.xml';
    const r = run('SaveMOTORAdjustmentPresetFile', { model: rig, filename: F });
    ok('SaveMOTORAdjustmentPresetFile: returns nothing, file written', r.v === undefined && FS.isFile(F), r);
    const doc = new DOMParser().parseFromString(FS.readFile(F), 'application/xml'); const R = doc.documentElement;
    const kids = (e) => Array.from(e?.children ?? []);
    ok('SaveMOTORAdjustmentPresetFile: ROOT > HEADER, ADJUST_PPG_DATA, ROTATION_OFFSETS', R.nodeName === 'ROOT' && kids(R).map(e => e.nodeName).join() === 'HEADER,ADJUST_PPG_DATA,ROTATION_OFFSETS', kids(R).map(e => e.nodeName));
    const H = kids(R)[0];
    ok('SaveMOTORAdjustmentPresetFile: header text (sic) and VERSION', H.firstChild?.nodeValue === 'Ajustment Preset file Saved out from XSI using MOTOR' && kids(H)[0]?.nodeName === 'VERSION' && !!kids(H)[0].textContent, H.outerHTML);
    const D = kids(R)[1]; const blend = kids(D)[0];
    ok('SaveMOTORAdjustmentPresetFile: one element per parameter, value text, attributes Capabilities / Name / Description / DataType', kids(D).map(e => e.nodeName).join() === 'Blend,Lock,Mode' && blend.textContent === '0.5' && blend.getAttribute('Name') === 'Blend Amount' && blend.getAttribute('Description') === 'blend' && blend.getAttribute('DataType') === '5' && blend.getAttribute('Capabilities') === '12' && kids(D)[1].getAttribute('DataType') === '11' && kids(D)[2].getAttribute('DataType') === '3', D.outerHTML);
    const RO = kids(R)[2];
    ok('SaveMOTORAdjustmentPresetFile: ROTATION_OFFSETS has the mapped nodes with a RotationOffsetPPG', kids(RO).map(e => e.nodeName).join() === hip.name && kids(kids(RO)[0]).map(e => e.nodeName).join() === 'rotx', RO.outerHTML);
    adj.set('Blend', 0.9); adj.set('Lock', false); adj.set('Mode', 7); rot.set('rotx', -3);
    const u0 = A.undoStack.length; const l = run('LoadMOTORAdjustmentPresetFile', { model: rig, filename: F });
    ok('LoadMOTORAdjustmentPresetFile: returns nothing; values read back by script name', l.v === undefined && adj.val('Blend') === 0.5 && adj.val('Lock') === true && adj.val('Mode') === 2 && rot.val('rotx') === 10, [adj.val('Blend'), adj.val('Lock'), adj.val('Mode'), rot.val('rotx')]);
    ok('LoadMOTORAdjustmentPresetFile: first mapped node gets IsCog; unread apply helpers logged', rot.val('IsCog') === true && nya(l), l.log);
    ok('LoadMOTORAdjustmentPresetFile: undoable', topUndo('LoadMOTORAdjustmentPresetFile') && A.undoStack.length <= u0 + 1);
    hip.removeProperty(rot);
    run('LoadMOTORAdjustmentPresetFile', { model: rig, filename: F });
    const rot2 = hip.properties.find(p => p.name === 'RotationOffsetPPG');
    ok('LoadMOTORAdjustmentPresetFile: RotationOffsetPPG added when missing', rot2?.val('rotx') === 10 && rot2?.val('IsCog') === true, rot2?.params.map(p => [p.name, p.value]));
    const m2 = mkModel('MotorNoData');
    ok('Save/LoadMOTORAdjustmentPresetFile: no RetargetAdjustPPG -> message, nothing written', has(run('SaveMOTORAdjustmentPresetFile', { model: m2, filename: DIR + '\\none.xml' }), 'No MOTOR Data loaded onto model.') && !FS.isFile(DIR + '\\none.xml') && has(run('LoadMOTORAdjustmentPresetFile', { model: m2, filename: F }), 'No MOTOR Data loaded onto model.'));
    ok('Save/LoadMOTORAdjustmentPresetFile: missing file path / invalid model messages', has(run('SaveMOTORAdjustmentPresetFile', { model: rig }), 'SaveMOTORAdjustmentPresetFile command missing file path.') && has(run('LoadMOTORAdjustmentPresetFile', { model: cube, filename: F }), 'LoadMOTORAdjustmentPresetFile command invalid target model.'));
  }
  // ================= LoadMotorFile
  {
    const M = DIR + '\\walk.motor';
    const pose = (a) => `<f><n global="0,1,0,${a},1,2,3"/><n global="0,1,0,0,0,0,0"/></f>`;
    const xml = `<?xml version="1.0"?><ROOT><HEADER><VERSION>3</VERSION><AnimationLength>2</AnimationLength><legLength>1.5</legLength><hipOffset>0.2</hipOffset><numNodes>2</numNodes><numPlanes>1</numPlanes><structure_type>Biped</structure_type></HEADER>`
      + `<NODES><n obj_IsValid="true" name="Hips" length="1"/><n obj_IsValid="false" name="Spine" length="0.5"/></NODES>`
      + `<PLANES><p name="leg" span="2" mid="1" anchor_index="0" numbones="2"><b boneindex="0"/><b boneindex="1"/></p></PLANES>`
      + `<POSE_VALUES>${pose(0.5)}${pose(1)}</POSE_VALUES><FCURVE_KEYS num_nodes_with_fcurve_keys="1"><n name="Hips"><c name="posx" numkeys="2"><k keytime="1"/><k keytime="2"/></c></n></FCURVE_KEYS></ROOT>`;
    FS.writeFile(M, xml);
    const m3 = mkModel('MotorTarget');
    const r0 = run('LoadMotorFile', { targetmodel: m3, motorfile: M, start: 5 });
    ok('LoadMotorFile: no structure / map -> message, false', r0.v === false && has(r0, 'Failed to read destmodel map from source model.'), r0.log);
    const mf = S.lastMotor;
    ok('LoadMotorFile: XML .motor parsed (header, nodes, planes, 7-number poses, fcurve keys)', mf?.header.structure_type === 'Biped' && mf.nodes.length === 2 && mf.nodes[1].valid === false && mf.planes[0].bones.join() === '0,1' && mf.pose.length === 2 && mf.pose[1][0].join() === '0,1,0,1,1,2,3' && mf.fcurves[0].channels[0].keys.join() === '1,2', mf);
    X.setStructure(m3, { name: 'Biped', file: 'x' }); X.addBlob(m3, 'CDKMap', ['hip', 'Hips']);
    const r1 = run('LoadMotorFile', { targetmodel: m3, motorfile: M });
    ok('LoadMotorFile: with structure and map -> true; apply stage logged; start not used', r1.v === true && nya(r1));
    FS.writeFile(DIR + '\\bad.motor', xml.replace(/<PLANES>.*<\/PLANES>/, ''));
    const r2 = run('LoadMotorFile', { targetmodel: m3, motorfile: DIR + '\\bad.motor' });
    ok('LoadMotorFile: missing element -> error list, false', r2.v === false && has(r2, 'DOMElement : <PLANES'), r2.log);
    FS.writeFile(DIR + '\\badpose.motor', xml.replace('0,1,0,0.5,1,2,3', '0,1,0,0.5,1,2'));
    ok('LoadMotorFile: a global attribute without 7 numbers fails', has(run('LoadMotorFile', { targetmodel: m3, motorfile: DIR + '\\badpose.motor' }), 'Error reading CTransformation Attribute : <global'));
    FS.writeFile(DIR + '\\legacy.motor', 'legacy text');
    const r3 = run('LoadMotorFile', { targetmodel: m3, motorfile: DIR + '\\legacy.motor' });
    ok('LoadMotorFile: legacy reader logged not yet attested, false', r3.v === false && nya(r3));
    ok('LoadMotorFile: messages', has(run('LoadMotorFile', { targetmodel: m3 }), 'LoadMotorFile command missing motorfile.') && has(run('LoadMotorFile', { targetmodel: cube, motorfile: M }), 'LoadMotorFile command invalid destination model.'));
  }
  // ================= RetargetBVH / RetargetC3DData
  {
    const B = DIR + '\\run.bvh', MAP = DIR + '\\run.map';
    FS.writeFile(B, 'HIERARCHY\nROOT Hips\n{\n OFFSET 0 0 0\n CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation\n JOINT Chest\n {\n  OFFSET 0 5 0\n  CHANNELS 3 Zrotation Xrotation Yrotation\n  End Site\n  {\n   OFFSET 0 4 0\n  }\n }\n}\nMOTION\nFrames: 2\nFrame Time: 0.033333\n0 1 2 3 4 5 6 7 8\n1 1 2 3 4 5 6 7 9\n');
    FS.writeFile(MAP, 'BVH Hips Chest');
    const cl = A.cmdLog;
    const r = run('RetargetBVH', { targetmodel: rig, bvhfile: B, mapfile: MAP });
    ok('RetargetBVH: BVH read (2 joints + end site, 9 channels, 2 frames); unread stages logged; false', r.v === false && S.lastBvh?.frames === 2 && S.lastBvh.data[1][8] === 9 && S.lastBvh.root.children[0].name === 'Chest' && nya(r), [r, S.lastBvh]);
    ok('RetargetBVH: command logging restored', A.cmdLog === cl);
    FS.writeFile(DIR + '\\notbvh.map', 'XYZ 1 2');
    ok('RetargetBVH: map not built from a BVH ref pose -> message', has(run('RetargetBVH', { targetmodel: rig, bvhfile: B, mapfile: DIR + '\\notbvh.map' }), 'To retarget a BVH file the mapfile must be built from the corresponding BVH ref pose'));
    ok('RetargetBVH: unreadable map -> message', has(run('RetargetBVH', { targetmodel: rig, bvhfile: B, mapfile: DIR + '\\none.map' }), 'Could not read mapfile.'));
    FS.writeFile(DIR + '\\bad.bvh', 'HIERARCHY\nROOT x\n{');
    ok('RetargetBVH: bad BVH -> Failed to load the BVH file.', has(run('RetargetBVH', { targetmodel: rig, bvhfile: DIR + '\\bad.bvh', mapfile: MAP }), 'Failed to load the BVH file.') && A.cmdLog === cl);
    ok('RetargetBVH: messages', has(run('RetargetBVH', { targetmodel: rig, bvhfile: B }), 'RetargetBVH command missing mapfile.') && has(run('RetargetBVH', { targetmodel: rig }), 'RetargetBVH command missing bvhfile.'));
    ok('RetargetC3DData: messages (two spaces in "map  file")', has(run('RetargetC3DData', { c3dfile: 'C:\\a.c3d' }), 'RetargetC3DData command missing the map  file.') && has(run('RetargetC3DData'), 'RetargetC3DData command missing the c3d file.'));
    ok('RetargetC3DData: unreadable map -> false', run('RetargetC3DData', { c3dfile: 'C:\\a.c3d', mapfile: DIR + '\\none.map' }).v === false);
    const rc = run('RetargetC3DData', { c3dfile: 'C:\\a.c3d', mapfile: MAP });
    ok('RetargetC3DData: importer logged not yet attested, false, logging restored', rc.v === false && nya(rc) && A.cmdLog === cl);
  }
  // ================= SaveC3DPoseMap
  {
    const c3d = mkModel('MotorC3D'); for (const n of ['root', 'mk1', 'mk2']) mkNull(n, c3d.name);
    X.addBlob(c3d, 'c3dudb', {}); const def = X.addCustomProp(c3d, 'c3ddef', [{ name: 'numFrames', type: 'int', value: 10 }, { name: 'numPoints', type: 'int', value: 2 }, { name: 'frameIncrement', type: 'int', value: 1 }, { name: 'pose', type: 'bool', value: true }, { name: 'upDir', type: 'int', value: 1 }]);
    X.ensureTagPPG(rig); const P = DIR + '\\fit.c3dpose';
    const r = run('SaveC3DPoseMap', { c3dmodel: c3d, ESR_rig: rig, Map_file: P });
    const names = [...c3d.descendants()].slice(1).map(o => o.name);
    ok('SaveC3DPoseMap: true, c3ddef.pose reset', r.v === true && def.val('pose') === false, r);
    ok('SaveC3DPoseMap: .c3dpose header, marker names (first object excluded), no fitted entries', FS.readFile(P) === `Version3\n 1 \n2 0 \n${names.join('\n')}\n` && names.length === 2, FS.readFile(P));
    ok('SaveC3DPoseMap: fitting / line-2 tag / number formatter logged', nya(r));
    ok('SaveC3DPoseMap: pose false -> false', run('SaveC3DPoseMap', { c3dmodel: c3d, ESR_rig: rig, Map_file: P }).v === false);
    def.set('pose', true);
    S.hooks.c3dFit = () => [{ idx: [0, 1, 2], xf1: [0.1, 0.2, 0.3, 1, 2, 3], vec: [0, 1, 0], xf2: [0, 0, 0, 4, 5, 6] }];
    run('SaveC3DPoseMap', { c3dmodel: c3d, ESR_rig: rig, Map_file: P }); S.hooks.c3dFit = undefined;
    ok('SaveC3DPoseMap: record = 3 lines (indices; transform + vector; transform)', FS.readFile(P).endsWith('2 1 \n' + names.join('\n') + '\n0 1 2 \n0.1 0.2 0.3 1 2 3 0 1 0 \n0 0 0 4 5 6 \n'), FS.readFile(P));
    def.set('pose', true);
    const m2 = mkModel('MotorNoTag');
    ok('SaveC3DPoseMap: rig without TagPPG -> false, pose kept', run('SaveC3DPoseMap', { c3dmodel: c3d, ESR_rig: m2, Map_file: P }).v === false && def.val('pose') === true);
    ok('SaveC3DPoseMap: no c3dudb -> false', run('SaveC3DPoseMap', { c3dmodel: rig, ESR_rig: rig, Map_file: P }).v === false);
    ok('SaveC3DPoseMap: messages', has(run('SaveC3DPoseMap', { c3dmodel: c3d }), 'SaveC3DPoseMap command missing the ESR rig') && has(run('SaveC3DPoseMap', { c3dmodel: c3d, ESR_rig: cube }), 'SaveC3DPoseMap command invalid ESR rig') && has(run('SaveC3DPoseMap', { c3dmodel: c3d, ESR_rig: rig }), 'SaveC3DPoseMap command missing the Map file') && has(run('SaveC3DPoseMap', { c3dmodel: cube }), 'SaveC3DPoseMap command invalid c3dmodel'));
  }
  reset();
  return out;
}, { NAMES });

let fail = 0, pass = 0;
const report = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
for (const n of NAMES) {
  report(`${n}: registered`, got.reg[n] !== null);
  report(`${n}: catalogue argument list`, JSON.stringify(got.reg[n]) === JSON.stringify(registry[n]), `${JSON.stringify(got.reg[n])} vs ${JSON.stringify(registry[n])}`);
  report(`${n}: default run`, got.defaults[n] === 'ok', got.defaults[n]);
}
for (const [name, cond, detail] of got.checks) report(name, cond, detail);
report('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(`compare_motor_b13d_commands: ${pass}/${pass + fail} ok (${NAMES.length} commands)`);
await browser.close();
process.exit(fail ? 1 : 0);
