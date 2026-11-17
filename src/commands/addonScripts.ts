// Ledger row CMD-B7c: script commands of the shipped add-ons. Brief: docs/ghidra/cmd-b7c-addon-scripts.md,
// "Wire contract". Original code written from that contract only.
//
// 29 commands, split by add-on:
//   addonScriptsCacheManager.ts     Cache Manager (11)
//   addonScriptsRender.ts           Render Manager (2), render tree user tools (2), Polygonizer (1)
//   addonScriptsIce.ts              Lagoa (3), ICE flow builder (3)
//   addonScriptsSdkui.ts            sdkui: External Files Manager (2), ConnectToWorkgroupUI
//   addonScriptsGenerator.ts        sdkui: SDKGetScriptGenerator, PPGLayoutControl
//   addonScriptsWizardParamTab.ts   sdkui: GetWizardParamTab (SPEC-PARTIAL)
//   addonScriptsShaderDefHelper.ts  sdkui: GetShaderDefHelper (SPEC-PARTIAL)
//   addonScriptsShared.ts           session state (`app.addonScripts`) and object-model stand-ins
//   addonScriptsShaderCategories.ts the category table of RTShaderSetCategories
import { App } from '../core/commands';
import { addonScriptsState, GridData, ScriptLayout, ScriptPPG, addGrid, gridOf } from './addonScriptsShared';
import { registerCacheManagerCommands, fillCachesPathGrid, fillCacheOnFileGrid, cachesPathButton, cachesPathEdited } from './addonScriptsCacheManager';
import { registerRenderAddonCommands } from './addonScriptsRender';
import { registerIceAddonCommands, IceFlowTree, IceFlowNode } from './addonScriptsIce';
import { registerSdkuiViewerCommands, fillExternalFilesGrid, openExternalFilesPage, closeExternalFilesPage } from './addonScriptsSdkui';
import { registerSdkuiGeneratorCommands } from './addonScriptsGenerator';
import { registerWizardParamTabCommand } from './addonScriptsWizardParamTab';
import { registerShaderDefHelperCommand } from './addonScriptsShaderDefHelper';

export function registerAddonScriptsCommands(app: App) {
  // Session state plus the classes and page functions a caller (a view, a check script) needs to drive the commands.
  (app as any).addonScripts = Object.assign(addonScriptsState, {
    GridData, ScriptLayout, ScriptPPG, IceFlowTree, IceFlowNode, addGrid, gridOf,
    fillCachesPathGrid: (prop: any) => fillCachesPathGrid(app, prop),
    fillCacheOnFileGrid: (prop: any) => fillCacheOnFileGrid(app, prop),
    cachesPathButton: (prop: any, id: string) => cachesPathButton(app, prop, id),
    cachesPathEdited: (prop: any, row: number, path: string) => cachesPathEdited(app, prop, row, path),
    fillExternalFilesGrid: (prop: any, fromPage?: boolean) => fillExternalFilesGrid(app, prop, fromPage),
    openExternalFilesPage: (prop: any) => openExternalFilesPage(app, prop),
    closeExternalFilesPage,
  });
  registerCacheManagerCommands(app);
  registerRenderAddonCommands(app);
  registerIceAddonCommands(app);
  registerSdkuiViewerCommands(app);
  registerSdkuiGeneratorCommands(app);
  registerWizardParamTabCommand(app);
  registerShaderDefHelperCommand(app);
}
