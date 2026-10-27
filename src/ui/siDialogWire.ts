// Behaviour for the Softimage RT_DIALOG templates src/ui/siDialog.ts renders.
//
// The layout (title, DLU rect, font, control ids, control text) is the committed PE template; everything a
// control *does* is AfterImage's own. A template control with no AfterImage counterpart is left inert rather
// than given invented behaviour, and the dialog logs the Softimage name it carries.
import { App } from '../core/commands';
import { openSiDialog, SiDialogHandle, dluToPx, type SiDialogControl } from './siDialog';
import { formatCurrentTime, parseCurrentTime, type TimeUnit } from './animateDialogs';
import { SI_MENUS, SiMenuItem, openSiMenu, SI_KEYMAPS, siString, runScriptLine } from './si';
import { keymapNames, setKeymap, currentKeymap } from './keymap';
import { TEXTURE_NODES } from '../core/shaders';
import type { Shader } from '../core/scene';

const ev = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));

/** Win32 "&Mnemonic" → plain text, for log lines that quote a template's own button label. */
const plain = (s: string) => s.replace(/&&/g, '\u0000').replace(/&/g, '').replace(/\u0000/g, '&');

// ------------------------------------------------------------------ XSI.exe 102 — Command Mapping
/** File > Keyboard Mapping: the key map, its command groups, and the binding each command carries. */
export function commandMappingDialog(app: App) {
  openSiDialog('XSI.exe#102', {
    onReady: (d, close) => {
      const maps = keymapNames();
      d.fillList(1000, maps, Math.max(0, maps.indexOf(currentKeymap)));
      const groups = [...new Set([...app.commands.values()].map(c => c.category ?? 'Other'))].sort();
      let group = groups[0] ?? '';
      let command = '';
      const contexts = () => Object.keys(SI_KEYMAPS[d.selected(1000) || currentKeymap] ?? {}).sort();
      const bindingOf = (name: string): string => {
        for (const binds of Object.values(SI_KEYMAPS[d.selected(1000) || currentKeymap] ?? {})) {
          const b = binds.find(x => x.name === name);
          if (b) return [...b.mods, b.key].join('+');
        }
        return '';
      };
      const fillCommands = () => {
        const cmds = [...app.commands.values()].filter(c => (c.category ?? 'Other') === group)
          .map(c => c.label ?? c.name).sort();
        d.fillList(1160, cmds, -1);
        command = '';
        d.setText(1004, '');
        d.setText(1006, '');
      };
      d.fillList(1159, groups, 0);
      d.fillList(1016, contexts(), 0);
      d.fillList(1020, ['All'], 0);
      fillCommands();
      d.onChange(1159, () => { group = d.selected(1159) || group; fillCommands(); });
      d.onChange(1160, () => {
        command = d.selected(1160);
        const def = [...app.commands.values()].find(c => (c.label ?? c.name) === command);
        d.setText(1006, def ? `${def.name} (${def.args.length} argument(s))` : '');
        const b = def ? bindingOf(def.name) : '';
        d.setText(1004, b);
        d.setChecked(1023, /Ctrl/i.test(b));
        d.setChecked(1024, /Shift/i.test(b));
        d.setChecked(1025, /Alt/i.test(b));
      });
      d.onChange(1000, () => { d.fillList(1016, contexts(), 0); d.onChange(1160, () => { /* re-read on next pick */ }); });
      d.on(1163, () => { d.setText(1004, ''); d.setChecked(1023, false); d.setChecked(1024, false); d.setChecked(1025, false); });
      // The template's Aux Mod 1-3 and Device rows arrive WS_DISABLED in the dump — leave them inert.
      d.on(1, () => {
        const pick = d.selected(1000);
        if (pick && pick !== currentKeymap) { setKeymap(pick); app.logMsg('info', `Key map: ${pick}`); }
        close();
      });
    },
  });
}

// ------------------------------------------------------------------ XSI.exe 405 / 410 — interaction + prefs
export function interactionModeDialog(app: App) {
  openSiDialog('XSI.exe#405', {
    onReady: (d, close) => {
      const maps = keymapNames();
      d.fillList(3036, maps, Math.max(0, maps.indexOf(currentKeymap)));
      // The second combo is Softimage's mouse-interaction picker; AfterImage has one mouse scheme.
      d.fillList(3037, ['Softimage'], 0);
      d.on(1, () => { const k = d.selected(3036); if (k) { setKeymap(k); app.logMsg('info', `Interaction mode: ${k}`); } close(); });
    },
  });
}

