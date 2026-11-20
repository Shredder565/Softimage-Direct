// Tool manager model of toolmanager.dll (row CMD-B16a, docs/ghidra/cmd-b16a-tool-activation-commands.md §2–5).
//
// Original code written from the analyst's wire contract; nothing here is derived from Softimage code. It models:
//   - tool channels keyed by a category GUID, each with a current tool class (§2);
//   - the activate-tool handler `0461b2c6` used by 68 commands: Clsid unpack with the last-auxiliary substitution,
//     plain / key-down (supra) / key-up paths, the activation helper with its SRT-memory step and the last-auxiliary
//     recorder with its exclusion list (§3);
//   - the command-tool session dispatcher `0461b2bd` (§4, read only in outline);
//   - the command-state notification relay `0461b2c7` used by `XYZ Transform ` (§5).
// What a tool class does interactively is out of scope of the note: a class is a pair of `on` / `off` callbacks that the
// command layer (src/commands/toolsB16a.ts) fills with this build's viewport tools.
// Parts the note leaves open are marked `// inferred` and kept overridable (tool states, eligibility, categories,
// what "deactivate" falls back to, the dispatcher's session bookkeeping).

export const GUID_NULL = '00000000-0000-0000-0000-000000000000';
export const S_OK = 0, S_FALSE = 1, E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057;

/** Canonical form of a class / command GUID: lower case, no braces. Empty / null / undefined = GUID_NULL. */
export function normGuid(v: unknown): string {
  if (v === undefined || v === null || v === '') return GUID_NULL;
  return String(v).trim().replace(/^\{|\}$/g, '').toLowerCase();
}
/** Registry spelling of a GUID: `{XXXXXXXX-...}` upper case (data/commands_full.json). */
export const braceGuid = (g: string) => `{${normGuid(g).toUpperCase()}}`;

/** Classes the handler names (§3.3, §3.4). */
export const CLS = {
  select: '11778840-8c5c-11d1-84b5-00aa00135f7b',
  translate: '3a711ff0-8798-11d1-84b1-00aa00135f7b',
  rotate: 'ecbad3a0-974b-11d1-84bf-00aa00135f7b',
  scale: 'f500bd80-974b-11d1-84bf-00aa00135f7b',
  manipulate: '36ad0600-98dc-11d1-84bf-00aa00135f7b',
  navigation: '988e8c81-0a1f-11d3-bfe4-00a0248f9397',
  navigation3dsMax: 'a31f01db-e282-4d0a-8a62-3d36a544da7a',
  toolmanagerTool: 'd97e3888-012c-11d6-a2e3-08003658d403',
  mayaZoom: '462d51a8-dc72-46e9-ad70-afbf3cf87835',
  pickSession: 'cf80cbc3-984e-11d1-96e7-00a024191bac',
  doNothing: '2b2ffb2e-5987-11d2-8411-00a0c961747d',
} as const;
const SRT = new Set<string>([CLS.translate, CLS.rotate, CLS.scale]);
/** §3.4: never recorded as the last auxiliary tool. */
export const LAST_AUX_EXCLUDED: ReadonlySet<string> = new Set<string>([
  CLS.select, CLS.translate, CLS.rotate, CLS.scale, CLS.manipulate, CLS.navigation, CLS.navigation3dsMax, CLS.toolmanagerTool,
]);
/** §5: the only accepted `Property` values of the notification relay. */
export const COMMAND_STATE_EVENTS = [
  'SI3D_SUPRA_COMMAND_ACTIVATED', 'SI3D_SUPRA_COMMAND_DEACTIVATED', 'SI3D_STICKY_COMMAND_ACTIVATED',
  'SI3D_STICKY_COMMAND_DEACTIVATED', 'SI3D_COMMAND_EXECUTED',
] as const;

/** Exec-context words (§2): A = invocation flags (0x4 key, 0x2 key-down), B = modifier flags (0x10 restart). A plain
 *  script / menu call has A = B = 0 (inferred, Q2). */
export interface ToolExecContext { A: number; B: number; /** the command's arguments, handed to the class body */ args?: Record<string, any> }
export const KEY = 0x4, KEY_DOWN = 0x2, RESTART = 0x10;

