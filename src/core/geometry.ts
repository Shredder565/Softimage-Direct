// Mesh data and generators. Operators transform MeshData in the construction history.

export interface MeshData {
  positions: Float32Array;   // xyz per vertex
  indices: Uint32Array;      // triangles
  polygons: number[][];      // polygon faces (vertex indices)
  triPoly: Uint32Array;      // polygon index per triangle (for picking)
}

export function build(verts: number[][], faces: number[][]): MeshData {
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => { positions[i * 3] = v[0]; positions[i * 3 + 1] = v[1]; positions[i * 3 + 2] = v[2]; });
  const tris: number[] = [], triPoly: number[] = [];
  faces.forEach((f, pi) => { for (let i = 1; i + 1 < f.length; i++) { tris.push(f[0], f[i], f[i + 1]); triPoly.push(pi); } });
  return { positions, indices: new Uint32Array(tris), polygons: faces, triPoly: new Uint32Array(triPoly) };
}

export function cloneMesh(m: MeshData): MeshData {
  return { positions: new Float32Array(m.positions), indices: m.indices, polygons: m.polygons, triPoly: m.triPoly };
}

// ---------------------------------------------------------------- primitives
export function grid(ulen: number, vlen: number, usub: number, vsub: number, axis: 'y' | 'z' = 'y'): MeshData {
  const verts: number[][] = [], faces: number[][] = [];
  for (let j = 0; j <= vsub; j++) for (let i = 0; i <= usub; i++) {
    const x = -ulen / 2 + (ulen * i) / usub, y = -vlen / 2 + (vlen * j) / vsub;
    verts.push(axis === 'y' ? [x, 0, y] : [x, y, 0]);
  }
  for (let j = 0; j < vsub; j++) for (let i = 0; i < usub; i++) {
    const a = j * (usub + 1) + i;
    faces.push([a, a + 1, a + usub + 2, a + usub + 1]);
  }
  return build(verts, faces);
}

export function cube(len: number, sub: number): MeshData {
  const h = len / 2, verts: number[][] = [], faces: number[][] = [];
  const addFace = (origin: number[], du: number[], dv: number[]) => {
    const base = verts.length;
    for (let j = 0; j <= sub; j++) for (let i = 0; i <= sub; i++)
      verts.push([0, 1, 2].map(k => origin[k] + (du[k] * i + dv[k] * j) * (len / sub)));
    for (let j = 0; j < sub; j++) for (let i = 0; i < sub; i++) {
      const a = base + j * (sub + 1) + i;
      faces.push([a, a + 1, a + sub + 2, a + sub + 1]);
    }
  };
  addFace([-h, -h, h], [1, 0, 0], [0, 1, 0]);   // front
  addFace([h, -h, -h], [-1, 0, 0], [0, 1, 0]);  // back
  addFace([h, -h, h], [0, 0, -1], [0, 1, 0]);   // right
  addFace([-h, -h, -h], [0, 0, 1], [0, 1, 0]);  // left
  addFace([-h, h, h], [1, 0, 0], [0, 0, -1]);   // top
  addFace([-h, -h, -h], [1, 0, 0], [0, 0, 1]);  // bottom
  return build(verts, faces);
}

export function sphere(radius: number, usub: number, vsub: number): MeshData {
  const verts: number[][] = [], faces: number[][] = [];
  for (let j = 0; j <= vsub; j++) {
    const phi = (Math.PI * j) / vsub;
    for (let i = 0; i < usub; i++) {
      const th = (2 * Math.PI * i) / usub;
      verts.push([radius * Math.sin(phi) * Math.cos(th), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(th)]);
    }
  }
  for (let j = 0; j < vsub; j++) for (let i = 0; i < usub; i++) {
    const a = j * usub + i, b = j * usub + ((i + 1) % usub), c = (j + 1) * usub + ((i + 1) % usub), d = (j + 1) * usub + i;
    if (j === 0) faces.push([a, c, d]); else if (j === vsub - 1) faces.push([a, b, c]); else faces.push([a, b, c, d]);
  }
  return build(verts, faces);
}