export function migratePreferencesDialog(app: App) {
  openSiDialog('XSI.exe#410', {
    onReady: (d, close) => {
      // The only preference store AfterImage can migrate from is its own saved set.
      const have = (() => { try { return Object.keys(JSON.parse(localStorage.getItem('si.prefs') ?? '{}')); } catch { return []; } })();
      d.fillList(3034, have.length ? ['Softimage-Direct (this install)'] : [], 0);
      d.on(1, () => { close(); ev('openprefs'); });
    },
  });
}

// ------------------------------------------------------------------ XSI.exe 281 — Project Manager
const projects = (): string[] => { try { return JSON.parse(localStorage.getItem('si.projects') ?? '[]'); } catch { return []; } };
const saveProjects = (p: string[]) => localStorage.setItem('si.projects', JSON.stringify(p));
const projectName = () => { try { return localStorage.getItem('si.project') || 'Softimage-Direct'; } catch { return 'Softimage-Direct'; } };

export function projectManagerDialog(app: App, setProject: (n: string) => void) {
  openSiDialog('XSI.exe#281', {
    onReady: (d, close) => {
      const all = () => [...new Set([projectName(), ...projects()])];
      const refresh = (sel = 0) => { d.fillList(1088, all(), sel); d.setValue(1150, all()[sel] ?? ''); };
      refresh(0);
      d.onChange(1088, () => d.setValue(1150, d.selected(1088)));
      d.on(1102, () => { const n = prompt('New Project', 'Project'); if (!n) return; saveProjects([...projects(), n]); refresh(all().indexOf(n)); });
      d.on(3028, () => { const n = prompt('Add Project', ''); if (!n) return; saveProjects([...projects(), n]); refresh(all().indexOf(n)); });
      d.on(3024, () => { const n = d.selected(1088); saveProjects(projects().filter(p => p !== n)); refresh(0); });
      d.on(3025, () => { saveProjects([]); refresh(0); });
      d.on(1103, () => { const n = d.selected(1088); if (n && n !== projectName()) { saveProjects(projects().filter(p => p !== n)); refresh(0); } });
      const activate = () => { const n = d.selected(1088) || d.value(1150); if (n) { setProject(n); app.logMsg('info', `Project: ${n}`); } };
      d.on(1231, activate);
      d.on(1106, activate);
      d.on(1104, () => { activate(); close(); });
      d.on(2, close);
      // Scan Disk / Archive / Restore / Copy To / Import-Export List need a project filesystem AfterImage
      // does not have; the template ships them WS_DISABLED or inert, and they stay inert here.
      for (const id of [7, 3026, 3027, 3, 6, 3029, 9, 10, 8]) d.enable(id, false);
    },
  });
}

// ------------------------------------------------------------------ layouts: XSI.exe 166 / 315 / 364 / 403
export function renameLayoutDialog(current: string, onRename: (name: string) => void) {
  openSiDialog('XSI.exe#166', {
    onReady: (d, close) => {
      d.setValue(1020, current);
      d.on(1, () => { const n = d.value(1020).trim(); close(); if (n && n !== current) onRename(n); });
    },
  });
}

/** XSI.exe 364 — the PERMANENT-removal confirm Softimage shows before it drops a personalised layout. */
export function restoreFactoryLayoutDialog(layout: string, onConfirm: () => void) {
  openSiDialog('XSI.exe#364', {
    title: `Restore factory default layout — ${layout}`,
    onReady: (d, close) => { d.on(1, () => { close(); onConfirm(); }); },
  });
}

/** XSI.exe 315 — Save Layouts: the modified-layout list with Save / Don't Save / Revert. */
export function saveLayoutsDialog(modified: string[], onSave: () => void, onRevert: () => void) {
  openSiDialog('XSI.exe#315', {
    onReady: (d, close) => {
      d.fillList(1088, modified.map(n => `\u2713 ${n}`), 0);
      d.on(1, () => { close(); onSave(); });
      d.on(2, close);
      d.on(1114, () => { close(); onRevert(); });
    },
  });
}

