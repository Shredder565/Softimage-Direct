// Ledger row CMD-B7c, sdkui add-on: `GetShaderDefHelper` (SPEC-PARTIAL). Brief:
// docs/ghidra/cmd-b7c-addon-scripts.md, "Wire contract: sdkui". Original code written from that contract only.
//
// The helper object shared by the shader definition, hardware shader and mental ray shader wizards.
// Open part (Q11): the template files the generators expand are not staged. A template is expanded when the
// file is in the session's virtual host file system; otherwise the generator logs "not yet attested" and its
// text is empty. Image files are looked up and copied in the same virtual file system.
import { App } from '../core/commands';
import { str, bool, int, num } from '../core/params';
import { hostFs } from '../core/sdkHelpersHostFs';
import { WizardHelperObj } from './addonDocWizard';
import { sdkHelpersState } from './sdkHelpers';
import { makeScriptWriter, type ScriptWriter } from './addonScriptsGenerator';
import {
  addGrid, gridOf, propOf, layoutOf, enableParam, ensureParam, dictText, logNya, fileExists, type GridData, type ScriptLayout,
} from './addonScriptsShared';

const T = (id: number) => dictText('XSIPLUGINUI', id);
const DT = 'siShaderDataType';
export const SHADER_FAMILIES = ['CntContrast', 'CntMat', 'CntStore', 'Data', 'Environment', 'Geometry', 'Lens', 'Light', 'Lightmap', 'Output', 'PhenomMat', 'PhotonLight', 'PhotonMat',
  'PhotonVolume', 'ShadowMat', 'State', 'SurfaceMat', 'Texture', 'Volume', 'RTShader'].map(n => `siShaderFamily${n}`);
export const INPUT_TYPES = [...['Array', 'Boolean', 'Color3', 'Color4', 'Custom', 'Gradient', 'Image', 'Integer', 'Matrix33', 'Matrix44', 'ProfileCurve', 'Property', 'Quaternion', 'Reference',
  'Scalar', 'String', 'Structure', 'Vector2', 'Vector3', 'Vector4'].map(n => DT + n), 'siHWShaderPortType'];
export const OUTPUT_TYPES = INPUT_TYPES.filter(t => ![`${DT}Array`, `${DT}Image`, `${DT}Structure`].includes(t));
export const INPUT_ATTRIBUTES = ['siReferenceFilterAttribute', 'siPropertyFilterAttribute', 'siCustomTypeNameAttribute', 'siShaderFamilyAttribute', 'siDefaultConnectionAttribute',
  'siWritableImageAttribute', 'siWritableImageTypeAttribute', 'siRenderTreeNodeColorRAttribute', 'siRenderTreeNodeColorGAttribute', 'siRenderTreeNodeColorBAttribute'];
export const ATTRIBUTE_VALUES: Record<string, string[]> = {
  siReferenceFilterAttribute: ['siObjectReferenceFilter', 'siCameraReferenceFilter', 'siLightReferenceFilter', 'siMaterialReferenceFilter', 'siShaderReferenceFilter', 'siGeometryReferenceFilter', 'siUserDataBlobReferenceFilter'],
  siPropertyFilterAttribute: ['siAnyPropertyFilter', 'siAnyVertexMapPropertyFilter', 'siUVPropertyFilter', 'siCAVPropertyFilter', 'siWeightMapPropertyFilter', 'siTextureMapPropertyFilter', 'siNormalPropertyFilter'],
  siCustomTypeNameAttribute: ['siMentalRayLightmapPortType', 'siMentalRayGeometryPortType', 'siMentalRayContourStorePortType', 'siMentalRayContourContrastPortType', 'siMentalRayPhenomenonMaterialPortType', 'siXGSRealTimePortType'],
};
export const RENDERER_NAMES = ['OpenGL', 'DirectX9', 'Mental Ray'];
/** Label = value, alphabetically sorted. */
const combo = (values: string[]): string[] => [...values].sort().flatMap(v => [v, v]);
const has = (v: any) => v !== null && v !== undefined && v !== '';

