// Tool manager model of toolmanager.dll.
//   Row CMD-B16a: docs/ghidra/cmd-b16a-tool-activation-commands.md §2–5 (handlers 0461b2c6 / 0461b2bd / 0461b2c7).
//   Row CMD-B17i: docs/ghidra/cmd-b17i-toolmanager-view-commands.md (answers Q2 tool state / eligibility, Q4 deactivate
//     fallback, Q5 command-tool dispatcher, Q6 exec-context words; Escape Pick Session ×2) and items 1–7 / 12 of the
//     cmd-b17i section of docs/re/WIRE_CORRECTIONS_B17.md.
//
// Original code written from the analysts' prose contracts; nothing here is derived from Softimage code. It models:
//   - tool channels keyed by a category GUID. A channel holds its current tool record (class, mode, activation time),
//     a history of earlier tool records, a fallback class ("+0x90 tool"), a lock flag and the "record on deactivate"
//     flag (B17i Shared facts);
//   - the activate-tool handler `0461b2c6` (B16a §3 with B17i corrections 1–3);
//   - deactivate (B17i Q4): dispatcher session escape, previous tool from history, then the fallback, then the nil tool;
//   - the command-tool dispatcher `7c037c30` (B17i Q5): a sticky and a supra session plus a queue; handler `0461b2bd`
//     (slot 5, correction 5) and `Escape Pick Session` {41EE76F1} (slot 7);
//   - `Escape Pick Session` {45AF19B0} (handler 0461b2b3);
//   - the command-state notification relay `0461b2c7` (`XYZ Transform `).
// What a tool class does interactively is out of scope: a class is a pair of `on` / `off` callbacks that the command
// layer (src/commands/toolsB16a.ts) fills with this build's viewport tools. Parts the notes leave open are marked
// `// inferred` and kept overridable.

export const GUID_NULL = '00000000-0000-0000-0000-000000000000';
export const S_OK = 0, S_FALSE = 1, E_FAIL = 0x80004005, E_INVALIDARG = 0x80070057;
const failed = (hr: number) => hr >= 0x80000000;

/** Canonical form of a class / command GUID: lower case, no braces. Empty / null / undefined = GUID_NULL. */
export function normGuid(v: unknown): string {
  if (v === undefined || v === null || v === '') return GUID_NULL;
  return String(v).trim().replace(/^\{|\}$/g, '').toLowerCase();
}
/** Registry spelling of a GUID: `{XXXXXXXX-...}` upper case (data/commands_full.json). */
export const braceGuid = (g: string) => `{${normGuid(g).toUpperCase()}}`;

/** Classes the handlers name (B16a §3.3, §3.4; B17i constants). */
export const CLS = {
  select: '11778840-8c5c-11d1-84b5-00aa00135f7b',
  translate: '3a711ff0-8798-11d1-84b1-00aa00135f7b',
  rotate: 'ecbad3a0-974b-11d1-84bf-00aa00135f7b',
  scale: 'f500bd80-974b-11d1-84bf-00aa00135f7b',
  manipulate: '36ad0600-98dc-11d1-84bf-00aa00135f7b',
  navigation: '988e8c81-0a1f-11d3-bfe4-00a0248f9397',
  navigation3dsMax: 'a31f01db-e282-4d0a-8a62-3d36a544da7a',
  /** toolmanager.dll's own tool class: the nil tool (B17i). */
  toolmanagerTool: 'd97e3888-012c-11d6-a2e3-08003658d403',
  mayaZoom: '462d51a8-dc72-46e9-ad70-afbf3cf87835',
  pickSession: 'cf80cbc3-984e-11d1-96e7-00a024191bac',
  doNothing: '2b2ffb2e-5987-11d2-8411-00a0c961747d',
} as const;
/** Command GUIDs the dispatcher uses (B17i constants). */
export const CMD = {
  escape1: '45af19b0-e8d8-11d0-96c1-00a024191bac',
  escape2: '41ee76f1-99cd-11d1-8049-00a0243e2717',
  /** Default sticky command class of the dispatcher = `Object Select Tool` (ActivateObjectSelTool). */
  defaultSticky: 'ba315211-9be1-11d0-b6d6-00aa0068bf56',
} as const;
export const SRT: ReadonlySet<string> = new Set<string>([CLS.translate, CLS.rotate, CLS.scale]);
/** B16a §3.4: never recorded as the last auxiliary tool. */
export const LAST_AUX_EXCLUDED: ReadonlySet<string> = new Set<string>([
  CLS.select, CLS.translate, CLS.rotate, CLS.scale, CLS.manipulate, CLS.navigation, CLS.navigation3dsMax, CLS.toolmanagerTool,
]);
/** B16a §5: the only accepted `Property` values of the notification relay. */
export const COMMAND_STATE_EVENTS = [
  'SI3D_SUPRA_COMMAND_ACTIVATED', 'SI3D_SUPRA_COMMAND_DEACTIVATED', 'SI3D_STICKY_COMMAND_ACTIVATED',
  'SI3D_STICKY_COMMAND_DEACTIVATED', 'SI3D_COMMAND_EXECUTED',
] as const;