export type ManageLists = { layouts: string[]; views: string[]; toolbars: string[] };
/** XSI.exe 403 — Manage Layouts, Views, Shelves and Toolbars: three group boxes, each a list + a name field. */
export function manageLayoutsDialog(
  app: App,
  lists: () => ManageLists,
  onDelete: (kind: 'layout' | 'view' | 'toolbar', name: string) => void,
  layoutItem: (name: string | null, x: number, y: number) => void,
): SiDialogHandle | null {
  return openSiDialog('XSI.exe#403', {
    onReady: (d, close) => {
      const ids = { layout: 1291, view: 1292, toolbar: 1293 } as const;
      const edits = { layout: 1294, view: 1295, toolbar: 1296 } as const;
      let focus: 'layout' | 'view' | 'toolbar' = 'layout';
      const refresh = () => {
        const l = lists();
        d.fillList(ids.layout, l.layouts, -1);
        d.fillList(ids.view, l.views, -1);
        d.fillList(ids.toolbar, l.toolbars, -1);
      };
      refresh();
      for (const kind of ['layout', 'view', 'toolbar'] as const) {
        d.onChange(ids[kind], () => { focus = kind; d.setValue(edits[kind], d.selected(ids[kind])); });
        // Room Menu (XSI.exe 146) on the list background, Layout Item (XSI.exe 308) on a row — as Softimage
        // groups them: the room menu creates, the item menu edits the row you clicked.
        const list = d.byId.get(ids[kind]);
        if (list && kind === 'layout') {
          list.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const me = e as MouseEvent;
            const row = (me.target as HTMLElement).closest('.si-dlg-item');
            layoutItem(row ? row.textContent : null, me.clientX, me.clientY);
            setTimeout(refresh, 0);
          });
        }
      }
      d.on(1, () => { const n = d.selected(ids[focus]); if (n) { onDelete(focus, n); refresh(); } });
      d.on(2, close);
      void app;
    },
  });
}

// ------------------------------------------------------------------ toolbars: 159 / 167 / 316 / 319 / 327 / 404 / 406
export type ScriptButton = { label: string; script: string; tooltip: string; lang: string; bitmap?: string; w?: number; h?: number };

/** XSI.exe 159 — Script Button: which kind of toolbar button to create. */
export function scriptButtonTypeDialog(onPick: (kind: 'script' | 'external') => void) {
  openSiDialog('XSI.exe#159', {
    onReady: (d, close) => {
      d.setChecked(800, true);
      d.on(1, () => { const external = d.checked(801); close(); onPick(external ? 'external' : 'script'); });
    },
  });
}

/** XSI.exe 406 — Customize Button: the script-command button form (script, language, label, tooltip, size). */
export function customizeScriptButtonDialog(app: App, existing: Partial<ScriptButton>, onOk: (b: ScriptButton) => void) {
  openSiDialog('XSI.exe#406', {
    onReady: (d, close) => {
      d.setValue(1004, existing.script ?? 'CreatePrim "Sphere", "MeshSurface"');
      d.fillList(1003, ['JScript', 'VBScript', 'Python'], ['JScript', 'VBScript', 'Python'].indexOf(existing.lang ?? 'JScript'));
      d.setValue(1000, existing.label ?? 'Script');
      d.setValue(1005, existing.tooltip ?? '');
      d.setValue(1035, existing.bitmap ?? '');
      d.setValue(1021, String(existing.w ?? ''));
      d.setValue(1001, String(existing.h ?? ''));
      d.on(1231, () => runScriptLine(app, d.value(1004)));
      d.on(1, () => {
        const b: ScriptButton = {
          label: d.value(1000).trim() || 'Script',
          script: d.value(1004),
          tooltip: d.value(1005),
          lang: d.selected(1003) || 'JScript',
          bitmap: d.value(1035).trim() || undefined,
          w: Number(d.value(1021)) || undefined,
          h: Number(d.value(1001)) || undefined,
        };
        close();
        onOk(b);
      });
      void app;
    },
  });
}

/** XSI.exe 404 — Customize Button: size, label and bitmap of an existing toolbar button. */
export function customizeButtonDialog(existing: Partial<ScriptButton>, onOk: (b: Partial<ScriptButton>) => void) {
  openSiDialog('XSI.exe#404', {
    onReady: (d, close) => {
      d.setValue(1021, String(existing.w ?? ''));
      d.setValue(1001, String(existing.h ?? ''));
      d.setValue(1000, existing.label ?? '');
      d.setValue(1035, existing.bitmap ?? '');
      d.setChecked(1178, existing.w != null);
      d.setChecked(1281, existing.h != null);
      d.setChecked(1002, !!existing.label);
      d.on(1, () => {
        close();
        onOk({
          label: d.checked(1002) ? d.value(1000).trim() : undefined,
          bitmap: d.value(1035).trim() || undefined,
          w: d.checked(1178) ? Number(d.value(1021)) || undefined : undefined,
          h: d.checked(1281) ? Number(d.value(1001)) || undefined : undefined,
        });
      });
    },
  });
}