export class ShaderDefHelper {
  readonly WizardHelper: WizardHelperObj;
  readonly writer: ScriptWriter | undefined;
  private wiz: any;
  constructor(private app: App, wiz: any) {
    this.wiz = propOf(wiz);
    this.WizardHelper = new WizardHelperObj(app);
    this.writer = makeScriptWriter(app, this.wiz.val('Language'));   // the wizard must already have a Language parameter
  }
  private v(name: string): any { return this.wiz.val(name); }
  private s(name: string): string { const x = this.wiz.val(name); return x === null || x === undefined ? '' : String(x); }
  private set(name: string, value: any) { this.wiz.set(name, value); }
  private grid(name: string): GridData { return gridOf(this.wiz, name)!; }
  private boolStr(v: any): string { return this.writer ? this.writer.BoolStr(v) : (v ? 'true' : 'false'); }
  private lang(): string { return this.s('Language'); }

  // ---- parameters
  CreateShaderDefParams(): void {
    const w = this.wiz;
    const S = (n: string, d = '') => ensureParam(w, str(n, d, n)); const B = (n: string, d = false) => ensureParam(w, bool(n, d, n));
    const I = (n: string, d = 0) => ensureParam(w, int(n, d, n)); const F = (n: string, d = 0) => ensureParam(w, num(n, d, n));
    S('ShaderDefClassName', 'MyShader'); I('ShaderDefMajor', 1); I('ShaderDefMinor', 0);
    S('ShaderDefFamily', 'siShaderFamilyTexture'); S('ShaderDefCategory', 'My Shader Category'); S('ShaderDefDisplayName', 'My Shader');
    S('ShaderDefAttrib'); S('ShaderDefAttribVal');
    S('InParamName', 'input'); S('InParamLongName', 'input'); S('InParamType', `${DT}Scalar`);
    B('InParamTexturable', true); B('InParamAnimatable', true); B('InParamInspectable', true); B('InParamReadOnly', false);
    I('InParamHardLimitMinI', 0); I('InParamHardLimitMaxI', 1); I('InParamSoftLimitMinI', 0); I('InParamSoftLimitMaxI', 1);
    F('InParamHardLimitMinF', 0); F('InParamHardLimitMaxF', 1); F('InParamSoftLimitMinF', 0); F('InParamSoftLimitMaxF', 1);
    S('InParamAttrib'); S('InParamAttribVal');
    B('InParamDefaultValBool'); I('InParamDefaultValInt');
    for (const n of ['Scalar1', 'Scalar2', 'Scalar3', 'Scalar4', 'ColorR', 'ColorG', 'ColorB', 'ColorA']) F(`InParamDefaultVal${n}`);
    S('InParamDefaultValImage'); S('InParamDefaultValDisabled'); enableParam(w, 'InParamDefaultValDisabled', false);
    addGrid(w, 'InParamGrid', [T(7120), T(7123), T(7230), T(7231), T(7232), T(7233), T(7243), T(7234), T(7235), T(7237), T(7236), T(7238), T(7241), T(7229)]);
    S('OutParamName', 'out'); S('OutParamLongName', 'out'); S('OutParamType', `${DT}Scalar`); B('OutParamMain', false);
    addGrid(w, 'OutParamGrid', [T(7120), T(7123), T(7230), T(7242)]);
    S('ShaderDefRendName', 'OpenGL'); S('ShaderDefRendSymbol', 'MyShader'); S('ShaderDefRendCodePath', ''); S('ShaderDefRendShaderType', '');
    S('ShaderDefRendOptionName'); S('ShaderDefRendOptionVal');
    addGrid(w, 'RendOptionGrid', [T(7120), 'Value']);
    I('ParamNameSuffix');
  }
  CreateShaderParserParams(): void { for (const n of ['ShaderParserName', 'ShaderParserFolder', 'ShaderParserExt']) ensureParam(this.wiz, str(n, '', n)); }

