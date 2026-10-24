// Softimage-faithful Get > Property defaults + Create > Text / generator opdef defaults.
// Goldens: data/dump/si_text_golden.json, si_model_property_commands.json, si_generators_golden.json
// Usage: node tools/model_get_text_check.mjs
// Expects vite preview at http://127.0.0.1:4173/
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const textGolden = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/dump/si_text_golden.json'), 'utf8'));
const siCurves = textGolden.Curves?.params ?? { fitsize: 4, use_fitsize: true, ratio: 10, char_spacing: 0, line_spacing: 0 };
const siCurveSummary = textGolden.Curves?.mesh?.summary ?? { pts: 230, nbcurves: 8 };

const URL = process.env.SI_URL || 'http://127.0.0.1:4173/';
const CHROME = [
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/local/bin/google-chrome',
  '/opt/google/chrome/chrome',
].find(p => { try { return fs.existsSync(p); } catch { return false; } });
const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrs = []; p.on('pageerror', e => pageErrs.push(e.message));
await p.goto(URL); await p.waitForTimeout(900);
await p.evaluate(() => { window.prompt = (_m, d) => (d == null ? 'Softimage' : String(d)); window.confirm = () => true; });

const run = (name, args = {}) => p.evaluate(([n, a]) => {
  try { const r = window.Application.run(n, a); return r && r.name ? r.name : r == null ? 'null' : String(r); }
  catch (e) { return 'ERR ' + (e?.message ?? e); }
}, [name, args]);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

await run('NewScene');
await run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface', Name: 'cube' });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'cube' }));

// ---- Get > Property: Softimage PresetObj names must create real typed props (not stub "enabled")
const geom = await run('AddProp', { PresetObj: 'GeomApprox', InputObjs: 'cube' });
const ga = await p.evaluate(() => {
  const o = window.Application.scene.find('cube');
  const p = o?.properties.find(x => x.type === 'geomapprox');
  return p ? { type: p.type, moad: p.val('gapproxmoad'), moan: p.val('gapproxmoan'), mordrsl: p.val('gapproxmordrsl'), n: p.params.length } : null;
});
check('GeomApprox AddProp', !String(geom).startsWith('ERR') && ga?.type === 'geomapprox', geom);
check('GeomApprox Softimage defaults', ga && ga.moad === true && Number(ga.moan) === 60 && Number(ga.mordrsl) === 0 && ga.n >= 8, JSON.stringify(ga));

const attr = await run('AddProp', { PresetObj: 'AttributeDisplay', InputObjs: 'cube' });
const ad = await p.evaluate(() => {
  const o = window.Application.scene.find('cube');
  const p = o?.properties.find(x => x.type === 'attributedisplay');
  return p ? { enable: p.val('enable'), displaymode: p.val('displaymode'), n: p.params.length } : null;
});
check('AttributeDisplay Softimage defaults', !String(attr).startsWith('ERR') && ad && ad.enable === true && Number(ad.displaymode) === 0 && ad.n >= 8, JSON.stringify(ad));

const ts = await run('AddProp', { PresetObj: 'Transform Setup', InputObjs: 'cube' });
const tsv = await p.evaluate(() => {
  const o = window.Application.scene.find('cube');
  const p = o?.properties.find(x => x.type === 'transformsetup');
  return p ? { tool: p.val('tool'), xaxis: p.val('xaxis'), translate: p.val('translate') } : null;
});
check('Transform Setup Softimage defaults', !String(ts).startsWith('ERR') && tsv && Number(tsv.tool) === 0 && tsv.xaxis === true && Number(tsv.translate) === 2, JSON.stringify(tsv));

const rm = await run('AddProp', { PresetObj: 'RenderMap', InputObjs: 'cube' });
const rmv = await p.evaluate(() => {
  const o = window.Application.scene.find('cube');
  const p = o?.properties.find(x => x.type === 'rendermap');
  return p ? { rx: p.val('resolutionx'), ry: p.val('resolutiony'), file: String(p.val('imagefile') ?? '') } : null;
});
check('RenderMap Softimage defaults', !String(rm).startsWith('ERR') && rmv && Number(rmv.rx) === 256 && Number(rmv.ry) === 256 && !/^[A-Za-z]:/.test(rmv.file), JSON.stringify(rmv));

