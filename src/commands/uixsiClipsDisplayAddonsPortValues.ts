// Ledger row CMD-B6b, DisplayPortValues part. Brief: docs/ghidra/cmd-b6b-uixsi-clips-display-addons.md, "Wire contract"
// (section `DisplayPortValues (script entry)`). Original code written from that contract only.
//
// The registry has two entries under this scripting name: a script entry (the modal "Show Values" dialog, which ends
// by calling a command of its own name with 27 arguments) and a C++ entry with the same 27 arguments ("Turns on/off
// display of port data in the 3D view."). Which entry a plain call reaches, and who hands the dialog its three extra
// inputs (data type, context, structure), is open (Q1, Q2). This build therefore registers:
//   * the bus command `DisplayPortValues` (script entry's argument names / defaults) as the 27-argument setter the
//     dialog calls: it stores the display settings per port. Drawing the values in the 3D view is not attested.   // inferred
//   * the dialog as `app.uixsiClipsDisplayAddons.showPortValues(args, dataType, context, structure)` (Promise).
import type { App, ArgDef, CommandDef } from '../core/commands';
import { Property } from '../core/scene';
import { str, bool, int, num, type ParamDef } from '../core/params';
import { sdkModal } from '../ui/sdkHelpersModal';
import { interactive } from './miscDsScriptsPick';

const NOTE = 'docs/ghidra/cmd-b6b-uixsi-clips-display-addons.md';

export const PORT_VALUE_ARGS: ArgDef[] = [
  { name: 'Port', default: null }, { name: 'Enable', default: true }, { name: 'Mode', default: 0 }, { name: 'ClearLabel', default: false },
  { name: 'Label', default: '' }, { name: 'Position', default: 0 }, { name: 'OffsetX', default: 0 }, { name: 'OffsetY', default: 0 },
  { name: 'Scale', default: 1.0 }, { name: 'SkipDefault', default: false }, { name: 'UseColor', default: true },
  { name: 'ColorR', default: 0.62 }, { name: 'ColorG', default: 1.0 }, { name: 'ColorB', default: 0.62 }, { name: 'ColorA', default: 1.0 },
  { name: 'UseRange', default: false }, { name: 'RangeStart', default: 0 }, { name: 'RangeEnd', default: 10000 }, { name: 'RangeStep', default: 1 },
  { name: 'SelectedOnly', default: false }, { name: 'SubArray', default: false }, { name: 'ArrayStart', default: 0 }, { name: 'ArrayEnd', default: 10 },
  { name: 'Global', default: false }, { name: 'DrawOnTop', default: true }, { name: 'ModifiedOnly', default: false }, { name: 'Percentage', default: 100 },
];
const ARG_NAMES = PORT_VALUE_ARGS.map(a => a.name);

export class PortValuesCancelled extends Error {
  readonly siErrCancelled = true;
  constructor() { super('DisplayPortValues cancelled (siErrCancelled)'); this.name = 'siErrCancelled'; }
}

// Context / structure constants of the contract.
export const CONTEXT_SUBSET_MASTER = 32, STRUCTURE_ARRAY = 2;
/** Dialog label per data type (short type name = the siICENodeData... constant without its prefix). */
export const DATA_TYPE_LABELS: Record<string, string> = {
  Bool: 'Boolean', Long: 'Integer', Float: 'Scalar', Vector2: 'Vector 2D', Vector3: 'Vector 3D', Vector4: 'Vector 4D', Matrix33: 'Matrix 3D',
  Matrix44: 'Matrix 4D', Quaternion: 'Quaternion', Rotation: 'Rotation', Color4: 'Color', Location: 'Location', Shape: 'Shape', String: 'String', Icon: 'Icon',
};
// inferred: numeric values of the data type constants, from the public SDK enum documentation (siICENodeDataType).
const DATA_TYPE_VALUES: Record<number, string> = {
  1: 'Bool', 2: 'Long', 4: 'Float', 8: 'Vector2', 16: 'Vector3', 32: 'Vector4', 64: 'Quaternion', 128: 'Matrix33', 256: 'Matrix44', 512: 'Color4',
  2048: 'Location', 32768: 'Rotation', 65536: 'Shape', 262144: 'String', 524288: 'Icon',
};
export function dataTypeKey(t: any): string | null {
  if (typeof t === 'number') return DATA_TYPE_VALUES[t] ?? null;
  const s = String(t ?? '').trim().replace(/^:?siICENodeData/, '').replace(/:.*$/, '');
  if (/^\d+$/.test(s)) return DATA_TYPE_VALUES[Number(s)] ?? null;
  return s in DATA_TYPE_LABELS ? s : null;
}

