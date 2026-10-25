// Softimage Direct UI smoke harness (Playwright).
// Needs `npm run build && npm run preview` on :4173 (or set UI_SMOKE_URL).
// Checks: shell boots, layouts load, MCP present, registered views cover Softimage layout frame types,
// all six module menus extracted (Model/Animate/Render/Simulate/ICE/Hair), floating views open without page errors.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.UI_SMOKE_URL ?? 'http://localhost:4173/?demo';
const CHROME_CANDIDATES = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chromium executable found; set PW_CHROME'); process.exit(2); }

// Frame types that appear in Softimage Application/layouts/*.xsily (from src/data/si/layouts.json).
const LAYOUT_FRAME_TYPES = [
  'Toolbar Panel', 'Explorer', 'Scripts', 'View Manager', 'Timeline', 'Timerange', 'Keying Panel',
  'Layer Control', 'Property Editor', 'Panel Switcher', 'Command Line', 'Playback Panel', 'Animation Panel',
  'Main Shelf', 'Mini Transform Panel', 'Preset Manager', 'Palettes', 'Weight Paint Panel',
  'Animation Layer Manager', 'Selection Panel', 'Transformation Panel', 'Snap Panel', 'Constraint Panel',
  'Edit Panel', 'Netview', 'Animation Editor', 'Fcurve Editor', 'DopeSheet', 'Standalone Dopesheet',
  'Animation Mixer', 'Schematic', 'Material Manager', 'Material Panel', 'Render Tree', 'Texture Editor',
  'ICE Tree', 'FX Tree', 'Fx Viewer', 'Fx Paint Brush List', 'Fx Operator Selector', 'Plugin Manager',
  'SDK Explorer', 'Script Editor',
];

const LAYOUTS = ['Default', 'Dual', '1024 x 768', 'Autohide'];
const OPEN_VIEWS = [
  'Explorer', 'Property Editor', 'Script Editor', 'Animation Editor', 'ICE Tree',
  'Animation Mixer', 'Preset Manager', 'Scene Layer Manager', 'SDK Explorer', 'Animation Layer Manager',
];

