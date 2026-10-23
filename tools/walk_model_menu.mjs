// Walks every Model-toolbar menu item in the built app (needs `vite preview` on :4173) and reports
// which run, which are greyed (with reason) and which throw. Usage: node tools/walk_model_menu.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:4173/?demo'); await p.waitForTimeout(1200);
const r = await p.evaluate(() => {
  const A = window.Application; const status = window.__menuStatus('Model'); const out = { ok: [], grey: [], fail: [] };
  const setup = () => { A.run('NewScene'); const c = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' }); c.primitive.operators[0].set('subdivu', 3); c.primitive.operators[0].set('subdivv', 3); c.primitive.operators[0].set('subdivbase', 3); const s = A.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface' }); A.run('Translate', { X: 3, Y: 0, Z: 0 }); A.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve' }); A.run('SelectObj', { InputObjs: 'cube' }); return c; };
  for (const it of status) {
    if (!it.implemented) { out.grey.push(it.path); continue; }
    try { setup(); window.__runMenu('Model', it.path, it.label); out.ok.push(it.path); } catch (e) { out.fail.push(it.path + ' — ' + (e && e.message)); }
  }
  return out;
});
console.log('ok', r.ok.length, 'grey', r.grey.length, 'fail', r.fail.length);
for (const f of r.fail) console.log(' FAIL', f);
if (errs.length) console.log('page errors', errs.slice(0, 10));
await b.close();