const M = { Numeric: 0, Vectors: 1, Points: 2, 'Point Trails': 3, Axes: 4, 'Axis + Angle': 5, Colors: 6, Nulls: 7, 'Vectors + Length': 8, 'Axis + Numeric Angle': 9, 'Vector Trails': 10, Lines: 11 } as const;
type Choice = [string, number];
const pick = (...labels: (keyof typeof M)[]): Choice[] => labels.map(l => [l, M[l]]);
/** The "Display As" list for a data type / context / structure, in dialog order. */
export function displayModeChoices(type: string, context: number, structure: number): Choice[] {
  const array = Number(structure) === STRUCTURE_ARRAY;
  switch (type) {
    case 'Location': return array ? pick('Points', 'Lines', 'Nulls', 'Numeric') : pick('Points', 'Nulls', 'Numeric');
    case 'Vector3':
      if (Number(context) === CONTEXT_SUBSET_MASTER) return array ? pick('Points', 'Lines', 'Nulls', 'Numeric') : pick('Points', 'Nulls', 'Numeric');
      return array ? pick('Points', 'Lines', 'Point Trails', 'Vector Trails', 'Vectors', 'Vectors + Length', 'Nulls', 'Numeric')
        : pick('Points', 'Point Trails', 'Vector Trails', 'Vectors', 'Vectors + Length', 'Nulls', 'Numeric');
    case 'Vector4': return pick('Points', 'Nulls', 'Numeric');
    case 'Quaternion': case 'Rotation': return pick('Axis + Angle', 'Axis + Numeric Angle', 'Axes', 'Numeric');
    case 'Matrix33': case 'Matrix44': return pick('Axes', 'Numeric');
    case 'Color4': return pick('Colors', 'Numeric');
    default: return pick('Numeric');
  }
}
/** Label offset after the label position changes (0 Above, 1 Below, 2 Left, 3 Right). */
export function rotateLabelOffset(from: number, to: number, x: number, y: number): [number, number] {
  if (from === to) return [x, y];
  const opposite: Record<number, number> = { 0: 1, 1: 0, 2: 3, 3: 2 };
  if (opposite[from] === to) return [-x || 0, -y || 0];
  const quarter = new Set(['0>2', '2>1', '1>3', '3>0']);   // Above to Left, Left to Below, Below to Right, Right to Above
  return quarter.has(`${from}>${to}`) ? [-y || 0, x] : [y, -x || 0];
}

export interface PortValuesHost {
  /** Display settings per port (the 27 values of the last setter call). */
  portDisplays: Map<string, Record<string, any>>;
  /** The open Show Values dialog, for scripts and checks. */
  portDialog: { property: Property; apply(): void; refresh(): void } | null;
  showPortValues(args: Record<string, any>, dataType: any, context: number, structure: number): Promise<Record<string, any>>;
  /** The dialog's pure rules, for scripts and checks. */
  portValueRules: { displayModeChoices: typeof displayModeChoices; rotateLabelOffset: typeof rotateLabelOffset; dataTypeKey: typeof dataTypeKey };
}

const portKey = (p: any) => String(p?.fullName ?? p ?? '');
const POSITIONS: Choice[] = [['Above', 0], ['Below', 1], ['Left', 2], ['Right', 3]];

