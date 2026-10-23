// Viewport extras: camera-menu tools (navigation tools, isolate, capture, mute/solo, new cameras), the display-mode
// menu (depth cue, rotoscope, headlight, X-ray, fast manipulation, HQ, display options), stereo modes, the ViewCube,
// the Render Region, per-viewport Camera Visibility / Display properties (C3DCameraVisibilityProp /
// C3DCameraDisplayProp pages: grid, rulers, field guide, safe areas, stats) and the 2D overlay that draws them.
import * as THREE from 'three';
import { App } from '../core/commands';
import { X3DObject, Property } from '../core/scene';
import { siPropDefs, siPropLayout } from '../core/opdefs';
import { SI_MENUS, SiMenuItem, openSiMenu } from './si';
import { SI } from './viewManager';

export type Rect = { x: number; y: number; w: number; h: number };
export interface VPX { name: string; kind: 'ortho' | 'persp'; camera: THREE.Camera; el: HTMLElement; display: string; flags: Record<string, boolean>; x?: Extra }
export interface Extra { isolate: Set<X3DObject> | null; muted: boolean; solo: boolean; stereo: string; roto: THREE.Texture | null; rotoUrl: string; vis: Property; disp: Property; fog: THREE.Fog | null; region: Rect | null; regionImg: HTMLCanvasElement | null; fps: number; lastT: number; frames: number; cubeRect: Rect | null }
export interface Ctx {
  app: App; vps: VPX[]; renderer: THREE.WebGLRenderer; scene: THREE.Scene; grid: THREE.GridHelper; axes: THREE.Object3D; defaultLights: THREE.Group; root: HTMLElement;
  rect: (i: number) => Rect; prepCam: (vp: VPX, r: Rect) => void; orbit: { target: THREE.Vector3 }; switchView: (vp: VPX, name: string) => void; frameBox: (objs: X3DObject[], c?: boolean) => void;
  setDisplay: (vp: VPX, mode: string) => void; needs: () => void; active: () => number; setActive: (i: number) => void; vpAt: (e: { clientX: number; clientY: number }) => { i: number; x: number; y: number; nx: number; ny: number; r: Rect } | null;
}
export const DISPLAY_MENU: SiMenuItem[] = [{ label: 'Bounding Box' }, { label: 'Wireframe' }, { label: 'Depth Cue' }, { label: 'Hidden Line Removal' }, { label: 'Constant' }, { label: 'Shaded' }, { label: 'Textured' }, { label: 'Textured Decal' }, { label: 'Realtime Shaders', items: [{ label: 'OpenGL' }, { label: 'DirectX' }, { label: 'Cg' }, { label: 'HLSL' }, { label: 'GLSL' }] }, { label: 'Rotoscope' }, { label: 'Rotoscopy Options...' }, { separator: true }, { label: 'XRay' }, { label: 'Override Object Properties' }, { label: 'Fast Manipulation' }, { label: 'Skeleton FK/IK Ghosting' }, { label: 'Headlight' }, { label: 'High Quality' }, { separator: true }, { label: 'Display Options...' }];
const MODES = ['bounding box', 'wireframe', 'hidden line removal', 'constant', 'shaded', 'textured', 'textured decal', 'realtime shaders', 'rotoscope'];
const VIS_MAP: Record<string, string> = { objlights: 'Lights', objcameras: 'Cameras', objpolymesh: '3D Geometry', objnurbssrf: '3D Geometry', objimpgeometry: 'Implicit Geometry', objcurves: 'Curves', objparticles: 'Point Clouds', objhair: 'Hair', objnulls: 'Nulls', objctrltransfogroups: 'Transform Groups', objctrlchnroots: 'Chains', objctrllattices: 'Lattices', objctrltextsupp: 'Texture Controls', objctrlother: 'Control Objects', objinstances: 'Instances', objannotationobjects: 'Annotation Objects', objenvironment: 'Environment', attrselname: 'Name', compobjunselvert: 'Points', compobjselknot: 'Knots', compobjunselcenter: 'Centers', attrselnorm: 'Normals', attrselpolynorm: 'Polygon Normals', attrselcones: 'Cones', attrselboundaryflags: 'PolyMesh Boundaries and Hard Edges', attrselpolymeshhull: 'PolyMesh Hulls', attrselinternaledges: 'PolyMesh Internal Edges', attrselsubdivisionsurface: 'Subdivision Surfaces', attrselnurbsboundaries: 'NURBS Boundaries', attrselnurbslines: 'NURBS Hulls', attrselxraysurface: 'XRay Surfaces', attrselpropertymaps: 'Weight Maps', attrselpointsweight: 'Weight Points', attrseldistfromcamera: 'Distance to Output Camera', attrselattachments: 'Attachments (Annotation and Synoptic)', attrseluserkeywords: 'User Keywords', attrselanimcues: 'Animation Cues', compobjselinvisiblecomps: 'Invisible Components', compobjselsampledpoint: 'Sampled Points', gridvis: 'Grid', refreshrate: 'Frame Rate', selectioninfo: 'Selection Info' };
const NAV_TOOLS = ['Navigation Tool', 'Pan & Zoom Tool', 'Rectangular Zoom Tool', 'Orbit Tool', 'Dolly Tool', 'Track Tool', 'Roll Tool', 'Zoom Tool', 'Pivot Tool', 'Fly Tool', 'Walk Tool', 'Drive Tool'];