/** Exec-context words (B17i Q6): A = invocation flags (0x4 key, 0x2 down, 0x1 auto-repeat), B = modifier flags
 *  (0x10 restart). A script / menu call has A = B = 0 (inferred). */
export interface ToolExecContext { A: number; B: number; /** the command's arguments, handed to the class body */ args?: Record<string, any> }
export const KEY = 0x4, KEY_DOWN = 0x2, REPEAT = 0x1, RESTART = 0x10;

/** Tool modes (B17i Q2): 0 not yet given a mode, 1 sticky, 2 supra / held, 4 dispatcher sticky session, 6 set at key-up
 *  while locked, 7 dispatcher supra session. */
export const MODE = { none: 0, sticky: 1, held: 2, sessionSticky: 4, keyUpLocked: 6, sessionSupra: 7 } as const;

/** One tool class this build can create. */
export interface ToolClass {
  clsid: string;
  label: string;
  /** Category GUID of the tool's channel. Default category (GUID_NULL) unless set; B17i Q1 read it for Dolly. */
  category?: string;
  /** Switch the tool on (the class's interactive part). */
  on(ctx: ToolExecContext): void;
  /** Switch it off. */
  off(): void;
  /** Whether this build's UI still runs the tool (a viewport tool can be left with Esc outside the manager). inferred. */
  live?(): boolean;
}

/** A tool record of a channel (B17i: record +0x198 mode, +0x190 activation time). */
export interface ToolRecord { clsid: string; mode: number; time: number }
export interface Channel {
  cat: string;
  cur: ToolRecord | null;
  /** Earlier tool records, most recent last (+0x38). */
  history: ToolRecord[];
  /** Fallback class activated when the default channel becomes empty (+0x250, "+0x90 tool"). */
  fallback: string;
  /** +0x214: set during an interaction (inferred); the state query then reports 5. Nothing in this build sets it. */
  locked: boolean;
  /** +0x210: the deactivate path records the last auxiliary tool when 1. Who sets it was not read; off by default. */
  recordOnDeactivate: boolean;
}
export interface CommandToolSession { cmdId: string; clsid: string }
export interface ToolTraceEntry { op: string; clsid: string; detail?: any }

