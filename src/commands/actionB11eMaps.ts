// Ledger row CMD-B11e: connection / value maps and mapping rules (action.dll). Brief:
// docs/ghidra/cmd-b11e-action-maps-rules-sources-binary.md, section 3 (CreateConnectionMap ... GetMappingRule).
// Original code written from that prose contract only. Helpers and the MappingTemplate stand-in: actionB11eModel.ts.
import { App } from '../core/commands';
import { Model, X3DObject } from '../core/scene';
import {
  E_POINTER, E_INVALIDARG, E_FAIL, S_OK, reg, fail, logNya, unset, numArg, boolArg, setStatus,
  MappingTemplate, MapRule, templateArg, rulePos, modelArg, createTemplate,
} from './actionB11eModel';

// ------------------------------------------------------------------ map creation
/** Obj1: required model. inferred: unset = the model of the first selected object (the argument handler is not in action.dll). */
function obj1(app: App, cmd: string, v: any): Model {
  const m = modelArg(app, unset(v) ? app.selectedObjects[0] ?? null : v);
  if (!m) throw fail(E_POINTER, `${cmd}: Obj1 is missing or does not resolve to a model`);
  return m;
}
/** Obj2: optional; absent or empty -> the empty-map path. */
function obj2(app: App, cmd: string, v: any): Model | null {
  if (unset(v)) return null;
  const m = modelArg(app, v);
  if (!m) throw fail(E_INVALIDARG, `${cmd}: Obj2 does not resolve to a model`);
  return m;
}
/** inferred: the per-model object collector (helpers 0x1800292e0 / 0x180031250 were not read): the model's own objects in hierarchy order. */
function collect(model: Model): X3DObject[] { return [...model.descendants()].filter(o => o.model === model || (o instanceof Model && o.parentObj?.model === model)); }

const KINE = ['sclx', 'scly', 'sclz', 'rotx', 'roty', 'rotz', 'posx', 'posy', 'posz'];
/** Mode -> transform-channel mask (0 -> 0, 1 -> 1, 2 -> 2, 3 -> 4, 4 -> 7; others 0). */
export const valueModeMask = (mode: number) => ({ 0: 0, 1: 1, 2: 2, 3: 4, 4: 7 } as Record<number, number>)[mode] ?? 0;
/** Scope -> mask (0 -> 2 global, 1 -> 1 local, 2 -> 3 both). */
export const valueScopeMask = (scope: number) => ({ 0: 2, 1: 1, 2: 3 } as Record<number, number>)[scope] ?? 0; // inferred: other values select nothing
/** Selected channels: bit 1 scaling, bit 2 rotation, bit 4 translation (inferred group order from the channel table). */
function channels(modeMask: number, scopeMask: number): { scope: 'local' | 'global'; ch: string }[] {
  const out: { scope: 'local' | 'global'; ch: string }[] = [];
  for (const [bit, scope] of [[1, 'local'], [2, 'global']] as const) {
    if (!(scopeMask & bit)) continue;
    KINE.forEach((ch, i) => { if (modeMask & (1 << Math.floor(i / 3))) out.push({ scope, ch }); });
  }
  return out;
}
/** `%lf`: six decimals. */
const lf = (v: number) => v.toFixed(6);

function registerMapCreation(app: App) {
  reg(app, 'CreateEmptyConnectionMap', {
    description: 'Creates an empty connection mapping template on the model\'s mixer.',
    execute(app, a) { const t = createTemplate(app, 'CreateEmptyConnectionMap', obj1(app, 'CreateEmptyConnectionMap', a.Obj1), 'connection'); setStatus(app, 'CreateEmptyConnectionMap', S_OK); return t; },
  });
  reg(app, 'CreateEmptyValueMap', {
    description: 'Creates an empty value mapping template on the model\'s mixer.',
    execute(app, a) { const t = createTemplate(app, 'CreateEmptyValueMap', obj1(app, 'CreateEmptyValueMap', a.Obj1), 'value'); setStatus(app, 'CreateEmptyValueMap', S_OK); return t; },
  });
  reg(app, 'CreateConnectionMap', {
    description: 'Creates a connection mapping template from one model to another (one rule per object pair).',
    execute(app, a) {
      const C = 'CreateConnectionMap';
      const m1 = obj1(app, C, a.Obj1); const m2 = obj2(app, C, a.Obj2);
      const t = createTemplate(app, C, m1, 'connection');
      if (!m2) { setStatus(app, C, S_OK); return t; }
      const l1 = collect(m1), l2 = collect(m2);
      logNya(app, C, 'which objects / parameters the per-model collector lists (helper 0x1800292e0); the model\'s objects in hierarchy order are used');
      if (l1.length !== l2.length) logNya(app, C, `unequal object lists (${l1.length} / ${l2.length}); pairs up to the shorter list are mapped`);
      const rules: MapRule[] = [];
      for (let i = 0; i < Math.min(l1.length, l2.length); i++) rules.push({ from: l1[i].fullName, to: l2[i].fullName, active: true, poseOffset: false });
      const pos = t.count();
      app.record(C, () => t.insert(pos, rules), () => t.remove(pos, rules.length));
      setStatus(app, C, S_OK);
      return t;
    },
  });
  reg(app, 'CreateValueMap', {
    description: 'Creates a value mapping template holding the transform differences between two models.',
    execute(app, a) {
      const C = 'CreateValueMap';
      const m1 = obj1(app, C, a.Obj1); const m2 = obj2(app, C, a.Obj2);
      const modeMask = valueModeMask(numArg(a.Mode, 4)); const scopeMask = valueScopeMask(numArg(a.Scope, 1));
      if (!m2) { const t = createTemplate(app, C, m1, 'value'); setStatus(app, C, S_OK); return t; }
      const l1 = collect(m1); let l2 = collect(m2);
      logNya(app, C, 'the per-model object collector (helper 0x180031250); the model\'s objects in hierarchy order are used');
      if (boolArg(a.UseNames)) {
        logNya(app, C, 'the UseNames matching; objects of Obj2 are matched to Obj1 by name');
        const byName = l1.map(o => l2.find(x => x.name === o.name)); l2 = byName.every(Boolean) ? byName as X3DObject[] : [];
      }
      if (l1.length !== l2.length) {
        logNya(app, C, 'the error code of the list-length mismatch');
        throw fail(E_FAIL, `${C}: the two models do not give object lists of the same length (${l1.length} / ${l2.length}); nothing is created`);
      }
      const t = createTemplate(app, C, m1, 'value');
      logNya(app, C, 'the direction of the difference; the rule is written on the Obj1 object with Obj2 value minus Obj1 value');
      const rules: MapRule[] = [];
      const chans = channels(modeMask, scopeMask);
      for (let i = 0; i < l1.length; i++) for (const { scope, ch } of chans) {
        const k1 = scope === 'local' ? l1[i].kinematics.local : l1[i].kinematics.global, k2 = scope === 'local' ? l2[i].kinematics.local : l2[i].kinematics.global;
        const d = Number(k2.val(ch)) - Number(k1.val(ch));
        rules.push({ from: `${l1[i].fullName}.kine.${scope}.${ch}`, to: Math.abs(d) < 1e-9 ? '' : `this + ${lf(d)}`, active: true, poseOffset: false });
      }
      const pos = t.count();
      app.record(C, () => t.insert(pos, rules), () => t.remove(pos, rules.length));
      setStatus(app, C, S_OK);
      return t;
    },
  });
}