/** XSI.exe 167 — Customize Spacer: the width / height of a toolbar spacer. */
export function customizeSpacerDialog(size: { w: number; h: number }, onOk: (s: { w: number; h: number }) => void) {
  openSiDialog('XSI.exe#167', {
    onReady: (d, close) => {
      d.setValue(1303, String(size.w));
      d.setValue(1304, String(size.h));
      d.on(1, () => { close(); onOk({ w: Number(d.value(1303)) || size.w, h: Number(d.value(1304)) || size.h }); });
    },
  });
}

/** XSI.exe 316 — Change Icon: pick a Softimage toolbar bitmap by name. */
export function changeIconDialog(names: string[], current: string, onOk: (name: string) => void) {
  openSiDialog('XSI.exe#316', {
    onReady: (d, close) => {
      d.fillList(1115, names, Math.max(0, names.indexOf(current)));
      d.setValue(3023, current);
      d.onChange(1115, () => d.setValue(3023, d.selected(1115)));
      d.on(1, () => { close(); onOk(d.value(3023).trim()); });
    },
  });
}

/** XSI.exe 319 — Add Script Command: the full script-button form with its Parse Script parameter grid. */
export function addScriptCommandDialog(app: App, existing: Partial<ScriptButton>, onOk: (b: ScriptButton) => void) {
  openSiDialog('XSI.exe#319', {
    title: existing.label ? 'Edit Script Command' : undefined,
    onReady: (d, close) => {
      d.setValue(1133, existing.label ?? 'Script');
      d.setValue(1134, existing.label ?? 'Script');
      d.setValue(1171, existing.tooltip ?? '');
      d.setValue(1136, '');
      d.fillList(1135, ['JScript', 'VBScript', 'Python'], ['JScript', 'VBScript', 'Python'].indexOf(existing.lang ?? 'JScript'));
      d.fillList(1131, [], -1);
      const params = d.byId.get(202);
      const parse = () => {
        // Softimage "Parse Script" lists the procedures a script file declares. AfterImage parses the one
        // thing it can attest from the text: the command names each line calls.
        const text = existing.script ?? '';
        const names = [...new Set([...text.matchAll(/^\s*(?:set\s+\w+\s*=\s*)?([A-Za-z_]\w*)/gm)].map(m => m[1]))]
          .filter(n => app.commands.has(n));
        d.fillList(1131, names, names.length ? 0 : -1);
        if (params) params.textContent = names.map(n => `${n}(${app.commands.get(n)!.args.map(a => a.name).join(', ')})`).join('\n');
      };
      d.on(1132, parse);
      d.on(1, () => {
        close();
        onOk({
          label: d.value(1133).trim() || 'Script',
          script: existing.script ?? '',
          tooltip: d.value(1171),
          lang: d.selected(1135) || 'JScript',
        });
      });
      // The template's NEW_/DELETE_/UP_/DOWN_ parameter buttons drive a DSGrid of script parameters;
      // AfterImage's script buttons take no declared parameters, so they stay inert.
      for (const id of [1020, 1021, 1022, 1023, 1154, 4]) d.enable(id, false);
    },
  });
}

/** XSI.exe 327 — Customize Popup Menu Button: the order of the items a popup button shows. */
export function popupMenuButtonDialog(items: string[], onOk: (items: string[]) => void) {
  openSiDialog('XSI.exe#327', {
    onReady: (d, close) => {
      const list = [...items];
      const refresh = (sel: number) => d.fillList(1145, list, sel);
      refresh(0);
      const idx = () => list.indexOf(d.selected(1145));
      const move = (delta: number) => {
        const i = idx();
        const j = i + delta;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        refresh(j);
      };
      d.on(1146, () => move(-1));
      d.on(1147, () => move(1));
      d.on(1148, () => { const i = idx(); if (i >= 0) { list.splice(i, 1); refresh(Math.min(i, list.length - 1)); } });
      d.on(1, () => { close(); onOk(list); });
    },
  });
}

