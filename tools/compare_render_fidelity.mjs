// Softimage Direct vs PC Render dumps (prefs / material / passes / region / framebuffer).
// Dump-backed only. Region HWND/crop LOCK when Softimage paths null.
// Needs vite preview on :4173. Usage: node tools/compare_render_fidelity.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/local/bin/google-chrome',
  '/opt/google/chrome/chrome',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium; set PW_CHROME'); process.exit(2); }

const store = '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/render';
const dump = (name) => {
  const paths = [
    path.resolve(__dirname, '../data/dump/' + name),
    path.join(store, name),
    '/cursor/stores/self/internal/softimage-pc-dumps/render/' + name,
  ];
  return paths.find(p => fs.existsSync(p));
};

const prefsPath = dump('si_render_prefs.json');
const matPath = dump('si_render_material_phong.json');
const passPath = dump('si_render_passes.json');
const regionPath = dump('si_render_region.json');
const fbPath = dump('si_render_framebuffer_enums.json');
const deepenPath = dump('si_render_prefs_region_deepen.json');
const beyondPath = dump('materials_beyond_phong.json');
const miaUnlockPath = dump('si_render_mia_unlock.json') || dump('unlock_render_mia_probe.json');
const wrapEnumPath = dump('si_render_wrap_enum.json') || dump('unlock_render_wrap_enum_probe.json');
const toolbarChromePath = dump('si_render_toolbar_chrome.json');
const catsPath = [
  path.resolve(__dirname, '../data/dump/si_preference_categories.json'),
  '/cursor/stores/self/internal/softimage-pc-dumps/unlock/unlock_all_remaining.json',
  '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/internal/softimage-pc-dumps/unlock/unlock_all_remaining.json',
].find(p => fs.existsSync(p));
for (const [n, p] of [['prefs', prefsPath], ['material', matPath], ['passes', passPath], ['region', regionPath], ['framebuffer', fbPath], ['beyond', beyondPath], ['preference_categories', catsPath], ['mia_unlock', miaUnlockPath], ['wrap_enum', wrapEnumPath], ['toolbar_chrome', toolbarChromePath]]) {
  if (!p) { console.error('missing dump ' + n); process.exit(2); }
}

const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
const mat = JSON.parse(fs.readFileSync(matPath, 'utf8'));
const passes = JSON.parse(fs.readFileSync(passPath, 'utf8'));
const region = JSON.parse(fs.readFileSync(regionPath, 'utf8'));
const fb = JSON.parse(fs.readFileSync(fbPath, 'utf8'));
const deepen = deepenPath ? JSON.parse(fs.readFileSync(deepenPath, 'utf8')) : null;
const beyond = JSON.parse(fs.readFileSync(beyondPath, 'utf8'));
const catsRaw = JSON.parse(fs.readFileSync(catsPath, 'utf8'));
const pcCats = catsRaw.categories
  || catsRaw.locks?.['render.preference_categories']?.detail?.sample_keys
  || catsRaw.sample_keys
  || [];
const pcSample = catsRaw.sample_keys
  || catsRaw.locks?.['render.preference_categories']?.detail?.sample_keys
  || pcCats.slice(0, 30);

const diffs = [];
const notes = [];
notes.push(`loaded prefs ${prefsPath}`);
notes.push(`softimage ${prefs.meta?.softimage}`);

const sceneRO = prefs.render_options_paths?.find(x => x.path === 'Passes.RenderOptions' && x.found);
if (!sceneRO?.params_map) diffs.push('PC Passes.RenderOptions missing');
else {
  notes.push(`PC SceneRenderProperty renderer=${sceneRO.params_map.renderer} ${sceneRO.params_map.imagewidth}x${sceneRO.params_map.imageheight}`);
}

const b = await chromium.launch({ executablePath: CHROME, args: ['--headless=new', '--use-gl=swiftshader'] });
const page = await b.newPage();
await page.goto(process.env.SI_URL || 'http://localhost:4173/?demo');
await page.waitForTimeout(1000);
await page.evaluate(() => { window.prompt = (_m, d) => d ?? 'Pass'; window.confirm = () => true; });

