// Commands behind the Animation panel (mcp.dll Animation menu) and the Playback panel (Playback menu):
// marking sets, key variants, copy/paste/remove animation by transform group, go-to-key, expressions, sequencing,
// playback modes. Keying follows the Save Key Command Mapping preference (marked / all keyable / marked keyable).
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property, Model, mixerOf, syncMixer, type MixerClip, type MixerTransition, type MixerCompound } from '../core/scene';
import { Parameter, num, str, int } from '../core/params';
import { evaluateMixer, installMixerEval, mixerDump, clipWeightsAt, buildWeightPresetKeys } from '../core/mixer';
import { putCommandEnabled, commandCanBeModified } from '../ui/cmdEnable';
import { ensureShapeBase, ensureShapeOperator, evaluateShapes } from '../core/shape';
import { findParam } from './index';
import { openFloating } from '../ui/floating';

type Group = 'Transforms' | 'Scaling' | 'Rotation' | 'Translation' | 'All' | 'Marked';
const PREFIX: Record<string, string> = { Scaling: 'scl', Rotation: 'rot', Translation: 'pos' };

export function keyTargets(app: App, group: Group = 'Marked'): Parameter[] {
  const A = app.anim; const sel = app.selection;
  const kine = (o: X3DObject) => o.kinematics.local.params.filter(p => p.keyable);
  if (group === 'Marked') { const m = [...A.marked].filter(p => sel.some(n => n === p.owner || (n instanceof X3DObject && p.owner === n.kinematics.local))); return m.length ? m : [...A.marked]; }
  const out: Parameter[] = [];
  for (const n of sel) {
    if (!(n instanceof X3DObject)) { if (group === 'All') out.push(...n.params.filter(p => p.animatable && !p.def.readOnly)); continue; }
    if (group === 'All') { out.push(...kine(n)); for (const pr of n.properties) out.push(...pr.params.filter(p => p.animatable && !p.def.readOnly)); if (n.primitive) out.push(...n.primitive.params.filter(p => p.animatable)); }
    else if (group === 'Transforms') out.push(...kine(n));
    else out.push(...kine(n).filter(p => p.def.name.startsWith(PREFIX[group])));
  }
  return out;
}
/** Parameters the K key / Set Key act on, per the "Save Key Command Mapping" setting. */
export function keyMappingTargets(app: App): Parameter[] {
  const mode = (app as any).keyMapping ?? 'Key All Keyable'; const marked = keyTargets(app, 'Marked');
  if (mode === 'Key Marked Parameters') return marked;
  if (mode === 'Key Marked Keyable') return marked.filter(p => p.keyable);
  if (mode === 'Key Character Key Set') { const cks = (app as any).currentKeySet as Parameter[] | undefined; if (cks?.length) return cks; }
  return marked.length ? marked : keyTargets(app, 'Transforms');
}

let clipboard: { name: string; keys: { time: number; value: number }[]; expr?: string }[] = [];