/** One tool class this build can create. */
export interface ToolClass {
  clsid: string;
  label: string;
  /** Category GUID of the tool's channel. inferred: every class is in the default category (GUID_NULL); not read (Q6). */
  category?: string;
  /** Switch the tool on (the class's interactive part). */
  on(ctx: ToolExecContext): void;
  /** Switch it off. */
  off(): void;
  /** Whether this build's UI still runs the tool (a viewport tool can be left with Esc outside the manager). inferred. */
  live?(): boolean;
  /** inferred: deactivating a tool re-activates the previous one only when that one can be restored as is
   *  (selection / SRT / navigation style tools, not a drawing session). */
  restorable?: boolean;
}

interface Channel { current: string | null; previous: Map<string, string | null> }
export interface CommandToolSession { cmdId: string; clsid: string; previous: string | null }
export interface ToolTraceEntry { op: string; clsid: string; detail?: any }

export interface ToolManagerHost {
  /** Boolean preference Interaction.<name> (stickytoggle / stickykeys). */
  pref(name: 'stickytoggle' | 'stickykeys'): boolean;
  /** The class that reflects the UI's base tool when the stored current tool is no longer live. inferred. */
  idle?(): string | null;
  /** Fire a command-state notification (§5). */
  notify?(event: string, args: string[]): void;
  /** "not yet attested" log for open branches. */
  nya?(what: string): void;
}

export class ToolManager {
  readonly classes = new Map<string, ToolClass>();
  private channels = new Map<string, Channel>();
  private lastAux = new Map<string, string>();
  /** +0x90 "previous SRT tool" (meaning inferred). */
  prevSrt: string = GUID_NULL;
  /** +0x68 tool mode: 1 sticky, 2 supra, 6 key-up with state 5 (names inferred); 0 before any activation. */
  mode = 0;
  /** Tool state overrides (+0x20). Q1: the channels' state values were not read. */
  readonly stateOverride = new Map<string, number>();
  /** Eligibility overrides (+0xa8). Q1: meaning not read; inferred default = eligible (S_OK). */
  readonly eligibleOverride = new Map<string, boolean>();
  /** Command-tool sessions of the `0461b2bd` dispatcher (§4). */
  session: CommandToolSession | null = null;
  readonly queue: CommandToolSession[] = [];
  /** inferred: the dispatcher's "pending" state (+0x70..+0x78) is not specified; nothing sets it in this build. */
  sessionPending = false;
  readonly notifications: { event: string; args: string[] }[] = [];
  readonly trace: ToolTraceEntry[] = [];
  private depth = 0;

  constructor(readonly host: ToolManagerHost) {}

  addClass(c: ToolClass) { this.classes.set(normGuid(c.clsid), { ...c, clsid: normGuid(c.clsid) }); }

