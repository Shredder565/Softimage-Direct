// Ledger row CMD-B7c, sdkui add-on: `GetWizardParamTab` (SPEC-PARTIAL). Brief:
// docs/ghidra/cmd-b7c-addon-scripts.md, "Wire contract: sdkui". Original code written from that contract only.
//
// The helper object of the "Add Parameter" tab shared by the custom property, operator and primitive wizards.
// Open part (Q11): the two template files of the compiled languages (`PPGEvent.cpp.template`,
// `PPGEvent.cs.template`) are not staged. They are expanded when the file is in the session's virtual host
// file system; otherwise the generator logs "not yet attested" and appends nothing.
// The variant type numbers of `StrFromVariantType` are the public siVariantType values of the Softimage SDK
// (the COM VARENUM numbers).
import { App } from '../core/commands';
import { Node } from '../core/scene';
import { str, bool, int, num } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { WizardHelperObj } from './addonDocWizard';
import {
  addGrid, gridOf, propOf, enableParam, ensureParam, findByName, dictText, msgBox, logNya, listOf, type GridData,
} from './addonScriptsShared';

const PARAM_COLUMNS = ['Type', 'Name', 'Callback', 'Read-Only', 'Animatable', 'Keyable', 'Default', 'Min', 'Max', 'UIMin', 'UIMax'];
const VARIANT_NAMES: Record<number, string> = { 0: 'siEmpty', 2: 'siInt2', 3: 'siInt4', 4: 'siFloat', 5: 'siDouble', 8: 'siString', 9: 'siDispatch', 11: 'siBool', 13: 'siUnknown',
  16: 'siByte', 17: 'siUByte', 18: 'siUInt2', 19: 'siUInt4', 31: 'siWStr' };
const SUFFIX: Record<string, string> = { siInt4: 'Int4', siUByte: 'UByte', siFloat: 'Float', siDouble: 'Float' };
const TYPE_ITEMS: [string, string][] = [['Boolean', 'siBool'], ['Button', 'Button'], ['Color (with Alpha)', 'Color'], ['Double Precision Number', 'siDouble'],
  ['Floating Point Number', 'siFloat'], ['FCurve', 'FCurve'], ['Grid Control', 'Grid'], ['Integer', 'siInt4'], ['Small Integer', 'siUByte'], ['Text', 'siString']];
const boolText = (v: any) => (v ? 'true' : 'false');
const cellNull = (v: any) => (v === undefined || v === '' ? null : v);

export class WizardParamTab {
  readonly WizardHelper: WizardHelperObj;
  constructor(private app: App, readonly Type: string) { this.WizardHelper = new WizardHelperObj(app); }
  private box(id: number, extra = '') { msgBox(this.app, dictText('XSIPLUGINUI', id) + (extra ? ` ${extra}` : '')); }
  private grid(x: any): GridData { return gridOf(propOf(x), 'Params')!; }