const syn = await run('AddProp', { PresetObj: 'Synoptic Property', InputObjs: 'cube' });
const synv = await p.evaluate(() => {
  const o = window.Application.scene.find('cube');
  const p = o?.properties.find(x => x.type === 'synoptic');
  return p ? { hasPath: p.get('path') != null, hasDisplay: p.get('displayname') != null } : null;
});
check('Synoptic Property Softimage params', !String(syn).startsWith('ERR') && synv?.hasPath && synv?.hasDisplay, JSON.stringify(synv));

const sk = await run('AddProp', { PresetObj: 'Static Kinematic State Property', InputObjs: 'cube' });
const skv = await p.evaluate(() => {
  const o = window.Application.scene.find('cube');
  const p = o?.properties.find(x => x.type === 'statickinestate');
  return p ? { sclx: p.val('sclx'), posx: p.val('posx'), n: p.params.length } : null;
});
check('Static KineState Softimage defaults', !String(sk).startsWith('ERR') && skv && Number(skv.sclx) === 1 && skv.n >= 6, JSON.stringify(skv));

// ---- Create > Text: Softimage PC si_text_golden.json Curves (TextToCurveList fitsize=4, 8 curves / 230 pts on Softimage font)
await run('NewScene');
const textName = await p.evaluate(async () => {
  // Planar mesh: Softimage command OK under -processing but converter has no readable mesh — Direct still builds a planar mesh.
  const o = window.Application.run('CreateMeshText', { PresetObj: 'CurveListToPlanarMeshForText', Text: 'Si' });
  await new Promise(r => setTimeout(r, 400));
  const obj = window.Application.selectedObjects[0] ?? o;
  const gen = obj?.primitive?.operators?.[0];
  const mesh = obj?.primitive?.mesh();
  let ymin = Infinity, ymax = -Infinity;
  if (mesh?.positions) for (let i = 1; i < mesh.positions.length; i += 3) { ymin = Math.min(ymin, mesh.positions[i]); ymax = Math.max(ymax, mesh.positions[i]); }
  return {
    name: obj?.name,
    fitsize: gen?.val?.('fitsize'),
    use_fitsize: gen?.val?.('use_fitsize'),
    ratio: gen?.val?.('ratio'),
    char_spacing: gen?.val?.('char_spacing'),
    line_spacing: gen?.val?.('line_spacing'),
    height: Number.isFinite(ymin) ? ymax - ymin : null,
    polys: mesh?.polygons?.length ?? 0,
  };
});
check('CreateMeshText Softimage TextToCurveList defaults', textName && Number(textName.fitsize) === 4 && textName.use_fitsize === true && Number(textName.ratio) === 10 && Number(textName.char_spacing) === 0 && Number(textName.line_spacing) === 0, JSON.stringify(textName));
check('CreateMeshText planar mesh output', textName && textName.polys > 0 && textName.height != null && textName.height > 2 && textName.height < 8, JSON.stringify({ height: textName?.height, polys: textName?.polys }));