  // ------------------------------------------------------------------ manager methods (§2)
  /** Category of a class; an uncreatable class reports GUID_NULL (§2). */
  categoryOf(clsid: string): string { return normGuid(this.classes.get(normGuid(clsid))?.category ?? GUID_NULL); }
  private channel(cat: string): Channel {
    let c = this.channels.get(cat); if (!c) { c = { current: null, previous: new Map() }; this.channels.set(cat, c); }
    return c;
  }
  /** +0x28: the current tool class of a category (null = none). */
  current(cat = GUID_NULL): string | null {
    const ch = this.channel(normGuid(cat));
    if (ch.current) { const k = this.classes.get(ch.current); if (k?.live && !k.live()) ch.current = null; } // inferred: left outside the manager
    if (!ch.current && normGuid(cat) === GUID_NULL) { const idle = this.host.idle?.(); if (idle && this.classes.has(normGuid(idle))) ch.current = normGuid(idle); }
    return ch.current;
  }
  /** +0x38: 0 = the class is current, 1 = it is not. */
  isCurrent(clsid: string): 0 | 1 { return this.current(this.categoryOf(clsid)) === normGuid(clsid) ? 0 : 1; }
  /** +0x20: tool state S of a class. Q1: values not read. inferred defaults: a class that is not current = 1; the current
   *  class = 0 right after a supra (key-down) activation, else 1. */
  toolState(clsid: string): { hr: number; S: number } {
    const c = normGuid(clsid);
    if (this.stateOverride.has(c)) return { hr: S_OK, S: this.stateOverride.get(c)! };
    return { hr: S_OK, S: this.isCurrent(c) === 0 && this.mode === 2 ? 0 : 1 };
  }
  /** +0xa8: eligibility query. inferred: eligible unless overridden. */
  eligible(clsid: string): boolean { return this.eligibleOverride.get(normGuid(clsid)) ?? true; }
  /** +0x88: activate a class on its channel. An uncreatable class has no effect (S_FALSE, no error; §2, correction 11). */
  activate(clsid: string, ctx: ToolExecContext): number {
    const c = normGuid(clsid); const k = this.classes.get(c);
    if (!k) { this.trace.push({ op: 'activate-uncreatable', clsid: c }); return S_FALSE; }
    const ch = this.channel(this.categoryOf(c));
    const prev = this.current(this.categoryOf(c));
    if (prev && prev !== c) this.classes.get(prev)?.off();
    ch.previous.set(c, prev && prev !== c ? prev : ch.previous.get(c) ?? null);
    ch.current = c;
    this.trace.push({ op: 'activate', clsid: c });
    this.depth++;
    try { k.on(ctx); } finally { this.depth--; }
    return S_OK;
  }
  /** +0x50: deactivate. inferred: the channel falls back to the stored previous SRT tool, else to the tool that was
   *  current before this one when that one is restorable, else to none (the UI's base tool). */
  deactivate(clsid: string, ctx: ToolExecContext): number {
    const c = normGuid(clsid); const cat = this.categoryOf(c); const ch = this.channel(cat);
    if (this.current(cat) !== c) return S_OK;
    this.classes.get(c)?.off();
    ch.current = null;
    this.trace.push({ op: 'deactivate', clsid: c });
    const useSrt = this.prevSrt !== GUID_NULL && this.prevSrt !== c && this.classes.has(this.prevSrt);
    const back = useSrt ? this.prevSrt : ch.previous.get(c) ?? null;
    if (useSrt) this.prevSrt = GUID_NULL; // inferred: the stored SRT tool is used once
    const bk = back ? this.classes.get(back) : undefined;
    if (back && bk && back !== c && (bk.restorable || useSrt) && this.depth < 4) {
      ch.current = back; this.trace.push({ op: 'restore', clsid: back });
      this.depth++; try { bk.on(ctx); } finally { this.depth--; }
    }
    return S_OK;
  }
  setMode(m: number) { this.mode = m; }
  /** +0xf0 / +0xf8. */
  recordLastAux(cat: string, clsid: string) { this.lastAux.set(normGuid(cat), normGuid(clsid)); }
  getLastAux(cat = GUID_NULL): string { return this.lastAux.get(normGuid(cat)) ?? GUID_NULL; }

  // ------------------------------------------------------------------ handler 0461b2c6 (§3)
  /** UnPackArg (§3.1): the tool class of a call; GUID_NULL becomes the recorded last auxiliary tool of the default
   *  category. */
  unpackClsid(arg: unknown): string { const c = normGuid(arg); return c === GUID_NULL ? this.getLastAux(GUID_NULL) : c; }

  /** UnPackArg + Do of the activate-tool handler. Returns S_OK (the Do's return value is unsettled; inferred). */
  activateTool(clsidArg: unknown, ctx: ToolExecContext = { A: 0, B: 0 }): number {
    const c = this.unpackClsid(clsidArg);
    if (c === GUID_NULL) { this.trace.push({ op: 'noop-null', clsid: c }); return S_OK; }
    const cur = this.isCurrent(c) === 0;
    if (!(ctx.A & KEY)) { // plain invocation
      if (!cur) {
        if (this.activateHelper(c, ctx) === S_OK) { this.recordAfterActivation(c); this.setMode(1); }
        return S_OK;
      }
      const restart = !!(ctx.B & RESTART);
      if (!this.host.pref('stickytoggle') && !restart) { this.trace.push({ op: 'noop-current', clsid: c }); return S_OK; }
      this.deactivate(c, ctx);
      if (restart && this.activateHelper(c, ctx) === S_OK) this.setMode(1); // the recorder is not run on this path
      return S_OK;
    }
    if (ctx.A & KEY_DOWN) { // key-down: supra activation
      if (cur) return S_OK;
      if (this.activateHelper(c, ctx) !== S_OK) return S_OK; // inferred: the filter runs after a successful activation
      const sticky = this.host.pref('stickykeys');
      if (!sticky && SRT.has(c)) return S_OK;
      if (sticky && c !== CLS.mayaZoom) return S_OK;
      this.setMode(2);
      return S_OK;
    }
    // key-up
    if (!cur) return S_OK;
    const { S } = this.toolState(c);
    if (S === 0 && this.eligible(c)) { this.recordAfterActivation(c); this.setMode(1); return S_OK; }
    this.prevSrt = GUID_NULL;
    if (S === 5) this.setMode(6);
    else if (this.host.pref('stickytoggle') || S !== 1) this.deactivate(c, ctx);
    return S_OK;
  }
  /** Activation helper (§3.3). */
  private activateHelper(c: string, ctx: ToolExecContext): number {
    const { hr, S } = this.toolState(c);
    if (hr < 0 || hr > 0x7fffffff) return hr;
    if (c !== CLS.pickSession && hr === S_OK && (S === 0 || !this.eligible(c))) { this.trace.push({ op: 'refused', clsid: c, detail: S }); return S_FALSE; }
    if (S === 1) { const d = this.current(GUID_NULL); this.prevSrt = d && SRT.has(d) ? d : GUID_NULL; }
    return this.activate(c, ctx);
  }
  /** Last auxiliary tool recorder (§3.4). */
  private recordAfterActivation(c: string) {
    if (this.categoryOf(c) !== GUID_NULL) return;
    const d = this.current(GUID_NULL);
    if (d && !LAST_AUX_EXCLUDED.has(d)) this.recordLastAux(GUID_NULL, d);
  }

