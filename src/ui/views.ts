// Bottom panels and standalone views rebuilt on Softimage's own panel bitmaps (mcp.dll RT_BITMAP resources
// PLAYU / 465 / LAYERU, see data/si/pe_bitmaps) with hit regions laid over the painted buttons, plus the
// Timerange, Scene Layer Manager, XSI Explorer and Script History views (.xsivw definitions in data/si/views).
import { App } from '../core/commands';
import { X3DObject, Layer } from '../core/scene';
import { Parameter } from '../core/params';
import { SI_MENUS, SiMenuItem, openSiMenu } from './si';
import { explorerView } from './explorer';
import { keyMappingTargets } from '../commands/anim';

type Rect = [number, number, number, number];
/** A panel painted with one of the real bitmaps; `hit` adds an invisible button over a painted one. */
function bitmapPanel(host: HTMLElement, img: string, w: number, h: number, cls = '') {
  const root = document.createElement('div'); root.className = 'bmp-panel ' + cls; root.style.cssText = `width:${w}px;height:${h}px;background:url(si/mcp/${img}) no-repeat`; host.appendChild(root);
  const hit = (r: Rect, title: string, fn: (e: MouseEvent) => void, label = '') => { const b = document.createElement('button'); b.className = 'bmp-hit'; b.style.cssText = `left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px`; b.title = title; b.textContent = label; b.onclick = fn; root.appendChild(b); return b; };
  const field = (r: Rect, title: string, onCommit: (v: string) => void, cls = '') => { const i = document.createElement('input'); i.className = 'bmp-field ' + cls; i.style.cssText = `left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px`; i.title = title; i.spellcheck = false; i.onchange = () => onCommit(i.value); i.onkeydown = e => e.stopPropagation(); root.appendChild(i); return i; };
  return { root, hit, field };
}
const menuAt = (el: HTMLElement, items: SiMenuItem[], onPick: (label: string, path: string[]) => void, opts: Parameters<typeof openSiMenu>[4] = {}) => { const r = el.getBoundingClientRect(); openSiMenu(items, r.left, r.top - 2, (it, path) => onPick(it.label ?? '', path), opts); };

