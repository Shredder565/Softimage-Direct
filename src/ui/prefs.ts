// File > Preferences: every page is a C3DPrefs*.spdl property set from the install (labels, defaults, ranges, layout),
// rendered by the normal Property Editor. Values persist in localStorage and the ones the clone honours are applied
// live (Display point size, Selection rules, Tweak pick size, Interaction auto-inspect / key map, Camera zoom rate…).
import { App } from '../core/commands';
import { ParamSet } from '../core/params';
import { siPropDefs, siPropLayout, siPropLabel, SI_PROPSETS as SETS } from '../core/opdefs';
import { openFloating } from './floating';
import { propertyEditor } from './ppg';
import { SI } from './viewManager';
import { setKeymap, keymapNames } from './keymap';
import { siPrefTitle } from './si';

const pageLabel = (k: string) => k === 'C3DSceneColors' ? 'Scene Colors' : siPrefTitle(k) ?? siPropLabel(k);
const PREF_PAGES = Object.keys(SETS).filter(k => k.startsWith('C3DPrefs') && !['C3DPrefsMgr', 'C3DPrefsPrivate', 'C3DPrefsFaceRobot'].includes(k)).sort((a, b) => pageLabel(a).localeCompare(pageLabel(b)));
let prefs: Map<string, ParamSet> | null = null;

export function preferenceSets(app: App): Map<string, ParamSet> {
  if (prefs) return prefs; prefs = new Map();
  let saved: Record<string, Record<string, any>> = {}; try { saved = JSON.parse(localStorage.getItem('si.prefs') ?? '{}'); } catch { /* ignore */ }
  for (const k of [...PREF_PAGES, 'C3DSceneColors']) {
    const set = new ParamSet(pageLabel(k), 'preferences', siPropDefs(k, saved[k] ?? {})); set.layout = siPropLayout(k) as any; (set as any).siKey = k;
    set.onChange(() => { apply(app, k, set); persist(); }); prefs.set(k, set);
  }
  for (const [k, set] of prefs) apply(app, k, set);
  (window as any).__prefSets = prefs;
  return prefs;
}
function persist() { if (!prefs) return; const o: Record<string, Record<string, any>> = {}; for (const [k, s] of prefs) { o[k] = {}; for (const p of s.params) if (p.value !== (SETS[k].params.find(q => q.sn === p.name)?.default)) o[k][p.name] = p.value; } try { localStorage.setItem('si.prefs', JSON.stringify(o)); } catch { /* ignore */ } }

/** Read a preference value (`pref('C3DPrefsDisplay', 'pointsize')`); undefined until the sets are built. */
export function pref(page: string, name: string): any { return prefs?.get(page)?.val(name); }
/** Softimage packs scene colours as RGBA ints (R in the high byte). */
export const packedToHex = (v: number) => (Number(v) >>> 8) & 0xffffff;
const COLOR_KEYS: Record<string, keyof typeof SI> = { selcol: 'selected', geocol: 'geometry', actcol: 'active', compcol: 'component', vtxcol: 'vertex', hilitcol: 'highlight', subselcol: 'subselection', backgroundcol: 'background', gridcol: 'grid', viewportcol: 'viewport', litcol: 'light', camcol: 'camera', nullcol: 'nullcol', ctrlcol: 'ctrl', inhcol: 'inherited', knotcol: 'knot', nrmcol: 'normal', crvisocol: 'curveIso', crvbndcol: 'curveBoundary', clscol: 'cluster', clsselcol: 'clusterSelected', unseltblcol: 'unselectable', tagcol: 'tagged', filmgatecol: 'filmGate', psetinspectcol: 'inspected', smplptcol: 'sample' };