export interface ToolManagerHost {
  /** Boolean preference Interaction.<name>. */
  pref(name: 'stickytoggle' | 'stickykeys' | 'niltool'): boolean;
  /** Interaction.stickytime in seconds (C3DPrefsInteraction default 0.25). */
  stickyTime?(): number;
  /** The class that reflects the UI's base tool when the stored current tool is no longer live. inferred. */
  idle?(): string | null;
  /** Fire a command-state notification. */
  notify?(event: string, args: string[]): void;
  /** "not yet attested" log for open branches. */
  nya?(what: string): void;
  /** Dispatcher veto object (host +0x120 slot 14): true cancels a session start silently. Not read; none by default. */
  veto?(cmdId: string, clsid: string): boolean;
  /** Restart the dispatcher's default sticky command class (run that command). */
  restartDefaultSticky?(cmdId: string): void;
  /** Clear the status bar / cursor after a session ended with nothing to return to. */
  clearStatus?(): void;
  /** Step 3 of the dispatcher escape: tell the host / restore the normal tool (meaning inferred). */
  restoreNormalTool?(): void;
  /** Clock in milliseconds (activation times, eligibility). */
  now?(): number;
}

export class ToolManager {
  readonly classes = new Map<string, ToolClass>();
  readonly channels = new Map<string, Channel>();
  private lastAux = new Map<string, string>();
  /** Test seams: tool state / eligibility overrides per class (S value / eligible). Empty in normal use. */
  readonly stateOverride = new Map<string, number>();
  readonly eligibleOverride = new Map<string, boolean>();
  // ---- command-tool dispatcher 7c037c30 (B17i Q5)
  /** Sticky session (+0xa8 command id, +0x88 tool handle). */
  sticky: CommandToolSession | null = null;
  /** Supra (key-held) session (+0xb8 command id, +0x80 handle). */
  supra: CommandToolSession | null = null;
  /** Commands that arrived while a supra session was held (+0xe8). */
  readonly queue: CommandToolSession[] = [];
  escapingSupra = false;
  escapingSticky = false;
  /** "Return to default" flag: ending the sticky session by escape clears status instead of restarting the default
   *  sticky class. Who sets it was not read; off by default (inferred). */
  returnToDefault = false;
  /** +0xa0: escape fires SI3D_COMMAND_EXECUTED after ending the sticky session. Setter not read; on (inferred from
   *  correction 7 "fires SI3D_COMMAND_EXECUTED … when nothing remains"). */
  executedAfterSticky = true;
  /** +0x9c "tap" flag and +0x98 flag of the supra end path; setters not read, off by default. */
  tapFlag = false;
  flag98 = false;
  readonly notifications: { event: string; args: string[] }[] = [];
  readonly trace: ToolTraceEntry[] = [];
  private depth = 0;

