// Ledger row CMD-B7c, sdkui add-on (code writers and layout controller). Brief:
// docs/ghidra/cmd-b7c-addon-scripts.md, "Wire contract: sdkui" (`SDKGetScriptGenerator`, `PPGLayoutControl`).
// Original code written from that contract only.
//
// Both commands hand back a helper object; the behaviour is in the object's methods. Every writer appends to
// the one buffer `app.addonScripts.generatorBuffer`.
import { App } from '../core/commands';
import { addonScriptsState as state, NOTE, gridOf, listOf, logWarning, type GridData } from './addonScriptsShared';

const TAB = '\t', LF = '\n';
const given = (v: any) => v !== null && v !== undefined && v !== '';
const PREFIX_ERROR = 'Prefix is not defined. Prefix should be the name of the enum. C# needs it';

// ------------------------------------------------------------------ writers

/** Members common to all writers; a language replaces what differs. */
export class ScriptWriter {
  readonly Type = 'SDK Script Generator';
  CallbackSuccess = 'true';
  ORSyntax = ' | ';
  /** Tabs in front of a statement, the line comment prefix, the statement terminator. */
  protected indent = TAB; protected commentPrefix = '// '; protected semi = ';';
  /** Name used in the "Error call to ..." log of FnCall; '' = the writer does not log. */
  protected fnCallLabel = '';
  constructor(protected app: App, readonly Language: string) {}

  // ---- buffer (shared by every writer)
  Clear() { state.generatorBuffer = ''; }
  Append(text: any) { state.generatorBuffer += String(text); }
  GetWriterString(): string { return state.generatorBuffer; }

  // ---- text helpers
  StrConst(s: any): string { return `"${s}"`; }
  StripType(x: any): any {
    if (typeof x === 'string') { const w = x.split(' '); return w[w.length - 1]; }
    if (Array.isArray(x)) { x.forEach((e, i) => { if (typeof e === 'string') x[i] = this.StripType(e); }); return x; }
    return x;
  }
  StripVar(x: any): any { return typeof x === 'string' ? x.split(' ')[0] : x; }
  NestingPrefix(n: any): string { return TAB.repeat(Math.max(0, Number(n) || 0)); }
  BoolStr(v: any): string { return v ? 'true' : 'false'; }
  UseConstant(text: any, prefix?: any): string { this.needPrefix(prefix); return String(text); }
  protected needPrefix(prefix: any) { if (!given(prefix)) throw new Error(PREFIX_ERROR); }
  BeginClass(_name?: any, _base?: any): string { return ''; }
  EndClass(): string { return ''; }
  StrCat(parts: any): string { return listOf(parts).join(' + '); }
  ToStr(expr: any): any { return expr; }

  /** Argument list text: null = none, a string as it is, an array joined with "," (a null element is the word null). */
  protected argText(args: any, by: string, ret: any, fn: any): string {
    if (args === null || args === undefined) return '';
    if (typeof args === 'string') return args;
    if (Array.isArray(args)) return args.map(a => a === null || a === undefined ? 'null' : String(a)).join(',');   // inferred: string conversion of a null element
    if (by) this.app.logMsg('info', `Error call to ${by} ${ret} ${fn} ${args}`);
    return '';
  }
  protected names(vars: any): string { return listOf(typeof vars === 'string' ? [vars] : vars).map(v => this.StripType(v)).join(','); }

