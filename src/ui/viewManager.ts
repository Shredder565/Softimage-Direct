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
import { installViewExtras, DISPLAY_MENU } from './viewExtras';
import { SI_MENUS, SiMenuItem, openSiMenu, siIcon, hasIcon } from './si';

/** Scene colours and display preferences, decoded from Softimage 2015's C3DSceneColors / C3DPrefsDisplay / C3DPrefsTweak SPDL defaults. */
export const SI = {
  selected: 0xffffff, geometry: 0x000000, active: 0xffd200, component: 0xff0000, vertex: 0x0000ff, highlight: 0xe1ffff, subselection: 0xa0bcbc,
  background: 0x7f7f7f, grid: 0x191919, viewport: 0x666666, light: 0xcd4b00, camera: 0x1428a0, nullcol: 0x006200, ctrl: 0x006200,
  pointSize: 5, pickTol: 15, clickToDeselect: false, surroundPolygons: false, surroundEdges: false,
};
export type ToolMode = 'select' | 'translate' | 'rotate' | 'scale';
export const tool = { mode: 'select' as ToolMode, axes: { x: true, y: true, z: true }, setMode: (_m: ToolMode) => { } };
(window as any).__tool = tool;

/** Per-viewport state: the camdisp display mode and the camvis "eye" menu toggles (C3DCameraVisibilityProp). */
interface Viewport { name: string; kind: 'ortho' | 'persp'; camera: THREE.Camera; el: HTMLElement; display: string; flags: Record<string, boolean>; head: { view: HTMLElement; disp: HTMLElement; labels: HTMLElement }; x?: any }
export const DISPLAY_MODES = ['Bounding Box', 'Wireframe', 'Hidden Line', 'Constant', 'Shaded', 'Textured', 'Texture Decal', 'Realtime Shaders'];
const VIS_DEFAULT: Record<string, boolean> = { 'Grid': true, 'Lights': true, 'Cameras': true, '3D Geometry': true, 'Implicit Geometry': true, 'Curves': true, 'Point Clouds': true, 'Nulls': true, 'Chains': true, 'Lattices': true, 'Control Objects': true, 'Name': false, 'Points': false, 'Centers': false, 'Normals': false, 'Polygon Normals': false, 'XRay Surfaces': false, 'Selection Info': false, 'PolyMesh Boundaries and Hard Edges': false, 'Subdivision Surfaces': true };
type V3 = [number, number, number];

