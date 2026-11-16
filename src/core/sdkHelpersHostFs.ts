// CMD-01b support: the session's VIRTUAL host file system.
//
// AfterImage runs in a browser / Electron renderer with no file-system bridge, so the SDK helper commands
// that create folders, list files or package add-ons (docs/ghidra/cmd-01b-sdk-helpers.md) work against this
// in-memory tree instead of the disk. Nothing here touches a real disk; real disk access is a later ledger row.
//
// Model: Windows-style paths. `\` is the separator (`/` is accepted and converted), names compare
// case-insensitively and keep the spelling they were created with, a path is rooted at a drive (`C:\`) or a
// UNC share (`\\server\share`). Files of a folder enumerate in creation order (the Windows enumeration order
// is open question Q7 of the note).
//
// Original code; no Softimage code involved.

export const HOSTFS_SEP = '\\';

interface Entry { name: string; folder: boolean; text?: string; children?: Map<string, Entry> }

/** Error with a `description`, like the script-visible error objects of the Windows file-system object. */
export class HostFsError extends Error {
  description: string;
  constructor(description: string) { super(description); this.name = 'HostFsError'; this.description = description; }
}

const ILLEGAL = /[<>:"|?*\u0000-\u001f]/;

export class HostFs {
  private roots = new Map<string, Entry>();

  /** Split into [root, ...names]; throws when the path has no drive / share root or an illegal name. */
  private parts(path: unknown): string[] {
    const s = String(path ?? '').replace(/\//g, HOSTFS_SEP);
    let root: string, rest: string;
    const drive = /^([A-Za-z]:)(\\|$)/.exec(s);
    const unc = /^\\\\([^\\]+)\\([^\\]+)(\\|$)/.exec(s);
    if (drive) { root = drive[1]; rest = s.slice(drive[0].length); }
    else if (unc) { root = `\\\\${unc[1]}\\${unc[2]}`; rest = s.slice(unc[0].length); }
    else throw new HostFsError(s === '' ? 'Path not found' : `Invalid path '${s}'`);
    const names = rest.split(HOSTFS_SEP).filter(n => n !== '' && n !== '.');
    for (const n of names) if (ILLEGAL.test(n) || n === '..') throw new HostFsError(`Invalid path '${s}'`);
    return [root, ...names];
  }
  private lookup(path: unknown): Entry | undefined {
    let parts: string[]; try { parts = this.parts(path); } catch { return undefined; }
    let e = this.roots.get(parts[0].toLowerCase());
    for (let i = 1; e && i < parts.length; i++) e = e.children?.get(parts[i].toLowerCase());
    return e;
  }

  /** Separator-normalised spelling of a path, without a trailing separator (except a bare drive root `C:\`). */
  normalize(path: unknown): string {
    const p = this.parts(path);
    return p.length === 1 ? (/^[A-Za-z]:$/.test(p[0]) ? p[0] + HOSTFS_SEP : p[0]) : p.join(HOSTFS_SEP);
  }
  /** Join with exactly one separator between the two parts. */
  join(a: unknown, b: unknown): string {
    const l = String(a ?? ''), r = String(b ?? '');
    if (l === '') return r; if (r === '') return l;
    return l.replace(/[\\/]+$/, '') + HOSTFS_SEP + r.replace(/^[\\/]+/, '');
  }
  /** Last path component (the folder's or file's own name). */
  baseName(path: unknown): string { const s = String(path ?? '').replace(/[\\/]+$/, ''); return s.slice(Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/')) + 1); }
  /** Path of the containing folder, '' when there is none. */
  parentPath(path: unknown): string {
    const s = String(path ?? '').replace(/[\\/]+$/, ''); const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
    if (i < 0) return ''; const p = s.slice(0, i); return /^[A-Za-z]:$/.test(p) ? p + HOSTFS_SEP : p;
  }

  exists(path: unknown): boolean { return !!this.lookup(path); }
  isFolder(path: unknown): boolean { return !!this.lookup(path)?.folder; }
  isFile(path: unknown): boolean { const e = this.lookup(path); return !!e && !e.folder; }

  /** Create the folder and any missing parents. Existing folders are left alone. */
  ensureFolder(path: unknown): void {
    const parts = this.parts(path);
    let e = this.roots.get(parts[0].toLowerCase());
    if (!e) { e = { name: parts[0], folder: true, children: new Map() }; this.roots.set(parts[0].toLowerCase(), e); }
    for (let i = 1; i < parts.length; i++) {
      let c: Entry | undefined = e.children!.get(parts[i].toLowerCase());
      if (!c) { c = { name: parts[i], folder: true, children: new Map() }; e.children!.set(parts[i].toLowerCase(), c); }
      else if (!c.folder) throw new HostFsError(`Cannot create a folder: a file named '${parts.slice(0, i + 1).join(HOSTFS_SEP)}' already exists`);
      e = c;
    }
  }
  private folder(path: unknown): Entry {
    const e = this.lookup(path);
    if (!e || !e.folder) throw new HostFsError('Path not found');
    return e;
  }
  /** Names of the files directly in a folder, in creation order. Throws when the folder cannot be opened. */
  listFiles(path: unknown): string[] { return [...this.folder(path).children!.values()].filter(c => !c.folder).map(c => c.name); }
  /** Names of the sub-folders directly in a folder, in creation order. */
  listFolders(path: unknown): string[] { return [...this.folder(path).children!.values()].filter(c => c.folder).map(c => c.name); }

  /** Write a text file; the containing folder must exist. */
  writeFile(path: unknown, text: string): void {
    const parts = this.parts(path);
    if (parts.length < 2) throw new HostFsError('Path not found');
    const dir = this.folder(parts.slice(0, -1).join(HOSTFS_SEP) + (parts.length === 2 ? HOSTFS_SEP : ''));
    const key = parts[parts.length - 1].toLowerCase(); const old = dir.children!.get(key);
    if (old?.folder) throw new HostFsError('Permission denied');
    if (old) old.text = String(text); else dir.children!.set(key, { name: parts[parts.length - 1], folder: false, text: String(text) });
  }
  readFile(path: unknown): string {
    const e = this.lookup(path);
    if (!e || e.folder) throw new HostFsError('File not found');
    return e.text ?? '';
  }
  deleteFile(path: unknown): void {
    const parts = this.parts(path);
    const e = this.lookup(path);
    if (!e || e.folder || parts.length < 2) throw new HostFsError('File not found');
    this.folder(parts.slice(0, -1).join(HOSTFS_SEP) + (parts.length === 2 ? HOSTFS_SEP : '')).children!.delete(parts[parts.length - 1].toLowerCase());
  }
  /** Remove a folder and everything below it (test / housekeeping helper). */
  deleteFolder(path: unknown): void {
    const parts = this.parts(path);
    if (!this.isFolder(path)) throw new HostFsError('Path not found');
    if (parts.length === 1) { this.roots.delete(parts[0].toLowerCase()); return; }
    this.folder(parts.slice(0, -1).join(HOSTFS_SEP) + (parts.length === 2 ? HOSTFS_SEP : '')).children!.delete(parts[parts.length - 1].toLowerCase());
  }
  /** Every folder path below (and excluding) `path`, depth first, relative, `\`-separated: for tree compares. */
  tree(path: unknown): string[] {
    const out: string[] = [];
    const walk = (e: Entry, rel: string) => { for (const c of e.children!.values()) if (c.folder) { const r = rel ? rel + HOSTFS_SEP + c.name : c.name; out.push(r); walk(c, r); } };
    walk(this.folder(path), '');
    return out;
  }
}

/** The one virtual host file system of the session. */
export const hostFs = new HostFs();