export function cylinder(radius: number, height: number, usub: number, vsub: number, topRadius = radius, capped = true): MeshData {
  const verts: number[][] = [], faces: number[][] = [];
  for (let j = 0; j <= vsub; j++) {
    const t = j / vsub, r = radius + (topRadius - radius) * t, y = -height / 2 + height * t;
    for (let i = 0; i < usub; i++) {
      const th = (2 * Math.PI * i) / usub;
      verts.push([r * Math.cos(th), y, r * Math.sin(th)]);
    }
  }
  for (let j = 0; j < vsub; j++) for (let i = 0; i < usub; i++) {
    const a = j * usub + i, b = j * usub + ((i + 1) % usub), c = (j + 1) * usub + ((i + 1) % usub), d = (j + 1) * usub + i;
    faces.push(topRadius === 0 && j === vsub - 1 ? [a, b, c] : [a, b, c, d]);
  }
  if (capped) {
    const bottom: number[] = [], top: number[] = [];
    for (let i = 0; i < usub; i++) { bottom.push(usub - 1 - i); if (topRadius > 0) top.push(vsub * usub + i); }
    faces.push(bottom); if (top.length) faces.push(top);
  }
  return build(verts, faces);
}

export function cone(radius: number, height: number, usub: number, vsub: number): MeshData {
  return cylinder(radius, height, usub, vsub, 0, true);
}

export function torus(radius: number, inner: number, usub: number, vsub: number): MeshData {
  const verts: number[][] = [], faces: number[][] = [];
  for (let j = 0; j < vsub; j++) {
    const phi = (2 * Math.PI * j) / vsub;
    for (let i = 0; i < usub; i++) {
      const th = (2 * Math.PI * i) / usub, r = radius + inner * Math.cos(phi);
      verts.push([r * Math.cos(th), inner * Math.sin(phi), r * Math.sin(th)]);
    }
  }
  for (let j = 0; j < vsub; j++) for (let i = 0; i < usub; i++) {
    const a = j * usub + i, b = j * usub + ((i + 1) % usub), c = ((j + 1) % vsub) * usub + ((i + 1) % usub), d = ((j + 1) % vsub) * usub + i;
    faces.push([a, b, c, d]);
  }
  return build(verts, faces);
}

export function disc(radius: number, inner: number, usub: number, vsub: number): MeshData {
  const verts: number[][] = [], faces: number[][] = [];
  for (let j = 0; j <= vsub; j++) {
    const r = inner + ((radius - inner) * j) / vsub;
    for (let i = 0; i < usub; i++) {
      const th = (2 * Math.PI * i) / usub;
      verts.push([r * Math.cos(th), 0, r * Math.sin(th)]);
    }
  }
  for (let j = 0; j < vsub; j++) for (let i = 0; i < usub; i++) {
    const a = j * usub + i, b = j * usub + ((i + 1) % usub), c = (j + 1) * usub + ((i + 1) % usub), d = (j + 1) * usub + i;
    faces.push([a, d, c, b]);
  }
  if (inner === 0) { /* centre ring collapses; keep as is for simplicity */ }
  return build(verts, faces);
}

export function platonic(kind: 'tetrahedron' | 'octahedron' | 'icosahedron' | 'dodecahedron', r: number): MeshData {
  if (kind === 'tetrahedron') {
    const s = r / Math.sqrt(3);
    return build([[s, s, s], [-s, -s, s], [-s, s, -s], [s, -s, -s]], [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]]);
  }
  if (kind === 'octahedron') {
    return build([[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]],
      [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]);
  }
  const t = (1 + Math.sqrt(5)) / 2;
  if (kind === 'icosahedron') {
    const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map(p => { const l = Math.hypot(...p); return p.map(x => (x / l) * r); });
    const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    return build(v, f);
  }
  // dodecahedron
  const a = 1, b = 1 / t, c = t;
  const v = [[a, a, a], [a, a, -a], [a, -a, a], [a, -a, -a], [-a, a, a], [-a, a, -a], [-a, -a, a], [-a, -a, -a],
    [0, b, c], [0, b, -c], [0, -b, c], [0, -b, -c], [b, c, 0], [b, -c, 0], [-b, c, 0], [-b, -c, 0], [c, 0, b], [c, 0, -b], [-c, 0, b], [-c, 0, -b]]
    .map(p => { const l = Math.hypot(...p); return p.map(x => (x / l) * r); });
  const f = [[0, 8, 10, 2, 16], [0, 16, 17, 1, 12], [0, 12, 14, 4, 8], [1, 17, 3, 11, 9], [1, 9, 5, 14, 12], [2, 10, 6, 15, 13], [2, 13, 3, 17, 16], [3, 13, 15, 7, 11], [4, 14, 5, 19, 18], [4, 18, 6, 10, 8], [5, 9, 11, 7, 19], [6, 18, 19, 7, 15]];
  return build(v, f);
}