/** XSI.exe 326 — the preset-list search folder of a preset-list toolbar button. */
export function presetFolderDialog(current: { label: string; folder: string }, onOk: (v: { label: string; folder: string; root: string }) => void) {
  openSiDialog('XSI.exe#326', {
    onReady: (d, close) => {
      const roots = ['Factory', 'User', 'Workgroup', 'Project'];
      d.setValue(1144, current.label);
      d.setValue(1021, current.folder);
      d.fillList(1162, roots, 1);
      d.enable(1143, false); // "..." needs a native folder browser
      d.on(1, () => { close(); onOk({ label: d.value(1144).trim(), folder: d.value(1021).trim(), root: d.selected(1162) || 'User' }); });
    },
  });
}

// ------------------------------------------------------------------ XSI.exe 383 — Events
/** The event handlers AfterImage dispatches, with the Softimage event names they are attested under. */
export function eventsDialog(app: App) {
  openSiDialog('XSI.exe#383', {
    onReady: (d, close) => {
      const grid = d.byId.get(1256);
      const rows = [
        ['OnInit', 'genppg.dll PPGEvent', 'src/ui/ppgLogic.ts'],
        ['_OnChanged', 'genppg.dll PPGEvent', 'src/ui/ppgLogic.ts'],
        ['PPG_LOGIC_NOTIFY', 'genppg.dll PPGEvent', 'src/ui/ppgLogic.ts'],
        ['OnBeginRenderPass', 'Softimage.XSIOM.dll', 'src/core/sceneRender.ts'],
        ['OnEndRenderPass', 'Softimage.XSIOM.dll', 'src/core/sceneRender.ts'],
      ];
      if (grid) {
        grid.classList.add('si-dlg-grid');
        for (const [name, module, surface] of rows) {
          const r = document.createElement('div');
          r.className = 'si-dlg-item';
          r.textContent = `${name}\u2003${module}\u2003${surface}`;
          r.onclick = () => d.setText(1261, `${name} — attested in ${module}; dispatched by ${surface}`);
          grid.appendChild(r);
        }
      }
      d.setText(1261, `${rows.length} event handler(s). Softimage event names only — AfterImage adds none of its own.`);
      d.on(1, close);
      d.on(2, close);
      d.enable(9, false);
      void app;
    },
  });
}

// ------------------------------------------------------------------ uiut 129 — Parameter Connection List
export function parameterConnectionDialog(app: App, shader: Shader, port: string) {
  openSiDialog('uiut.dll#129', {
    onReady: (d, close) => {
      const names = Object.keys(TEXTURE_NODES);
      const cur = shader.inputs.get(port)?.type ?? '';
      d.fillList(220, names, Math.max(0, names.indexOf(cur)));
      d.on(1, () => {
        const pick = d.selected(220);
        close();
        if (pick) app.run('ConnectShaderNode', { Shader: shader, Port: port, Preset: pick });
      });
    },
  });
}

// ------------------------------------------------------------------ genppg 232 — Error in Logic Script
/** XSIGENPPG carries the logic-script diagnostics; the dialog shows the message and where it came from. */
export function logicScriptErrorDialog(message: string, location: string) {
  openSiDialog('genppg.dll#232', {
    onReady: (d, close) => {
      d.setValue(211, message);
      d.setValue(212, location);
      d.on(2, close);
      d.enable(1, false); // the template's OK arrives WS_DISABLED
    },
  });
}

// ------------------------------------------------------------------ viewinteraction 337 — Polygon Winding
export function polygonWindingDialog(onPick: (choice: 'invert' | 'double' | 'cancel') => void) {
  openSiDialog('viewinteraction.dll#337', {
    onReady: (d, close) => {
      d.on(1000, () => { close(); onPick('invert'); });
      d.on(3, () => { close(); onPick('double'); });
      d.on(2, () => { close(); onPick('cancel'); });
    },
  });
}

