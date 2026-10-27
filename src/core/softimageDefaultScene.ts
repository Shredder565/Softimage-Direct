// Softimage-faithful default scene seed (Camera + light + sphere).
// Softimage New Scene: Camera + light under Scene_Root; viewport grid is display-only.
// AfterImage also seeds a sphere so still plates show recognizable Softimage-like geo
// (empty Scene_Root → ambience-only plate looked like static / no content).
import type { App } from './commands';

/**
 * Ensure Softimage default objects exist. Idempotent — skips names already present.
 * Call after command registration and after NewScene recreates the Scene.
 */
export function ensureSoftimageDefaultScene(app: App): void {
  const names = new Set([...app.scene.allObjects()].map(o => o.name));
  const hasCam = [...app.scene.allObjects()].some(o => o.type === 'camera');
  const hasLight = [...app.scene.allObjects()].some(o => o.type === 'light');
  const hasMesh = [...app.scene.allObjects()].some(o => !!o.primitive?.mesh());

  // Softimage: Camera named "Camera" (Pass.Camera default).
  if (!hasCam && !names.has('Camera') && app.commands.has('GetPrimCamera')) {
    try {
      app.run('GetPrimCamera', { PresetObj: 'Camera', Name: 'Camera' });
    } catch {
      /* command not wired yet */
    }
  }
  // Softimage: default infinite light named "light".
  if (!hasLight && !names.has('light') && app.commands.has('GetPrimLight')) {
    try {
      app.run('GetPrimLight', { PresetObj: 'Infinite', Name: 'light' });
    } catch {
      try {
        app.run('GetPrimLight', { PresetObj: 'Point', Name: 'light' });
      } catch {
        /* ignore */
      }
    }
  }
  // Softimage-like starter mesh for still recognition (grid stays viewport GridHelper).
  if (!hasMesh && !names.has('sphere') && app.commands.has('CreatePrim')) {
    try {
      app.run('CreatePrim', { PresetObj: 'Sphere', GeometryType: 'MeshSurface', Name: 'sphere' });
    } catch {
      /* ignore */
    }
  }
  app.select([]);
  app.events.emit('scene');
}