/** Faces of a convex polytope from its vertices (planes supporting all points), ordered counter-clockwise outward. */
export function convexFaces(verts: number[][]): number[][] {
  const n = verts.length; const faces: number[][] = []; const seen = new Set<string>();
  const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nrm = cross(sub(verts[j], verts[i]), sub(verts[k], verts[i])); const l = Math.hypot(...nrm); if (l < 1e-9) continue; nrm = nrm.map(x => x / l);
    const d = dot(nrm, verts[i]); let pos = 0, neg = 0; const on: number[] = [];
    for (let m = 0; m < n; m++) { const s = dot(nrm, verts[m]) - d; if (s > 1e-6) pos++; else if (s < -1e-6) neg++; else on.push(m); if (pos && neg) break; }
    if (pos && neg) continue;
    const key = [...on].sort((a, b) => a - b).join(','); if (seen.has(key)) continue; seen.add(key);
    const outward = pos ? nrm.map(x => -x) : nrm; // normal must point away from the interior
    const c = [0, 1, 2].map(ax => on.reduce((s, v) => s + verts[v][ax], 0) / on.length); const u = sub(verts[on[0]], c); const ul = Math.hypot(...u) || 1; const ux = u.map(x => x / ul); const uy = cross(outward, ux);
    on.sort((a, b) => Math.atan2(dot(sub(verts[a], c), uy), dot(sub(verts[a], c), ux)) - Math.atan2(dot(sub(verts[b], c), uy), dot(sub(verts[b], c), ux)));
    faces.push(on);
  }
  return faces;
}
export function rhombicosidodecahedron(r: number): MeshData {
  const t = (1 + Math.sqrt(5)) / 2; const v: number[][] = [];
  const perms = (a: number, b: number, c: number) => [[a, b, c], [c, a, b], [b, c, a]]; // even permutations
  const signs = (p: number[]) => { const out: number[][] = []; for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) out.push([p[0] * sx, p[1] * sy, p[2] * sz]); return out; };
  for (const p of perms(1, 1, t ** 3)) for (const q of signs(p)) v.push(q);
  for (const p of perms(t * t, t, 2 * t)) for (const q of signs(p)) v.push(q);
  for (const p of perms(2 + t, 0, t * t)) for (const q of signs(p)) v.push(q);
  const uniq = Array.from(new Map(v.map(p => [p.map(x => x.toFixed(6)).join(','), p])).values()); const l = Math.hypot(...uniq[0]);
  const verts = uniq.map(p => p.map(x => (x / l) * r)); return build(verts, convexFaces(verts));
}
export function soccerBall(r: number): MeshData {
  // truncated icosahedron: truncate each icosahedron vertex at 1/3 along its edges
  const ico = platonic('icosahedron', 1); const V: number[][] = []; for (let i = 0; i < ico.positions.length; i += 3) V.push([ico.positions[i], ico.positions[i + 1], ico.positions[i + 2]]);
  const pts: number[][] = []; const seen = new Set<string>();
  for (const f of ico.polygons) for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; for (const [p, q] of [[a, b], [b, a]]) { const k = p + '>' + q; if (seen.has(k)) continue; seen.add(k); pts.push([0, 1, 2].map(ax => V[p][ax] + (V[q][ax] - V[p][ax]) / 3)); } }
  const l = Math.hypot(...pts[0]); const verts = pts.map(p => p.map(x => (x / l) * r)); return build(verts, convexFaces(verts));
}
export function emptyMesh(): MeshData { return build([], []); }