  // ---- parameters and layout
  AddParameters(prop: any): void {
    const p = propOf(prop);
    if (!gridOf(p, 'Params')) addGrid(p, 'Params', PARAM_COLUMNS);
    for (const n of ['ParamType', 'ParamName', 'DefaultString']) ensureParam(p, str(n, '', n));
    for (const n of ['ReadOnly', 'Animatable']) ensureParam(p, bool(n, false, n));
    for (const n of ['Keyable', 'Callback']) ensureParam(p, bool(n, true, n));
    for (const n of ['DefaultBool', 'UIRange']) ensureParam(p, bool(n, false, n));
    for (const n of ['DefaultInt4', 'MinInt4', 'UIMinInt4']) ensureParam(p, int(n, 0, n, { uimin: -500, uimax: 500 }));
    for (const n of ['MaxInt4', 'UIMaxInt4']) ensureParam(p, int(n, 100, n, { uimin: -500, uimax: 500 }));
    for (const n of ['DefaultUByte', 'MinUByte', 'UIMinUByte']) ensureParam(p, int(n, 0, n, { min: 0, max: 255, uimin: 0, uimax: 255 }));
    for (const n of ['MaxUByte', 'UIMaxUByte']) ensureParam(p, int(n, 255, n, { min: 0, max: 255, uimin: 0, uimax: 255 }));
    for (const n of ['DefaultFloat', 'MinFloat', 'UIMinFloat']) ensureParam(p, num(n, 0, n, { uimin: -1, uimax: 1 }));
    for (const n of ['MaxFloat', 'UIMaxFloat']) ensureParam(p, num(n, 1, n, { uimin: -1, uimax: 1 }));
    for (const n of ['DefaultColorR', 'DefaultColorG', 'DefaultColorB', 'DefaultColorA']) ensureParam(p, num(n, 0, n, { min: 0, max: 1, uimin: 0, uimax: 1 }));
    p.set('ParamType', 'siInt4'); p.set('ParamName', 'Param');
  }
  BuildParamTabLayout(layout: any, paramType: any, genButtonText: any, existingCount: any): void {
    const t = String(paramType);
    layout.AddTab('Add Parameter');
    layout.AddGroup('Define Item');
    const items = this.Type === 'CustomOperator' ? TYPE_ITEMS.filter(([, v]) => v !== 'siFloat' && v !== 'FCurve' && v !== 'Grid') : TYPE_ITEMS;
    layout.AddEnumControl('ParamType', items.flatMap(([l, v]) => [l, v]), 'ParamType', 'siControlCombo');   // inferred: the combo keeps the parameter's own label
    layout.AddItem('ParamName', 'Name/Label');
    if (this.SupportsReadOnly(t)) layout.AddItem('ReadOnly');
    if (this.SupportsAnimatable(t)) { layout.AddItem('Animatable'); layout.AddItem('Keyable'); }
    if (this.Type !== 'CustomPrimitive') layout.AddItem('Callback');
    const sfx = SUFFIX[t];
    if (t === 'siString') layout.AddItem('DefaultString', 'Default');
    else if (sfx) {
      layout.AddItem(`Default${sfx}`, 'Default');
      layout.AddGroup('Value Range'); layout.AddItem(`Min${sfx}`, 'Min'); layout.AddItem(`Max${sfx}`, 'Max'); layout.EndGroup();
      layout.AddGroup('UI Value Range'); layout.AddItem('UIRange'); layout.AddItem(`UIMin${sfx}`, 'UI Min'); layout.AddItem(`UIMax${sfx}`, 'UI Max'); layout.EndGroup();
    } else if (t === 'siBool') layout.AddItem('DefaultBool', 'Default');
    else if (t === 'Color') layout.AddColor('DefaultColorR', 'Default', true);
    layout.EndGroup();
    layout.AddGroup('Parameters');
    layout.AddRow(); layout.AddButton('AddParam', 'Add Item'); layout.AddButton('RemoveParam', 'Delete Selected'); layout.EndRow();
    if (Number(existingCount) === 0) layout.AddStaticText('No parameters defined');
    else { const g = layout.AddItem('Params', '', 'siControlGrid'); g.SetAttribute('siUINoLabel', true); g.SetAttribute('siUIGridSelectionMode', 'siSelectionHeader'); }
    layout.EndGroup();
    layout.AddButton('Generate2', genButtonText);
  }

