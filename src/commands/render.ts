// Render Tree / material commands: connect and disconnect shader nodes on texturable ports, create shader nodes,
// scene ambience, material library helpers (Softimage: SIConnectShaderToCnxPoint, DisconnectShader, CreateShaderFromPreset).
import { App } from '../core/commands';
import { Shader, Material, X3DObject, makeSiShader, Property } from '../core/scene';
import { TEXTURE_NODES, MATERIAL_PRESETS } from '../core/shaders';
import { color } from '../core/params';

const shaderOf = (app: App, s: any): Shader => { if (s instanceof Shader) return s; if (typeof s === 'string') { const found = findShader(app, s); if (found) return found; } const n = app.selection[app.selection.length - 1]; if (n instanceof Shader) return n; if (n instanceof Material && n.surface) return n.surface; if (n instanceof X3DObject && n.material?.surface) return n.material.surface; throw new Error('Select a shader (or an object with a local material)'); };
export function findShader(app: App, name: string): Shader | undefined { for (const m of app.scene.materials) { const walk = (s: Shader): Shader | undefined => { if (s.name === name || s.fullName === name) return s; for (const i of s.inputs.values()) { const r = walk(i); if (r) return r; } return undefined; }; if (m.surface) { const r = walk(m.surface); if (r) return r; } } return undefined; }

export function registerRenderCommands(app: App) {
  app.register({ name: 'CreateShaderFromPreset', label: 'Create Shader', category: 'Rendering', args: [{ name: 'Preset', default: 'Image' }, { name: 'Name', default: '' }], execute(app, a) { const s = makeSiShader(String(a.Preset).replace(/^Shaders\\(Texture|Mixers|Image)\\/, ''), a.Name || undefined); if (!s) throw new Error(`Shader preset "${a.Preset}" is not bundled`); return s; } });
  app.register({ name: 'ConnectShaderNode', label: 'Connect Shader', category: 'Rendering', args: [{ name: 'Shader', default: null }, { name: 'Port', default: 'diffuse' }, { name: 'Preset', default: 'Image' }, { name: 'Node', default: null }], execute(app, a) {
    const sh = shaderOf(app, a.Shader); const port = a.Port; if (!sh.ports().includes(port) && !sh.get(port)) throw new Error(`${sh.name} has no texturable port "${port}"`);
    const node: Shader = a.Node instanceof Shader ? a.Node : app.run('CreateShaderFromPreset', { Preset: a.Preset });
    const old = sh.inputs.get(port) ?? null; app.record('Connect ' + node.name, () => sh.connect(port, node), () => sh.connect(port, old)); app.events.emit('scene'); return node;
  } });
  app.register({ name: 'DisconnectShader', label: 'Disconnect Shader', category: 'Rendering', args: [{ name: 'Shader', default: null }, { name: 'Port', default: 'diffuse' }], execute(app, a) { const sh = shaderOf(app, a.Shader); const old = sh.inputs.get(a.Port) ?? null; if (!old) return null; app.record('Disconnect', () => sh.connect(a.Port, null), () => sh.connect(a.Port, old)); app.events.emit('scene'); return old; } });
  app.register({ name: 'ReplaceSurfaceShader', label: 'Replace Surface Shader', category: 'Rendering', args: [{ name: 'Material', default: '' }, { name: 'Preset', default: 'Phong' }], execute(app, a) { const n = app.selection[app.selection.length - 1]; const mat = a.Material ? app.scene.materials.find(m => m.name === a.Material) : n instanceof Material ? n : n instanceof X3DObject ? n.material : null; if (!mat) throw new Error('Select a material'); const s = makeSiShader(a.Preset); if (!s) throw new Error('Unknown shader ' + a.Preset); const old = mat.surface; const inputs = old ? [...old.inputs] : []; app.record('Replace shader', () => { mat.setSurface(s); for (const [k, v] of inputs) if (s.ports().includes(k)) s.connect(k, v); }, () => mat.setSurface(old)); app.events.emit('scene'); return s; } });
  app.register({ name: 'SetSceneAmbience', label: 'Ambient Lighting', category: 'Rendering', args: [{ name: 'Color', default: null }], execute(app, a) { let p = app.scene.root.property('ambience'); if (!p) { p = new Property('Ambient Lighting', 'ambience', [color('ambience', [0.2, 0.2, 0.2], 'Ambience', { animatable: true })]); const pp = p; app.record('Ambient Lighting', () => app.scene.root.addProperty(pp), () => app.scene.root.removeProperty(pp)); } if (a.Color) app.setParam(p.get('ambience')!, a.Color); app.select([p]); return p; } });
  app.register({ name: 'SIGetMaterialPresets', label: 'Material Presets', category: 'Rendering', args: [], undoable: false, execute() { return Object.keys(MATERIAL_PRESETS); } });
  void TEXTURE_NODES;
}