const r = await page.evaluate(() => {
  const A = window.Application;
  A.run('NewScene');
  const ro = A.scene.renderOptions;
  const roMap = {};
  if (ro) for (const p of ro.params) roMap[p.name.toLowerCase()] = p.value;

  const defPass = A.scene.passes.find(p => p.name === 'Default_Pass') || A.scene.passes[0];
  const passSnap = (p) => {
    const mr = p.mentalray;
    const mrVals = {};
    if (mr?.params) for (const pp of mr.params) mrVals[pp.name] = pp.value;
    return {
      name: p.name,
      type: p.type,
      classname: p.type,
      FrameStart: p.val('FrameStart'),
      FrameEnd: p.val('FrameEnd'),
      ImageWidth: p.val('ImageWidth'),
      ImageHeight: p.val('ImageHeight'),
      Camera: p.val('Camera'),
      mentalray: mr ? {
        name: mr.name,
        type: mr.type,
        n: mr.params?.length ?? 0,
        vals: mrVals,
      } : null,
      partitions: (p.partitions || []).map(x => ({
        name: x.name, type: x.type,
        labels: Object.fromEntries(x.params.map(pp => [pp.name, pp.label])),
        viewvis: x.val('viewvis'), rendvis: x.val('rendvis'),
      })),
      framebuffers: (p.framebuffers || []).map(f => ({
        name: f.name, type: f.type,
        Format: f.val('Format'), DataType: f.val('DataType'), BitDepth: f.val('BitDepth'),
        Filename: f.val('Filename'), Enabled: f.val('Enabled'), RenderChannel: f.val('RenderChannel'),
      })),
      // AfterImage Render tab: MovieFormat default mp4; Softimage SPDL had mov+avi (no mov offered)
      MovieFormat: p.val('MovieFormat'),
      MovieCreate: p.val('MovieCreate'),
      movieFormatItems: (p.get('MovieFormat')?.def?.items || []).map(it => ({ label: it.label, value: it.value })),
    };
  };

  const before = A.scene.passes.map(passSnap);
  A.run('CreatePass', { Name: 'Pass' });
  const after = A.scene.passes.map(passSnap);

  // Material / Phong + beyond-Phong stock presets
  A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
  const cube = A.scene.find('cube') || [...A.scene.allObjects()].find(o => /cube/i.test(o.name));
  A.select([cube]);
  try { A.run('SIApplyShader', { PresetObj: 'Phong', InputObjs: [cube] }); } catch (e) {}
  const m = cube?.material || A.scene.materials.find(x => x.name === 'Scene_Material');
  const matLabels = m ? Object.fromEntries(m.params.map(p => [p.name, p.label])) : {};
  const matVals = m ? Object.fromEntries(m.params.map(p => [p.name, p.value])) : {};
  const surf = m?.surface;
  const shVals = {};
  const shLabels = {};
  if (surf) {
    for (const p of surf.params) { shVals[p.name] = p.value; shLabels[p.name] = p.label; }
  }
  const phongConnections = m?.portConnections
    ? Object.fromEntries([...m.portConnections.entries()])
    : {};

  const snapShader = (preset) => {
    A.run('NewScene');
    A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const c = A.scene.find('cube') || [...A.scene.allObjects()].find(o => /cube/i.test(o.name));
    A.select([c]);
    let err = null;
    try { A.run('SIApplyShader', { PresetObj: preset, InputObjs: [c] }); } catch (e) { err = String(e?.message || e); }
    const mm = c?.material;
    const ss = mm?.surface;
    const vals = {};
    if (ss) for (const p of ss.params) vals[p.name] = p.value;
    const can = A.commands.get('SIApplyShader')?.canRun?.({ PresetObj: preset, InputObjs: [c] });
    return {
      preset,
      err,
      canRun: can !== false,
      matType: mm?.type,
      shType: ss?.type,
      vals,
      connections: mm?.portConnections ? Object.fromEntries([...mm.portConnections.entries()]) : {},
      matLabels: mm ? Object.fromEntries(mm.params.map(p => [p.name, p.label])) : {},
    };
  };

  const beyondOk = ['Phong', 'Blinn', 'Lambert', 'Constant', 'Cooktorrance', 'Strauss', 'Anisotropic'];
  // unlock render.mia_architectural_metallic + Car_Paint — absolute .Preset + Softimage aliases
  const miaAbs = 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2\\Data\\DSPresets\\Shaders\\Material\\mental images\\mia_Material.Preset';
  const carPaintAbs = 'C:\\Program Files\\Autodesk\\Softimage 2015 SP2\\Data\\DSPresets\\Shaders\\Material\\mental images\\Car_Paint.Preset';
  const miaUnlockPresets = [
    'Architectural',
    'mia_Material',
    'mia_Material_MultiOutput',
    'mi_Metallic_Paint',
    'Car Paint',
    'Car_Paint',
    miaAbs,
    carPaintAbs,
    '$XSI_DSPRESETS\\Shaders\\Material\\mental images\\mia_Material.Preset',
    '$XSI_DSPRESETS\\Shaders\\Material\\mental images\\Car_Paint.Preset',
  ];
  const beyondFail = [];
  const beyondSnaps = {};
  for (const p of beyondOk) beyondSnaps[p] = snapShader(p);
  const miaSnaps = {};
  for (const p of miaUnlockPresets) miaSnaps[p] = snapShader(p);
  const lockSnaps = {};
  for (const p of beyondFail) lockSnaps[p] = snapShader(p);

  // wrapu/wrapv enum UI (C3DMaterial.spdl Combo)
  const wrapParam = m?.params?.find?.(p => p.name === 'wrapu');
  const wrapEnumItems = (wrapParam?.def?.items || []).map(it => ({ label: it.label, value: it.value }));

  // render toolbar PE W/H audit + Softimage OM scripting-name inventory + region HWND crop
  let renderToolbarChrome = null;
  let renderToolbarOm = null;
  let renderRegionHwnd = null;
  let renderDesktopMcp = null;
  try {
    const audit = (window).__uiAudit?.() ?? null;
    renderToolbarChrome = audit?.renderToolbarChrome ?? null;
    renderToolbarOm = audit?.renderToolbarOm ?? null;
    renderRegionHwnd = audit?.renderRegionHwnd ?? null;
  } catch (e) {}
  // Desktop tour MCP tops (08-after-key3) — Pass head = current pass name; Get>Shader grey
  try {
    if (A.module !== 'Render') { A.module = 'Render'; A.events.emit('module'); }
    const passBtn = document.querySelector('.toolbar-panel.Render button.tb-btn[data-si-pass-head="1"]');
    const shaderBtn = document.querySelector('.toolbar-panel.Render button.tb-btn[data-si-get-shader="1"]');
    const groups = [...document.querySelectorAll('.toolbar-panel.Render .tb-group')].map(g => g.textContent.trim());
    const btns = [...document.querySelectorAll('.toolbar-panel.Render button.tb-btn')].map(b => b.textContent.trim());
    // Modify > Materials stays enabled (shares OpenMaterialLibrary with Get>Shader)
    const materialsBtn = [...document.querySelectorAll('.toolbar-panel.Render button.tb-btn')]
      .find(b => b.textContent.trim() === 'Materials');
    // Empty selection → Get>Shader grey (Desktop tour)
    A.select([]);
    A.events.emit('selection');
    const shaderGreyEmpty = !!document.querySelector('.toolbar-panel.Render button.tb-btn[data-si-get-shader="1"]:disabled');
    renderDesktopMcp = {
      groups, btns,
      passHead: passBtn?.textContent?.trim() ?? null,
      module: A.module,
      getShaderDisabledEmpty: shaderGreyEmpty,
      getShaderPresent: !!shaderBtn,
      materialsEnabled: materialsBtn ? !materialsBtn.disabled : null,
    };
  } catch (e) { renderDesktopMcp = { err: String(e?.message || e) }; }

  // Desktop tour Command.Enabled matrix (ScriptingName) — empty scene
  let renderCmdEnabled = null;
  try {
    // Probe registered Softimage ScriptingNames from tour Enabled matrix (CreateFramebuffer still open)
    const probe = ['RenderPass', 'RenderRegionCreate', 'CreatePass', 'SwitchToolbar', 'OpenRenderingPreferences'];
    const enFn = window.__commandEnabled;
    const mxFn = window.__matrixCommandEnabled;
    const got = {};
    for (const n of probe) {
      got[n] = {
        has: A.commands.has(n),
        enabled: typeof enFn === 'function' ? enFn(n) : null,
        matrix: typeof mxFn === 'function' ? mxFn(n) : null,
      };
    }
    const audit = (window).__uiAudit?.() ?? null;
    renderCmdEnabled = {
      probe: got,
      hasRenderDesktopTour: !!audit?.mcpMatrix?.hasRenderDesktopTour,
      mergedCount: audit?.mcpMatrix?.renderDesktopTour?.merged_unique_scriptingnames ?? null,
    };
  } catch (e) { renderCmdEnabled = { err: String(e?.message || e) }; }

  // Softimage RenderRegionCreate + RenderOptionsRegion SPDL OM (HWND crop stays LOCK)
  let regionCreate = null;
  let regionOptions = null;
  try {
    A.run('RenderRegionCreate', { Left: 0.1, Right: 0.9, Top: 0.1, Bottom: 0.9 });
    const prop = A.scene.renderOptionsRegion;
    regionOptions = prop ? Object.fromEntries(prop.params.map(p => [p.name, { label: p.label, value: p.value }])) : null;
    regionCreate = {
      hasCreate: A.commands.has('RenderRegionCreate'),
      hasClose: A.commands.has('RenderRegionClose'),
      hasSwitchToolbar: A.commands.has('SwitchToolbar'),
      after: (window).__siRenderRegion ? {
        open: (window).__siRenderRegion.open,
        left: (window).__siRenderRegion.left,
        right: (window).__siRenderRegion.right,
        top: (window).__siRenderRegion.top,
        bottom: (window).__siRenderRegion.bottom,
      } : null,
    };
  } catch (e) {
    regionCreate = { err: String(e?.message || e) };
  }

  // Prefs rendering page via preferenceSets when available
  let renderPrefs = A.renderPrefs || null;
  try {
    const sets = window.__prefSets;
    if (sets?.get) {
      const set = sets.get('C3DPrefsRendering');
      if (set) {
        renderPrefs = {
          renderer: set.val('renderer'),
          output_directory: set.val('output_directory'),
          output_filename: set.val('output_filename'),
          region_refresh_mode: set.val('region_refresh_mode'),
          region_display_mode: set.val('region_display_mode'),
          region_auto_refresh: set.val('region_auto_refresh'),
        };
      }
    }
  } catch (e) {}

  // Softimage Application.Preferences.Categories (unlock_all_remaining UNLOCK_CANDIDATE)
  let preferenceCategories = null;
  try {
    const cats = A.Preferences?.Categories;
    if (cats == null) preferenceCategories = { null: true };
    else {
      const keys = [];
      if (typeof cats[Symbol.iterator] === 'function') {
        for (const c of cats) keys.push(String(c?.FullName ?? c?.Name ?? c));
      } else if (typeof cats.toArray === 'function') {
        for (const c of cats.toArray()) keys.push(String(c?.FullName ?? c?.Name ?? c));
      } else if (typeof cats.Count === 'number') {
        for (let i = 0; i < cats.Count; i++) {
          const c = cats.Item ? cats.Item(i) : cats(i);
          keys.push(String(c?.FullName ?? c?.Name ?? c));
        }
      }
      const lookupRendering = cats('preferences.rendering') || cats.Item?.('preferences.rendering');
      preferenceCategories = {
        null: false,
        type: typeof cats,
        Count: cats.Count ?? keys.length,
        keys,
        sample: keys.slice(0, 30),
        has_rendering: !!(lookupRendering && String(lookupRendering.FullName || lookupRendering) === 'preferences.rendering'),
        nesting_ok: keys.every(k => typeof k === 'string' && k.startsWith('preferences.')),
      };
    }
  } catch (e) {
    preferenceCategories = { null: true, err: String(e?.message || e) };
  }

  return {
    roMap, before, after, nBefore: before.length, nAfter: after.length,
    matType: m?.type, matLabels, matVals,
    shType: surf?.type, shVals, shLabels,
    phongConnections,
    beyondSnaps, miaSnaps, lockSnaps,
    wrapEnumItems,
    wrapuType: wrapParam?.def?.type,
    renderToolbarChrome,
    renderToolbarOm,
    renderRegionHwnd,
    renderDesktopMcp,
    renderCmdEnabled,
    regionCreate,
    regionOptions,
    renderPrefs,
    preferenceCategories,
    sceneMat: A.scene.materials[0]?.name,
  };
});