  // ---- page events
  UIRange_OnChanged(ppg: any): void {
    const p = propOf(ppg); const on = !!p.val('UIRange');
    for (const n of ['UIMinInt4', 'UIMinUByte', 'UIMinFloat', 'UIMaxInt4', 'UIMaxUByte', 'UIMaxFloat']) enableParam(p, n, on);
  }
  AddParam_OnClicked(ppg: any): void {
    const p = propOf(ppg); const grid = this.grid(p); const H = this.WizardHelper;
    if (String(p.val('ParamName') ?? '') === '') { this.box(7203); return; }
    const name = H.RemoveSpaces(p.val('ParamName'));
    if (grid.rows.some(r => r[1] === name)) { this.box(7204); return; }
    const type = String(p.val('ParamType')); const sfx = SUFFIX[type];
    const fl = sfx === 'Float'; const rd = (v: any) => (fl ? H.FloatPrec3(v) : v);
    const useUI = !!p.val('UIRange');
    let range: any[] | null = null;
    if (sfx) {
      range = [p.val(`Default${sfx}`), p.val(`Min${sfx}`), p.val(`Max${sfx}`), p.val(`UIMin${sfx}`), p.val(`UIMax${sfx}`)];
      if (!this.TestRanges(range[0], range[1], range[2], range[3], range[4], useUI)) return;
    }
    const row = grid.addRow('  ');
    const put = (col: string, v: any) => grid.SetCell(grid.col(col), row, v);
    put('Type', type); put('Name', name);
    put('Callback', boolText(p.val('Callback'))); put('Read-Only', boolText(p.val('ReadOnly'))); put('Animatable', boolText(p.val('Animatable'))); put('Keyable', boolText(p.val('Keyable')));
    if (range) this.SetRange(grid, row, rd(range[0]), rd(range[1]), rd(range[2]), rd(range[3]), rd(range[4]), useUI);
    else if (type === 'Color') put('Default', ['R', 'G', 'B', 'A'].map(c => p.val(`DefaultColor${c}`)).join(','));
    else if (type === 'siBool') put('Default', boolText(p.val('DefaultBool')));
    else if (type === 'siString') put('Default', p.val('DefaultString'));
    p.set('ParamName', this.IncrementParameterName(p.val('ParamName')));
  }
  PopulateParamListFromExistingPSet(ppg: any, objectName: any): false | undefined {
    const name = String(objectName ?? ''); if (name === '') return false;
    const obj = findByName(this.app, name);
    if (obj === undefined) { this.box(7205, name); return false; }
    const grid = this.grid(ppg); grid.clear();
    const put = (row: number, col: string, v: any) => grid.SetCell(grid.col(col), row, v);
    const params: any[] = obj instanceof Node ? obj.params : listOf(obj.Parameters);
    for (const q of params) {
      const d = q.def ?? q; const value = q.value ?? q.Value;
      const row = grid.addRow('  ');
      // inferred: how the build's parameter types map to variant type names
      const isObj = value !== null && typeof value === 'object' && !Array.isArray(value);
      const type = isObj ? (value.rows && value.columns ? 'Grid' : String(value.ClassName ?? value.constructor?.name ?? 'Object'))
        : d.type === 'double' ? 'siDouble' : d.type === 'int' ? 'siInt4' : d.type === 'bool' ? 'siBool' : d.type === 'color' ? 'Color'
          : typeof value === 'number' ? 'siInt4' : 'siString';
      put(row, 'Type', type); put(row, 'Name', q.name ?? q.ScriptName); put(row, 'Callback', 'true');
      put(row, 'Read-Only', boolText(d.readOnly)); put(row, 'Animatable', boolText(q.animatable ?? d.animatable)); put(row, 'Keyable', boolText(q.keyable ?? d.keyable));
      if (type === 'siString') put(row, 'Default', d.value ?? d.Default);
      else if (!isObj) {
        put(row, 'Default', d.value ?? d.Default);
        put(row, 'Min', this.ReasonableNumber(d.min ?? d.Min)); put(row, 'Max', this.ReasonableNumber(d.max ?? d.Max));
        put(row, 'UIMin', this.ReasonableNumber(d.uimin ?? d.SuggestedMin)); put(row, 'UIMax', this.ReasonableNumber(d.uimax ?? d.SuggestedMax));
      }
    }
    return undefined;
  }

