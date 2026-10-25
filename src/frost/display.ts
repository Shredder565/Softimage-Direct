/** Three.js display for FROST particle points + hair strand lines. */

import * as THREE from 'three';
import type { App } from '../core/commands';
import { frostOf } from './session';

/** Attach Points + LineSegments overlays; updates on frame/params. */
export function installFrostDisplay(app: App, scene: THREE.Scene, needs: () => void) {
  const frost = frostOf(app);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  const mat = new THREE.PointsMaterial({
    color: 0x7ec8e3,
    size: 4,
    sizeAttenuation: false,
    depthTest: true,
    transparent: true,
    opacity: 0.95,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = 11;
  (points as any)._frost = true;
  points.frustumCulled = false;
  scene.add(points);

  const strandGeo = new THREE.BufferGeometry();
  strandGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  const strandMat = new THREE.LineBasicMaterial({
    color: 0xc4a484,
    transparent: true,
    opacity: 0.92,
    depthTest: true,
  });
  const strands = new THREE.LineSegments(strandGeo, strandMat);
  strands.renderOrder = 12;
  (strands as any)._frost = true;
  strands.frustumCulled = false;
  scene.add(strands);

  // Optional tip points when HairLook displayMode=points (or mixed)
  const tipGeo = new THREE.BufferGeometry();
  tipGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  const tipMat = new THREE.PointsMaterial({
    color: 0xe8c9a0,
    size: 3,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
  });
  const tipPoints = new THREE.Points(tipGeo, tipMat);
  tipPoints.renderOrder = 13;
  (tipPoints as any)._frost = true;
  tipPoints.frustumCulled = false;
  scene.add(tipPoints);

  let stamp = '';
  const sync = () => {
    const pos = frost.positions;
    const lines = frost.strandLines;
    const key = `${pos.length}:${lines.length}:${app.anim.frame}:${frost.state.strands.length}`;
    stamp = key;

    geo.setAttribute('position', new THREE.BufferAttribute(pos.length ? pos : new Float32Array(0), 3));
    geo.computeBoundingSphere();
    points.visible = pos.length > 0;

    strandGeo.setAttribute('position', new THREE.BufferAttribute(lines.length ? lines : new Float32Array(0), 3));
    strandGeo.computeBoundingSphere();

    const modeAttr = frost.state.attrs.get('HairDisplayMode');
    const pointsMode = Array.isArray(modeAttr) && Number(modeAttr[0]) === 1;
    strands.visible = lines.length > 0 && !pointsMode;

    if (pointsMode && frost.state.strands.length) {
      const tips = new Float32Array(frost.state.strands.length * 3);
      let t = 0;
      for (const st of frost.state.strands) {
        if (!st.alive) continue;
        const i = st.segments * 3;
        tips[t++] = st.pos[i]; tips[t++] = st.pos[i + 1]; tips[t++] = st.pos[i + 2];
      }
      tipGeo.setAttribute('position', new THREE.BufferAttribute(tips.subarray(0, t), 3));
      tipGeo.computeBoundingSphere();
      tipPoints.visible = t > 0;
    } else {
      tipPoints.visible = false;
    }

    // Tint strands from HairLook root color when present
    const root = frost.state.attrs.get('HairRootColor');
    if (Array.isArray(root) && root.length >= 3) {
      strandMat.color.setRGB(Number(root[0]), Number(root[1]), Number(root[2]));
    }

    needs();
  };

  app.events.on('frame', sync);
  app.events.on('params', sync);
  app.events.on('scene', sync);
  app.events.on('newscene', () => { frost.reset(); sync(); });
  sync();
  return { points, strands, tipPoints, sync };
}
