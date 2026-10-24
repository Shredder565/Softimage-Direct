// Softimage Direct Modify/Create Model (referenced models + deltas) functional harness.
// Accepted exit lock: Direct's localStorage-backed Softimage-shaped JSON OM (model2.ts).
// Softimage binary .emdl/.delta bytes are an accepted headless gap (not in PC dump pack).
// Needs vite preview on :4173. Usage: node tools/compare_ref_model.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const chrome =
  ['/opt/pw-browsers/chromium', '/usr/local/bin/google-chrome', '/opt/google/chrome/chrome']
    .find(p => fs.existsSync(p));
const b = await chromium.launch({
  ...(chrome ? { executablePath: chrome } : {}),
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(900);

const run = (name, args = {}) => page.evaluate(([n, a]) => {
  try {
    const r = window.Application.run(n, a);
    if (r && typeof r.then === 'function') return r.then(v => (v && v.name) ? v.name : (v == null ? 'null' : String(v))).catch(e => 'ERR ' + (e?.message ?? e));
    return r && r.name ? r.name : (r == null ? 'null' : String(r));
  } catch (e) { return 'ERR ' + (e?.message ?? e); }
}, [name, args]);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

await run('NewScene');
await run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'ball' });
const model = await run('CreateModel', { InputObj: 'ball', Name: 'BallModel' });
check('CreateModel', !String(model).startsWith('ERR'), model);

await page.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'BallModel' }));
const convert = await run('ConvertToRefModel', { FileName: 'BallRef_harness' });
check('ConvertToRefModel', !String(convert).startsWith('ERR'), convert);
const isRef = await page.evaluate(() => !!(window.Application.scene.find('BallModel')?.ref));
check('ref flag set', isRef);
const emdlOm = await page.evaluate(() => {
  try {
    const t = localStorage.getItem('si.refmodel.BallRef_harness');
    const j = JSON.parse(t || 'null');
    return { format: j?.format, version: j?.version, nodes: j?.nodes?.length, bytes: t?.length, magicNote: 'SI binary .emdl is OLE/CFBF (D0CF11E0); Direct uses softimage-direct-emdl-json' };
  } catch (e) { return { error: String(e) }; }
});
check('ExportModel JSON OM format', emdlOm?.format === 'softimage-direct-emdl-json' && Number(emdlOm?.version) === 1 && (emdlOm?.nodes ?? 0) >= 1, JSON.stringify(emdlOm));

const res0 = await run('SetResolutionOfRefModels', { resolution: 0 });
const kids0 = await page.evaluate(() => window.Application.scene.find('BallModel')?.children?.length ?? -1);
check('SetResolution OffLoaded', !String(res0).startsWith('ERR') && kids0 === 0, `kids=${kids0}`);

const res1 = await run('SetResolutionOfRefModels', { resolution: 1 });
await page.waitForTimeout(200);
const kids1 = await page.evaluate(() => window.Application.scene.find('BallModel')?.children?.length ?? -1);
check('SetResolution First', !String(res1).startsWith('ERR') && kids1 >= 1, `kids=${kids1}`);

const delta = await run('AddDelta');
check('AddDelta', !String(delta).startsWith('ERR'), delta);
const hasDelta = await page.evaluate(() => !!window.Application.scene.find('BallModel')?.properties?.find(p => p.type === 'delta'));
check('delta property on model', hasDelta);

const commit = await run('CommitToReference');
check('CommitToReference', !String(commit).startsWith('ERR'), commit);

const local = await run('MakeModelLocal');
check('MakeModelLocal', !String(local).startsWith('ERR'), local);
const cleared = await page.evaluate(() => !window.Application.scene.find('BallModel')?.ref);
check('ref cleared', cleared);

const empty = await run('CreateEmptyRefModel', { Name: 'EmptyRef' });
check('CreateEmptyRefModel', !String(empty).startsWith('ERR'), empty);

const emptyRef = await page.evaluate(() => {
  const m = window.Application.scene.find('EmptyRef');
  return m ? { ref: !!m.ref, kids: m.children.length } : null;
});
check('empty ref model', !!emptyRef?.ref && emptyRef.kids === 0, JSON.stringify(emptyRef));

// Import bundled preset as referenced model (Fish)
const fish = await run('ImportRefModels', { FileName: 'Fish' });
await page.waitForTimeout(800);
const fishKids = await page.evaluate(() => window.Application.scene.find('Fish')?.children?.length ?? 0);
check('ImportRefModels Fish', !String(fish).startsWith('ERR') && fishKids > 0, `kids=${fishKids} r=${fish}`);

const update = await page.evaluate(() => {
  try {
    window.Application.run('SelectObj', { InputObjs: 'Fish' });
    const r = window.Application.run('UpdateReferencedModel');
    return r && r.then ? 'promise' : String(r ?? 'ok');
  } catch (e) { return 'ERR ' + e.message; }
});
check('UpdateReferencedModel', !String(update).startsWith('ERR'), update);

const failed = results.filter(r => !r.ok);
console.log(`\ncompare_ref_model: ${results.length - failed.length}/${results.length} OK`);
await b.close();
process.exit(failed.length ? 1 : 0);