  // ---- layouts
  private gridOrText(l: ScriptLayout, grid: string, emptyText: string) {
    if (this.grid(grid).RowCount === 0) l.AddStaticText(emptyText);
    else { const g = l.AddItem(grid, '', 'siControlGrid'); g.SetAttribute('siUINoLabel', true); g.SetAttribute('siUIGridSelectionMode', 'siSelectionHeader'); }
  }
  BuildShaderDefLayout(): void {
    const l = layoutOf(this.wiz);
    l.SetAttribute('siUILabelMinPixels', 140); l.SetAttribute('siUILabelPercentage', 50);
    l.AddTab('Definition');
    l.AddRow(); l.AddButton('HWShaderPreset', 'Hardware Shader Preset'); l.AddButton('MRShaderPreset', 'Mental ray Preset'); l.EndRow();
    l.AddGroup('Shader');
    l.AddItem('ShaderDefClassName', 'Name'); l.AddItem('ShaderDefMajor', 'Major Version'); l.AddItem('ShaderDefMinor', 'Minor Version');
    l.AddEnumControl('ShaderDefFamily', combo(SHADER_FAMILIES), 'Family', 'siControlCombo');
    l.AddItem('ShaderDefCategory', 'Category'); l.AddItem('ShaderDefDisplayName', 'Display Name');
    l.AddItem('ShaderDefAttrib', 'Attribute Name'); l.AddItem('ShaderDefAttribVal', 'Attribute Value');
    l.EndGroup();
    l.AddGroup('Renderer');
    l.AddEnumControl('ShaderDefRendName', combo(RENDERER_NAMES), 'Name', 'siControlCombo');
    l.AddItem('ShaderDefRendSymbol', 'Symbol');
    l.AddItem('ShaderDefRendCodePath', 'Code Path', 'siControlFilePath').SetAttribute('siUIOpenFile', true);
    l.AddGroup('Options');
    l.AddItem('ShaderDefRendOptionName', 'Name'); l.AddItem('ShaderDefRendOptionVal', 'Value');
    l.AddRow(); l.AddButton('AddRendererOptionBtn', 'Add'); l.AddButton('RemoveRendererOptionBtn', 'Remove Selected'); l.EndRow();
    this.gridOrText(l, 'RendOptionGrid', T(7239));
    l.EndGroup();
    l.EndGroup();
    l.AddButton('GenerateCode', 'Generate Code');

    l.AddTab('Parameters');
    l.AddGroup('Input Parameters');
    l.AddItem('InParamName', 'Name');
    l.AddEnumControl('InParamType', combo(INPUT_TYPES), 'Type', 'siControlCombo');
    l.AddItem('InParamLongName', 'Description');
    l.AddItem('InParamAnimatable', 'Animatable'); l.AddItem('InParamInspectable', 'Inspectable'); l.AddItem('InParamTexturable', 'Texturable'); l.AddItem('InParamReadOnly', 'ReadOnly');
    const type = this.s('InParamType'); const isInt = type === `${DT}Integer`, isScalar = type === `${DT}Scalar`;
    if (type === `${DT}Boolean`) l.AddItem('InParamDefaultValBool', 'Default Value');
    else if (isInt) l.AddItem('InParamDefaultValInt', 'Default Value');
    else if (isScalar) l.AddItem('InParamDefaultValScalar1', 'Default Value');
    else if (type === `${DT}Image`) { const it = l.AddItem('InParamDefaultValImage', 'Default Value', 'siControlFilePath'); it.SetAttribute('siUIImageFile', true); it.SetAttribute('siUIOpenFile', true); }
    else l.AddItem('InParamDefaultValDisabled', 'Default Value');
    const sfx = isInt ? 'I' : 'F';
    const limits = [`InParamHardLimitMin${sfx}`, `InParamHardLimitMax${sfx}`, `InParamSoftLimitMin${sfx}`, `InParamSoftLimitMax${sfx}`];
    for (const n of limits) enableParam(this.wiz, n, isInt || isScalar);
    l.AddGroup('Hard Limit Values'); l.AddItem(limits[0], 'Min'); l.AddItem(limits[1], 'Max'); l.EndGroup();
    l.AddGroup('Soft Limit Values'); l.AddItem(limits[2], 'Min'); l.AddItem(limits[3], 'Max'); l.EndGroup();
    l.AddGroup('Attribute');
    l.AddEnumControl('InParamAttrib', combo(INPUT_ATTRIBUTES), 'Name', 'siControlCombo');
    const values = ATTRIBUTE_VALUES[this.s('InParamAttrib')];
    if (values) l.AddEnumControl('InParamAttribVal', combo(values), 'Value', 'siControlCombo'); else l.AddItem('InParamAttribVal', 'Value');
    l.EndGroup();
    l.AddGroup('');
    l.AddRow(); l.AddButton('InParamAddBtn', 'Add'); l.AddButton('InParamRemoveBtn', 'Remove Selected'); l.EndRow();
    this.gridOrText(l, 'InParamGrid', T(7223));
    l.EndGroup();
    l.EndGroup();
    l.AddGroup('Output Parameters');
    l.AddItem('OutParamName', 'Name');
    l.AddEnumControl('OutParamType', combo(OUTPUT_TYPES), 'Type', 'siControlCombo');
    l.AddItem('OutParamLongName', 'Description'); l.AddItem('OutParamMain', 'Main');
    l.AddButton('OutParamAddBtn', 'Add'); l.AddButton('OutParamRemoveBtn', 'Remove Selected');
    this.gridOrText(l, 'OutParamGrid', T(7223));
    l.EndGroup();
    l.AddButton('GenerateCode', 'Generate Code');
  }
  BuildParserLayout(): void {
    const l = layoutOf(this.wiz);
    l.AddTab('Parser');
    l.AddItem('ShaderParserName', 'Name');
    l.AddItem('ShaderParserFolder', 'Directory', 'siControlFolder').SetAttribute('siUIInitialDir', `${sdkHelpersState.paths[1]}\\Application\\Plugins`);
    l.AddItem('ShaderParserExt', 'File Extension');
    l.AddButton('GenerateCode', 'Generate Code');
  }

