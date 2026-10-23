// Command registry + undo stack + script log + selection: the bus every UI element talks through.
import { Scene, X3DObject, Node } from './scene';
import { AnimationManager } from './animation';
import { Parameter } from './params';
import type { CompKind } from './topology';

/** An interactive viewport tool (curve drawing, chain drawing, add vertex...). The viewport feeds it clicks. */
export interface InteractiveTool {
  name: string; prompt: string;
  /** Called with the world-space point under the cursor (on the construction plane) and any picked component. */
  onClick(p: [number, number, number], pick: { obj: X3DObject; kind: 'point' | 'edge' | 'polygon'; item: number | string; worldPoint: [number, number, number] } | null, e: { shift: boolean; ctrl: boolean }): void;
  onMove?(p: [number, number, number]): void;
  onFinish(): void; onCancel(): void;
  preview?(): [number, number, number][][];   // polylines to draw while the tool is active
  pickKind?: 'point' | 'edge' | 'polygon';
}
export interface ComponentSelection { obj: X3DObject; kind: CompKind; points: Set<number>; edges: Set<string>; polygons: Set<number>; }

export interface ArgDef { name: string; default?: any; }
export interface CommandDef {
  name: string;               // scripting name, e.g. CreatePrim
  label?: string;             // display name, e.g. "Create primitive"
  category?: string;
  description?: string;
  args: ArgDef[];
  undoable?: boolean;         // default true
  canRun?(args: Record<string, any>): boolean;   // menu greys the item when false
  execute(app: App, args: Record<string, any>): any;
}

export interface UndoEntry { label: string; undo(): void; redo(): void; }

type EventName = 'scene' | 'selection' | 'log' | 'undo' | 'module' | 'frame' | 'params' | 'inspect' | 'newscene';

export class EventBus {
  private m = new Map<EventName, Set<(d?: any) => void>>();
  on(e: EventName, f: (d?: any) => void) { if (!this.m.has(e)) this.m.set(e, new Set()); this.m.get(e)!.add(f); return () => this.m.get(e)!.delete(f); }
  emit(e: EventName, d?: any) { this.m.get(e)?.forEach(f => f(d)); }
}

export class App {
  scene = new Scene();
  anim = new AnimationManager();
  events = new EventBus();
  commands = new Map<string, CommandDef>();
  selection: Node[] = [];
  /** Selection filter from the MCP: object, or a component kind. */
  selMode: 'object' | CompKind = 'object';
  compSel: ComponentSelection | null = null;
  activeTool: InteractiveTool | null = null;
  proportional = { on: false, radius: 3 };
  setTool(t: InteractiveTool | null) { if (this.activeTool && t !== this.activeTool) this.activeTool.onCancel(); this.activeTool = t; this.events.emit('selection'); if (t) this.logMsg('info', t.prompt); }
  log: { kind: 'cmd' | 'info' | 'error'; text: string }[] = [];
  undoStack: UndoEntry[] = [];
  redoStack: UndoEntry[] = [];
  module: 'Model' | 'Animate' | 'Render' | 'Simulate' | 'ICE' | 'Hair' = 'Model';
  autoInspect = true;
  autoKey = false;
  /** PPG recycle flag (property editor toolbar): reuse the floating editor for the next inspected node. */
  recyclePPG = true;
  private pendingUndo: UndoEntry[] | null = null;

  constructor() {
    this.anim.onFrame(() => { this.events.emit('frame'); this.events.emit('params'); });
  }

  register(def: CommandDef) { this.commands.set(def.name, def); }

  /** Execute a command by scripting name with named args; logs it like Softimage's script log. */
  run(name: string, args: Record<string, any> = {}): any {
    const def = this.commands.get(name);
    if (!def) { this.logMsg('error', `${name}: ${(window as any).__siMessage?.(1007) ?? 'Not implemented'}`); return undefined; }
    const full: Record<string, any> = {};
    const alias = (n: string) => n === 'InputObj' ? 'InputObjs' : n === 'InputObjs' ? 'InputObj' : n; // Softimage scripts use both spellings
    for (const a of def.args) full[a.name] = args[a.name] !== undefined ? args[a.name] : args[alias(a.name)] !== undefined ? args[alias(a.name)] : a.default;
    const argText = def.args.map(a => fmtArg(full[a.name])).join(', ');
    const nested = this.pendingUndo !== null;
    if (!nested) this.pendingUndo = [];
    let result: any;
    try {
      result = def.execute(this, full);
      if (!nested && (this as any).cmdLog !== false) this.logMsg('cmd', fmtCall(name, def.args.map(a => full[a.name]), (this as any).scriptLang));
    } catch (e: any) {
      this.logMsg('error', `${name}: ${e?.message ?? e}`);
      if (!nested) { for (const u of this.pendingUndo!.reverse()) u.undo(); this.pendingUndo = null; }
      throw e;
    }
    if (!nested) {
      const entries = this.pendingUndo!; this.pendingUndo = null;
      if (entries.length && def.undoable !== false) {
        this.undoStack.push({ label: name, undo: () => { for (const u of [...entries].reverse()) u.undo(); }, redo: () => { for (const u of entries) u.redo(); } });
        if (this.undoStack.length > ((this as any).maxUndo ?? 50)) this.undoStack.shift();
        this.redoStack = [];
        this.events.emit('undo');
      }
      this.events.emit('scene');
      if (this.autoInspect && result instanceof Node && /^(Create|Apply|Add|Get|Make|Duplicate|SI)/.test(name) && name !== 'CreateGroup') this.events.emit('inspect', result);
    }
    return result;
  }