await b.close();

// ---- Prefs / Scene Render Options ----
const wantRO = sceneRO.params_map;
const roKeys = ['renderer', 'outputdir', 'framepadding', 'imagewidth', 'imageheight', 'imageaspectratio', 'imagepixelratio', 'imagelockaspectratio', 'framerangesource', 'framestart', 'frameend', 'framestep', 'fieldenable', 'motionblurshutterspeed', 'motionblurdeformation'];
for (const k of roKeys) {
  const pc = wantRO[k];
  const d = r.roMap[k];
  if (d === undefined) { diffs.push(`Direct SceneRenderOptions missing ${k}`); continue; }
  if (typeof pc === 'number') {
    if (Math.abs(Number(d) - Number(pc)) > 1e-5) diffs.push(`RO ${k} Direct=${d} PC=${pc}`);
  } else if (String(d) !== String(pc)) {
    diffs.push(`RO ${k} Direct=${d} PC=${pc}`);
  } else notes.push(`RO ${k}=${d}`);
}
if (r.renderPrefs) {
  if (r.renderPrefs.renderer !== 'Mental Ray' && r.renderPrefs.renderer !== wantRO.renderer)
    diffs.push(`renderPrefs.renderer ${r.renderPrefs.renderer}`);
  else notes.push(`renderPrefs.renderer=${r.renderPrefs.renderer}`);
  if (Number(r.renderPrefs.region_display_mode) !== 1 && r.renderPrefs.region_display_mode != null)
    notes.push(`region_display_mode=${r.renderPrefs.region_display_mode} (SPDL default 1)`);
}