// ---------------------------------------------------------------- deformers
export type DeformFn = (p: [number, number, number], bbox: { min: number[]; max: number[] }) => [number, number, number];

export function bbox(m: MeshData) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], m.positions[i + k]); max[k] = Math.max(max[k], m.positions[i + k]);
  }
  return { min, max };
}

export function deform(m: MeshData, fn: DeformFn): MeshData {
  const out = cloneMesh(m), bb = bbox(m);
  for (let i = 0; i < out.positions.length; i += 3) {
    const r = fn([out.positions[i], out.positions[i + 1], out.positions[i + 2]], bb);
    out.positions[i] = r[0]; out.positions[i + 1] = r[1]; out.positions[i + 2] = r[2];
  }
  return out;
}

const rotY = (p: number[], ang: number): [number, number, number] => [p[0] * Math.cos(ang) - p[2] * Math.sin(ang), p[1], p[0] * Math.sin(ang) + p[2] * Math.cos(ang)];

export const deformers: Record<string, (m: MeshData, v: Record<string, number>) => MeshData> = {
  Twist: (m, v) => deform(m, (p, bb) => {
    const h = bb.max[1] - bb.min[1] || 1, t = (p[1] - bb.min[1]) / h;
    return rotY(p, (v.angle * Math.PI / 180) * t);
  }),
  Bend: (m, v) => deform(m, (p, bb) => {
    const h = bb.max[1] - bb.min[1] || 1, t = (p[1] - bb.min[1]) / h, ang = (v.angle * Math.PI / 180) * t;
    return [p[0] * Math.cos(ang) + (p[1] - bb.min[1]) * Math.sin(ang) * 0.5, p[1] * Math.cos(ang * 0.5), p[2]];
  }),
  Taper: (m, v) => deform(m, (p, bb) => {
    const h = bb.max[1] - bb.min[1] || 1, t = (p[1] - bb.min[1]) / h, s = 1 + (v.factor - 1) * t;
    return [p[0] * s, p[1], p[2] * s];
  }),
  Bulge: (m, v) => deform(m, (p, bb) => {
    const h = bb.max[1] - bb.min[1] || 1, t = (p[1] - bb.min[1]) / h, s = 1 + v.factor * Math.sin(Math.PI * t);
    return [p[0] * s, p[1], p[2] * s];
  }),
  Shear: (m, v) => deform(m, (p, bb) => {
    const h = bb.max[1] - bb.min[1] || 1, t = (p[1] - bb.min[1]) / h;
    return [p[0] + v.factor * t, p[1], p[2]];
  }),
  Push: (m, v) => {
    const out = cloneMesh(m);
    for (let i = 0; i < out.positions.length; i += 3) {
      const l = Math.hypot(out.positions[i], out.positions[i + 1], out.positions[i + 2]) || 1;
      for (let k = 0; k < 3; k++) out.positions[i + k] += (out.positions[i + k] / l) * v.amplitude;
    }
    return out;
  },
  Randomize: (m, v) => {
    const out = cloneMesh(m);
    let seed = (v.seed | 0) + 1;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
    for (let i = 0; i < out.positions.length; i++) out.positions[i] += rnd() * v.displacement;
    return out;
  },
  Smooth: (m, v) => {
    // simple Laplacian smoothing over shared vertices
    const n = m.positions.length / 3, adj: Set<number>[] = Array.from({ length: n }, () => new Set());
    for (const f of m.polygons) for (let i = 0; i < f.length; i++) { adj[f[i]].add(f[(i + 1) % f.length]); adj[f[(i + 1) % f.length]].add(f[i]); }
    let cur = cloneMesh(m);
    for (let it = 0; it < Math.max(1, v.iterations | 0); it++) {
      const next = cloneMesh(cur);
      for (let i = 0; i < n; i++) {
        if (!adj[i].size) continue;
        const avg = [0, 0, 0];
        for (const j of adj[i]) for (let k = 0; k < 3; k++) avg[k] += cur.positions[j * 3 + k];
        for (let k = 0; k < 3; k++) next.positions[i * 3 + k] = cur.positions[i * 3 + k] + (avg[k] / adj[i].size - cur.positions[i * 3 + k]) * v.strength;
      }
      cur = next;
    }
    return cur;
  },
};