  // ---- small rules
  SupportsReadOnly(type: any): boolean { return type !== 'Button'; }
  SupportsAnimatable(type: any): boolean { return !['Button', 'Grid', 'FCurve', 'String'].includes(String(type)); }
  IncrementParameterName(param: any): string {
    const s = String(param ?? ''); const m = /^(.*?)(\d+)$/.exec(s);
    return m ? m[1] + String(Number(m[2]) + 1) : s + '1';
  }
  TestRanges(def: any, min: any, max: any, uiMin: any, uiMax: any, useUI: any): boolean {
    const fail = (id: number) => { this.box(id); return false; };
    if (min >= max) return fail(7206);
    if (def < min) return fail(7207);
    if (def > max) return fail(7208);
    if (useUI) {
      if (uiMin < min) return fail(7209);
      if (uiMax > max) return fail(7210);
      if (uiMax <= uiMin) return fail(7211);
    }
    return true;
  }
  SetRange(grid: GridData, row: number, def: any, min: any, max: any, uiMin: any, uiMax: any, useUI: any): void {
    const put = (col: string, v: any) => grid.SetCell(grid.col(col), row, v);
    put('Default', def); put('Min', min); put('Max', max);
    put('UIMin', useUI ? uiMin : min); put('UIMax', useUI ? uiMax : max);
  }
  ReasonableNumber(n: any): any { return n < -100000 || n > 100000 ? undefined : n; }
  StrFromVariantType(t: any): any { return VARIANT_NAMES[t as number] ?? t; }