/** Push the preferences the clone understands into the live app. Everything else is still readable through `pref()`. */
function apply(app: App, key: string, set: ParamSet) {
  const v = (n: string) => set.val(n); const A = app as any, W = window as any;
  switch (key) {
    case 'C3DSceneColors': for (const [sn, k] of Object.entries(COLOR_KEYS)) if (v(sn) !== undefined) (SI as any)[k] = packedToHex(v(sn)); document.documentElement.style.setProperty('--vp-bg', '#' + SI.background.toString(16).padStart(6, '0')); break;
    case 'C3DPrefsDisplay': SI.pointSize = Number(v('pointsize') ?? 5); SI.normalScale = Number(v('normalscaling') ?? 1); SI.headlightDefault = !!v('headlight'); SI.font = `${v('fontsize') || 10}px ${v('font') || 'Tahoma, Verdana, sans-serif'}`; document.documentElement.style.setProperty('--vp-font', SI.font); A.displayAsFrames = v('display_as_frames') !== false; break;
    case 'C3DPrefsSelect': SI.clickToDeselect = !!v('clicktodeselect'); SI.surroundPolygons = !!v('surroundpolygons'); SI.surroundEdges = !!v('surroundedges'); SI.singleObject = !!v('singleobject'); SI.raycastBackfacing = v('raycastbackfacing') !== false; SI.rectRaycast = !!v('rectraycast'); SI.extendedComponentSel = !!v('extcomponentsel'); break;
    case 'C3DPrefsTweak': SI.pickTol = Number(v('picktol') ?? 15); SI.boundaryPickTol = Number(v('boundarypicktol') ?? 15); break;
    case 'C3DPrefsTweakNormals': SI.normalPickTol = Number(v('picktol') ?? 15); SI.normalDisplaySize = Number(v('displaysize') ?? 1); break;
    case 'C3DPrefsInteraction': app.autoInspect = v('autoinspect') !== false; { const km = String(v('defaultkeymap') ?? ''); if (km) { const n = keymapNames().find(k => k === km || k.startsWith(km.replace(' Key Map', ''))); if (n) setKeymap(n); } }
      W.__sticky = { enabled: v('stickykeys') !== false, time: Number(v('stickytime') ?? 300) }; A.hideWindowOnSwitch = !!v('hidewindowonswitch'); A.displayParamColors = v('displayparamcolors') !== false; document.body.classList.toggle('no-param-colors', !A.displayParamColors);
      if (app.anim) { const pm = Number(v('playbackmode') ?? 1); app.anim.realtime = pm !== 0; A.playbackView = v('playbackview'); } break;
    case 'C3DPrefsCamera': W.__wheelRate = Number(v('mousewheelrate') ?? 0.2); W.__orbitSelected = Number(v('orbitselected') ?? 0); SI.nav = { zoomCursor: !!v('zoomcursor'), wheelCursor: !!v('zoomwheelcursor'), wheelZoom: v('mousewheelzoom') !== false, navZoom: Number(v('navzoom') ?? 1), panZoom: Number(v('panzoom') ?? 1), animate: !!v('animate'), animateDuration: Number(v('animateduration') ?? 0.5), orbit: Number(v('navorbit') ?? 0), pan: Number(v('navpan') ?? 0) }; break;
    case 'C3DPrefsModeling': A.selectGenerated = v('selectgeneratedobj') !== false; A.genInputMgt = Number(v('geninputmgt') ?? 0); A.constructionAutoUpdate = !!v('constructionmodeautoupdate'); A.useLoopForTris = !!v('useloopfortris'); break;
    case 'C3DPrefsPolygon': SI.planarity = v('planarity') !== false; SI.connectRule = Number(v('connectrule') ?? 0); break;
    case 'C3DPrefsGeneral': A.maxUndo = Math.max(1, Number(v('undo') ?? 50)); A.modelWildcards = v('modelwildcards') !== false; A.refModelPrefix = String(v('refmodelprefix') ?? ''); break;
    case 'C3DPrefsUnitsSetting': SI.units = { length: Number(v('length') ?? 2), angle: Number(v('angle') ?? 2), time: Number(v('time') ?? 0), mass: Number(v('mass') ?? 2) }; break;
    case 'C3DPrefsTime': if (app.anim) { const fr = Number(v('framerate')); if (fr > 0) app.anim.fps = fr; A.displayFrames = v('displayframes') !== false; A.frameFormat = Number(v('frameformat') ?? 10); } break;
    case 'C3DPrefsOutputFormat': A.outputFormat = { xres: Number(v('ir_xres') ?? 720), yres: Number(v('ir_yres') ?? 486), pixelRatio: Number(v('ir_pixel_ratio') ?? 1), frameStep: Number(v('frame_step') ?? 1), frameRate: Number(v('frame_rate') ?? 29.97), fields: !!v('field_enable') }; break;
    case 'C3DPrefsAnimation': app.autoKey = !!v('autokey'); A.autoKeyModified = v('autokeymodified') !== false; A.autoKeyHighlights = v('autokeyhighlights') !== false; A.keyInsert = !!v('keyinsert'); A.tangentOri = Number(v('tangentori') ?? 0); A.tangentLen = Number(v('tangentlen') ?? 0); A.si3dStyle = !!v('si3dstyle'); break;
    case 'C3DPrefsScripting': A.scriptLang = String(v('language') ?? 'VBScript'); A.cmdLog = v('cmdlog') !== false; A.msgLog = v('msglog') !== false; A.cmdLogSize = Number(v('cmdlogsize') ?? 500); A.sipython = !!v('sipython'); break;
    case 'C3DPrefsScriptEditor': document.documentElement.style.setProperty('--script-font', `${v('fontsize') || 10}px ${v('font') || 'Courier New, monospace'}`); document.body.classList.toggle('script-linenum', !!v('linenum')); A.tabSize = Number(v('tabsize') ?? 4); break;
    case 'C3DPrefsViewCube': SI.viewCube = { show: v('show') !== false, position: Number(v('position') ?? 0), size: [24, 32, 44, 56, 72][Number(v('size') ?? 2)] ?? 44, opacity: Number(v('opacity') ?? 0.5), snap: v('snap') !== false, fit: v('fit') !== false, animate: v('animate') !== false, compass: !!v('showcompass'), north: Number(v('northangle') ?? 0) }; break;
    case 'C3DPrefsLayerControl': A.layerPrefs = { sort: Number(v('sortorder') ?? 0), color: v('showcolor') !== false, viewVis: v('showviewvis') !== false, renderVis: v('showrendvis') !== false, select: v('showselect') !== false, ghost: !!v('showghost') }; break;
    case 'C3DPrefsSceneExplorer': A.explorerPrefs = { colorCoding: v('color_coding') !== false, paramValues: !!v('param_values'), trackSel: v('track_sel') !== false, sort: Number(v('scene_sort') ?? 0) }; document.body.classList.toggle('xp-nocolor', !A.explorerPrefs.colorCoding); break;
    case 'C3DPrefsRendering': A.renderPrefs = { renderer: String(v('renderer') ?? ''), outputDir: String(v('output_directory') ?? ''), outputFile: String(v('output_filename') ?? ''), regionRefresh: Number(v('region_refresh_mode') ?? 0), regionDisplay: Number(v('region_display_mode') ?? 0), regionTrackSel: !!v('region_track_selection'), autoRefresh: v('region_auto_refresh') !== false }; break;
    case 'C3DPrefsNetView': A.netviewHome = String(v('homepage') || 'https://help.autodesk.com/view/SI/2015/ENU/'); break;
    case 'C3DPrefsKeyingPanel': A.keyingPrefs = { scriptNames: !!v('use_script_names'), proxy: v('proxy_psets') !== false, marking: v('marking_psets') !== false, groupNames: !!v('group_names') }; break;
    case 'C3DPrefsObjectView': A.objectViewPrefs = { autoFrame: !!v('autoframe'), autoSelect: !!v('autoselect'), localView: !!v('localview'), toolbar: v('displaytoolbar') !== false }; break;
    case 'C3DPrefsTransformGroup': A.groupPivot = Number(v('pivot') ?? 0); break;
    case 'C3DPrefsShaderball': A.shaderball = { model: Number(v('def_model_spatial') ?? 0), background: Number(v('def_background_spatial') ?? 0), quality: Number(v('quality') ?? 1) }; break;
  }
  window.dispatchEvent(new CustomEvent('prefschanged', { detail: { key, set } }));
  if (['C3DSceneColors', 'C3DPrefsDisplay', 'C3DPrefsViewCube'].includes(key)) app.events.emit('scene');
}