  // ---- emitted text
  Comment(lines: any, nesting?: any) { for (const l of listOf(lines)) this.Append(this.NestingPrefix(nesting) + this.commentPrefix + l + LF); }
  BeginFn(_ret: any, name: any, args?: any) { const a = given(args) ? this.names(args) : ''; this.Append(`function ${name}( ${a ? a + ' ' : ''})${LF}{${LF}`); }
  EndFn(_name?: any, retval?: any, _isObject?: any) { this.Append((given(retval) ? `${this.indent}return ${retval}${this.semi}${LF}` : '') + `}${LF}${LF}`); }
  VarDecl(vars: any) { this.Append(`${this.indent}var ${this.names(vars)};${LF}`); }
  FnCall(ret: any, fn: any, args?: any, _isObject?: any, declare?: any) {
    const lhs = given(ret) ? `${declare ? 'var ' : ''}${ret} = ` : '';
    this.Append(`${this.indent}${lhs}${fn}(${this.argText(args, this.fnCallLabel, ret, fn)})${this.semi}${LF}`);
  }
  OMCall(ret: any, obj: any, method: any, args?: any, isObject?: any, declare?: any) { this.FnCall(ret, `${obj}.${method}`, args, isObject, declare); }
  OMAssignProp(obj: any, prop: any, val: any, _isObject?: any) { this.Append(`${this.indent}${obj}.${prop} = ${val}${this.semi}${LF}`); }
  OMReadProp(ret: any, obj: any, prop: any, _isObject?: any, _type?: any) { this.Append(`${this.indent}${ret} = ${obj}.${prop}${this.semi}${LF}`); }
  LogMessage(text: any) { this.Append(`${this.indent}Application.LogMessage(${text},siVerbose)${this.semi}${LF}`); }
  BeginStdFn(name: any) { this.BeginFn(null, name, 'in_ctxt'); }
}

class JScriptWriter extends ScriptWriter {
  protected fnCallLabel = 'JS_FnCall';
  OMReadProp(ret: any, obj: any, prop: any) { this.Append(`${TAB}${this.StripType(ret)} = ${obj}.${prop};${LF}`); }   // the type is stripped from the variable
}

class CppWriter extends ScriptWriter {
  CallbackSuccess = 'CStatus::OK';
  protected fnCallLabel = 'CPP_FnCall';
  StrConst(s: any): string { return `L"${s}"`; }
  private rawArgs(args: any): string { return given(args) ? (Array.isArray(args) ? args.join(',') : String(args)) : ''; }
  BeginFn(_ret: any, name: any, args?: any) { const a = this.rawArgs(args); this.Append(`SICALLBACK ${name}( ${a ? a + ' ' : ''})${LF}{${LF}`); }   // inferred: no arguments gives "( )" as in the JScript writer
  BeginLocalFn(ret: any, name: any, args?: any) { const a = this.rawArgs(args); this.Append(`${ret} ${name}( ${a ? a + ' ' : ''})${LF}{${LF}`); }
  VarDecl(vars: any) { for (const v of listOf(typeof vars === 'string' ? [vars] : vars)) this.Append(`${TAB}${v};${LF}`); }
  FnCall(ret: any, fn: any, args?: any, _isObject?: any, declare?: any) {
    const lhs = given(ret) ? `${given(declare) ? declare + ' ' : ''}${ret} = ` : '';
    this.Append(`${this.indent}${lhs}${fn}(${this.argText(args, this.fnCallLabel, ret, fn)});${LF}`);
  }
  OMAssignProp(obj: any, prop: any, val: any) { this.Append(`${TAB}${obj}.Put${prop}(${val});${LF}`); }
  OMReadProp(ret: any, obj: any, prop: any, _isObject?: any, type?: any) { this.Append(`${TAB}${given(type) ? type + ' ' : ''}${ret} = ${obj}.Get${prop}();${LF}`); }
  LogMessage(text: any) { this.Append(`${TAB}Application().LogMessage(${text},siVerboseMsg);${LF}`); }
  BeginStdFn(name: any) { this.Append(`SICALLBACK ${name}( CRef& in_ctxt )${LF}{${LF}${TAB}Context ctxt( in_ctxt );${LF}`); }
}

