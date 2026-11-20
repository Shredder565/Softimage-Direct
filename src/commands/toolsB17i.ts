// Row CMD-B17i, toolmanager.dll / manipmgr.dll part: `Escape Pick Session` ×2, `Show Next Manipulator`,
// `Show Previous Manipulator`, `Toggle Manipulator mode`. Wire contracts of
// docs/ghidra/cmd-b17i-toolmanager-view-commands.md and items 6, 7, 10 of the cmd-b17i section of
// docs/re/WIRE_CORRECTIONS_B17.md. The vm.dll part (Frame / Reset / Grid) is in src/commands/inferredB10Views.ts.
// Original code written from the prose contracts; no XSIBATCH golden exists.
//
// Bus names: the two `Escape Pick Session` registry entries share a name. {45AF19B0-…} (handler 0461b2b3, the one the
// key maps bind to Esc) is on the bus as `Escape Pick Session`; {41EE76F1-…} (handler 0461b2bc, not key-assignable) is on
// the bus under its command GUID, as `Paint Tool` {CF80CBC2-…} is (CMD-B16a).
// None of these commands is undoable, logs a command line or returns a value.
import { App } from '../core/commands';
import { CLS, CMD, S_OK, S_FALSE, E_FAIL, braceGuid, type ManipulatorManagerHost } from '../core/toolManager';
import { toolManagerOf } from './toolsB16a';
import { fail } from './inferredB10Shared';

const NOTE = 'CMD-B17i';
export const ESCAPE2_BUS = braceGuid(CMD.escape2);
const nya = (app: App, cmd: string, what: string) => app.logMsg('info', `${cmd}: not yet attested: ${what} (${NOTE})`);

/** The manipulator manager (291f2030) of this build. Its setting's second field is "manipulators set by mode" (registry
 *  description "Toggle Manipulators Set By Mode", inferred): 1 = the transform mode's manipulator is shown, which is the
 *  MCP's manipulator display (`app.hideManip` false). The first field and the step were not read. */
export function manipulatorManagerOf(app: App): ManipulatorManagerHost & { first: number } {
  const A = app as any;
  if (A.manipulatorManager) return A.manipulatorManager;
  const mm = {
    first: 0,
    getSetting(): [number, number] { return [mm.first, A.hideManip ? 0 : 1]; },
    setSetting(v: [number, number]) { mm.first = v[0] | 0; A.hideManip = !(v[1] | 0); app.events.emit('selection'); },
    step: undefined as ManipulatorManagerHost['step'],
  };
  A.manipulatorManager = mm;
  return mm;
}

export function registerToolsB17iCommands(app: App) {
  const tm = toolManagerOf(app);
  const A = app as any;
  const reg = (name: string, label: string, category: string, description: string, args: { name: string; default: any }[], execute: (a: Record<string, any>) => void) =>
    app.register({ name, label, category, description, args, undoable: false, noLog: true, execute(_app, a) { const p = A.toolCommand; A.toolCommand = name; try { execute(a); } finally { A.toolCommand = p; } return undefined; } });

  // ---- Escape Pick Session {45AF19B0} (handler 0461b2b3): end the current default tool; after Translate / Rotate /
  // Scale the selection tool is the fallback that comes back (correction 6).
  reg('Escape Pick Session', 'Escape Pick Session', '', 'Terminates the current pick session', [], () => {
    const hr = tm.escapeTool();
    if (hr === E_FAIL) throw fail('Escape Pick Session', E_FAIL, 'the default tool channel has no tool');
  });
  // ---- Escape Pick Session {41EE76F1} (handler 0461b2bc): end the dispatcher's supra session if held, else its sticky
  // session; SI3D_COMMAND_EXECUTED for 41ee76f1 when nothing remains (correction 7).
  reg(ESCAPE2_BUS, 'Escape Pick Session', '', 'Todo: Escape pick session status', [], () => {
    const hr = tm.escapePickSession();
    if (hr >= 0x80000000) throw fail('Escape Pick Session', hr, 'the command-tool dispatcher failed');
    nya(app, 'Escape Pick Session', 'the dispatcher session bookkeeping helpers (+0xd8 / +0x68 / +0xc0 / +0xf0 / +0xf8) beyond ending the session');
  });

  // ---- Show Next / Previous Manipulator (handler 0461b2c0, manipmgr.dll): step the manipulator manager; when it
  // cannot step, cycle the SRT tool through the tool commands (correction 10).
  const NEXT: Record<string, [next: string, prev: string]> = {
    [CLS.translate]: ['RotationTool', 'ScalingTool'],
    [CLS.rotate]: ['ScalingTool', 'TranslateTool'],
    [CLS.scale]: ['TranslateTool', 'RotationTool'],
  };
  const showManip = (name: string) => (a: Record<string, any>) => {
    const mm = manipulatorManagerOf(app);
    const next = !(a.Next === false || a.Next === 0 || /^(false|0)$/i.test(String(a.Next)));
    let hr: number;
    if (mm.step) hr = mm.step(next ? 1 : -1);
    else { hr = S_FALSE; nya(app, name, 'stepping the manipulator manager itself (which manipulator is shown); treated as "could not step"'); }
    if (hr >= 0x80000000) throw fail(name, hr, 'the manipulator manager failed');
    if (hr === S_OK) return;
    for (const [c, [n, p]] of Object.entries(NEXT)) {
      if (tm.isCurrent(c) === 0) { app.run(next ? n : p); return; }
    }
  };
  reg('Show Next Manipulator', 'Show Next Manipulator', 'Manipulation', 'Switch to the next available 3D manipulator', [{ name: 'Next', default: true }], showManip('Show Next Manipulator'));
  reg('Show Previous Manipulator', 'Show Previous Manipulator', 'Manipulation', 'Switch to the previous 3D manipulator', [{ name: 'Next', default: false }], showManip('Show Previous Manipulator'));

  // ---- Toggle Manipulator mode (handler 0461b2c4): invert the second field of the manager's setting.
  reg('Toggle Manipulator mode', 'Toggle Manipulator mode', 'Manipulation', 'Toggle Manipulators Set By Mode', [], () => {
    const mm = manipulatorManagerOf(app);
    const [f0, f1] = mm.getSetting();
    mm.setSetting([f0, f1 ? 0 : 1]);
  });
}