  // ---- grids
  /** A name that is not in either parameter grid (compared without regard to case). */
  private uniqueParamName(name: string): string {
    const taken = () => [...this.grid('InParamGrid').rows, ...this.grid('OutParamGrid').rows].map(r => String(r[0]).toLowerCase());
    let n = name;
    while (taken().includes(n.toLowerCase())) {   // inferred: repeated until the name is free
      const k = (Number(this.v('ParamNameSuffix')) || 0) + 1; this.set('ParamNameSuffix', k); n = name + k;
    }
    return n;
  }
  AddInputParamToGrid(): number | undefined {
    const H = this.WizardHelper; const type = this.s('InParamType');
    const isInt = type === `${DT}Integer`, isScalar = type === `${DT}Scalar`;
    let def: any = '';
    if (type === `${DT}Image`) {
      const value = this.s('InParamDefaultValImage');
      if (value !== '') {
        const folder = `${sdkHelpersState.paths[1]}\\Application\\fxtextures`;
        const inFolder = hostFs.join(folder, hostFs.baseName(value));
        let found = fileExists(value) ? value : fileExists(hostFs.join(folder, value)) ? hostFs.join(folder, value) : '';
        if (found === '') { this.app.logMsg('error', `Selected image doesn't exist: ${hostFs.join(folder, value)}`); return undefined; }   // inferred: the path named is the last one tried
        if (hostFs.normalize(hostFs.parentPath(found)).toLowerCase() !== hostFs.normalize(folder).toLowerCase()) {
          hostFs.ensureFolder(folder);
          hostFs.writeFile(inFolder, hostFs.readFile(found));
          this.app.logMsg('info', `Selected image has been copied to: ${inFolder}`);
          found = inFolder;
        }
        def = hostFs.baseName(found);
        this.set('InParamDefaultValImage', def);
      }
    } else if (type === `${DT}Boolean`) def = this.boolStr(this.v('InParamDefaultValBool'));
    else if (isInt) def = this.v('InParamDefaultValInt');
    else if (isScalar) def = H.FloatPrec3(this.v('InParamDefaultValScalar1'));
    const g = this.grid('InParamGrid');
    const name = this.uniqueParamName(this.s('InParamName'));
    const row = g.addRow('  ');
    const lim = (n: string) => (isScalar ? H.FloatPrec3(this.v(`${n}F`)) : isInt ? this.v(`${n}I`) : undefined);
    const cells = [name, type, this.s('InParamLongName'), this.boolStr(this.v('InParamTexturable')), this.boolStr(this.v('InParamAnimatable')), this.boolStr(this.v('InParamInspectable')),
      this.boolStr(this.v('InParamReadOnly')), lim('InParamHardLimitMin'), lim('InParamHardLimitMax'), lim('InParamSoftLimitMin'), lim('InParamSoftLimitMax'),
      this.v('InParamAttrib'), this.v('InParamAttribVal'), def];
    cells.forEach((c, i) => { if (c !== undefined) g.SetCell(i, row, c); });
    return row;
  }
  AddOutputParamToGrid(): number {
    const g = this.grid('OutParamGrid');
    const name = this.uniqueParamName(this.s('OutParamName'));
    const row = g.addRow('  ');
    [name, this.s('OutParamType'), this.s('OutParamLongName'), this.boolStr(this.v('OutParamMain'))].forEach((c, i) => g.SetCell(i, row, c));
    return row;
  }
  AddRendererOptionToGrid(): number {
    const option = this.s('ShaderDefRendOptionName');
    if (option === '') { this.app.logMsg('error', 'No option specified.'); return -1; }
    const g = this.grid('RendOptionGrid');
    let name = option; let k = 1;
    while (g.rows.some(r => r[0] === name)) name = option + k++;   // inferred: how the name is made unique within the grid
    const row = g.addRow('  ');
    g.SetCell(0, row, name); g.SetCell(1, row, this.v('ShaderDefRendOptionVal'));
    return row;
  }
  /** The wizard helper's grid clear: removes row i for i counting up while the rows shift down. // inferred: so several rows are not all removed */
  private clearGrid(name: string) { const g = this.grid(name); for (let i = 0; i < g.RowCount; i++) g.removeRow(i); }
  private deleteSelected(name: string): number { const g = this.grid(name); for (const i of [...g.selectedRows].sort((a, b) => b - a)) g.removeRow(i); return g.RowCount; }