// ---- Preferences.Categories (unlock: non-null; attested keys only — no invent HWND) ----
notes.push(`loaded preference_categories ${catsPath}`);
if (!pcCats.length) diffs.push('PC preference_categories empty');
if (!r.preferenceCategories || r.preferenceCategories.null) {
  diffs.push('Direct Preferences.Categories null (PC unlock flipped this)');
} else {
  notes.push(`Preferences.Categories Count=${r.preferenceCategories.Count} type=${r.preferenceCategories.type}`);
  if (!r.preferenceCategories.nesting_ok)
    diffs.push('Preferences.Categories nesting: expected preferences.<leaf> FullNames only');
  for (const k of pcSample) {
    if (!r.preferenceCategories.keys.includes(k))
      diffs.push(`Preferences.Categories missing sample key ${k}`);
  }
  if (pcSample.length && pcSample.every(k => r.preferenceCategories.keys.includes(k)))
    notes.push(`Preferences.Categories sample_keys OK n=${pcSample.length}`);
  for (const k of pcCats) {
    if (!r.preferenceCategories.keys.includes(k))
      diffs.push(`Preferences.Categories missing attested key ${k}`);
  }
  if (r.preferenceCategories.keys.length !== pcCats.length)
    diffs.push(`Preferences.Categories Count Direct=${r.preferenceCategories.keys.length} PC=${pcCats.length}`);
  else notes.push(`Preferences.Categories full list OK n=${pcCats.length}`);
  if (!r.preferenceCategories.has_rendering)
    diffs.push('Preferences.Categories("preferences.rendering") lookup failed');
  else notes.push('Categories("preferences.rendering") OK');
}

// ---- Passes ----
const pcBefore = passes.before?.passes || [];
if (pcBefore.length !== 1) diffs.push(`PC before passes ${pcBefore.length}`);
if (r.nBefore !== 1) diffs.push(`Direct before passes ${r.nBefore}`);
else {
  const dp = r.before[0];
  if (dp.name !== 'Default_Pass') diffs.push(`Default_Pass name ${dp.name}`);
  if (dp.type !== 'Pass' && dp.classname !== 'Pass') diffs.push(`Default_Pass type ${dp.type}`);
  if (Number(dp.ImageWidth) !== 1920 || Number(dp.ImageHeight) !== 1080) diffs.push(`Default_Pass size ${dp.ImageWidth}x${dp.ImageHeight}`);
  const partNames = dp.partitions.map(p => p.name).sort();
  const wantParts = ['Background_Lights_Partition', 'Background_Objects_Partition'];
  if (JSON.stringify(partNames) !== JSON.stringify(wantParts)) diffs.push(`partitions ${partNames}`);
  else notes.push('Default_Pass partitions OK');
  for (const part of dp.partitions) {
    if (part.viewvis !== 2 || part.rendvis !== 2) diffs.push(`partition ${part.name} vis ${part.viewvis}/${part.rendvis}`);
    if (part.labels.viewvis !== 'View Visibility') diffs.push(`partition label viewvis ${part.labels.viewvis}`);
  }
}
if (passes.after_create?.passes?.length !== 2) notes.push(`PC after CreatePass n=${passes.after_create?.passes?.length}`);
if (r.nAfter !== 2) diffs.push(`Direct after CreatePass n=${r.nAfter}`);
else {
  const names = r.after.map(p => p.name).sort();
  if (!names.includes('Default_Pass') || !names.includes('Pass')) diffs.push(`after names ${names}`);
  else notes.push('CreatePass → Pass OK');
}

// ---- Framebuffer ----
const pcFb = fb.framebuffers?.[0]?.buffers?.[0]?.params_map;
const dFb = r.before[0]?.framebuffers?.[0];
if (!pcFb) diffs.push('PC Main framebuffer missing');
if (!dFb) diffs.push('Direct Main framebuffer missing');
else {
  for (const [k, pk] of [['Format', 'format'], ['DataType', 'datatype'], ['Filename', 'filename'], ['RenderChannel', 'renderchannel']]) {
    if (String(dFb[k]) !== String(pcFb[pk])) diffs.push(`FB ${k} Direct=${dFb[k]} PC=${pcFb[pk]}`);
  }
  if (Number(dFb.BitDepth) !== Number(pcFb.bitdepth)) diffs.push(`FB BitDepth ${dFb.BitDepth}`);
  if (dFb.Enabled !== true) diffs.push(`FB Enabled ${dFb.Enabled}`);
  if (dFb.type !== 'Framebuffer') diffs.push(`FB type ${dFb.type}`);
  notes.push(`FB Main format=${dFb.Format} DataType=${dFb.DataType}`);
}

