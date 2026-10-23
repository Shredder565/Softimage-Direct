// Functional checks for the formerly-greyed Model-menu commands. Usage: node tools/model2_check.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(800);
const run = (name, args = {}) => p.evaluate(([n, a]) => { try { const r = window.Application.run(n, a); return r && r.name ? r.name : r && r.then ? 'promise' : String(r); } catch (e) { return 'ERR ' + e.message; } }, [name, args]);
const last = () => p.evaluate(() => window.Application.log.slice(-1)[0]?.text);
const ev = async (fn) => { try { return await p.evaluate(fn); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } };
const out = {};
// preset models (async)
await run('GetPresetModel', { ModelName: 'Bull', Name: 'Bull' }); await p.waitForTimeout(1500);
out.bull = await p.evaluate(() => { const m = window.Application.scene.find('Bull'); const c = m?.children?.[0]; return m ? `${m.name}: ${m.children.length} child, polys=${c?.primitive?.mesh()?.polygons.length}` : 'missing'; });
await run('GetPresetModel', { ModelName: 'Biped_Rig_Generated', Name: 'Biped_Rig' }); await p.waitForTimeout(1500);
out.biped = await p.evaluate(() => { const m = window.Application.scene.find('Biped_Rig'); let n = 0, bones = 0; const walk = o => { n++; if (o.type === 'bone') bones++; o.children.forEach(walk); }; if (m) walk(m); return `${n} objects, ${bones} bones`; });
// NURBS: two surface spheres -> stitch, snap boundary, open/close, snip, fit, fillet
await run('NewScene');
await run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'gridA' }); await run('Translate', { X: -3 });
await run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'NurbsSurface', Name: 'gridB' }); await run('Translate', { X: 5 });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridA,gridB' }));
out.stitch = await run('ApplyTopoOp', { PresetObj: 'SrfStitch' }) + ' | ' + await last();
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridA,gridB' }));
out.snap = await run('ApplySnapFaceOp') + ' | ' + await last();
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridA' }));
out.openclose = await run('ApplyTopoOp', { PresetObj: 'SrfOpenClose' });
out.snip = await run('ApplyTopoOp', { PresetObj: 'Snip' }) + ' objs=' + await p.evaluate(() => [...window.Application.scene.allObjects()].map(o => o.name).join(','));
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridA' }));
out.fit = await run('ApplyGenOp', { PresetObj: 'SrfFit' }) + ' | ' + await last();
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridA,gridB' }));
out.fillet = await run('ApplyGenOp', { PresetObj: 'SrfFillet' }) + ' | ' + await last();
await run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: 'circ' });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridB,circ' }));
out.extend = await run('ApplyTopoOp', { PresetObj: 'CrvExtendTo' }) + ' | ' + await last();
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridB,circ' }));
out.trim = await run('ApplyTopoOp', { PresetObj: 'TrimByProjection' }) + ' polys=' + await p.evaluate(() => window.Application.scene.find('gridB').primitive.mesh().polygons.length);
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'gridB' }));
out.deltrim = await run('ApplyTopoOp', { PresetObj: 'DeleteTrim' }) + ' polys=' + await p.evaluate(() => window.Application.scene.find('gridB').primitive.mesh().polygons.length);
out.contman = await run('ApplyOp', { PresetObj: 'SCMFixer2', ConnectionSet: 'gridB' });
// curve fillet
await run('CreatePrim', { PresetObj: 'Arc', GeometryType: 'NurbsCurve', Name: 'arc' }); await run('Translate', { X: 8 });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'circ,arc' }));
out.crvfillet = await run('ApplyGenOp', { PresetObj: 'CrvFillet' });
// polygon mesh: footprints, user normals, paint, gator, bezier corners
await run('CreatePrim', { PresetObj: 'Grid', GeometryType: 'MeshSurface', Name: 'ground' });
out.footprints = await run('ApplyICEOp', { File: 'Footprints' }) + ' | ' + await last();
await run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'ball' });
out.normals = await run('ResetUserNormals', { ToUser: true }) + ', ' + await run('AverageUserNormals') + ', ' + await run('NormalizeUserNormals') + ', ' + await run('Copy') + ', ' + await p.evaluate(() => { window.Application.run('SelectObj', { InputObjs: 'ball' }); return ''; }) + ', ' + await run('SetUserNormalsSettings');
out.paint = await run('PaintTool') + ' ' + await ev(() => { const t = window.Application.activeTool; t.onPaint([0, 4, 0], null, null, [0, 0, 0]); t.onFinish(); const wm = window.Application.scene.find('ball').property('weightmap'); return wm ? `weights painted: ${[...wm.values.values()].filter(v => v > 0).length}` : 'no weight map'; });
out.push = await run('PaintPushTool') + ' ' + await ev(() => { const t = window.Application.activeTool; const before = window.Application.scene.find('ball').primitive.mesh().positions[1]; t.onPaint([0, 4, 0], null, null, [0, 0, 0]); t.onFinish(); return 'top y ' + before.toFixed(2) + ' -> ' + window.Application.scene.find('ball').primitive.mesh().positions[1].toFixed(2); });
out.vcol = await run('PaintVertexColorTool') + ' ' + await ev(() => { const t = window.Application.activeTool; t.onPaint([0, 4, 0], null, null, [0, 0, 0]); t.onFinish(); return !!window.Application.scene.find('ball').property('vertexcolor'); });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'ground,ball' }));
out.gator = await run('ApplyGenOp', { PresetObj: 'Gator' }) + ' | ' + await last();
await run('CreatePrim', { PresetObj: 'Square', GeometryType: 'NurbsCurve', Name: 'sq' });
out.corners = await run('ApplyTopoOp', { PresetObj: 'Make Bezier-Knots Corners' });
// rigging
await run('GetPrim', { PresetObj: 'Null', Name: 'hip' }); await run('Translate', { Y: 5 }); await run('GetPrim', { PresetObj: 'Null', Name: 'chest' }); await run('Translate', { Y: 9 });
out.spine = await run('CreateSpine', { Hip: 'hip', Chest: 'chest', NumVertebrae: 3 });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'chest' })); out.tail = await run('MakeTail', { NbTailBones: 4 });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'Spine' })); out.ctrl = await run('MakeControlSplines');
// referenced models
await run('CreateModel', { InputObjs: 'ball', Name: 'BallModel' }); await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'BallModel' }));
out.convert = await run('ConvertToRefModel', { FileName: 'BallRef' });
out.res0 = await run('SetResolutionOfRefModels', { resolution: 0 }) + ' children=' + await p.evaluate(() => window.Application.scene.find('BallModel').children.length);
await run('SetResolutionOfRefModels', { resolution: 1 }); await p.waitForTimeout(300); out.res1 = 'children=' + await p.evaluate(() => window.Application.scene.find('BallModel').children.length);
out.delta = await run('AddDelta') + ', ' + await run('CommitToReference') + ', ' + await run('MakeModelLocal');
out.emptyref = await run('CreateEmptyRefModel'); out.importref = await run('ImportRefModels', { FileName: 'Fish' }); await p.waitForTimeout(1200); out.importrefObj = await p.evaluate(() => window.Application.scene.find('Fish')?.children.length);
// misc primitives / shader
out.standin = await run('GetPrim', { PresetObj: 'Stand-in' }); out.geoshader = await run('GetPrim', { PresetObj: 'GeoShader' });
await p.evaluate(() => window.Application.run('SelectObj', { InputObjs: 'ball' })); out.ice = await run('ApplyShader', { PresetObj: 'ICEParticleVolumeShader' }) + ' mat=' + await p.evaluate(() => window.Application.scene.find('ball').material?.surface?.name);
out.lightrig = await run('CreateLightRigFromImage', { Filename: 'si/icons.png', Number_Layers: 2 }); await p.waitForTimeout(800); out.lightrigObjs = await p.evaluate(() => [...window.Application.scene.allObjects()].filter(o => o.type === 'light').length + ' lights');
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(12), v);
console.log('errors', errs);
await b.close();
