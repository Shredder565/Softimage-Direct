// Softimage floating Anim editors — ExecuteCommand empty-args open path (workstream D).
// Dump: src/data/si/anim_editors_execcmd.json — OpenView LOCK; client paint DONE (modules-gdi HWND PNG).
import dump from '../data/si/anim_editors_execcmd.json';
import type { App } from '../core/commands';
import { floatingWindows } from './floating';

const D = dump as {
  meta: { softimage: string; utc: string; purpose: string };
  commands: Record<string, { view: string; args: unknown[] }>;
  honest: {
    'animate.floating_views': { openview: string; execute_command_empty_args: string; wire: string };
    'animate.fcurve_mixer_client_paint': { status: string; wire: string };
  };
};

const CMD_NAMES = ['OpenAnimationMixer', 'OpenAnimationEditor', 'OpenFcurveEditor'] as const;

/** Compact audit — ExecCmd open DONE; OpenView LOCK; client paint HWND_PNG DONE. */
export function animEditorsExecCmdAudit(app: App): Record<string, unknown> {
  const registered = CMD_NAMES.map(n => ({
    name: n,
    registered: app.commands.has(n),
    argCount: app.commands.get(n)?.args.length ?? -1,
    view: D.commands[n]?.view,
  }));
  const fv = D.honest['animate.floating_views'];
  const paint = D.honest['animate.fcurve_mixer_client_paint'];
  const hasExec = typeof (app as any).ExecuteCommand === 'function';
  return {
    softimage: D.meta.softimage,
    utc: D.meta.utc,
    purpose: D.meta.purpose,
    executeCommandMethod: hasExec,
    commands: registered,
    floatingViewsOpenview: fv.openview,
    floatingViewsExecCmd: fv.execute_command_empty_args,
    floatingViewsWire: fv.wire,
    clientPaint: paint.status,
    clientPaintWire: paint.wire,
    ok:
      hasExec &&
      registered.every(c => c.registered) &&
      fv.execute_command_empty_args === 'DONE' &&
      fv.openview === 'LOCK' &&
      paint.status === 'DONE' &&
      paint.wire === 'HWND_PNG',
  };
}

/** Smoke: Application.ExecuteCommand(name, []) opens the matching floating view title. */
export function animEditorsExecCmdSmoke(app: App): Record<string, unknown> {
  const opened: { cmd: string; view: string; ok: boolean; title?: string }[] = [];
  for (const name of CMD_NAMES) {
    const view = D.commands[name]?.view;
    const before = floatingWindows().map(w => w.title);
    try {
      (app as any).ExecuteCommand(name, []);
    } catch {
      opened.push({ cmd: name, view: view ?? '', ok: false });
      continue;
    }
    const after = floatingWindows();
    const hit = after.find(w => w.title === view) ?? after.find(w => !before.includes(w.title));
    opened.push({ cmd: name, view: view ?? '', ok: !!hit && hit.title === view, title: hit?.title });
  }
  return {
    opened,
    ok: opened.length === 3 && opened.every(o => o.ok),
  };
}