  // ---- code generation
  private rows(wizardProp: any): Record<string, any>[] {
    const g = this.grid(wizardProp);
    return g.rows.map(r => Object.fromEntries(g.columns.map((c, i) => [c, cellNull(r[i])])));
  }
  /** Capabilities text of one row. */
  private caps(writer: any, row: Record<string, any>): string {
    const list = ['siPersistable'];
    if (row['Read-Only'] === 'true') list.push('siReadOnly');
    if (row.Animatable === 'true') list.push('siAnimatable');
    if (row.Keyable === 'true') list.push('siKeyable');
    return list.map(c => writer.UseConstant(c, '(int)siCapabilities')).join(writer.ORSyntax);
  }
  GenerateDefineMethod(writer: any, wizardProp: any, objName: any): void {
    const lang = writer.Language; const cs = lang === 'C#', cpp = lang === 'Cpp';
    const op = this.Type === 'CustomOperator' || this.Type === 'CustomPrimitive';
    const obj = `o${this.Type}`;
    const fn = cs ? 'Define' : `${objName}_Define`;
    writer.BeginStdFn(fn);
    writer.VarDecl(cpp ? [`${this.Type} ${obj}`, 'Parameter oParam'] : [`${this.Type} ${obj}`]);
    if (op) {
      writer.VarDecl([cs ? 'ParamDef oPDef' : 'CRef oPDef']);
      if (cpp) writer.Append('\tFactory oFactory = Application().GetFactory();\n');
    }
    writer.OMReadProp(obj, cpp ? 'ctxt' : 'in_ctxt', 'Source', true, cs ? this.Type : undefined);
    for (const row of this.rows(wizardProp)) this.GenerateAddParamCall(writer, obj, row);
    if (this.Type === 'CustomOperator') {
      writer.Append('\n');
      writer.OMAssignProp(obj, 'AlwaysEvaluate', boolText(propOf(wizardProp).val('AlwaysEval')));
      writer.OMAssignProp(obj, 'Debug', 1);
    }
    writer.EndFn(fn, writer.CallbackSuccess);
  }
  /** The add-parameter calls of one grid row. // inferred: the argument lists of the internal steps are not in the note */
  GenerateAddParamCall(writer: any, obj: string, row: Record<string, any>): void {
    const type = String(row.Type); const name = String(row.Name);
    if (type === 'Button') return;
    const op = this.Type === 'CustomOperator' || this.Type === 'CustomPrimitive';
    const low = (n: string, t: string, def: any, min: any, max: any, uiMin: any, uiMax: any) =>
      (op ? this.GenerateOpAddParamCallLowLevel(writer, obj, n, t, def, min, max, uiMin, uiMax, row) : this.GeneratePropAddParamCallLowLevel(writer, obj, n, t, def, min, max, uiMin, uiMax, row));
    if (type === 'Color') {
      const parts = String(row.Default ?? '').split(',');
      ['R', 'G', 'B', 'A'].forEach((c, i) => low(`${name}_${c}`, 'siDouble', parts[i] ?? 0, 0, 1, 0, 1));
    } else if (type === 'Grid' || type === 'FCurve') {
      const S = writer.StrConst(name);
      if (!op) writer.OMCall(null, obj, type === 'Grid' ? 'AddGridParameter' : 'AddFCurveParameter', [S]);
      else { writer.OMCall('oPDef', this.factory(writer), type === 'Grid' ? 'CreateGridParamDef' : 'CreateFCurveParamDef', [S]); this.addCall(writer, obj); }
    } else low(name, type, row.Default, row.Min, row.Max, row.UIMin, row.UIMax);
  }
  GenerateAddParamCallLowLevel(writer: any, obj: string, name: string, type: string, def: any, min: any, max: any, uiMin: any, uiMax: any, row: Record<string, any>): void {
    if (this.Type === 'CustomProperty') this.GeneratePropAddParamCallLowLevel(writer, obj, name, type, def, min, max, uiMin, uiMax, row);
    else this.GenerateOpAddParamCallLowLevel(writer, obj, name, type, def, min, max, uiMin, uiMax, row);
  }
  private factory(writer: any): string { return writer.Language === 'Cpp' ? 'oFactory' : writer.Language === 'C#' ? 'GetFactory()' : 'XSIFactory'; }
  private addCall(writer: any, obj: string) { writer.OMCall(null, obj, 'AddParameter', writer.Language === 'Cpp' ? ['oPDef', 'oParam'] : ['oPDef']); }
  /** Cpp spelling of a value: null is CValue(), a whole number gets the suffix l. */
  private cppVal(v: any): any { return v === null || v === undefined ? 'CValue()' : this.WizardHelper.IntToLong(v); }
  private cppType(type: string): string { return `CValue::${type === 'siUByte' ? 'siUInt1' : type}`; }
  private typeConst(writer: any, type: string): string { return writer.UseConstant(type, 'siVariantType'); }   // inferred: the enum name passed as prefix
  private classif(writer: any): string { return writer.UseConstant('siClassifUnknown', 'siParamClassification'); }
  GeneratePropAddParamCallLowLevel(writer: any, obj: string, name: string, type: string, def: any, min: any, max: any, uiMin: any, uiMax: any, row: Record<string, any>): void {
    const cpp = writer.Language === 'Cpp', cs = writer.Language === 'C#';
    const S = (s: any) => writer.StrConst(s); const caps = this.caps(writer, row);
    const strDef = def === null || def === undefined ? null : S(def);   // a null string default stays unquoted
    if (type === 'siString') {
      if (cpp) writer.OMCall(null, obj, 'AddParameter', [S(name), 'CValue::siString', caps, S(''), S(''), strDef ?? 'CValue()', 'oParam']);
      else writer.OMCall(null, obj, 'AddParameter2', [S(name), this.typeConst(writer, type), strDef, null, null, null, null, this.classif(writer), caps, ...(cs ? [null, null, null] : [])]);
    } else if (cpp) writer.OMCall(null, obj, 'AddParameter', [S(name), this.cppType(type), caps, S(''), S(''), ...[def, min, max, uiMin, uiMax].map(v => this.cppVal(v)), 'oParam']);
    else writer.OMCall(null, obj, 'AddParameter2', [S(name), this.typeConst(writer, type), def, min, max, uiMin, uiMax, this.classif(writer), caps, ...(cs ? [null, null, null] : [])]);
  }
  GenerateOpAddParamCallLowLevel(writer: any, obj: string, name: string, type: string, def: any, min: any, max: any, uiMin: any, uiMax: any, row: Record<string, any>): void {
    const cpp = writer.Language === 'Cpp';
    const S = (s: any) => writer.StrConst(s); const caps = this.caps(writer, row); const f = this.factory(writer);
    const strDef = def === null || def === undefined ? null : S(def);
    if (type === 'siString') {
      if (cpp) writer.OMCall('oPDef', f, 'CreateParamDef', [S(name), 'CValue::siString', strDef ?? 'CValue()']);
      else writer.OMCall('oPDef', f, 'CreateParamDef2', [S(name), this.typeConst(writer, type), strDef, null, null], true);
    } else if (cpp) writer.OMCall('oPDef', f, 'CreateParamDef', [S(name), this.cppType(type), caps, S(''), S(''), ...[def, min, max, uiMin, uiMax].map(v => this.cppVal(v))]);
    else writer.OMCall('oPDef', f, 'CreateParamDef', [S(name), this.typeConst(writer, type), this.classif(writer), caps, S(''), S(''), def, min, max, uiMin, uiMax], true);
    this.addCall(writer, obj);
  }

