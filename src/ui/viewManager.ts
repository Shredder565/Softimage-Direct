// View Manager: four viewports rendered by one Three.js renderer with scissors. Syncs the scene graph into
// Three objects (meshes, surfaces, curves, lattices, implicits, bones, lights, cameras), subdivision display,
// textures, selection + component highlights, picking, rectangle selection, navigation, transform tools,
// component tweaking (with proportional falloff) and interactive tools (curve/chain drawing, add vertex...).
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, MoveComponentOperator, geomPoints, Model } from '../core/scene';
import { ChainRoot, Bone } from '../core/scene2';
import { meshEdges, edgeKey } from '../core/topology';
import { catmullClark, meshUVProjection } from '../core/topology2';
import { tessellateCurve } from '../core/curves';
import type { MeshData } from '../core/geometry';

export type ToolMode = 'select' | 'translate' | 'rotate' | 'scale';
export const tool = { mode: 'select' as ToolMode, axes: { x: true, y: true, z: true }, setMode: (_m: ToolMode) => { } };
(window as any).__tool = tool;

interface Viewport { name: string; kind: 'ortho' | 'persp'; camera: THREE.Camera; el: HTMLElement; display: string; }
type V3 = [number, number, number];

export function viewManager(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'vm'; host.appendChild(root);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);
  const labels = document.createElement('div'); labels.className = 'vp-labels'; root.appendChild(labels);
  const rubber = document.createElement('div'); rubber.className = 'rubber'; rubber.style.display = 'none'; root.appendChild(rubber);
  const toolHint = document.createElement('div'); toolHint.className = 'tool-hint'; toolHint.style.display = 'none'; root.appendChild(toolHint);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x4a4a4a);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const defaultLights = new THREE.Group(); const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(12, 20, 15); const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-15, 5, -10); defaultLights.add(key, fill); scene.add(defaultLights);
  const grid = new THREE.GridHelper(40, 40, 0x7a7a7a, 0x5a5a5a); scene.add(grid);
  const axesH = new THREE.AxesHelper(4); scene.add(axesH);
  const hlPolys = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthTest: false })); hlPolys.renderOrder = 10; scene.add(hlPolys);
  const hlEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff4a2a, depthTest: false })); hlEdges.renderOrder = 11; scene.add(hlEdges);
  const hlPoints = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xff4a2a, size: 7, sizeAttenuation: false, depthTest: false })); hlPoints.renderOrder = 12; scene.add(hlPoints);
  const allPoints = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xd8d8d8, size: 4, sizeAttenuation: false, depthTest: false })); allPoints.renderOrder = 9; scene.add(allPoints);
  const toolPreview = new THREE.Group(); scene.add(toolPreview);

  const mk = (name: string, kind: 'ortho' | 'persp', pos: THREE.Vector3, up: THREE.Vector3): Viewport => {
    const cam: THREE.Camera = kind === 'ortho' ? new THREE.OrthographicCamera(-20, 20, 20, -20, -1000, 1000) : new THREE.PerspectiveCamera(53.6, 1, 0.1, 5000);
    cam.position.copy(pos); cam.up.copy(up); cam.lookAt(0, 0, 0);
    const el = document.createElement('div'); el.className = 'vp-label';
    const head = document.createElement('div'); head.className = 'vp-head';
    const b = document.createElement('b'); b.textContent = name[0];
    const sel = document.createElement('select'); for (const v of ['Top', 'Front', 'Right', 'Camera', 'User']) { const o = document.createElement('option'); o.textContent = v; sel.appendChild(o); } sel.value = name;
    const disp = document.createElement('select'); for (const v of ['Wireframe', 'Shaded', 'Textured', 'Bounding Box']) { const o = document.createElement('option'); o.textContent = v; disp.appendChild(o); } disp.value = kind === 'persp' ? 'Shaded' : 'Wireframe';
    const sp = document.createElement('div'); sp.className = 'spacer';
    head.append(b, sel, sp, disp); el.appendChild(head); labels.appendChild(el);
    const vp: Viewport = { name, kind, camera: cam, el, display: disp.value.toLowerCase() };
    disp.onchange = () => { vp.display = disp.value.toLowerCase(); needs = true; };
    sel.onchange = () => { switchView(vp, sel.value); needs = true; };
    return vp;
  };
  const vps: Viewport[] = [
    mk('Top', 'ortho', new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, 0, -1)),
    mk('Camera', 'persp', new THREE.Vector3(22, 16, 28), new THREE.Vector3(0, 1, 0)),
    mk('Front', 'ortho', new THREE.Vector3(0, 0, 100), new THREE.Vector3(0, 1, 0)),
    mk('Right', 'ortho', new THREE.Vector3(100, 0, 0), new THREE.Vector3(0, 1, 0)),
  ];
  const orbit = { target: new THREE.Vector3(0, 0, 0) };
  const switchView = (vp: Viewport, name: string) => {
    const c = vp.camera;
    if (name === 'Top') { c.position.set(0, 100, 0); c.up.set(0, 0, -1); } else if (name === 'Front') { c.position.set(0, 0, 100); c.up.set(0, 1, 0); } else if (name === 'Right') { c.position.set(100, 0, 0); c.up.set(0, 1, 0); } else { c.position.set(22, 16, 28); c.up.set(0, 1, 0); }
    vp.name = name; vp.el.querySelector('b')!.textContent = name[0]; c.lookAt(orbit.target); (c as any)._zoom = 20;
  };
  let active = 1; vps[active].el.classList.add('active');

  // ---- scene sync
  const nodes = new Map<X3DObject, THREE.Group>();
  const matCache = new Map<string, THREE.Material>();
  const texCache = new Map<string, THREE.Texture>();
  const materialFor = (o: X3DObject, textured: boolean): THREE.Material => {
    const mat = o.material ?? app.scene.root.material; const sh = mat?.surface; const type = sh?.type ?? 'Phong';
    const col = (sh?.val('diffuse') as number[] | undefined) ?? [0.7, 0.7, 0.7]; const img = textured ? (sh?.val('image') as string | undefined) : undefined;
    const keyc = `${type}|${col.map(x => x.toFixed(3)).join(',')}|${sh?.val('shiny') ?? ''}|${sh?.val('roughness') ?? ''}|${sh?.val('metalness') ?? ''}|${sh?.val('transparency') ?? 0}|${img ? img.length : 0}`;
    let m = matCache.get(keyc);
    if (!m) {
      const color = new THREE.Color(col[0], col[1], col[2]); const opts: any = { color, side: THREE.DoubleSide };
      switch (type) {
        case 'Lambert': case 'Ambient Occlusion': m = new THREE.MeshLambertMaterial(opts); break;
        case 'Constant': m = new THREE.MeshBasicMaterial(opts); break;
        case 'Cook-Torrance': case 'Strauss': case 'Architectural': case 'Car Paint': m = new THREE.MeshStandardMaterial({ ...opts, roughness: Number(sh?.val('roughness') ?? 0.4), metalness: Number(sh?.val('metalness') ?? 0.1) }); break;
        case 'Anisotropic': m = new THREE.MeshPhysicalMaterial({ ...opts, roughness: 0.35, metalness: 0.6, anisotropy: Number(sh?.val('anisotropy') ?? 0.5) }); break;
        case 'Toon': m = new THREE.MeshToonMaterial(opts); break;
        default: m = new THREE.MeshPhongMaterial({ ...opts, shininess: Number(sh?.val('shiny') ?? 50) * 0.6, specular: new THREE.Color(0x444444) });
      }
      const tr = Number(sh?.val('transparency') ?? 0); if (tr > 0) { m.transparent = true; m.opacity = 1 - tr; }
      if (img && 'map' in m) { let t = texCache.get(img); if (!t) { t = new THREE.TextureLoader().load(img, () => { needs = true; }); t.colorSpace = THREE.SRGBColorSpace; texCache.set(img, t); } (m as any).map = t; (m as any).color = new THREE.Color(1, 1, 1); }
      matCache.set(keyc, m);
    }
    return m;
  };
  const displayMesh = (o: X3DObject): MeshData | null => {
    const m = o.primitive?.mesh(); if (!m) return null;
    const ga = o.property('geomapprox') ?? app.scene.root.property('geomapprox'); const level = Number(ga?.val('gapproxmordrsl') ?? 0);
    if (level <= 0) return m;
    const cache = (o as any)._subd; if (cache && cache.src === m && cache.level === level) return cache.out;
    const out = catmullClark(m, Math.min(level, 4), (m as any).creases ?? new Map(), o.primitive!.val('subdrule') === 1); (o as any)._subd = { src: m, level, out }; return out;
  };
  const isSelected = (o: X3DObject) => app.selection.includes(o) || app.selection.some(n => { let p = n.parent; for (let i = 0; i < 4 && p; i++, p = p.parent) if (p === o) return true; return false; });
  const sync = () => {
    const seen = new Set<X3DObject>();
    // IK first so bone matrices are current
    for (const o of app.scene.allObjects()) if (o instanceof ChainRoot) o.solveIK();
    let userLights = 0;
    for (const o of app.scene.allObjects()) {
      seen.add(o);
      let g = nodes.get(o);
      if (!g) { g = new THREE.Group(); (g as any)._obj = o; scene.add(g); nodes.set(o, g); }
      g.matrixAutoUpdate = false; g.matrix.copy(o.globalMatrix()); o.updateGlobal();
      g.visible = o.visible;
      const selected = isSelected(o);
      const payload = o.primitive?.geom();
      const kindTag = o.primitive?.type ?? o.type;
      if (o.primitive && (o.primitive.type === 'polymsh' || o.primitive.type === 'surfmsh') && payload?.positions) {
        const mesh = displayMesh(o)!;
        let m = child(g, 'mesh') as THREE.Mesh | undefined, w = child(g, 'wire') as THREE.LineSegments | undefined;
        if (!m || (m.geometry as any)._src !== mesh) {
          const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3)); geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1)); geo.computeVertexNormals(); (geo as any)._src = mesh;
          const proj = o.property('uvprojection'); if (proj) { const uv = meshUVProjection(mesh, String(proj.val('kind'))); const ur = Number(proj.val('urepeat')), vr = Number(proj.val('vrepeat')), uo = Number(proj.val('uoffset')), vo = Number(proj.val('voffset')); for (let i = 0; i < uv.length; i += 2) { uv[i] = uv[i] * ur + uo; uv[i + 1] = uv[i + 1] * vr + vo; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
          if (m) { m.geometry.dispose(); m.geometry = geo; } else { m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial()); (m as any)._kind = 'mesh'; g.add(m); }
          const wgeo = polygonWire(mesh); if (w) { w.geometry.dispose(); w.geometry = wgeo; } else { w = new THREE.LineSegments(wgeo, new THREE.LineBasicMaterial({ color: 0xffffff })); (w as any)._kind = 'wire'; g.add(w); }
        }
        (m as any)._matShaded = materialFor(o, false); (m as any)._matTextured = materialFor(o, true);
        const lc = o.layer ? new THREE.Color(...(o.layer.val('color') as V3)) : new THREE.Color(o.primitive.type === 'surfmsh' ? 0x2a4a6a : 0x1a1a1a);
        (w!.material as THREE.LineBasicMaterial).color.copy(selected ? new THREE.Color(0xffffff) : lc);
        removeChild(g, 'marker');
      } else if (o.primitive?.type === 'crvlist' && payload?.cvs) {
        removeChild(g, 'mesh'); removeChild(g, 'wire');
        let ln = child(g, 'marker') as THREE.Line | undefined;
        if (!ln || (ln as any)._src !== payload) { const pts = tessellateCurve(payload, 8).map(p => new THREE.Vector3(...p)); const geo = new THREE.BufferGeometry().setFromPoints(pts); if (ln) { ln.geometry.dispose(); ln.geometry = geo; } else { ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff })); (ln as any)._kind = 'marker'; g.add(ln); } (ln as any)._src = payload; }
        (ln.material as THREE.LineBasicMaterial).color.set(selected ? 0xffffff : 0x3cc0ff);
      } else if (o.primitive?.type === 'lattice' && payload?.points) {
        removeChild(g, 'mesh'); removeChild(g, 'wire');
        let ln = child(g, 'marker') as THREE.LineSegments | undefined;
        if (!ln || (ln as any)._src !== payload) { const [sx, sy, sz] = payload.sub; const idx = (i: number, j: number, k: number) => k * (sy + 1) * (sx + 1) + j * (sx + 1) + i; const ix: number[] = []; for (let k = 0; k <= sz; k++) for (let j = 0; j <= sy; j++) for (let i = 0; i <= sx; i++) { if (i < sx) ix.push(idx(i, j, k), idx(i + 1, j, k)); if (j < sy) ix.push(idx(i, j, k), idx(i, j + 1, k)); if (k < sz) ix.push(idx(i, j, k), idx(i, j, k + 1)); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(geomPoints(payload)!, 3)); geo.setIndex(ix); if (ln) { ln.geometry.dispose(); ln.geometry = geo; } else { ln = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff })); (ln as any)._kind = 'marker'; g.add(ln); } (ln as any)._src = payload; }
        (ln.material as THREE.LineBasicMaterial).color.set(selected ? 0xffffff : 0xd0a040);
      } else {
        removeChild(g, 'mesh'); removeChild(g, 'wire');
        let mkr = child(g, 'marker') as THREE.Object3D | undefined; const tag = kindTag + '|' + (o.primitive?.name ?? '') + '|' + (o.val?.('length') ?? '') + '|' + (o.primitive?.val('size') ?? '');
        if (!mkr || (mkr as any)._tag !== tag) { if (mkr) g.remove(mkr); mkr = marker(o); (mkr as any)._kind = 'marker'; (mkr as any)._tag = tag; g.add(mkr); }
        const colr = selected ? 0xffffff : o.kind === 'model' ? 0x4c87c5 : o.type === 'bone' || o.type === 'root' ? 0xe0c060 : o.type === 'eff' ? 0xff6060 : o.type === 'light' ? 0xffe070 : o.type === 'implicit' ? 0x90d0a0 : 0x9ad24a;
        mkr.traverse(c => { if ((c as any).material && (c as any)._kind !== 'light') ((c as any).material as THREE.LineBasicMaterial).color.set(colr); });
        if (o.type === 'light') { userLights++; let L = child(g, 'light') as THREE.Light | undefined; const kind = o.primitive?.val('type'); if (!L) { L = kind === 'spot' ? new THREE.SpotLight(0xffffff, 60, 0, 0.6, 0.4) : kind === 'infinite' ? new THREE.DirectionalLight(0xffffff, 1) : new THREE.PointLight(0xffffff, 80); (L as any)._kind = 'light'; g.add(L); if ((L as any).target) { (L as any).target.position.set(0, 0, -1); g.add((L as any).target); } } const c = o.primitive?.val('soft_light.color') as number[] | undefined; if (c) L.color.setRGB(c[0], c[1], c[2]); const inten = Number(o.primitive?.val('soft_light.intensity') ?? 0.75); L.intensity = kind === 'infinite' ? inten * 1.5 : inten * 100; }
      }
    }
    defaultLights.visible = userLights === 0;
    for (const [o, g] of nodes) if (!seen.has(o)) { scene.remove(g); nodes.delete(o); }
    syncHighlights(); syncToolPreview();
    needs = true;
  };
  const child = (g: THREE.Object3D, k: string) => g.children.find(c => (c as any)._kind === k);
  const removeChild = (g: THREE.Object3D, k: string) => { const c = child(g, k); if (c) g.remove(c); };
  const compTarget = () => app.compSel?.obj ?? (app.selMode !== 'object' ? app.selectedObjects.find(o => o.primitive && geomPoints(o.primitive.geom())) : undefined);
  const syncHighlights = () => {
    const cs = app.compSel; const obj = compTarget();
    const pts = obj?.primitive ? geomPoints(obj.primitive.geom()) : null; const mesh = obj?.primitive?.mesh() ?? null;
    const empty = (g: THREE.BufferGeometry) => { g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3)); g.setIndex(null); };
    if (!obj || !pts) { empty(hlPolys.geometry); empty(hlEdges.geometry); empty(hlPoints.geometry); empty(allPoints.geometry); return; }
    const M = obj.globalMatrix();
    for (const h of [hlPolys, hlEdges, hlPoints, allPoints]) { h.matrixAutoUpdate = false; h.matrix.copy(M); }
    const pos = new THREE.BufferAttribute(pts, 3);
    allPoints.geometry.setAttribute('position', pos); allPoints.visible = app.selMode === 'point' || !!app.activeTool?.pickKind;
    if (mesh && cs?.kind === 'polygon' && cs.polygons.size) { const idx: number[] = []; mesh.triPoly.forEach((p, t) => { if (cs.polygons.has(p)) idx.push(mesh.indices[t * 3], mesh.indices[t * 3 + 1], mesh.indices[t * 3 + 2]); }); hlPolys.geometry.setAttribute('position', pos); hlPolys.geometry.setIndex(idx); } else empty(hlPolys.geometry);
    if (cs?.kind === 'edge' && cs.edges.size) { const idx: number[] = []; for (const k of cs.edges) { const [a, b] = k.split('-').map(Number); idx.push(a, b); } hlEdges.geometry.setAttribute('position', pos); hlEdges.geometry.setIndex(idx); } else empty(hlEdges.geometry);
    if (cs?.kind === 'point' && cs.points.size) { const arr = new Float32Array(cs.points.size * 3); let i = 0; for (const p of cs.points) { arr[i++] = pts[p * 3]; arr[i++] = pts[p * 3 + 1]; arr[i++] = pts[p * 3 + 2]; } hlPoints.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3)); } else empty(hlPoints.geometry);
    for (const h of [hlPolys, hlEdges, hlPoints, allPoints]) { h.geometry.computeBoundingSphere(); h.geometry.attributes.position.needsUpdate = true; }
  };
  const syncToolPreview = () => {
    toolPreview.clear(); const t = app.activeTool; toolHint.style.display = t ? 'block' : 'none'; if (t) toolHint.textContent = t.prompt;
    if (!t?.preview) return;
    for (const pl of t.preview()) { if (pl.length < 1) continue; const geo = new THREE.BufferGeometry().setFromPoints(pl.map(p => new THREE.Vector3(...p))); toolPreview.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd34d, depthTest: false }))); toolPreview.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd34d, size: 6, sizeAttenuation: false, depthTest: false }))); }
  };

  // ---- render loop
  let needs = true;
  const resize = () => { const w = root.clientWidth, h = root.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); needs = true; };
  new ResizeObserver(resize).observe(root); resize();
  const rect = (i: number) => { const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight; const w = (W - 2) / 2, h = (H - 2) / 2; return { x: i % 2 ? w + 2 : 0, y: i < 2 ? 0 : h + 2, w, h }; };
  const prepCam = (vp: Viewport, r: { w: number; h: number }) => { const c = vp.camera as any; if (vp.kind === 'persp') c.aspect = r.w / r.h; else { const z = c._zoom ?? 20, a = r.w / r.h; c.left = -z * a; c.right = z * a; c.top = z; c.bottom = -z; } c.updateProjectionMatrix(); c.updateMatrixWorld(); };
  const frameLoop = () => {
    requestAnimationFrame(frameLoop);
    if (!needs) return; needs = false;
    const H = renderer.domElement.clientHeight;
    renderer.setScissorTest(true);
    vps.forEach((vp, i) => {
      const r = rect(i); if (r.w <= 0 || r.h <= 0) return;
      renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h); renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
      prepCam(vp, r);
      for (const g of nodes.values()) for (const ch of g.children) { const k = (ch as any)._kind; if (k === 'mesh') { ch.visible = vp.display !== 'wireframe' && vp.display !== 'bounding box'; (ch as THREE.Mesh).material = vp.display === 'textured' ? (ch as any)._matTextured : (ch as any)._matShaded; } }
      renderer.render(scene, vp.camera);
    });
  };
  frameLoop();

  // ---- picking
  const ray = new THREE.Raycaster(); ray.params.Line = { threshold: 0.4 }; ray.params.Points = { threshold: 0.4 };
  const vpAt = (e: { clientX: number; clientY: number }) => { const b = renderer.domElement.getBoundingClientRect(); const x = e.clientX - b.left, y = e.clientY - b.top; for (let i = 0; i < 4; i++) { const r = rect(i); if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return { i, x, y, nx: ((x - r.x) / r.w) * 2 - 1, ny: -((y - r.y) / r.h) * 2 + 1, r }; } return null; };
  const pickObject = (vp: Viewport, nx: number, ny: number): { obj: X3DObject; hit: THREE.Intersection } | null => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), vp.camera);
    const hits = ray.intersectObjects([...nodes.values()], true).filter(h => { const k = (h.object as any)._kind; return k === 'mesh' || k === 'marker' || (h.object.parent as any)?._kind === 'marker'; });
    for (const h of hits) { let o: THREE.Object3D | null = h.object; while (o && !(o as any)._obj) o = o.parent; if (o) { const x = (o as any)._obj as X3DObject; if (x.visible && !(x instanceof Model && !x.primitive)) return { obj: x, hit: h }; } }
    return null;
  };
  const project = (vp: Viewport, r: { x: number; y: number; w: number; h: number }, M: THREE.Matrix4, pts: Float32Array, i: number) => {
    const v = new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]).applyMatrix4(M).project(vp.camera);
    return { x: r.x + ((v.x + 1) / 2) * r.w, y: r.y + ((1 - v.y) / 2) * r.h, z: v.z };
  };
  const pickComponent = (vp: Viewport, at: { x: number; y: number; r: any }, obj: X3DObject | undefined, hit: THREE.Intersection | undefined, kindOverride?: 'point' | 'edge' | 'polygon') => {
    const kind = kindOverride ?? (app.selMode as 'point' | 'edge' | 'polygon');
    const target = (kindOverride && obj) ? obj : (obj && obj === compTarget() ? obj : compTarget() ?? obj); const pts = target?.primitive ? geomPoints(target.primitive.geom()) : null; if (!target || !pts) return null;
    const mesh = target.primitive!.mesh();
    const wp = (idx: number): V3 => { const v = new THREE.Vector3(pts[idx * 3], pts[idx * 3 + 1], pts[idx * 3 + 2]).applyMatrix4(target.globalMatrix()); return [v.x, v.y, v.z]; };
    if (kind === 'polygon') { if (!hit || hit.faceIndex === undefined || hit.faceIndex === null || !mesh || (hit.object.parent as any)?._obj !== target) return null; const dm = (hit.object as THREE.Mesh).geometry as any; const src = dm._src as MeshData; const pi = src.triPoly[hit.faceIndex]; if (src !== mesh) return null; return { obj: target, kind, item: pi, worldPoint: [hit.point.x, hit.point.y, hit.point.z] as V3 }; }
    const M = target.globalMatrix(); prepCam(vp, at.r);
    const n = pts.length / 3; const pp = new Array(n); for (let i = 0; i < n; i++) pp[i] = project(vp, at.r, M, pts, i);
    if (kind === 'point') { let best = -1, bd = 12; for (let i = 0; i < n; i++) { const d = Math.hypot(pp[i].x - at.x, pp[i].y - at.y); if (d < bd) { bd = d; best = i; } } return best >= 0 ? { obj: target, kind, item: best, worldPoint: wp(best) } : null; }
    if (!mesh) return null;
    let bestE: [number, number] | null = null, bd = 8;
    for (const [a, b] of meshEdges(mesh)) { const d = distToSeg(at.x, at.y, pp[a], pp[b]); if (d < bd) { bd = d; bestE = [a, b]; } }
    if (!bestE) return null; const A = wp(bestE[0]), B = wp(bestE[1]); const w: V3 = hit ? [hit.point.x, hit.point.y, hit.point.z] : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    return { obj: target, kind, item: edgeKey(bestE[0], bestE[1]), worldPoint: w };
  };
  /** World point under the cursor on the construction plane (view plane through the origin, or the ground in perspective). */
  const planePoint = (vp: Viewport, nx: number, ny: number): V3 => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), vp.camera);
    const n = vp.kind === 'persp' ? new THREE.Vector3(0, 1, 0) : vp.camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane(n, 0); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) { ray.ray.at(30, p); }
    return [p.x, p.y, p.z];
  };

  // ---- interaction
  interface Drag { vp: Viewport; at: any; sx: number; sy: number; button: number; start: Map<string, number>; objs: X3DObject[]; camPos: THREE.Vector3; tgt: THREE.Vector3; moved: boolean; tweak?: { op: MoveComponentOperator; obj: X3DObject; pts: number[]; weights: Map<number, number>; startDeltas: Map<number, V3>; fresh: boolean } }
  let drag: Drag | null = null;
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const at = vpAt(e); if (!at) return;
    vps[active].el.classList.remove('active'); active = at.i; vps[active].el.classList.add('active');
    const vp = vps[at.i]; prepCam(vp, at.r); (window as any).__viewDir = vp.camera.getWorldDirection(new THREE.Vector3()).toArray();
    const start = new Map<string, number>();
    const objs = app.selectedObjects;
    for (const o of objs) for (const p of o.kinematics.local.params) start.set(o.id + '.' + p.name, p.value);
    drag = { vp, at, sx: e.clientX, sy: e.clientY, button: e.button, start, objs, camPos: vp.camera.position.clone(), tgt: orbit.target.clone(), moved: false };
    renderer.domElement.setPointerCapture(e.pointerId);
    const cs = app.compSel;
    if (e.button === 0 && !e.altKey && !app.activeTool && tool.mode !== 'select' && cs && cs.obj.primitive) {
      const prim = cs.obj.primitive; const top = prim.operators[prim.operators.length - 1];
      const fresh = !(top instanceof MoveComponentOperator); const op = fresh ? new MoveComponentOperator() : top as MoveComponentOperator;
      if (fresh) prim.addOperator(op);
      const g = prim.geom(); const mesh = prim.mesh();
      const pts = [...(cs.kind === 'point' ? cs.points : cs.kind === 'polygon' ? new Set([...cs.polygons].flatMap(p => mesh?.polygons[p] ?? [])) : new Set([...cs.edges].flatMap(k => k.split('-').map(Number))))];
      const weights = new Map<number, number>(); for (const p of pts) weights.set(p, 1);
      if (app.proportional.on) { const all = geomPoints(g)!; const n = all.length / 3; const r = app.proportional.radius; for (let i = 0; i < n; i++) { if (weights.has(i)) continue; let best = 0; for (const p of pts) { const d = Math.hypot(all[i * 3] - all[p * 3], all[i * 3 + 1] - all[p * 3 + 1], all[i * 3 + 2] - all[p * 3 + 2]); if (d < r) best = Math.max(best, 1 - d / r); } if (best > 0) weights.set(i, best * best * (3 - 2 * best)); } }
      drag.tweak = { op, obj: cs.obj, pts: [...weights.keys()], weights, startDeltas: new Map([...op.deltas].map(([k, v]) => [k, [...v] as V3])), fresh };
    }
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag) { if (app.activeTool?.onMove) { /* sketch needs button held */ } return; }
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    const vp = drag.vp, cam = vp.camera as any;
    const navigating = e.altKey || drag.button !== 0;
    if (navigating) {
      if (drag.button === 1 || (drag.button === 0 && e.altKey && !e.ctrlKey && vp.kind === 'ortho') || (drag.button === 0 && e.altKey && e.shiftKey)) {
        const scale = vp.kind === 'ortho' ? (cam._zoom ?? 20) * 2 / drag.at.r.h : drag.camPos.distanceTo(drag.tgt) / 400;
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        const off = right.multiplyScalar(-dx * scale).add(up.multiplyScalar(dy * scale));
        cam.position.copy(drag.camPos).add(off); if (vp.kind === 'persp') orbit.target.copy(drag.tgt).add(off);
      } else if (drag.button === 2 || (drag.button === 0 && e.altKey && e.ctrlKey)) {
        if (vp.kind === 'ortho') cam._zoom = Math.max(0.5, (cam._zoom ?? 20) * (1 + dy * 0.005)); else { const d = drag.camPos.clone().sub(drag.tgt); cam.position.copy(drag.tgt).add(d.multiplyScalar(Math.max(0.05, 1 + dy * 0.005))); }
      } else if (drag.button === 0 && e.altKey && vp.kind === 'persp') {
        const d = drag.camPos.clone().sub(drag.tgt); const sph = new THREE.Spherical().setFromVector3(d); sph.theta -= dx * 0.008; sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - dy * 0.008)); cam.position.copy(orbit.target).add(new THREE.Vector3().setFromSpherical(sph));
      }
      if (vp.kind === 'persp') cam.lookAt(orbit.target);
      needs = true; return;
    }
    if (app.activeTool) { if (app.activeTool.onMove && drag.moved) { const at = vpAt(e); if (at) { app.activeTool.onMove(planePoint(vp, at.nx, at.ny)); syncToolPreview(); needs = true; } } return; }
    if (tool.mode === 'select') {
      if (!drag.moved) return;
      const b = root.getBoundingClientRect();
      const x0 = Math.min(drag.sx, e.clientX) - b.left, y0 = Math.min(drag.sy, e.clientY) - b.top;
      rubber.style.display = 'block'; rubber.style.left = x0 + 'px'; rubber.style.top = y0 + 'px'; rubber.style.width = Math.abs(dx) + 'px'; rubber.style.height = Math.abs(dy) + 'px';
      return;
    }
    const pxScale = vp.kind === 'ortho' ? (cam._zoom ?? 20) * 2 / drag.at.r.h : drag.camPos.distanceTo(drag.tgt) / 400;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const delta = right.multiplyScalar(dx * pxScale).add(up.multiplyScalar(-dy * pxScale));
    if (drag.tweak) {
      const t = drag.tweak; const inv = t.obj.globalMatrix().invert(); inv.setPosition(0, 0, 0);
      const ld = delta.clone().applyMatrix4(inv); const d: V3 = [tool.axes.x ? ld.x : 0, tool.axes.y ? ld.y : 0, tool.axes.z ? ld.z : 0];
      const prim = t.obj.primitive!; const base = geomPoints(prim.operators.slice(0, -1).reduce((m: any, op) => op.apply(m), null)) ?? geomPoints(prim.geom())!;
      if (tool.mode === 'translate') for (const p of t.pts) { const s = t.startDeltas.get(p) ?? [0, 0, 0]; const w = t.weights.get(p) ?? 1; t.op.deltas.set(p, [s[0] + d[0] * w, s[1] + d[1] * w, s[2] + d[2] * w]); }
      else {
        const sel = t.pts.filter(p => t.weights.get(p) === 1); const c = [0, 0, 0]; for (const p of sel) for (let k = 0; k < 3; k++) c[k] += base[p * 3 + k] / sel.length;
        const f = tool.mode === 'scale' ? Math.max(0.01, 1 + dx * 0.01) : 1, ang = tool.mode === 'rotate' ? dx * 0.01 : 0;
        for (const p of t.pts) { const s = t.startDeltas.get(p) ?? [0, 0, 0]; const w = t.weights.get(p) ?? 1; const v = [base[p * 3] + s[0] - c[0], base[p * 3 + 1] + s[1] - c[1], base[p * 3 + 2] + s[2] - c[2]];
          let nv = v.map(x => x * (1 + (f - 1) * w)); if (ang) { const a = ang * w; nv = [v[0] * Math.cos(a) - v[2] * Math.sin(a), v[1], v[0] * Math.sin(a) + v[2] * Math.cos(a)]; }
          t.op.deltas.set(p, [nv[0] - v[0] + s[0], nv[1] - v[1] + s[1], nv[2] - v[2] + s[2]]); }
      }
      prim.dirty = true; sync(); return;
    }
    for (const o of drag.objs) {
      const l = o.kinematics.local;
      if (tool.mode === 'translate') { if (tool.axes.x) l.get('posx')!.value = drag.start.get(o.id + '.posx')! + delta.x; if (tool.axes.y) l.get('posy')!.value = drag.start.get(o.id + '.posy')! + delta.y; if (tool.axes.z) l.get('posz')!.value = drag.start.get(o.id + '.posz')! + delta.z; }
      else if (tool.mode === 'rotate') { const a = dx * 0.5; if (tool.axes.x && !tool.axes.y && !tool.axes.z) l.get('rotx')!.value = drag.start.get(o.id + '.rotx')! + a; else if (tool.axes.z && !tool.axes.x && !tool.axes.y) l.get('rotz')!.value = drag.start.get(o.id + '.rotz')! + a; else l.get('roty')!.value = drag.start.get(o.id + '.roty')! + a; }
      else if (tool.mode === 'scale') { const f = Math.max(0.01, 1 + dx * 0.01); for (const ax of ['x', 'y', 'z']) if ((tool.axes as any)[ax]) l.get('scl' + ax)!.value = drag.start.get(o.id + '.scl' + ax)! * f; }
    }
    sync(); app.events.emit('params');
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!drag) return; const d = drag; drag = null; rubber.style.display = 'none';
    const mode = e.shiftKey ? 'add' : e.ctrlKey ? 'toggle' : 'replace';
    if (app.activeTool) {
      const t = app.activeTool; const at = vpAt(e); if (!at) return; const vp = vps[at.i]; prepCam(vp, at.r);
      if (d.button === 2 && !d.moved) { t.onFinish(); sync(); return; }
      if (d.button !== 0 || e.altKey) return;
      if (d.moved && !t.onMove) return;
      const po = pickObject(vp, at.nx, at.ny); const pc = t.pickKind ? pickComponent(vp, at, po?.obj, po?.hit, t.pickKind) : null;
      t.onClick(pc?.worldPoint ?? planePoint(vp, at.nx, at.ny), pc, { shift: e.shiftKey, ctrl: e.ctrlKey }); sync(); return;
    }
    if (d.tweak) {
      const t = d.tweak; const before = t.startDeltas, after = new Map([...t.op.deltas].map(([k, v]) => [k, [...v] as V3]));
      const prim = t.obj.primitive!;
      if (!d.moved) { if (t.fresh) prim.removeOperator(t.op); }
      else app.record('Move Component', () => { if (t.fresh && !prim.operators.includes(t.op)) prim.addOperator(t.op); t.op.deltas.clear(); for (const [k, v] of after) t.op.deltas.set(k, v); prim.dirty = true; }, () => { t.op.deltas.clear(); for (const [k, v] of before) t.op.deltas.set(k, v); if (t.fresh) prim.removeOperator(t.op); prim.dirty = true; });
      if (d.moved) { app.logMsg('cmd', `MoveComponent("${t.obj.name}", ${t.pts.length} points${app.proportional.on ? ', proportional' : ''})`); app.events.emit('scene'); }
      sync(); return;
    }
    if (!d.moved && d.button === 0 && !e.altKey) {
      const at = vpAt(e); if (!at) return; const vp = vps[at.i]; prepCam(vp, at.r);
      const po = pickObject(vp, at.nx, at.ny);
      if (app.selMode === 'object') { app.select(po ? [po.obj] : [], mode); return; }
      const pc = pickComponent(vp, at, po?.obj, po?.hit);
      if (pc) app.selectComponents(pc.obj, pc.kind, [pc.item], mode);
      else if (po && mode === 'replace') { app.compSel = null; app.select([po.obj]); }
      else if (mode === 'replace') { app.compSel = null; app.select([]); }
      return;
    }
    if (d.moved && d.button === 0 && !e.altKey && tool.mode === 'select') {
      const vp = d.vp, r = d.at.r; prepCam(vp, r);
      const b = renderer.domElement.getBoundingClientRect();
      const x0 = Math.min(d.sx, e.clientX) - b.left, x1 = Math.max(d.sx, e.clientX) - b.left, y0 = Math.min(d.sy, e.clientY) - b.top, y1 = Math.max(d.sy, e.clientY) - b.top;
      const inside = (p: { x: number; y: number }) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
      if (app.selMode === 'object') {
        const hit: X3DObject[] = [];
        for (const o of app.scene.allObjects()) { if (!o.visible) continue; const v = new THREE.Vector3().setFromMatrixPosition(o.globalMatrix()).project(vp.camera); const p = { x: r.x + ((v.x + 1) / 2) * r.w, y: r.y + ((1 - v.y) / 2) * r.h }; const pts = o.primitive ? geomPoints(o.primitive.geom()) : null; let any = inside(p); if (!any && pts) { const M = o.globalMatrix(); for (let i = 0; i < pts.length / 3 && !any; i += Math.max(1, Math.floor(pts.length / 3 / 400))) any = inside(project(vp, r, M, pts, i)); } if (any) hit.push(o); }
        app.select(hit, mode); return;
      }
      const target = compTarget(); const pts = target?.primitive ? geomPoints(target.primitive.geom()) : null; if (!target || !pts) return;
      const M = target.globalMatrix(); const n = pts.length / 3; const pp = new Array(n); for (let i = 0; i < n; i++) pp[i] = project(vp, r, M, pts, i);
      const kind = app.selMode as 'point' | 'edge' | 'polygon'; const mesh = target.primitive!.mesh();
      if (kind === 'point') app.selectComponents(target, 'point', pp.map((p, i) => inside(p) ? i : -1).filter(i => i >= 0), mode);
      else if (!mesh) return;
      else if (kind === 'edge') app.selectComponents(target, 'edge', meshEdges(mesh).filter(([a, b]) => inside(pp[a]) && inside(pp[b])).map(([a, b]) => edgeKey(a, b)), mode);
      else app.selectComponents(target, 'polygon', mesh.polygons.map((f, i) => f.every(v => inside(pp[v])) ? i : -1).filter(i => i >= 0), mode);
      return;
    }
    if (d.moved && d.button === 0 && !e.altKey && tool.mode !== 'select' && d.objs.length) {
      const cmd = tool.mode === 'translate' ? 'Translate' : tool.mode === 'rotate' ? 'Rotate' : 'Scale';
      const prefix = tool.mode === 'translate' ? 'pos' : tool.mode === 'rotate' ? 'rot' : 'scl';
      for (const o of d.objs) {
        const l = o.kinematics.local; const end = ['x', 'y', 'z'].map(ax => l.get(prefix + ax)!.value);
        ['x', 'y', 'z'].forEach(ax => { l.get(prefix + ax)!.value = d.start.get(o.id + '.' + prefix + ax)!; });
        app.run(cmd, { InputObj: [o], X: end[0], Y: end[1], Z: end[2], Mode: 'siAbsolute' });
      }
    }
  });
  renderer.domElement.addEventListener('wheel', (e) => {
    const at = vpAt(e); if (!at) return; e.preventDefault();
    const vp = vps[at.i], cam = vp.camera as any, f = 1 + Math.sign(e.deltaY) * 0.1;
    if (vp.kind === 'ortho') cam._zoom = Math.max(0.5, (cam._zoom ?? 20) * f); else { const d = cam.position.clone().sub(orbit.target); cam.position.copy(orbit.target).add(d.multiplyScalar(f)); }
    needs = true;
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (!app.activeTool) return; if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'Enter') { app.activeTool.onFinish(); sync(); } else if (e.key === 'Escape') { app.activeTool.onCancel(); app.activeTool = null; app.events.emit('selection'); sync(); }
  });

  app.events.on('scene', sync); app.events.on('selection', sync); app.events.on('params', sync); app.events.on('frame', sync);
  window.addEventListener('resize', resize);
  sync();
  return { frameAll: () => { for (const vp of vps) switchView(vp, vp.name); needs = true; } };
}