// ------------------------------------------------------------------ rules
function registerRules(app: App) {
  reg(app, 'AddMappingRule', {
    description: 'Inserts a mapping rule into a mapping template.',
    execute(app, a) {
      const C = 'AddMappingRule';
      const t = templateArg(app, C, a.MappingTemplate);
      // inferred: an empty string is the null BSTR the task rejects
      if (unset(a.From)) throw fail(E_POINTER, `${C}: From is missing`);
      if (unset(a.To)) throw fail(E_POINTER, `${C}: To is missing`);
      const pos = rulePos(numArg(a.Index, 0), t.count());
      const rule: MapRule = { from: String(a.From), to: String(a.To), active: true, poseOffset: false }; // inferred: flags of a new rule
      app.record(C, () => t.insert(pos, [rule]), () => t.remove(pos, 1));
      setStatus(app, C, S_OK);
      return undefined;
    },
  });
  reg(app, 'SetMappingRule', {
    description: 'Modify a mapping rule in-place.',
    execute(app, a) {
      const C = 'SetMappingRule';
      const t = templateArg(app, C, a.MappingTemplate);
      const pos = rulePos(numArg(a.Index, 0), t.count());
      const rule = t.rules[pos];
      if (!rule) throw fail(E_INVALIDARG, `${C}: the template has no rule at position ${pos + 1}`); // inferred: Index past the last rule (count clamp) has nothing to set
      const old = { ...rule };
      const next: MapRule = { ...rule };
      if (t.hasFlags) {
        const act = numArg(a.Active, -1), po = numArg(a.PoseOffset, -1);
        if (act >= 0) next.active = act !== 0;
        if (po >= 0) next.poseOffset = po !== 0;
      }
      next.from = a.From == null ? '' : String(a.From); next.to = a.To == null ? '' : String(a.To);
      app.record(C, () => Object.assign(rule, next), () => Object.assign(rule, old));
      setStatus(app, C, S_OK);
      return undefined;
    },
  });
  reg(app, 'DeleteMappingRule', {
    description: 'Removes a mapping rule from a mapping template.',
    execute(app, a) {
      const C = 'DeleteMappingRule';
      const t = templateArg(app, C, a.MappingTemplate);
      const pos = rulePos(numArg(a.Index, 0), t.count());
      const rule = t.rules[pos];
      if (!rule) { setStatus(app, C, 1); return undefined; } // inferred: position = count removes nothing
      app.record(C, () => t.remove(pos, 1), () => t.insert(pos, [rule]));
      setStatus(app, C, S_OK);
      return undefined;
    },
  });
  reg(app, 'GetNumMappingRules', {
    description: 'Returns the number of rules of a mapping template.', undoable: false,
    execute(app, a) { return templateArg(app, 'GetNumMappingRules', a.MappingTemplate).count(); },
  });
  reg(app, 'GetMappingRule', {
    description: 'Returns one rule of a mapping template.', undoable: false,
    execute(app, a) {
      const C = 'GetMappingRule';
      const t = templateArg(app, C, a.MappingTemplate);
      const index = Math.max(numArg(a.Index, 0), 1);
      if (index > t.count()) {
        logNya(app, C, 'the error code returned for an out-of-range Index');
        throw fail(E_INVALIDARG, `${C}: Index ${index} is greater than the rule count ${t.count()}`);
      }
      const r = t.rules[index - 1];
      return { From: r.from, To: r.to, Active: t.hasFlags ? r.active : false, PoseOffset: t.hasFlags ? r.poseOffset : false };
    },
  });
}

/** CMD-B11e maps and rules. */
export function registerActionB11eMaps(app: App) {
  registerMapCreation(app);
  registerRules(app);
}
export type { MappingTemplate };
