// Ledger row CMD-B11e: connection / value maps and mapping rules (action.dll). Brief:
// docs/ghidra/cmd-b11e-action-maps-rules-sources-binary.md, section 3 (CreateConnectionMap ... GetMappingRule).
// Original code written from that prose contract only. Helpers and the MappingTemplate stand-in: actionB11eModel.ts.
import { App } from '../core/commands';
import { Model, X3DObject } from '../core/scene';
import {
  E_POINTER, E_INVALIDARG, E_FAIL, S_OK, S_FALSE, reg, fail, logNya, unset, numArg, boolArg, setStatus,
  MappingTemplate, MapRule, templateArg, rulePos, modelArg, createTemplate, templatesOf,
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
/** The per-model collectors 0x1800292e0 / 0x180031250 (batch 12 Q1): the model itself, then every descendant, depth
 *  first, pre-order; nothing is filtered by type. */
function collect(model: Model): X3DObject[] { const out: X3DObject[] = []; const walk = (o: X3DObject) => { out.push(o); o.children.forEach(walk); }; walk(model); return out; }

export const E_UNEXPECTED = 0x8000ffff;
const KINE = ['sclx', 'scly', 'sclz', 'rotx', 'roty', 'rotz', 'posx', 'posy', 'posz'];
/** Mode -> transform-channel mask (0 -> 0, 1 -> 1, 2 -> 2, 3 -> 4, 4 -> 7; others 0). */
export const valueModeMask = (mode: number) => ({ 0: 0, 1: 1, 2: 2, 3: 4, 4: 7 } as Record<number, number>)[mode] ?? 0;
/** Scope -> mask (0 -> 2 global, 1 -> 1 local, 2 -> 3 both). */
export const valueScopeMask = (scope: number) => ({ 0: 2, 1: 1, 2: 3 } as Record<number, number>)[scope] ?? 0; // inferred: other values select nothing
/** Selected channels: bit 1 scaling, bit 2 rotation, bit 4 translation (inferred group order from the channel table). */
function channels(modeMask: number, scopeMask: number): { scope: 'local' | 'global'; ch: string }[] {
  const out: { scope: 'local' | 'global'; ch: string }[] = [];
  for (const [bit, scope] of [[2, 'global'], [1, 'local']] as const) { // global channels before local (batch 12)
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
      // Batch 12 Q1: unequal lists -> nothing created, no error, no MappingTemplate; else rule i: From = the i-th object
      // of Obj2's list, To = the i-th object of Obj1's list, appended at the end.
      const C = 'CreateConnectionMap';
      const m1 = obj1(app, C, a.Obj1); const m2 = obj2(app, C, a.Obj2);
      if (!m2) { const t = createTemplate(app, C, m1, 'connection'); setStatus(app, C, S_OK); return t; }
      const l1 = collect(m1), l2 = collect(m2);
      if (l1.length !== l2.length) { setStatus(app, C, S_OK); return undefined; } // silent success, no output
      const t = createTemplate(app, C, m1, 'connection');
      const rules: MapRule[] = l1.map((o, i) => ({ from: l2[i].fullName, to: o.fullName, ...t.defaultFlags() }));
      const pos = t.count();
      app.record(C, () => t.insert(pos, rules), () => t.remove(pos, rules.length));
      setStatus(app, C, S_OK);
      return t;
    },
  });
  reg(app, 'CreateValueMap', {
    description: 'Creates a value mapping template holding the transform differences between two models.',
    execute(app, a) {
      // Batch 12 Q1: unequal lists -> 0x8000FFFF, no map; difference = Obj1 value - Obj2 value; From = <Obj1 object>.<channel>,
      // To = "this + %lf" (empty below 1e-9); global channels before local; UseNames: the Obj1 partner of an Obj2 object is
      // the first Obj1 object whose full name contains its (remapped) name; no partner -> no rule.
      const C = 'CreateValueMap';
      const m1 = obj1(app, C, a.Obj1); const m2 = obj2(app, C, a.Obj2);
      const modeMask = valueModeMask(numArg(a.Mode, 4)); const scopeMask = valueScopeMask(numArg(a.Scope, 1));
      if (!m2) { const t = createTemplate(app, C, m1, 'value'); setStatus(app, C, S_OK); return t; }
      const l1 = collect(m1), l2 = collect(m2);
      if (l1.length !== l2.length) throw fail(E_UNEXPECTED, `${C}: the two models do not give object lists of the same length (${l1.length} / ${l2.length}); nothing is created`);
      const t = createTemplate(app, C, m1, 'value');
      const pairs: [X3DObject, X3DObject][] = [];
      if (boolArg(a.UseNames)) {
        for (const o2 of l2) { const nm = remapName(m1, o2); const o1 = l1.find(o => o.fullName.includes(nm)); if (o1) pairs.push([o1, o2]); }
      } else l1.forEach((o, i) => pairs.push([o, l2[i]]));
      const rules: MapRule[] = [];
      const chans = channels(modeMask, scopeMask);
      for (const [o1, o2] of pairs) for (const { scope, ch } of chans) {
        const k1 = scope === 'local' ? o1.kinematics.local : o1.kinematics.global, k2 = scope === 'local' ? o2.kinematics.local : o2.kinematics.global;
        const d = Number(k1.val(ch)) - Number(k2.val(ch));
        rules.push({ from: `${o1.fullName}.kine.${scope}.${ch}`, to: Math.abs(d) < 1e-9 ? '' : `this + ${lf(d)}`, ...t.defaultFlags() });
      }
      const pos = t.count();
      app.record(C, () => t.insert(pos, rules), () => t.remove(pos, rules.length));
      setStatus(app, C, S_OK);
      return t;
    },
  });
}
/** UseNames name remapping: a connection map of Obj1's mixer translates the Obj2 object's name (inferred: the rule whose
 *  From is that object gives the name of its To); no answer -> the name unchanged. */
