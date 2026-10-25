/** Three.js point-cloud display for FROST particle buffers. */

import * as THREE from 'three';
import type { App } from '../core/commands';
import { frostOf } from './session';

/** Attach a Points overlay to the viewport scene; updates on frame/params. */
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

  let stamp = '';
  const sync = () => {
    const pos = frost.positions;
    const key = `${pos.length}:${pos.length ? pos[0]?.toFixed?.(3) : ''}:${app.anim.frame}`;
    if (key === stamp && pos.length === (geo.attributes.position as THREE.BufferAttribute).count * 3) {
      // still refresh attribute if buffer identity changed
    }
    stamp = key;
    const attr = new THREE.BufferAttribute(pos.length ? pos : new Float32Array(0), 3);
    geo.setAttribute('position', attr);
    geo.computeBoundingSphere();
    points.visible = pos.length > 0;
    needs();
  };

  app.events.on('frame', sync);
  app.events.on('params', sync);
  app.events.on('scene', sync);
  app.events.on('newscene', () => { frost.reset(); sync(); });
  sync();
  return { points, sync };
}