// ------------------------------------------------------------------ vm 386 — Capture Viewport
export type CaptureOptions = {
  filename: string; format: string; padding: string; width: number; height: number;
  scale: string; pixelRatio: number; from: number; to: number; step: number;
  frameRate: number; returnToCurrent: boolean; launchFlipbook: boolean; antiAliasing: boolean;
};
export function captureViewportDialog(app: App, defaults: CaptureOptions, onOk: (o: CaptureOptions) => void) {
  openSiDialog('vm.dll#386', {
    onReady: (d, close) => {
      const formats = ['pic', 'png', 'jpg', 'tif', 'mp4'];
      const paddings = ['1', '2', '3', '4'];
      const scales = ['100%', '75%', '50%', '25%'];
      d.setValue(213, defaults.filename);
      d.fillList(217, formats, Math.max(0, formats.indexOf(defaults.format)));
      d.fillList(220, paddings, Math.max(0, paddings.indexOf(defaults.padding)));
      d.fillList(226, scales, Math.max(0, scales.indexOf(defaults.scale)));
      d.setValue(223, String(defaults.width));
      d.setValue(224, String(defaults.height));
      d.setValue(225, String(defaults.pixelRatio));
      d.setValue(214, String(defaults.from));
      d.setValue(215, String(defaults.to));
      d.setValue(216, String(defaults.step));
      d.setValue(236, String(defaults.frameRate));
      d.setChecked(392, defaults.returnToCurrent);
      d.setChecked(221, defaults.launchFlipbook);
      d.setChecked(238, defaults.antiAliasing);
      // Codec picker, audio track, native players and the file browser need host facilities AfterImage
      // does not have — the template keeps them, the dialog leaves them inert.
      for (const id of [230, 240, 239, 222, 241, 259, 9]) d.enable(id, false);
      d.on(1, () => {
        close();
        onOk({
          filename: d.value(213) || defaults.filename,
          format: d.selected(217) || defaults.format,
          padding: d.selected(220) || defaults.padding,
          width: Number(d.value(223)) || defaults.width,
          height: Number(d.value(224)) || defaults.height,
          scale: d.selected(226) || defaults.scale,
          pixelRatio: Number(d.value(225)) || defaults.pixelRatio,
          from: Number(d.value(214)) || defaults.from,
          to: Number(d.value(215)) || defaults.to,
          step: Number(d.value(216)) || defaults.step,
          frameRate: Number(d.value(236)) || defaults.frameRate,
          returnToCurrent: d.checked(392),
          launchFlipbook: d.checked(221),
          antiAliasing: d.checked(238),
        });
      });
      void app;
    },
  });
}

// ------------------------------------------------------------------ mcp 220 — Current Time
const TIME_UNITS: TimeUnit[] = ['FRAME', 'SECOND', 'MILLISECOND'];
const BS_AUTORADIO = 9;

/** Unit static nearest a radio, using the template's own DLU (radio y beside FRAME / SECOND / MILLISECOND). */
function unitForRadio(radio: SiDialogControl, statics: SiDialogControl[]): { unit: TimeUnit; label: SiDialogControl } | null {
  let best: SiDialogControl | null = null;
  let dist = Infinity;
  for (const s of statics) {
    if (!TIME_UNITS.includes(s.text as TimeUnit)) continue;
    const dy = Math.abs(s.dlu[1] - radio.dlu[1]);
    if (dy < dist) { dist = dy; best = s; }
  }
  return best ? { unit: best.text as TimeUnit, label: best } : null;
}

/** mcp.dll RT_DIALOG 220. One template: unit radios plus the frame value. OK writes both. */
export function currentTimeDialog(app: App) {
  openSiDialog('mcp.dll#220', {
    onReady: (d, close) => {
      const fps = app.anim.fps || 30;
      const frame = app.anim.frame;
      const statics = d.tpl.controls.filter(c => c.cls === 'static');
      const radios = d.tpl.controls.filter(c => c.cls === 'button' && (c.style & 0x0f) === BS_AUTORADIO);
      const ok = d.tpl.controls.find(c => c.id === 1);
      const rows: { id: number; unit: TimeUnit; input: HTMLInputElement }[] = [];
      for (const radio of radios) {
        const paired = unitForRadio(radio, statics);
        if (!paired || !ok) continue;
        const glyph = d.byId.get(radio.id)?.querySelector<HTMLInputElement>('input[type=radio]');
        if (glyph) glyph.name = 'mcp.dll#220-unit';
        // The template has no edit. The value sits in the gap the resource leaves between the unit
        // static and OK — those two rects are the coordinates, not a second layout.
        const left = paired.label.dlu[0] + paired.label.dlu[2] + 2;
        const editDlu: [number, number, number, number] = [
          left,
          radio.dlu[1],
          Math.max(12, ok.dlu[0] - left - 4),
          radio.dlu[3],
        ];
        const [x, y, w, h] = dluToPx(d.tpl.font, editDlu);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'si-dlg-edit';
        input.style.left = `${x}px`;
        input.style.top = `${y}px`;
        input.style.width = `${w}px`;
        input.style.height = `${h}px`;
        input.value = formatCurrentTime(frame, fps, paired.unit);
        input.onkeydown = e => e.stopPropagation();
        input.onfocus = () => d.setChecked(radio.id, true);
        d.root.appendChild(input);
        rows.push({ id: radio.id, unit: paired.unit, input });
      }
      const current = rows.find(r => r.unit === app.anim.timeUnit) ?? rows[0];
      if (current) d.setChecked(current.id, true);
      d.on(1, () => {
        const active = rows.find(r => d.checked(r.id)) ?? rows[0];
        if (!active) { close(); return; }
        const next = parseCurrentTime(active.input.value, fps, active.unit);
        if (!Number.isFinite(next)) return;
        app.anim.timeUnit = active.unit;
        close();
        app.run('SetCurrentFrame', { Frame: Math.round(next) });
        app.events.emit('frame');
      });
    },
  });
}