function remapName(m1: Model, o2: X3DObject): string {
  const mix = m1.property('mixer');
  for (const t of mix ? templatesOf(mix) : []) {
    if (t.mapKind !== 'connection') continue;
    const r = t.rules.find(x => x.from === o2.fullName || x.from === o2.name); if (r && r.to) return r.to.split('.').pop()!;
  }
  return o2.name;
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
      const rule: MapRule = { from: String(a.From), to: String(a.To), ...t.defaultFlags() }; // only inserted: the template's default flags
      app.record(C, () => t.insert(pos, [rule]), () => t.remove(pos, 1));
      setStatus(app, C, S_OK);
      return undefined;
    },
  });
  reg(app, 'SetMappingRule', {
    description: 'Modify a mapping rule in-place.',
    execute(app, a) {
      // Batch 12 Q2: position = min(max(Index,1) - 1, count); past the end the read of the old rule fails and nothing
      // changes. Only NULL strings are rejected (stop, no change); flags are written before From / To.
      const C = 'SetMappingRule';
      const t = templateArg(app, C, a.MappingTemplate);
      if (a.From === undefined || a.From === null || a.To === undefined || a.To === null) throw fail(E_POINTER, `${C}: From / To is NULL`);
      const pos = rulePos(numArg(a.Index, 0), t.count());
      const rule = t.rules[pos];
      if (!rule) throw fail(E_INVALIDARG, `${C}: the template has no rule at position ${pos + 1}`); // inferred: the template's failing read
      const old = { ...rule };
      const next: MapRule = { ...rule };
      if (t.hasFlags) {
        const act = numArg(a.Active, -1), po = numArg(a.PoseOffset, -1);
        if (act >= 0) next.active = act !== 0;
        if (po >= 0) next.poseOffset = po !== 0;
      }
      next.from = String(a.From); next.to = String(a.To); // a non-null empty string is written as given
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
      // Batch 12 Q2: Index greater than the count -> S_FALSE (1), no output; success also returns S_FALSE (1).
      const C = 'GetMappingRule';
      const t = templateArg(app, C, a.MappingTemplate);
      const index = Math.max(numArg(a.Index, 0), 1);
      if (index > t.count()) { setStatus(app, C, S_FALSE); return undefined; }
      const r = t.rules[index - 1];
      const out = { From: r.from, To: r.to, Active: t.hasFlags ? r.active : false, PoseOffset: t.hasFlags ? r.poseOffset : false };
      Object.assign(a, out);
      setStatus(app, C, S_FALSE);
      return out;
    },
  });
}

/** CMD-B11e maps and rules. */
export function registerActionB11eMaps(app: App) {
  registerMapCreation(app);
  registerRules(app);
}
export type { MappingTemplate };