export function preferencesWindow(app: App, page?: string) {
  const sets = preferenceSets(app);
  openFloating('Preferences', (body) => {
    body.classList.add('prefs');
    const tree = document.createElement('div'); tree.className = 'prefs-tree'; const host = document.createElement('div'); host.className = 'prefs-page'; body.append(tree, host);
    let current = page ? [...sets.keys()].find(k => pageLabel(k) === page || siPropLabel(k) === page || k === page) ?? PREF_PAGES[0] : PREF_PAGES[0];
    const render = () => {
      tree.innerHTML = '';
      for (const k of [...PREF_PAGES, 'C3DSceneColors']) { const r = document.createElement('div'); r.className = 'prefs-item' + (k === current ? ' active' : ''); r.textContent = pageLabel(k); r.onclick = () => { current = k; render(); }; tree.appendChild(r); }
      host.innerHTML = ''; propertyEditor(app, host, () => sets.get(current) as any);
    };
    render();
    const foot = document.createElement('div'); foot.className = 'prefs-foot';
    const reset = document.createElement('button'); reset.className = 'mcp-btn'; reset.textContent = 'Reset Page'; reset.onclick = () => { const s = sets.get(current)!; for (const p of s.params) p.value = SETS[current].params.find(q => q.sn === p.name)?.default; render(); };
    foot.appendChild(reset); body.appendChild(foot);
  }, { w: 720, h: 520, key: 'prefs', x: 160, y: 60 });
}