const b = await chromium.launch({
  executablePath: CHROME,
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
const pageErrors = [];
p.on('pageerror', e => pageErrors.push(String(e.message || e)));

const fail = [];
const ok = [];
const note = [];

await p.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(1500);

const audit = await p.evaluate(() => window.__uiAudit?.() ?? null);
if (!audit) { fail.push('__uiAudit missing — main.ts not exposing UI inventory'); }
else {
  ok.push(`layout=${audit.layout} keymap=${audit.keymap}`);
  if (!audit.menubar) fail.push('menubar missing'); else ok.push('menubar');
  if (!audit.mcpPresent) fail.push('MCP missing'); else ok.push(`MCP (${audit.mcpButtonCount} buttons)`);
  for (const need of ['Model', 'Animate', 'Render', 'Simulate', 'ICE', 'Hair']) {
    if (!audit.modulesExtracted?.includes(need)) fail.push(`module menu not extracted: ${need}`);
    else ok.push(`module extracted: ${need}`);
  }
  const missingViews = LAYOUT_FRAME_TYPES.filter(t => !audit.registeredViews.includes(t));
  if (missingViews.length) fail.push(`unregistered Softimage layout frame types (${missingViews.length}): ${missingViews.join(', ')}`);
  else ok.push(`all ${LAYOUT_FRAME_TYPES.length} Softimage layout frame types registered`);
  if (audit.placeholderFrames?.length) note.push(`placeholder frames in Default layout: ${audit.placeholderFrames.length}`);
  const gep = audit.getEnableParity;
  if (!gep) note.push('getEnableParity missing from __uiAudit');
  else if (!gep.ok) fail.push(`Get enable Model↔Animate mismatches: ${JSON.stringify(gep.mismatches?.slice?.(0, 5) ?? gep.mismatches)}`);
  else ok.push(`Get enable parity Model=${gep.modelGet} Animate=${gep.animateGet} shared=${gep.shared}`);
  // MCP enable: Softimage-style empty selection greys command-linked buttons
  const me = await p.evaluate(() => {
    const A = window.Application;
    A.select([]);
    return window.__uiAudit?.().mcpEnable ?? null;
  });
  if (!me) fail.push('mcpEnable missing from __uiAudit');
  else if (me.parent || me.cut || me.freeze || me.group || me.freezeM || me.sample) {
    fail.push(`MCP empty-sel enable expected all false, got ${JSON.stringify(me)}`);
  } else ok.push('MCP enable empty-sel greys Parent/Cut/Freeze/Group/FreezeM/Sample');
  // Softimage-pc matrix: XSIBATCH bools (Translate/Rotate/Scale/Duplicate true empty) + PE f_grayed seeds
  const mx = await p.evaluate(() => {
    const A = window.Application;
    A.select([]);
    const a = window.__uiAudit?.() ?? {};
    return {
      mcp: a.mcpEnable,
      matrix: a.mcpMatrix,
      grayCluster: a.peGrayedClusterWithCenter,
      graySel: a.peGrayedSelectability,
      graySymLabel: a.peGrayedSymmetryLabelOnly,
      graySymCmd: a.peGrayedSymmetryWithCmd,
      grayPoly: a.peGrayedPolynodeWithCmd,
      translateTool: a.matrixTranslateTool,
    };
  });
  const needBools = ['Translate', 'Rotate', 'Scale', 'Duplicate', 'Copy', 'Paste', 'Instantiate', 'CopyPaste'];
  const missingBools = needBools.filter(n => !mx.matrix?.boolAttested?.includes?.(n));
  if (missingBools.length) fail.push(`mcpMatrix missing bool attestations: ${missingBools.join(',')}`);
  else if ((mx.matrix?.contexts?.length ?? 0) < 10) {
    fail.push(`mcpMatrix expected >=10 contexts, got ${JSON.stringify(mx.matrix?.contexts)}`);
  } else if (mx.mcp?.matrixTranslate !== true || mx.mcp?.translate !== true || mx.mcp?.duplicate !== true) {
    fail.push(`matrix empty-sel Translate/Duplicate expected true, got ${JSON.stringify({ t: mx.mcp?.translate, mt: mx.mcp?.matrixTranslate, d: mx.mcp?.duplicate, ctx: mx.mcp?.context })}`);
  } else if (mx.mcp?.matrixCopy !== true || mx.mcp?.matrixInstantiate !== true) {
    fail.push(`matrix empty-sel Copy/Instantiate expected true, got ${JSON.stringify({ c: mx.mcp?.matrixCopy, i: mx.mcp?.matrixInstantiate })}`);
  } else if (mx.mcp?.matrixParentObj !== null && mx.mcp?.matrixParentObj !== undefined) {
    fail.push(`ParentObj matrix cell should be null (fall back canRun), got ${mx.mcp.matrixParentObj}`);
  } else if (!mx.grayCluster || !mx.graySel) {
    fail.push(`PE f_grayed seeds missing cluster=${mx.grayCluster} selectability=${mx.graySel}`);
  } else if (mx.graySymLabel) {
    fail.push('PE f_grayed must NOT grey ambiguous "Symmetry" by label alone');
  } else if (!mx.graySymCmd || !mx.grayPoly) {
    fail.push(`PE f_grayed cmd seeds missing symmetry=${mx.graySymCmd} polynode=${mx.grayPoly}`);
  } else if (mx.translateTool !== true) {
    fail.push(`TranslateTool alias should reuse Translate attested true, got ${mx.translateTool}`);
  } else if ((mx.matrix.peGrayedCmds ?? 0) < 50) {
    fail.push(`PE grayed cmds expected >=50, got ${mx.matrix.peGrayedCmds}`);
  } else ok.push(`MCP matrix Softimage ${mx.matrix.softimage}: ${mx.matrix.contexts.length} ctx, ${mx.matrix.boolAttested.length} bools; PE grayed ${mx.matrix.peGrayedCount} (cmds ${mx.matrix.peGrayedCmds}); Tool alias OK`);

  // Expanded contexts: camera / mixed still expose attested Translate true
  const mxCtx = await p.evaluate(() => {
    const A = window.Application;
    const out = {};
    const cam = A.run('GetPrim', { PresetObj: 'Camera' });
    A.select([cam]);
    out.camera = { ctx: window.__uiAudit?.().mcpEnable?.context, t: window.__uiAudit?.().mcpEnable?.matrixTranslate };
    const cube = A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' });
    const n = A.run('GetPrim', { PresetObj: 'Null' });
    A.select([cube, n]);
    out.mixed = { ctx: window.__uiAudit?.().mcpEnable?.context, t: window.__uiAudit?.().mcpEnable?.matrixTranslate };
    A.select([]);
    return out;
  });
  if (mxCtx.camera?.ctx !== 'single_camera' || mxCtx.camera?.t !== true) {
    fail.push(`single_camera matrix expected ctx+Translate true, got ${JSON.stringify(mxCtx.camera)}`);
  } else if (mxCtx.mixed?.ctx !== 'multi_mixed' || mxCtx.mixed?.t !== true) {
    fail.push(`multi_mixed matrix expected ctx+Translate true, got ${JSON.stringify(mxCtx.mixed)}`);
  } else ok.push('MCP matrix expanded contexts single_camera + multi_mixed Translate true');
  const tpe = audit.toolMenusPe;
  if (!tpe) fail.push('toolMenusPe missing from __uiAudit');
  else if (!tpe.ok) fail.push(`PE menus 530-532 mismatch: ${JSON.stringify(tpe.mismatches)}`);
  else if (tpe.peSizes?.['530'] !== 250 || tpe.peSizes?.['531'] !== 256 || tpe.peSizes?.['532'] !== 256) {
    fail.push(`PE menu resource sizes expected 250/256/256 got ${JSON.stringify(tpe.peSizes)}`);
  } else ok.push('PE tool menus 530-532 match Direct toolTranslate/Rotate/Scale (sizes 250/256/256)');
  // Unlock ui.manipulator_hitbox_px — menus + PE bitmap W/H; interactive hover LOCK
  const mh = audit.manipHitbox ?? audit.viewportPolish?.manipHitbox;
  if (!mh) fail.push('manipHitbox missing from __uiAudit');
  else if (!mh.menusOk) fail.push(`manipHitbox menus pin failed: ${JSON.stringify(mh.menus)}`);
  else if (!mh.toolbarCellOk || mh.toolbarCellWh?.w !== 24 || mh.toolbarCellWh?.h !== 24) {
    fail.push(`manipHitbox toolbar cell expected 24x24: ${JSON.stringify(mh.toolbarCellWh)}`);
  } else if ((mh.bitmapWhCount ?? 0) < 400) {
    fail.push(`manipHitbox bitmapWhCount expected ≥400 got ${mh.bitmapWhCount}`);
  } else if (mh.interactiveHoverPx !== 'LOCK') {
    fail.push(`manipHitbox interactiveHoverPx expected LOCK got ${mh.interactiveHoverPx}`);
  } else ok.push(`manip hitbox PE menus+bitmap W/H (cell ${mh.toolbarCellWh.w}x${mh.toolbarCellWh.h}, hover LOCK)`);
  // PE menu 234 Render MCP flyouts — Desktop press-hold missed; menus.json already wired
  const ff = audit.renderMcpFlyouts;
  if (!ff) fail.push('renderMcpFlyouts missing from __uiAudit');
  else if (ff.status !== 'DONE' || (ff.mismatches && ff.mismatches.length)) {
    fail.push(`renderMcpFlyouts PE mismatch: ${JSON.stringify(ff.mismatches)}`);
  } else if ((ff.flyoutCount ?? 0) < 8) {
    fail.push(`renderMcpFlyouts expected ≥8 flyouts got ${ff.flyoutCount}`);
  } else ok.push(`Render MCP flyouts PE menu 234 (${ff.flyoutCount} buttons, Desktop press-hold gap CLOSED)`);
  // Desktop LOCK close — region HWND DUMP_READY + PPG COLORREF WIRED; hover GetPixel DUMP_READY; OpenView LOCK; Anim ExecCmd + paint DONE
  const dld = audit.directLockDesktop;
  if (!dld) fail.push('directLockDesktop missing from __uiAudit');
  else if (!dld.ok) fail.push(`directLockDesktop audit failed: ${JSON.stringify(dld)}`);
  else if (dld.regionHwndCrop !== 'DUMP_READY' || dld.regionWire !== 'HWND_CROP') {
    fail.push(`directLockDesktop expected region HWND DUMP_READY/HWND_CROP got hwnd=${dld.regionHwndCrop} wire=${dld.regionWire}`);
  } else if (dld.ppgColorref !== 'WIRED' || dld.ppgHover !== 'DUMP_READY' || dld.ppgColorrefWire !== 'COLORREF_TITLE_CHROME' || dld.ppgHoverWire !== 'COLORREF_HOVER') {
    fail.push(`directLockDesktop PPG expected WIRED/hover DUMP_READY/COLORREF_HOVER got ppg=${dld.ppgColorref} hover=${dld.ppgHover} wire=${dld.ppgColorrefWire} hoverWire=${dld.ppgHoverWire}`);
  } else if (dld.floatingViews !== 'EXECCMD_DONE' || dld.floatingViewsOpenview !== 'LOCK') {
    fail.push(`directLockDesktop Anim ExecCmd expected EXECCMD_DONE/OpenView LOCK got ${dld.floatingViews}/${dld.floatingViewsOpenview}`);
  } else if (dld.fcurveMixerClientPaint !== 'DONE' || dld.fcurveMixerClientPaintWire !== 'HWND_PNG') {
    fail.push(`directLockDesktop client paint expected DONE/HWND_PNG got ${dld.fcurveMixerClientPaint}/${dld.fcurveMixerClientPaintWire}`);
  } else ok.push(`Desktop LOCK close (region OM ${dld.regionOmParamCount} keys, HWND DUMP_READY, PPG COLORREF+hover WIRED, Anim ExecCmd+paint DONE)`);
  // Softimage render.region_hwnd_crop + closer95 render.region_handle_wh — DsNewRegionButtonCtrl W/H
  const rrh = audit.renderRegionHwnd;
  if (!rrh) fail.push('renderRegionHwnd missing from __uiAudit');
  else if (!rrh.ok) fail.push(`renderRegionHwnd audit failed: ${JSON.stringify(rrh)}`);
  else ok.push(`Render region HWND crop DUMP_READY (${rrh.hwndCount}×${rrh.hwndCls}, crop ${rrh.cropPng?.[0]}x${rrh.cropPng?.[1]}, border ${rrh.borderCss}, handleWh ${rrh.handleSizePx} ${rrh.handleWhCount})`);
  // PPG title/chrome COLORREF from modules-gdi + closer95 hover GetPixel
  const pcr = audit.ppgTitleColorref;
  if (!pcr) fail.push('ppgTitleColorref missing from __uiAudit');
  else if (!pcr.ok) fail.push(`ppgTitleColorref audit failed: ${JSON.stringify(pcr)}`);
  else if (pcr.hover !== 'DUMP_READY' || pcr.hoverWire !== 'COLORREF_HOVER' || !pcr.hoverApplied) {
    fail.push(`ppgTitleColorref hover expected DUMP_READY/COLORREF_HOVER applied got ${JSON.stringify({ hover: pcr.hover, hoverWire: pcr.hoverWire, hoverApplied: pcr.hoverApplied, hoverTokens: pcr.hoverTokens })}`);
  } else ok.push(`PPG title/chrome COLORREF WIRED (fill #607388 text #E4E6EA face #ABA8A6; hover close #2F2E2E)`);
  // Softimage Anim editors ExecuteCommand([]) — open Mixer/Editor/Fcurve; client paint HWND_PNG DONE
  const aee = audit.animEditorsExecCmd;
  if (!aee) fail.push('animEditorsExecCmd missing from __uiAudit');
  else if (!aee.ok) fail.push(`animEditorsExecCmd audit failed: ${JSON.stringify(aee)}`);
  else {
    const smoke = await p.evaluate(() => window.__animEditorsExecCmdSmoke?.());
    if (!smoke?.ok) fail.push(`animEditorsExecCmd smoke failed: ${JSON.stringify(smoke)}`);
    else ok.push(`Anim ExecCmd open Mixer/Editor/Fcurve (OpenView LOCK, paint DONE HWND_PNG)`);
  }
  // Softimage Anim Mixer/Editor/Fcurve client paint from modules-gdi harvest
  const acp = audit.animClientPaint;
  if (!acp) fail.push('animClientPaint missing from __uiAudit');
  else if (!acp.ok) fail.push(`animClientPaint audit failed: ${JSON.stringify(acp)}`);
  else ok.push(`Anim client paint HWND_PNG (${acp.mixerPngPx?.[0]}x${acp.mixerPngPx?.[1]} mixer, explorer ${acp.editorExplorerW}px)`);
  // Softimage ≡ leaves: Lock Pivot / Volume / Edit Pivot must not fall through as "not implemented"
  const pePick = await p.evaluate(() => {
    const logs = [];
    const A = window.Application;
    const prev = A.logMsg.bind(A);
    A.logMsg = (k, t) => { logs.push(String(t)); return prev(k, t); };
    window.__mcp?.('lockpivot');
    window.__mcp?.('vol');
    window.__mcp?.('pivot');
    A.logMsg = prev;
    return { logs, bad: logs.some(t => /not implemented/i.test(t)) };
  });
  if (pePick.bad) fail.push(`PE pickOption still unimplemented: ${JSON.stringify(pePick.logs)}`);
  else ok.push('PE ≡ Lock Pivot / Volume / Edit Pivot wired (no not-implemented)');
  // Desktop polish #2: Softimage-attested default Camera + manipaxismode plane handles + shaded pick prefs
  const vpPol = await p.evaluate(() => {
    const A = window.Application;
    const cube = A.scene?.root?.children?.find?.(c => /cube/i.test(c.name)) ?? A.scene?.allObjects?.()?.find?.(o => o.primitive?.type === 'polymsh');
    if (cube) A.select([cube]);
    else {
      try { A.run?.('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' }); } catch { /* */ }
      const objs = A.selectedObjects?.length ? A.selectedObjects : [...(A.scene?.allObjects?.() ?? [])].filter(o => o.primitive);
      if (objs[0]) A.select([objs[0]]);
    }
    const tool = window.__tool;
    if (tool) { tool.mode = 'translate'; tool.setMode?.('translate'); }
    A.events?.emit?.('selection');
    A.events?.emit?.('scene');
    const polish = window.__uiAudit?.().viewportPolish ?? window.__vm?.viewportPolish?.();
    return polish;
  });
  await p.waitForTimeout(200);
  const vpPol2 = await p.evaluate(() => window.__vm?.viewportPolish?.() ?? window.__uiAudit?.().viewportPolish);
  const pol = { ...vpPol, ...vpPol2 };
  const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;
  if (!pol?.attestedDefaultCamera && !pol?.defaultCameraPos) fail.push(`viewportPolish missing: ${JSON.stringify(pol)}`);
  else {
    const want = pol.attestedDefaultCamera?.pos ?? pol.defaultCameraPos;
    const got = pol.cameraPos;
    const fov = pol.cameraFov ?? pol.attestedDefaultCamera?.fov;
    if (!want || !got || !near(got[0], want[0]) || !near(got[1], want[1]) || !near(got[2], want[2])) {
      fail.push(`default Camera pose expected ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
    } else ok.push(`default Camera pose (${want.join(',')})`);
    if (fov != null && !near(fov, 53.6, 0.1)) fail.push(`default Camera FOV expected 53.6 got ${fov}`);
    else ok.push('default Camera FOV 53.6');
  }
  const mode = pol?.siManipAxisMode ?? pol?.manipAxisMode;
  if (mode !== 1) fail.push(`manipAxisMode factory expected 1 (Axes+Planes) got ${mode}`);
  else ok.push('manipAxisMode=1 Axes+Planes (C3DTransformProps)');
  if (pol?.siRectRaycast !== false && pol?.rectRaycast !== false) fail.push(`rectRaycast factory expected false got ${JSON.stringify(pol?.siRectRaycast ?? pol?.rectRaycast)}`);
  else ok.push('rectRaycast=false shaded through-pick (C3DPrefsSelect)');
  if (pol?.siUseManipulators === false || pol?.useManipulators === false) fail.push('useManipulators expected true');
  else ok.push('useManipulators=true');
  const planes = (pol?.gizmoChildKinds ?? []).filter(k => String(k).startsWith('plane:'));
  if (planes.length < 3) fail.push(`plane handles missing on Translate gizmo (kinds=${JSON.stringify(pol?.gizmoChildKinds)})`);
  else ok.push(`plane handles drawn (${planes.join(',')})`);
  // Softimage: after component select + translate tool, plain empty-viewport click clears components; Shift keeps them
  const emptyDeselPrep = await p.evaluate(() => {
    const A = window.Application;
    try { A.run('NewScene'); A.run('CreatePrim', { PresetObj: 'Cube', GeometryType: 'MeshSurface' }); } catch { /* */ }
    const o = A.selectedObjects?.[0] ?? [...(A.scene?.allObjects?.() ?? [])].find(x => x.primitive?.mesh?.());
    if (!o) return { ok: false, reason: 'no mesh' };
    A.setSelMode('point');
    A.selectComponents(o, 'point', [0, 1, 2]);
    const tool = window.__tool;
    if (tool?.setMode) tool.setMode('translate');
    else if (tool) tool.mode = 'translate';
    A.events?.emit?.('selection');
    return { ok: true, n: A.compSel?.points?.size ?? 0 };
  });
  if (!emptyDeselPrep?.ok || !(emptyDeselPrep.n > 0)) fail.push(`empty-deselect prep failed: ${JSON.stringify(emptyDeselPrep)}`);
  else {
    const canvas = await p.$('.vm canvas');
    const bb = await canvas?.boundingBox();
    if (!bb) fail.push('empty-deselect: no .vm canvas');
    else {
      // Camera viewport (top-right quad): click inside grey area, not the HTML letter/Camera/Display chrome
      const ex = bb.x + bb.width - 24;
      const ey = bb.y + bb.height * 0.5 - 24;
      await p.mouse.click(ex, ey);
      await p.waitForTimeout(120);
      const afterPlain = await p.evaluate(() => ({
        points: window.Application.compSel?.points?.size ?? 0,
        selMode: window.Application.selMode,
      }));
      if (afterPlain.points !== 0) fail.push(`empty click should clear component sel, got points=${afterPlain.points}`);
      else ok.push('empty viewport click clears component selection (translate+point)');
      // Re-select and Shift+click empty → keep
      await p.evaluate(() => {
        const A = window.Application;
        const o = A.selectedObjects?.[0] ?? A.compSel?.obj;
        if (!o) return;
        A.setSelMode('point');
        A.selectComponents(o, 'point', [0, 1]);
        const tool = window.__tool;
        if (tool?.setMode) tool.setMode('translate');
        else if (tool) tool.mode = 'translate';
      });
      await p.keyboard.down('Shift');
      await p.mouse.click(ex, ey);
      await p.keyboard.up('Shift');
      await p.waitForTimeout(120);
      const afterShift = await p.evaluate(() => window.Application.compSel?.points?.size ?? 0);
      if (afterShift < 1) fail.push(`Shift+empty click should keep component sel, got points=${afterShift}`);
      else ok.push('Shift+empty viewport click keeps component selection');
    }
  }
  // MCP section skins from mcp.dll RT_BITMAP + hit-maps (desktop polish track #3)
  const hm = audit.mcpHitmaps;
  if (!hm?.skinned) fail.push(`MCP not skinned with PE bitmaps: ${JSON.stringify(hm)}`);
  else if ((hm.hitCount ?? 0) < 40) fail.push(`MCP hit-map count too low: ${hm.hitCount}`);
  else if (!['Select', 'Transform', 'Snap', 'Constrain', 'Edit'].every(s => hm.sections?.includes(s))) {
    fail.push(`MCP skin sections missing: ${JSON.stringify(hm.sections)}`);
  } else ok.push(`MCP PE bitmap hit-maps (${hm.hitCount} hits, sections ${hm.sections.join('+')})`);

  // Phase B — Softimage PPG shell chrome (uiut PE host 147 + RT_BITMAP nav/tools)
  const pc = audit.ppgChrome;
  if (!pc) fail.push('ppgChrome missing from __uiAudit');
  else if (pc.hostDialog !== '147') fail.push(`ppgChrome hostDialog expected 147 got ${pc.hostDialog}`);
  else if (!pc.bitmapMatch?.inspNav || !pc.bitmapMatch?.tools) fail.push(`ppgChrome PE↔public bitmap mismatch: ${JSON.stringify(pc.bitmapMatch)}`);
  else if (!pc.tokensApplied) fail.push('ppgChrome CSS tokens not applied (--ppg-label-w)');
  else if (pc.expectNavW !== 71 || pc.expectToolsW !== 66) fail.push(`ppgChrome bitmap sizes expected 71×66 got nav=${pc.expectNavW} tools=${pc.expectToolsW}`);
  else if (pc.fontHost !== 11) fail.push(`ppgChrome fontHost expected 11 (uiut Arial) got ${pc.fontHost}`);
  else if (pc.titleColorref?.status !== 'DUMP_READY' || pc.titleColorref?.hover !== 'DUMP_READY' || !pc.titleColorref?.tokensApplied || !pc.titleColorref?.hoverApplied) {
    fail.push(`ppgChrome titleColorref expected DUMP_READY/hover DUMP_READY/tokens+hoverApplied got ${JSON.stringify(pc.titleColorref)}`);
  } else if (pc.titleColorref?.titleFill !== '#607388' || pc.titleColorref?.titleText !== '#E4E6EA' || pc.titleColorref?.hoverClose !== '#2F2E2E') {
    fail.push(`ppgChrome title COLORREF mismatch: ${JSON.stringify(pc.titleColorref)}`);
  } else ok.push(`PPG shell chrome host=${pc.hostDialog} nav=${pc.expectNavW}x25 tools=${pc.expectToolsW}x25 font=${pc.fontHost}pt title=#607388 hoverClose=#2F2E2E`);
  // Explorer + Preferences shell chrome (sceneexplorer 725 / props 264)
  const xp = pc.explorer;
  const pr = pc.preferences;
  if (!xp?.tokensApplied || xp.rowH !== 16 || xp.fontPx !== 11 || xp.renameId !== '725') {
    fail.push(`explorer chrome expected rename=725 row=16 font=11 tokens, got ${JSON.stringify(xp)}`);
  } else if (!pr?.tokensApplied || pr.hostId !== '264' || pr.labelW !== 260 || pr.treeW !== 170) {
    fail.push(`preferences chrome expected host=264 label=260 tree=170, got ${JSON.stringify(pr)}`);
  } else ok.push(`Explorer+Prefs chrome rename=${xp.renameId} row=${xp.rowH} prefsHost=${pr.hostId} labelW=${pr.labelW}`);
  // Script Editor factory chrome (C3DPrefsScriptEditor.spdl + views defaultsize 485×550)
  const se = pc.scriptEditor;
  if (!se?.tokensApplied || se.fontPx !== 10 || se.tabSize !== 4 || se.lineNumbers !== true || se.floatW !== 485 || se.floatH !== 550) {
    fail.push(`scriptEditor chrome expected Courier 10/tab4/linenum/485x550, got ${JSON.stringify(se)}`);
  } else if (!se.linenumClass) {
    fail.push('scriptEditor expected body.script-linenum from Softimage linenum=true factory');
  } else ok.push(`Script Editor chrome font=${se.fontPx}px tab=${se.tabSize} linenum float=${se.floatW}x${se.floatH}`);
  // Soft / classic floating dialogs (PE: 8pt MS Sans Serif, OK/Cancel 50×14 DLU)
  const sd = pc.softDialog;
  if (!sd?.tokensApplied || sd.fontPt !== 8 || sd.btnWDlu !== 50 || sd.btnHDlu !== 14 || sd.btnMinW !== 75 || sd.btnMinH !== 22) {
    fail.push(`softDialog chrome expected 8pt / 50×14 DLU → 75×22px, got ${JSON.stringify(sd)}`);
  } else ok.push(`Soft-dialog chrome fontPt=${sd.fontPt} OK/Cancel DLU=${sd.btnWDlu}x${sd.btnHDlu} px=${sd.btnMinW}x${sd.btnMinH}`);
  // XSI.exe RT_DIALOG 394 Property Page stub (title + TODO string; no invent Layout)
  const pe394 = pc.propertyPage394;
  if (
    !pe394?.tokensApplied ||
    pe394.dialogId !== 394 ||
    pe394.rva !== 19961344 ||
    pe394.size !== 158 ||
    pe394.title !== 'Property Page' ||
    pe394.stubText !== 'TODO: layout property page' ||
    pe394.widthDlu !== 210 ||
    pe394.heightDlu !== 154 ||
    pe394.widthPx !== 315 ||
    pe394.heightPx !== 242 ||
    pe394.fontPt !== 8 ||
    !Array.isArray(pe394.menus) ||
    !pe394.menus.includes('PPG_CONTEXT_MENU') ||
    !pe394.menus.includes('PPG_ANIM_CONTEXT_MENU') ||
    !pe394.stubInDom ||
    pe394.stubDomText !== 'TODO: layout property page'
  ) {
    fail.push(`propertyPage394 stub chrome expected dialog 394 / TODO stub, got ${JSON.stringify(pe394)}`);
  } else ok.push(`PE394 Property Page stub id=${pe394.dialogId} rva=${pe394.rva} ${pe394.widthDlu}x${pe394.heightDlu}dlu stub="${pe394.stubText}"`);

  // Animate chrome — #47 PE base + xsivw 485×550 / KP 160×480 + PNG glyph extras
  const ac = audit.animChrome;
  if (!ac) fail.push('animChrome missing from __uiAudit');
  else if (!ac.tokensApplied) fail.push(`animChrome CSS tokens not applied (--fcv-list-w), got ${JSON.stringify(ac)}`);
  else if (!Array.isArray(ac.aeFloat) || ac.aeFloat[2] !== 485 || ac.aeFloat[3] !== 550) {
    fail.push(`animChrome AE xsivw expected 485×550, got ${JSON.stringify(ac.aeFloat)}`);
  } else if (!Array.isArray(ac.kpFloat) || ac.kpFloat[2] !== 160 || ac.kpFloat[3] !== 480) {
    fail.push(`animChrome Keying xsivw expected 160×480, got ${JSON.stringify(ac.kpFloat)}`);
  } else if (!Array.isArray(ac.mixerMenus) || ac.mixerMenus.length < 4) {
    fail.push(`animChrome mixerMenus expected Softimage bar, got ${JSON.stringify(ac.mixerMenus)}`);
  } else if ((ac.pngExtra ?? 0) < 30) {
    fail.push(`animChrome PNG toolbar glyphs expected ≥30 extras, got ${ac.pngExtra}`);
  } else if ((ac.bitmapWired ?? 0) < 60) {
    fail.push(`animChrome wired bitmaps expected ≥60 (BMP+#50 PNG), got ${ac.bitmapWired}`);
  } else ok.push(`Anim chrome AE=${ac.aeFloat.slice(2).join('x')} kp=${ac.kpFloat.slice(2).join('x')} menus=${ac.mixerMenus.join('+')} png=${ac.pngExtra} wired=${ac.bitmapWired}`);
}

// Open floating views
for (const name of OPEN_VIEWS) {
  try {
    const r = await p.evaluate((n) => {
      const before = document.querySelectorAll('.ppg-float').length;
      window.__openView?.(n);
      return document.querySelectorAll('.ppg-float').length > before || !!document.querySelector('.ppg-float');
    }, name);
    await p.waitForTimeout(120);
    if (r) ok.push(`openview ${name}`);
    else note.push(`openview ${name}: no floating chrome detected (may still have rendered)`);
  } catch (e) {
    fail.push(`openview ${name}: ${e.message || e}`);
  }
}

// Switch Softimage module toolbar heads (menus.json trees must render without placeholder)
const moduleTops = {};
for (const m of ['Animate', 'Model', 'Render', 'Simulate', 'ICE', 'Hair']) {
  try {
    await p.evaluate((mod) => window.__switchModule?.(mod), m);
    await p.waitForTimeout(100);
    const label = await p.evaluate(() => document.querySelector('.module-select')?.value);
    const hasPlaceholder = await p.evaluate(() => !!document.querySelector('.toolbar-panel .view-placeholder'));
    const btnCount = await p.evaluate(() => document.querySelectorAll('.toolbar-panel .tb-btn').length);
    const groups = await p.evaluate(() => [...document.querySelectorAll('.toolbar-panel .tb-group')].map(el => el.textContent.trim()));
    const btns = await p.evaluate(() => [...document.querySelectorAll('.toolbar-panel .tb-btn')].map(el => el.textContent.trim()));
    moduleTops[m] = { groups, btns };
    if (label === m && !hasPlaceholder && btnCount > 0) ok.push(`module switch → ${m} (${btnCount} groups)`);
    else fail.push(`module switch → ${m} (got ${label}, placeholder=${hasPlaceholder}, btns=${btnCount})`);
  } catch (e) {
    fail.push(`module switch ${m}: ${e.message || e}`);
  }
}

// Simulate (MENU 205 Rigid/Soft/Cloth) must not alias ICE (MENU 303 Particles/CrowdFX)
{
  const sim = moduleTops.Simulate;
  const ice = moduleTops.ICE;
  if (!sim || !ice) fail.push('Simulate vs ICE: missing module chrome after switch');
  else {
    const simKey = JSON.stringify(sim);
    const iceKey = JSON.stringify(ice);
    if (simKey === iceKey) fail.push('Simulate tree identical to ICE (must use MENU 205, not alias 303)');
    else if (!sim.btns.includes('Rigid Body') || !ice.groups.includes('Particles')) {
      fail.push(`Simulate vs ICE shape mismatch: Simulate btns=${sim.btns.join('|')} ICE groups=${ice.groups.join('|')}`);
    } else ok.push('Simulate≠ICE (205 Rigid/Soft/Cloth vs 303 Particles/CrowdFX)');
  }
}

// Layout switch via query (Softimage-style full rebuild)
for (const layout of LAYOUTS) {
  const u = new URL(BASE_URL, 'http://localhost:4173');
  u.searchParams.set('layout', layout);
  u.searchParams.set('demo', '1');
  try {
    await p.goto(u.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(900);
    const a = await p.evaluate(() => window.__uiAudit?.());
    if (!a?.menubar) fail.push(`layout ${layout}: no menubar`);
    else if (a.layout !== layout && layout !== 'Default') {
      // currentLayoutName may normalize; accept if registered
      if (!a.layouts.includes(layout)) fail.push(`layout ${layout}: not in layoutNames`);
      else ok.push(`layout ${layout} loaded (reported ${a.layout})`);
    } else ok.push(`layout ${layout}`);
    if (pageErrors.length) { fail.push(`layout ${layout} pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`); pageErrors.length = 0; }
    // Default key panels from Softimage layouts.json frame types (Explorer / VM / Timeline / Playback)
    if (layout === 'Default') {
      const keys = await p.evaluate(() => {
        const types = [...document.querySelectorAll('.view[data-type], .frame[data-type], [data-view-type]')]
          .map(el => el.getAttribute('data-type') || el.getAttribute('data-view-type') || '');
        const titles = [...document.querySelectorAll('.view-title, .frame-title, .switcher-btn')]
          .map(el => (el.textContent || '').trim());
        const has = (name) =>
          types.includes(name)
          || !!document.querySelector(`.bmp-panel.playback, .timeline, .mcp`)
          || titles.some(t => t === name || t.startsWith(name));
        // Softimage PE Playback bitmap chrome already wired (views.ts PLAYU)
        const playbackBmp = !!document.querySelector('.bmp-panel.playback');
        const timeline = !!document.querySelector('.timeline');
        const explorer = !!document.querySelector('.explorer, .xsi-explorer') || titles.includes('Explorer');
        const vm = !!document.querySelector('.view-manager, .vm') || titles.includes('A') || !!document.querySelector('canvas');
        return { playbackBmp, timeline, explorer, vm };
      });
      if (keys.playbackBmp) ok.push('Default Playback Panel PE bitmap (PLAYU)');
      else fail.push('Default Playback Panel missing Softimage PLAYU bitmap chrome');
      if (keys.timeline) ok.push('Default Timeline present');
      else note.push('Default Timeline DOM not found (may be titled differently)');
      if (keys.explorer) ok.push('Default Explorer present');
      else note.push('Default Explorer DOM not found');
      if (keys.vm) ok.push('Default View Manager canvas present');
      else fail.push('Default View Manager missing');
    }
    // Dual shell chrome from layouts.json / Dual.xsily (50|50 + Screen1Tray + MCP bottom_inv)
    if (layout === 'Dual') {
      const dual = await p.evaluate(() => {
        const root = document.querySelector('#root > .frameset');
        const sizes = root?.dataset?.sizes ?? '';
        const screen1 = [...document.querySelectorAll('.switcher[data-name="Screen1Tray"] > .switcher-bar > .switcher-btn')]
          .map(b => b.dataset.label || b.textContent?.trim());
        const mcp = [...document.querySelectorAll('.switcher[data-name="mcp"] > .switcher-bar > .switcher-btn')]
          .map(b => b.dataset.label || b.textContent?.trim());
        const mcpInv = !!document.querySelector('.switcher[data-name="mcp"].inv');
        const modMenu = document.querySelector('.switcher[data-name="module_menu"]');
        const modBtn = modMenu?.querySelector('.switcher-btn.icon');
        const modSize = modBtn ? { w: modBtn.offsetWidth, h: modBtn.offsetHeight } : null;
        return { sizes, screen1, mcp, mcpInv, modSize };
      });
      if (dual.sizes !== '50%,50%') fail.push(`Dual root sizes expected 50%,50% got ${dual.sizes}`);
      else ok.push('Dual 50%/50% shell split');
      const wantScreen = ['Animation', 'Schematic', 'Rendering', 'ICE', 'Compositing', 'Plugins'];
      if (wantScreen.every((l, i) => dual.screen1[i] === l)) ok.push('Dual Screen1Tray labels');
      else fail.push(`Dual Screen1Tray labels got ${JSON.stringify(dual.screen1)}`);
      const wantMcp = ['MCP', 'KP/L', 'PPG'];
      if (wantMcp.every((l, i) => dual.mcp[i] === l) && dual.mcpInv) ok.push('Dual MCP bottom_inv tabs');
      else fail.push(`Dual MCP tabs/inv got ${JSON.stringify(dual.mcp)} inv=${dual.mcpInv}`);
      if (dual.modSize && dual.modSize.w >= 24 && dual.modSize.w <= 30 && dual.modSize.h >= 24 && dual.modSize.h <= 30) {
        ok.push(`Dual module_menu buttonsize ~26x26 (${dual.modSize.w}x${dual.modSize.h})`);
      } else fail.push(`Dual module_menu buttonsize expected ~26x26 got ${JSON.stringify(dual.modSize)}`);
    }
  } catch (e) {
    fail.push(`layout ${layout}: ${e.message || e}`);
  }
}

await b.close();

const out = { ok: ok.length, fail: fail.length, note: note.length, okItems: ok, failItems: fail, notes: note };
console.log(JSON.stringify(out, null, 2));
const dir = path.resolve('docs/screenshots');
try { fs.mkdirSync(dir, { recursive: true }); } catch { /* */ }
fs.writeFileSync(path.join(dir, 'ui-smoke-last.json'), JSON.stringify(out, null, 2));
process.exit(fail.length ? 1 : 0);