  GenerateLogicCallbacks(writer: any, lang: any, wizardProp: any, objName: any): void {
    if (lang === 'Cpp' || lang === 'C#') this.GenerateLogicCallbacksCompiled(writer, lang, objName);
    else this.GenerateLogicCallbacksScripting(writer, wizardProp, objName);
  }
  GenerateLogicCallbacksScripting(writer: any, wizardProp: any, objName: any): void {
    const logged = (name: string, body?: () => void) => {
      writer.BeginFn(null, name, null);
      writer.LogMessage(writer.StrConst(`${name} called`));
      body?.();
      writer.EndFn(name);
    };
    logged(`${objName}_OnInit`); logged(`${objName}_OnClosed`);
    for (const row of this.rows(wizardProp)) {
      if (row.Callback !== 'true') continue;
      const n = String(row.Name), type = String(row.Type);
      if (type === 'Button') logged(`${objName}_${n}_OnClicked`);
      else if (type === 'Color') for (const c of ['R', 'G', 'B', 'A']) logged(`${objName}_${n}_${c}_OnChanged`);
      else logged(`${objName}_${n}_OnChanged`, () => {
        writer.VarDecl(['oParam']);
        writer.OMReadProp('oParam', 'PPG', n, true);
        if (type === 'Grid' || type === 'FCurve') {
          const v = type === 'Grid' ? 'oGridData' : 'oFCurve';
          writer.VarDecl([v]); writer.OMReadProp(v, 'oParam', 'Value', true);
        } else {
          writer.VarDecl(['paramVal']); writer.OMReadProp('paramVal', 'oParam', 'Value');
          writer.LogMessage(writer.StrCat([writer.StrConst('New value: '), 'paramVal']));
        }
      });
    }
  }
  GenerateLogicCallbacksCompiled(writer: any, lang: any, objName: any): void {
    const file = this.WizardHelper.GetTemplateFolder() + (lang === 'Cpp' ? 'PPGEvent.cpp.template' : 'PPGEvent.cs.template');
    if (!hostFs.isFile(file)) { logNya(this.app, 'GetWizardParamTab', `the template file ${file} is not staged; no page-event code was generated for ${lang}`, 'Q11'); return; }
    writer.Append(this.WizardHelper.GenerateStringFromTemplate(file, ['%%plugin%%', '%%objtype%%'], [objName, this.Type]));
  }
}

export function registerWizardParamTabCommand(app: App) {
  app.register({
    name: 'GetWizardParamTab', label: 'GetWizardParamTab', category: 'Custom', description: '',
    args: [{ name: 'in_Type', default: '' }], undoable: false, noLog: true,
    execute(app2, a) { return new WizardParamTab(app2, String(a.in_Type ?? '')); },
  });
}