class CSharpWriter extends ScriptWriter {
  protected indent = TAB + TAB;
  protected fnCallLabel = 'CS_FnCall';
  private rawArgs(args: any): string { return given(args) ? (Array.isArray(args) ? args.join(',') : String(args)) : ''; }
  BeginFn(ret: any, name: any, args?: any) { const a = this.rawArgs(args); this.Append(`${TAB}public ${ret} ${name}( ${a ? a + ' ' : ''})${LF}${TAB}{${LF}`); }   // inferred: arguments are kept with their types
  EndFn(_name?: any, retval?: any) { this.Append((given(retval) ? `${TAB}${TAB}return ${retval};${LF}` : '') + `${TAB}}${LF}${LF}`); }
  VarDecl(vars: any) { for (const v of listOf(typeof vars === 'string' ? [vars] : vars)) this.Append(`${TAB}${TAB}${v} = null;${LF}`); }
  FnCall(ret: any, fn: any, args?: any, _isObject?: any, declare?: any) {
    const lhs = given(ret) ? `${given(declare) ? declare + ' ' : ''}${ret} = ` : '';
    this.Append(`${this.indent}${lhs}${fn}(${this.argText(args, this.fnCallLabel, ret, fn)});${LF}`);
  }
  OMCall(ret: any, obj: any, method: any, args?: any, isObject?: any, declare?: any) { this.FnCall(ret, obj === null || obj === undefined ? String(method) : `${obj}.${method}`, args, isObject, declare); }
  OMReadProp(ret: any, obj: any, prop: any, _isObject?: any, type?: any) { this.Append(`${TAB}${TAB}${ret} = ${given(type) ? `(${type})` : ''}${obj}.${prop};${LF}`); }
  LogMessage(text: any) { this.Append(`${TAB}${TAB}Log(${text});${LF}`); }
  BeginStdFn(name: any) { this.Append(`${TAB}public bool ${name}( Context in_ctxt )${LF}${TAB}{${LF}`); }
  UseConstant(text: any, prefix?: any): string { this.needPrefix(prefix); return `${prefix}.${text}`; }
  BeginClass(name?: any, base?: any): string { this.Append(`${LF}public class ${name}${given(base) ? ` : ${base}` : ''}${LF}{${LF}`); return ''; }
  EndClass(): string { this.Append(`}${LF}`); return ''; }
}

class VBScriptWriter extends ScriptWriter {
  ORSyntax = ' OR ';
  protected commentPrefix = "' "; protected semi = '';
  BoolStr(v: any): string { return v ? 'True' : 'False'; }
  StrCat(parts: any): string { return listOf(parts).join(' & '); }
  ToStr(expr: any): any { return `cstr(${expr})`; }
  /** A null element is written as nothing; trailing null elements go together with their commas. */
  protected argText(args: any): string {
    if (args === null || args === undefined) return '';
    if (typeof args === 'string') return args;
    if (!Array.isArray(args)) return '';
    const a = [...args]; while (a.length && (a[a.length - 1] === null || a[a.length - 1] === undefined)) a.pop();
    return a.map(x => x === null || x === undefined ? '' : String(x)).join(',');
  }
  BeginFn(_ret: any, name: any, args?: any) { const a = given(args) ? this.names(args) : ''; this.Append(`function ${name}( ${a ? a + ' ' : ''})${LF}`); }
  EndFn(name?: any, retval?: any, isObject?: any) { this.Append((given(retval) ? `${TAB}${isObject ? 'set ' : ''}${name} = ${retval}${LF}` : '') + `end function${LF}${LF}`); }
  BeginSub(name: any, args?: any) { const a = given(args) ? this.names(args) : ''; this.Append(`sub ${name}( ${a ? a + ' ' : ''})${LF}`); }
  EndSub() { this.Append(`end sub${LF}${LF}`); }
  VarDecl(vars: any) { this.Append(`${TAB}dim ${this.names(vars)}${LF}`); }
  FnCall(ret: any, fn: any, args?: any, isObject?: any, declare?: any) {
    const a = this.argText(args);
    if (given(ret)) this.Append(`${TAB}${declare ? `dim ${ret} : ` : ''}${isObject ? 'set ' : ''}${ret} = ${fn}(${a})${LF}`);
    else this.Append(`${TAB}${fn}${a ? ' ' + a : ''}${LF}`);
  }
  OMAssignProp(obj: any, prop: any, val: any, isObject?: any) { this.Append(`${TAB}${isObject ? 'set ' : ''}${obj}.${prop} = ${val}${LF}`); }
  OMReadProp(ret: any, obj: any, prop: any, isObject?: any) { this.Append(`${TAB}${isObject ? 'set ' : ''}${ret} = ${obj}.${prop}${LF}`); }
  LogMessage(text: any) { this.Append(`${TAB}Application.LogMessage ${text},siVerbose${LF}`); }
}