// ---- AfterImage Render output upgrades (mp4 default, no mov; Softimage FB Format stays pic) ----
{
  const mf = r.before?.[0]?.MovieFormat;
  const items = r.before?.[0]?.movieFormatItems || [];
  if (String(mf) !== 'mp4') diffs.push(`Pass MovieFormat Direct=${mf} want mp4`);
  else notes.push('Pass MovieFormat=mp4 (AfterImage default)');
  if (items.some(it => String(it.value) === 'mov' || /quicktime/i.test(String(it.label))))
    diffs.push(`Pass MovieFormat still offers mov: ${JSON.stringify(items)}`);
  else if (!items.some(it => String(it.value) === 'mp4'))
    diffs.push(`Pass MovieFormat missing mp4: ${JSON.stringify(items)}`);
  else notes.push('Pass MovieFormat items mp4+avi, no mov');
  const propsets = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/si/propsets.json'), 'utf8'));
  const picStd = (propsets.C3DPrefsOutputFormat?.params || []).find(p => p.sn === 'picture_standard');
  const ids = new Set((picStd?.items || []).map(it => it[1]));
  if (!ids.has(23) || !ids.has(24)) diffs.push(`Output Format picture_standard missing 2K/4K (23/24); got ${[...ids].sort((a, b) => a - b)}`);
  else notes.push('Output Format picture_standard includes 2K (23) + 4K (24)');
  const xres = (propsets.C3DPrefsOutputFormat?.params || []).find(p => p.sn === 'ir_xres');
  if (Number(xres?.uimax) < 3840) diffs.push(`ir_xres uimax ${xres?.uimax} too low for 4K`);
  else notes.push(`ir_xres uimax=${xres.uimax}`);
}

// ---- Material Phong ----
if (!mat.material_apply_ok && mat.steps?.find(s => s.name === 'ApplyPhong' && !s.ok)) notes.push('PC Phong apply had issues; still check Scene_Material/shaders');
const pcSh = mat.material?.shaders?.[0]?.params_map || mat.scene_material?.shaders?.[0]?.params_map;
if (!pcSh) diffs.push('PC Phong shader params_map missing');
else {
  if (Number(r.shVals.shiny) !== Number(pcSh.shiny)) diffs.push(`Phong shiny Direct=${r.shVals.shiny} PC=${pcSh.shiny}`);
  else notes.push(`Phong shiny=${r.shVals.shiny}`);
  for (const flag of ['diffuse_inuse', 'specular_inuse', 'reflect_inuse', 'refract_inuse', 'incand_inuse', 'translucent_inuse']) {
    if (pcSh[flag] != null && r.shVals[flag] !== pcSh[flag] && r.shVals[flag] !== undefined)
      diffs.push(`Phong ${flag} Direct=${r.shVals[flag]} PC=${pcSh[flag]}`);
  }
}
// Parameter.Name labels on Material
const wantMatLabels = {
  Name: 'Name', wrapu: 'Wrap U', wrapv: 'Wrap V', envmode: 'Mode',
  surface: 'surface', shadow: 'shadow', photon: 'photon',
  TrackedShader: 'Shader', ImageClipName: 'Image Clip[2]',
};
for (const [sn, lab] of Object.entries(wantMatLabels)) {
  if (r.matLabels[sn] !== lab) diffs.push(`Material.${sn} label Direct=${r.matLabels[sn]} want ${lab}`);
}
if (r.matType !== 'Material') diffs.push(`Material type ${r.matType}`);
else notes.push('Material classname Material');
if (Number(r.matVals.wrapu) !== 10497 || Number(r.matVals.wrapv) !== 10497)
  diffs.push(`Material wrap Direct ${r.matVals.wrapu}/${r.matVals.wrapv} PC 10497`);
else notes.push('Material wrapu/wrapv=10497');
// unlock render.wrapu_wrapv_enum_ui — Combo Clamp/Repeat from C3DMaterial.spdl
const wrapDump = JSON.parse(fs.readFileSync(wrapEnumPath, 'utf8'));
const wantWrapItems = (wrapDump.items || wrapDump.spdl_attested?.labels?.map((lab, i) => ({
  label: lab,
  value: lab === 'Clamp' ? 10496 : 10497,
})) || [
  { label: 'Clamp', value: 10496 },
  { label: 'Repeat', value: 10497 },
]);
if (r.wrapuType !== 'enum') diffs.push(`Material.wrapu type ${r.wrapuType} want enum`);
else notes.push('Material.wrapu type=enum');
const gotWrap = JSON.stringify(r.wrapEnumItems || []);
const wantWrap = JSON.stringify(wantWrapItems.map(it => ({ label: it.label, value: it.value })));
if (gotWrap !== wantWrap) diffs.push(`Material.wrapu items ${gotWrap} want ${wantWrap}`);
else notes.push('Material wrapu/wrapv Combo Clamp/Repeat OK');

// Softimage connects surface/shadow/photon → shader.out (materials_beyond_phong)
for (const port of ['surface', 'shadow', 'photon']) {
  if (r.phongConnections?.[port] !== 'out')
    diffs.push(`Material connection ${port} Direct=${r.phongConnections?.[port]} want out`);
}
if (r.phongConnections?.surface === 'out') notes.push('Material connections surface/shadow/photon→out');