function distToSeg(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1; let t = ((px - a.x) * dx + (py - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}
function polygonWire(mesh: { positions: Float32Array; polygons: number[][] }) {
  const idx: number[] = [];
  for (const f of mesh.polygons) for (let i = 0; i < f.length; i++) idx.push(f[i], f[(i + 1) % f.length]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3)); g.setIndex(idx); return g;
}
function marker(o: X3DObject): THREE.Object3D {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x9ad24a });
  const line = (pts: number[][], close = false) => { const p = pts.map(q => new THREE.Vector3(...q)); if (close) p.push(p[0].clone()); const geo = new THREE.BufferGeometry().setFromPoints(p); return new THREE.Line(geo, mat.clone()); };
  const circle = (r: number, axis: 'x' | 'y' | 'z', n = 24) => { const pts: number[][] = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(axis === 'y' ? [r * Math.cos(a), 0, r * Math.sin(a)] : axis === 'x' ? [0, r * Math.cos(a), r * Math.sin(a)] : [r * Math.cos(a), r * Math.sin(a), 0]); } return line(pts, true); };
  const t = o.type;
  if (t === 'camera') { g.add(line([[-1, -0.7, 0], [1, -0.7, 0], [1, 0.7, 0], [-1, 0.7, 0]], true)); g.add(line([[0, 0, 0], [0, 0, -3]])); g.add(line([[-0.6, 0.7, 0], [0, 1.4, 0], [0.6, 0.7, 0]])); g.add(line([[-1.5, -1, -3], [1.5, -1, -3], [1.5, 1, -3], [-1.5, 1, -3]], true)); }
  else if (t === 'light') { const kind = o.primitive?.val('type'); if (kind === 'spot') { g.add(line([[0, 0, 0], [1, 0, -3]])); g.add(line([[0, 0, 0], [-1, 0, -3]])); g.add(line([[0, 0, 0], [0, 1, -3]])); g.add(line([[0, 0, 0], [0, -1, -3]])); g.add(circle(1, 'z').translateZ(-3)); } else if (kind === 'infinite') { g.add(line([[0, 0, 0], [0, 0, -4]])); g.add(line([[0, 0, -4], [0.4, 0, -3.2]])); g.add(line([[0, 0, -4], [-0.4, 0, -3.2]])); } else { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(line([[Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0], [Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0]])); } } }
  else if (t === 'bone') { const L = Number(o.val('length') ?? 2), w = Math.min(0.5, L * 0.12); const b = [[0, 0, 0], [L * 0.15, w, 0], [L, 0, 0], [L * 0.15, -w, 0], [0, 0, 0], [L * 0.15, 0, w], [L, 0, 0], [L * 0.15, 0, -w], [0, 0, 0]]; g.add(line(b)); g.add(line([[L * 0.15, w, 0], [L * 0.15, 0, w], [L * 0.15, -w, 0], [L * 0.15, 0, -w]], true)); }
  else if (t === 'root') { g.add(line([[-0.7, 0, 0], [0.7, 0, 0]])); g.add(line([[0, -0.7, 0], [0, 0.7, 0]])); g.add(line([[0, 0, -0.7], [0, 0, 0.7]])); g.add(circle(0.7, 'y', 12)); }
  else if (t === 'eff') { g.add(line([[0.6, 0, 0], [0, 0.6, 0], [-0.6, 0, 0], [0, -0.6, 0]], true)); g.add(line([[0, 0, 0.6], [0, 0.6, 0], [0, 0, -0.6], [0, -0.6, 0]], true)); }
  else if (t === 'implicit') { const s = Number(o.primitive?.val('size') ?? 4) / 2; const shape = String(o.primitive?.val('shape')); const sq = (y: number) => line([[-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]], true);
    if (shape === 'Cube') { g.add(sq(-s), sq(s)); for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) g.add(line([[x, -s, z], [x, s, z]])); }
    else if (shape === 'Sphere') { g.add(circle(s, 'x'), circle(s, 'y'), circle(s, 'z')); }
    else if (shape === 'Cylinder') { g.add(circle(s, 'y').translateY(-s), circle(s, 'y').translateY(s)); for (const [x, z] of [[-s, 0], [s, 0], [0, -s], [0, s]]) g.add(line([[x, -s, z], [x, s, z]])); }
    else if (shape === 'Cone') { g.add(circle(s, 'y').translateY(-s)); for (const [x, z] of [[-s, 0], [s, 0], [0, -s], [0, s]]) g.add(line([[x, -s, z], [0, s, 0]])); }
    else if (shape === 'Torus') { g.add(circle(s, 'y'), circle(s * 0.6, 'y'), circle(s * 1.4, 'y')); }
    else if (shape === 'Grid' || shape === 'Square') { g.add(sq(0)); if (shape === 'Grid') { g.add(line([[-s, 0, 0], [s, 0, 0]])); g.add(line([[0, 0, -s], [0, 0, s]])); } }
    else if (shape === 'Disc' || shape === 'Circle') { g.add(circle(s, 'y')); } else if (shape === 'Arc') { const pts: number[][] = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; pts.push([s * Math.cos(a), 0, s * Math.sin(a)]); } g.add(line(pts)); }
    else if (shape === 'Spiral') { const pts: number[][] = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 6; pts.push([s * (i / 48) * Math.cos(a), i / 48 * s, s * (i / 48) * Math.sin(a)]); } g.add(line(pts)); }
    else if (shape === 'Bone') { g.add(line([[0, 0, 0], [s * 0.3, s * 0.3, 0], [2 * s, 0, 0], [s * 0.3, -s * 0.3, 0]], true)); }
  }
  else { g.add(line([[-1, 0, 0], [1, 0, 0]])); g.add(line([[0, -1, 0], [0, 1, 0]])); g.add(line([[0, 0, -1], [0, 0, 1]])); if (o.kind === 'model') g.add(line([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]], true)); }
  return g;
}
export { Bone };
