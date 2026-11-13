// PROP-SIMPLE: the `CustomColor` and `TextProp` custom properties and their Get > Property menu items.
//
// Spec: docs/ghidra/cmd-01b-sdk-helpers.md, section "Related: CustomColor and TextProp properties".
// Everything here is original AfterImage code written from that note's tables: parameter names, types,
// defaults and ranges, the one-control layouts, the help topics, the menu anchor and the menu item behaviour.
//
// Not attested, and therefore not done here (see the WIRE-PARTIAL note on the ledger row):
//  - where inside the property section of Get > Property the anchor inserts its items, so the two items are
//    registered on the anchor and runnable, and are not drawn in the toolbar menu yet;
//  - the name the menu item gives the new property, the message box caption, and the Softimage colour widget.
import { App } from '../core/commands';
import { Node, Property } from '../core/scene';
import { num, str } from '../core/params';
import type { LayoutNode } from '../core/opdefs';
import { siString } from '../ui/si';
import { siMsgBox } from '../ui/msgBox';

/** Softimage menu anchor both items are registered on (the property section of Get > Property). */
export const SIMPLE_PROP_ANCHOR = 'siMenuTbGetPropertyPSetID';

/** XSISCRIPTS id 1174. The committed strings.json lost this record (ledger row TOOL-01), so the attested text is the fallback. */
const MSG_SELECT_SOMETHING = 1174;
const MSG_SELECT_SOMETHING_TEXT = 'Please select something and try again';
export function selectSomethingText(): string { return siString('XSISCRIPTS', MSG_SELECT_SOMETHING) ?? MSG_SELECT_SOMETHING_TEXT; }

const HELP_ROOT = '<FactoryPath>/Doc/<DocLangPref>/xsidocs.chm::/';
export const SIMPLE_PROP_HELP: Record<string, string> = {
  CustomColor: HELP_ROOT + 'property8539.htm',
  TextProp: HELP_ROOT + 'property8541.htm',
};

/** Height of the TextProp multi-line string control, in pixels. */
export const TEXTPROP_HEIGHT_PX = 275;

/** `CustomColor`: four doubles, default 0, range and suggested range 0..1, animatable; one colour control with alpha. */
export function makeCustomColor(name = 'CustomColor'): Property {
  const chan = (sn: string) => num(sn, 0, sn, { min: 0, max: 1, uimin: 0, uimax: 1, animatable: true });
  const p = new Property(name, 'CustomColor', [chan('Color_R'), chan('Color_G'), chan('Color_B'), chan('Color_A')]);
  const layout: LayoutNode[] = [{ param: 'Color_R', label: 'Color', control: 'rgba' }];
  p.layout = layout;
  (p as any).helpTopic = SIMPLE_PROP_HELP.CustomColor;
  return p;
}

/** `TextProp`: one string parameter `Text`; one multi-line string control, 275 px high, no label. */
export function makeTextProp(name = 'TextProp'): Property {
  const p = new Property(name, 'TextProp', [str('Text', '', 'Text')]);
  const layout: LayoutNode[] = [{ param: 'Text', control: 'multiline', height: TEXTPROP_HEIGHT_PX, opts: ['NoLabel'] }];
  p.layout = layout;
  (p as any).helpTopic = SIMPLE_PROP_HELP.TextProp;
  return p;
}

const FACTORIES: Record<string, () => Property> = { CustomColor: () => makeCustomColor(), TextProp: () => makeTextProp() };

/** A menu item a plug-in registers on a Softimage menu anchor. */
export interface AnchorMenuItem { anchor: string; label: string; run(app: App): Property | null }
const ANCHOR_ITEMS: AnchorMenuItem[] = [];
export function anchorMenuItems(anchor?: string): AnchorMenuItem[] { return anchor ? ANCHOR_ITEMS.filter(i => i.anchor === anchor) : ANCHOR_ITEMS.slice(); }
export function runAnchorMenuItem(app: App, anchor: string, label: string): Property | null {
  const it = ANCHOR_ITEMS.find(i => i.anchor === anchor && i.label === label);
  if (!it) throw new Error(`No menu item "${label}" on ${anchor}`);
  return it.run(app);
}

type PropertyHost = Node & { addProperty(p: Property): unknown; removeProperty(p: Property): void };
const canHost = (n: Node | undefined): n is PropertyHost => !!n && typeof (n as any).addProperty === 'function' && typeof (n as any).removeProperty === 'function';

/**
 * The menu item of both properties: nothing selected shows message 1174 and stops; otherwise the property
 * is added to the first selected object and inspected.
 */
function addToFirstSelected(app: App, type: string): Property | null {
  if (!app.selection.length) { siMsgBox(selectSomethingText()); return null; }
  const host = app.selection[0];
  if (!canHost(host)) { app.logMsg('error', `${type}: ${host.fullName} cannot hold a property`); return null; }
  const p = FACTORIES[type]();
  app.record(`Add ${type}`, () => { host.addProperty(p); }, () => { host.removeProperty(p); });
  app.events.emit('scene');
  app.events.emit('inspect', p);
  return p;
}

export function registerSimpleProperties(app: App) {
  // AddProp knows the two property types by name (it previously made a placeholder property for unknown names).
  const base = app.commands.get('AddProp');
  if (base) {
    const can = base.canRun, exec = base.execute;
    base.canRun = (a) => !!FACTORIES[String(a.PresetObj)] || (can ? can(a) : true);
    base.execute = (app2, a) => {
      const mk = FACTORIES[String(a.PresetObj)];
      if (!mk) return exec(app2, a);
      let last: Property | null = null;
      for (const o of app2.targets(a.InputObjs)) { const p = mk(); app2.record('Add property', () => { o.addProperty(p); }, () => { o.removeProperty(p); }); last = p; }
      if (last) app2.select([last]);
      return last;
    };
  }
  // One item per property, labelled with the property name, in the plug-in's registration order.
  for (const type of ['CustomColor', 'TextProp']) {
    if (!ANCHOR_ITEMS.some(i => i.anchor === SIMPLE_PROP_ANCHOR && i.label === type)) ANCHOR_ITEMS.push({ anchor: SIMPLE_PROP_ANCHOR, label: type, run: (a) => addToFirstSelected(a, type) });
  }
}
