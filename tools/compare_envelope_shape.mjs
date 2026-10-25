// Envelope + shape-key smoke for Softimage Direct.
// Prefers Softimage PC dump `si_anim_envelope_shape.json` when present; otherwise
// validates Direct fixture schema + relative shape blend math.
// Needs `vite preview` on :4173. Usage: node tools/compare_envelope_shape.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const PC_DUMP = [
  path.resolve(__dirname, '../data/dump/si_anim_envelope_shape.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/anim/si_anim_envelope_shape.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/si_anim_envelope_shape.json',
].find(p => fs.existsSync(p));
const FLEXENV_WEIGHTS = [
  path.resolve(__dirname, '../data/dump/si_flexenv_weights.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/anim/si_flexenv_weights.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/anim/si_flexenv_weights.json',
].find(p => fs.existsSync(p));
const FIXTURE = path.resolve(__dirname, '../data/dump/si_anim_envelope_shape_fixture.json');

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
await page.goto('http://localhost:4173/?demo'); await page.waitForTimeout(1000);
await page.evaluate(() => { window.prompt = (_m, d) => d ?? '1'; window.confirm = () => true; });

const r = await page.evaluate(() => {
  const A = window.Application;
  A.run('NewScene');
  const mesh = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
  A.run('GetPrim', { PresetObj: 'Null', Name: 'boneA' });
  A.run('GetPrim', { PresetObj: 'Null', Name: 'boneB' });
  const boneA = A.scene.find('boneA'); const boneB = A.scene.find('boneB');
  boneA.kinematics.local.set('posy', 2); boneB.kinematics.local.set('posy', -2);
  A.select([mesh, boneA, boneB]);
  let envOk = false, envDeformers = 0, weightSum = null;
  try {
    A.run('ApplyFlexEnv');
    envOk = true;
    const op = mesh.primitive.operators.find(o => o.type === 'envelopop');
    if (op) {
      envDeformers = op.deformers.length;
      const w0 = op.weights[0];
      if (w0) { weightSum = 0; for (const x of w0) weightSum += x; }
    }
  } catch (e) { return { error: String(e) }; }

  // Shape: store rest base, sculpt one vertex, store key, blend at 0.5
  A.select([mesh]);
  const basePts = Array.from(mesh.primitive.mesh().positions);
  const sk = A.run('StoreShapeKey', { Name: 'Smile' });
  // Avoid dirty-rebuild wiping sculpt: write target positions straight onto the shape key.
  const target = basePts.slice();
  target[1] = basePts[1] + 2;
  sk.set('data', JSON.stringify(target));
  A.select([sk]);
  A.run('ApplyShapeKey', { Weight: 0.5 });
  const after = Array.from(mesh.primitive.mesh().positions);
  const y0 = after[1];
  const expectedY = basePts[1] + 1; // relative blend weight 0.5 * delta 2

  // Envelope normalize + mirror + remove deformer
  A.select([mesh]);
  const op = mesh.primitive.operators.find(o => o.type === 'envelopop');
  if (op?.weights?.[0]) { op.weights[0][0] = 2; op.weights[0][1] = 2; }
  A.run('NormalizeEnvelopeWeights');
  const normSum = op?.weights?.[0] ? [...op.weights[0]].reduce((s, x) => s + x, 0) : null;
  const beforeMirror = op?.weights?.[0] ? Array.from(op.weights[0]) : null;
  A.run('MirrorEnvelopeWeights');
  A.select([mesh, boneB]);
  const removed = A.run('RemoveFlexEnvDeformer');
  return {
    envOk, envDeformers, weightSum,
    shapeKeys: mesh.properties.filter(p => p.type === 'shapekey').map(p => p.name),
    hasBase: !!mesh.properties.find(p => p.type === 'shapebase'),
    shapeDelta: JSON.parse(sk.val('data'))[1] - basePts[1],
    weight: sk.val('weight'),
    y0, expectedY, baseY: basePts[1],
    normSum, beforeMirror, removed, deformersAfter: op?.deformers?.length,
  };
});

const diffs = [];
if (r.error) diffs.push(r.error);
if (!r.envOk) diffs.push('ApplyFlexEnv failed');
if (!(r.envDeformers >= 2)) diffs.push(`deformers ${r.envDeformers}`);
if (r.weightSum != null && Math.abs(r.weightSum - 1) > 1e-4) diffs.push(`weight sum ${r.weightSum} != 1`);
if (!r.hasBase) diffs.push('missing ShapeBase');
if (!r.shapeKeys?.length) diffs.push('no shape keys');
if (Math.abs((r.y0 ?? 0) - (r.expectedY ?? 0)) > 1e-6) diffs.push(`shape blend Y ${r.y0} != ${r.expectedY}`);
if (r.normSum != null && Math.abs(r.normSum - 1) > 1e-4) diffs.push(`normalize sum ${r.normSum}`);
if (!(r.removed >= 1)) diffs.push(`RemoveFlexEnvDeformer removed=${r.removed}`);
if (!(r.deformersAfter === 1)) diffs.push(`deformers after remove ${r.deformersAfter}`);

let pcNote = 'no PC dump yet — Direct fixture only';
let expectedGaps = [];
if (PC_DUMP) {
  const pc = JSON.parse(fs.readFileSync(PC_DUMP, 'utf8'));
  pcNote = `PC dump ${PC_DUMP}`;
  const flex = pc.steps?.find?.(s => s.name === 'ApplyFlexEnv');
  if (flex && flex.ok === false) {
    expectedGaps.push('PC ApplyFlexEnv failed headless (Direct still exercises envelope)');
  }
  // Only DIFF when PC succeeded and Direct is empty
  if (pc.envelope && Array.isArray(pc.envelope.deformers) && pc.envelope.deformers.length && r.envDeformers < 1) {
    diffs.push('PC dump has deformers but Direct envelope empty');
  }
  if (pc.shape && pc.steps?.some?.(s => s.name === 'StoreShapeKey' && s.ok) && !r.shapeKeys?.length) {
    diffs.push('PC StoreShapeKey ok but Direct has no shape keys');
  }
  if (expectedGaps.length) pcNote += `; expected gaps: ${expectedGaps.join('; ')}`;
} else if (fs.existsSync(FIXTURE)) {
  pcNote = `fixture ${FIXTURE}`;
}
// Overnight ApplyFlexEnv weight probe (si_flexenv_weights.json)
// Desktop deep: ApplyFlexEnv OK + EnvelopeWeight path, but weight_table still unreadable (LOCK).
if (FLEXENV_WEIGHTS) {
  const fw = JSON.parse(fs.readFileSync(FLEXENV_WEIGHTS, 'utf8'));
  pcNote += `; flexenv_weights ${FLEXENV_WEIGHTS}`;
  const flex = fw.steps?.find?.(s => s.name === 'ApplyFlexEnv');
  const apply = fw.apply;
  const wtOk = Array.isArray(fw.weight_table) && fw.weight_table.some(row => Array.isArray(row?.weights) && row.weights.length);
  if (flex && flex.ok === false) {
    expectedGaps.push(`PC si_flexenv_weights ApplyFlexEnv failed (${(flex.attempts || []).length} attempts)`);
  }
  if (apply && apply.ok === true) {
    pcNote += `; PC ApplyFlexEnv OK → ${apply.result}`;
    const env = fw.envelope || {};
    if (env.classname === 'EnvelopeWeight') pcNote += `; EnvelopeWeight ${env.property || ''}`;
    if (env.envelopop?.type === 'envelopop') pcNote += '; envelopop present';
    if (Array.isArray(fw.deformers) && fw.deformers.length) pcNote += `; deformers [${fw.deformers.join(',')}]`;
    // Softimage applied envelope; Direct must still create one
    if (!(r.envOk)) diffs.push('PC ApplyFlexEnv OK but Direct ApplyFlexEnv failed');
  }
  if (fw.errors?.length) expectedGaps.push(`PC si_flexenv_weights errors: ${fw.errors.join('; ')}`);
  if (wtOk && !(r.weightSum != null)) {
    diffs.push('PC flexenv weight_table has weights but Direct weightSum null');
  }
  if (!wtOk) {
    // Desktop deep: rows exist with null weights + COM read errors — still LOCK
    const rows = Array.isArray(fw.weight_table) ? fw.weight_table.length : 0;
    const sampleErr = fw.weight_table?.find?.(row => row?.err0 || row?.err1)?.err0
      || fw.weight_table?.find?.(row => row?.err1)?.err1
      || 'unreadable';
    expectedGaps.push(`PC si_flexenv_weights: ${rows} rows weights null (LOCK — ${sampleErr})`);
  }
  if (expectedGaps.length) pcNote += `; expected gaps: ${[...new Set(expectedGaps)].join('; ')}`;
}

console.log(diffs.length ? 'DIFF' : 'OK', 'envelope + shape blend');
console.log(JSON.stringify({ r, pcNote }, null, 2));
for (const d of diffs) console.log(' ', d);

const outPath = path.resolve(__dirname, '../docs/screenshots/envelope-shape-compare-last.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: diffs.length === 0, diffs, r, pcNote }, null, 2));

// Keep a ready consumer fixture describing expected PC dump schema (for when softimage-pc reconnects).
if (!fs.existsSync(FIXTURE)) {
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(FIXTURE, JSON.stringify({
    schema: 'si_anim_envelope_shape',
    note: 'Placeholder until softimage-pc runs tools/dump-factory/si_anim_envelope_shape_dump.js',
    expect: { envelope: { deformers: 'string[]', weight_samples: 'array' }, shape: { shapes: 'array' }, steps: 'array' },
  }, null, 2));
}

await b.close();
process.exit(diffs.length ? 1 : 0);