class PythonWriter extends ScriptWriter {
  ORSyntax = ' + ';
  protected commentPrefix = '# '; protected semi = '';
  protected fnCallLabel = 'Python_FnCall';
  BoolStr(v: any): string { return v ? 'True' : 'False'; }
  StrCat(parts: any): string { return listOf(parts).map(p => `str(${p})`).join(' + '); }
  ToStr(expr: any): any { return `str(${expr})`; }
  UseConstant(text: any, prefix?: any): string { this.needPrefix(prefix); return `constants.${text}`; }
  BeginFn(_ret: any, name: any, args?: any) { const a = given(args) ? this.names(args) : ''; this.Append(`def ${name}( ${a ? a + ' ' : ''}):${LF}`); }
  EndFn(_name?: any, retval?: any) { this.Append((given(retval) ? `${TAB}return ${retval}${LF}` : '') + LF); }
  VarDecl(_vars: any) { /* emits nothing */ }
  FnCall(ret: any, fn: any, args?: any) { this.Append(`${TAB}${given(ret) ? `${ret} = ` : ''}${fn}(${this.argText(args, this.fnCallLabel, ret, fn)})${LF}`); }
  LogMessage(text: any) { this.Append(`${TAB}Application.LogMessage(${text},constants.siVerbose)${LF}`); }
}

/** HLSL / CGFX: the Cpp text for functions, declarations and comments, no object-model calls, plus the template names. */
class ShaderLangWriter extends CppWriter {
  CallbackSuccess = 'true';
  constructor(app: App, lang: string, private cgfx: boolean) {
    super(app, lang);
    // There is no FnCall, OMCall, OMAssignProp or OMReadProp (so LogMessage cannot be used; inferred).
    for (const m of ['FnCall', 'OMCall', 'OMAssignProp', 'OMReadProp']) (this as any)[m] = undefined;
  }
  StrConst(s: any): string { return `"${s}"`; }
  LogMessage(text: any) { (this as any).FnCall(null, 'Application.LogMessage', [text, 'siVerbose']); }   // raises: the writer has no FnCall
  UIParamDeclTempl() { return 'rtshader_uiparam_decl.hlsl.template'; }
  UIParamColorDeclTempl() { return 'rtshader_color_uiparam_decl.hlsl.template'; }
  UIParamTex2DDeclTempl() { return 'rtshader_texture_uiparam_decl.hlsl.template'; }
  SemanticParamDeclTempl() { return 'rtshader_semantic_param_decl.hlsl.template'; }
  SASParamDeclTempl() { return 'rtshader_sas_param_decl.hlsl.template'; }
  GlobalDeclTempl() { return 'rtshader_global_decl.hlsl.template'; }
  ShaderFuncDeclTempl() { return this.cgfx ? 'rtshader_shaderfunc_decl.cgfx.template' : 'rtshader_shaderfunc_decl.hlsl.template'; }
  MatrixDeclTempl() { return 'rtshader_matrix_decl.hlsl.template'; }
  UIParamNoMinMaxDeclTempl() { return 'rtshader_uiparam_nominmax_decl.hlsl.template'; }
  Extension() { return this.cgfx ? '.cgfx' : '.fx'; }
  StructMember(kind: any): string {
    const k = String(kind).toLowerCase();
    const fixed: Record<string, string> = { position: 'POSITION0', normal: 'NORMAL', color: 'COLOR0', binormal: 'BINORMAL0', tangent: 'TANGENT0' };
    if (fixed[k]) return `float4 ${k} : ${fixed[k]};`;
    if (k.startsWith('texcoord')) return `float4 ${k} : ${k.toUpperCase()};`;
    return 'undefined HLSL struct data member;';
  }
}

export function makeScriptWriter(app: App, language: any): ScriptWriter | undefined {
  switch (language) {
    case 'JScript': return new JScriptWriter(app, 'JScript');
    case 'VBScript': return new VBScriptWriter(app, 'VBScript');
    case 'Python': return new PythonWriter(app, 'Python');
    case 'Cpp': return new CppWriter(app, 'Cpp');
    case 'C#': return new CSharpWriter(app, 'C#');
    case 'HLSL': return new ShaderLangWriter(app, 'HLSL', false);
    case 'CGFX': return new ShaderLangWriter(app, 'CGFX', true);
    // inferred (Q12): the Perl writer is selected under a name the file does not define, so the call ends in a script error.
    case 'PerlScript': throw new Error(`script error: the PerlScript writer is not defined (${NOTE} Q12)`);
    default: return undefined;
  }
}