export function installViewExtras(C: Ctx) {
  const { app, vps, renderer, scene } = C;
  const overlay = document.createElement('canvas'); overlay.className = 'vp-overlay'; C.root.appendChild(overlay);
  const g2 = overlay.getContext('2d')!;
  let navTool: string | null = null; let regionTool = false; let gridKey = '';
  const headlight = new THREE.DirectionalLight(0xffffff, 0.9); headlight.visible = false; scene.add(headlight);
  // ---------------------------------------------------------------- per-viewport properties
  const mkProps = (vp: VPX): Extra => {
    const vis = new Property('Camera Visibility', 'camvis', siPropDefs('C3DCameraVisibilityProp')); vis.layout = siPropLayout('C3DCameraVisibilityProp') as any;
    for (const [k, f] of Object.entries(VIS_MAP)) { const p = vis.get(k); if (p && f in vp.flags) p.value = vp.flags[f]; }
    for (const k of ['gridvis', 'gridaxisvis', 'objpolymesh', 'objnurbssrf', 'objcurves', 'objlights', 'objcameras', 'objnulls', 'objimpgeometry', 'objctrlchnroots', 'objctrllattices', 'objctrlother', 'objparticles', 'compobjselvert', 'compobjselcenter', 'attrselsubdivisionsurface']) vis.get(k) && (vis.get(k)!.value = true);
    vis.get('disustep') && (vis.get('disustep')!.value = 1); vis.get('disvstep') && (vis.get('disvstep')!.value = 1); vis.get('disextent') && (vis.get('disextent')!.value = 20);
    vis.onChange((p) => { const f = VIS_MAP[p.name]; if (f) vp.flags[f] = !!p.value; if (p.name.startsWith('grid') || p.name.startsWith('dis')) gridKey = ''; C.needs(); });
    const disp = new Property('Camera Display', 'camdisp', siPropDefs('C3DCameraDisplayProp')); disp.layout = siPropLayout('C3DCameraDisplayProp') as any;
    disp.set('headlight_intensity', 1); disp.set('wrfrmdpthcueval', 50); disp.set('fogcolorred', 0.5); disp.set('fogcolorgreen', 0.5); disp.get('fogcolorblue') && disp.set('fogcolorblue', 0.5); disp.set('override', true);
    disp.onChange((p) => { if (p.name === 'texturedecal' && p.value) C.setDisplay(vp, 'Textured Decal'); if (p.name === 'realtimeshaders' && p.value) C.setDisplay(vp, 'Realtime Shaders'); if (p.name === 'rotoenable') vp.flags['Rotoscope'] = !!p.value; if (p.name === 'xrayshaded') vp.flags['XRay Surfaces'] = !!p.value; if (p.name === 'headlight') vp.flags['Headlight'] = !!p.value; if (p.name === 'wrfrmdpthcueenab') vp.flags['Depth Cue'] = !!p.value; C.needs(); });
    (vis as any).parentObj = null; (disp as any).parentObj = null;
    return { isolate: null, muted: false, solo: false, stereo: 'Center', roto: null, rotoUrl: '', vis, disp, fog: null, region: null, regionImg: null, fps: 0, lastT: 0, frames: 0, cubeRect: null };
  };
  const X = (vp: VPX): Extra => (vp.x ??= mkProps(vp));
  for (const vp of vps) X(vp);
  const inspect = (p: Property, title: string) => { p.name = title; app.events.emit('inspect', p); };

  // ---------------------------------------------------------------- menus
  const newCamera = (vp: VPX, kind: string) => { const cam = app.run('GetPrimCamera', { PresetObj: kind === 'Orthographic' ? 'Orthographic' : kind === 'Telephoto' ? 'Telephoto' : kind === 'Wide Angle' ? 'Wide Angle' : 'Camera', Name: kind.replace(' ', '') }); if (cam) { cam.kinematics.local.set('posx', vp.camera.position.x); cam.kinematics.local.set('posy', vp.camera.position.y); cam.kinematics.local.set('posz', vp.camera.position.z); C.switchView(vp, cam.name); } };
  const cameraMenu = (vp: VPX, label: string): boolean => {
    const x = X(vp);
    if (NAV_TOOLS.includes(label)) { navTool = navTool === label ? null : label; app.logMsg('info', navTool ? `${label}: left-drag in a viewport (Esc to leave)` : 'Navigation tool off'); app.events.emit('selection'); return true; }
    if (['Perspective', 'Telephoto', 'Wide Angle', 'Orthographic', 'More...'].includes(label)) { newCamera(vp, label === 'More...' ? 'Perspective' : label); return true; }
    if (label === 'Select Interest') { const c = [...app.scene.allObjects()].find(o => o.name === vp.name + '_Interest') ?? [...app.scene.allObjects()].find(o => o.type === 'camera'); if (c) app.select([c]); return true; }
    if (label === 'Isolate Selection') { x.isolate = app.selectedObjects.length ? new Set(app.selectedObjects) : null; C.needs(); return true; }
    if (label === 'Update Isolated') { if (x.isolate) x.isolate = new Set(app.selectedObjects); C.needs(); return true; }
    if (label === 'Add Selected') { if (x.isolate) app.selectedObjects.forEach(o => x.isolate!.add(o)); C.needs(); return true; }
    if (label === 'Remove Selected') { if (x.isolate) app.selectedObjects.forEach(o => x.isolate!.delete(o)); C.needs(); return true; }
    if (label === 'Mute') { x.muted = !x.muted; C.needs(); return true; }
    if (label === 'Solo') { x.solo = !x.solo; for (const v of vps) if (v !== vp) X(v).solo = false; C.needs(); return true; }
    if (label === 'Start Capture') { capture(vp); return true; }
    return false;
  };
  const visibilityMenu = (vp: VPX, label: string): boolean => {
    if (label === 'Manipulate Tool') { (window as any).__mcp?.('manip', true); return true; }
    if (label === 'Visibility Options...') { inspect(X(vp).vis, `${vp.name} : Camera Visibility`); return true; }
    if (!(label in vp.flags)) { vp.flags[label] = true; C.needs(); return true; }
    return false;
  };
  const displayMenu = (vp: VPX, label: string, path: string[]) => {
    const x = X(vp);
    if (path.includes('Realtime Shaders')) { C.setDisplay(vp, 'Realtime Shaders'); x.disp.set('realtimeshaders', true); return; }
    switch (label) {
      case 'Depth Cue': vp.flags['Depth Cue'] = !vp.flags['Depth Cue']; x.disp.set('wrfrmdpthcueenab', vp.flags['Depth Cue']); break;
      case 'Hidden Line Removal': C.setDisplay(vp, 'Hidden Line'); break;
      case 'Rotoscope': vp.flags['Rotoscope'] = !vp.flags['Rotoscope']; x.disp.set('rotoenable', vp.flags['Rotoscope']); if (vp.flags['Rotoscope'] && !x.roto) pickRoto(vp); break;
      case 'Rotoscopy Options...': pickRoto(vp); break;
      case 'XRay': vp.flags['XRay Surfaces'] = !vp.flags['XRay Surfaces']; x.disp.set('xrayshaded', vp.flags['XRay Surfaces']); break;
      case 'Override Object Properties': vp.flags['Override'] = !(vp.flags['Override'] ?? true); x.disp.set('override', vp.flags['Override']); break;
      case 'Fast Manipulation': vp.flags['Fast Manipulation'] = !vp.flags['Fast Manipulation']; break;
      case 'Skeleton FK/IK Ghosting': vp.flags['Ghosting'] = !vp.flags['Ghosting']; x.disp.set('mixerghosting', vp.flags['Ghosting']); break;
      case 'Headlight': vp.flags['Headlight'] = !vp.flags['Headlight']; x.disp.set('headlight', vp.flags['Headlight']); break;
      case 'High Quality': vp.flags['High Quality'] = !vp.flags['High Quality']; x.disp.set('antialias', vp.flags['High Quality']); break;
      case 'Display Options...': inspect(x.disp, `${vp.name} : Camera Display`); break;
      default: C.setDisplay(vp, label);
    }
    C.needs();
  };
  const displayChecked = (vp: VPX) => (it: SiMenuItem) => { const l = it.label ?? ''; if (MODES.includes(l.toLowerCase())) return vp.display === l.toLowerCase() || (l === 'Hidden Line Removal' && vp.display === 'hidden line'); if (l === 'XRay') return !!vp.flags['XRay Surfaces']; if (l === 'Override Object Properties') return vp.flags['Override'] ?? true; if (['Depth Cue', 'Rotoscope', 'Fast Manipulation', 'Headlight', 'High Quality'].includes(l)) return !!vp.flags[l]; if (l === 'Skeleton FK/IK Ghosting') return !!vp.flags['Ghosting']; return undefined; };
  const stereoMenu = (vp: VPX, label: string) => { const x = X(vp); if (label === 'Properties...') { app.logMsg('info', 'Stereo properties: eye separation 0.3 (edit in Camera Display)'); return; } if (label === 'Active') { x.stereo = x.stereo === 'Center' ? 'Anaglyph' : 'Center'; } else if (label === 'Swap Interlaced Eyes') { (x as any).swap = !(x as any).swap; } else x.stereo = label; C.needs(); };
  const pickRoto = (vp: VPX) => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; const url = URL.createObjectURL(f); new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; const x = X(vp); x.roto = t; x.rotoUrl = f.name; vp.flags['Rotoscope'] = true; x.disp.set('rotoenable', true); C.setDisplay(vp, 'Rotoscope'); C.needs(); }); }; inp.click(); };

  // ---------------------------------------------------------------- capture / flipbook
  const grab = (vp: VPX, r: Rect): string => { const c = document.createElement('canvas'); c.width = r.w; c.height = r.h; const src = renderer.domElement; const s = window.devicePixelRatio || 1; c.getContext('2d')!.drawImage(src, r.x * s, r.y * s, r.w * s, r.h * s, 0, 0, r.w, r.h); return c.toDataURL('image/png'); };
  let captureReq: { vp: VPX; frames: string[]; f: number; end: number } | null = null;
  const capture = (vp: VPX) => { const A = app.anim; const all = confirm(`Capture viewport ${vp.name}: OK = frames ${A.startFrame}–${A.endFrame} to a Flipbook, Cancel = the current frame only`); captureReq = { vp, frames: [], f: all ? A.startFrame : A.frame, end: all ? A.endFrame : A.frame }; A.frame = captureReq.f; C.needs(); };
  const flipbook = (frames: string[], name: string) => { const w = window.open('', '_blank'); if (!w) { app.logMsg('error', 'Flipbook: popup blocked'); return; } w.document.write(`<title>Flipbook – ${name}</title><body style="margin:0;background:#333;color:#ddd;font:12px Tahoma"><div style="padding:4px"><button id=p>▶</button> <input id=s type=range min=0 max=${frames.length - 1} value=0 style="width:300px"> <span id=f>1 / ${frames.length}</span> <a id=d download="${name}_0001.png" href="${frames[0]}">save frame</a></div><img id=i src="${frames[0]}"><script>const F=${JSON.stringify(frames)};let i=0,t=null;const img=document.getElementById('i'),s=document.getElementById('s'),f=document.getElementById('f'),d=document.getElementById('d');function show(k){i=k;img.src=F[i];s.value=i;f.textContent=(i+1)+' / '+F.length;d.href=F[i];d.download='${name}_'+String(i+1).padStart(4,'0')+'.png';}s.oninput=()=>show(+s.value);document.getElementById('p').onclick=()=>{if(t){clearInterval(t);t=null;}else t=setInterval(()=>show((i+1)%F.length),1000/${app.anim.fps});};</script></body>`); w.document.close(); };
  window.addEventListener('flipbook', () => capture(vps[C.active()]));
  window.addEventListener('flipbook-frames', (e: any) => flipbook(e.detail.frames, e.detail.name));

  // ---------------------------------------------------------------- grid / rulers / safe areas / stats overlay
  const gridFor = (vp: VPX) => { const v = X(vp).vis; const ext = Number(v.val('disextent') ?? 20), su = Math.max(0.1, Number(v.val('disustep') ?? 1)); const key = `${ext}|${su}`; if (key !== gridKey) { gridKey = key; const n = Math.max(1, Math.round(ext * 2 / su)); const old = C.grid; const ng = new THREE.GridHelper(ext * 2, n, (old.material as any).color?.getHex?.() ?? 0x6e6e6e, 0x5e5e5e); ng.name = 'grid'; scene.remove(old); scene.add(ng); C.grid = ng; } };
  const drawOverlay = () => {
    const W = C.root.clientWidth, H = C.root.clientHeight; if (overlay.width !== W * devicePixelRatio || overlay.height !== H * devicePixelRatio) { overlay.width = W * devicePixelRatio; overlay.height = H * devicePixelRatio; overlay.style.width = W + 'px'; overlay.style.height = H + 'px'; }
    g2.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g2.clearRect(0, 0, W, H); g2.font = '10px Tahoma, Verdana, sans-serif';
    vps.forEach((vp, i) => {
      const r = C.rect(i); if (r.w <= 0) return; const x = X(vp); const v = x.vis;
      if (v.val('gridrulervis')) drawRulers(vp, r);
      if (v.val('safetitle') || v.val('safeaction') || v.val('gridfieldguidevis')) drawSafe(vp, r, !!v.val('safetitle'), !!v.val('safeaction'), !!v.val('gridfieldguidevis'));
      const lines: string[] = [];
      if (vp.flags['Frame Rate']) lines.push(`${x.fps.toFixed(1)} fps`);
      if (vp.flags['Selection Info'] || v.val('selectioninfo')) { const o = app.selectedObjects; lines.push(o.length ? `Selection: ${o.map(q => q.name).join(', ')}` : 'Selection: (none)'); if (o.length === 1 && o[0].primitive?.mesh()) { const m = o[0].primitive!.mesh()!; lines.push(`${m.positions.length / 3} points, ${m.polygons.length} polygons`); } }
      if (v.val('sceneinfo')) lines.push(`Objects: ${[...app.scene.allObjects()].length}`); if (v.val('currenttime')) lines.push(`Frame ${app.anim.frame}`); if (v.val('camerainfo')) lines.push(`Camera: ${vp.name}`);
      if (x.isolate) lines.push(`Isolated: ${x.isolate.size} object(s)`); if (x.muted) lines.push('MUTED'); if (x.solo) lines.push('SOLO'); if (navTool && i === C.active()) lines.push(navTool);
      if (lines.length) { g2.fillStyle = 'rgba(0,0,0,.35)'; g2.fillRect(r.x + 4, r.y + 22, 180, 12 * lines.length + 4); g2.fillStyle = '#ffd34d'; lines.forEach((l, k) => g2.fillText(l, r.x + 8, r.y + 32 + k * 12)); }
      if (x.region && !(x as any).hidden) { const q = x.region; if (x.regionImg) g2.drawImage(x.regionImg, r.x + q.x, r.y + q.y, q.w, q.h); g2.strokeStyle = '#ffd34d'; g2.lineWidth = 1; g2.strokeRect(r.x + q.x + 0.5, r.y + q.y + 0.5, q.w, q.h); g2.fillStyle = '#ffd34d'; g2.fillRect(r.x + q.x - 3, r.y + q.y - 3, 6, 6); g2.fillRect(r.x + q.x + q.w - 3, r.y + q.y + q.h - 3, 6, 6); }
      drawCube(vp, r);
    });
  };
  const drawRulers = (vp: VPX, r: Rect) => { const cam = vp.camera as any; const unit = vp.kind === 'ortho' ? (cam._zoom ?? 20) * 2 / r.h : (C.orbit.target.distanceTo(cam.position) * Math.tan((cam.fov ?? 53.6) * Math.PI / 360) * 2) / r.h; const step = Math.pow(10, Math.ceil(Math.log10(unit * 40))); const px = step / unit; g2.fillStyle = 'rgba(60,60,60,.85)'; g2.fillRect(r.x, r.y + 18, r.w, 12); g2.fillRect(r.x, r.y + 18, 12, r.h - 18); g2.fillStyle = '#ddd'; g2.strokeStyle = '#ddd'; const cx = r.x + r.w / 2, cy = r.y + r.h / 2; for (let k = -Math.ceil(r.w / 2 / px); k <= Math.ceil(r.w / 2 / px); k++) { const X0 = cx + k * px; if (X0 < r.x + 12 || X0 > r.x + r.w) continue; g2.beginPath(); g2.moveTo(X0, r.y + 24); g2.lineTo(X0, r.y + 30); g2.stroke(); g2.fillText(String(k * step), X0 + 2, r.y + 27); } for (let k = -Math.ceil(r.h / 2 / px); k <= Math.ceil(r.h / 2 / px); k++) { const Y0 = cy + k * px; if (Y0 < r.y + 30 || Y0 > r.y + r.h) continue; g2.beginPath(); g2.moveTo(r.x + 6, Y0); g2.lineTo(r.x + 12, Y0); g2.stroke(); g2.save(); g2.translate(r.x + 9, Y0 - 2); g2.rotate(-Math.PI / 2); g2.fillText(String(-k * step), 0, 0); g2.restore(); } };
  const drawSafe = (vp: VPX, r: Rect, title: boolean, action: boolean, guide: boolean) => { const asp = Number((app.scene.find(vp.name) as any)?.primitive?.val('aspect') ?? 1.333); let w = r.w - 40, h = w / asp; if (h > r.h - 40) { h = r.h - 40; w = h * asp; } const x0 = r.x + (r.w - w) / 2, y0 = r.y + 18 + (r.h - 18 - h) / 2; g2.lineWidth = 1; if (guide) { g2.strokeStyle = 'rgba(255,255,255,.6)'; g2.strokeRect(x0 + 0.5, y0 + 0.5, w, h); } if (action) { g2.strokeStyle = 'rgba(80,220,80,.8)'; g2.strokeRect(x0 + w * 0.05 + 0.5, y0 + h * 0.05 + 0.5, w * 0.9, h * 0.9); } if (title) { g2.strokeStyle = 'rgba(220,80,80,.8)'; g2.strokeRect(x0 + w * 0.1 + 0.5, y0 + h * 0.1 + 0.5, w * 0.8, h * 0.8); } };

  // ---------------------------------------------------------------- ViewCube (top-right of each viewport; drag orbits, click a face snaps)
  const faces: [string, THREE.Vector3][] = [['FRONT', new THREE.Vector3(0, 0, 1)], ['BACK', new THREE.Vector3(0, 0, -1)], ['RIGHT', new THREE.Vector3(1, 0, 0)], ['LEFT', new THREE.Vector3(-1, 0, 0)], ['TOP', new THREE.Vector3(0, 1, 0)], ['BOTTOM', new THREE.Vector3(0, -1, 0)]];
  const drawCube = (vp: VPX, r: Rect) => {
    const VC = SI.viewCube; if (vp.flags['ViewCube'] === false || !VC.show) { X(vp).cubeRect = null; return; }
    const CUBE = VC.size; const cx = VC.position % 2 === 0 ? r.x + r.w - CUBE - 8 : r.x + 8, cy = VC.position < 2 ? r.y + 24 : r.y + r.h - CUBE - 8; X(vp).cubeRect = { x: cx, y: cy, w: CUBE, h: CUBE }; g2.globalAlpha = Math.max(0.15, VC.opacity);
    const cam = vp.camera; const q = cam.quaternion.clone().invert(); const half = CUBE / 2; const proj = (p: THREE.Vector3) => { const v = p.clone().applyQuaternion(q); return { x: cx + half + v.x * half * 0.62, y: cy + half - v.y * half * 0.62, z: v.z }; };
    const corners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => new THREE.Vector3(x, y, z))));
    const quads: [string, THREE.Vector3, THREE.Vector3[]][] = faces.map(([n, nrm]) => [n, nrm, corners.filter(c => c.dot(nrm) > 0.5)]);
    for (const [name, nrm, cs] of quads.sort((a, b) => a[1].clone().applyQuaternion(q).z - b[1].clone().applyQuaternion(q).z)) {
      const nz = nrm.clone().applyQuaternion(q).z; if (nz < 0.02) continue;
      const ctr = nrm.clone(); const ordered = cs.slice().sort((a, b) => Math.atan2(...tang(a, ctr)) - Math.atan2(...tang(b, ctr)));
      const pts = ordered.map(proj); g2.beginPath(); pts.forEach((p, i) => i ? g2.lineTo(p.x, p.y) : g2.moveTo(p.x, p.y)); g2.closePath();
      g2.fillStyle = `rgba(${Math.round(150 + 90 * nz)},${Math.round(150 + 90 * nz)},${Math.round(145 + 90 * nz)},.92)`; g2.fill(); g2.strokeStyle = '#333'; g2.stroke();
      const c = proj(nrm); g2.fillStyle = '#222'; g2.font = '7px Tahoma, Verdana, sans-serif'; g2.textAlign = 'center'; g2.fillText(name, c.x, c.y + 3); g2.textAlign = 'left'; g2.font = '10px Tahoma, Verdana, sans-serif';
    }
  };
  const tang = (c: THREE.Vector3, n: THREE.Vector3): [number, number] => { const u = Math.abs(n.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0); const t1 = u.clone().cross(n).normalize(), t2 = n.clone().cross(t1).normalize(); return [c.dot(t2), c.dot(t1)]; };
  const cubeHit = (vp: VPX, px: number, py: number) => { const cr = X(vp).cubeRect; return !!cr && px >= cr.x && px <= cr.x + cr.w && py >= cr.y && py <= cr.y + cr.h; };
  const cubeFaceAt = (vp: VPX, px: number, py: number): string | null => { const cr = X(vp).cubeRect!; const q = vp.camera.quaternion.clone().invert(); let best: string | null = null, bz = -1; for (const [n, nrm] of faces) { const v = nrm.clone().applyQuaternion(q); if (v.z < 0.3) continue; const fx = cr.x + cr.w / 2 + v.x * cr.w / 2 * 0.62, fy = cr.y + cr.h / 2 - v.y * cr.h / 2 * 0.62; const d = Math.hypot(px - fx, py - fy); if (d < 12 && v.z > bz) { bz = v.z; best = n; } } return best; };
  const snapFace = (vp: VPX, face: string) => { const cam = vp.camera as any; const dist = vp.kind === 'persp' ? cam.position.distanceTo(C.orbit.target) : 100; const dir = faces.find(f => f[0] === face)![1]; cam.position.copy(C.orbit.target).add(dir.clone().multiplyScalar(dist)); cam.up.set(0, 1, 0); if (face === 'TOP') cam.up.set(0, 0, -1); if (face === 'BOTTOM') cam.up.set(0, 0, 1); cam.lookAt(C.orbit.target); C.needs(); };

  // ---------------------------------------------------------------- pointer handling (nav tools, ViewCube, render region)
  let nav: { vp: VPX; sx: number; sy: number; camPos: THREE.Vector3; tgt: THREE.Vector3; up: THREE.Vector3; mode: string; r: Rect; moved: boolean; rr?: Rect } | null = null;
  const pointerDown = (e: PointerEvent, at: NonNullable<ReturnType<Ctx['vpAt']>>): boolean => {
    const vp = vps[at.i]; const b = renderer.domElement.getBoundingClientRect(); const px = e.clientX - b.left, py = e.clientY - b.top;
    if (e.button === 0 && cubeHit(vp, px, py)) { nav = { vp, sx: e.clientX, sy: e.clientY, camPos: vp.camera.position.clone(), tgt: C.orbit.target.clone(), up: vp.camera.up.clone(), mode: 'cube', r: at.r, moved: false }; return true; }
    if (e.button === 0 && regionTool) { nav = { vp, sx: e.clientX, sy: e.clientY, camPos: vp.camera.position.clone(), tgt: C.orbit.target.clone(), up: vp.camera.up.clone(), mode: 'region', r: at.r, moved: false, rr: { x: px - at.r.x, y: py - at.r.y, w: 0, h: 0 } }; X(vp).region = nav.rr!; X(vp).regionImg = null; return true; }
    if (e.button === 0 && navTool && !e.altKey) { nav = { vp, sx: e.clientX, sy: e.clientY, camPos: vp.camera.position.clone(), tgt: C.orbit.target.clone(), up: vp.camera.up.clone(), mode: navTool, r: at.r, moved: false }; return true; }
    return false;
  };
  const pointerMove = (e: PointerEvent): boolean => {
    if (!nav) return false; const dx = e.clientX - nav.sx, dy = e.clientY - nav.sy; if (Math.abs(dx) + Math.abs(dy) > 2) nav.moved = true;
    const vp = nav.vp, cam = vp.camera as any, m = nav.mode;
    const orbitBy = (ax: number, ay: number) => { const d = nav!.camPos.clone().sub(nav!.tgt); const sph = new THREE.Spherical().setFromVector3(d); sph.theta -= ax; sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - ay)); cam.position.copy(nav!.tgt).add(new THREE.Vector3().setFromSpherical(sph)); cam.up.set(0, 1, 0); cam.lookAt(nav!.tgt); };
    const track = (sx: number, sy: number) => { const scale = vp.kind === 'ortho' ? (cam._zoom ?? 20) * 2 / nav!.r.h : nav!.camPos.distanceTo(nav!.tgt) / 400; const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1); const off = right.multiplyScalar(-sx * scale).add(up.multiplyScalar(sy * scale)); cam.position.copy(nav!.camPos).add(off); if (vp.kind === 'persp') C.orbit.target.copy(nav!.tgt).add(off); };
    const dolly = (f: number) => { if (vp.kind === 'ortho') cam._zoom = Math.max(0.5, (cam._zoom ?? 20) * f); else { const d = nav!.camPos.clone().sub(nav!.tgt); cam.position.copy(nav!.tgt).add(d.multiplyScalar(Math.max(0.05, f))); } };
    switch (m) {
      case 'cube': if (vp.kind === 'persp') orbitBy(dx * 0.01, dy * 0.01); else track(dx, dy); break;
      case 'region': { const b = renderer.domElement.getBoundingClientRect(); const px = e.clientX - b.left - nav.r.x, py = e.clientY - b.top - nav.r.y; const x0 = Math.min(px, nav.rr!.x + (nav.rr!.w ? 0 : 0)); const sx0 = nav.sx - b.left - nav.r.x, sy0 = nav.sy - b.top - nav.r.y; nav.rr!.x = Math.min(sx0, px); nav.rr!.y = Math.min(sy0, py); nav.rr!.w = Math.abs(px - sx0); nav.rr!.h = Math.abs(py - sy0); void x0; break; }
      case 'Orbit Tool': case 'Navigation Tool': if (vp.kind === 'persp') orbitBy(dx * 0.008, dy * 0.008); else track(dx, dy); break;
      case 'Track Tool': case 'Pan & Zoom Tool': track(dx, dy); break;
      case 'Dolly Tool': case 'Zoom Tool': dolly(1 + dy * 0.005); break;
      case 'Roll Tool': { const dir = cam.getWorldDirection(new THREE.Vector3()); cam.up.copy(nav.up).applyAxisAngle(dir, -dx * 0.01); cam.lookAt(vp.kind === 'persp' ? C.orbit.target : cam.position.clone().add(dir)); break; }
      case 'Pivot Tool': { const d = cam.getWorldDirection(new THREE.Vector3()); C.orbit.target.copy(nav.tgt).add(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(dx * 0.02)).add(d.multiplyScalar(-dy * 0.02)); break; }
      case 'Fly Tool': case 'Walk Tool': case 'Drive Tool': { const d = cam.getWorldDirection(new THREE.Vector3()); if (m === 'Walk Tool') d.y = 0; cam.position.copy(nav.camPos).add(d.normalize().multiplyScalar(-dy * 0.05)); const yaw = -dx * 0.004; const dir = cam.getWorldDirection(new THREE.Vector3()).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); C.orbit.target.copy(cam.position).add(dir.multiplyScalar(nav.camPos.distanceTo(nav.tgt))); cam.lookAt(C.orbit.target); break; }
      case 'Rectangular Zoom Tool': break;
    }
    C.needs(); return true;
  };
  const pointerUp = (e: PointerEvent): boolean => {
    if (!nav) return false; const n = nav; nav = null; const vp = n.vp;
    if (n.mode === 'cube' && !n.moved) { const b = renderer.domElement.getBoundingClientRect(); const f = cubeFaceAt(vp, e.clientX - b.left, e.clientY - b.top); if (f) snapFace(vp, f); }
    if (n.mode === 'region') { if (!n.moved || n.rr!.w < 4 || n.rr!.h < 4) X(vp).region = null; regionTool = false; app.events.emit('selection'); C.needs(); }
    if (n.mode === 'Rectangular Zoom Tool' && n.moved) { const dx = e.clientX - n.sx, dy = e.clientY - n.sy; const f = Math.max(0.05, Math.max(Math.abs(dx) / n.r.w, Math.abs(dy) / n.r.h)); const cam = vp.camera as any; if (vp.kind === 'ortho') cam._zoom = (cam._zoom ?? 20) * f; else { const d = n.camPos.clone().sub(n.tgt); cam.position.copy(n.tgt).add(d.multiplyScalar(f)); } C.needs(); }
    return true;
  };
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (navTool || regionTool)) { navTool = null; regionTool = false; app.events.emit('selection'); } });
  window.addEventListener('renderregion', () => { regionTool = !regionTool; app.logMsg('info', regionTool ? 'Render Region: drag a rectangle in a viewport' : 'Render Region tool off'); });
  window.addEventListener('deleterenderregion', () => { for (const vp of vps) X(vp).region = null; C.needs(); });
  window.addEventListener('navtool', (e: any) => { const t = e.detail?.tool ?? 'Navigation Tool'; navTool = navTool === t ? null : t; app.events.emit('selection'); });
  window.addEventListener('displaytoggle', (e: any) => displayMenu(vps[C.active()], e.detail?.item ?? 'Headlight', []));
  window.addEventListener('renderregion-toggle', () => { for (const vp of vps) { const x = X(vp); if (x.region) { (x as any).hidden = !(x as any).hidden; } } C.needs(); });
  window.addEventListener('renderregion-refresh', () => { regionInvalidate(); C.needs(); });
  window.addEventListener('stereomode', (e: any) => stereoMenu(vps[C.active()], e.detail?.mode ?? 'Active'));
  window.addEventListener('openvisibility', (e: any) => { const vp = vps.find(v => v.name === e.detail?.vp) ?? vps[C.active()]; inspect(X(vp).vis, `${vp.name} : Camera Visibility`); });
  window.addEventListener('opendisplayoptions', () => { const vp = vps[C.active()]; inspect(X(vp).disp, `${vp.name} : Camera Display`); });

  // ---------------------------------------------------------------- rendering hooks
  const eye = (cam: THREE.Camera, side: number): THREE.Camera => { const c = cam.clone() as any; const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); c.position.add(right.multiplyScalar(side * 0.15)); c.lookAt(C.orbit.target); c.updateMatrixWorld(); c.updateProjectionMatrix?.(); return c; };
  const beforeRender = (vp: VPX, r: Rect): boolean => {
    const x = X(vp); gridFor(vp);
    if (x.muted || vps.some(v => X(v).solo && v !== vp)) return false;
    C.grid.visible = !!vp.flags['Grid']; C.axes.visible = !!vp.flags['Grid'] && x.vis.val('gridaxisvis') !== false;
    // depth cue → fog around the orbit target
    if (vp.flags['Depth Cue']) { const d = vp.kind === 'persp' ? vp.camera.position.distanceTo(C.orbit.target) : 100; const dens = Number(x.disp.val('wrfrmdpthcueval') ?? 50) / 100; scene.fog = new THREE.Fog((scene.background as THREE.Color).getHex(), d * (1 - dens * 0.8), d * (1 + dens * 2)); } else scene.fog = null;
    headlight.visible = !!(vp.flags['Headlight'] ?? SI.headlightDefault); if (headlight.visible) { headlight.position.copy(vp.camera.position); headlight.intensity = Number(x.disp.val('headlight_intensity') ?? 1); headlight.target.position.copy(C.orbit.target); headlight.target.updateMatrixWorld(); C.defaultLights.visible = false; } else C.defaultLights.visible = true;
    scene.background = vp.flags['Rotoscope'] && x.roto ? x.roto : (scene as any)._bg ?? scene.background;
    if (!(scene as any)._bg && scene.background instanceof THREE.Color) (scene as any)._bg = scene.background;
    if (vp.flags['High Quality']) { renderer.shadowMap.enabled = true; } else renderer.shadowMap.enabled = false;
    return true;
  };
  const render = (vp: VPX, r: Rect): boolean => {
    const x = X(vp); const mode = x.stereo;
    if (mode === 'Center' || !mode) return false;
    const gl = renderer.getContext(); const swap = (x as any).swap ? -1 : 1;
    if (mode === 'Left Eye') { renderer.render(scene, eye(vp.camera, -swap)); return true; } if (mode === 'Right Eye') { renderer.render(scene, eye(vp.camera, swap)); return true; }
    if (mode.startsWith('Freeview')) { const cross = mode.includes('Crossed') ? -1 : 1; const H = renderer.domElement.clientHeight; const half = r.w / 2; renderer.setViewport(r.x, H - r.y - r.h, half, r.h); renderer.setScissor(r.x, H - r.y - r.h, half, r.h); renderer.render(scene, eye(vp.camera, -swap * cross)); renderer.setViewport(r.x + half, H - r.y - r.h, half, r.h); renderer.setScissor(r.x + half, H - r.y - r.h, half, r.h); renderer.render(scene, eye(vp.camera, swap * cross)); return true; }
    // anaglyph family (and interlace, approximated): red channel = left eye, green+blue = right eye
    const lum = mode.includes('Luminance'), half = mode.includes('Half-Color');
    gl.colorMask(true, false, false, true); renderer.render(scene, eye(vp.camera, -swap));
    renderer.autoClearColor = false; renderer.clearDepth(); gl.colorMask(false, true, true, true); renderer.render(scene, eye(vp.camera, swap)); renderer.autoClearColor = true; gl.colorMask(true, true, true, true);
    void lum; void half; return true;
  };
  const afterRender = (vp: VPX, r: Rect) => {
    const x = X(vp); const now = performance.now(); x.frames++; if (now - x.lastT > 500) { x.fps = x.frames * 1000 / (now - x.lastT); x.frames = 0; x.lastT = now; }
    if (x.region && !x.regionImg && x.region.w > 4) { const q = x.region; const c = document.createElement('canvas'); c.width = q.w; c.height = q.h; const s = devicePixelRatio || 1; const g = c.getContext('2d')!; g.drawImage(renderer.domElement, (r.x + q.x) * s, (r.y + q.y) * s, q.w * s, q.h * s, 0, 0, q.w, q.h); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, q.w, q.h); x.regionImg = c; }
    if (captureReq && captureReq.vp === vp) { captureReq.frames.push(grab(vp, r)); if (captureReq.f >= captureReq.end) { const fr = captureReq.frames; const name = `${vp.name}_capture`; captureReq = null; if (fr.length === 1) { const a = document.createElement('a'); a.href = fr[0]; a.download = name + '.png'; a.click(); app.logMsg('info', `Captured ${name}.png`); } else flipbook(fr, name); } else { captureReq.f++; app.anim.frame = captureReq.f; C.needs(); } }
  };
  const afterFrame = () => drawOverlay();
  const isolated = (vp: VPX, o: X3DObject) => { const x = vp.x; return !x?.isolate || x.isolate.has(o); };
  const skip = (vp: VPX) => { const x = X(vp); return x.muted || vps.some(v => X(v).solo && v !== vp); };
  function regionInvalidate() { for (const vp of vps) X(vp).regionImg = null; }
  app.events.on('scene', regionInvalidate); app.events.on('params', regionInvalidate); app.events.on('frame', regionInvalidate);
  return { cameraMenu, visibilityMenu, displayMenu, displayChecked, stereoMenu, pointerDown, pointerMove, pointerUp, beforeRender, render, afterRender, afterFrame, isolated, skip, navToolName: () => navTool, regionActive: () => regionTool, extra: X, DISPLAY_MENU, stereoMenuItems: () => SI_MENUS.viewStereo ?? [], stereoChecked: (vp: VPX) => (it: SiMenuItem) => it.label === 'Active' ? X(vp).stereo !== 'Center' : it.label === 'Swap Interlaced Eyes' ? !!(X(vp) as any).swap : X(vp).stereo === it.label ? true : undefined, fastManip: (vp: VPX) => !!vp.flags['Fast Manipulation'] };
}
export { openSiMenu };
