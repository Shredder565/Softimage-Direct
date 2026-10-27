// Parameter system — every editable value in the scene is a Parameter on a ParamSet,
// so it can be inspected by the generic Property Editor, keyed, logged and undone.

export type ParamType = 'double' | 'int' | 'bool' | 'string' | 'enum' | 'color';

export interface ParamDef {
  name: string;          // script name, e.g. "posx"
  label?: string;        // UI label, e.g. "Position X"
  type: ParamType;
  value: any;
  min?: number;          // hard clamp (Softimage Range)
  max?: number;
  uimin?: number;        // slider range (Softimage UIRange)
  uimax?: number;
  step?: number;
  desc?: string;
  items?: { label: string; value: any }[]; // for enum
  animatable?: boolean;
  keyable?: boolean;
  readOnly?: boolean;
  /** SPDL UnInspectable: the parameter is stored and is not drawn in the property page. */
  inspectable?: boolean;
  group?: string;        // PPG tab / group
}

export type Listener = (p: Parameter, old: any) => void;

export class Parameter {
  readonly def: ParamDef;
  private _value: any;
  readonly owner: ParamSet;
  constructor(owner: ParamSet, def: ParamDef) {
    this.owner = owner;
    this.def = def;
    this._value = def.value;
  }
  get name() { return this.def.name; }
  get label() { return this.def.label ?? this.def.name; }
  get fullName() { return `${this.owner.fullName}.${this.def.name}`; }
  get value() { return this._value; }
  set value(v: any) {
    if (this.def.type === 'double' || this.def.type === 'int') {
      v = Number(v);
      if (this.def.type === 'int') v = Math.round(v);
      if (this.def.min !== undefined) v = Math.max(this.def.min, v);
      if (this.def.max !== undefined) v = Math.min(this.def.max, v);
    } else if (this.def.type === 'bool') v = !!v;
    if (v === this._value) return;
    const old = this._value;
    this._value = v;
    this.owner.notify(this, old);
  }
  get animatable() { return this.def.animatable !== false && (this.def.type === 'double' || this.def.type === 'int' || this.def.type === 'bool'); }
  get keyable() { return this.def.keyable ?? false; }
}

let nextId = 1;

/** A named bag of parameters (a property, a primitive, kinematics, an operator...). */
export class ParamSet {
  readonly id = nextId++;
  name: string;
  type: string;
  parent: ParamSet | null = null;
  readonly params: Parameter[] = [];
  /** Optional Softimage PPG layout tree (groups/rows); the Property Editor renders it when present. */
  layout?: import('./opdefs').LayoutNode[];
  private byName = new Map<string, Parameter>();
  private listeners = new Set<Listener>();

  constructor(name: string, type: string, defs: ParamDef[] = []) {
    this.name = name;
    this.type = type;
    for (const d of defs) this.add(d);
  }
  get fullName(): string { return this.parent ? `${this.parent.fullName}.${this.name}` : this.name; }
  add(def: ParamDef): Parameter {
    const p = new Parameter(this, def);
    this.params.push(p);
    this.byName.set(def.name, p);
    return p;
  }
  get(name: string): Parameter | undefined { return this.byName.get(name); }
  val(name: string): any { return this.byName.get(name)?.value; }
  set(name: string, v: any) { const p = this.byName.get(name); if (p) p.value = v; }
  onChange(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  notify(p: Parameter, old: any) {
    for (const l of this.listeners) l(p, old);
    this.parent?.notify(p, old);
  }
  /** Parameters shown in the Property Editor, grouped. */
  groups(): Map<string, Parameter[]> {
    const g = new Map<string, Parameter[]>();
    for (const p of this.params) {
      const k = p.def.group ?? 'General';
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(p);
    }
    return g;
  }
}

export const num = (name: string, value: number, label?: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ name, label, type: 'double', value, animatable: true, ...extra });
export const int = (name: string, value: number, label?: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ name, label, type: 'int', value, animatable: true, ...extra });
export const bool = (name: string, value: boolean, label?: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ name, label, type: 'bool', value, ...extra });
export const str = (name: string, value: string, label?: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ name, label, type: 'string', value, animatable: false, ...extra });
export const enumP = (name: string, value: any, items: { label: string; value: any }[], label?: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ name, label, type: 'enum', value, items, animatable: false, ...extra });
export const color = (name: string, value: [number, number, number], label?: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ name, label, type: 'color', value, animatable: false, ...extra });