  // ------------------------------------------------------------------ handler 0461b2bd (§4, outline)
  /** Dispatcher slot 5 with (CmdID of the exec context, word A, Clsid). */
  commandToolSession(cmdId: string, A: number, clsid: unknown): number {
    const id = normGuid(cmdId), c = normGuid(clsid);
    if (A & KEY_DOWN) { // start
      const req: CommandToolSession = { cmdId: id, clsid: c, previous: this.current(GUID_NULL) };
      if (this.sessionPending) { this.queue.push(req); this.trace.push({ op: 'session-queued', clsid: c, detail: id }); return S_OK; }
      if (this.session) this.endSession(this.session.cmdId);
      this.host.nya?.('how the dispatcher installs the session tool (dispatcher +0x90 / +0xe0, veto object); the tool class is activated on its channel'); // inferred
      this.session = req;
      this.trace.push({ op: 'session-start', clsid: c, detail: id });
      this.activate(c, { A, B: 0 });
      return S_OK;
    }
    if (!(A & 0x1)) { this.endSession(id); return S_OK; } // A bits 0x2 and 0x1 clear: end
    return S_OK; // only 0x1: nothing
  }
  private endSession(id: string) {
    const qi = this.queue.findIndex(q => q.cmdId === id);
    if (qi >= 0) { this.queue.splice(qi, 1); this.trace.push({ op: 'session-unqueued', clsid: GUID_NULL, detail: id }); return; }
    if (this.session?.cmdId === id) {
      const s = this.session; this.session = null;
      this.trace.push({ op: 'session-end', clsid: s.clsid, detail: id });
      // inferred: finishing restores the tool that was current when the session started
      if (this.current(this.categoryOf(s.clsid)) === s.clsid) {
        this.classes.get(s.clsid)?.off(); this.channel(this.categoryOf(s.clsid)).current = null;
        const back = s.previous ? this.classes.get(s.previous) : undefined;
        if (back) { this.channel(this.categoryOf(back.clsid)).current = back.clsid; back.on({ A: 0, B: 0 }); }
      }
      return;
    }
    this.trace.push({ op: 'session-none', clsid: GUID_NULL, detail: id });
    this.host.nya?.('ending a command-tool session that is not running (dispatcher session state, Q3); nothing is changed');
  }

  // ------------------------------------------------------------------ handler 0461b2c7 (§5)
  /** Dispatcher slot 4 with (CmdID, class, Property). Returns E_INVALIDARG for an unknown Property or a null CmdID. */
  commandState(cmdId: unknown, clsid: unknown, property: unknown): number {
    const id = normGuid(cmdId);
    if (id === GUID_NULL || typeof property !== 'string' || !(COMMAND_STATE_EVENTS as readonly string[]).includes(property)) return E_INVALIDARG;
    const args = [braceGuid(id)]; const c = normGuid(clsid); if (c !== GUID_NULL) args.push(braceGuid(c));
    this.notifications.push({ event: property, args });
    this.host.notify?.(property, args);
    return S_OK;
  }
}