  // ---- page events
  OnButtonClick(button: any): number {
    switch (String(button)) {
      case 'InParamRemoveBtn': return this.deleteSelected('InParamGrid');
      case 'OutParamRemoveBtn': return this.deleteSelected('OutParamGrid');
      case 'RemoveRendererOptionBtn': return this.deleteSelected('RendOptionGrid');
      case 'HWShaderPreset':
        for (const g of ['InParamGrid', 'OutParamGrid', 'RendOptionGrid']) this.clearGrid(g);
        this.set('ShaderDefRendName', 'OpenGL'); this.set('ShaderDefRendCodePath', this.s('PluginName'));
        this.set('ShaderDefRendShaderType', 'hwshader'); this.set('ShaderDefFamily', 'siShaderFamilyRTShader');
        this.set('OutParamName', 'out'); this.set('OutParamType', 'siHWShaderPortType');
        this.AddOutputParamToGrid();
        this.set('OutParamName', ''); this.set('OutParamLongName', ''); this.set('OutParamType', '');   // inferred: which output fields "blank" covers
        this.set('ShaderDefRendOptionName', 'siHWShaderVersionAttribute'); this.set('ShaderDefRendOptionVal', 'siHWShaderV1');
        this.AddRendererOptionToGrid();
        this.set('ShaderDefRendOptionName', ''); this.set('ShaderDefRendOptionVal', '');
        return 0;
      case 'MRShaderPreset':
        for (const g of ['InParamGrid', 'OutParamGrid', 'RendOptionGrid']) this.clearGrid(g);
        this.set('ShaderDefRendName', 'Mental ray'); this.set('ShaderDefRendCodePath', '{LIBS}/xsibase.{EXT}');
        this.set('ShaderDefRendShaderType', 'mentalray'); this.set('ShaderDefFamily', 'siShaderFamilyTexture');
        this.set('OutParamType', `${DT}Color3`); this.set('OutParamName', 'out'); this.set('OutParamLongName', 'out');
        this.set('ShaderDefRendOptionName', ''); this.set('ShaderDefRendOptionVal', '');
        return 0;
      default: return -1;
    }
  }
  OnParamChanged(name: any): boolean {
    switch (String(name)) {
      case 'InParamType': this.set('InParamAttrib', ''); this.set('InParamAttribVal', ''); return true;
      case 'OutParamType': this.set('OutParamMain', false); return true;
      case 'InParamAttrib': this.set('InParamAttribVal', false); return true;
      case 'ShaderDefClassName': { const n = this.WizardHelper.RemoveSpaces(this.s('ShaderDefClassName')); this.set('ShaderDefClassName', n); this.set('ShaderDefRendSymbol', n); return true; }
      case 'Language': enableParam(this.wiz, 'ShaderDefRendCodePath', this.lang() !== 'Cpp'); return true;
      default: return false;
    }
  }