export function viewManager(app: App, host: HTMLElement) {
  const root = document.createElement('div'); root.className = 'vm'; host.appendChild(root);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);
  const labels = document.createElement('div'); labels.className = 'vp-labels'; root.appendChild(labels);
  const rubber = document.createElement('div'); rubber.className = 'rubber'; rubber.style.display = 'none'; root.appendChild(rubber);
  const toolHint = document.createElement('div'); toolHint.className = 'tool-hint'; toolHint.style.display = 'none'; root.appendChild(toolHint);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(SI.background);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const defaultLights = new THREE.Group(); const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(12, 20, 15); const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-15, 5, -10); defaultLights.add(key, fill); scene.add(defaultLights);
  let grid = new THREE.GridHelper(40, 40, SI.grid, 0x5e5e5e); grid.name = 'grid'; scene.add(grid);
  const axesH = new THREE.AxesHelper(4); scene.add(axesH);
  // Component display: selected polygons = translucent Component red, selected edges/points = Component red,
  // unselected points (point mode only) = Vertex blue at the Display pref point size, hover = Highlight colour.
  const hlPolys = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: SI.component, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); hlPolys.renderOrder = 10; scene.add(hlPolys);
  const hlEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: SI.component, depthTest: true })); hlEdges.renderOrder = 11; scene.add(hlEdges);
  const hlPoints = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: SI.component, size: SI.pointSize, sizeAttenuation: false, depthTest: true })); hlPoints.renderOrder = 12; scene.add(hlPoints);
  const allPoints = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: SI.vertex, size: SI.pointSize, sizeAttenuation: false, depthTest: true })); allPoints.renderOrder = 9; scene.add(allPoints);
  const hoverPoly = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: SI.highlight, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); hoverPoly.renderOrder = 13; scene.add(hoverPoly);
  const hoverLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: SI.highlight, depthTest: true })); hoverLine.renderOrder = 14; scene.add(hoverLine);
  const hoverPoint = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: SI.highlight, size: SI.pointSize + 2, sizeAttenuation: false, depthTest: true })); hoverPoint.renderOrder = 15; scene.add(hoverPoint);
  const gizmo = new THREE.Group(); scene.add(gizmo);
  const toolPreview = new THREE.Group(); scene.add(toolPreview);
  (window as any).__three = { scene, needs: () => { needs = true; } };

  const mk = (name: string, kind: 'ortho' | 'persp', pos: THREE.Vector3, up: THREE.Vector3): Viewport => {
    const cam: THREE.Camera = kind === 'ortho' ? new THREE.OrthographicCamera(-20, 20, 20, -20, -1000, 1000) : new THREE.PerspectiveCamera(53.6, 1, 0.1, 5000);
    cam.position.copy(pos); cam.up.copy(up); cam.lookAt(0, 0, 0);
    const el = document.createElement('div'); el.className = 'vp-label';
    const head = document.createElement('div'); head.className = 'vp-head';
    const b = document.createElement('b'); b.textContent = 'ABCD'[vps.length]; b.title = 'Viewport ' + 'ABCD'[vps.length];
    const mbtn = (text: string, title: string, icon?: string) => { const x = document.createElement('button'); x.className = 'vp-menu-btn'; if (icon && hasIcon(icon)) x.appendChild(siIcon(icon, 0.5)); else x.textContent = text; x.title = title; return x; };
    const viewBtn = mbtn(name, 'View menu: cameras and orthographic views'); const camBtn = mbtn('📷', 'Camera menu', 'camera'); const eyeBtn = mbtn('👁', 'Visibility menu (Shift+S)');
    const sp = document.createElement('div'); sp.className = 'spacer';
    const dispBtn = mbtn(kind === 'persp' ? 'Shaded' : 'Wireframe', 'Display mode'); const stereoBtn = mbtn('◐', 'Stereo menu'); const cubeBtn = mbtn('⌂', 'ViewCube menu');
    const vlabels = document.createElement('div'); vlabels.className = 'vp-names';
    head.append(b, viewBtn, camBtn, eyeBtn, sp, dispBtn, stereoBtn, cubeBtn); el.append(head, vlabels); labels.appendChild(el);
    const vp: Viewport = { name, kind, camera: cam, el, display: dispBtn.textContent!.toLowerCase(), flags: { ...VIS_DEFAULT }, head: { view: viewBtn, disp: dispBtn, labels: vlabels } };
    const at = (x: HTMLElement) => { const r = x.getBoundingClientRect(); return { x: r.left, y: r.bottom }; };
    viewBtn.onclick = (e) => { e.stopPropagation(); const p = at(viewBtn); const cams = [...app.scene.allObjects()].filter(o => o.type === 'camera' || o.type === 'light').map(o => ({ label: o.name, id: -10 }));
      openSiMenu([...(SI_MENUS.vmLayout ?? []).map(it => ({ ...it, label: it.label === 'Perspective' ? 'Camera' : it.label })), { separator: true }, ...cams, { separator: true }, { label: 'User', id: -11 }], p.x, p.y, (it) => { switchView(vp, it.label!); needs = true; }, { checked: it => it.label === vp.name }); };
    camBtn.onclick = (e) => { e.stopPropagation(); const p = at(camBtn); openSiMenu(SI_MENUS.viewCamera ?? [], p.x, p.y, (it) => cameraMenu(vp, it.label!), {}); };
    eyeBtn.onclick = (e) => { e.stopPropagation(); const p = at(eyeBtn); openSiMenu(SI_MENUS.viewVisibility ?? [], p.x, p.y, (it) => visibilityMenu(vp, it.label!), { checked: it => it.label! in vp.flags ? vp.flags[it.label!] : undefined }); };
    dispBtn.onclick = (e) => { e.stopPropagation(); const p = at(dispBtn); openSiMenu(DISPLAY_MENU, p.x, p.y, (it, path) => XT.displayMenu(vp, it.label!, path), { checked: XT.displayChecked(vp) }); };
    stereoBtn.onclick = (e) => { e.stopPropagation(); const p = at(stereoBtn); openSiMenu(XT.stereoMenuItems(), p.x, p.y, (it) => XT.stereoMenu(vp, it.label!), { checked: XT.stereoChecked(vp) }); };
    cubeBtn.onclick = (e) => { e.stopPropagation(); const p = at(cubeBtn); openSiMenu(SI_MENUS.viewCube ?? [], p.x, p.y, (it) => { if (it.label === 'Home' || it.label === 'Reset Home') switchView(vp, vp.name); else if (it.label === 'Lock to Selection') { (window as any).__orbitSelected = (window as any).__orbitSelected ? 0 : 2; } else app.logMsg('info', `ViewCube: ${it.label} not implemented`); needs = true; }, {}); };
    return vp;
  };
  const vps: Viewport[] = [];
  vps.push(mk('Top', 'ortho', new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, 0, -1)));
  vps.push(mk('Camera', 'persp', new THREE.Vector3(9.5, 7.3, 12.3), new THREE.Vector3(0, 1, 0)));
  vps.push(mk('Front', 'ortho', new THREE.Vector3(0, 0, 100), new THREE.Vector3(0, 1, 0)));
  vps.push(mk('Right', 'ortho', new THREE.Vector3(100, 0, 0), new THREE.Vector3(0, 1, 0)));
  const setDisplay = (vp: Viewport, mode: string) => { vp.display = mode.toLowerCase().replace('textured decal', 'texture decal').replace('hidden line removal', 'hidden line'); vp.head.disp.textContent = DISPLAY_MODES.find(m => m.toLowerCase() === vp.display) ?? mode; needs = true; };
  const cameraMenu = (vp: Viewport, label: string) => {
    switch (label) {
      case 'Frame Selection': frameBox(app.selectedObjects); return; case 'Center Selection': frameBox(app.selectedObjects, true); return; case 'Frame All': frameBox([...app.scene.allObjects()].filter(o => o.visible)); return;
      case 'Reset': switchView(vp, vp.name); needs = true; return; case 'Set Background to Black': scene.background = new THREE.Color(0x000000); needs = true; return; case 'Set Background to Grey': scene.background = new THREE.Color(SI.background); needs = true; return;
      case 'Select Camera': { const c = [...app.scene.allObjects()].find(o => o.type === 'camera'); if (c) app.select([c]); return; } case 'Properties...': { const c = [...app.scene.allObjects()].find(o => o.type === 'camera'); if (c) app.events.emit('inspect', c); return; }
      case 'Undo': app.undo(); return; case 'Redo': app.redo(); return; case 'Scene Colors...': window.dispatchEvent(new CustomEvent('openprefs', { detail: { page: 'Scene Colors' } })); return;
    }
    if (!XT.cameraMenu(vp, label)) app.logMsg('info', `Camera menu: ${label} not implemented`);
  };
  const visibilityMenu = (vp: Viewport, label: string) => {
    if (label in vp.flags) { vp.flags[label] = !vp.flags[label]; needs = true; return; }
    if (label === 'Check All Objects' || label === 'Uncheck All Objects') { for (const k of ['Lights', 'Cameras', '3D Geometry', 'Implicit Geometry', 'Curves', 'Point Clouds', 'Nulls', 'Chains', 'Lattices', 'Control Objects']) vp.flags[k] = label.startsWith('Check'); needs = true; return; }
    if (label === 'Check All' || label === 'Uncheck All') { for (const k of ['Name', 'Points', 'Centers', 'Normals', 'Polygon Normals', 'XRay Surfaces', 'PolyMesh Boundaries and Hard Edges']) vp.flags[k] = label === 'Check All'; needs = true; return; }
    if (label === 'Visibility Options...') { window.dispatchEvent(new CustomEvent('openvisibility', { detail: { vp: vp.name } })); return; }
    if (!XT.visibilityMenu(vp, label)) app.logMsg('info', `Visibility menu: ${label} not implemented`);
  };
  const orbit = { target: new THREE.Vector3(0, 0, 0) };
  const switchView = (vp: Viewport, name: string) => {
    const c = vp.camera;
    if (name === 'Top') { c.position.set(0, 100, 0); c.up.set(0, 0, -1); } else if (name === 'Front') { c.position.set(0, 0, 100); c.up.set(0, 1, 0); } else if (name === 'Right') { c.position.set(100, 0, 0); c.up.set(0, 1, 0); } else { c.position.set(9.5, 7.3, 12.3); c.up.set(0, 1, 0); }
    vp.name = name; vp.head.view.textContent = name; c.lookAt(orbit.target); (c as any)._zoom = 20;
  };
  let active = 1; vps[active].el.classList.add('active');

  // ---- scene sync
  const nodes = new Map<X3DObject, THREE.Group>();
  const matCache = new Map<string, THREE.Material>();
  const texCache = new Map<string, THREE.Texture>();
  const materialFor = (o: X3DObject, textured: boolean): THREE.Material => {
    const mat = o.material ?? app.scene.root.material; const sh = mat?.surface; const type = sh?.type ?? 'Phong';
    const col = (sh?.val('diffuse') as number[] | undefined) ?? [0.7, 0.7, 0.7]; const img = textured ? ((sh?.inputs.get('diffuse')?.val('tex') as string | undefined) || (sh?.val('image') as string | undefined) || undefined) : undefined;
    const keyc = `${type}|${col.map(x => x.toFixed(3)).join(',')}|${sh?.val('shiny') ?? ''}|${sh?.val('roughness') ?? ''}|${sh?.val('metalness') ?? ''}|${JSON.stringify(sh?.val('transparency') ?? 0)}|${img ? img.length : 0}`;
    let m = matCache.get(keyc);
    if (!m) {
      const color = new THREE.Color(col[0], col[1], col[2]); const opts: any = { color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 };
      switch (type) {
        case 'Lambert': case 'Ambient Occlusion': m = new THREE.MeshLambertMaterial(opts); break;
        case 'Constant': m = new THREE.MeshBasicMaterial(opts); break;
        case 'Cook-Torrance': case 'Strauss': case 'Architectural': case 'Car Paint': m = new THREE.MeshStandardMaterial({ ...opts, roughness: Number(sh?.val('roughness') ?? 0.4), metalness: Number(sh?.val('metalness') ?? 0.1) }); break;
        case 'Anisotropic': m = new THREE.MeshPhysicalMaterial({ ...opts, roughness: 0.35, metalness: 0.6, anisotropy: Number(sh?.val('anisotropy') ?? 0.5) }); break;
        case 'Toon': m = new THREE.MeshToonMaterial(opts); break;
        default: m = new THREE.MeshPhongMaterial({ ...opts, shininess: Number(sh?.val('shiny') ?? 50) * 0.6, specular: new THREE.Color(0x444444) });
      }
      const trv = sh?.val('transparency'); const tr = Array.isArray(trv) ? (trv[0] + trv[1] + trv[2]) / 3 : Number(trv ?? 0); if (tr > 0) { m.transparent = true; m.opacity = 1 - tr; }
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
        applyUserNormals(o, m, mesh); applyPaintDisplay(o, m, mesh);
        // Wireframe colour: Selected white; the object active for component selection uses the Active colour;
        // otherwise the object's wire colour (layer colour, else the Geometry scene colour = black).
        const dp = o.property('display'); const lc = dp?.val('wirecol') ? new THREE.Color(...(dp.val('wirecolorrgb') as V3)) : o.layer ? new THREE.Color(...(o.layer.val('color') as V3)) : new THREE.Color(SI.geometry);
        const activeComp = app.selMode !== 'object' && o === compTarget();
        (w!.material as THREE.LineBasicMaterial).color.copy(activeComp ? new THREE.Color(SI.active) : selected ? new THREE.Color(SI.selected) : lc);
        (w as any)._selected = selected || activeComp;
        removeChild(g, 'marker');
      } else if (o.primitive?.type === 'crvlist' && payload?.cvs) {
        removeChild(g, 'mesh'); removeChild(g, 'wire');
        let ln = child(g, 'marker') as THREE.Line | undefined;
        if (!ln || (ln as any)._src !== payload) { const pts = tessellateCurve(payload, 8).map(p => new THREE.Vector3(...p)); const geo = new THREE.BufferGeometry().setFromPoints(pts); if (ln) { ln.geometry.dispose(); ln.geometry = geo; } else { ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff })); (ln as any)._kind = 'marker'; g.add(ln); } (ln as any)._src = payload; }
        (ln.material as THREE.LineBasicMaterial).color.set(selected ? SI.selected : SI.geometry);
      } else if (o.primitive?.type === 'lattice' && payload?.points) {
        removeChild(g, 'mesh'); removeChild(g, 'wire');
        let ln = child(g, 'marker') as THREE.LineSegments | undefined;
        if (!ln || (ln as any)._src !== payload) { const [sx, sy, sz] = payload.sub; const idx = (i: number, j: number, k: number) => k * (sy + 1) * (sx + 1) + j * (sx + 1) + i; const ix: number[] = []; for (let k = 0; k <= sz; k++) for (let j = 0; j <= sy; j++) for (let i = 0; i <= sx; i++) { if (i < sx) ix.push(idx(i, j, k), idx(i + 1, j, k)); if (j < sy) ix.push(idx(i, j, k), idx(i, j + 1, k)); if (k < sz) ix.push(idx(i, j, k), idx(i, j, k + 1)); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(geomPoints(payload)!, 3)); geo.setIndex(ix); if (ln) { ln.geometry.dispose(); ln.geometry = geo; } else { ln = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff })); (ln as any)._kind = 'marker'; g.add(ln); } (ln as any)._src = payload; }
        (ln.material as THREE.LineBasicMaterial).color.set(selected ? SI.selected : SI.ctrl);
      } else {
        removeChild(g, 'mesh'); removeChild(g, 'wire');
        let mkr = child(g, 'marker') as THREE.Object3D | undefined; const tag = kindTag + '|' + (o.primitive?.name ?? '') + '|' + (o.val?.('length') ?? '') + '|' + (o.primitive?.val('size') ?? '') + '|' + (o.type === 'standin' ? o.primitive!.params.map(p => p.value).join(',') : '');
        if (!mkr || (mkr as any)._tag !== tag) { if (mkr) g.remove(mkr); mkr = marker(o); (mkr as any)._kind = 'marker'; (mkr as any)._tag = tag; g.add(mkr); }
        const colr = selected ? SI.selected : o.kind === 'model' ? SI.nullcol : o.type === 'bone' || o.type === 'root' ? 0xe0c060 : o.type === 'eff' ? 0xff6060 : o.type === 'light' ? SI.light : o.type === 'camera' ? SI.camera : o.type === 'implicit' ? SI.ctrl : SI.nullcol;
        mkr.traverse(c => { if ((c as any).material && (c as any)._kind !== 'light') ((c as any).material as THREE.LineBasicMaterial).color.set(colr); });
        if (o.type === 'light') { userLights++; let L = child(g, 'light') as THREE.Light | undefined; const kind = o.primitive?.val('type'); if (!L) { L = kind === 'spot' ? new THREE.SpotLight(0xffffff, 60, 0, 0.6, 0.4) : kind === 'infinite' ? new THREE.DirectionalLight(0xffffff, 1) : new THREE.PointLight(0xffffff, 80); (L as any)._kind = 'light'; g.add(L); if ((L as any).target) { (L as any).target.position.set(0, 0, -1); g.add((L as any).target); } } const c = o.primitive?.val('soft_light.color') as number[] | undefined; if (c) L.color.setRGB(c[0], c[1], c[2]); const inten = Number(o.primitive?.val('soft_light.intensity') ?? 0.75); L.intensity = kind === 'infinite' ? inten * 1.5 : inten * 100; }
      }
    }
    defaultLights.visible = userLights === 0;
    for (const [o, g] of nodes) if (!seen.has(o)) { scene.remove(g); nodes.delete(o); }
    syncHighlights(); syncToolPreview(); syncGizmo();
    needs = true;
  };
  /** "User Normals" property: per-point overrides blended into the shading normals (Modify > Component > Set User Normals). */
  const applyUserNormals = (o: X3DObject, m: THREE.Mesh, mesh: MeshData) => {
    const p = o.property('usernormals') as any; const map: Map<number, [number, number, number]> | undefined = p?.normals; const geo = m.geometry;
    const stamp = map ? [...map.entries()].map(([k, v]) => k + ':' + v.map(x => x.toFixed(2)).join(',')).join(';') : '';
    if ((geo as any)._unStamp === stamp) return; (geo as any)._unStamp = stamp;
    geo.computeVertexNormals(); if (!map?.size || p?.val('show') === false) return;
    const n = geo.attributes.normal as THREE.BufferAttribute; for (const [i, v] of map) if (i * 3 + 2 < n.array.length) { n.setXYZ(i, v[0], v[1], v[2]); } n.needsUpdate = true;
    void mesh;
  };
  /** Weight maps / vertex colours show as vertex colours while their property is selected or a paint tool is active on the object. */
  const applyPaintDisplay = (o: X3DObject, m: THREE.Mesh, mesh: MeshData) => {
    const sel = app.selection[app.selection.length - 1]; const tool: any = app.activeTool; const prop = (sel && (sel.type === 'weightmap' || sel.type === 'vertexcolor') && sel.parent === o) ? sel : (tool?.paintObj === o ? (o.property('weightmap') ?? o.property('vertexcolor')) : null);
    const geo = m.geometry;
    if (!prop) { if ((geo as any)._painted) { geo.deleteAttribute('color'); (geo as any)._painted = false; } return; }
    const values: Map<number, any> = (prop as any).values ?? new Map(); const n = mesh.positions.length / 3; const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { if (prop.type === 'weightmap') { const w = Number(values.get(i) ?? 0); col[i * 3] = w; col[i * 3 + 1] = 0.15 + 0.3 * w; col[i * 3 + 2] = 1 - w; } else { const c = values.get(i) ?? [0.5, 0.5, 0.5]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; } }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); (geo as any)._painted = true;
    // a private vertex-coloured material (the cached ones are shared between objects)
    let pm = (m as any)._paintMat as THREE.Material | undefined; if (!pm) { pm = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 }); (m as any)._paintMat = pm; }
    (m as any)._matShaded = pm; (m as any)._matTextured = pm;
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

  // ---- SRT manipulator (Softimage: red X / green Y / blue Z handles, yellow centre square = view-plane / uniform)
  const gizmoCenter = new THREE.Vector3(); let gizmoOn = false;
  const selectionCenter = (): THREE.Vector3 | null => {
    const cs = app.compSel;
    if (app.selMode !== 'object' && cs && cs.obj.primitive) {
      const pts = geomPoints(cs.obj.primitive.geom()); const mesh = cs.obj.primitive.mesh(); if (!pts) return null;
      const ids = cs.kind === 'point' ? [...cs.points] : cs.kind === 'polygon' ? [...new Set([...cs.polygons].flatMap(p => mesh?.polygons[p] ?? []))] : [...new Set([...cs.edges].flatMap(k => k.split('-').map(Number)))];
      if (!ids.length) return null; const c = new THREE.Vector3(); for (const i of ids) c.add(new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])); c.divideScalar(ids.length).applyMatrix4(cs.obj.globalMatrix()); return c;
    }
    const objs = app.selectedObjects; if (!objs.length) return null;
    const c = new THREE.Vector3(); for (const o of objs) c.add(new THREE.Vector3().setFromMatrixPosition(o.globalMatrix())); return c.divideScalar(objs.length);
  };
  const axisVec = (ax: 'x' | 'y' | 'z') => new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0);
  const syncGizmo = () => {
    gizmo.clear(); gizmoOn = false;
    if (tool.mode === 'select' || app.activeTool) return;
    const c = selectionCenter(); if (!c) return; gizmoCenter.copy(c); gizmoOn = true; gizmo.position.copy(c);
    const mat = (col: number) => new THREE.LineBasicMaterial({ color: col, depthTest: false });
    const seg = (pts: number[][], col: number) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))); const l = new THREE.Line(g, mat(col)); l.renderOrder = 20; return l; };
    const cols = { x: 0xff0000, y: 0x00ff00, z: 0x0000ff };
    for (const ax of ['x', 'y', 'z'] as const) {
      const on = tool.axes[ax]; const col = on ? cols[ax] : 0x808080; const a = axisVec(ax).toArray();
      if (tool.mode === 'rotate') { const pts: number[][] = []; for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI * 2; const u = ax === 'x' ? [0, Math.cos(t), Math.sin(t)] : ax === 'y' ? [Math.cos(t), 0, Math.sin(t)] : [Math.cos(t), Math.sin(t), 0]; pts.push(u); } gizmo.add(seg(pts, col)); }
      else {
        gizmo.add(seg([[0, 0, 0], a], col));
        if (tool.mode === 'translate') { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 10), new THREE.MeshBasicMaterial({ color: col, depthTest: false })); cone.renderOrder = 21; cone.position.set(a[0], a[1], a[2]); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisVec(ax)); gizmo.add(cone); }
        else { const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: col, depthTest: false })); box.renderOrder = 21; box.position.set(a[0], a[1], a[2]); gizmo.add(box); }
      }
    }
    const centre = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), new THREE.PointsMaterial({ color: 0xffd200, size: 9, sizeAttenuation: false, depthTest: false })); centre.renderOrder = 22; gizmo.add(centre);
  };
  const gizmoPx = 70; // handle length in pixels
  const pxScaleOf = (vp: Viewport, r: { w: number; h: number }) => { const cam = vp.camera as any; return vp.kind === 'ortho' ? (cam._zoom ?? 20) * 2 / r.h : gizmoCenter.distanceTo(cam.position) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 2 / r.h; };
  const scaleGizmo = (vp: Viewport, r: { w: number; h: number }) => { gizmo.visible = gizmoOn; if (!gizmoOn) return; const s = pxScaleOf(vp, r) * gizmoPx; gizmo.scale.set(s, s, s); };
  /** Which manipulator handle is under the cursor: an axis, the centre square, or none. */
  const pickHandle = (vp: Viewport, at: { x: number; y: number; r: any }): 'x' | 'y' | 'z' | 'centre' | null => {
    if (!gizmoOn) return null; prepCam(vp, at.r);
    const P = (v: THREE.Vector3) => { const q = v.clone().project(vp.camera); return { x: at.r.x + ((q.x + 1) / 2) * at.r.w, y: at.r.y + ((1 - q.y) / 2) * at.r.h }; };
    const c = P(gizmoCenter); if (Math.hypot(c.x - at.x, c.y - at.y) < 8) return 'centre';
    const s = pxScaleOf(vp, at.r) * gizmoPx; let best: 'x' | 'y' | 'z' | null = null, bd = 7;
    for (const ax of ['x', 'y', 'z'] as const) { const tip = P(gizmoCenter.clone().add(axisVec(ax).multiplyScalar(s))); const d = tool.mode === 'rotate' ? Math.abs(Math.hypot(tip.x - c.x, tip.y - c.y) - Math.hypot(at.x - c.x, at.y - c.y)) : distToSeg(at.x, at.y, c, tip); if (d < bd) { bd = d; best = ax; } }
    return best;
  };

  // ---- render loop
  let needs = true;
  const resize = () => { const w = root.clientWidth, h = root.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); placeLabels(); needs = true; };
  new ResizeObserver(resize).observe(root); resize();
  let vmLayout: 'standard' | 'alternate' | 'single' = 'standard'; let maximized = -1;
  /** Viewport rectangles for the View Manager layout (standard 2x2, 1-up-3-down, single / maximized). */
  const rect = (i: number) => {
    const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
    if (maximized >= 0 || vmLayout === 'single') { const m = maximized >= 0 ? maximized : active; return i === m ? { x: 0, y: 0, w: W, h: H } : { x: 0, y: 0, w: 0, h: 0 }; }
    if (vmLayout === 'alternate') { const h = (H - 2) * 0.66; if (i === 1) return { x: 0, y: 0, w: W, h }; const k = [0, 2, 3].indexOf(i); const w = (W - 4) / 3; return { x: k * (w + 2), y: h + 2, w, h: H - h - 2 }; }
    const w = (W - 2) / 2, h = (H - 2) / 2; return { x: i % 2 ? w + 2 : 0, y: i < 2 ? 0 : h + 2, w, h };
  };
  const placeLabels = () => { vps.forEach((vp, i) => { const r = rect(i); vp.el.style.display = r.w > 0 ? '' : 'none'; vp.el.style.left = r.x + 'px'; vp.el.style.top = r.y + 'px'; vp.el.style.width = r.w + 'px'; vp.el.style.height = r.h + 'px'; }); };
  window.addEventListener('vmlayout', (e: any) => { const l = e.detail?.layout; vmLayout = l === 'alternate' ? 'alternate' : l === 'single' ? 'single' : 'standard'; if (l !== 'standard' && l !== 'alternate' && l !== 'single') app.logMsg('info', `View Manager layout "${l}": shown as standard`); maximized = -1; placeLabels(); needs = true; });
  window.addEventListener('maximizeview', () => { maximized = maximized >= 0 ? -1 : active; placeLabels(); needs = true; });
  window.addEventListener('setdisplaymode', (e: any) => { const m = String(e.detail?.mode ?? ''); const hit = DISPLAY_MODES.find(d => d.toLowerCase().replace(/ /g, '') === m.replace(/ /g, '')); if (hit) setDisplay(vps[active], hit); });
  window.addEventListener('togglegrid', () => { vps[active].flags['Grid'] = !vps[active].flags['Grid']; needs = true; });
  const bboxFor = (g: THREE.Group) => { let b = child(g, 'bbox') as THREE.LineSegments | undefined; const m = child(g, 'mesh') as THREE.Mesh | undefined; if (!m) return undefined; if (!b || (b as any)._src !== m.geometry) { if (b) g.remove(b); m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox!; const e = new THREE.EdgesGeometry(new THREE.BoxGeometry(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z)); b = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: SI.geometry })); b.position.copy(bb.getCenter(new THREE.Vector3())); (b as any)._kind = 'bbox'; (b as any)._src = m.geometry; g.add(b); } return b; };
  const hiddenLineMat = new THREE.MeshBasicMaterial({ color: SI.background, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 });
  const constantMats = new Map<THREE.Material, THREE.Material>();
  const decalMats = new Map<THREE.Material, THREE.Material>();
  const decalFor = (base: THREE.Material) => { let m = decalMats.get(base); if (!m) { m = new THREE.MeshBasicMaterial({ color: (base as any).color ?? 0xb3b3b3, map: (base as any).map ?? null, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2, side: THREE.DoubleSide }); decalMats.set(base, m); } return m; };
  const TYPE_FLAG: Record<string, string> = { light: 'Lights', camera: 'Cameras', null: 'Nulls', implicit: 'Implicit Geometry', lattice: 'Lattices', root: 'Chains', bone: 'Chains', eff: 'Chains' };
  const prepCam = (vp: Viewport, r: { w: number; h: number }) => { const c = vp.camera as any; if (vp.kind === 'persp') c.aspect = r.w / r.h; else { const z = c._zoom ?? 20, a = r.w / r.h; c.left = -z * a; c.right = z * a; c.top = z; c.bottom = -z; } c.updateProjectionMatrix(); c.updateMatrixWorld(); };
  const normalsObj = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: SI.vertex })); scene.add(normalsObj);
  const centersObj = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: SI.ctrl, size: 6, sizeAttenuation: false, depthTest: false })); scene.add(centersObj);
  const syncNormals = (vp: Viewport) => {
    normalsObj.visible = !!vp.flags['Normals'] || !!vp.flags['Polygon Normals']; if (!normalsObj.visible) return;
    const pts: number[] = [];
    for (const o of app.selectedObjects) { const m = o.primitive?.mesh(); if (!m) continue; const M = o.globalMatrix(); const n = vertexNormalsOf(m);
      if (vp.flags['Normals']) for (let i = 0; i < m.positions.length; i += 3) { const p = new THREE.Vector3(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(M); const q = p.clone().add(new THREE.Vector3(n[i], n[i + 1], n[i + 2]).transformDirection(M).multiplyScalar(0.5)); pts.push(p.x, p.y, p.z, q.x, q.y, q.z); }
      if (vp.flags['Polygon Normals']) for (let t = 0; t < m.indices.length; t += 3) { const a = m.indices[t] * 3, b = m.indices[t + 1] * 3, c = m.indices[t + 2] * 3; const A = new THREE.Vector3(m.positions[a], m.positions[a + 1], m.positions[a + 2]), B = new THREE.Vector3(m.positions[b], m.positions[b + 1], m.positions[b + 2]), C = new THREE.Vector3(m.positions[c], m.positions[c + 1], m.positions[c + 2]); const ctr = A.clone().add(B).add(C).divideScalar(3).applyMatrix4(M); const nn = B.clone().sub(A).cross(C.clone().sub(A)).normalize().transformDirection(M).multiplyScalar(0.5); pts.push(ctr.x, ctr.y, ctr.z, ctr.x + nn.x, ctr.y + nn.y, ctr.z + nn.z); } }
    normalsObj.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3)); normalsObj.geometry.computeBoundingSphere();
  };
  const vertexNormalsOf = (m: MeshData): Float32Array => { const n = new Float32Array(m.positions.length); for (let t = 0; t < m.indices.length; t += 3) { const a = m.indices[t], b = m.indices[t + 1], c = m.indices[t + 2]; const A = new THREE.Vector3().fromArray(m.positions, a * 3), B = new THREE.Vector3().fromArray(m.positions, b * 3), C = new THREE.Vector3().fromArray(m.positions, c * 3); const nn = B.sub(A).cross(C.sub(A)); for (const i of [a, b, c]) { n[i * 3] += nn.x; n[i * 3 + 1] += nn.y; n[i * 3 + 2] += nn.z; } } for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; } return n; };
  const syncCenters = (vp: Viewport) => { centersObj.visible = !!vp.flags['Centers']; if (!centersObj.visible) return; const pts: number[] = []; for (const o of app.scene.allObjects()) if (o.visible) { const v = new THREE.Vector3().setFromMatrixPosition(o.globalMatrix()); pts.push(v.x, v.y, v.z); } centersObj.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3)); centersObj.geometry.computeBoundingSphere(); };
  const syncNames = (vp: Viewport, r: { x: number; y: number; w: number; h: number }) => {
    const host = vp.head.labels; if (!vp.flags['Name']) { if (host.childElementCount) host.innerHTML = ''; return; }
    host.innerHTML = '';
    for (const o of app.scene.allObjects()) { if (!o.visible) continue; const v = new THREE.Vector3().setFromMatrixPosition(o.globalMatrix()).project(vp.camera); if (v.z > 1) continue; const s = document.createElement('span'); s.className = 'vp-name'; s.textContent = o.name; s.style.left = ((v.x + 1) / 2) * r.w + 4 + 'px'; s.style.top = ((1 - v.y) / 2) * r.h - 6 + 'px'; host.appendChild(s); }
  };
  const XT = installViewExtras({ app, vps: vps as any, renderer, scene, get grid() { return grid; }, set grid(g) { grid = g; }, axes: axesH, defaultLights, root, rect, prepCam: prepCam as any, orbit, switchView: switchView as any, frameBox: (o, c) => frameBox(o, c), setDisplay: setDisplay as any, needs: () => { needs = true; }, active: () => active, setActive: (i) => { active = i; }, vpAt: (e) => vpAt(e) });
  const frameLoop = () => {
    requestAnimationFrame(frameLoop);
    if (!needs) return; needs = false;
    const H = renderer.domElement.clientHeight;
    renderer.setScissorTest(true);
    vps.forEach((vp, i) => {
      const r = rect(i); if (r.w <= 0 || r.h <= 0) return;
      renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h); renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
      prepCam(vp, r);
      if (!XT.beforeRender(vp as any, r)) return;
      const fast = XT.fastManip(vp as any) && !!drag && drag.moved;
      const d = fast ? 'wireframe' : vp.display; const shaded = d !== 'wireframe' && d !== 'bounding box';
      for (const [o, g] of nodes) {
        const f = TYPE_FLAG[o.type] ?? (o.primitive?.type === 'crvlist' ? 'Curves' : o.primitive?.type === 'polymsh' || o.primitive?.type === 'surfmsh' ? '3D Geometry' : '');
        g.visible = o.visible && (f ? vp.flags[f] !== false : true) && XT.isolated(vp as any, o);
        for (const ch of g.children) { const k = (ch as any)._kind;
          if (k === 'mesh') { ch.visible = shaded; const m = ch as THREE.Mesh; const base = d === 'textured' || d === 'texture decal' || d === 'realtime shaders' || d === 'rotoscope' ? (d === 'texture decal' ? decalFor((ch as any)._matTextured) : (ch as any)._matTextured) : (ch as any)._matShaded;
            if (d === 'hidden line') m.material = hiddenLineMat; else if (d === 'constant') { let c = constantMats.get(base); if (!c) { c = new THREE.MeshBasicMaterial({ color: (base as any).color ?? 0xb3b3b3, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 }); constantMats.set(base, c); } m.material = c; } else m.material = base;
            if (vp.flags['XRay Surfaces']) { (m.material as THREE.Material).transparent = true; (m.material as THREE.Material).opacity = 0.35; } else if ((m.material as any)._xrayed) { (m.material as THREE.Material).transparent = false; (m.material as THREE.Material).opacity = 1; } (m.material as any)._xrayed = vp.flags['XRay Surfaces']; }
          else if (k === 'wire') ch.visible = d === 'wireframe' || d === 'hidden line' || (shaded && !!(ch as any)._selected);
          else if (k === 'bbox') ch.visible = d === 'bounding box';
        }
        if (d === 'bounding box') { const b = bboxFor(g); if (b) b.visible = true; }
      }
      allPoints.visible = vp.flags['Points'] || app.selMode === 'point' || !!app.activeTool?.pickKind;
      scaleGizmo(vp, r); syncNormals(vp); syncCenters(vp);
      if (!XT.render(vp as any, r)) renderer.render(scene, vp.camera);
      XT.afterRender(vp as any, r);
      syncNames(vp, r);
    });
    XT.afterFrame();
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
    if (kind === 'point') { let best = -1, bd = SI.pickTol; for (let i = 0; i < n; i++) { const d = Math.hypot(pp[i].x - at.x, pp[i].y - at.y); if (d < bd) { bd = d; best = i; } } return best >= 0 ? { obj: target, kind, item: best, worldPoint: wp(best) } : null; }
    if (!mesh) return null;
    let bestE: [number, number] | null = null, bd = SI.pickTol / 2;
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
  interface Drag { vp: Viewport; at: any; sx: number; sy: number; button: number; start: Map<string, number>; objs: X3DObject[]; camPos: THREE.Vector3; tgt: THREE.Vector3; moved: boolean; handle?: 'x' | 'y' | 'z' | 'centre' | null; tweak?: { op: MoveComponentOperator; obj: X3DObject; pts: number[]; weights: Map<number, number>; startDeltas: Map<number, V3>; fresh: boolean } }
  let drag: Drag | null = null;
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const at = vpAt(e); if (!at) return;
    vps[active].el.classList.remove('active'); active = at.i; vps[active].el.classList.add('active');
    const vp = vps[at.i]; prepCam(vp, at.r); (window as any).__viewDir = vp.camera.getWorldDirection(new THREE.Vector3()).toArray();
    if (XT.pointerDown(e, at)) { renderer.domElement.setPointerCapture(e.pointerId); return; }
    const start = new Map<string, number>();
    const objs = app.selectedObjects;
    for (const o of objs) for (const p of o.kinematics.local.params) start.set(o.id + '.' + p.name, p.value);
    drag = { vp, at, sx: e.clientX, sy: e.clientY, button: e.button, start, objs, camPos: vp.camera.position.clone(), tgt: orbit.target.clone(), moved: false, handle: e.button === 0 && !e.altKey ? pickHandle(vp, at) : null };
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
    if (XT.pointerMove(e)) return;
    if (!drag) { hover(e); return; }
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
    if (app.activeTool) {
      const t: any = app.activeTool;
      if (t.onPaint && drag.button === 0 && !e.altKey) { const at = vpAt(e); if (at) { prepCam(vp, at.r); const po = pickObject(vp, at.nx, at.ny); const pc = pickComponent(vp, at, po?.obj, po?.hit, t.pickKind); const w = po ? [po.hit.point.x, po.hit.point.y, po.hit.point.z] : planePoint(vp, at.nx, at.ny); t.onPaint(w, po?.obj ?? null, pc, [(e.movementX ?? 0), -(e.movementY ?? 0), 0]); needs = true; } return; }
      if (t.onMove && drag.moved) { const at = vpAt(e); if (at) { t.onMove(planePoint(vp, at.nx, at.ny)); syncToolPreview(); needs = true; } } return;
    }
    if (tool.mode === 'select') {
      if (!drag.moved) return;
      const b = root.getBoundingClientRect();
      const x0 = Math.min(drag.sx, e.clientX) - b.left, y0 = Math.min(drag.sy, e.clientY) - b.top;
      rubber.style.display = 'block'; rubber.style.left = x0 + 'px'; rubber.style.top = y0 + 'px'; rubber.style.width = Math.abs(dx) + 'px'; rubber.style.height = Math.abs(dy) + 'px';
      return;
    }
    const pxScale = vp.kind === 'ortho' ? (cam._zoom ?? 20) * 2 / drag.at.r.h : (gizmoOn ? gizmoCenter : drag.tgt).distanceTo(drag.camPos) * Math.tan(THREE.MathUtils.degToRad((cam.fov ?? 53.6) / 2)) * 2 / drag.at.r.h;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    let delta = right.multiplyScalar(dx * pxScale).add(up.multiplyScalar(-dy * pxScale));
    const h = drag.handle; const axisMask = { x: tool.axes.x, y: tool.axes.y, z: tool.axes.z };
    if (h === 'x' || h === 'y' || h === 'z') { // axis handle: slide along the handle's screen direction
      prepCam(vp, drag.at.r); const rr = drag.at.r; const P = (v: THREE.Vector3) => { const q = v.clone().project(vp.camera); return new THREE.Vector2(((q.x + 1) / 2) * rr.w, ((1 - q.y) / 2) * rr.h); };
      const c = P(gizmoCenter), t = P(gizmoCenter.clone().add(axisVec(h))); const dir = t.clone().sub(c); const l2 = dir.lengthSq() || 1;
      const k = (dx * dir.x + dy * dir.y) / l2; delta = axisVec(h).multiplyScalar(k); axisMask.x = h === 'x'; axisMask.y = h === 'y'; axisMask.z = h === 'z';
    }
    (drag as any).axisMask = axisMask; (drag as any).delta = delta;
    if (drag.tweak) {
      const t = drag.tweak; const inv = t.obj.globalMatrix().invert(); inv.setPosition(0, 0, 0);
      const ld = delta.clone().applyMatrix4(inv); const d: V3 = [axisMask.x ? ld.x : 0, axisMask.y ? ld.y : 0, axisMask.z ? ld.z : 0];
      const prim = t.obj.primitive!; const base = geomPoints(prim.operators.slice(0, -1).reduce((m: any, op) => op.apply(m), null)) ?? geomPoints(prim.geom())!;
      if (tool.mode === 'translate') for (const p of t.pts) { const s = t.startDeltas.get(p) ?? [0, 0, 0]; const w = t.weights.get(p) ?? 1; let nd = [s[0] + d[0] * w, s[1] + d[1] * w, s[2] + d[2] * w]; const S = (tool as any).snap; if (S?.on && S.grid && w === 1) { nd = [0, 1, 2].map(k => Math.round(base[p * 3 + k] + nd[k]) - base[p * 3 + k]); } t.op.deltas.set(p, nd as V3); }
      if ((app as any).symmetry && tool.mode === 'translate') { // mirror the edit across the local X plane onto the matching points
        const n = base.length / 3; for (const p of t.pts) { const d0 = t.op.deltas.get(p); if (!d0) continue; const mx = -base[p * 3], my = base[p * 3 + 1], mz = base[p * 3 + 2]; for (let q = 0; q < n; q++) { if (q === p || t.pts.includes(q)) continue; if (Math.abs(base[q * 3] - mx) < 1e-4 && Math.abs(base[q * 3 + 1] - my) < 1e-4 && Math.abs(base[q * 3 + 2] - mz) < 1e-4) { t.op.deltas.set(q, [-d0[0], d0[1], d0[2]]); break; } } }
      }
      if (tool.mode !== 'translate') {
        const sel = t.pts.filter(p => t.weights.get(p) === 1); const c = [0, 0, 0]; for (const p of sel) for (let k = 0; k < 3; k++) c[k] += base[p * 3 + k] / sel.length;
        const f = tool.mode === 'scale' ? Math.max(0.01, 1 + dx * 0.01) : 1, ang = tool.mode === 'rotate' ? dx * 0.01 : 0;
        const rotAx = h === 'x' || h === 'z' ? h : (axisMask.x && !axisMask.y && !axisMask.z) ? 'x' : (axisMask.z && !axisMask.x && !axisMask.y) ? 'z' : 'y';
        const sm = h === 'x' || h === 'y' || h === 'z' ? { x: h === 'x', y: h === 'y', z: h === 'z' } : axisMask;
        for (const p of t.pts) { const s = t.startDeltas.get(p) ?? [0, 0, 0]; const w = t.weights.get(p) ?? 1; const v = [base[p * 3] + s[0] - c[0], base[p * 3 + 1] + s[1] - c[1], base[p * 3 + 2] + s[2] - c[2]];
          let nv = v.map((x, k) => (['x', 'y', 'z'][k] && (sm as any)[['x', 'y', 'z'][k]]) ? x * (1 + (f - 1) * w) : x); if (ang) { const a = ang * w, ca = Math.cos(a), sa = Math.sin(a); nv = rotAx === 'y' ? [v[0] * ca - v[2] * sa, v[1], v[0] * sa + v[2] * ca] : rotAx === 'x' ? [v[0], v[1] * ca - v[2] * sa, v[1] * sa + v[2] * ca] : [v[0] * ca - v[1] * sa, v[0] * sa + v[1] * ca, v[2]]; }
          t.op.deltas.set(p, [nv[0] - v[0] + s[0], nv[1] - v[1] + s[1], nv[2] - v[2] + s[2]]); }
      }
      prim.dirty = true; sync(); return;
    }
    const snapV = (v: number[]): number[] => { const S = (tool as any).snap; if (!S?.on) return v; if (S.grid) return v.map(x => Math.round(x)); if (S.point || S.midpoint) { let best: number[] | null = null, bd = 0.75; for (const other of app.scene.allObjects()) { if (drag!.objs.includes(other)) continue; const m = other.primitive?.mesh(); if (!m) continue; const M = other.globalMatrix(); for (let i = 0; i < m.positions.length; i += 3) { const q = new THREE.Vector3(m.positions[i], m.positions[i + 1], m.positions[i + 2]).applyMatrix4(M); const d = Math.hypot(q.x - v[0], q.y - v[1], q.z - v[2]); if (d < bd) { bd = d; best = [q.x, q.y, q.z]; } } } if (best) return best; } return v; };
    for (const o of drag.objs) {
      const l = o.kinematics.local;
      if (tool.mode === 'translate' && (app as any).centerMode) { if (axisMask.x) l.get('pposx')!.value = (drag.start.get(o.id + '.pposx') ?? 0) + delta.x; if (axisMask.y) l.get('pposy')!.value = (drag.start.get(o.id + '.pposy') ?? 0) + delta.y; if (axisMask.z) l.get('pposz')!.value = (drag.start.get(o.id + '.pposz') ?? 0) + delta.z; continue; }
      if (tool.mode === 'translate') { const np = [drag.start.get(o.id + '.posx')! + (axisMask.x ? delta.x : 0), drag.start.get(o.id + '.posy')! + (axisMask.y ? delta.y : 0), drag.start.get(o.id + '.posz')! + (axisMask.z ? delta.z : 0)]; const sp = snapV(np); l.get('posx')!.value = sp[0]; l.get('posy')!.value = sp[1]; l.get('posz')!.value = sp[2]; }
      else if (tool.mode === 'rotate') { const a = dx * 0.5; const ax = h === 'x' || h === 'y' || h === 'z' ? h : (axisMask.x && !axisMask.y && !axisMask.z) ? 'x' : (axisMask.z && !axisMask.x && !axisMask.y) ? 'z' : 'y'; l.get('rot' + ax)!.value = drag.start.get(o.id + '.rot' + ax)! + a; }
      else if (tool.mode === 'scale') { const f = Math.max(0.01, 1 + dx * 0.01); const m = h === 'x' || h === 'y' || h === 'z' ? { x: h === 'x', y: h === 'y', z: h === 'z' } : axisMask; for (const ax of ['x', 'y', 'z']) if ((m as any)[ax]) l.get('scl' + ax)!.value = drag.start.get(o.id + '.scl' + ax)! * f; }
    }
    sync(); app.events.emit('params');
  });
  /** Highlight the component under the cursor (Softimage draws it in the Highlight colour before you click). */
  const hoverClear = () => { for (const h of [hoverPoly, hoverLine, hoverPoint]) { h.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3)); h.geometry.setIndex(null); } };
  let hoverKey = '';
  const hover = (e: PointerEvent) => {
    if (app.selMode === 'object' && !app.activeTool?.pickKind) { if (hoverKey) { hoverKey = ''; hoverClear(); needs = true; } return; }
    const at = vpAt(e); if (!at) return; const vp = vps[at.i]; prepCam(vp, at.r);
    const po = pickObject(vp, at.nx, at.ny); const pc = pickComponent(vp, at, po?.obj, po?.hit, app.activeTool?.pickKind);
    const key = pc ? pc.kind + ':' + pc.item : ''; if (key === hoverKey) return; hoverKey = key; hoverClear();
    if (pc) {
      const pts = geomPoints(pc.obj.primitive!.geom())!; const pos = new THREE.BufferAttribute(pts, 3); const M = pc.obj.globalMatrix(); for (const h of [hoverPoly, hoverLine, hoverPoint]) { h.matrixAutoUpdate = false; h.matrix.copy(M); }
      if (pc.kind === 'point') { const i = pc.item as number; hoverPoint.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]), 3)); }
      else if (pc.kind === 'edge') { const [a, b] = String(pc.item).split('-').map(Number); hoverLine.geometry.setAttribute('position', pos); hoverLine.geometry.setIndex([a, b]); }
      else { const mesh = pc.obj.primitive!.mesh()!; const idx: number[] = []; mesh.triPoly.forEach((p, t) => { if (p === pc.item) idx.push(mesh.indices[t * 3], mesh.indices[t * 3 + 1], mesh.indices[t * 3 + 2]); }); hoverPoly.geometry.setAttribute('position', pos); hoverPoly.geometry.setIndex(idx); }
      for (const h of [hoverPoly, hoverLine, hoverPoint]) h.geometry.computeBoundingSphere();
    }
    needs = true;
  };
  renderer.domElement.addEventListener('pointerleave', () => { if (hoverKey) { hoverKey = ''; hoverClear(); needs = true; } });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (XT.pointerUp(e)) return;
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
      if (app.selMode === 'object') { let target = po?.obj ?? null; if (target && (app as any).groupMode) { let t: any = target; while (t.parentObj && t.parentObj !== app.scene.root) t = t.parentObj; target = t; } if (!target && !SI.clickToDeselect && mode === 'replace') return; app.select(target ? [target] : [], mode); return; }
      const pc = pickComponent(vp, at, po?.obj, po?.hit);
      if (pc) app.selectComponents(pc.obj, pc.kind, [pc.item], mode);
      else if (po && mode === 'replace' && po.obj !== compTarget()) { app.compSel = null; app.select([po.obj]); }
      else if (mode === 'replace' && compTarget()) app.selectComponents(compTarget()!, app.selMode as any, [], mode);
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
      // Softimage rectangle selection: an edge is picked when the rectangle touches it (Surround Edges off) and a
      // polygon when any part of it overlaps the rectangle (Surround Polygons off); hidden components are included.
      else if (kind === 'edge') app.selectComponents(target, 'edge', meshEdges(mesh).filter(([a, b]) => SI.surroundEdges ? inside(pp[a]) && inside(pp[b]) : segRect(pp[a], pp[b], x0, y0, x1, y1)).map(([a, b]) => edgeKey(a, b)), mode);
      else app.selectComponents(target, 'polygon', mesh.polygons.map((f, i) => (SI.surroundPolygons ? f.every(v => inside(pp[v])) : polyRect(f.map(v => pp[v]), x0, y0, x1, y1)) ? i : -1).filter(i => i >= 0), mode);
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
    const vp = vps[at.i], cam = vp.camera as any, f = 1 + Math.sign(e.deltaY) * Math.min(0.5, ((window as any).__wheelRate ?? 0.2) * 0.5);
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
  const frameBox = (objs: X3DObject[], centerOnly = false) => {
    const box = new THREE.Box3();
    for (const o of objs) { const pts = o.primitive ? geomPoints(o.primitive.geom()) : null; const M = o.globalMatrix(); if (pts) for (let i = 0; i < pts.length; i += 3) box.expandByPoint(new THREE.Vector3(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(M)); else box.expandByPoint(new THREE.Vector3().setFromMatrixPosition(M)); }
    if (box.isEmpty()) return; const c = box.getCenter(new THREE.Vector3()); const size = Math.max(box.getSize(new THREE.Vector3()).length(), 2);
    for (const vp of vps) { const cam = vp.camera as any; if (vp.kind === 'ortho') { const dir = cam.getWorldDirection(new THREE.Vector3()); cam.position.copy(c).sub(dir.multiplyScalar(100)); if (!centerOnly) cam._zoom = size * 0.6; cam.lookAt(c); } else { const d = cam.position.clone().sub(orbit.target); if (!centerOnly) d.normalize().multiplyScalar(size * 1.2); orbit.target.copy(c); cam.position.copy(c).add(d); cam.lookAt(c); } }
    needs = true;
  };
  window.addEventListener('framesel', () => frameBox(app.selectedObjects.length ? app.selectedObjects : [...app.scene.allObjects()].filter(o => o.visible)));
  return { frameAll: () => { for (const vp of vps) switchView(vp, vp.name); needs = true; }, frameSelection: () => frameBox(app.selectedObjects) };
}

