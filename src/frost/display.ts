/** Three.js display for FROST particles, hair strands, and cloth mesh deform. */

import * as THREE from 'three';
import type { App } from '../core/commands';
import { frostOf } from './session';

/** Attach Points + LineSegments + cloth Mesh overlays; updates on frame/params. */
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

  // Cloth mesh deform (solid)
  const clothGeo = new THREE.BufferGeometry();
  clothGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  const clothMat = new THREE.MeshStandardMaterial({
    color: 0x6a8f9e,
    side: THREE.DoubleSide,
    flatShading: true,
    transparent: true,
    opacity: 0.88,
    metalness: 0.05,
    roughness: 0.75,
    depthTest: true,
  });
  const clothMesh = new THREE.Mesh(clothGeo, clothMat);
  clothMesh.renderOrder = 10;
  (clothMesh as any)._frost = true;
  clothMesh.frustumCulled = false;
  scene.add(clothMesh);

  // Cloth wireframe overlay
  const clothWireGeo = new THREE.BufferGeometry();
  clothWireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  const clothWireMat = new THREE.LineBasicMaterial({
    color: 0xb8d4de,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });
  const clothWire = new THREE.LineSegments(clothWireGeo, clothWireMat);
  clothWire.renderOrder = 14;
  (clothWire as any)._frost = true;
  clothWire.frustumCulled = false;
  scene.add(clothWire);

  let indexStamp = '';
  const sync = () => {
    const pos = frost.positions;
    const lines = frost.strandLines;
    const cpos = frost.clothPositions;
    const cwire = frost.clothWire;

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

    // —— Cloth mesh deform ——
    const cloth = frost.state.cloth;
    const clothMode = frost.state.attrs.get('ClothDisplayMode');
    const wireOnly = Array.isArray(clothMode) && Number(clothMode[0]) === 1;
    if (cloth?.alive && cpos.length >= 9) {
      clothGeo.setAttribute('position', new THREE.BufferAttribute(cpos, 3));
      const idxKey = `${cloth.indices.length}:${cloth.pin.length}`;
      if (idxKey !== indexStamp) {
        indexStamp = idxKey;
        if (cloth.indices.length >= 3) {
          clothGeo.setIndex(new THREE.BufferAttribute(cloth.indices, 1));
        } else {
          clothGeo.setIndex(null);
        }
      }
      clothGeo.computeVertexNormals();
      clothGeo.computeBoundingSphere();
      clothMesh.visible = !wireOnly;
      clothWireGeo.setAttribute('position', new THREE.BufferAttribute(cwire.length ? cwire : new Float32Array(0), 3));
      clothWireGeo.computeBoundingSphere();
      clothWire.visible = wireOnly || cwire.length > 0;
      if (!wireOnly) clothWire.visible = false; // mesh mode: solid only
      if (wireOnly) clothMesh.visible = false;
    } else {
      clothMesh.visible = false;
      clothWire.visible = false;
    }

    needs();
  };

  app.events.on('frame', sync);
  app.events.on('params', sync);
  app.events.on('scene', sync);
  app.events.on('newscene', () => { frost.reset(); sync(); });
  sync();
  return { points, strands, tipPoints, clothMesh, clothWire, sync };
}