// ------------------------------------------------------------------ PPGLayoutControl

export interface RawLayoutItem { type: string; id: string }
const valueOf = (p: any): any => (p && typeof p === 'object' && 'Value' in p ? p.Value : p?.value);
const setValue = (p: any, v: any) => { if (p && typeof p === 'object' && 'Value' in p) p.Value = v; else p.value = v; };
const isMarker = (it: RawLayoutItem) => it.type !== '';
const encode = (items: RawLayoutItem[]) => items.map(it => (it.type ? `${it.type}:${it.id}` : it.id)).join('|');
function decode(text: string): RawLayoutItem[] {
  if (text === '') return [];
  return text.split('|').map(e => { const m = /^([TtGgRr]):(.*)$/.exec(e); return m ? { type: m[1], id: m[2] } : { type: '', id: e }; });
}
/** Insert like the JScript array insert: a negative index counts from the end. */
function insertAt<T>(a: T[], index: number, ...items: T[]) { a.splice(index, 0, ...items); }

export class LayoutControl {
  readonly Type = 'LayoutControl';
  private reporter: { Warning(text: string): void };
  constructor(app: App, private list: any, private listUI: any, private layoutString: any, errorReporter: any) {
    this.reporter = errorReporter && typeof errorReporter.Warning === 'function' ? errorReporter : { Warning: (text: string) => logWarning(app, `LayoutControl: ${text}`) };
  }
  private items(): RawLayoutItem[] { return decode(String(valueOf(this.layoutString) ?? '')); }
  private store(items: RawLayoutItem[]) { setValue(this.layoutString, encode(items)); }
  /** Label / value pairs of the entries (without the final empty pair). */
  private pairs(items: RawLayoutItem[]): [string, string][] {
    const out: [string, string][] = []; const labels = new Map<string, number>(); const ids = new Map<string, number>();
    let depth = 0;
    for (const it of items) {
      const close = it.type !== '' && it.type === it.type.toLowerCase();
      if (close) depth = Math.max(0, depth - 1);
      let label = '  '.repeat(depth) + (close ? '}' : it.type === 'T' ? `Tab "${it.id}" {` : it.type === 'G' ? `Group "${it.id}" {` : it.type === 'R' ? 'Row {' : it.id);
      if (it.type !== '' && !close) depth++;
      const seenLabel = labels.get(label) ?? 0; labels.set(label, seenLabel + 1);
      label += ' '.repeat(seenLabel);
      const seenId = ids.get(it.id) ?? 0; ids.set(it.id, seenId + 1);
      out.push([label, seenId ? `${it.id}_${seenId}` : it.id]);
    }
    return out;
  }
  private rebuild(items: RawLayoutItem[]) { this.listUI.UIItems = [...this.pairs(items).flat(), '', '']; }
  /** Position of the pair whose value equals the list box value, or -1. */
  private selected(): number {
    const ui = listOf(this.listUI.UIItems); const v = valueOf(this.list);
    for (let i = 1; i < ui.length; i += 2) if (ui[i] === v) return (i - 1) / 2;
    return -1;
  }