/** Dialog value -> setter argument. */
const FROM_PARAM: Record<string, string> = { Enable: 'Show', Mode: 'DisplayMode', Scale: 'ScaleFactor' };
const paramOfArg = (a: string) => FROM_PARAM[a] ?? a;

export function registerDisplayPortValues(app: App, host: PortValuesHost, reg: (def: CommandDef) => void) {
  const full = (a: Record<string, any>) => Object.fromEntries(PORT_VALUE_ARGS.map(d => [d.name, a[d.name] !== undefined ? a[d.name] : d.default]));

  reg({
    name: 'DisplayPortValues', label: 'Display Port Values', category: 'Simulation', description: 'Turns on/off display of port data in the 3D view.',
    args: PORT_VALUE_ARGS, undoable: false,
    execute(app, a) {
      const key = portKey(a.Port);
      if (!key) { app.logMsg('info', `DisplayPortValues: not yet attested: a call without a port (who supplies the port and its data type, context and structure is open; ${NOTE} Q1)`); return; }
      const v = full(a); v.Port = key;
      host.portDisplays.set(key, v);
      app.logMsg('info', `DisplayPortValues: not yet attested: drawing port values in the 3D view (the C++ entry; ${NOTE} Q2); settings for ${key} stored, display ${v.Enable ? 'on' : 'off'}`);
      app.events.emit('scene');
    },
  });

  host.portValueRules = { displayModeChoices, rotateLabelOffset, dataTypeKey };
  host.showPortValues = async (args, dataType, context, structure) => {
    const incoming = full(args);
    // 1. the property is added before the data type check, so an unsupported type leaves it behind
    const prop = new Property('ShowValues', 'customparamset', []);
    app.scene.root.addProperty(prop); app.events.emit('scene');
    // 2. data type
    const type = dataTypeKey(dataType);
    if (!type) throw new PortValuesCancelled();
    const choices = displayModeChoices(type, context, structure);
    const array = Number(structure) === STRUCTURE_ARRAY;
    let useColor = !!incoming.UseColor; if (type === 'Color4' && Number(incoming.Mode) === M.Colors) useColor = false;
    // 3. parameters
    const na = { animatable: false };
    const defs: ParamDef[] = [
      bool('Applied', false, 'Applied', na), str('Port', portKey(incoming.Port), 'Port', { readOnly: true }), str('Type', DATA_TYPE_LABELS[type], 'Type', { readOnly: true }),
      bool('Show', !!incoming.Enable, 'Show', na), int('DisplayMode', Number(incoming.Mode) || 0, 'Display As', na), str('Label', String(incoming.Label ?? ''), 'Label'),
      num('ScaleFactor', Number(incoming.Scale), 'Scale Factor', { uimin: 0.001, uimax: 10 }), bool('UseColor', useColor, 'Custom Color', na),
      num('ColorR', Number(incoming.ColorR), 'ColorR', na), num('ColorG', Number(incoming.ColorG), 'ColorG', na), num('ColorB', Number(incoming.ColorB), 'ColorB', na), num('ColorA', Number(incoming.ColorA), 'ColorA', na),
      bool('UseRange', !!incoming.UseRange, 'Range', na),
      int('RangeStart', Number(incoming.RangeStart), 'RangeStart', { min: 0, uimin: 0, uimax: 10000 }), int('RangeEnd', Number(incoming.RangeEnd), 'RangeEnd', { min: 0, uimin: 0, uimax: 10000 }),
      int('RangeStep', Number(incoming.RangeStep), 'Step', { min: 1, uimin: 1, uimax: 20 }),
      bool('SkipDefault', !!incoming.SkipDefault, 'Skip Default Values During Display', na), bool('SelectedOnly', !!incoming.SelectedOnly, 'Show Values for Tagged Components Only', na),
      int('OffsetX', Number(incoming.OffsetX), 'Label Offset', { uimin: -100, uimax: 100 }), int('OffsetY', Number(incoming.OffsetY), 'OffsetY', { uimin: -100, uimax: 100 }),
      int('LastPosition', Number(incoming.Position) || 0, 'LastPosition', na), int('Position', Number(incoming.Position) || 0, 'Position', na),
      bool('SubArray', !!incoming.SubArray, 'Array Range', na),
      int('ArrayStart', Number(incoming.ArrayStart), 'ArrayStart', { min: 0, uimin: 0, uimax: 10 }), int('ArrayEnd', Number(incoming.ArrayEnd), 'ArrayEnd', { min: 0, uimin: 0, uimax: 10 }),
      bool('Global', !!incoming.Global, 'Use Global Coordinates for Display', na), bool('DrawOnTop', !!incoming.DrawOnTop, 'Draw Values On Top of Shaded Objects', na),
      bool('ModifiedOnly', !!incoming.ModifiedOnly, 'Show Values Computed at Current Frame Only', na),
      int('Percentage', Number(incoming.Percentage), 'Display %', { min: 1, max: 100 }),
    ];
    for (const d of defs) prop.add(d);

    const current = (): Record<string, any> => {
      const v: Record<string, any> = {};
      for (const n of ARG_NAMES) v[n] = n === 'Port' ? incoming.Port : n === 'ClearLabel' ? true : prop.val(paramOfArg(n));
      return v;
    };
    const apply = () => { prop.set('Applied', true); app.run('DisplayPortValues', current()); };
    const cleanup = () => { app.scene.root.removeProperty(prop); host.portDialog = null; app.events.emit('scene'); };   // 9. DeleteObj <property>

    let ok = false;
    if (!interactive(app)) {
      app.logMsg('info', `DisplayPortValues: not yet attested: the modal Show Values page without a user session; treated as Cancel (${NOTE} Q1)`);
    } else {
      try {
        ok = await sdkModal('Show Values', (body) => {
          const controls = new Map<string, HTMLInputElement | HTMLSelectElement>();
          const row = (...els: HTMLElement[]) => { const r = document.createElement('div'); r.className = 'spv-row'; r.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0'; r.append(...els); body.appendChild(r); return r; };
          const lab = (t: string) => { const l = document.createElement('label'); l.textContent = t; l.style.cssText = 'flex:0 0 auto'; return l; };
          const wrap = (name: string, label: string, el: HTMLElement) => { const s = document.createElement('span'); s.dataset.param = name; s.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1 1 auto;min-width:0'; if (label) s.appendChild(lab(label)); s.appendChild(el); return s; };
          const check = (name: string, label: string) => {
            const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!prop.val(name); c.onchange = () => { prop.set(name, c.checked); logic(name); };
            controls.set(name, c); const s = wrap(name, '', c); s.appendChild(lab(label)); return s;
          };
          const field = (name: string, label: string, readOnly = false) => {
            const t = document.createElement('input'); t.type = 'text'; t.value = String(prop.val(name) ?? ''); t.readOnly = readOnly; t.style.cssText = 'flex:1 1 auto;min-width:0;width:60px';
            t.onchange = () => { prop.set(name, t.value); t.value = String(prop.val(name) ?? ''); logic(name); };
            controls.set(name, t); return wrap(name, label, t);
          };
          const list = (name: string, label: string, items: Choice[]) => {
            const s = document.createElement('select'); for (const [l, v] of items) { const o = document.createElement('option'); o.textContent = l; o.value = String(v); s.appendChild(o); }
            s.value = String(prop.val(name)); s.onchange = () => { prop.set(name, Number(s.value)); logic(name); };
            controls.set(name, s); return wrap(name, label, s);
          };
          const enable = (name: string, on: boolean) => { const c = controls.get(name); if (c) c.disabled = !on; };
          const sync = () => { for (const [n, c] of controls) { if (c instanceof HTMLInputElement && c.type === 'checkbox') c.checked = !!prop.val(n); else if (n !== 'ColorR') c.value = String(prop.val(n) ?? ''); } };
          const colorRule = () => enable('ColorR', !!prop.val('UseColor') && !controls.get('UseColor')?.disabled);
          const logic = (changed: string | null) => {
            // 5. dialog behaviour; the four rules are also applied when the page opens (changed === null)
            if (changed === null || changed === 'DisplayMode') {
              const mode = Number(prop.val('DisplayMode'));
              if (mode === M.Numeric) { enable('ScaleFactor', false); enable('UseColor', true); enable('ColorR', true); }
              else if (mode === M.Colors) { enable('ScaleFactor', false); enable('UseColor', false); enable('ColorR', false); }
              else enable('ScaleFactor', true);
            }
            if (changed === null || changed === 'UseRange') for (const n of ['RangeStart', 'RangeEnd', 'RangeStep']) enable(n, !!prop.val('UseRange'));
            if (changed === null || changed === 'SubArray') for (const n of ['ArrayStart', 'ArrayEnd']) enable(n, !!prop.val('SubArray'));
            if (changed === null || changed === 'UseColor') colorRule();
            if (changed === 'Position') {
              const [x, y] = rotateLabelOffset(Number(prop.val('LastPosition')), Number(prop.val('Position')), Number(prop.val('OffsetX')), Number(prop.val('OffsetY')));
              prop.set('OffsetX', x); prop.set('OffsetY', y); prop.set('LastPosition', prop.val('Position')); sync();
            }
          };
          // 4. layout, top to bottom
          const applyB = document.createElement('button'); applyB.className = 'spv-apply'; applyB.textContent = 'Apply'; applyB.onclick = apply;
          row(check('Show', 'Show'), field('Type', '', true), applyB);
          row(list('DisplayMode', 'Display As', choices)); row(field('ScaleFactor', 'Scale Factor')); row(field('Percentage', 'Display %'));
          row(field('Label', 'Label'), list('Position', '', POSITIONS));
          row(field('OffsetX', 'Label Offset'), field('OffsetY', ''));
          row(check('UseRange', 'Range'), field('RangeStart', ''), field('RangeEnd', '')); row(field('RangeStep', 'Step'));
          if (array) row(check('SubArray', 'Array Range'), field('ArrayStart', ''), field('ArrayEnd', ''));
          const col = document.createElement('input'); col.type = 'color';
          const hex = (n: string) => Math.max(0, Math.min(255, Math.round(Number(prop.val(n)) * 255))).toString(16).padStart(2, '0');
          col.value = `#${hex('ColorR')}${hex('ColorG')}${hex('ColorB')}`;
          col.onchange = () => { ['ColorR', 'ColorG', 'ColorB'].forEach((n, i) => prop.set(n, parseInt(col.value.slice(1 + i * 2, 3 + i * 2), 16) / 255)); };
          controls.set('ColorR', col);
          row(check('UseColor', 'Custom Color'), wrap('ColorR', '', col), field('ColorA', 'A'));
          for (const [n, l] of [['Global', 'Use Global Coordinates for Display'], ['DrawOnTop', 'Draw Values On Top of Shaded Objects'], ['SkipDefault', 'Skip Default Values During Display'], ['ModifiedOnly', 'Show Values Computed at Current Frame Only'], ['SelectedOnly', 'Show Values for Tagged Components Only']]) row(check(n, l));
          const note = document.createElement('div'); note.className = 'spv-note'; note.textContent = "NOTE: '#' in the label will be replaced by the item id for display."; body.appendChild(note);
          logic(null);
          host.portDialog = { property: prop, apply, refresh: () => { sync(); logic(null); } };
        }, { w: 400, cls: 'uixsi-showvalues' });
      } catch (e) { cleanup(); throw e; }
    }
    if (ok) {
      // 7. OK: every dialog value goes back into the in/out arguments, ClearLabel true, one setter call
      const v = current(); for (const n of ARG_NAMES) if (n !== 'Port') args[n] = v[n];
      app.run('DisplayPortValues', v);
    } else if (prop.val('Applied')) {
      app.run('DisplayPortValues', incoming);   // 8. Cancel after Apply: the incoming values again
    }
    cleanup();
    if (!ok) throw new PortValuesCancelled();   // 10.
    return args;
  };
}
