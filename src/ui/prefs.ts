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

const PREF_PAGES = Object.keys(SETS).filter(k => k.startsWith('C3DPrefs') && !['C3DPrefsMgr', 'C3DPrefsPrivate', 'C3DPrefsFaceRobot'].includes(k)).sort((a, b) => siPropLabel(a).localeCompare(siPropLabel(b)));
let prefs: Map<string, ParamSet> | null = null;

export function preferenceSets(app: App): Map<string, ParamSet> {
  if (prefs) return prefs; prefs = new Map();
  let saved: Record<string, Record<string, any>> = {}; try { saved = JSON.parse(localStorage.getItem('si.prefs') ?? '{}'); } catch { /* ignore */ }
  for (const k of [...PREF_PAGES, 'C3DSceneColors']) {
    const set = new ParamSet(siPropLabel(k), 'preferences', siPropDefs(k, saved[k] ?? {})); set.layout = siPropLayout(k) as any; (set as any).siKey = k;
    set.onChange(() => { apply(app, k, set); persist(); }); prefs.set(k, set);
  }
  for (const [k, set] of prefs) apply(app, k, set);
  return prefs;
}
function persist() { if (!prefs) return; const o: Record<string, Record<string, any>> = {}; for (const [k, s] of prefs) { o[k] = {}; for (const p of s.params) if (p.value !== (SETS[k].params.find(q => q.sn === p.name)?.default)) o[k][p.name] = p.value; } try { localStorage.setItem('si.prefs', JSON.stringify(o)); } catch { /* ignore */ } }

/** Push the preferences the clone understands into the live app. */
function apply(app: App, key: string, set: ParamSet) {
  const v = (n: string) => set.val(n);
  switch (key) {
    case 'C3DPrefsDisplay': SI.pointSize = Number(v('pointsize') ?? 5); break;
    case 'C3DPrefsSelect': SI.clickToDeselect = !!v('clicktodeselect'); SI.surroundPolygons = !!v('surroundpolygons'); SI.surroundEdges = !!v('surroundedges'); break;
    case 'C3DPrefsTweak': SI.pickTol = Number(v('picktol') ?? 15); break;
    case 'C3DPrefsInteraction': app.autoInspect = v('autoinspect') !== false; { const km = String(v('defaultkeymap') ?? ''); const n = keymapNames().find(k => k === km || k.startsWith(km.replace(' Key Map', ''))); if (n) setKeymap(n); } break;
    case 'C3DPrefsCamera': (window as any).__wheelRate = Number(v('mousewheelrate') ?? 0.2); (window as any).__orbitSelected = Number(v('orbitselected') ?? 0); break;
    case 'C3DPrefsModeling': (app as any).selectGenerated = v('selectgeneratedobj') !== false; break;
  }
  window.dispatchEvent(new CustomEvent('prefschanged', { detail: { key } }));
}

export function preferencesWindow(app: App, page?: string) {
  const sets = preferenceSets(app);
  openFloating('Preferences', (body) => {
    body.classList.add('prefs');
    const tree = document.createElement('div'); tree.className = 'prefs-tree'; const host = document.createElement('div'); host.className = 'prefs-page'; body.append(tree, host);
    let current = page ? [...sets.keys()].find(k => siPropLabel(k) === page || k === page) ?? PREF_PAGES[0] : PREF_PAGES[0];
    const render = () => {
      tree.innerHTML = '';
      for (const k of [...PREF_PAGES, 'C3DSceneColors']) { const r = document.createElement('div'); r.className = 'prefs-item' + (k === current ? ' active' : ''); r.textContent = siPropLabel(k); r.onclick = () => { current = k; render(); }; tree.appendChild(r); }
      host.innerHTML = ''; propertyEditor(app, host, () => sets.get(current) as any);
    };
    render();
    const foot = document.createElement('div'); foot.className = 'prefs-foot';
    const reset = document.createElement('button'); reset.className = 'mcp-btn'; reset.textContent = 'Reset Page'; reset.onclick = () => { const s = sets.get(current)!; for (const p of s.params) p.value = SETS[current].params.find(q => q.sn === p.name)?.default; render(); };
    foot.appendChild(reset); body.appendChild(foot);
  }, { w: 720, h: 520, key: 'prefs', x: 160, y: 60 });
}