// ------------------------------------------------------------------ Playback Panel (PLAYU.png, 431×38)
export function playbackPanel(app: App, host: HTMLElement) {
  const A = app.anim; const P = bitmapPanel(host, 'PLAYU.png', 431, 38, 'playback');
  const PLAYBACK = SI_MENUS.mcpPlayback ?? [];
  const onPick = (l: string, path: string[]) => {
    if (/^(Play All Frames|Real-Time Playback)/.test(l)) app.run('SetPlaybackMode', { Mode: l });
    else if (l === 'Playback Options...') window.dispatchEvent(new CustomEvent('openprefs', { detail: { page: 'Playback' } }));
    else if (l === 'Playback/Audio Preferences...') window.dispatchEvent(new CustomEvent('openprefs', { detail: { page: 'Audio' } }));
    else if (path.includes('Playback View')) app.run('SetPlaybackView', { View: l });
    else if (path.includes('Playback Update Mode')) app.run('SetPlaybackUpdateMode', { Mode: l });
    else if (l === 'First Frame') app.run('FirstFrame'); else if (l === 'Last Frame') app.run('LastFrame'); else if (l === 'Previous Frame') app.run('PrevFrame'); else if (l === 'Next Frame') app.run('NextFrame');
    else if (l === 'Flipbook...') app.run('Flipbook');
  };
  const menuB = P.hit([3, 3, 58, 20], 'Playback menu', () => menuAt(menuB, PLAYBACK, onPick, { checked: it => /^(Play All Frames|Real-Time Playback)/.test(it.label ?? '') ? (it.label === 'Play All Frames' ? !A.realtime : A.realtime && (it.label!.includes('75') ? A.speed === .75 : it.label!.includes('50') ? A.speed === .5 : it.label!.includes('25') ? A.speed === .25 : A.speed === 1)) : ['All Views', 'Active View', 'View A', 'View B', 'View C', 'View D'].includes(it.label ?? '') ? A.playbackView === it.label : /Update All|Selected|SRT|Geometry/.test(it.label ?? '') && !it.items ? A.updateMode === it.label : undefined }));
  P.hit([68, 7, 20, 21], 'Previous Key', () => app.run('PrevKey')); P.hit([90, 7, 19, 21], 'Next Key', () => app.run('NextKey'));
  P.hit([117, 6, 31, 25], 'First Frame', () => app.run('FirstFrame')); P.hit([150, 6, 31, 25], 'Previous Frame', () => app.run('PrevFrame'));
  P.hit([183, 6, 31, 25], 'Stop', () => app.run('PlaybackStop'));
  const playB = P.hit([217, 6, 31, 25], 'Play Forwards (right-click: Play Backwards)', () => app.run(A.playing ? 'PlaybackStop' : 'PlayForwards')); playB.oncontextmenu = e => { e.preventDefault(); app.run('PlayBackwards'); };
  P.hit([250, 6, 33, 25], 'Last Frame', () => app.run('LastFrame'));
  const loopB = P.hit([285, 6, 29, 25], 'Loop playback (right-click: Once / Bounce)', () => app.run('SetLoopMode', { Mode: A.loopMode === 'loop' ? 'once' : 'loop' })); loopB.oncontextmenu = e => { e.preventDefault(); const r = loopB.getBoundingClientRect(); openSiMenu([{ label: 'Loop' }, { label: 'Once' }, { label: 'Bounce' }], r.left, r.top - 2, it => app.run('SetLoopMode', { Mode: it.label!.toLowerCase() }), { checked: it => A.loopMode === it.label!.toLowerCase() }); };
  const audioB = P.hit([317, 6, 31, 25], 'Audio playback on/off', () => { (A as any).audio = !(A as any).audio; upd(); });
  const frame = P.field([355, 11, 38, 14], 'Current Frame', v => app.run('SetCurrentFrame', { Frame: Number(v) }), 'dark');
  const rtB = P.hit([400, 6, 28, 25], 'Play All Frames / Real-Time (All / RT)', () => app.run('SetPlaybackMode', { Mode: A.realtime ? 'Play All Frames' : 'Real-Time Playback' }));
  const upd = () => { if (document.activeElement !== frame) frame.value = String(A.frame); playB.classList.toggle('on', A.playing); loopB.classList.toggle('on', A.loopMode !== 'once'); loopB.classList.toggle('bounce', A.loopMode === 'bounce'); audioB.classList.toggle('on', !!(A as any).audio); rtB.textContent = A.realtime ? 'RT' : 'All'; };
  upd(); app.events.on('frame', upd);
}