/** Segment / axis-aligned rectangle overlap test in screen space. */
function segRect(a: { x: number; y: number }, b: { x: number; y: number }, x0: number, y0: number, x1: number, y1: number) {
  const inside = (p: { x: number; y: number }) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  if (inside(a) || inside(b)) return true;
  const cross = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }, s: { x: number; y: number }) => { const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x); if (!d) return false; const t = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d, u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1; };
  const c = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  for (let i = 0; i < 4; i++) if (cross(a, b, c[i], c[(i + 1) % 4])) return true;
  return false;
}
/** Polygon / rectangle overlap: any vertex inside, any edge crossing, or the rectangle inside the polygon. */
function polyRect(pp: { x: number; y: number }[], x0: number, y0: number, x1: number, y1: number) {
  for (let i = 0; i < pp.length; i++) if (segRect(pp[i], pp[(i + 1) % pp.length], x0, y0, x1, y1)) return true;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; let inside = false;
  for (let i = 0, j = pp.length - 1; i < pp.length; j = i++) { const a = pp[i], b = pp[j]; if ((a.y > cy) !== (b.y > cy) && cx < (b.x - a.x) * (cy - a.y) / (b.y - a.y) + a.x) inside = !inside; }
  return inside;
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
  else if (t === 'standin') { const p = o.primitive!; const a = [Number(p.val('bboxminx')), Number(p.val('bboxminy')), Number(p.val('bboxminz'))], b = [Number(p.val('bboxmaxx')), Number(p.val('bboxmaxy')), Number(p.val('bboxmaxz'))]; g.add(line([[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]]], true)); g.add(line([[a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]], true)); for (const [x, z] of [[a[0], a[2]], [b[0], a[2]], [b[0], b[2]], [a[0], b[2]]]) g.add(line([[x, a[1], z], [x, b[1], z]])); g.add(line([[a[0], a[1], a[2]], [b[0], b[1], b[2]]])); g.add(line([[b[0], a[1], a[2]], [a[0], b[1], b[2]]])); }
  else if (t === 'geoshader') { const s = Number(o.primitive?.val('size') ?? 2) / 2; g.add(circle(s, 'x', 16), circle(s, 'y', 16), circle(s, 'z', 16)); g.add(line([[-s, -s, 0], [s, s, 0]])); g.add(line([[-s, s, 0], [s, -s, 0]])); }
  else { g.add(line([[-1, 0, 0], [1, 0, 0]])); g.add(line([[0, -1, 0], [0, 1, 0]])); g.add(line([[0, 0, -1], [0, 0, 1]])); if (o.kind === 'model') g.add(line([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]], true)); }
  return g;
}
export { Bone };