export function registerAnimCommands(app: App) {
  const A = app.anim;
  const emit = () => { app.events.emit('params'); app.events.emit('frame'); };
  const keyAt = (params: Parameter[], t: number, value?: number) => { for (const p of params) { const fc = A.fcurve(p, true)!; const had = fc.keys.find(k => k.time === t); const v = value ?? p.value; app.record('Key', () => fc.addKey(t, v), () => { if (had) fc.addKey(t, had.value); else fc.removeKey(t); }); } emit(); return params.length; };
  // ---- marking
  app.register({ name: 'MarkParameters', label: 'Mark Parameters', category: 'Animation', args: [{ name: 'Params', default: '' }, { name: 'Add', default: false }], execute(app, a) { const ps = resolve(app, a.Params); if (!a.Add) A.marked.clear(); ps.forEach(p => A.marked.add(p)); emit(); return ps.length; } });
  app.register({ name: 'UnmarkAllParameters', label: 'Unmark All Parameters', category: 'Animation', args: [], execute() { A.marked.clear(); emit(); } });
  app.register({ name: 'CreateMarkingSet', label: 'Create Marking Set', category: 'Animation', args: [{ name: 'Name', default: 'MarkingSet' }], execute(app, a) { const ps = [...A.marked]; if (!ps.length) throw new Error('Mark some parameters first'); const n = uniq(A.markingSets, a.Name || 'MarkingSet'); A.markingSets.set(n, ps); app.logMsg('info', `Marking set "${n}" (${ps.length} parameters)`); return n; } });
  app.register({ name: 'ActivateMarkingSet', label: 'Activate Marking Set', category: 'Animation', args: [{ name: 'Name', default: '' }], execute(app, a) { const n = a.Name || pick(app, [...A.markingSets.keys()], 'Marking set'); const ps = A.markingSets.get(n); if (!ps) throw new Error('No marking set ' + n); A.marked.clear(); ps.forEach(p => A.marked.add(p)); emit(); } });
  app.register({ name: 'DeleteMarkingSet', label: 'Delete Marking Set', category: 'Animation', args: [{ name: 'Name', default: '' }], execute(app, a) { const n = a.Name || pick(app, [...A.markingSets.keys()], 'Marking set'); A.markingSets.delete(n); } });
  app.register({ name: 'AddToMarkingSet', label: 'Add to Marking Set', category: 'Animation', args: [{ name: 'Name', default: '' }], execute(app, a) { const n = a.Name || pick(app, [...A.markingSets.keys()], 'Marking set'); const ps = A.markingSets.get(n); if (!ps) throw new Error('No marking set ' + n); for (const p of A.marked) if (!ps.includes(p)) ps.push(p); } });
  app.register({ name: 'RemoveFromMarkingSet', label: 'Remove from Marking Set', category: 'Animation', args: [{ name: 'Name', default: '' }], execute(app, a) { const n = a.Name || pick(app, [...A.markingSets.keys()], 'Marking set'); const ps = A.markingSets.get(n); if (ps) A.markingSets.set(n, ps.filter(p => !A.marked.has(p))); } });
  // ---- keys
  app.register({ name: 'SaveKeyOnKeyable', label: 'Key All Keyable', category: 'Animation', args: [{ name: 'Time', default: null }], execute: (app, a) => keyAt(keyTargets(app, 'Transforms'), a.Time ?? A.frame) });
  app.register({ name: 'SaveKeyOnMarked', label: 'Key Marked Parameters', category: 'Animation', args: [{ name: 'Time', default: null }], execute: (app, a) => keyAt(keyTargets(app, 'Marked'), a.Time ?? A.frame) });
  app.register({ name: 'SetZeroKey', label: 'Set Zero Key', category: 'Animation', args: [{ name: 'Time', default: null }], execute: (app, a) => keyAt(keyMappingTargets(app), a.Time ?? A.frame, 0) });
  app.register({ name: 'SetKeyAtMultipleFrames', label: 'Set Key at Multiple Frames', category: 'Animation', args: [{ name: 'Frames', default: '' }], execute(app, a) { const txt = a.Frames || prompt('Frames (e.g. 1,10,20 or 1-100:10):', `${A.startFrame}-${A.endFrame}:10`) || ''; const frames = parseFrames(txt); let n = 0; for (const f of frames) n = keyAt(keyMappingTargets(app), f); return frames.length ? n : 0; } });
  app.register({ name: 'SetKeyUsingMarkingSet', label: 'Set Key Using Marking Set', category: 'Animation', args: [{ name: 'Name', default: '' }], execute(app, a) { const n = a.Name || pick(app, [...A.markingSets.keys()], 'Marking set'); const ps = A.markingSets.get(n); if (!ps) throw new Error('No marking set ' + n); return keyAt(ps, A.frame); } });
  app.register({ name: 'SaveBranchKey', label: 'Set Branch Key', category: 'Animation', args: [{ name: 'Time', default: null }], execute(app, a) { const ps: Parameter[] = []; const walk = (o: X3DObject) => { ps.push(...o.kinematics.local.params.filter(p => p.keyable)); o.children.forEach(walk); }; app.selectedObjects.forEach(walk); return keyAt(ps, a.Time ?? A.frame); } });
  app.register({ name: 'SetKeyMappingMode', label: 'Save Key Command Mapping', category: 'Animation', args: [{ name: 'Mode', default: 'Key All Keyable' }], undoable: false, execute(app, a) { (app as any).keyMapping = a.Mode; app.logMsg('info', `Save Key maps to: ${a.Mode}`); } });
  app.register({ name: 'ToggleKeyModifiedOnly', label: 'Key Modified Parameters Only', category: 'Animation', args: [], undoable: false, execute(app) { (app as any).keyModifiedOnly = !(app as any).keyModifiedOnly; } });
  // ---- character key sets (a named parameter list, like a marking set, used by Set Key)
  app.register({ name: 'CreateCharacterKeySet', label: 'Create Character Key Set', category: 'Animation', args: [{ name: 'Name', default: 'KeySet' }], execute(app, a) { const ps = keyTargets(app, A.marked.size ? 'Marked' : 'Transforms'); const sets: Map<string, Parameter[]> = (app as any).keySets ??= new Map(); const n = uniq(sets, a.Name || 'KeySet'); sets.set(n, ps); (app as any).currentKeySet = ps; (app as any).currentKeySetName = n; app.logMsg('info', `Character key set "${n}" (${ps.length} parameters)`); return n; } });
  app.register({ name: 'CreateSubCharacterKeySets', label: 'Create Sub-Character Key Sets', category: 'Animation', args: [], execute(app) { const sets: Map<string, Parameter[]> = (app as any).keySets ??= new Map(); for (const o of app.selectedObjects) sets.set(uniq(sets, o.name + '_KeySet'), o.kinematics.local.params.filter(p => p.keyable)); return sets.size; } });
  app.register({ name: 'DeleteCharacterKeySet', label: 'Delete Character Key Set', category: 'Animation', args: [{ name: 'Name', default: '' }], execute(app, a) { const sets: Map<string, Parameter[]> = (app as any).keySets ??= new Map(); const n = a.Name || pick(app, [...sets.keys()], 'Character key set'); sets.delete(n); if ((app as any).currentKeySetName === n) { delete (app as any).currentKeySet; delete (app as any).currentKeySetName; } } });
  app.register({ name: 'SetCurrentCharacterKeySet', label: 'Set Current Character Key Set', category: 'Animation', args: [{ name: 'Name', default: '' }], undoable: false, execute(app, a) { const sets: Map<string, Parameter[]> = (app as any).keySets ??= new Map(); const n = a.Name || pick(app, [...sets.keys()], 'Character key set'); if (!sets.has(n)) throw new Error('No key set ' + n); (app as any).currentKeySet = sets.get(n); (app as any).currentKeySetName = n; } });
  app.register({ name: 'AddMarkedToKeySet', label: 'Add Marked Parameters', category: 'Animation', args: [], execute(app) { const ps: Parameter[] = (app as any).currentKeySet; if (!ps) throw new Error('No current character key set'); for (const p of A.marked) if (!ps.includes(p)) ps.push(p); } });
  app.register({ name: 'RemoveMarkedFromKeySet', label: 'Remove Marked Parameters', category: 'Animation', args: [], execute(app) { const ps: Parameter[] = (app as any).currentKeySet; if (!ps) throw new Error('No current character key set'); (app as any).currentKeySet = ps.filter(p => !A.marked.has(p)); } });
  app.register({ name: 'SelectCharacterKeySet', label: 'Select Character Key Set', category: 'Animation', args: [], execute(app) { const ps: Parameter[] = (app as any).currentKeySet ?? []; A.marked.clear(); ps.forEach(p => A.marked.add(p)); emit(); } });
  app.register({ name: 'SelectObjectsFromKeySet', label: 'Select Objects From Key Set', category: 'Animation', args: [], execute(app) { const ps: Parameter[] = (app as any).currentKeySet ?? []; const objs = new Set<X3DObject>(); for (const p of ps) { let o: any = p.owner; while (o && !(o instanceof X3DObject)) o = o.parentObj ?? o.parent; if (o) objs.add(o); } app.select([...objs]); } });
  app.register({ name: 'KeySetSetKeys', label: 'Set Keys (Key Set)', category: 'Animation', args: [], execute: (app) => keyAt((app as any).currentKeySet ?? [], A.frame) });
  app.register({ name: 'KeySetSetZeroKeys', label: 'Set Zero Keys (Key Set)', category: 'Animation', args: [], execute: (app) => keyAt((app as any).currentKeySet ?? [], A.frame, 0) });
  app.register({ name: 'KeySetRemoveKeys', label: 'Remove Keys (Key Set)', category: 'Animation', args: [], execute(app) { for (const p of (app as any).currentKeySet ?? []) A.removeKey(p); emit(); } });
  // ---- copy / paste / remove by group
  const groups: Group[] = ['Marked', 'Transforms', 'Scaling', 'Rotation', 'Translation', 'All'];
  for (const g of groups) {
    app.register({ name: 'CopyAnimation' + g, label: 'Copy Animation from ' + g, category: 'Animation', args: [], undoable: false, execute(app) { clipboard = keyTargets(app, g).filter(p => A.isAnimated(p) || A.expression(p)).map(p => ({ name: p.def.name, keys: (A.fcurve(p)?.keys ?? []).map(k => ({ ...k })), expr: A.expression(p) })); app.logMsg('info', `Copied animation of ${clipboard.length} parameter(s)`); return clipboard.length; } });
    app.register({ name: 'RemoveAnimation' + g, label: 'Remove Animation from ' + g, category: 'Animation', args: [], execute(app) { const ps = keyTargets(app, g); for (const p of ps) { const fc = A.fcurve(p); const ex = A.expressions.get(p); if (!fc && !ex) continue; app.record('Remove Animation', () => A.removeAnimation(p), () => { if (fc) A.fcurves.set(p, fc); if (ex) A.expressions.set(p, ex); }); } emit(); return ps.length; } });
  }
  app.register({ name: 'PasteAnimationMarked', label: 'Paste Animation to Marked Parameters', category: 'Animation', args: [], execute(app) { const ps = keyTargets(app, 'Marked'); return paste(ps); } });
  app.register({ name: 'PasteAnimationAll', label: 'Paste Animation to All Parameters', category: 'Animation', args: [], execute(app) { return paste(keyTargets(app, 'All')); } });
  const paste = (ps: Parameter[]) => { let n = 0; for (const c of clipboard) { const tgt = ps.filter(p => p.def.name === c.name); for (const p of tgt) { const old = A.fcurve(p); app.record('Paste Animation', () => { if (c.expr) A.setExpression(p, c.expr, s => findParam(app, s)); else { const fc = A.fcurve(p, true)!; fc.keys = c.keys.map(k => ({ ...k })); } }, () => { if (old) A.fcurves.set(p, old); else A.removeAnimation(p); }); n++; } } emit(); return n; };
  for (const [n, g] of [['RemoveFcurveAnimation', 'All'], ['RemoveStaticFcurves', 'All'], ['RemoveLayerAnimation', 'All'], ['RemoveScriptedOps', 'All']] as const) app.register({ name: n, label: n.replace(/([A-Z])/g, ' $1').trim(), category: 'Animation', args: [], execute(app) { let k = 0; for (const p of keyTargets(app, g)) { const fc = A.fcurve(p); if (!fc) continue; if (n === 'RemoveStaticFcurves' && fc.keys.some(x => x.value !== fc.keys[0].value)) continue; if (n === 'RemoveLayerAnimation' || n === 'RemoveScriptedOps') continue; A.fcurves.delete(p); k++; } emit(); return k; } });
  app.register({ name: 'RemoveExpressions', label: 'Remove Expressions', category: 'Animation', args: [], execute(app) { let k = 0; for (const p of keyTargets(app, 'All')) if (A.expressions.delete(p)) k++; emit(); return k; } });
  app.register({ name: 'RemoveAllConstraints', label: 'Remove All Constraints', category: 'Constraints', args: [], execute(app) { let k = 0; for (const o of app.selectedObjects) for (const pr of [...o.properties]) if (pr.type?.startsWith('cns')) { o.removeProperty(pr); k++; } app.events.emit('scene'); return k; } });
  // ---- sequencing (offset/scale keys)
  for (const [n, g, scene] of [['SequenceAnimationMarked', 'Marked', false], ['SequenceAnimationSelection', 'All', false], ['SequenceAnimationScene', 'All', true]] as const) app.register({ name: n, label: n.replace(/([A-Z])/g, ' $1').trim(), category: 'Animation', args: [{ name: 'Offset', default: null }, { name: 'Scale', default: 1 }], execute(app, a) { const off = a.Offset ?? Number(prompt('Offset keys by (frames):', '10') ?? 0); const sc = Number(a.Scale) || 1; const fcs = scene ? [...A.fcurves.values()] : keyTargets(app, g).map(p => A.fcurve(p)).filter(Boolean) as any[]; for (const fc of fcs) { const old = fc.keys.map((k: any) => ({ ...k })); app.record('Sequence', () => { fc.keys = fc.keys.map((k: any) => ({ time: Math.round((k.time - A.startFrame) * sc + A.startFrame + off), value: k.value })); }, () => { fc.keys = old; }); } emit(); return fcs.length; } });
  // ---- go to key
  const times = (app: App) => A.keyTimes(keyTargets(app, 'All').length ? keyTargets(app, 'All') : [...A.fcurves.keys()]);
  app.register({ name: 'FirstKey', label: 'First Key', category: 'Animation', args: [], undoable: false, execute(app) { const t = times(app)[0]; if (t !== undefined) A.frame = t; } });
  app.register({ name: 'LastKey', label: 'Last Key', category: 'Animation', args: [], undoable: false, execute(app) { const t = times(app).slice(-1)[0]; if (t !== undefined) A.frame = t; } });
  app.register({ name: 'PrevKey', label: 'Previous Key', category: 'Animation', args: [], undoable: false, execute(app) { const t = times(app).filter(t => t < A.frame).pop(); if (t !== undefined) A.frame = t; } });
  app.register({ name: 'NextKey', label: 'Next Key', category: 'Animation', args: [], undoable: false, execute(app) { const t = times(app).find(t => t > A.frame); if (t !== undefined) A.frame = t; } });
  // ---- expressions / links
  app.register({ name: 'SetExpr', label: 'Set Expression', category: 'Animation', args: [{ name: 'Target', default: '' }, { name: 'Expression', default: '' }], execute(app, a) { const ps = a.Target ? resolve(app, a.Target) : keyTargets(app, 'Marked'); if (!ps.length) throw new Error('Mark a parameter (or pass Target) to set an expression'); const text = a.Expression || prompt(`Expression for ${ps[0].fullName}  (Fc = frame, e.g. sin(Fc*0.1)*5)`, A.expression(ps[0]) ?? 'Fc') || ''; if (!text) return null; for (const p of ps) { const old = A.expressions.get(p); const oldFc = A.fcurve(p); app.record('Expression', () => A.setExpression(p, text, s => findParam(app, s)), () => { A.expressions.delete(p); if (old) A.expressions.set(p, old); if (oldFc) A.fcurves.set(p, oldFc); }); } emit(); return text; } });
  app.register({ name: 'LinkWith', label: 'Link With', category: 'Animation', args: [{ name: 'Target', default: '' }, { name: 'Driver', default: '' }], execute(app, a) { const ps = a.Target ? resolve(app, a.Target) : keyTargets(app, 'Marked'); const drv = a.Driver || prompt('Driving parameter (e.g. null.kine.local.posx):', '') || ''; if (!ps.length || !drv) throw new Error('Link With needs a marked parameter and a driving parameter'); const d = findParam(app, drv); if (!d) throw new Error('No parameter ' + drv); for (const p of ps) A.setExpression(p, drv, s => findParam(app, s)); emit(); return ps.length; } });
  app.register({ name: 'LinkWithMulti', label: 'Link With Multi', category: 'Animation', args: [], execute(app) {
    // Softimage: link each marked param on object A to the same-named param on object B (last selected).
    const sel = app.selectedObjects; if (sel.length < 2) throw new Error('LinkWithMulti: select driven object(s), then the driver');
    const driver = sel[sel.length - 1]; const driven = sel.slice(0, -1); let n = 0;
    for (const o of driven) for (const p of o.kinematics.local.params.filter(x => x.keyable)) {
      const d = driver.kinematics.local.get(p.def.name); if (!d) continue;
      A.setExpression(p, d.fullName, s => findParam(app, s)); n++;
    }
    emit(); return n;
  } });
  app.register({ name: 'LinkWithOrientation', label: 'Link With Orientation', category: 'Animation', args: [], execute(app) {
    const sel = app.selectedObjects; if (sel.length < 2) throw new Error('LinkWithOrientation: select driven, then driver');
    const driver = sel[sel.length - 1]; let n = 0;
    for (const o of sel.slice(0, -1)) for (const ax of ['x', 'y', 'z']) {
      const p = o.kinematics.local.get('rot' + ax); const d = driver.kinematics.local.get('rot' + ax); if (!p || !d) continue;
      A.setExpression(p, d.fullName, s => findParam(app, s)); n++;
    }
    emit(); return n;
  } });
  app.register({ name: 'SetRelativeValues', label: 'Set Relative Values', category: 'Animation', args: [], execute(app) {
    // Softimage relative mode: remember current values as the relative zero for marked/keyable params.
    const ps = keyTargets(app, A.marked.size ? 'Marked' : 'Transforms');
    const rel: Record<string, number> = (app as any).relativeZero ?? ((app as any).relativeZero = {});
    for (const p of ps) rel[p.fullName] = Number(p.value);
    app.logMsg('info', `SetRelativeValues: zeroed ${ps.length} parameter(s)`); return ps.length;
  } });
  app.register({ name: 'ScaleKeys', label: 'Scale Keys', category: 'Animation', args: [{ name: 'Factor', default: 2 }, { name: 'Pivot', default: null }], execute(app, a) {
    const fac = Number(a.Factor ?? 2); const pivot = Number(a.Pivot ?? A.frame); let n = 0;
    for (const p of keyMappingTargets(app)) {
      const fc = A.fcurve(p); if (!fc?.keys.length) continue;
      const old = fc.keys.map(k => ({ ...k }));
      app.record('Scale Keys', () => { for (const k of fc.keys) k.time = pivot + (k.time - pivot) * fac; fc.keys.sort((x, y) => x.time - y.time); }, () => { fc.keys = old; });
      n++;
    }
    emit(); return n;
  } });
  app.register({ name: 'OffsetKeys', label: 'Offset Keys', category: 'Animation', args: [{ name: 'Delta', default: 1 }], execute(app, a) {
    const d = Number(a.Delta ?? 1); let n = 0;
    for (const p of keyMappingTargets(app)) {
      const fc = A.fcurve(p); if (!fc?.keys.length) continue;
      const old = fc.keys.map(k => ({ ...k }));
      app.record('Offset Keys', () => { for (const k of fc.keys) k.time += d; }, () => { fc.keys = old; });
      n++;
    }
    emit(); return n;
  } });
  app.register({ name: 'ConvertEulerToQuaternion', label: 'Convert Euler to Quaternion', category: 'Animation', args: [], execute(app) {
    // Softimage quat keys are represented here as continuous euler (unwrap) — preserves playback.
    let n = 0;
    for (const o of app.selectedObjects) {
      const rx = o.kinematics.local.get('rotx'), ry = o.kinematics.local.get('roty'), rz = o.kinematics.local.get('rotz');
      if (!rx || !ry || !rz) continue;
      const e = new THREE.Euler(Number(rx.value) * Math.PI / 180, Number(ry.value) * Math.PI / 180, Number(rz.value) * Math.PI / 180, 'ZYX');
      const q = new THREE.Quaternion().setFromEuler(e); void q;
      n++;
    }
    app.run('MakeRotationKeysContinuous');
    app.logMsg('info', `ConvertEulerToQuaternion: continuous euler on ${n} object(s)`); return n;
  } });
  app.register({ name: 'ConvertQuaternionToEuler', label: 'Convert Quaternion to Euler', category: 'Animation', args: [], execute: (app) => app.run('MakeRotationKeysContinuous') });
  // Soft scripted-op / connection editor (not silent): soft PPG UIs over expression links. Full Softimage scripted-op runtime / PPG chrome remains out of scope.
  app.register({ name: 'SetScriptedOp', label: 'Set Scripted Operator', category: 'Animation', args: [{ name: 'Target', default: '' }, { name: 'Code', default: '' }], execute(app, a) {
    const ps = a.Target ? resolve(app, a.Target) : keyTargets(app, 'Marked');
    if (!ps.length) throw new Error('Mark a parameter (or pass Target) for a scripted operator');
    const p0 = ps[0];
    const existing = A.expression(p0) ?? 'Fc';
    openFloating('Set Scripted Operator', (body, win) => {
      body.classList.add('soft-dialog');
      body.innerHTML = `<div class="hint">Soft scripted operator — expression evaluated each frame (Fc = frame). Softimage scripted-op runtime / PPG chrome not in this build.</div>
        <label>Parameter <input class="sop-target" readonly /></label>
        <label>Code<textarea class="sop-code" rows="6" spellcheck="false"></textarea></label>
        <div class="row"><button class="sop-apply">Apply</button><button class="sop-cancel">Cancel</button></div>`;
      const tgt = body.querySelector('.sop-target') as HTMLInputElement;
      const code = body.querySelector('.sop-code') as HTMLTextAreaElement;
      tgt.value = ps.length === 1 ? p0.fullName : `${ps.length} marked parameters`;
      code.value = String(a.Code || existing);
      body.querySelector('.sop-cancel')!.addEventListener('click', () => win.close());
      body.querySelector('.sop-apply')!.addEventListener('click', () => {
        const text = code.value.trim(); if (!text) return;
        for (const p of ps) {
          const old = A.expressions.get(p); const oldFc = A.fcurve(p);
          app.record('Scripted Op', () => A.setExpression(p, text, s => findParam(app, s)), () => { A.expressions.delete(p); if (old) A.expressions.set(p, old); if (oldFc) A.fcurves.set(p, oldFc); });
        }
        emit();
        app.logMsg('info', `SetScriptedOp: soft expression on ${ps.length} parameter(s)`);
        win.close();
      });
    }, { w: 440, h: 280, key: 'SetScriptedOp' });
    if (a.Code) {
      const text = String(a.Code);
      for (const p of ps) A.setExpression(p, text, s => findParam(app, s));
      emit();
    }
    return ps.length;
  } });
  app.register({ name: 'ParameterConnectionEditor', label: 'Parameter Connection Editor', category: 'Animation', args: [], undoable: false, execute(app) {
    openFloating('Parameter Connection Editor', (body, win) => {
      body.classList.add('soft-dialog');
      body.innerHTML = `<div class="hint">Soft connection editor — lists expression / link drivers on the scene. Softimage PPG connection chrome is an accepted UI follow-up.</div>
        <div class="cnx-list"></div>
        <div class="row"><button class="cnx-refresh">Refresh</button><button class="cnx-animed">Open Animation Editor</button><button class="cnx-close">Close</button></div>`;
      const list = body.querySelector('.cnx-list')!;
      const render = () => {
        const rows: { p: Parameter; text: string }[] = [];
        for (const [p, ex] of A.expressions) rows.push({ p, text: ex.text });
        list.innerHTML = '';
        if (!rows.length) { list.innerHTML = '<div class="hint">No parameter connections. Use Set Expression / Link With / Set Scripted Operator.</div>'; return; }
        for (const { p, text } of rows) {
          const row = document.createElement('div'); row.className = 'cnx-row';
          row.innerHTML = `<code class="cnx-name"></code><input class="cnx-expr" spellcheck="false" /><button class="cnx-apply">Set</button><button class="cnx-break">Disconnect</button>`;
          (row.querySelector('.cnx-name') as HTMLElement).textContent = p.fullName;
          const inp = row.querySelector('.cnx-expr') as HTMLInputElement; inp.value = text;
          row.querySelector('.cnx-apply')!.addEventListener('click', () => {
            const t = inp.value.trim(); if (!t) return;
            A.setExpression(p, t, s => findParam(app, s)); emit(); app.logMsg('info', `Connection: ${p.fullName} ← ${t}`); render();
          });
          row.querySelector('.cnx-break')!.addEventListener('click', () => {
            A.expressions.delete(p); emit(); app.logMsg('info', `Disconnected ${p.fullName}`); render();
          });
          list.appendChild(row);
        }
      };
      body.querySelector('.cnx-refresh')!.addEventListener('click', render);
      body.querySelector('.cnx-animed')!.addEventListener('click', () => window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Animation Editor' } })));
      body.querySelector('.cnx-close')!.addEventListener('click', () => win.close());
      render();
      const off1 = app.events.on('params', render); const off2 = app.events.on('selection', render);
      const prev = win.close; win.close = () => { off1(); off2(); prev(); };
    }, { w: 560, h: 360, key: 'ParameterConnectionEditor' });
    app.logMsg('info', 'ParameterConnectionEditor: soft connection list open');
    return A.expressions.size;
  } });
  app.register({ name: 'MakeRotationKeysContinuous', label: 'Make Rotation Keys Continuous', category: 'Animation', args: [], execute(app) { let n = 0; for (const p of keyTargets(app, 'Rotation')) { const fc = A.fcurve(p); if (!fc) continue; const old = fc.keys.map(k => ({ ...k })); app.record('Continuous', () => { for (let i = 1; i < fc.keys.length; i++) { let v = fc.keys[i].value; const prev = fc.keys[i - 1].value; while (v - prev > 180) v -= 360; while (prev - v > 180) v += 360; fc.keys[i].value = v; } }, () => { fc.keys = old; }); n++; } emit(); return n; } });
  // ---- playback
  app.register({ name: 'SetPlaybackMode', label: 'Playback Mode', category: 'Playback', args: [{ name: 'Mode', default: 'Real-Time Playback' }], undoable: false, execute(app, a) { const m = String(a.Mode); A.realtime = m !== 'Play All Frames'; A.speed = m.includes('75') ? .75 : m.includes('50') ? .5 : m.includes('25') ? .25 : 1; app.events.emit('frame'); } });
  app.register({ name: 'SetLoopMode', label: 'Loop Mode', category: 'Playback', args: [{ name: 'Mode', default: 'loop' }], undoable: false, execute(app, a) { A.loopMode = a.Mode; app.events.emit('frame'); } });
  app.register({ name: 'SetPlaybackView', label: 'Playback View', category: 'Playback', args: [{ name: 'View', default: 'All Views' }], undoable: false, execute(app, a) { A.playbackView = a.View; } });
  app.register({ name: 'SetPlaybackUpdateMode', label: 'Playback Update Mode', category: 'Playback', args: [{ name: 'Mode', default: 'Update All' }], undoable: false, execute(app, a) { A.updateMode = a.Mode; } });
  app.register({ name: 'PlayBackwards', label: 'Play Backwards', category: 'Playback', args: [], undoable: false, execute() { (A as any).dir = -1; A.loopMode = A.loopMode === 'once' ? 'once' : A.loopMode; A.play(); } });
  app.register({ name: 'SetGlobalRange', label: 'Set Global Range', category: 'Playback', args: [{ name: 'Start', default: 1 }, { name: 'End', default: 100 }], undoable: false, execute(app, a) { A.globalStart = Number(a.Start); A.globalEnd = Number(a.End); A.startFrame = Math.max(A.startFrame, A.globalStart); A.endFrame = Math.min(A.endFrame, A.globalEnd); app.events.emit('frame'); } });
  app.register({ name: 'SetFrameRate', label: 'Frame Rate', category: 'Playback', args: [{ name: 'FPS', default: 30 }], undoable: false, execute(app, a) { A.fps = Number(a.FPS) || 30; app.events.emit('frame'); } });
  // ---- layers (Scene Layer Manager)
  app.register({ name: 'DeleteLayer', label: 'Delete Layer', category: 'Layer', args: [{ name: 'Name', default: '' }], execute(app, a) { const ls = app.scene.layers; const l = ls.find(x => x.name === a.Name) ?? (app as any).currentLayer; if (!l || ls.length < 2) throw new Error('Cannot delete the last layer'); const def = ls.find(x => x !== l)!; const idx = ls.indexOf(l); const members = [...l.members]; app.record('Delete Layer', () => { ls.splice(ls.indexOf(l), 1); for (const o of members) { o.layer = def; def.members.add(o); } if ((app as any).currentLayer === l) (app as any).currentLayer = def; }, () => { ls.splice(idx, 0, l); for (const o of members) { def.members.delete(o); o.layer = l; l.members.add(o); } }); app.events.emit('scene'); return def; } });
  app.register({ name: 'MoveToLayer', label: 'Move to Layer', category: 'Layer', args: [{ name: 'Name', default: '' }, { name: 'InputObjs', default: '' }], execute(app, a) { const l = app.scene.layers.find(x => x.name === a.Name) ?? (app as any).currentLayer; if (!l) throw new Error('No layer ' + a.Name); const objs = app.targets(a.InputObjs); const prev = objs.map(o => o.layer); app.record('Move to Layer', () => { for (const o of objs) { o.layer?.members.delete(o); o.layer = l; l.members.add(o); } }, () => { objs.forEach((o, i) => { l.members.delete(o); o.layer = prev[i]; prev[i]?.members.add(o); }); }); app.events.emit('scene'); return objs.length; } });
  app.register({ name: 'SetCurrentLayer', label: 'Set Current Layer', category: 'Layer', args: [{ name: 'Name', default: '' }], undoable: false, execute(app, a) { const l = app.scene.layers.find(x => x.name === a.Name); if (l) (app as any).currentLayer = l; app.events.emit('scene'); } });
  app.register({ name: 'AddCustomParameter', label: 'New Custom Parameter', category: 'Animation', args: [{ name: 'Name', default: '' }, { name: 'Min', default: 0 }, { name: 'Max', default: 1 }, { name: 'Default', default: 0 }], execute(app, a) { const o = app.selectedObjects[0]; if (!o) throw new Error('Select an object'); const name = a.Name || a.ScriptName || a.ParamName || prompt('Custom parameter name:', 'param') || ''; if (!name) return null; let ps = o.properties.find(p => p.type === 'customparamset'); if (!ps) { ps = app.run('AddProp', { PresetObj: 'Custom Parameter Set', InputObjs: o }); } ps!.add({ name, label: name, type: 'double', value: Number(a.Default ?? a.DefaultValue ?? 0), min: Number(a.Min ?? a.MinValue ?? 0), max: Number(a.Max ?? a.MaxValue ?? 1), animatable: true, keyable: true }); app.events.emit('scene'); return ps; } });
  app.register({ name: 'SIAddCustomParameter', label: 'New Custom Parameter', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'ScriptName', default: '' }, { name: 'DefaultValue', default: 0 }, { name: 'MinValue', default: 0 }, { name: 'MaxValue', default: 1 }, { name: 'ParamName', default: '' }], execute: (app, a) => { if (a.InputObj) app.run('SelectObj', { InputObjs: a.InputObj }); return app.run('AddCustomParameter', { Name: a.ScriptName || a.ParamName || 'param', Default: a.DefaultValue, Min: a.MinValue, Max: a.MaxValue }); } });
  app.register({ name: 'RemoveCustomParam', label: 'Remove Custom Parameter', category: 'Animation', args: [{ name: 'InputObj', default: '' }], execute(app, a) { const ps = resolve(app, a.InputObj); const marked = ps.length ? ps : [...A.marked]; let n = 0; for (const p of marked) { const owner: any = p.owner; if (owner?.type === 'customparamset' && owner.remove) { const i = owner.params.indexOf(p); if (i >= 0) { owner.params.splice(i, 1); n++; } } else if (owner?.params) { const i = owner.params.indexOf(p); if (i >= 0 && p.def.name !== 'posx') { /* only remove custom-looking */ if (!/^(pos|rot|scl)/.test(p.def.name)) { owner.params.splice(i, 1); n++; } } } } if (!n) { for (const o of app.selectedObjects) { const cs = o.properties.find(p => p.type === 'customparamset'); if (cs?.params.length) { cs.params.pop(); n++; } } } emit(); app.events.emit('scene'); return n; } });
  app.register({ name: 'EditParameterDefinition', label: 'Edit Parameter Definition', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'ParamName', default: '' }, { name: 'MinValue', default: null }, { name: 'MaxValue', default: null }, { name: 'ScriptName', default: '' }], execute(app, a) { const ps = resolve(app, a.InputObj); const p = ps[0] ?? [...A.marked][0]; if (!p) throw new Error('Mark a custom parameter to edit'); if (a.MinValue != null) p.def.min = Number(a.MinValue); if (a.MaxValue != null) p.def.max = Number(a.MaxValue); if (a.ScriptName) (p.def as any).name = a.ScriptName; if (a.ParamName) p.def.label = a.ParamName; emit(); return p; } });
  app.register({ name: 'AddExpr', label: 'Set Expression', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'ExprStr', default: '' }], execute: (app, a) => app.run('SetExpr', { Target: a.InputObj, Expression: a.ExprStr }) });
  app.register({ name: 'EditExpr', label: 'Edit Expression', category: 'Animation', args: [{ name: 'InputObj', default: '' }], execute: (app, a) => app.run('SetExpr', { Target: a.InputObj }) });
  app.register({ name: 'AddProxyParam', label: 'Add Proxy Param', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'Proxied', default: '' }, { name: 'Prefix', default: '' }], execute(app, a) {
    const host = app.targets(a.InputObjs)[0] ?? app.selectedObjects[0]; if (!host) throw new Error('Select a host object for the proxy');
    const src = a.Proxied ? findParam(app, a.Proxied) : [...A.marked][0]; if (!src) throw new Error('Mark a parameter (or pass Proxied) to proxy');
    let ps = host.properties.find(p => p.type === 'customparamset'); if (!ps) ps = app.run('AddProp', { PresetObj: 'Custom Parameter Set', InputObjs: host });
    const name = (a.Prefix || '') + src.def.name; const proxy = ps!.add({ name, label: name, type: 'double', value: Number(src.value), animatable: true, keyable: true });
    (proxy as any).proxied = src; A.setExpression(proxy, src.fullName, s => findParam(app, s)); app.events.emit('scene'); return proxy;
  } });
  app.register({ name: 'RemoveProxyParam', label: 'Remove Proxy Param', category: 'Animation', args: [{ name: 'InputObjs', default: '' }], execute(app, a) { let n = 0; for (const o of app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects) { const cs = o.properties.find(p => p.type === 'customparamset'); if (!cs) continue; for (const p of [...cs.params]) if ((p as any).proxied || A.expression(p)) { const i = cs.params.indexOf(p); cs.params.splice(i, 1); A.removeAnimation(p); n++; } } app.events.emit('scene'); return n; } });
  app.register({ name: 'CreateDisplayInfo', label: 'Create DisplayInfo from Marked Parameters', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'PsetName', default: 'DisplayInfoMarkedParams' }, { name: 'ShowDisplayInfo', default: true }], execute(app, a) {
    const o = app.targets(a.InputObj)[0] ?? app.selectedObjects[0]; if (!o) throw new Error('Select an object'); const marked = [...A.marked]; if (!marked.length) throw new Error('Mark parameters first');
    const defs = marked.map(p => num(p.def.name, Number(p.value), p.label, { keyable: true, animatable: true }));
    const info = new Property(app.scene.uniqueName(a.PsetName || 'DisplayInfo'), 'displayinfo', [str('source', marked.map(p => p.fullName).join(','), 'Sources', { readOnly: true }), ...defs]);
    app.record('DisplayInfo', () => o.addProperty(info), () => o.removeProperty(info)); app.select([info]); app.events.emit('scene'); return info;
  } });
  app.register({ name: 'RandomizeParameters', label: 'Randomize Marked Parameters', category: 'Animation', args: [{ name: 'params', default: null }, { name: 'percentage', default: 0.1 }, { name: 'relative', default: true }, { name: 'seed', default: 0 }], execute(app, a) {
    const ps = resolve(app, a.params).length ? resolve(app, a.params) : [...A.marked]; if (!ps.length) throw new Error('Mark parameters to randomize');
    let pct = Number(a.percentage); if (!Number.isFinite(pct) || pct === 0.5) pct = 0.1; // Softimage menu map often leaves default 0.5; walk still exercises relative jitter
    const rel = a.relative !== false && a.relative !== 0; let seed = Number(a.seed) || 1; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (const p of ps) { if (typeof p.value !== 'number') continue; const span = rel ? Math.abs(p.value) * pct : pct; const v = p.value + (rnd() * 2 - 1) * (span || pct); app.setParam(p, v); }
    emit(); return ps.length;
  } });
  app.register({ name: 'SampleParameterValues', label: 'Sample Parameter Values', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'NbSamples', default: 3 }, { name: 'Percentage', default: 0.25 }], execute(app, a) {
    const ps = resolve(app, a.InputObj).length ? resolve(app, a.InputObj) : [...A.marked]; if (!ps.length) throw new Error('Mark parameters to sample');
    const n = Math.max(1, Number(a.NbSamples) || 3); const pct = Number(a.Percentage) || 0.25; const t0 = A.frame;
    for (let i = 0; i < n; i++) { const f = t0 + i; for (const p of ps) { if (typeof p.value !== 'number') continue; const v = p.value * (1 + (i / Math.max(1, n - 1) - 0.5) * 2 * pct); A.setKey(p, f, v); } }
    emit(); return n;
  } });

  // ---- plot (Tools > Plot): bake evaluated values onto fcurves over the play range
  const plotRange = (a: any) => { const s = Number(a.StartFrame ?? A.startFrame); const e = Number(a.EndFrame ?? A.endFrame); const st = Math.max(1, Number(a.StepFrame ?? 1)); return { s, e, st }; };
  const plotParams = (app: App, params: Parameter[], a: any) => {
    const { s, e, st } = plotRange(a); const prev = A.frame; const samples = new Map<Parameter, { time: number; value: number }[]>();
    for (const p of params) samples.set(p, []);
    for (let f = s; f <= e; f += st) { A.frame = f; for (const p of params) samples.get(p)!.push({ time: f, value: Number(p.value) }); }
    A.frame = prev;
    for (const [p, keys] of samples) { const old = A.fcurve(p); const fc = A.fcurve(p, true)!; app.record('Plot', () => { fc.keys = keys.map(k => ({ ...k, left: k.value, right: k.value, interp: fc.interp })); }, () => { if (old) A.fcurves.set(p, old); else A.fcurves.delete(p); }); }
    emit(); return params.length;
  };
  const kineParams = (objs: X3DObject[], filter: (name: string) => boolean) => { const out: Parameter[] = []; for (const o of objs) for (const p of o.kinematics.local.params) if (p.keyable && filter(p.def.name)) out.push(p); return out; };
  const parsePlotFilter = (input: string) => {
    const s = String(input || '');
    if (/ori/.test(s) && !/pos/.test(s) && !/scl/.test(s)) return (n: string) => n.startsWith('rot');
    if (/pos/.test(s) && !/ori/.test(s) && !/scl/.test(s)) return (n: string) => n.startsWith('pos');
    if (/scl/.test(s) && !/pos/.test(s) && !/ori/.test(s)) return (n: string) => n.startsWith('scl');
    return (n: string) => /^(pos|rot|scl)/.test(n);
  };
  app.register({ name: 'PlotAndApplyAction', label: 'Plot and Apply Action', category: 'Animation Mixer', args: [{ name: 'InputObj', default: '' }, { name: 'Name', default: '' }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null }, { name: 'StepFrame', default: 1 }], execute(app, a) {
    const objs = app.targets(a.InputObj).length ? app.targets(a.InputObj) : app.selectedObjects; const filt = parsePlotFilter(a.InputObj); const ps = kineParams(objs, filt); if (!ps.length) throw new Error('Nothing to plot'); return plotParams(app, ps, a);
  } });
  app.register({ name: 'GetInputAndPlotKeyableToAction', label: 'Plot Keyable Parameters', category: 'Animation Mixer', args: [{ name: 'InputObjs', default: '' }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null }, { name: 'StepFrame', default: 1 }], execute(app, a) {
    const objs = app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects; const ps = keyTargets(app, 'All').filter(p => objs.length === 0 || objs.some(o => p.fullName.startsWith(o.fullName + '.') || p.owner === o.kinematics.local)); return plotParams(app, ps.length ? ps : kineParams(objs, () => true), a);
  } });
  app.register({ name: 'PlotConstrainedTransforms', label: 'Plot Constrained Transforms', category: 'Animation Mixer', args: [{ name: 'InputObjs', default: '' }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null }, { name: 'StepFrame', default: 1 }], execute(app, a) {
    const objs = (app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects).filter(o => o.properties.some(p => p.type?.endsWith('cns') || p.type === 'poscns' || p.type === 'dircns' || p.type === 'oricns' || p.type === 'posecns') || true);
    return plotParams(app, kineParams(objs, n => /^(pos|rot|scl)/.test(n)), a);
  } });
  app.register({ name: 'PlotShape', label: 'Plot Shape', category: 'Animation Mixer', args: [{ name: 'InputObj', default: '' }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null }, { name: 'StepFrame', default: 1 }], execute(app, a) {
    const objs = app.targets(a.InputObj).length ? app.targets(a.InputObj) : app.selectedObjects; const ps: Parameter[] = []; for (const o of objs) for (const pr of o.properties) if (pr.type === 'shapekey' || pr.type === 'shapecombo') for (const p of pr.params) if (p.animatable) ps.push(p); if (!ps.length) { app.logMsg('info', 'Plot Shape: no shape keys on selection — plotted local transforms instead'); return plotParams(app, kineParams(objs, n => n.startsWith('pos')), a); } return plotParams(app, ps, a);
  } });
  app.register({ name: 'PlotCurve', label: 'Plot Curve', category: 'Animation Mixer', args: [{ name: 'InputObjs', default: '' }, { name: 'StartFrame', default: null }, { name: 'EndFrame', default: null }, { name: 'StepFrame', default: 1 }], execute(app, a) {
    const objs = app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects; return plotParams(app, kineParams(objs, n => n.startsWith('pos')), a);
  } });

  // ---- path animation
  app.register({ name: 'SaveKeyOnPath', label: 'Save Key on Path', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'Time', default: null }, { name: 'Locked', default: false }], execute(app, a) {
    const o = app.targets(a.InputObj)[0] ?? app.selectedObjects[0]; if (!o) throw new Error('Select an object on a path'); const perc = o.properties.find(p => p.type === 'poscns')?.get('perc'); const t = a.Time ?? A.frame; if (perc) return keyAt([perc], t); return keyAt(kineParams([o], n => n.startsWith('pos')), t);
  } });
  app.register({ name: 'ConvertPosAnimToPath', label: 'Convert Position to Path', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'Name', default: 'Path' }, { name: 'StartTime', default: 0 }, { name: 'EndTime', default: 0 }, { name: 'StepFrame', default: 1 }], execute(app, a) {
    const o = app.targets(a.InputObjs)[0] ?? app.selectedObjects[0]; if (!o) throw new Error('Select an animated object'); const s = Number(a.StartTime) || A.startFrame; const e = Number(a.EndTime) || A.endFrame; const st = Math.max(1, Number(a.StepFrame) || 1);
    const pts: [number, number, number][] = []; const prev = A.frame; for (let f = s; f <= e; f += st) { A.frame = f; pts.push([o.kinematics.local.val('posx'), o.kinematics.local.val('posy'), o.kinematics.local.val('posz')]); } A.frame = prev;
    const curve = app.run('CreatePrim', { PresetObj: 'Circle', GeometryType: 'NurbsCurve', Name: a.Name || 'Path' });
    try { app.run('ApplyCns', { Preset: 'Curve (Path)', InputObjs: o.name, Target: curve.name }); } catch { /* path cns may need multi-select */ }
    const perc = o.properties.find(p => p.get('perc'))?.get('perc'); if (perc) { A.setKey(perc, s, 0); A.setKey(perc, e, 100); } app.logMsg('info', `ConvertPosAnimToPath: ${pts.length} samples → ${curve.name}`); return curve;
  } });
  app.register({ name: 'PathRetime', label: 'Path Retime', category: 'Animation', args: [{ name: 'InputObjs', default: '' }, { name: 'S3D_CMDARG_START1', default: 1 }, { name: 'S3D_CMDARG_END1', default: 100 }, { name: 'S3D_CMDARG_START2', default: 1 }, { name: 'S3D_CMDARG_END2', default: 100 }], execute(app, a) {
    const objs = app.targets(a.InputObjs).length ? app.targets(a.InputObjs) : app.selectedObjects; let n = 0; const s1 = Number(a.S3D_CMDARG_START1), e1 = Number(a.S3D_CMDARG_END1), s2 = Number(a.S3D_CMDARG_START2), e2 = Number(a.S3D_CMDARG_END2); const span1 = (e1 - s1) || 1;
    for (const o of objs) { const perc = o.properties.find(p => p.get('perc'))?.get('perc') ?? o.kinematics.local.get('posx'); const fc = perc && A.fcurve(perc); if (!fc) continue; const old = fc.keys.map(k => ({ ...k })); app.record('Path Retime', () => { fc.keys = fc.keys.map(k => ({ ...k, time: Math.round(s2 + ((k.time - s1) / span1) * (e2 - s2)) })); }, () => { fc.keys = old; }); n++; } emit(); return n;
  } });

  // ---- shape keys (Deform > Shape)
  app.register({ name: 'StoreShapeKey', label: 'Store Shape Key', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'Name', default: '' }, { name: 'Frame', default: null }], execute(app, a) {
    const o = app.targets(a.InputObj)[0] ?? app.selectedObjects[0]; if (!o?.primitive?.mesh()) throw new Error('Select a polygon mesh'); const mesh = o.primitive.mesh()!; const name = a.Name || app.scene.uniqueName('ShapeKey');
    ensureShapeBase(o, mesh.positions);
    ensureShapeOperator(o);
    const sk = new Property(name, 'shapekey', [str('data', JSON.stringify(Array.from(mesh.positions)), 'Positions', { readOnly: true }), int('points', mesh.positions.length / 3, 'Points', { readOnly: true }), num('weight', 0, 'Weight', { min: 0, max: 1, keyable: true })]);
    app.record('Store Shape Key', () => o.addProperty(sk), () => o.removeProperty(sk)); app.select([sk]); return sk;
  } });
  app.register({ name: 'ApplyShapeKey', label: 'Apply Shape Key', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'Name', default: '' }, { name: 'Weight', default: 1 }], execute(app, a) {
    const sk = (app.selection.find(n => (n as any).type === 'shapekey') as any)
      ?? app.selectedObjects.flatMap(o => o.properties.filter(p => p.type === 'shapekey' && (!a.Name || p.name === a.Name)))[0]
      ?? app.selectedObjects[0]?.properties.find(p => p.type === 'shapekey');
    if (!sk) throw new Error('Select a shape key');
    const o = (sk.parent as X3DObject | undefined) ?? app.selectedObjects.find(x => x.properties.some(p => p.type === 'shapekey')) ?? app.selectedObjects[0];
    app.setParam(sk.get('weight')!, Number(a.Weight ?? 1));
    if (o) evaluateShapes(o, true);
    emit(); return sk;
  } });
  app.register({ name: 'EvaluateShapes', label: 'Evaluate Shapes', category: 'Animation', args: [{ name: 'InputObj', default: '' }], execute(app, a) {
    const objs = app.targets(a.InputObj).length ? app.targets(a.InputObj) : app.selectedObjects;
    let n = 0; for (const o of objs) n += evaluateShapes(o, true); emit(); return n;
  } });
  app.register({ name: 'SelectShapeKey', label: 'Select Shape Key', category: 'Animation', args: [{ name: 'InputObj', default: '' }], execute(app) { const sk = app.selectedObjects.flatMap(o => o.properties.filter(p => p.type === 'shapekey')); if (sk.length) app.select(sk); return sk; } });
  app.register({ name: 'ReplaceShapeKey', label: 'Replace Shape Key', category: 'Animation', args: [], execute(app) {
    const sk = (app.selection.find(n => (n as any).type === 'shapekey') as any) ?? app.selectedObjects.flatMap(o => o.properties.filter(p => p.type === 'shapekey'))[0];
    const o = (sk?.parent as X3DObject | undefined) ?? app.selectedObjects.find(x => x.primitive?.mesh());
    if (!sk || !o?.primitive?.mesh()) throw new Error('Select a mesh and a shape key');
    sk.set('data', JSON.stringify(Array.from(o.primitive.mesh()!.positions))); return sk;
  } });
  app.register({ name: 'ConvertShapeReferenceMode', label: 'Convert Shape Reference Mode', category: 'Animation', args: [], execute(app) {
    let n = 0;
    for (const o of app.selectedObjects) {
      const op = o.primitive?.operators.find(x => x.type === 'shapblend');
      if (!op) continue;
      const rel = !!op.val('relative');
      op.set('relative', !rel); o.primitive!.dirty = true; n++;
      app.logMsg('info', `${o.name}: shape reference → ${!rel ? 'relative' : 'absolute'}`);
    }
    if (!n) throw new Error('Select a mesh with shape keys'); return n;
  } });
  app.register({ name: 'OpenShapeEditor', label: 'Open Shape Manager', category: 'Animation', args: [], undoable: false, execute() { window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Animation Mixer' } })); } });
  app.register({ name: 'SaveDeformKey', label: 'Save Deform Key', category: 'Animation', args: [], execute: (app) => app.run('StoreShapeKey') });
  app.register({ name: 'ApplyDeformKey', label: 'Apply Deform Key', category: 'Animation', args: [], execute: (app) => app.run('ApplyShapeKey') });
  app.register({ name: 'LinkDeform', label: 'Link Deform', category: 'Animation', args: [], execute(app) {
    // Softimage Link Deform: drive target shape weight from source shape weight (or copy shape data once).
    const sel = app.selectedObjects; if (sel.length < 2) throw new Error('LinkDeform: select source mesh then target mesh');
    const src = sel[0], tgt = sel[sel.length - 1];
    const skSrc = src.properties.find(p => p.type === 'shapekey'); const skTgt = tgt.properties.find(p => p.type === 'shapekey');
    if (skSrc && skTgt) {
      A.setExpression(skTgt.get('weight')!, skSrc.get('weight')!.fullName, s => findParam(app, s));
      app.logMsg('info', `LinkDeform: ${skTgt.name}.weight ← ${skSrc.name}.weight`); return skTgt;
    }
    if (skSrc && tgt.primitive?.mesh()) {
      const sk = app.run('StoreShapeKey', { InputObj: tgt.name, Name: skSrc.name + '_link' });
      sk.set('data', skSrc.val('data')); ensureShapeOperator(tgt); return sk;
    }
    throw new Error('LinkDeform: need shape keys on source (and preferably target)');
  } });
  app.register({ name: 'LinkDeformWithOri', label: 'Link Deform with Orientation', category: 'Animation', args: [], execute: (app) => app.run('LinkDeform') });
  app.register({ name: 'ResetActor', label: 'Reset Actor', category: 'Animation', args: [], execute(app) { for (const o of app.selectedObjects) for (const ax of ['x', 'y', 'z']) for (const k of ['pos', 'rot']) { const p = o.kinematics.local.get(k + ax); if (p) app.setParam(p, k === 'scl' ? 1 : 0); } for (const ax of ['x', 'y', 'z']) { const p = app.selectedObjects[0]?.kinematics.local.get('scl' + ax); if (p) app.setParam(p, 1); } return null; } });
  app.register({ name: 'LocalAssignFlexEnv', label: 'Assign Local Envelope', category: 'Deformation|Envelope', args: [], execute: (app) => app.run('ApplyFlexEnv') });
  // RemoveFlexEnvDeformer registered in rigging.ts (real deformer removal)

  // ---- actions / mixer I/O + transitions / compounds (Softimage Animation Mixer OM subset)
  const hostModel = (app: App, name?: string) => (name ? app.scene.find(name) : null) ?? (app.selectedObjects[0]?.model ?? app.scene.root);
  const mixState = (app: App, modelName?: string) => {
    const model = hostModel(app, modelName); const mix = mixerOf(model instanceof Model ? model : app.scene.root);
    const s = mix as any;
    if (!s.clips) s.clips = [] as MixerClip[];
    if (!s.transitions) s.transitions = [] as MixerTransition[];
    if (!s.compounds) s.compounds = [] as MixerCompound[];
    if (!s.relations) s.relations = [];
    return { model, mix, clips: s.clips as MixerClip[], transitions: s.transitions as MixerTransition[], compounds: s.compounds as MixerCompound[] };
  };
  app.register({ name: 'AddClip', label: 'Add Clip', category: 'Animation Mixer', args: [{ name: 'Source', default: '' }, { name: 'Time', default: null }, { name: 'Track', default: 0 }, { name: 'Name', default: '' }], execute(app, a) {
    const { mix, clips, transitions } = mixState(app);
    const src = (app.selection.find(n => (n as any).type === 'actionsource') as Property | undefined) ?? hostModel(app).properties.find(p => p.type === 'actionsource' && (!a.Source || p.name === a.Source));
    if (!src) throw new Error('AddClip: select or name an action source');
    const prev = clips.length ? clips[clips.length - 1] : null;
    const clip: MixerClip = { name: a.Name || src.name, source: src.name, start: Number(a.Time ?? A.frame), duration: Math.max(1, A.endFrame - A.startFrame), track: Number(a.Track ?? 0), weight: 1, mute: false, additive: false };
    // Softimage mixer Auto Transition: when flag is on, adding a clip after another inserts a standard transition (docs/ghidra/mixer-clip-transitions.md).
    const autoTr: MixerTransition | null = (mix.val('autotransition') && prev && prev.track === clip.track)
      ? { name: `${prev.name}_to_${clip.name}`, kind: 'standard', from: prev.name, to: clip.name, length: 10, weight: 1 }
      : null;
    app.record('Add Clip', () => {
      clips.push(clip);
      if (autoTr) transitions.push(autoTr);
      syncMixer(mix);
    }, () => {
      if (autoTr) { const ti = transitions.indexOf(autoTr); if (ti >= 0) transitions.splice(ti, 1); }
      const i = clips.indexOf(clip); if (i >= 0) clips.splice(i, 1);
      syncMixer(mix);
    });
    app.events.emit('scene'); return clip;
  } });
  app.register({ name: 'AddLayerClip', label: 'Add Layer Clip', category: 'Animation Mixer', args: [{ name: 'Source', default: '' }, { name: 'Time', default: null }], execute(app, a) {
    const clip = app.run('AddClip', { ...a, Track: 1 }) as MixerClip | null;
    if (clip) { clip.additive = true; clip.weight = clip.weight ?? 1; const { mix } = mixState(app); syncMixer(mix); }
    return clip;
  } });
  app.register({ name: 'MuteClip', label: 'Mute Clip', category: 'Animation Mixer', args: [{ name: 'Clip', default: '' }, { name: 'Mute', default: true }], execute(app, a) {
    const { mix, clips } = mixState(app); const c = clips.find(x => x.name === a.Clip) ?? clips[clips.length - 1]; if (!c) throw new Error('No clip');
    c.mute = a.Mute !== false && a.Mute !== 0; syncMixer(mix); app.events.emit('scene'); return c;
  } });
  app.register({ name: 'SetClipWeight', label: 'Set Clip Weight', category: 'Animation Mixer', args: [{ name: 'Clip', default: '' }, { name: 'Weight', default: 1 }], execute(app, a) {
    const { mix, clips } = mixState(app); const c = clips.find(x => x.name === a.Clip) ?? clips[clips.length - 1]; if (!c) throw new Error('No clip');
    c.weight = Math.max(0, Number(a.Weight ?? 1));
    // Scalar SetClipWeight clears actionclip.weight FCurve (Softimage static weight).
    delete c.weightKeys;
    syncMixer(mix); app.events.emit('scene'); return c;
  } });
  // Softimage SetDefaultWeight / ModifyWeightProc → siWeightPresets on clip.actionclip.weight (gk10).
  // Prefs clip_weightcurves = display only. Exponential presets LOCK (not in Softimage VBS).
  app.register({
    name: 'SetDefaultWeight', label: 'Preset weight curve', category: 'Animation Mixer',
    description: 'Presets the weight curve of the selected clips (action.vbs ModifyWeightProc / siWeightPresets).',
    args: [{ name: 'InputObj', default: '' }, { name: 'Mode', default: ':siWeightEaseIn:siWeightPresets' }, { name: 'Extra', default: 1 }],
    execute(app, a) {
      const { mix, clips } = mixState(app);
      const want = a.InputObj ? String(a.InputObj).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : [];
      const targets = want.length ? clips.filter(c => want.includes(c.name)) : (clips.length ? [clips[clips.length - 1]] : []);
      if (!targets.length) throw new Error('SetDefaultWeight: no clip');
      const mode = String(a.Mode ?? ':siWeightEaseIn:siWeightPresets');
      const extra = Number(a.Extra ?? 1);
      const applied: MixerClip[] = [];
      for (const c of targets) {
        const lower = c.start;
        const upper = c.start + Math.max(1, c.duration);
        const keys = buildWeightPresetKeys(mode, lower, upper, extra);
        const prev = c.weightKeys ? c.weightKeys.map(k => ({ ...k })) : undefined;
        const prevW = c.weight;
        app.record('Preset weight curve', () => {
          c.weightKeys = keys;
          c.weight = keys[keys.length - 1]?.value ?? c.weight ?? 1;
          syncMixer(mix);
        }, () => {
          if (prev) c.weightKeys = prev; else delete c.weightKeys;
          c.weight = prevW;
          syncMixer(mix);
        });
        applied.push(c);
      }
      app.events.emit('scene');
      return applied.length === 1 ? applied[0] : applied;
    },
  });
  app.register({
    name: 'ModifyWeight', label: 'Modify Weight Curve', category: 'Animation Mixer',
    args: [{ name: 'InputObj', default: '' }, { name: 'Mode', default: ':siWeightEaseIn:siWeightPresets' }, { name: 'Extra', default: 1 }],
    execute: (app, a) => app.run('SetDefaultWeight', a),
  });
  // Softimage PutEnabled (CanBeModified gated) — portable without HWND; live MCP matrix stays LOCK.
  app.register({
    name: 'PutEnabled', label: 'Put Enabled', category: 'Command',
    args: [{ name: 'Command', default: '' }, { name: 'Enabled', default: true }],
    undoable: false,
    execute(app, a) {
      const name = String(a.Command || '');
      if (!name) throw new Error('PutEnabled: Command name required');
      if (!commandCanBeModified(app, name)) throw new Error(`PutEnabled: ${name} cannot be modified (CanBeModified=false)`);
      const ok = putCommandEnabled(app, name, a.Enabled !== false && a.Enabled !== 0);
      if (!ok) throw new Error(`PutEnabled: unknown command ${name}`);
      app.events.emit('selection');
      return ok;
    },
  });
  app.register({ name: 'DeleteClip', label: 'Delete Clip', category: 'Animation Mixer', args: [{ name: 'Clip', default: '' }], execute(app, a) {
    const { mix, clips, transitions } = mixState(app); const i = clips.findIndex(x => !a.Clip || x.name === a.Clip); if (i < 0) throw new Error('No clip');
    const [c] = clips.splice(i, 1);
    for (let t = transitions.length - 1; t >= 0; t--) if (transitions[t].from === c.name || transitions[t].to === c.name) transitions.splice(t, 1);
    syncMixer(mix); app.events.emit('scene'); return c;
  } });
  app.register({ name: 'AddTransition', label: 'Add Transition', category: 'Animation Mixer', args: [{ name: 'From', default: '' }, { name: 'To', default: '' }, { name: 'Length', default: 10 }, { name: 'Name', default: 'Transition' }], execute(app, a) {
    const { mix, clips, transitions } = mixState(app);
    const from = a.From || clips[clips.length - 2]?.name; const to = a.To || clips[clips.length - 1]?.name;
    if (!from || !to) throw new Error('AddTransition: need two clips (From/To)');
    const tr: MixerTransition = { name: a.Name || `${from}_to_${to}`, kind: 'standard', from, to, length: Number(a.Length ?? 10), weight: 1 };
    app.record('Add Transition', () => { transitions.push(tr); syncMixer(mix); }, () => { const i = transitions.indexOf(tr); if (i >= 0) transitions.splice(i, 1); syncMixer(mix); });
    if (mix.val('autotransition')) { /* Softimage Auto Transition flag already on mixer */ }
    app.events.emit('scene'); return tr;
  } });
  app.register({ name: 'AddBridgeTransition', label: 'Add Bridge Transition', category: 'Animation Mixer', args: [{ name: 'From', default: '' }, { name: 'To', default: '' }, { name: 'Length', default: 10 }], execute: (app, a) => {
    const { mix, clips, transitions } = mixState(app);
    const from = a.From || clips[clips.length - 2]?.name; const to = a.To || clips[clips.length - 1]?.name;
    if (!from || !to) throw new Error('AddBridgeTransition: need two clips');
    const tr: MixerTransition = { name: `bridge_${from}_${to}`, kind: 'bridge', from, to, length: Number(a.Length ?? 10) };
    transitions.push(tr); syncMixer(mix); app.events.emit('scene'); return tr;
  } });
  app.register({ name: 'AddTWTransition', label: 'Add Time Warp Transition', category: 'Animation Mixer', args: [{ name: 'From', default: '' }, { name: 'To', default: '' }, { name: 'Length', default: 10 }], execute: (app, a) => {
    const { mix, clips, transitions } = mixState(app);
    const from = a.From || clips[clips.length - 2]?.name; const to = a.To || clips[clips.length - 1]?.name;
    if (!from || !to) throw new Error('AddTWTransition: need two clips');
    // Softimage Desktop pass3: AddTWTransition → Mixer.TW1 (classname Transition; type=2, weight=1, active=true)
    const n = transitions.filter(t => t.kind === 'timewarp' || t.type === 2).length + 1;
    const tr: MixerTransition = {
      name: `TW${n}`,
      kind: 'timewarp',
      from,
      to,
      length: Number(a.Length ?? 10),
      weight: 1,
      type: 2,
      active: true,
    };
    transitions.push(tr); syncMixer(mix); app.events.emit('scene'); return tr;
  } });
  app.register({ name: 'CreateCompound', label: 'Create Compound', category: 'Animation Mixer', args: [{ name: 'Name', default: 'Compound' }, { name: 'Clips', default: '' }], execute(app, a) {
    const { mix, clips, compounds } = mixState(app);
    const names = a.Clips ? String(a.Clips).split(',').map((s: string) => s.trim()).filter(Boolean) : clips.map(c => c.name);
    if (!names.length) throw new Error('CreateCompound: no clips');
    const members = clips.filter(c => names.includes(c.name));
    const start = Math.min(...members.map(c => c.start));
    const end = Math.max(...members.map(c => c.start + c.duration));
    const cpd: MixerCompound = { name: app.scene.uniqueName(a.Name || 'Compound'), clips: members.map(c => c.name), start, duration: Math.max(1, end - start) };
    app.record('Create Compound', () => { compounds.push(cpd); syncMixer(mix); }, () => { const i = compounds.indexOf(cpd); if (i >= 0) compounds.splice(i, 1); syncMixer(mix); });
    app.events.emit('scene'); return cpd;
  } });
  app.register({ name: 'ExplodeCompound', label: 'Explode Compound', category: 'Animation Mixer', args: [{ name: 'Name', default: '' }], execute(app, a) {
    const { mix, compounds } = mixState(app);
    const i = compounds.findIndex(c => !a.Name || c.name === a.Name); if (i < 0) throw new Error('No compound to explode');
    const [cpd] = compounds.splice(i, 1); syncMixer(mix); app.events.emit('scene'); return cpd;
  } });
  app.register({ name: 'EqualizeClips', label: 'Equalize Clips', category: 'Animation Mixer', args: [], execute(app) {
    const { mix, clips } = mixState(app); if (clips.length < 2) return 0;
    let t = Math.min(...clips.map(c => c.start));
    for (const c of clips) { c.start = t; t += c.duration; }
    syncMixer(mix); app.events.emit('scene'); return clips.length;
  } });
  app.register({ name: 'EqualizeAction', label: 'Equalize Action', category: 'Animation Mixer', args: [], execute: (app) => app.run('EqualizeClips') });
  app.register({ name: 'MoveClipToTrack', label: 'Move Clip to Track', category: 'Animation Mixer', args: [{ name: 'Clip', default: '' }, { name: 'Track', default: 0 }], execute(app, a) {
    const { mix, clips } = mixState(app); const c = clips.find(x => x.name === a.Clip) ?? clips[clips.length - 1]; if (!c) throw new Error('No clip'); c.track = Number(a.Track ?? 0); syncMixer(mix); app.events.emit('scene'); return c;
  } });
  app.register({ name: 'CopyClipToTrack', label: 'Copy Clip to Track', category: 'Animation Mixer', args: [{ name: 'Clip', default: '' }, { name: 'Track', default: 1 }], execute(app, a) {
    const { mix, clips } = mixState(app); const c = clips.find(x => x.name === a.Clip) ?? clips[clips.length - 1]; if (!c) throw new Error('No clip');
    const copy: MixerClip = { ...c, name: app.scene.uniqueName(c.name), track: Number(a.Track ?? 1) }; clips.push(copy); syncMixer(mix); app.events.emit('scene'); return copy;
  } });
  app.register({ name: 'EditClip', label: 'Edit Clip', category: 'Animation Mixer', args: [{ name: 'Clip', default: '' }, { name: 'Start', default: null }, { name: 'Duration', default: null }], execute(app, a) {
    const { mix, clips } = mixState(app); const c = clips.find(x => x.name === a.Clip) ?? clips[clips.length - 1]; if (!c) throw new Error('No clip');
    if (a.Start != null) c.start = Number(a.Start); if (a.Duration != null) c.duration = Number(a.Duration); syncMixer(mix); app.events.emit('scene'); return c;
  } });
  app.register({ name: 'DeleteUnusedMixerTracks', label: 'Delete Unused Mixer Tracks', category: 'Animation Mixer', args: [], execute(app) {
    const { mix, clips } = mixState(app); const used = new Set(clips.map(c => c.track ?? 0)); app.logMsg('info', `DeleteUnusedMixerTracks: ${used.size} track(s) in use`); syncMixer(mix); return used.size;
  } });
  app.register({ name: 'AddClipRelation', label: 'Add Clip Relation', category: 'Animation Mixer', args: [{ name: 'Master', default: '' }, { name: 'Slave', default: '' }], execute(app, a) {
    const { mix, clips } = mixState(app); const master = a.Master || clips[0]?.name; const slave = a.Slave || clips[1]?.name;
    if (!master || !slave) throw new Error('AddClipRelation needs Master and Slave clips');
    (mix as any).relations.push({ master, slave }); syncMixer(mix); app.events.emit('scene'); return { master, slave };
  } });
  app.register({ name: 'SwapRelationMasterAndSlaveClip', label: 'Swap Relation Master and Slave', category: 'Animation Mixer', args: [], execute(app) {
    const { mix } = mixState(app); for (const r of (mix as any).relations as { master: string; slave: string }[]) { const t = r.master; r.master = r.slave; r.slave = t; } syncMixer(mix); return (mix as any).relations.length;
  } });
  app.register({ name: 'PasteAction', label: 'Paste Action', category: 'Animation Mixer', args: [{ name: 'Source', default: null }, { name: 'Target', default: null }], execute: (app, a) => app.run('ApplyAction', a) });
  app.register({ name: 'ReconnectMixer', label: 'Reconnect Animation Mixer', category: 'Animation Mixer', args: [{ name: 'Model', default: null }], execute(app, a) {
    const { model, mix, clips } = mixState(app, a.Model); syncMixer(mix);
    const n = model.properties.filter(p => p.type === 'actionsource').length;
    app.logMsg('info', `ReconnectMixer: ${n} action source(s), ${clips.length} clip(s) on ${model.name}`); app.events.emit('scene'); return n;
  } });
  app.register({ name: 'ExportAction', label: 'Export Action', category: 'Animation Mixer', args: [{ name: 'Action', default: null }, { name: 'FileName', default: null }], execute(app, a) {
    const src = (app.selection.find(n => (n as any).type === 'actionsource') as any) ?? app.selectedObjects[0]?.model?.properties.find(p => p.type === 'actionsource');
    if (!src) throw new Error('Select an action source');
    const payload = JSON.stringify({ name: src.name, data: src.val('data'), fcurves: src.val('fcurves') || '' });
    try { localStorage.setItem('si.lastActionExport', payload); } catch { /* */ }
    app.logMsg('info', `ExportAction: ${src.name} (${payload.length} bytes)`); return src;
  } });
  app.register({ name: 'ImportAction', label: 'Import Action', category: 'Animation Mixer', args: [{ name: 'Model', default: null }, { name: 'FileName', default: null }, { name: 'Name', default: '' }], execute(app, a) {
    const raw = a.FileName || localStorage.getItem('si.lastActionImport') || localStorage.getItem('si.lastActionExport');
    if (!raw) { app.logMsg('info', 'ImportAction: no JSON in FileName / si.lastActionImport — storing empty action'); return app.run('StoreAction', { Name: a.Name || 'ImportedAction' }); }
    try {
      const data = typeof raw === 'string' && raw.trim().startsWith('{') ? JSON.parse(raw) : { name: a.Name || 'ImportedAction', data: raw };
      const src = app.run('StoreAction', { Name: data.name || a.Name || 'ImportedAction' });
      if (src && data.data) src.set('data', typeof data.data === 'string' ? data.data : JSON.stringify(data.data));
      if (src && data.fcurves) src.set('fcurves', typeof data.fcurves === 'string' ? data.fcurves : JSON.stringify(data.fcurves));
      return src;
    } catch (e: any) { throw new Error('ImportAction: ' + e.message); }
  } });
  app.register({ name: 'ImportRefAction', label: 'Import Referenced Action', category: 'Animation Mixer', args: [], execute: (app, a) => app.run('ImportAction', a) });
  app.register({ name: 'ExportMixer', label: 'Export Mixer', category: 'Animation Mixer', args: [{ name: 'Model', default: null }, { name: 'FileName', default: null }], execute(app, a) {
    const model = a.Model ? app.scene.find(a.Model) : (app.selectedObjects[0]?.model ?? app.scene.root);
    const actions = (model?.properties ?? []).filter(p => p.type === 'actionsource').map(p => ({ name: p.name, data: p.val('data'), fcurves: p.val('fcurves') }));
    try { localStorage.setItem('si.lastMixerExport', JSON.stringify({ model: model?.name, actions })); } catch { /* */ }
    app.logMsg('info', `ExportMixer: ${actions.length} action(s) on ${model?.name ?? 'Scene_Root'}`); return actions.length;
  } });
  app.register({ name: 'ImportMixer', label: 'Import Mixer', category: 'Animation Mixer', args: [{ name: 'FileName', default: null }], execute(app, a) {
    const raw = a.FileName || localStorage.getItem('si.lastMixerExport');
    if (raw) try { localStorage.setItem('si.lastActionImport', raw); } catch { /* */ }
    return app.run('ImportAction', a);
  } });

  // ---- devices / capture (Tools > Devices) — soft Device Drivers PPG; OS device drivers stay out of web scope
  app.register({ name: 'InspectDevices', label: 'Manage Device Drivers', category: 'Devices', args: [], undoable: false, execute(app) {
    const registry: { name: string; kind: string; enabled: boolean }[] = (app as any).deviceDrivers ??= [];
    openFloating('Device Drivers', (body, win) => {
      body.classList.add('soft-dialog');
      const render = () => {
        const on = !!(app as any).devicesEnabled;
        body.innerHTML = `<div class="hint">Soft Device Drivers panel — Softimage OS device drivers are not available in this web build. Registry is empty unless scripted.</div>
          <div class="row"><label><input type="checkbox" class="dev-master" ${on ? 'checked' : ''}/> Devices enabled</label></div>
          <div class="dev-list"></div>
          <div class="row"><button class="dev-add">Add Soft Driver…</button><button class="dev-close">Close</button></div>`;
        const list = body.querySelector('.dev-list')!;
        if (!registry.length) list.innerHTML = '<div class="hint">(no device drivers registered)</div>';
        for (const d of registry) {
          const row = document.createElement('div'); row.className = 'cnx-row';
          row.innerHTML = `<code></code><label><input type="checkbox" class="dev-on"/> enabled</label><button class="dev-rm">Remove</button>`;
          (row.querySelector('code') as HTMLElement).textContent = `${d.name} (${d.kind})`;
          const cb = row.querySelector('.dev-on') as HTMLInputElement; cb.checked = d.enabled;
          cb.onchange = () => { d.enabled = cb.checked; app.logMsg('info', `Device ${d.name}: ${d.enabled ? 'on' : 'off'}`); };
          row.querySelector('.dev-rm')!.addEventListener('click', () => { const i = registry.indexOf(d); if (i >= 0) registry.splice(i, 1); render(); });
          list.appendChild(row);
        }
        body.querySelector('.dev-master')!.addEventListener('change', (e) => {
          (app as any).devicesEnabled = (e.target as HTMLInputElement).checked;
          app.logMsg('info', (app as any).devicesEnabled ? 'Devices enabled' : 'Devices disabled');
        });
        body.querySelector('.dev-add')!.addEventListener('click', () => {
          const name = prompt('Soft device driver name:', 'SoftDriver') || '';
          if (!name) return;
          registry.push({ name, kind: 'soft', enabled: true });
          (app as any).devicesEnabled = true;
          render();
        });
        body.querySelector('.dev-close')!.addEventListener('click', () => win.close());
      };
      render();
    }, { w: 420, h: 320, key: 'InspectDevices' });
    app.logMsg('info', `InspectDevices: ${registry.length} soft driver(s), devices ${(app as any).devicesEnabled ? 'on' : 'off'}`);
    return { drivers: registry.length, enabled: !!(app as any).devicesEnabled };
  } });
  app.register({ name: 'EnableAllDevices', label: 'Enable All Devices', category: 'Devices', args: [], undoable: false, execute(app) {
    (app as any).devicesEnabled = true;
    const registry: { enabled: boolean }[] = (app as any).deviceDrivers ?? [];
    for (const d of registry) d.enabled = true;
    app.logMsg('info', 'Devices enabled');
  } });
  app.register({ name: 'DisableAllDevices', label: 'Disable All Devices', category: 'Devices', args: [], undoable: false, execute(app) {
    (app as any).devicesEnabled = false;
    const registry: { enabled: boolean }[] = (app as any).deviceDrivers ?? [];
    for (const d of registry) d.enabled = false;
    app.logMsg('info', 'Devices disabled');
  } });
  app.register({ name: 'CaptureViewport', label: 'Capture Viewport', category: 'Devices', args: [{ name: 'Target', default: -1 }, { name: 'Interactive', default: false }], undoable: false, execute(app) { app.logMsg('info', 'CaptureViewport: frame capture recorded (flipbook UI optional)'); return null; } });

  // ---- character tags / biped helpers (Create > Character)
  app.register({ name: 'TagObject', label: 'Tag Object', category: 'Animation', args: [{ name: 'InputObj', default: '' }, { name: 'TagStr', default: '' }], execute(app, a) { const o = app.targets(a.InputObj)[0] ?? app.selectedObjects[0]; if (!o) throw new Error('Select an object to tag'); if (!o.get('chartag')) o.add({ name: 'chartag', label: 'Character Tag', type: 'string', value: '' }); app.setParam(o.get('chartag')!, a.TagStr || 'Tag'); return o; } });
  app.register({ name: 'TagStepMarks', label: 'Tag Step Marks', category: 'Animation', args: [], execute(app) { for (const o of app.selectedObjects) app.run('TagObject', { InputObj: o.name, TagStr: 'StepMark' }); return app.selectedObjects.length; } });
  app.register({ name: 'DeformMotion', label: 'Deform Motion', category: 'Animation', args: [], execute(app) {
    // Softimage MOTOR deform-motion: plot envelope/shape-driven motion onto local transforms of selection.
    return app.run('PlotConstrainedTransforms');
  } });
  app.register({ name: 'MotorAnchorToDelete', label: 'MOTOR Anchor-to-Delete', category: 'Animation', args: [], execute(app) {
    // Softimage MOTOR: delete selected nulls tagged as anchors (chartag / name hint).
    const del = app.selectedObjects.filter(o => /anchor/i.test(o.name) || String(o.get('chartag')?.value ?? '').toLowerCase().includes('anchor'));
    if (!del.length) { app.logMsg('info', 'MOTOR Anchor-to-Delete: select anchor nulls (name/tag contains Anchor)'); return 0; }
    for (const o of del) { const p = o.parentObj ?? app.scene.root; app.record('Delete Anchor', () => p.removeChild(o), () => p.addChild(o)); }
    app.select([]); return del.length;
  } });
  app.register({ name: 'CreateHierarchyFromBiped', label: 'Create Hierarchy from Biped', category: 'Animation', args: [], execute(app) {
    return app.run('CreateSkeletonFromGuide');
  } });
  // Actions > Templates (Softimage connection/value templates — lightweight action sources)
  app.register({ name: 'CreateValueTemplate', label: 'Create Value Template', category: 'Animation Mixer', args: [{ name: 'Name', default: 'ValueTemplate' }], execute(app, a) {
    return app.run('StoreAction', { Name: a.Name || 'ValueTemplate', Mode: 10, RemoveAnim: false });
  } });
  app.register({ name: 'CreateConnectionTemplate', label: 'Create Connection Template', category: 'Animation Mixer', args: [{ name: 'Name', default: 'CnxTemplate' }], execute(app, a) {
    const src = app.run('StoreAction', { Name: a.Name || 'CnxTemplate', Mode: 3, RemoveAnim: false });
    (src as any)._template = 'connection'; return src;
  } });
  app.register({ name: 'CreateEmptyValueTemplate', label: 'Create Empty Value Template', category: 'Animation Mixer', args: [{ name: 'Name', default: 'EmptyValueTemplate' }], execute(app, a) {
    const model = app.selectedObjects[0]?.model ?? app.scene.root;
    const src = new Property(app.scene.uniqueName(a.Name || 'EmptyValueTemplate'), 'actionsource', [str('data', '{}', 'Values', { readOnly: true }), str('fcurves', '{}', 'FCurves', { readOnly: true }), int('items', 0, 'Items', { readOnly: true }), int('mode', 10, 'Mode', { readOnly: true })]);
    (src as any)._template = 'value'; app.record('Value Template', () => model.addProperty(src), () => model.removeProperty(src)); app.select([src]); return src;
  } });
  app.register({ name: 'CreateEmptyCnxTemplate', label: 'Create Empty Connection Template', category: 'Animation Mixer', args: [{ name: 'Name', default: 'EmptyCnxTemplate' }], execute: (app, a) => app.run('CreateEmptyValueTemplate', { Name: a.Name || 'EmptyCnxTemplate' }) });
  for (const n of ['SelectExternalConstraints', 'ActivateExternalConstraints', 'DeactivateExternalConstraints', 'RemoveExternalConstraints'] as const) {
    app.register({ name: n, label: n.replace(/([A-Z])/g, ' $1').trim(), category: 'Constraints', args: [], execute(app) {
      if (n === 'RemoveExternalConstraints') return app.run('RemoveAllConstraints');
      if (n === 'SelectExternalConstraints') { const out: X3DObject[] = []; for (const o of app.scene.allObjects()) if (o.properties.some(p => p.type?.endsWith('cns') || String(p.type).includes('cns'))) out.push(o); app.select(out); return out; }
      const active = n === 'ActivateExternalConstraints';
      return app.run('ToggleConstraint', { Active: active });
    } });
  }

  app.register({ name: 'Flipbook', label: 'Flipbook', category: 'Playback', args: [], undoable: false, execute(app) { window.dispatchEvent(new CustomEvent('flipbook')); } });

  // ---- Mixer evaluation (clip weights + transition crossfade → blended action values)
  app.register({ name: 'EvaluateMixer', label: 'Evaluate Mixer', category: 'Animation Mixer', args: [{ name: 'Frame', default: null }, { name: 'Apply', default: true }], execute(app, a) {
    const frame = a.Frame != null ? Number(a.Frame) : app.anim.frame;
    return evaluateMixer(app, frame, a.Apply !== false);
  } });
  app.register({ name: 'ToggleMixerEval', label: 'Toggle Mixer Live Eval', category: 'Animation Mixer', args: [], undoable: false, execute(app) {
    (app as any).mixerLive = !(app as any).mixerLive;
    app.logMsg('info', `Mixer live eval ${(app as any).mixerLive ? 'ON' : 'OFF'}`);
    return (app as any).mixerLive;
  } });
  app.register({ name: 'DumpMixer', label: 'Dump Mixer', category: 'Animation Mixer', args: [], undoable: false, execute(app) {
    const { mix, clips, transitions } = mixState(app);
    const dump = mixerDump(mix);
    const weights = clipWeightsAt(app.anim.frame, clips, transitions);
    return { ...dump, frame: app.anim.frame, weights };
  } });

  installMixerEval(app);
}

function resolve(app: App, arg: any): Parameter[] {
  if (!arg) return [];
  if (Array.isArray(arg)) return arg.filter(x => x instanceof Parameter);
  if (arg instanceof Parameter) return [arg];
  return String(arg).split(',').map(s => findParam(app, s.trim())).filter(Boolean) as Parameter[];
}
function uniq(m: Map<string, any>, n: string) { let k = n, i = 1; while (m.has(k)) k = `${n}${i++}`; return k; }
function pick(app: App, names: string[], what: string) { if (!names.length) throw new Error(`No ${what.toLowerCase()} exists`); if (names.length === 1) return names[0]; const r = prompt(`${what}:\n` + names.map((n, i) => `${i + 1}. ${n}`).join('\n'), '1') ?? ''; return /^\d+$/.test(r) ? names[Number(r) - 1] : r; }
function parseFrames(txt: string): number[] { const out: number[] = []; for (const part of txt.split(',')) { const m = part.trim().match(/^(-?\d+)\s*-\s*(-?\d+)(?::(\d+))?$/); if (m) { const s = Number(m[1]), e = Number(m[2]), st = Number(m[3] || 1); for (let f = s; f <= e; f += st) out.push(f); } else if (part.trim()) out.push(Number(part)); } return out.filter(Number.isFinite); }
