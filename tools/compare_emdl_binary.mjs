// Softimage binary OLE .emdl open harness (junk.emdl + DumpModel.emdl).
// Locks: CFB magic, ImportModel hierarchy junk→sphere2, mesh counts 8951/8263 from softimage-pc golden.
// Needs vite preview on :4173. Usage: node tools/compare_emdl_binary.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

const fixtureUrl = '/fixtures/emdl/junk.emdl';
const dumpUrl = '/fixtures/emdl/DumpModel.emdl';

// CFB header smoke via page fetch
const junkHead = await page.evaluate(async (url) => {
  const r = await fetch(url);
  const buf = await r.arrayBuffer();
  const u = new Uint8Array(buf);
  const magic = [...u.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { ok: r.ok, size: buf.byteLength, magic };
}, fixtureUrl);
check('junk.emdl served', junkHead.ok && junkHead.size === 2211840, JSON.stringify(junkHead));
check('junk.emdl OLE magic', junkHead.magic === 'd0cf11e0a1b11ae1', junkHead.magic);

await page.evaluate(() => window.Application.run('NewScene'));
const imported = await page.evaluate(async (url) => {
  try {
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    const m = await window.Application.run('ImportModel', { Bytes: buf, FileName: 'junk.emdl' });
    const model = window.Application.scene.find('junk');
    const sphere = model?.children?.find(c => c.name === 'sphere2') ?? window.Application.scene.find('sphere2');
    const mesh = sphere?.primitive?.mesh?.();
    const l = model?.kinematics?.local;
    const sl = sphere?.kinematics?.local;
    return {
      modelName: m?.name ?? model?.name ?? null,
      hasModel: !!model,
      hasSphere: !!sphere,
      npts: mesh ? mesh.positions.length / 3 : -1,
      npolys: mesh ? mesh.polygons.length : -1,
      modelPos: l ? [l.val('posx'), l.val('posy'), l.val('posz')] : null,
      sphereScl: sl ? [sl.val('sclx'), sl.val('scly'), sl.val('sclz')] : null,
      kids: model?.children?.map(c => c.name) ?? [],
    };
  } catch (e) {
    return { error: e?.message ?? String(e) };
  }
}, fixtureUrl);

check('ImportModel junk no error', !imported.error, imported.error || '');
check('model junk present', imported.hasModel && imported.modelName === 'junk', JSON.stringify({ name: imported.modelName, kids: imported.kids }));
check('polymesh sphere2', imported.hasSphere, JSON.stringify(imported.kids));
check('sphere2 npts', imported.npts === 8951, `npts=${imported.npts}`);
check('sphere2 npolys', imported.npolys === 8263, `npolys=${imported.npolys}`);
const posOk = imported.modelPos &&
  Math.abs(imported.modelPos[0] - 0.16824978345268615) < 1e-6 &&
  Math.abs(imported.modelPos[1] - (-1.9848662688707343)) < 1e-6 &&
  Math.abs(imported.modelPos[2] - 0.009487155354324461) < 1e-6;
check('junk model translate', posOk, JSON.stringify(imported.modelPos));
const sclOk = imported.sphereScl &&
  Math.abs(imported.sphereScl[0] - 0.4278924926936942) < 1e-6;
check('sphere2 local scale', sclOk, JSON.stringify(imported.sphereScl));

// DumpModel.emdl: must open without JSON.parse error (hierarchy-only OK)
await page.evaluate(() => window.Application.run('NewScene'));
const dumpOpen = await page.evaluate(async (url) => {
  try {
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    const m = await window.Application.run('ImportModel', { Bytes: buf, FileName: 'DumpModel.emdl' });
    return { ok: true, name: m?.name ?? null, nodes: window.Application.scene.root.children.map(c => c.name) };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}, dumpUrl);
check('DumpModel.emdl opens', dumpOpen.ok && !String(dumpOpen.error || '').includes('JSON'), JSON.stringify(dumpOpen));

// Direct JSON OM path still works
await page.evaluate(() => window.Application.run('NewScene'));
const jsonOm = await page.evaluate(async () => {
  try {
    const data = {
      format: 'softimage-direct-emdl-json', version: 1,
      model: 'JsonBall', file: 'JsonBall.emdl',
      nodes: [
        { name: 'JsonBall', type: '#model', parent: null, xf: { pos: [0, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1], rotorder: 0 } },
        { name: 'ball', type: 'polymsh', parent: 'JsonBall', xf: { pos: [0, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1], rotorder: 0 },
          mesh: { points: [0, 0, 0, 1, 0, 0, 0, 1, 0], polys: [[0, 1, 2]] } },
      ],
    };
    const m = await window.Application.run('ImportModel', { Data: data });
    return { name: m?.name, kids: window.Application.scene.find('JsonBall')?.children?.length };
  } catch (e) { return { error: e?.message ?? String(e) }; }
});
check('JSON OM ImportModel', jsonOm.name === 'JsonBall' && jsonOm.kids >= 1, JSON.stringify(jsonOm));

// Open PC golden junk-emdl-om.json directly (File Open .json path)
await page.evaluate(() => window.Application.run('NewScene'));
const fromOmJson = await page.evaluate(async () => {
  try {
    const r = await fetch('/fixtures/emdl/junk-emdl-om.json');
    const buf = await r.arrayBuffer();
    const m = await window.Application.run('ImportModel', { Bytes: buf, FileName: 'junk-emdl-om.json' });
    const sphere = window.Application.scene.find('sphere2');
    const mesh = sphere?.primitive?.mesh?.();
    return {
      name: m?.name ?? window.Application.scene.find('junk')?.name,
      npts: mesh ? mesh.positions.length / 3 : -1,
      npolys: mesh ? mesh.polygons.length : -1,
    };
  } catch (e) { return { error: e?.message ?? String(e) }; }
});
check('Open junk-emdl-om.json', fromOmJson.name === 'junk' && fromOmJson.npts === 8951 && fromOmJson.npolys === 8263, JSON.stringify(fromOmJson));

// Companion convention: OLE URL loads sibling junk.emdl.json when fingerprint golden also works
await page.evaluate(() => window.Application.run('NewScene'));
const viaUrl = await page.evaluate(async () => {
  try {
    const m = await window.Application.run('ImportModel', { FileName: '/fixtures/emdl/junk.emdl' });
    const sphere = window.Application.scene.find('sphere2');
    const mesh = sphere?.primitive?.mesh?.();
    return { name: m?.name, npts: mesh ? mesh.positions.length / 3 : -1, npolys: mesh ? mesh.polygons.length : -1 };
  } catch (e) { return { error: e?.message ?? String(e) }; }
});
check('ImportModel FileName junk.emdl URL', viaUrl.name === 'junk' && viaUrl.npts === 8951, JSON.stringify(viaUrl));

const failed = results.filter(r => !r.ok);
console.log(`\ncompare_emdl_binary: ${results.length - failed.length}/${results.length} OK`);
await b.close();
process.exit(failed.length ? 1 : 0);
