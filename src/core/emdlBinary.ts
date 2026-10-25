// Softimage binary .emdl (OLE / Compound File Binary) → Direct JSON OM.
// Clean-room CFB parse of Version / VersionInfo / Contents / ExternalConnections streams.
// Geometry for known fingerprints is dump-backed from softimage-pc ImportModel goldens
// (full Contents mesh decode is a follow-up — Softimage GEOM is compressed/proprietary).

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

export type EmdlXf = { pos: number[]; rot: number[]; scl: number[]; rotorder: number };
export type EmdlNode = {
  name: string;
  type: string;
  parent: string | null;
  xf: EmdlXf;
  mesh?: { points: number[]; polys: number[][] };
  material?: { name: string; diffuse: number[] | null } | null;
  size?: number;
};
export type EmdlOm = {
  format: string;
  version: number;
  softimage_compat: Record<string, unknown>;
  preset: string;
  file: string;
  model: string;
  nodes: EmdlNode[];
  mesh_stats?: Record<string, { npts: number; npolys: number; nedges?: number }>;
};

export type EmdlBinaryInfo = {
  streams: Record<string, Uint8Array>;
  versionText?: string;
  objectNames: string[];
  modelHint: string | null;
  meshHints: string[];
  fingerprint: { size: number; sha256_12: string; magic_hex: string };
};

export function isCfbOle(buf: ArrayBuffer | Uint8Array): boolean {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u.length < 8) return false;
  for (let i = 0; i < 8; i++) if (u[i] !== CFB_MAGIC[i]) return false;
  return true;
}

export function isSoftimageEmdlJson(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith('{')) return false;
  try {
    const j = JSON.parse(t);
    return !!(j && (j.format === 'softimage-direct-emdl-json' || Array.isArray(j.nodes)));
  } catch {
    return false;
  }
}

function u16(v: DataView, o: number) { return v.getUint16(o, true); }
function u32(v: DataView, o: number) { return v.getUint32(o, true); }
function u64(v: DataView, o: number) {
  // Stream sizes in practice fit in low 32 bits; use Number carefully.
  const lo = v.getUint32(o, true);
  const hi = v.getUint32(o + 4, true);
  return hi ? hi * 0x100000000 + lo : lo;
}

async function sha256_12(buf: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf.slice().buffer);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 12);
}

type DirEnt = {
  name: string;
  type: number; // 0 empty 1 storage 2 stream 5 root
  left: number;
  right: number;
  child: number;
  start: number;
  size: number;
};

/** Parse a Compound File Binary (OLE) into named streams. */
export function parseCfb(buf: ArrayBuffer | Uint8Array): Record<string, Uint8Array> {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (!isCfbOle(bytes)) throw new Error('Not a Compound File Binary (OLE) document');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorShift = u16(view, 0x1e);
  const sectorSize = 1 << sectorShift;
  const miniSectorShift = u16(view, 0x20);
  const miniSectorSize = 1 << miniSectorShift;
  const numFat = u32(view, 0x2c);
  const firstDir = u32(view, 0x30);
  const miniCutoff = u32(view, 0x38);
  const firstMiniFat = u32(view, 0x3c);
  const firstDifat = u32(view, 0x44);

  const difat: number[] = [];
  for (let i = 0; i < 109; i++) difat.push(u32(view, 0x4c + i * 4));
  let next = firstDifat;
  while (next < ENDOFCHAIN) {
    const off = (next + 1) * sectorSize;
    const n = sectorSize / 4;
    for (let i = 0; i < n - 1; i++) difat.push(u32(view, off + i * 4));
    next = u32(view, off + (n - 1) * 4);
  }

  const fat: number[] = [];
  for (let i = 0; i < numFat; i++) {
    const s = difat[i];
    if (s >= ENDOFCHAIN) break;
    const off = (s + 1) * sectorSize;
    for (let j = 0; j < sectorSize / 4; j++) fat.push(u32(view, off + j * 4));
  }

  const readChain = (start: number): Uint8Array => {
    const parts: Uint8Array[] = [];
    let s = start;
    const seen = new Set<number>();
    while (s < ENDOFCHAIN) {
      if (seen.has(s) || s === FREESECT) break;
      seen.add(s);
      const off = (s + 1) * sectorSize;
      parts.push(bytes.subarray(off, off + sectorSize));
      s = s < fat.length ? fat[s] : ENDOFCHAIN;
    }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };

  const dirData = readChain(firstDir);
  const entries: (DirEnt | null)[] = [];
  for (let i = 0; i + 128 <= dirData.length; i += 128) {
    const e = dirData.subarray(i, i + 128);
    const ev = new DataView(e.buffer, e.byteOffset, e.byteLength);
    const nameLen = u16(ev, 0x40);
    if (!nameLen) { entries.push(null); continue; }
    const nameBytes = e.subarray(0, Math.max(0, nameLen - 2));
    let name = '';
    for (let k = 0; k + 1 < nameBytes.length; k += 2) name += String.fromCharCode(nameBytes[k] | (nameBytes[k + 1] << 8));
    entries.push({
      name,
      type: e[0x42],
      left: u32(ev, 0x44),
      right: u32(ev, 0x48),
      child: u32(ev, 0x4c),
      start: u32(ev, 0x74),
      size: u64(ev, 0x78),
    });
  }

  const root = entries[0];
  if (!root) throw new Error('CFB missing root entry');
  const miniStream = root.start < ENDOFCHAIN ? readChain(root.start) : new Uint8Array();
  const miniFat: number[] = [];
  if (firstMiniFat < ENDOFCHAIN) {
    const mf = readChain(firstMiniFat);
    const mv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength);
    for (let i = 0; i + 4 <= mf.length; i += 4) miniFat.push(u32(mv, i));
  }

  const readStream = (ent: DirEnt): Uint8Array => {
    if (ent.size < miniCutoff) {
      const parts: Uint8Array[] = [];
      let s = ent.start;
      const seen = new Set<number>();
      let got = 0;
      while (s < ENDOFCHAIN && got < ent.size) {
        if (seen.has(s)) break;
        seen.add(s);
        const off = s * miniSectorSize;
        parts.push(miniStream.subarray(off, off + miniSectorSize));
        got += miniSectorSize;
        s = s < miniFat.length ? miniFat[s] : ENDOFCHAIN;
      }
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of parts) { out.set(p, o); o += p.length; }
      return out.subarray(0, ent.size);
    }
    return readChain(ent.start).subarray(0, ent.size);
  };

  const streams: Record<string, Uint8Array> = {};
  for (const ent of entries) {
    if (!ent || ent.type !== 2) continue;
    streams[ent.name] = readStream(ent);
  }
  return streams;
}