// ---- Materials beyond Phong (dump-backed) ----
const approxEq = (a, b, eps = 1e-3) => {
  if (a === b) return true;
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= eps;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length, 3);
    for (let i = 0; i < n; i++) if (Math.abs(Number(a[i]) - Number(b[i])) > eps) return false;
    return true;
  }
  return String(a) === String(b);
};
const skipSn = new Set(['name', 'lights', 'out', 'bump', 'ambience', 'mode']);
const keyScalars = {
  Phong: ['shiny', 'diffuse_inuse', 'specular_inuse', 'index_of_refraction'],
  Blinn: ['roughness', 'ior', 'specular_inuse', 'diffuse_inuse'],
  Lambert: ['diffuse_inuse', 'reflect_inuse', 'index_of_refraction', 'trans_glossy'],
  Constant: ['color', 'transp'],
  Cooktorrance: ['roughness', 'ior', 'specular_inuse'],
  Strauss: ['smoothness', 'metalness', 'diffuse_inuse'],
  Anisotropic: ['shiny_u', 'shiny_v', 'surfderiv_mode', 'specular_inuse'],
};
const wantType = {
  Phong: 'Phong', Blinn: 'Blinn', Lambert: 'Lambert', Constant: 'Constant',
  Cooktorrance: 'Cooktorrance', Strauss: 'Strauss', Anisotropic: 'Anisotropic',
};
const pcOk = beyond.summary?.ok || [];
const pcFail = beyond.summary?.fail || [];
if (JSON.stringify(pcOk) !== JSON.stringify(['Phong', 'Blinn', 'Lambert', 'Constant', 'Cooktorrance', 'Strauss', 'Anisotropic']))
  notes.push(`PC summary.ok=${JSON.stringify(pcOk)}`);
for (const label of pcOk) {
  const row = beyond.materials?.[label];
  const pcParams = row?.assigned?.shaders?.[0]?.params;
  const snap = r.beyondSnaps?.[label];
  if (!row?.apply?.ok) { diffs.push(`PC ${label} apply not ok`); continue; }
  if (!snap || snap.err) { diffs.push(`Direct ${label} apply err=${snap?.err}`); continue; }
  if (snap.matType !== 'Material') diffs.push(`Direct ${label} matType ${snap.matType}`);
  if (snap.shType !== wantType[label]) diffs.push(`Direct ${label} shType ${snap.shType} want ${wantType[label]}`);
  if (!pcParams) { diffs.push(`PC ${label} shader params missing`); continue; }
  for (const sn of (keyScalars[label] || [])) {
    if (!(sn in pcParams) || pcParams[sn] == null) continue;
    if (!(sn in snap.vals)) { diffs.push(`${label} missing param ${sn}`); continue; }
    if (!approxEq(snap.vals[sn], pcParams[sn]))
      diffs.push(`${label}.${sn} Direct=${JSON.stringify(snap.vals[sn])} PC=${JSON.stringify(pcParams[sn])}`);
  }
  // Connection ports on every stock material
  for (const port of ['surface', 'shadow', 'photon']) {
    if (snap.connections?.[port] !== 'out')
      diffs.push(`${label} connection ${port}=${snap.connections?.[port]}`);
  }
  // Material Parameter.Name for connection slots
  if (snap.matLabels?.surface !== 'surface') diffs.push(`${label} Material.surface label ${snap.matLabels?.surface}`);
  notes.push(`${label} OM OK type=${snap.shType}`);
}
// unlock render.mia_architectural_metallic — absolute .Preset + SIApplyShader nested OM
const miaUnlock = JSON.parse(fs.readFileSync(miaUnlockPath, 'utf8'));
const miaPresets = miaUnlock.presets || {};
const miaWant = {
  Architectural: 'mia_Material',
  mia_Material: 'mia_Material',
  mia_Material_MultiOutput: 'mia_Material_MultiOutput',
  mi_Metallic_Paint: 'mi_Metallic_Paint',
  'Car Paint': 'Car_Paint',
  Car_Paint: 'Car_Paint',
};
for (const [label, wantType] of Object.entries(miaWant)) {
  const snap = r.miaSnaps?.[label];
  if (!snap || snap.err) { diffs.push(`mia unlock ${label} err=${snap?.err}`); continue; }
  if (!snap.canRun) diffs.push(`mia unlock ${label} canRun false`);
  if (snap.shType !== wantType) diffs.push(`mia unlock ${label} shType ${snap.shType} want ${wantType}`);
  const pcParams = miaPresets[wantType]?.params || Object.fromEntries((miaPresets[wantType]?.defs || []).map(d => [d.sn, d.type === 'color' ? d.value_rgba ?? d.value : d.value]));
  const nParams = snap.vals ? Object.keys(snap.vals).length : 0;
  const wantCount = miaPresets[wantType]?.param_count || miaPresets[wantType]?.defs?.length;
  if (wantCount && nParams !== wantCount) diffs.push(`mia unlock ${label} param_count ${nParams} want ${wantCount}`);
  // Key attested scalars from nested OM
  for (const sn of ['diffuse_weight', 'reflectivity', 'mode', 'spec_weight', 'base_color'].filter(k => k in (pcParams || {}))) {
    if (!(sn in snap.vals)) { diffs.push(`mia unlock ${label} missing ${sn}`); continue; }
    if (!approxEq(snap.vals[sn], Array.isArray(pcParams[sn]) ? pcParams[sn].slice(0, 3) : pcParams[sn]))
      diffs.push(`mia unlock ${label}.${sn} Direct=${JSON.stringify(snap.vals[sn])} PC=${JSON.stringify(pcParams[sn])}`);
  }
  notes.push(`mia unlock ${label} OK type=${snap.shType} n=${nParams}`);
}
// Absolute / $XSI_DSPRESETS paths must resolve to dump-proven shader ScriptName
for (const key of Object.keys(r.miaSnaps || {})) {
  if (!/[\\/]|\.Preset|\$XSI_DSPRESETS/i.test(key)) continue;
  const snap = r.miaSnaps[key];
  const want = /Car_Paint\.Preset/i.test(key) ? 'Car_Paint' : 'mia_Material';
  if (snap?.err || snap?.shType !== want) diffs.push(`mia abs path ${key} → ${snap?.shType} want ${want} err=${snap?.err}`);
  else notes.push(`mia abs PresetObj OK → ${want}`);
}
// Car Paint LOCK carve-out cleared — closer95 absolute SIApplyShader + model nested OM
if (Object.keys(r.lockSnaps || {}).length) diffs.push(`unexpected lockSnaps ${Object.keys(r.lockSnaps)}`);
else notes.push('Car Paint LOCK carve-out cleared');
if (pcFail?.length) notes.push(`PC FAIL (short-name era) ${pcFail.join(',')}`);
notes.push(`beyond dump ${beyondPath}`);
notes.push(`mia unlock dump ${miaUnlockPath}`);