  addParameter(name: any): boolean {
    const items = this.items();
    insertAt(items, this.selected(), { type: '', id: String(name) });   // inferred (Q10): with nothing selected, before the last existing entry
    this.store(items); this.rebuild(items);
    return true;
  }
  addTab(name: any): boolean {
    const n = String(name ?? ''); if (n === '') return false;
    const items = this.items();
    if (items.some(it => it.type === 'T' && it.id === n)) { this.reporter.Warning('A Tab with the same name already exists.'); return false; }
    const sel = this.selected();
    let start = 0;
    for (let i = Math.min(sel - 1, items.length - 1); i >= 0; i--) {
      if (items[i].type === 'T') { this.reporter.Warning('A new Tab cannot be enclosed in another Tab.'); return false; }
      if (items[i].type === 't') { start = i + 1; break; }
    }
    let end = items.length;
    for (let i = Math.max(sel, 0); i < items.length; i++) {
      if (items[i].type === 't') { this.reporter.Warning('Something odd going on.'); return false; }
      if (items[i].type === 'T') { end = i; break; }
    }
    items.splice(start, 0, { type: 'T', id: n });
    items.splice(end + 1, 0, { type: 't', id: n });   // after the shift
    this.store(items); this.rebuild(items);
    return true;
  }
  private addBlock(open: string, name: string) {
    const items = this.items(); const sel = this.selected();
    items.splice(sel < 0 ? 0 : sel, 0, { type: open, id: name }, { type: open.toLowerCase(), id: name });
    this.store(items); this.rebuild(items);
  }
  addGroup(name: any): boolean {
    const n = String(name ?? ''); if (n === '') return false;
    if (this.items().some(it => it.type === 'G' && it.id === n)) { this.reporter.Warning('A Group with the same name already exists.'); return false; }
    this.addBlock('G', n);
    return true;
  }
  addRow(): boolean {
    const used = new Set(this.items().filter(it => it.type === 'R').map(it => it.id));
    let i = 0; while (used.has(`row${i}`)) i++;
    this.addBlock('R', `row${i}`);
    return true;
  }
  moveSelected(dir: any): boolean {
    if (dir !== 1 && dir !== -1) return false;
    const items = this.items(); const sel = this.selected(); const to = sel + dir;
    if (sel < 0 || sel >= items.length || to < 0 || to >= items.length) return false;
    if (isMarker(items[sel]) && isMarker(items[to])) return false;
    const before = encode(items);
    [items[sel], items[to]] = [items[to], items[sel]];
    this.store(items); this.rebuild(items);
    const moved = this.pairs(items)[to];
    if (moved) setValue(this.list, moved[1]);   // inferred: the moved entry stays the selected one
    return encode(items) !== before;
  }
  deleteSelected(): boolean {
    const items = this.items(); const sel = this.selected();
    if (sel < 0 || sel >= items.length) return false;
    const [gone] = items.splice(sel, 1);
    if (isMarker(gone)) {
      const other = gone.type === gone.type.toLowerCase() ? gone.type.toUpperCase() : gone.type.toLowerCase();
      const p = items.findIndex(it => it.type === other && it.id === gone.id);
      if (p < 0) this.reporter.Warning('LayoutList_FindPartner: Unmatched grouping!'); else items.splice(p, 1);
    }
    this.store(items); this.rebuild(items);
    const pairs = this.pairs(items);
    const pick = pairs[sel] ?? pairs[sel - 1] ?? pairs[0];
    setValue(this.list, pick ? pick[1] : '');
    return true;
  }
  updateList(validNames: any): boolean {
    const items = this.items(); if (!items.length) return false;
    const valid = new Set(listOf(validNames).map(String));
    const kept = items.filter(it => isMarker(it) || valid.has(it.id));
    const wasEmpty = listOf(this.listUI.UIItems).length === 0;
    if (kept.length === items.length && !wasEmpty) return false;
    this.store(kept); this.rebuild(kept);
    return true;
  }
  getLayout(indent: any): string[] {
    // inferred (Q10): the indent must be supplied; the header's "default one tab" is not implemented.
    const lines: string[] = []; let depth = 0;
    const put = (text: string) => lines.push(String(indent).repeat(depth) + text);
    for (const it of this.items()) {
      if (it.type === 'T' || it.type === 'G' || it.type === 'R') { put(it.type === 'T' ? `Tab "${it.id}"` : it.type === 'G' ? `Group "${it.id}"` : 'Row'); put('{'); depth++; }
      else if (it.type !== '') { depth = Math.max(0, depth - 1); put('}'); }
      else put(`${it.id};`);
    }
    return lines;
  }
  getLayoutRawData(): RawLayoutItem[] { return this.items(); }