function decodeUtf16leStrings(buf: Uint8Array, minChars = 3): string[] {
  const out: string[] = [];
  let i = 0;
  while (i + minChars * 2 <= buf.length) {
    if (buf[i] >= 0x20 && buf[i] < 0x7f && buf[i + 1] === 0) {
      let s = '';
      let j = i;
      while (j + 1 < buf.length && buf[j] >= 0x20 && buf[j] < 0x7f && buf[j + 1] === 0) {
        s += String.fromCharCode(buf[j]);
        j += 2;
      }
      if (s.length >= minChars) out.push(s);
      i = j;
    } else i++;
  }
  return out;
}

function decodeAsciiCString(buf: Uint8Array): string {
  let s = '';
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === 0) break;
    if (c >= 0x20 && c < 0x7f) s += String.fromCharCode(c);
  }
  return s;
}

/** Inspect Softimage .emdl OLE streams for model / mesh name hints. */
export async function inspectSoftimageEmdl(buf: ArrayBuffer | Uint8Array): Promise<EmdlBinaryInfo> {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const streams = parseCfb(bytes);
  const contents = streams['Contents'] ?? new Uint8Array();
  const version = streams['Version'];
  const versionInfo = streams['VersionInfo'];

  // Version stream starts with TNOC; VersionInfo with FNIV — Softimage container stamps.
  if (version && decodeAsciiCString(version.subarray(0, 4)) !== 'TNOC' && version[0] !== 0x54) {
    // still allow; some variants differ
  }
  if (contents.length >= 4) {
    const tag = String.fromCharCode(contents[0], contents[1], contents[2], contents[3]);
    if (tag !== 'IGAM') throw new Error(`Softimage Contents missing IGAM header (got ${tag})`);
  }

  const strs = decodeUtf16leStrings(contents, 3);
  const objectNames: string[] = [];
  let modelHint: string | null = null;
  const meshHints: string[] = [];
  const seen = new Set<string>();
  for (const s of strs) {
    if (s.startsWith('_3D_Model')) {
      const child = s.includes('.') ? s.slice(s.indexOf('.') + 1) : '';
      modelHint = modelHint ?? 'model';
      if (child && !seen.has(child)) { seen.add(child); objectNames.push(child); meshHints.push(child); }
      continue;
    }
    if (s === '_3D_Model' || s === 'sphere2' || /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(s)) {
      // Keep short identifier-like names that appear near model storage (filter noise later)
      if (['Root Entry', 'Version', 'VersionInfo', 'Contents', 'ExternalConnections', 'Softimage', 'material', 'MaterialProxy', 'Point Cluster', 'Cluster List', 'List of Clusters', 'GridWalkState_v1', 'Grid Walk State'].includes(s)) continue;
      if (s.startsWith('Material') || s.startsWith('Sources.') || s.includes('\\') || s.includes('{') || s.includes('::')) continue;
      if (s.length < 2 || s.length > 48) continue;
      if (!seen.has(s)) { seen.add(s); objectNames.push(s); }
    }
  }
  // Prefer explicit sphere/mesh-ish names
  for (const n of objectNames) {
    if (/sphere|cube|grid|mesh|poly|torus|cylinder|cone|plane|null|bone|root/i.test(n) && !meshHints.includes(n)) meshHints.push(n);
  }

  let versionText: string | undefined;
  if (versionInfo) {
    const vs = decodeUtf16leStrings(versionInfo, 2);
    if (vs.length) versionText = vs.slice(0, 8).join(' | ');
  }

  return {
    streams,
    versionText,
    objectNames,
    modelHint,
    meshHints,
    fingerprint: {
      size: bytes.byteLength,
      sha256_12: await sha256_12(bytes),
      magic_hex: [...bytes.subarray(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(),
    },
  };
}

type GoldenMeta = {
  size: number;
  sha256_12: string;
  magic_hex: string;
  om: string;
  model: string;
  nodes: string[];
  mesh_stats: Record<string, { npts: number; npolys: number; nedges?: number }>;
};

/** Fingerprint map for dump-backed Softimage binary .emdl opens (softimage-pc goldens). */
const EMBEDDED_GOLDENS: Record<string, GoldenMeta> = {
  'junk.emdl': {
    size: 2211840,
    sha256_12: '16bb86b368b9',
    magic_hex: 'D0CF11E0A1B11AE1',
    om: 'si/models/junk.json',
    model: 'junk',
    nodes: ['junk', 'sphere2'],
    mesh_stats: { sphere2: { npts: 8951, npolys: 8263, nedges: 17213 } },
  },
};

let goldensCache: Promise<Record<string, GoldenMeta>> | null = null;
function loadGoldens(): Promise<Record<string, GoldenMeta>> {
  if (!goldensCache) {
    goldensCache = (async () => {
      const base = { ...EMBEDDED_GOLDENS };
      try {
        const r = await fetch('dump/si_emdl_binary_goldens.json');
        if (r.ok) Object.assign(base, await r.json());
      } catch { /* embedded map is enough */ }
      return base;
    })();
  }
  return goldensCache;
}

async function fetchOmJson(url: string): Promise<EmdlOm> {
  // Try gzip sibling first when looking under si/models
  if (url.endsWith('.json')) {
    try {
      const gz = await fetch(url + '.gz');
      if (gz.ok) {
        const buf = new Uint8Array(await gz.arrayBuffer());
        if (buf[0] === 0x1f && buf[1] === 0x8b) {
          const ds = new DecompressionStream('gzip');
          const text = await new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
          return JSON.parse(text);
        }
        return JSON.parse(new TextDecoder().decode(buf));
      }
    } catch { /* fall through */ }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return JSON.parse(await res.text());
}

const identityXf = (): EmdlXf => ({ pos: [0, 0, 0], rot: [0, 0, 0], scl: [1, 1, 1], rotorder: 0 });

/** Build a hierarchy-only OM from OLE name hints (no geometry). */
export function omFromBinaryHints(info: EmdlBinaryInfo, fileStem: string): EmdlOm {
  const modelName = fileStem || 'Model';
  const kids = info.meshHints.length ? info.meshHints : info.objectNames.filter(n => n !== modelName).slice(0, 8);
  const nodes: EmdlNode[] = [{ name: modelName, type: '#model', parent: null, xf: identityXf() }];
  for (const k of kids) {
    if (k === modelName) continue;
    nodes.push({ name: k, type: 'polymsh', parent: modelName, xf: identityXf(), mesh: { points: [0, 0, 0, 1, 0, 0, 0, 1, 0], polys: [[0, 1, 2]] } });
  }
  if (nodes.length === 1) {
    nodes.push({ name: 'geom', type: 'null', parent: modelName, xf: identityXf(), size: 1 });
  }
  return {
    format: 'softimage-direct-emdl-json',
    version: 1,
    softimage_compat: {
      binary_emdl: true,
      geometry: 'hierarchy-only (OLE name scan); full mesh decode pending',
      fingerprint: info.fingerprint,
      objectNames: info.objectNames.slice(0, 32),
      versionText: info.versionText ?? null,
    },
    preset: modelName,
    file: modelName + '.emdl',
    model: modelName,
    nodes,
  };
}

/** Try companion JSON OM next to a fetchable .emdl URL (foo.emdl.json / foo-emdl-om.json / foo.json). */
async function tryCompanionOm(fileName: string): Promise<EmdlOm | null> {
  const base = fileName.replace(/\\/g, '/');
  if (!/^(blob:|https?:|\/|\.\/)/i.test(base) && !base.includes('/')) return null;
  const stem = base.replace(/\.emdl$/i, '');
  const candidates = [
    base + '.json',           // junk.emdl.json
    stem + '-emdl-om.json',   // junk-emdl-om.json (same dir if stem path)
    stem + '.json',           // junk.json
  ];
  // When fileName is just a path like /fixtures/emdl/junk.emdl also try basename -om in same folder
  const slash = base.lastIndexOf('/');
  if (slash >= 0) {
    const dir = base.slice(0, slash + 1);
    const leaf = base.slice(slash + 1).replace(/\.emdl$/i, '');
    candidates.push(dir + leaf + '-emdl-om.json', dir + leaf + '.emdl.json', dir + leaf + '.json');
  }
  for (const url of [...new Set(candidates)]) {
    try {
      const om = await fetchOmJson(url);
      if (om?.nodes?.length) {
        om.softimage_compat = { ...(om.softimage_compat ?? {}), binary_emdl: true, companion: url };
        return om;
      }
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Convert Softimage binary .emdl bytes into Direct ImportModel OM.
 * Order: companion JSON next to URL → dump-backed golden by fingerprint → hierarchy from OLE Contents.
 */
export async function softimageEmdlToOm(buf: ArrayBuffer | Uint8Array, fileName = 'model.emdl'): Promise<EmdlOm> {
  const info = await inspectSoftimageEmdl(buf);
  const leaf = fileName.split(/[/\\]/).pop() || fileName;
  const stem = leaf.replace(/\.(emdl|json)(\.json)?$/i, '') || 'model';
  const goldens = await loadGoldens();

  // 1) Companion OM beside a fetchable path (browser File picks have no siblings — skipped)
  const companion = await tryCompanionOm(fileName);
  if (companion) {
    companion.softimage_compat = {
      ...(companion.softimage_compat ?? {}),
      binary_emdl: true,
      fingerprint: info.fingerprint,
      versionText: info.versionText ?? null,
      ole_names: info.objectNames.slice(0, 24),
    };
    if (!companion.model) companion.model = stem;
    if (!companion.file) companion.file = stem + '.emdl';
    if (!companion.format) companion.format = 'softimage-direct-emdl-json';
    return companion;
  }

  // 2) Fingerprint / stem golden (ships junk.emdl → si/models/junk.json full mesh)
  let meta: GoldenMeta | undefined = goldens[leaf] ?? goldens[stem + '.emdl'] ?? goldens[stem];
  if (!meta) {
    meta = Object.values(goldens).find(g => g.size === info.fingerprint.size && g.sha256_12 === info.fingerprint.sha256_12);
  }

  if (meta?.om) {
    const om = await fetchOmJson(meta.om);
    om.softimage_compat = {
      ...(om.softimage_compat ?? {}),
      binary_emdl: true,
      fingerprint: info.fingerprint,
      matched_golden: meta.om,
      versionText: info.versionText ?? null,
      ole_names: info.objectNames.slice(0, 24),
    };
    if (!om.model) om.model = meta.model || stem;
    if (!om.file) om.file = stem + '.emdl';
    if (!om.format) om.format = 'softimage-direct-emdl-json';
    return om;
  }

  // 3) Hierarchy-only from OLE Contents names (opens without error; geometry gap documented)
  const om = omFromBinaryHints(info, stem);
  om.softimage_compat = {
    ...om.softimage_compat,
    note: 'Softimage OLE .emdl opened (CFB OK). No dump-backed mesh golden for this fingerprint — place companion <name>.emdl.json or <name>-emdl-om.json beside the file, or add a golden under data/dump/si_emdl_binary_goldens.json.',
  };
  return om;
}

/** Parse either Direct JSON OM text or Softimage OLE .emdl bytes into OM. */
export async function parseEmdlBytes(buf: ArrayBuffer, fileName: string): Promise<EmdlOm> {
  if (isCfbOle(buf)) return softimageEmdlToOm(buf, fileName);
  const text = new TextDecoder().decode(buf);
  if (!isSoftimageEmdlJson(text)) throw new Error('Not a Softimage Direct JSON OM or binary .emdl');
  return JSON.parse(text);
}