  constructor(readonly host: ToolManagerHost) {
    this.channels.set(GUID_NULL, ToolManager.newChannel(GUID_NULL)); // the default channel
  }
  private static newChannel(cat: string): Channel { return { cat, cur: null, history: [], fallback: GUID_NULL, locked: false, recordOnDeactivate: false }; }
  private now() { return this.host.now?.() ?? (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  addClass(c: ToolClass) { this.classes.set(normGuid(c.clsid), { ...c, clsid: normGuid(c.clsid) }); }

  // ------------------------------------------------------------------ manager methods
  /** Category of a class; an uncreatable class reports GUID_NULL (B16a §2). */
  categoryOf(clsid: string): string { return normGuid(this.classes.get(normGuid(clsid))?.category ?? GUID_NULL); }
  /** The channel of a category; channels other than the default one appear with their first tool (inferred). */
  channelOf(cat: string, create = false): Channel | undefined {
    const k = normGuid(cat); let c = this.channels.get(k);
    if (!c && create) { c = ToolManager.newChannel(k); this.channels.set(k, c); }
    return c;
  }
  /** +0x28: the current tool class of a category (null = none). The default channel is kept in step with the UI's base
   *  tool when its tool was left outside the manager (inferred), and is never left empty (fallback / nil tool). */
  current(cat = GUID_NULL): string | null {
    const ch = this.channelOf(cat); if (!ch) return null;
    if (ch.cur) { const k = this.classes.get(ch.cur.clsid); if (k?.live && !k.live()) ch.cur = null; } // inferred: left outside the manager
    if (!ch.cur && ch.cat === GUID_NULL && this.depth === 0) {
      const idle = normGuid(this.host.idle?.() ?? null);
      if (idle !== GUID_NULL && this.classes.has(idle)) ch.cur = { clsid: idle, mode: MODE.sticky, time: -Infinity };
      else this.activateFallback(ch, { A: 0, B: 0 });
    }
    return ch.cur?.clsid ?? null;
  }
  /** Current tool record of the default channel. */
  currentRecord(cat = GUID_NULL): ToolRecord | null { this.current(cat); return this.channelOf(cat)?.cur ?? null; }
  /** +0x38: 0 = the class is current, 1 = it is not. */
  isCurrent(clsid: string): 0 | 1 { return this.current(this.categoryOf(clsid)) === normGuid(clsid) ? 0 : 1; }
  /** +0x20 (channel slot 0x68, B17i Q2): the mode of the channel's current tool, whatever class is asked.
   *  No channel = E_FAIL; no current tool = S_FALSE, S 0; channel locked = S 5. */
  toolState(clsid: string): { hr: number; S: number } {
    const c = normGuid(clsid);
    if (this.stateOverride.has(c)) return { hr: S_OK, S: this.stateOverride.get(c)! };
    const cat = this.categoryOf(c); const ch = this.channelOf(cat);
    if (!ch) return { hr: E_FAIL, S: 0 };
    this.current(cat);
    if (!ch.cur) return { hr: S_FALSE, S: 0 };
    if (ch.locked) return { hr: S_OK, S: 5 };
    return { hr: S_OK, S: ch.cur.mode };
  }
  /** +0xa8 (channel slot 0x100, B17i Q2): S_OK when the class is the current tool and it is held (mode 2 or 6, or
   *  activated at least Interaction.stickytime seconds ago: a mode 0 is then promoted to 2); otherwise S_FALSE. */
  eligible(clsid: string): number {
    const c = normGuid(clsid);
    if (this.eligibleOverride.has(c)) return this.eligibleOverride.get(c) ? S_OK : S_FALSE;
    const cat = this.categoryOf(c); const ch = this.channelOf(cat);
    if (!ch) return S_FALSE;
    this.current(cat);
    const r = ch.cur; if (!r || r.clsid !== c) return S_FALSE;
    if (r.mode === MODE.held || r.mode === MODE.keyUpLocked) return S_OK;
    const t = this.host.stickyTime?.() ?? 0.25;
    if ((this.now() - r.time) / 1000 >= t) { if (r.mode === MODE.none) r.mode = MODE.held; return S_OK; }
    return S_FALSE;
  }
  /** +0x88 (channel slot 0x88): make a class the current tool of its channel. The tool that was current is switched off
   *  and kept in the channel's history. An uncreatable class has no effect (S_FALSE, no error; B16a §2). */
  activate(clsid: string, ctx: ToolExecContext): number {
    const c = normGuid(clsid); const k = this.classes.get(c);
    if (!k) { this.trace.push({ op: 'activate-uncreatable', clsid: c }); return S_FALSE; }
    const cat = this.categoryOf(c); const ch = this.channelOf(cat, true)!;
    if (ch.cur) { const pk = this.classes.get(ch.cur.clsid); if (pk?.live && !pk.live()) ch.cur = null; } // left outside the manager
    const prev = ch.cur;
    if (prev && prev.clsid !== c) {
      this.classes.get(prev.clsid)?.off();
      ch.history = ch.history.filter(r => r.clsid !== prev.clsid);
      ch.history.push(prev);
      if (ch.history.length > 16) ch.history.shift(); // inferred bound
    }
    ch.history = ch.history.filter(r => r.clsid !== c);
    ch.cur = { clsid: c, mode: MODE.none, time: this.now() };
    this.trace.push({ op: 'activate', clsid: c });
    this.depth++;
    try { k.on(ctx); } finally { this.depth--; }
    return S_OK;
  }
  /** +0x68 (channel slot 0xb0): set the mode of the current tool of the class's channel. */
  setMode(m: number, clsid: string = GUID_NULL) { const ch = this.channelOf(this.categoryOf(clsid)); if (ch?.cur) ch.cur.mode = m; }
  /** Mode of the default channel's current tool (0 when none). */
  get mode(): number { return this.channelOf(GUID_NULL)?.cur?.mode ?? 0; }
  set mode(m: number) { this.setMode(m); }
  /** +0x90 (channel slot 0xb8): store the fallback class; while the channel is empty it is activated at once. */
  setFallback(cat: string, clsid: string): number {
    const ch = this.channelOf(cat); if (!ch) return E_FAIL;
    ch.fallback = normGuid(clsid);
    this.trace.push({ op: 'fallback', clsid: ch.fallback });
    if (!ch.cur) this.activateFallback(ch, { A: 0, B: 0 });
    return S_OK;
  }
  fallback(cat = GUID_NULL): string { return this.channelOf(cat)?.fallback ?? GUID_NULL; }
  /** Default / fallback activation: the stored fallback class, or the nil tool when none is stored or (default channel)
   *  Interaction.niltool is on; then mode 1. */
  private activateFallback(ch: Channel, ctx: ToolExecContext) {
    let c = ch.fallback;
    if (c === GUID_NULL || (ch.cat === GUID_NULL && this.host.pref('niltool'))) c = CLS.toolmanagerTool;
    if (!this.classes.has(c)) c = CLS.toolmanagerTool;
    if (!this.classes.has(c) || this.depth > 4) return;
    this.trace.push({ op: 'fallback-activate', clsid: c });
    if (this.activate(c, ctx) === S_OK) this.setMode(MODE.sticky, c);
  }
  /** Remove the channel's current tool: the previous tool of the history becomes current again, else (default channel)
   *  the fallback / nil tool (B17i Q4 c, d). */
  private dropCurrent(ch: Channel, ctx: ToolExecContext) {
    const rec = ch.cur; if (!rec) return;
    this.classes.get(rec.clsid)?.off();
    ch.cur = null;
    this.trace.push({ op: 'deactivate', clsid: rec.clsid });
    while (ch.history.length && this.depth < 4) {
      const r = ch.history.pop()!; const k = this.classes.get(r.clsid);
      if (!k || r.clsid === rec.clsid) continue;
      ch.cur = r; this.trace.push({ op: 'restore', clsid: r.clsid });
      this.depth++; try { k.on(ctx); } finally { this.depth--; }
      break;
    }
    if (!ch.cur && ch.cat === GUID_NULL) this.activateFallback(ch, ctx);
  }
  /** +0x50 (channel slot 0x98, B17i Q4): deactivate the current tool of the class's channel. (a) default channel with
   *  a dispatcher session: escape the session instead; (b) record the last auxiliary tool when the channel's +0x210 flag
   *  is set; (c) previous tool from history; (d) fallback, then nil tool. No channel = S_FALSE. */
  deactivate(clsid: string, ctx: ToolExecContext = { A: 0, B: 0 }): number {
    const cat = this.categoryOf(clsid); const ch = this.channelOf(cat);
    if (!ch) return S_FALSE;
    if (cat === GUID_NULL && this.hasSession()) { this.trace.push({ op: 'deactivate-escapes-session', clsid: normGuid(clsid) }); this.escapeSessions(); return S_OK; }
    this.current(cat);
    const rec = ch.cur; if (!rec) return S_FALSE;
    if (cat === GUID_NULL && ch.recordOnDeactivate && !LAST_AUX_EXCLUDED.has(rec.clsid)) this.recordLastAux(GUID_NULL, rec.clsid);
    this.dropCurrent(ch, ctx);
    return S_OK;
  }
  /** +0xf0 / +0xf8. */
  recordLastAux(cat: string, clsid: string) { this.lastAux.set(normGuid(cat), normGuid(clsid)); }
  getLastAux(cat = GUID_NULL): string { return this.lastAux.get(normGuid(cat)) ?? GUID_NULL; }

  // ------------------------------------------------------------------ handler 0461b2c6 (B16a §3, B17i corrections 1–3)
  /** UnPackArg (§3.1): GUID_NULL becomes the recorded last auxiliary tool of the default category. */
  unpackClsid(arg: unknown): string { const c = normGuid(arg); return c === GUID_NULL ? this.getLastAux(GUID_NULL) : c; }

  /** UnPackArg + Do of the activate-tool handler. Returns S_OK (inferred). */
  activateTool(clsidArg: unknown, ctx: ToolExecContext = { A: 0, B: 0 }): number {
    const c = this.unpackClsid(clsidArg);
    if (c === GUID_NULL) { this.trace.push({ op: 'noop-null', clsid: c }); return S_OK; }
    const cur = this.isCurrent(c) === 0;
    if (!(ctx.A & KEY)) { // plain invocation
      if (!cur) {
        if (this.activateHelper(c, ctx) === S_OK) { this.recordAfterActivation(c); this.setMode(MODE.sticky, c); }
        return S_OK;
      }
      const restart = !!(ctx.B & RESTART);
      if (!this.host.pref('stickytoggle') && !restart) { this.trace.push({ op: 'noop-current', clsid: c }); return S_OK; }
      this.deactivate(c, ctx);
      if (restart && this.activateHelper(c, ctx) === S_OK) this.setMode(MODE.sticky, c); // the recorder is not run here
      return S_OK;
    }
    if (ctx.A & KEY_DOWN) { // key-down: supra activation
      if (cur) return S_OK;
      if (this.activateHelper(c, ctx) !== S_OK) return S_OK;
      const sticky = this.host.pref('stickykeys');
      if (!sticky && SRT.has(c)) return S_OK;
      if (sticky && c !== CLS.mayaZoom) return S_OK;
      this.setMode(MODE.held, c);
      return S_OK;
    }
    // key-up (correction 2): sticky when the key was released before Interaction.stickytime
    if (!cur) return S_OK;
    const { S } = this.toolState(c);
    if (S === 0 && this.eligible(c) !== S_OK) { this.recordAfterActivation(c); this.setMode(MODE.sticky, c); return S_OK; }
    this.setFallback(GUID_NULL, CLS.select); // correction 1: the selection tool, not GUID_NULL
    if (S === 5) this.setMode(MODE.keyUpLocked, c);
    else if (this.host.pref('stickytoggle') || S !== 1) this.deactivate(c, ctx);
    return S_OK;
  }
  /** Activation helper (B16a §3.3 with corrections 1 and 3). */
  private activateHelper(c: string, ctx: ToolExecContext): number {
    const { hr, S } = this.toolState(c);
    if (failed(hr)) return hr;
    // correction 3: refused when the channel's current tool has mode 0, or the class is current and held
    if (c !== CLS.pickSession && hr === S_OK && (S === 0 || this.eligible(c) === S_OK)) { this.trace.push({ op: 'refused', clsid: c, detail: S }); return S_FALSE; }
    if (S === 1) { // SRT-memory step: the current SRT tool, else the selection tool (correction 1)
      const d = this.current(GUID_NULL);
      this.setFallback(GUID_NULL, d && SRT.has(d) ? d : CLS.select);
    }
    return this.activate(c, ctx);
  }
  /** Last auxiliary tool recorder (B16a §3.4). */
  private recordAfterActivation(c: string) {
    if (this.categoryOf(c) !== GUID_NULL) return;
    const d = this.current(GUID_NULL);
    if (d && !LAST_AUX_EXCLUDED.has(d)) this.recordLastAux(GUID_NULL, d);
  }

  // ------------------------------------------------------------------ Escape Pick Session {45AF19B0} (handler 0461b2b3)
  /** Deactivate the current default tool; after Translate / Rotate / Scale the selection tool is stored as the fallback
   *  first. A default channel without a tool = E_FAIL, nothing changed. */
  escapeTool(): number {
    const ch = this.channelOf(GUID_NULL)!;
    const d = this.current(GUID_NULL);
    if (!d || !ch.cur) return E_FAIL;
    if (SRT.has(d)) this.setFallback(GUID_NULL, CLS.select);
    this.deactivate(GUID_NULL);
    return S_OK;
  }

  // ------------------------------------------------------------------ dispatcher 7c037c30 (B17i Q5)
  hasSession() { return !!(this.supra || this.sticky); }
  private fire(event: string, cmdId: string) {
    const args = [braceGuid(cmdId)];
    this.notifications.push({ event, args });
    this.host.notify?.(event, args);
  }
  /** +0xe0: make the session's tool live (activate its class on its channel), then the session mode. */
  private makeLive(s: CommandToolSession, mode: number) {
    if (!this.classes.has(s.clsid)) return;
    if (this.current(this.categoryOf(s.clsid)) !== s.clsid) this.activate(s.clsid, { A: 0, B: 0 });
    this.setMode(mode, s.clsid);
  }
  /** The session's tool leaves its channel (previous tool from history; inferred: the dispatcher's tool handle release). */
  private releaseTool(s: CommandToolSession) {
    const ch = this.channelOf(this.categoryOf(s.clsid));
    if (ch?.cur?.clsid === s.clsid) this.dropCurrent(ch, { A: 0, B: 0 });
  }
  /** +0x90: start the supra session. */
  private startSupra(cmdId: string, clsid: string): number {
    if (cmdId === GUID_NULL) return E_INVALIDARG;
    if (clsid === GUID_NULL) return E_FAIL;
    this.supra = { cmdId, clsid };
    this.trace.push({ op: 'supra-start', clsid, detail: cmdId });
    this.fire('SI3D_SUPRA_COMMAND_ACTIVATED', cmdId);
    this.makeLive(this.supra, MODE.sessionSupra);
    return S_OK;
  }
  /** +0x80: start the sticky session. */
  private startSticky(cmdId: string, clsid: string): number {
    if (cmdId === GUID_NULL) return E_INVALIDARG;
    if (clsid === GUID_NULL) return E_FAIL;
    this.sticky = { cmdId, clsid };
    this.trace.push({ op: 'sticky-start', clsid, detail: cmdId });
    this.fire('SI3D_STICKY_COMMAND_ACTIVATED', cmdId);
    this.makeLive(this.sticky, MODE.sessionSticky);
    return S_OK;
  }
  /** +0x88: end the sticky session (no restart). */
  private endStickyPlain() {
    const s = this.sticky; if (!s) return;
    this.sticky = null;
    this.trace.push({ op: 'sticky-end', clsid: s.clsid, detail: s.cmdId });
    this.fire('SI3D_STICKY_COMMAND_DEACTIVATED', s.cmdId);
    this.releaseTool(s);
  }
  /** End the supra session: then the sticky session is announced again and its tool made current, or the status / cursor
   *  is cleared when there is none. */
  endSupra(): number {
    const s = this.supra; if (!s) return S_FALSE;
    this.supra = null;
    this.trace.push({ op: 'supra-end', clsid: s.clsid, detail: s.cmdId });
    this.fire('SI3D_SUPRA_COMMAND_DEACTIVATED', s.cmdId);
    this.releaseTool(s);
    if (this.sticky) { this.fire('SI3D_STICKY_COMMAND_ACTIVATED', this.sticky.cmdId); this.makeLive(this.sticky, MODE.sessionSticky); }
    else this.host.clearStatus?.();
    return S_OK;
  }
  /** End the sticky session by escape: then clear status (return-to-default flag) or restart the default sticky class. */
  endStickyEscape(): number {
    if (!this.sticky) return S_FALSE;
    this.endStickyPlain();
    if (this.returnToDefault) this.host.clearStatus?.();
    else { this.trace.push({ op: 'default-sticky', clsid: GUID_NULL, detail: CMD.defaultSticky }); this.host.restartDefaultSticky?.(CMD.defaultSticky); }
    return S_OK;
  }
  /** Dispatcher slot 6, used by deactivate (Q4 a): end the supra session if held, else the sticky one (inferred: the
   *  escape of slot 7 without its notifications). */
  escapeSessions(): number { return this.supra ? this.endSupra() : this.sticky ? this.endStickyEscape() : S_FALSE; }

  /** Handler 0461b2bd Do = dispatcher slot 5 with (the command's CmdID, word A, Clsid) (B17i Q5, correction 5). */
  commandToolSession(cmdId: string, A: number, clsid: unknown): number {
    const id = normGuid(cmdId), c = normGuid(clsid);
    if (A & KEY_DOWN) {
      if (this.supra) { this.queue.push({ cmdId: id, clsid: c }); this.trace.push({ op: 'session-queued', clsid: c, detail: id }); return S_OK; }
      if (!this.sticky && this.host.veto?.(id, c)) { this.trace.push({ op: 'session-vetoed', clsid: c, detail: id }); return S_OK; }
      return this.startSupra(id, c);
    }
    if (A & REPEAT) return S_OK; // auto-repeat: nothing
    // A bits 0x2 and 0x1 clear: key-up, or a script / menu call (A = 0)
    const qi = this.queue.findIndex(q => q.cmdId === id);
    if (qi >= 0) { this.queue.splice(qi, 1); this.trace.push({ op: 'session-unqueued', clsid: c, detail: id }); return S_OK; }
    if (this.supra) {
      if (this.supra.cmdId !== id) { this.trace.push({ op: 'session-other-held', clsid: c, detail: id }); return S_OK; } // inferred: another command is held
      const { S } = this.toolState(this.supra.clsid);
      if (S === 0 && this.tapFlag) {
        if (this.supra.cmdId === this.sticky?.cmdId && this.flag98) { this.endSupra(); this.endStickyEscape(); return S_OK; }
        // +0xb0 convert: inferred: the tapped supra session becomes the sticky session
        const s = this.supra; this.supra = null;
        this.fire('SI3D_SUPRA_COMMAND_DEACTIVATED', s.cmdId);
        if (this.sticky) this.endStickyPlain();
        return this.startSticky(s.cmdId, s.clsid);
      }
      return this.endSupra();
    }
    if (this.sticky?.cmdId === id) { this.trace.push({ op: 'session-already-sticky', clsid: c, detail: id }); return S_OK; }
    if (this.sticky) this.endStickyPlain();
    return this.startSticky(id, c);
  }

  /** `Escape Pick Session` {41EE76F1} = dispatcher slot 7 (B17i contract). */
  escapePickSession(): number {
    let hr = S_OK;
    if (this.supra) {
      this.escapingSupra = true;
      try { hr = this.endSupra(); } finally { this.escapingSupra = false; }
      if (hr === S_OK && !this.sticky) this.fire('SI3D_COMMAND_EXECUTED', CMD.escape2);
    } else if (this.sticky) {
      this.escapingSticky = true;
      try { hr = this.endStickyEscape(); } finally { this.escapingSticky = false; }
      if (hr === S_OK && this.executedAfterSticky) this.fire('SI3D_COMMAND_EXECUTED', CMD.escape2);
    }
    if (!this.supra && !this.sticky) this.host.restoreNormalTool?.();
    return hr;
  }

  // ------------------------------------------------------------------ handler 0461b2c7 (B16a §5)
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

// ====================================================================== manipulator manager 291f2030 (manipmgr.dll)
/** The manipulator manager singleton the two manipmgr.dll handlers query (B17i). Its step (slot 9) and the meaning of
 *  its setting were not read: `step` is supplied by the host; without one the manager cannot step (S_FALSE). */
export interface ManipulatorManagerHost {
  /** Slot 9: step to the next (+1) / previous (-1) manipulator. S_FALSE = could not step. */
  step?(dir: 1 | -1): number;
  /** Slot 8 / 7: the 8-byte setting as two 32-bit fields. */
  getSetting(): [number, number];
  setSetting(v: [number, number]): void;
}