const crv = await p.evaluate(async () => {
  // Softimage Curves golden: CreatePrim Text NurbsCurve + TextToCurveList (same evaluate as NewScene).
  const A = window.Application;
  A.run('NewScene');
  const created = A.run('CreatePrim', { PresetObj: 'Text', GeometryType: 'NurbsCurve', Name: 'textcrv', Text: 'Softimage' });
  await new Promise(r => setTimeout(r, 800));
  const o = A.scene.find('textcrv') ?? (created?.primitive?.type === 'crvlist' ? created : null) ?? [...A.scene.allObjects()].find(x => x.primitive?.type === 'crvlist');
  const gen = o?.primitive?.operators?.[0];
  if (o?.primitive) { o.primitive.dirty = true; try { o.primitive.geom(); } catch { /* */ } }
  const c = o?.primitive?.curve();
  const nbcurves = c ? 1 + (c.subcurves?.length ?? 0) : 0;
  let npts = 0, ymin = Infinity, ymax = -Infinity;
  const walk = (cv) => { for (const p of cv?.cvs ?? []) { npts++; ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); } };
  if (c) { walk(c); for (const s of c.subcurves ?? []) walk(s); }
  return {
    fitsize: gen?.val?.('fitsize'), use_fitsize: gen?.val?.('use_fitsize'), ratio: gen?.val?.('ratio'),
    char_spacing: gen?.val?.('char_spacing'), line_spacing: gen?.val?.('line_spacing'),
    height: Number.isFinite(ymin) ? ymax - ymin : null, npts, nbcurves, type: o?.primitive?.type, text: gen?.val?.('text'),
    createdType: created?.primitive?.type ?? created?.type,
  };
});
// Softimage PC Curves: fitsize=4, 230 pts, 8 curves (install font). Direct Helvetiker ≈ letter outers; params must match golden.
check('CreatePrim Text Softimage TextToCurveList params', crv && Number(crv.fitsize) === Number(siCurves.fitsize) && crv.use_fitsize === !!siCurves.use_fitsize && Number(crv.ratio) === Number(siCurves.ratio) && Number(crv.char_spacing) === Number(siCurves.char_spacing) && Number(crv.line_spacing) === Number(siCurves.line_spacing) && crv.text === 'Softimage' && crv.type === 'crvlist', JSON.stringify(crv));
check('CreatePrim Text Curves output', crv && crv.npts >= 8 && crv.nbcurves >= 8 && crv.nbcurves <= 12 && crv.height != null && crv.height > 2 && crv.height < 8, JSON.stringify({ npts: crv?.npts, nbcurves: crv?.nbcurves, height: crv?.height, si: siCurveSummary }));

// ---- Generators: Softimage extrusion/loft/revolution defaults from opdefs
await run('NewScene');
await run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'profile' });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'profile' }));
const extrude = await run('ApplyGenOp', { PresetObj: 'ExtrusionAlongAxis', Target: 'NurbsSurface' });
const ev = await p.evaluate(() => {
  const o = window.Application.selectedObjects[0] ?? [...window.Application.scene.allObjects()].find(x => x.primitive?.operators?.[0]?.type === 'extrusion');
  const gen = (o?.type === 'extrusion' ? o : o?.primitive?.operators?.[0]);
  return gen ? { length: gen.val('length'), subdivu: gen.val('subdivu'), subdivv: gen.val('subdivv'), alongz: gen.val('alongz'), alongy: gen.val('alongy'), type: gen.type } : null;
});
check('Extrusion Softimage defaults', !String(extrude).startsWith('ERR') && ev && Number(ev.length) === 10 && Number(ev.subdivu) === 10 && ev.alongz === true && ev.alongy === false, JSON.stringify(ev));

await run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'c1' });
await run('Translate', { X: 0 });
await run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'c2' });
await run('Translate', { Y: 4 });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'c1,c2' }));
const loft = await run('ApplyGenOp', { PresetObj: 'Loft', Target: 'NurbsSurface' });
const lv = await p.evaluate(() => {
  const sel = window.Application.selectedObjects[0];
  const gen = sel?.type === 'loft' ? sel : [...window.Application.scene.allObjects()].map(x => x.primitive?.operators?.[0]).find(op => op?.type === 'loft');
  return gen ? { subdivu: gen.val('subdivu'), subdivv: gen.val('subdivv'), startscl: gen.val('startscl') } : null;
});
check('Loft Softimage defaults', !String(loft).startsWith('ERR') && lv && Number(lv.subdivu) === 10 && Number(lv.subdivv) === 10 && Number(lv.startscl) === 1, JSON.stringify(lv));

await run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'rev' });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'rev' }));
const rev = await run('ApplyGenOp', { PresetObj: 'RevolutionAroundAxis', Target: 'NurbsSurface' });
const rv = await p.evaluate(() => {
  const sel = window.Application.selectedObjects[0];
  const gen = sel?.type === 'revolution' ? sel : [...window.Application.scene.allObjects()].map(x => x.primitive?.operators?.[0]).find(op => op?.type === 'revolution');
  return gen ? { ang: gen.val('ang'), revy: gen.val('revy'), revx: gen.val('revx') } : null;
});
check('Revolution Softimage defaults', !String(rev).startsWith('ERR') && rv && Number(rv.ang) === 360 && rv.revy === true && rv.revx === false, JSON.stringify(rv));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (pageErrs.length) console.log('page errors', pageErrs);
await b.close();
process.exit(failed.length ? 1 : 0);