  // ---- code generation
  /** Expand a template of the wizard template folder; '' (and a log line) when the file is not staged. */
  private expand(prefix: string, tokens: string[], values: any[], lang = this.lang()): string {
    const file = this.WizardHelper.GetTemplate(lang, prefix);
    if (!hostFs.isFile(file)) { logNya(this.app, 'GetShaderDefHelper', `the template file ${file} is not staged; the text of "${prefix}" is empty`, 'Q11'); return ''; }
    return this.WizardHelper.GenerateStringFromTemplate(file, tokens, values.map(v => (v === null || v === undefined ? '' : v)));
  }
  private use(text: string, prefix: string): string { return this.writer ? this.writer.UseConstant(text, prefix) : text; }
  private strConst(s: any): string { return this.writer ? this.writer.StrConst(s) : `"${s}"`; }
  private version(): [string, any, any] { return [this.s('ShaderDefClassName'), this.v('ShaderDefMajor'), this.v('ShaderDefMinor')]; }

  GenerateShaderDefRegisterCode(): string { return this.expand('shaderdef_reg', ['%%shaderclass%%', '%%major%%', '%%minor%%'], this.version()); }
  GenerateRegisterParserCode(): string | undefined {
    return this.s('ShaderParserName') !== '' ? this.expand('shaderparserdef_reg', ['%%parser_name%%'], [this.s('ShaderParserName')]) : undefined;
  }
  GenerateParserCallback(): string | undefined {
    return this.s('ShaderParserName') !== ''
      ? this.expand('shaderparserdef_CB', ['%%parser_name%%', '%%folder%%', '%%ext%%'], [this.s('ShaderParserName'), this.s('ShaderParserFolder'), this.s('ShaderParserExt')]) : undefined;
  }
  private attribFragment(name: any, value: any): string { return this.expand('shaderdef_input_paramdef_attrib', ['%%attribname%%', '%%attribval%%'], [name, value]); }
  GenerateShaderDefCallback(): string {
    const [cls, major, minor] = this.version(); const plugin = this.s('PluginName');
    const attrib = this.s('ShaderDefAttrib'), attribVal = this.s('ShaderDefAttribVal');
    const fragment = attrib !== '' && attribVal !== '' ? this.expand('shaderdef_defineinfo_attrib', ['%%attrib%%', '%%attrib_val%%'], [attrib, attribVal]) : '';
    const info = this.expand('shaderdef_defineinfo_CB', ['%%plugin%%', '%%shaderclass%%', '%%major%%', '%%minor%%', '%%category%%', '%%displayname%%', '%%attrib%%', '%%attribcall%%'],
      [plugin, cls, major, minor, this.s('ShaderDefCategory'), this.s('ShaderDefDisplayName'), attrib, fragment]);
    // parameter definitions: input rows, then output rows
    let params = '';
    for (const r of this.grid('InParamGrid').rows) {
      const type = String(r[1]);
      let def = '';
      if (type === `${DT}Integer` || type === `${DT}Scalar`) def = this.expand('shaderdef_input_paramdef_default', ['%%hlmin%%', '%%hlmax%%', '%%slmin%%', '%%slmax%%', '%%default_val%%'], [r[7], r[8], r[9], r[10], r[13]]);
      else if (type === `${DT}Image` && has(r[13])) def = this.attribFragment('DefaultTextureFilename', r[13]);
      const rowAttrib = has(r[11]) && has(r[12]) ? this.attribFragment(r[11], r[12]) : '';
      params += this.expand('shaderdef_input_paramdef', ['%%param_name%%', '%%param_type%%', '%%descr%%', '%%animatable%%', '%%inspectable%%', '%%texturable%%', '%%default%%', '%%attrib%%', '%%readonly%%'],
        [r[0], this.use(type, 'siShaderParameterDataType'), r[2], r[4], r[5], r[3], def, rowAttrib, r[6]]);   // inferred: the enum name passed as prefix
    }
    for (const r of this.grid('OutParamGrid').rows) {
      params += this.expand('shaderdef_output_paramdef', ['%%param_name%%', '%%param_type%%', '%%descr%%', '%%mainport%%'], [r[0], this.use(String(r[1]), 'siShaderParameterDataType'), r[2], r[3]]);
    }
    // renderer definition
    let renderer = '';
    if (this.s('ShaderDefRendName') !== '') {
      const hw = this.s('ShaderDefRendShaderType') === 'hwshader';
      let options = '';
      this.grid('RendOptionGrid').rows.forEach((r, i) => {
        const viaConstant = hw && i === 0;   // inferred: the enum names passed as prefixes
        options += this.expand('shaderdef_rendereroption', ['%%option%%', '%%value%%'],
          viaConstant ? [this.use(String(r[0]), 'siShaderParameterAttribute'), this.use(String(r[1]), 'siHWShaderVersion')] : [this.strConst(r[0]), this.strConst(r[1])]);
      });
      if (options !== '') options = this.expand('shaderdef_rendereroptions_def', ['%%options%%'], [options]);
      renderer = this.expand('shaderdef_rendererdef', ['%%name%%', '%%symbol%%', '%%code_path%%', '%%renderoptions%%'],
        [this.s('ShaderDefRendName'), this.s('ShaderDefRendSymbol'), this.s('ShaderDefRendCodePath'), options]);
    }
    const define = this.expand('shaderdef_define_CB', ['%%plugin%%', '%%shaderclass%%', '%%major%%', '%%minor%%', '%%shader_family%%', '%%parameter_definitions%%', '%%renderer_definition%%'],
      [plugin, cls, major, minor, this.use(this.s('ShaderDefFamily'), 'siShaderFamily'), params, renderer]);   // inferred: the enum name passed as prefix
    return info + define;
  }
  GenerateHWShaderCode(): [string, string] {
    if (this.s('ShaderDefRendShaderType') !== 'hwshader') return ['', ''];
    const renderer = this.s('ShaderDefRendName'), symbol = this.s('ShaderDefRendSymbol');
    if (renderer === '' || renderer === 'Mental ray' || symbol === '') { this.app.logMsg('info', 'Wrong Renderer name or symbol name specified.'); return ['', '']; }
    const [cls, major, minor] = this.version();
    const code = this.expand('hwshader_CB', ['%%symbol%%', '%%major%%', '%%minor%%', '%%renderername%%', '%%shadername%%'], [symbol, major, minor, renderer.toLowerCase(), cls], 'Cpp');
    return [`${this.WizardHelper.RemoveSpaces(cls)}_shader`, code];
  }
  ShaderDefCppIncludeFiles(): string {
    return ['xsi_factory.h', 'xsi_shaderdef.h', 'xsi_shaderparamdefoptions.h', 'xsi_shaderparamdefcontainer.h', 'xsi_metashaderrendererdef.h', 'xsi_valuemap.h'].map(h => `#include <${h}>\n`).join('');
  }
}

export function registerShaderDefHelperCommand(app: App) {
  app.register({
    name: 'GetShaderDefHelper', label: 'GetShaderDefHelper', category: 'Custom', description: '',
    args: [{ name: 'wiz', default: null }], undoable: false, noLog: true,
    execute(app2, a) { return new ShaderDefHelper(app2, a.wiz); },
  });
}