// ------------------------------------------------------------------ siuitasks 201 / 202
export function assembleNurbsMeshDialog(app: App, onOk: (o: { tolerance: number; clusters: boolean; materials: boolean; center: boolean }) => void) {
  openSiDialog('siuitasks.dll#201', {
    onReady: (d, close) => {
      d.setValue(202, '0.01');
      d.on(1, () => {
        close();
        onOk({ tolerance: Number(d.value(202)) || 0.01, clusters: d.checked(203), materials: d.checked(204), center: d.checked(205) });
      });
      d.enable(9, false);
      void app;
    },
  });
}

export function userKeywordsDialog(current: string, onOk: (keywords: string[]) => void) {
  openSiDialog('siuitasks.dll#202', {
    onReady: (d, close) => {
      d.setValue(248, current);
      d.on(1, () => { const v = d.value(248); close(); onOk(v.split(',').map(s => s.trim()).filter(Boolean)); });
    },
  });
}

// ------------------------------------------------------------------ XSI.exe 104 — Save Preset As...
export function savePresetAsDialog(app: App, suggested: string, onOk: (v: { name: string; description: string }) => void) {
  openSiDialog('XSI.exe#104', {
    onReady: (d, close) => {
      d.setValue(1021, suggested);
      d.on(1, () => { const name = d.value(1021).trim(); const description = d.value(1022); close(); if (name) onOk({ name, description }); });
      void app;
    },
  });
}

// ------------------------------------------------------------------ XSI.exe 146 / 308 — room + layout item
/** Room Menu (XSI.exe 146) on empty layout chrome, Layout Item (XSI.exe 308) on one layout. */
export function openLayoutItemMenu(name: string | null, x: number, y: number, act: (label: string, name: string | null) => void) {
  const popup = (key: string): SiMenuItem[] => {
    const top = SI_MENUS[key] ?? [];
    const named = top.find(n => n.items);
    return named?.items ?? top.filter(i => !i.separator);
  };
  const items = name ? popup('layoutItemMenu') : popup('roomMenu');
  openSiMenu(items, x, y, (it) => act(plain(it.label ?? ''), name));
}

/** Strings a wired dialog quotes, so the audit can show the dialog set reads the dump's own text. */
export function siDialogWireAudit(): { dialogs: string[]; genppgStrings: string[] } {
  return {
    dialogs: [
      'XSI.exe#102', 'XSI.exe#104', 'XSI.exe#159', 'XSI.exe#166', 'XSI.exe#167', 'XSI.exe#281',
      'XSI.exe#315', 'XSI.exe#316', 'XSI.exe#319', 'XSI.exe#326', 'XSI.exe#327', 'XSI.exe#331',
      'XSI.exe#364', 'XSI.exe#383', 'XSI.exe#403', 'XSI.exe#404', 'XSI.exe#405', 'XSI.exe#406',
      'XSI.exe#410', 'uiut.dll#129', 'uiut.dll#160', 'uiut.dll#162', 'genppg.dll#232',
      'viewinteraction.dll#337', 'vm.dll#386', 'mcp.dll#220', 'siuitasks.dll#201', 'siuitasks.dll#202',
    ],
    genppgStrings: [3522, 3523].map(id => siString('XSIGENPPG', id) ?? '').filter(Boolean),
  };
}