// ------------------------------------------------------------------ Animation Panel (465.png, 384×48)
export function animationPanel(app: App, host: HTMLElement) {
  const A = app.anim; const P = bitmapPanel(host, '465.png', 384, 48, 'animation');
  const ANIM = SI_MENUS.mcpAnimation ?? [];
  const CMD: Record<string, string> = {
    'Create Marking Set': 'CreateMarkingSet', 'Activate Marking Set': 'ActivateMarkingSet', 'Delete Marking Set': 'DeleteMarkingSet', 'Add to Marking Set': 'AddToMarkingSet', 'Remove from Marking Set': 'RemoveFromMarkingSet', 'Unmark All Parameters': 'UnmarkAllParameters',
    'Set Key': 'SaveKey', 'Set Zero Key': 'SetZeroKey', 'Remove Key': 'RemoveKey', 'Set Key at Multiple Frames...': 'SetKeyAtMultipleFrames', 'Set Key Using Marking Set': 'SetKeyUsingMarkingSet', 'Set Branch Key': 'SaveBranchKey',
    'Create Character Key Set': 'CreateCharacterKeySet', 'Create Sub-Character Key Sets': 'CreateSubCharacterKeySets', 'Delete Character Key Set': 'DeleteCharacterKeySet', 'Add Marked Parameters': 'AddMarkedToKeySet', 'Remove Marked Parameters': 'RemoveMarkedFromKeySet', 'Select Character Key Set': 'SelectCharacterKeySet', 'Select Objects From Key Set': 'SelectObjectsFromKeySet', 'Set Keys': 'KeySetSetKeys', 'Set Zero Keys': 'KeySetSetZeroKeys', 'Remove Keys': 'KeySetRemoveKeys',
    'Key Modified Parameters Only': 'ToggleKeyModifiedOnly', 'Set Expression...': 'SetExpr', 'Set Scripted Operator...': 'SetScriptedOp',
    'Link With...': 'LinkWith', 'Link With Multi...': 'LinkWithMulti', 'Link With Orientation...': 'LinkWithOrientation', 'Set Relative Values': 'SetRelativeValues',
    'First Key': 'FirstKey', 'Last Key': 'LastKey', 'Previous Key': 'PrevKey', 'Next Key': 'NextKey',
    'Convert Euler Rotation to Quaternion': 'ConvertEulerToQuaternion', 'Convert Quaternion Rotation to Euler': 'ConvertQuaternionToEuler', 'Make Rotation Keys Continuous': 'MakeRotationKeysContinuous',
  };
  const GROUP: Record<string, string> = { 'from Marked Parameters': 'Marked', 'to Marked Parameters': 'Marked', 'from Transforms': 'Transforms', 'from Scaling': 'Scaling', 'from Rotation': 'Rotation', 'from Translation': 'Translation', 'from All Parameters, Any Animation Type': 'All', 'to All Parameters': 'All', 'from All Parameters, Expressions': 'All', 'from All Parameters, Fcurves': 'All', 'from All Parameters, Layer Animation': 'All', 'from All Parameters, Static Fcurves': 'All', 'from All Parameters, Scripted Operators': 'All', 'from Objects, Constraints': 'All' };
  const onPick = (l: string, path: string[]) => {
    if (path.includes('Save Key Command Mapping')) { app.run('SetKeyMappingMode', { Mode: l }); return; }
    if (path.includes('Copy Animation')) { app.run('CopyAnimation' + (GROUP[l] ?? 'All')); return; }
    if (path.includes('Paste Animation')) { app.run(l.includes('Marked') ? 'PasteAnimationMarked' : 'PasteAnimationAll'); return; }
    if (path.includes('Remove Animation')) { if (l.includes('Expressions')) app.run('RemoveExpressions'); else if (l.includes('Static')) app.run('RemoveStaticFcurves'); else if (l.includes('Constraints')) app.run('RemoveAllConstraints'); else app.run('RemoveAnimation' + (GROUP[l] ?? 'All')); return; }
    if (path.includes('Sequence Animation')) { app.run(l === 'Marked Parameters' ? 'SequenceAnimationMarked' : l === 'All Scene' ? 'SequenceAnimationScene' : 'SequenceAnimationSelection'); return; }
    if (path.includes('Set Current')) { app.run('SetCurrentCharacterKeySet', { Name: l }); return; }
    if (l === 'Animation Editor...' || l === 'Inspect...') { window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Animation Editor' } })); return; }
    if (l === 'Expression Editor...') { window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Expression Editor' } })); return; }
    if (l === 'Parameter Connection  Editor...') { app.run('ParameterConnectionEditor'); return; }
    if (l.startsWith('New Custom Parameter')) { app.run(l.endsWith('Set') ? 'AddProp' : 'AddCustomParameter', l.endsWith('Set') ? { PresetObj: 'Custom Parameter Set' } : {}); return; }
    if (l === 'Edit Custom Parameter Sets..' || l === 'Edit Parameter Definition' || l.includes('Proxy Parameter') || l === 'Remove Custom Parameter') { app.logMsg('info', `${l}: not available in this build`); return; }
    const c = CMD[l]; if (c) app.run(c); else app.logMsg('info', `Animation menu: ${l} not implemented`);
  };
  const keySets = (): Map<string, Parameter[]> => (app as any).keySets ?? new Map();
  const withCurrent = (items: SiMenuItem[]): SiMenuItem[] => items.map(it => { if (it.label === 'Character Key Sets' && it.items) return { ...it, items: it.items.map(s => s.label === 'Set Current' ? { ...s, items: [...keySets().keys()].map(n => ({ label: n })) } : s) }; return it; });
  const animB = P.hit([2, 2, 66, 20], 'Animation menu', () => menuAt(animB, withCurrent(ANIM), onPick, { checked: it => it.label === 'Key Modified Parameters Only' ? !!(app as any).keyModifiedOnly : ['Key Marked Parameters', 'Key All Keyable', 'Key Marked Keyable', 'Key Character Key Set'].includes(it.label ?? '') ? ((app as any).keyMapping ?? 'Key All Keyable') === it.label : keySets().has(it.label ?? '') && !it.items ? (app as any).currentKeySetName === it.label : undefined }));
  const keyB = P.hit([75, 5, 29, 36], 'Set Key on Keyable Parameters (K). Right-click: Remove Key', () => app.run('SaveKey')); keyB.oncontextmenu = e => { e.preventDefault(); app.run('RemoveKey'); };
  const markedF = P.hit([110, 3, 152, 19], 'Marked Parameter', () => window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Keying Panel' } }))); markedF.classList.add('text');
  const cksB = P.hit([266, 3, 36, 19], 'Character Key Sets', () => menuAt(cksB, withCurrent(ANIM).find(i => i.label === 'Character Key Sets')?.items ?? [], onPick));
  const autoB = P.hit([2, 27, 33, 18], 'Auto key: key any changed parameter', () => { app.autoKey = !app.autoKey; upd(); });
  P.hit([37, 27, 16, 18], 'Previous Key', () => app.run('PrevKey')); P.hit([55, 27, 17, 18], 'Next Key', () => app.run('NextKey'));
  const cksF = P.hit([110, 27, 222, 18], 'Current Character Key Set', () => { const names = [...keySets().keys()]; const r = cksF.getBoundingClientRect(); openSiMenu(names.length ? names.map(n => ({ label: n })) : [{ label: '(No Character Key Sets Found)' }], r.left, r.top - 2, it => { if (keySets().has(it.label!)) app.run('SetCurrentCharacterKeySet', { Name: it.label }); }, { checked: it => (app as any).currentKeySetName === it.label }); }); cksF.classList.add('text', 'dark');
  P.hit([338, 27, 20, 18], 'Clear marked parameters', () => app.run('UnmarkAllParameters'));
  const lockB = P.hit([362, 27, 20, 18], 'Lock the marked parameters (keep them when the selection changes)', () => { (app as any).lockMarked = !(app as any).lockMarked; upd(); });
  const upd = () => { autoB.classList.toggle('on', app.autoKey); lockB.classList.toggle('on', !!(app as any).lockMarked); const m = [...A.marked]; markedF.textContent = m.length ? (m.length === 1 ? m[0].fullName : `${m.length} marked parameters`) : ''; const targets = keyMappingTargets(app); keyB.classList.toggle('keyed', targets.length > 0 && targets.every(p => A.fcurve(p)?.hasKey(A.frame))); keyB.classList.toggle('animated', targets.some(p => A.isAnimated(p))); cksF.textContent = (app as any).currentKeySetName ?? ''; };
  upd(); app.events.on('frame', upd); app.events.on('selection', upd); app.events.on('params', upd);
}

// ------------------------------------------------------------------ Timerange (start / range slider / end, global range)
export function timerange(app: App, host: HTMLElement) {
  const A = app.anim; const root = document.createElement('div'); root.className = 'timerange'; host.appendChild(root);
  const num = (title: string, fn: (v: number) => void) => { const i = document.createElement('input'); i.type = 'number'; i.title = title; i.onchange = () => fn(Number(i.value)); i.onkeydown = e => e.stopPropagation(); return i; };
  const gs = num('Global start frame', v => app.run('SetGlobalRange', { Start: v, End: A.globalEnd })), s = num('Play range start', v => app.run('SetPlayRange', { Start: v, End: A.endFrame }));
  const e = num('Play range end', v => app.run('SetPlayRange', { Start: A.startFrame, End: v })), ge = num('Global end frame', v => app.run('SetGlobalRange', { Start: A.globalStart, End: v }));
  const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('div'); fill.className = 'fill'; const hs = document.createElement('div'); hs.className = 'handle l'; const he = document.createElement('div'); he.className = 'handle r'; const cur = document.createElement('div'); cur.className = 'cur'; bar.append(fill, hs, he, cur);
  root.append(gs, s, bar, e, ge);
  const X = (f: number) => (f - A.globalStart) / Math.max(1, A.globalEnd - A.globalStart);
  const upd = () => { gs.value = String(A.globalStart); ge.value = String(A.globalEnd); s.value = String(A.startFrame); e.value = String(A.endFrame); fill.style.left = X(A.startFrame) * 100 + '%'; fill.style.right = (1 - X(A.endFrame)) * 100 + '%'; hs.style.left = X(A.startFrame) * 100 + '%'; he.style.left = X(A.endFrame) * 100 + '%'; cur.style.left = X(A.frame) * 100 + '%'; };
  const frameAt = (ev: PointerEvent) => { const r = bar.getBoundingClientRect(); return Math.round(A.globalStart + Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * (A.globalEnd - A.globalStart)); };
  let drag: 'l' | 'r' | 'm' | null = null, off = 0;
  bar.onpointerdown = (ev) => { bar.setPointerCapture(ev.pointerId); drag = ev.target === hs ? 'l' : ev.target === he ? 'r' : 'm'; off = frameAt(ev) - A.startFrame; };
  bar.onpointermove = (ev) => { if (!drag) return; const f = frameAt(ev); if (drag === 'l') { A.startFrame = Math.min(f, A.endFrame - 1); } else if (drag === 'r') { A.endFrame = Math.max(f, A.startFrame + 1); } else { const len = A.endFrame - A.startFrame; let ns = f - off; ns = Math.max(A.globalStart, Math.min(A.globalEnd - len, ns)); A.startFrame = ns; A.endFrame = ns + len; } app.events.emit('frame'); };
  bar.onpointerup = () => { if (drag) app.run('SetPlayRange', { Start: A.startFrame, End: A.endFrame }); drag = null; };
  upd(); app.events.on('frame', upd);
}

// ------------------------------------------------------------------ Scene Layer Manager (layercontrol.xsivw)
export function layerManager(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'layer-mgr'; host.appendChild(root);
  const A = app as any; A.currentLayer ??= app.scene.layers[0];
  const LAYER = SI_MENUS.mcpLayer ?? [];
  const head = document.createElement('div'); head.className = 'xp-head';
  const menuB = document.createElement('button'); menuB.className = 'xp-btn'; menuB.innerHTML = 'Layers<span class="xp-arrow">▾</span>';
  menuB.onclick = () => menuAt(menuB, LAYER, (l) => { if (l === 'New Layer') app.run('CreateLayer', { Name: 'Layer', InputObjs: app.selectedObjects }); else if (l === 'Delete Current Layer') app.run('DeleteLayer', { Name: A.currentLayer?.name }); else if (l === 'Move Selection to Current Layer') app.run('MoveToLayer', { Name: A.currentLayer?.name, InputObjs: app.selectedObjects }); else if (l === 'Layer Control...') window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Layer Control' } })); else { const k = ({ 'Viewport Visibility': 'viewvis', 'Rendering Visibility': 'rendvis', 'Selectability': 'selectability', 'Ghosting': 'ghosting' } as any)[l]; if (k && A.currentLayer) toggle(A.currentLayer, k); } }, { checked: it => { const k = ({ 'Viewport Visibility': 'viewvis', 'Rendering Visibility': 'rendvis', 'Selectability': 'selectability', 'Ghosting': 'ghosting' } as any)[it.label ?? '']; return k && A.currentLayer ? !!A.currentLayer.val(k) : undefined; } });
  const tb = (l: string, t: string, fn: () => void) => { const b = document.createElement('button'); b.className = 'xp-btn'; b.textContent = l; b.title = t; b.onclick = fn; return b; };
  head.append(menuB, tb('New', 'New layer from the selection', () => app.run('CreateLayer', { Name: 'Layer', InputObjs: app.selectedObjects })), tb('Delete', 'Delete the current layer (members go to the default layer)', () => app.run('DeleteLayer', { Name: A.currentLayer?.name })), tb('Add', 'Move the selection to the current layer', () => app.run('MoveToLayer', { Name: A.currentLayer?.name, InputObjs: app.selectedObjects })), tb('Select', 'Select the members of the current layer', () => app.select([...(A.currentLayer?.members ?? [])])));
  root.appendChild(head);
  const tbl = document.createElement('table'); tbl.className = 'layer-table'; root.appendChild(tbl);
  const toggle = (l: Layer, k: string) => { const v = !l.val(k); app.setParam(l.get(k)!, v); if (k === 'viewvis') for (const o of l.members) app.setParam(o.property('visibility')!.get('viewvis')!, v); if (k === 'selectability') for (const o of l.members) { const p = o.property('visibility')?.get('selectability'); if (p) app.setParam(p, v); } app.events.emit('scene'); };
  const render = () => {
    tbl.innerHTML = '<tr><th title="Current layer"></th><th>Name</th><th title="Wire colour">Color</th><th title="Viewport visibility">V</th><th title="Render visibility">R</th><th title="Selectable">S</th><th title="Ghosting">G</th><th>#</th></tr>';
    for (const l of app.scene.layers) {
      const tr = document.createElement('tr'); tr.classList.toggle('current', l === A.currentLayer);
      const cur = document.createElement('td'); const rb = document.createElement('input'); rb.type = 'radio'; rb.name = 'curlayer'; rb.checked = l === A.currentLayer; rb.onchange = () => { A.currentLayer = l; render(); }; cur.appendChild(rb);
      const nm = document.createElement('td'); const ni = document.createElement('input'); ni.className = 'name'; ni.value = l.name; ni.onchange = () => { const old = l.name; const nn = ni.value.trim() || old; app.record('Rename Layer', () => { l.name = nn; }, () => { l.name = old; }); app.events.emit('scene'); }; ni.onkeydown = e => e.stopPropagation(); nm.appendChild(ni);
      const col = document.createElement('td'); const ci = document.createElement('input'); ci.type = 'color'; const c = l.val('color') as number[]; ci.value = '#' + c.map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); ci.onchange = () => { const v = ci.value; app.setParam(l.get('color')!, [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16) / 255)); app.events.emit('scene'); }; col.appendChild(ci);
      tr.append(cur, nm, col);
      for (const k of ['viewvis', 'rendvis', 'selectability', 'ghosting']) { const td = document.createElement('td'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!l.val(k); cb.onchange = () => toggle(l, k); td.appendChild(cb); tr.appendChild(td); }
      const n = document.createElement('td'); n.textContent = String(l.members.size); n.title = [...l.members].map(o => o.name).join(', '); tr.appendChild(n);
      tr.ondblclick = () => app.select([...l.members]); tbl.appendChild(tr);
    }
  };
  render(); app.events.on('scene', render); app.events.on('params', render);
}

// ------------------------------------------------------------------ XSI Explorer (scope pane + explorer)
export function xsiExplorer(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'xsi-explorer'; host.appendChild(root);
  const side = document.createElement('div'); side.className = 'xp-scopes'; const main = document.createElement('div'); main.className = 'xp-main'; root.append(side, main);
  const ex = explorerView(app, main);
  const SCOPE_OF: Record<string, string> = { 'Scene Root': 'Scene', 'Layers': 'Layers', 'Passes': 'Passes', 'Selection': 'Selection', 'Application': 'Application', 'Materials': 'Materials', 'Current Layer': 'Layers', 'Current Pass': 'Passes' };
  const items = SI_MENUS.explorerScope ?? [];
  const rows: HTMLElement[] = [];
  for (const it of items) {
    const l = it.label ?? ''; const r = document.createElement('div');
    if (l.startsWith('TITLE:')) { r.className = 'xp-scope-title'; r.textContent = l.slice(6); side.appendChild(r); continue; }
    r.className = 'xp-scope'; r.textContent = l; const sc = SCOPE_OF[l];
    if (!sc) r.classList.add('dim');
    r.onclick = () => { if (!sc) { app.logMsg('info', `Explorer scope "${l}" has no content in this build`); return; } ex.setScope(sc); rows.forEach(x => x.classList.toggle('on', x === r)); };
    rows.push(r); side.appendChild(r);
  }
  rows.find(r => r.textContent === 'Scene Root')?.classList.add('on');
}

// ------------------------------------------------------------------ Script History (commands only, copy / clear / replay)
export function scriptHistory(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'script-history'; host.appendChild(root);
  const head = document.createElement('div'); head.className = 'xp-head';
  const tb = (l: string, t: string, fn: () => void) => { const b = document.createElement('button'); b.className = 'xp-btn'; b.textContent = l; b.title = t; b.onclick = fn; return b; };
  let start = 0; const body = document.createElement('div'); body.className = 'log';
  head.append(tb('Copy', 'Copy the command history to the clipboard', () => { navigator.clipboard?.writeText(lines().join('\n')).then(() => app.logMsg('info', 'Script history copied')); }), tb('Clear', 'Clear the history view', () => { start = app.log.length; render(); }), tb('Save...', 'Download the history as a script', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines().join('\n')], { type: 'text/plain' })); a.download = 'ScriptHistory.txt'; a.click(); }));
  root.append(head, body);
  const lines = () => app.log.slice(start).filter(l => l.kind === 'cmd').map(l => l.text);
  const render = () => { body.innerHTML = ''; for (const l of app.log.slice(start)) { if (l.kind !== 'cmd' && l.kind !== 'error') continue; const d = document.createElement('div'); d.className = l.kind; d.textContent = l.kind === 'error' ? '// ERROR : ' + l.text : l.text; d.ondblclick = () => { try { (window as any).__runLine?.(l.text); } catch { /* logged */ } }; body.appendChild(d); } body.scrollTop = body.scrollHeight; };
  render(); app.events.on('log', render);
}

export { X3DObject };