// unlock render.toolbar_pixel_chrome — PE BITMAP W/H only
const tbDump = JSON.parse(fs.readFileSync(toolbarChromePath, 'utf8'));
const tbAudit = r.renderToolbarChrome;
if (!tbAudit) diffs.push('renderToolbarChrome audit missing');
else {
  if (tbAudit.toolbarCellWh?.w !== 22 || tbAudit.toolbarCellWh?.h !== 22)
    diffs.push(`render toolbar cell ${JSON.stringify(tbAudit.toolbarCellWh)} want 22x22`);
  else notes.push('render toolbar cell 22x22');
  if (!tbAudit.toolbarCellOk) diffs.push('render toolbarCellOk false');
  if (Number(tbAudit.bitmapWhCount) !== Number(tbDump.bitmapWhCount))
    diffs.push(`render bitmapWhCount ${tbAudit.bitmapWhCount} want ${tbDump.bitmapWhCount}`);
  else notes.push(`render bitmapWhCount=${tbAudit.bitmapWhCount}`);
  if (tbAudit.eyeChromeBeyondWh !== 'LOCK') diffs.push(`render eye chrome status ${tbAudit.eyeChromeBeyondWh}`);
  else notes.push('render eye chrome beyond W/H LOCK');
}

// ---- Region LOCK (HWND) + SPDL/OM wire ----
const regionFound = (region.probes || []).some(p => p.path?.includes('RenderRegion') && p.found);
const regionCmds = Object.values(region.commands || {}).some(c => c.found);
if (regionFound || regionCmds) {
  diffs.push('PC region HWND/commands unexpectedly attested — reopen Direct region wire');
} else {
  notes.push('LOCK: Camera.RenderRegion + short region cmds null (no invent HWND/crop)');
}
// Softimage RenderOptionsRegion.spdl OM params (UsePassOptions + Region* MetaData)
const wantRegionParams = ['UsePassOptions', 'RegionOffsetX', 'RegionOffsetY', 'RegionWidth', 'RegionHeight'];
if (!r.regionOptions) diffs.push('Direct renderOptionsRegion missing');
else {
  for (const sn of wantRegionParams) {
    if (!(sn in r.regionOptions)) diffs.push(`renderOptionsRegion missing ${sn}`);
  }
  if (r.regionOptions.UsePassOptions?.label !== 'Use Current Pass Options')
    diffs.push(`UsePassOptions label ${r.regionOptions.UsePassOptions?.label}`);
  else notes.push('RenderOptionsRegion UsePassOptions OK');
  if (r.regionOptions.RegionOffsetX?.label !== 'Offset X')
    diffs.push(`RegionOffsetX label ${r.regionOptions.RegionOffsetX?.label}`);
  else notes.push('RenderOptionsRegion Region* labels OK');
}
// Softimage RenderRegionCreate defaults from commands_full (normalized fractions, not HWND px)
if (!r.regionCreate?.hasCreate) diffs.push('RenderRegionCreate missing');
else if (r.regionCreate.err) diffs.push(`RenderRegionCreate ${r.regionCreate.err}`);
else {
  const a = r.regionCreate.after;
  if (!a?.open) diffs.push('RenderRegionCreate did not open region');
  if (Math.abs(Number(a?.left) - 0.1) > 1e-5 || Math.abs(Number(a?.right) - 0.9) > 1e-5)
    diffs.push(`RenderRegionCreate L/R ${a?.left}/${a?.right} want 0.1/0.9`);
  else notes.push('RenderRegionCreate LRTB Softimage defaults OK');
}
if (!r.regionCreate?.hasClose) diffs.push('RenderRegionClose missing');
else notes.push('RenderRegionClose OK');
if (!r.regionCreate?.hasSwitchToolbar) diffs.push('SwitchToolbar missing');
else notes.push('SwitchToolbar OK');

// Softimage Render toolbar OM scripting-name inventory
const omAudit = r.renderToolbarOm;
if (!omAudit) diffs.push('renderToolbarOm audit missing');
else if (omAudit.missing?.length) diffs.push(`renderToolbarOm missing ${omAudit.missing.join(',')}`);
else notes.push(`renderToolbarOm scripting names OK n=${omAudit.presentCount}`);
if (omAudit?.hwndCrop !== 'DUMP_READY') diffs.push(`hwndCrop status ${omAudit?.hwndCrop} want DUMP_READY`);
else notes.push('region HWND crop chrome DUMP_READY');
const rrh = r.renderRegionHwnd;
if (!rrh) diffs.push('renderRegionHwnd audit missing');
else if (!rrh.ok) diffs.push(`renderRegionHwnd audit failed ${JSON.stringify(rrh)}`);
else notes.push(`renderRegionHwnd ${rrh.hwndCount}×DsNewRegionButtonCtrl crop ${rrh.cropPng?.join('x')} border ${rrh.borderCss}`);

// Attested region-adjacent: Scene Render Options image size (also in deepen)
const deepenW = deepen?.region_like_params?.imagewidth ?? deepen?.render_options?.params_map?.imagewidth;
if (deepenW != null && Number(r.roMap.imagewidth) !== Number(deepenW))
  diffs.push(`deepen imagewidth Direct=${r.roMap.imagewidth} PC=${deepenW}`);
else if (deepenW != null) notes.push(`deepen region_like imagewidth=${deepenW}`);