  generateLayoutMethod(writer: any, wizard: any, objName: any, _objType?: any): void {
    const lang = writer.Language; const cs = lang === 'C#', cpp = lang === 'Cpp';
    const grid: GridData | undefined = gridOf(wizard, 'Params') ?? wizard?.Params?.Value ?? wizard?.Params;
    const nameCol = grid ? grid.col('Name') : -1, typeCol = grid ? grid.col('Type') : -1;
    const rows: { name: string; type: string }[] = grid ? grid.rows.map(r => ({ name: String(r[nameCol]), type: String(r[typeCol]) })) : [];
    const S = (s: string) => writer.StrConst(s);
    const call = (obj: string, method: string, args: any[] | null, ret: string | null = null, isObject = false) => writer.OMCall(ret, obj, method, args, isObject);
    const addGroup = (name: string) => call('oLayout', 'AddGroup', cs ? [S(name), 'true', '0'] : [S(name)]);
    const block = (name: string, type: string) => {
      if (type === 'Button') call('oLayout', 'AddButton', cs ? [S(name), null] : [S(name)]);
      else if (type === 'Grid' || type === 'FCurve') {
        addGroup(name);
        call('oLayout', 'AddItem', cs ? [S(name), null, null] : [S(name)], 'oItem', true);
        // The Cpp call is made without a prefix, which makes the writer raise (contract, inferred).
        const constant = cpp ? writer.UseConstant('siUIValueOnly') : writer.UseConstant('siUIValueOnly', 'siPPGItemAttribute');   // inferred: the enum name passed as prefix
        call('oItem', cpp ? 'PutAttribute' : 'SetAttribute', [constant, writer.BoolStr(true)]);
        call('oLayout', 'EndGroup', null);
      } else if (type === 'Color') call('oLayout', 'AddColor', [S(`${name}_R`), S(name), writer.BoolStr(true)]);
      else call('oLayout', 'AddItem', cs ? [S(name), null, null] : [S(name)]);
    };
    writer.Comment(['Tip: Use the "Refresh" option on the Property Page context menu to ', 'reload your script changes and re-execute the DefineLayout callback.']);
    const fn = cs ? 'DefineLayout' : `${objName}_DefineLayout`;
    writer.BeginStdFn(fn);
    writer.VarDecl(['PPGLayout oLayout', 'PPGItem oItem']);
    writer.OMReadProp('oLayout', cpp ? 'ctxt' : 'in_ctxt', 'Source', true, cs ? 'PPGLayout' : undefined);
    call('oLayout', 'Clear', null);
    const raw = this.items();
    if (!raw.length) for (const r of rows) block(r.name, r.type);
    else for (const it of raw) {
      if (it.type === 'G') addGroup(it.id);
      else if (it.type === 'g') call('oLayout', 'EndGroup', null);
      else if (it.type === 'T') call('oLayout', 'AddTab', [S(it.id)]);
      else if (it.type === 't') { /* nothing */ }
      else if (it.type === 'R') call('oLayout', 'AddRow', null);
      else if (it.type === 'r') call('oLayout', 'EndRow', null);
      else {
        const row = rows.find(r => r.name === it.id);
        if (!row) { this.reporter.Warning(`Unexpected: parameter ${it.id} found in layout but not in parameter list`); continue; }
        block(row.name, row.type);
      }
    }
    writer.EndFn(fn, writer.CallbackSuccess);
  }
}

// ------------------------------------------------------------------ registration

export function registerSdkuiGeneratorCommands(app: App) {
  const CAT = 'Custom';
  app.register({
    name: 'SDKGetScriptGenerator', label: 'SDKGetScriptGenerator', category: CAT, description: '',
    args: [{ name: 'Language', default: null }], undoable: false, noLog: true,
    execute(app2, a) { return makeScriptWriter(app2, a.Language); },
  });
  app.register({
    name: 'PPGLayoutControl', label: 'PPGLayoutControl', category: CAT, description: '',
    args: [{ name: 'LayoutList', default: null }, { name: 'LayoutListUI', default: null }, { name: 'LayoutString', default: null }, { name: 'errorReporter', default: null }],
    undoable: false, noLog: true,
    execute(app2, a) { return new LayoutControl(app2, a.LayoutList, a.LayoutListUI, a.LayoutString, a.errorReporter); },
  });
}