  /** Record an undoable step inside the currently executing command. `redo` runs immediately. */
  record(label: string, redo: () => void, undo: () => void) {
    redo();
    const entry = { label, undo, redo };
    if (this.pendingUndo) this.pendingUndo.push(entry);
    else { this.undoStack.push(entry); this.redoStack = []; this.events.emit('undo'); this.events.emit('scene'); }
  }

  setParam(p: Parameter, value: any, label = 'SetValue') {
    const old = p.value; if (old === value) return;
    this.record(label, () => { p.value = value; }, () => { p.value = old; });
    if (this.autoKey && p.animatable && this.anim.isAnimated(p)) this.anim.setKey(p);
    this.events.emit('params', p);
  }

  undo() { const e = this.undoStack.pop(); if (!e) return; e.undo(); this.redoStack.push(e); this.logMsg('info', `Undo ${e.label}`); this.events.emit('undo'); this.events.emit('scene'); this.events.emit('params'); }
  redo() { const e = this.redoStack.pop(); if (!e) return; e.redo(); this.undoStack.push(e); this.logMsg('info', `Redo ${e.label}`); this.events.emit('undo'); this.events.emit('scene'); this.events.emit('params'); }

  logMsg(kind: 'cmd' | 'info' | 'error', text: string) { if (kind === 'info' && (this as any).msgLog === false) return; this.log.push({ kind, text }); if (this.log.length > ((this as any).cmdLogSize ?? 500)) this.log.shift(); this.events.emit('log'); }

  // ---- selection
  select(nodes: Node[], mode: 'replace' | 'add' | 'toggle' = 'replace') {
    if (mode === 'replace') this.selection = [...nodes];
    else if (mode === 'add') for (const n of nodes) if (!this.selection.includes(n)) this.selection.push(n);
    else for (const n of nodes) { const i = this.selection.indexOf(n); if (i >= 0) this.selection.splice(i, 1); else this.selection.push(n); }
    this.events.emit('selection');
  }
  get selectedObjects(): X3DObject[] { return this.selection.filter((n): n is X3DObject => n instanceof X3DObject); }
  setSelMode(m: 'object' | CompKind) { this.selMode = m; if (m === 'object') this.compSel = null; else if (this.compSel && this.compSel.kind !== m) this.compSel = { ...this.compSel, kind: m, points: new Set(), edges: new Set(), polygons: new Set() }; this.events.emit('selection'); }
  /** Replace / add / toggle components of one object. Component selection implies that object is selected. */
  selectComponents(obj: X3DObject, kind: CompKind, items: (number | string)[], mode: 'replace' | 'add' | 'toggle' = 'replace') {
    if (!this.compSel || this.compSel.obj !== obj || this.compSel.kind !== kind || mode === 'replace') this.compSel = { obj, kind, points: new Set(), edges: new Set(), polygons: new Set() };
    const set: Set<any> = kind === 'point' ? this.compSel.points : kind === 'edge' ? this.compSel.edges : this.compSel.polygons;
    for (const it of items) { if (mode === 'toggle' && set.has(it)) set.delete(it); else set.add(it); }
    this.selection = [obj]; this.events.emit('selection');
  }
  /** The component selection as a CompSel for topology operators (edges decoded to vertex pairs). */
  componentSel() {
    const c = this.compSel; if (!c) return null;
    if (c.kind === 'point') return { obj: c.obj, sel: { kind: 'point' as const, indices: [...c.points] } };
    if (c.kind === 'polygon') return { obj: c.obj, sel: { kind: 'polygon' as const, indices: [...c.polygons] } };
    const edges = [...c.edges].map(k => k.split('-').map(Number) as [number, number]);
    return { obj: c.obj, sel: { kind: 'edge' as const, indices: edges.map(e => e[0]), edges } };
  }
  /** Objects a command should act on: the explicit args or the current selection. */
  targets(arg?: any): X3DObject[] {
    if (arg === undefined || arg === null || arg === '') return this.selectedObjects;
    const list = Array.isArray(arg) ? arg : String(arg).split(',');
    return list.map(x => x instanceof X3DObject ? x : this.scene.find(String(x).trim())).filter((o): o is X3DObject => !!o);
  }
}

/** Log a command the way the chosen scripting language would (Preferences > Scripting > Language). */
function fmtCall(name: string, vals: any[], lang = 'VBScript'): string {
  const args = vals.map(fmtArg);
  if (lang === 'Python') return `Application.${name}(${args.map(a => a === '' ? 'None' : a === 'True' || a === 'true' ? 'True' : a === 'False' || a === 'false' ? 'False' : a).join(', ')})`;
  if (lang === 'JScript') return `${name}(${args.map(a => a === '' ? 'null' : a).join(', ')});`;
  if (lang === 'PerlScript') return `$Application->${name}(${args.map(a => a === '' ? 'undef' : a).join(', ')});`;
  return `${name} ${args.join(', ')}`;
}
function fmtArg(v: any): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return `"${v.map(x => x?.fullName ?? x).join(',')}"`;
  if (typeof v === 'object' && 'fullName' in v) return `"${v.fullName}"`;
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}