// Desktop Render MCP tops + Pass head (tour 08) — no invent HWND
const deskTops = ["Get", "Modify", "Render", "Pass"];
if (!r.renderDesktopMcp || r.renderDesktopMcp.err) diffs.push(`renderDesktopMcp ${r.renderDesktopMcp?.err || "missing"}`);
else {
  for (const g of deskTops) if (!r.renderDesktopMcp.groups.includes(g)) diffs.push(`Render MCP missing group ${g}`);
  if (r.renderDesktopMcp.passHead !== "Default_Pass") diffs.push(`Pass head ${r.renderDesktopMcp.passHead} want Default_Pass`);
  else notes.push("Desktop Pass head Default_Pass OK");
  if (!r.renderDesktopMcp.btns.includes("Regions")) diffs.push("Render MCP missing Regions (PE label)");
  else notes.push("Render MCP Regions PE label OK");
  if (!r.renderDesktopMcp.btns.includes("Ambience")) diffs.push("Render MCP missing Ambience");
  else notes.push("Render MCP Ambience OK");
  // Desktop tour: Get > Shader grey on empty; Modify > Materials stays enabled
  if (!r.renderDesktopMcp.getShaderPresent) diffs.push('Get>Shader button missing');
  else if (!r.renderDesktopMcp.getShaderDisabledEmpty) diffs.push('Get>Shader should be grey on empty selection');
  else notes.push('Get>Shader grey on empty OK');
  if (r.renderDesktopMcp.materialsEnabled === false) diffs.push('Modify>Materials should stay Enabled');
  else if (r.renderDesktopMcp.materialsEnabled === true) notes.push('Modify>Materials Enabled OK');
}

// Passes.Default_Pass.mentalray — Desktop tour 180-param MR PPG
const mrDumpPath = dump('si_render_mentalray_pass.json')
  || path.resolve(__dirname, '../src/data/si/render_mentalray_pass.json');
if (!mrDumpPath) diffs.push('si_render_mentalray_pass.json missing');
else {
  const mrDump = JSON.parse(fs.readFileSync(mrDumpPath, 'utf8'));
  const wantMr = mrDump.params || {};
  const wantN = Object.keys(wantMr).length;
  const gotMr = r.before?.[0]?.mentalray;
  if (!gotMr) diffs.push('Default_Pass.mentalray missing');
  else {
    if (gotMr.n !== wantN) diffs.push(`mentalray param count Direct=${gotMr.n} PC=${wantN}`);
    else notes.push(`Default_Pass.mentalray ${gotMr.n} params OK`);
    for (const k of ['samplesmin', 'samplesmax', 'samplescontrastred', 'scanline', 'indirectillumalgorithm', 'rendertype']) {
      if (wantMr[k] !== undefined && gotMr.vals?.[k] !== wantMr[k]
        && !(typeof wantMr[k] === 'number' && Math.abs(Number(gotMr.vals?.[k]) - Number(wantMr[k])) < 1e-5)) {
        diffs.push(`mentalray.${k} Direct=${gotMr.vals?.[k]} PC=${wantMr[k]}`);
      }
    }
    if (gotMr.type !== 'mentalray' && gotMr.name !== 'mentalray')
      diffs.push(`mentalray type ${gotMr.type}/${gotMr.name}`);
    else notes.push('mentalray Property attached OK');
  }
}

// Desktop tour prefs categories 81/18/9 — propsets already match; attest dump present
const deskPrefsPath = dump('si_render_desktop_prefs.json')
  || path.resolve(__dirname, '../src/data/si/render_desktop_prefs.json');
if (deskPrefsPath) {
  const deskPrefs = JSON.parse(fs.readFileSync(deskPrefsPath, 'utf8'));
  const cats = deskPrefs.categories || {};
  function catParamCount(key) {
    const c = cats[key];
    if (!c) return 0;
    if (c.params && typeof c.params === 'object') return Object.keys(c.params).length;
    return Object.keys(c).filter(k => !['FullName', 'Name', 'fullname', 'classname'].includes(k) && !k.startsWith('_')).length;
  }
  const wantCounts = { 'preferences.rendering': 81, 'preferences.output_format': 18, 'preferences.render_tree': 9 };
  for (const [fn, n] of Object.entries(wantCounts)) {
    if (!cats[fn]) { diffs.push(`desktop prefs missing ${fn}`); continue; }
    const got = catParamCount(fn);
    if (got !== n) diffs.push(`desktop prefs ${fn} n=${got} want ${n}`);
    else notes.push(`desktop prefs ${fn} n=${n} OK`);
  }
} else notes.push('si_render_desktop_prefs.json absent (optional)');

// Desktop tour Command.Enabled + ScriptingName matrix
const cmdEnPath = dump('si_render_desktop_command_enabled.json')
  || path.resolve(__dirname, '../src/data/si/render_desktop_command_enabled.json');
if (!r.renderCmdEnabled || r.renderCmdEnabled.err) diffs.push(`renderCmdEnabled ${r.renderCmdEnabled?.err || 'missing'}`);
else {
  if (!r.renderCmdEnabled.hasRenderDesktopTour) diffs.push('mcp matrix missing render_desktop_tour meta');
  else notes.push(`render desktop tour matrix merged n=${r.renderCmdEnabled.mergedCount}`);
  for (const [n, row] of Object.entries(r.renderCmdEnabled.probe || {})) {
    if (!row.has) diffs.push(`tour cmd missing ${n}`);
    else if (row.matrix !== true && row.enabled !== true) diffs.push(`tour cmd ${n} not Enabled (matrix=${row.matrix} en=${row.enabled})`);
  }
  if (cmdEnPath) {
    const inv = JSON.parse(fs.readFileSync(cmdEnPath, 'utf8'));
    const n = Object.keys(inv.enabled_by_scriptingname || {}).length;
    if (n < 60) diffs.push(`command enabled inventory too small n=${n}`);
    else notes.push(`command Enabled inventory n=${n}`);
  }
}

console.log(JSON.stringify({ ok: diffs.length === 0, diffs, notes: notes.slice(0, 100), softimage: prefs.meta?.softimage }, null, 2));
process.exit(diffs.length ? 1 : 0);
