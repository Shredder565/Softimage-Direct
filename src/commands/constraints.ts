// Kinematic constraints (MCP Constrain button / Animate > Create > Constraint): ApplyCns with Softimage's preset names,
// Remove Constraint(s), Select Constraining/Constrained, and the Direction constraint that cameras and spotlights are born with.
import { App } from '../core/commands';
import { X3DObject, Constraint, Null, Camera, Light } from '../core/scene';
import { num, bool } from '../core/params';

export const CNS_PRESETS: Record<string, { type: string; label: string; min: number; defs: () => any[] }> = {
  Position: { type: 'poscns', label: 'Position Cns', min: 1, defs: () => [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight', { min: 0, max: 1 }), num('offsetx', 0, 'Offset X'), num('offsety', 0, 'Offset Y'), num('offsetz', 0, 'Offset Z')] },
  Orientation: { type: 'oricns', label: 'Orientation Cns', min: 1, defs: () => [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight', { min: 0, max: 1 }), num('offsetx', 0, 'Offset X'), num('offsety', 0, 'Offset Y'), num('offsetz', 0, 'Offset Z')] },
  Direction: { type: 'dircns', label: 'Direction Cns', min: 1, defs: () => [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight', { min: 0, max: 1 }), bool('dirx', false, 'Align X axis (bones)'), num('roll', 0, 'Roll', { min: -360, max: 360 }), bool('upvct_active', false, 'Use Up Vector')] },
  Pose: { type: 'posecns', label: 'Pose Cns', min: 1, defs: () => [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight', { min: 0, max: 1 }), bool('cnsscl', true, 'Constrain Scaling')] },
  Distance: { type: 'dstcns', label: 'Distance Cns', min: 1, defs: () => [bool('active', true, 'Active'), num('distance', 5, 'Distance', { min: 0 })] },
  Scaling: { type: 'sclcns', label: 'Scaling Cns', min: 1, defs: () => [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight', { min: 0, max: 1 })] },
  'Up-Vector': { type: 'upvct', label: 'Up Vector Reference', min: 1, defs: () => [bool('active', true, 'Active')] },
  '2 Points': { type: 'poscns', label: '2 Points Cns', min: 2, defs: () => [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight', { min: 0, max: 1 })] },
  '3 Points': { type: 'poscns', label: '3 Points Cns', min: 3, defs: () => [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight', { min: 0, max: 1 })] },
  'N Points': { type: 'poscns', label: 'N Points Cns', min: 1, defs: () => [bool('active', true, 'Active'), num('blendweight', 1, 'Blend Weight', { min: 0, max: 1 })] },
  'Curve (Path)': { type: 'poscns', label: 'Path Cns', min: 1, defs: () => [bool('active', true, 'Active'), num('perc', 0, 'Path %', { min: 0, max: 100 })] },
  Symmetry: { type: 'poscns', label: 'Symmetry Cns', min: 1, defs: () => [bool('active', true, 'Active')] },
  'Object to Cluster': { type: 'poscns', label: 'Object to Cluster Cns', min: 1, defs: () => [bool('active', true, 'Active')] },
};
const ALIAS: Record<string, string> = {
  'Pin Object into Position (Toggle)': 'Position', 'Curve (Param)': 'Curve (Path)', 'Surface (Param)': 'Position',
  'Chain Up Vector': 'Up-Vector', 'Chain Preferred Axis': 'Up-Vector', 'Bounding Volume': 'Position', 'Bounding Plane': 'Position',
  // Animate > Create > Path menu binds ApplyCns with PresetObj Path / Trajectory (Softimage PE)
  Path: 'Curve (Path)', Trajectory: 'Curve (Path)', 'Curve (Path)': 'Curve (Path)',
};
const cnsKey = (a: any) => ALIAS[a.Preset ?? a.PresetObj] ?? (a.Preset ?? a.PresetObj);

export function addConstraint(app: App, o: X3DObject, preset: string, targets: X3DObject[]): Constraint {
  const k = ALIAS[preset] ?? preset; const d = CNS_PRESETS[k]; if (!d) throw new Error(`Constraint "${preset}" is not available`);
  const c = new Constraint(d.label, d.type, d.defs(), targets); if (d.type === 'dircns' && (o.type === 'bone' || o.type === 'root')) c.set('dirx', true);
  if (d.type === 'upvct') { const dir = o.properties.find(p => p instanceof Constraint && p.type === 'dircns') as any; if (dir) { dir.upVector = targets[0]; dir.set('upvct_active', true); return dir; } }
  app.record('Apply ' + d.label, () => o.addProperty(c), () => o.removeProperty(c)); return c;
}

export function registerConstraintCommands(app: App) {
  app.register({
    name: 'ApplyCns', label: 'Apply Constraint', category: 'Constraints', description: 'Constrains the selected object(s) to the picked object(s).',
    args: [{ name: 'Preset', default: 'Position' }, { name: 'InputObjs', default: '' }, { name: 'Target', default: '' }, { name: 'Compensate', default: false }],
    canRun: (a) => !!(CNS_PRESETS[cnsKey(a)]),
    execute(app, a) {
      const preset = cnsKey(a);
      let objs = app.targets(a.InputObjs || a.ConstrainedObj); let targets = app.targets(a.Target || a.ConstrainingObj);
      if (!targets.length) { // MCP usage: last selected = constraining object, the rest get constrained
        if (objs.length < 2) throw new Error(`${preset}: select the object(s) to constrain, then add the constraining object to the selection and apply again`);
        targets = [objs[objs.length - 1]]; objs = objs.slice(0, -1);
      }
      const out = objs.map(o => addConstraint(app, o, preset, targets)); app.events.emit('scene'); app.select(out); return out.length === 1 ? out[0] : out;
    },
  });
  app.register({ name: 'RemoveCns', label: 'Remove Constraint', category: 'Constraints', args: [{ name: 'InputObjs', default: '' }, { name: 'Type', default: '' }], execute(app, a) { let k = 0; for (const o of app.targets(a.InputObjs)) { const cs = o.properties.filter(p => p instanceof Constraint && (!a.Type || p.type === a.Type)); const last = a.Type ? cs : cs.slice(-1); for (const c of last) { app.record('Remove ' + c.name, () => o.removeProperty(c), () => o.addProperty(c)); k++; } } app.events.emit('scene'); return k; } });
  app.register({ name: 'SelectConstrainingObjects', label: 'Select Constraining Objects', category: 'Constraints', args: [], undoable: false, execute(app) { const out = new Set<X3DObject>(); for (const o of app.selectedObjects) for (const p of o.properties) if (p instanceof Constraint) p.targets.forEach(t => out.add(t)); app.select([...out]); return [...out]; } });
  app.register({ name: 'SelectObjectsConstrained', label: 'Select Objects Constrained', category: 'Constraints', args: [], undoable: false, execute(app) { const sel = new Set(app.selectedObjects); const out: X3DObject[] = []; for (const o of app.scene.allObjects()) for (const p of o.properties) if (p instanceof Constraint && p.targets.some(t => sel.has(t))) { out.push(o); break; } app.select(out); return out; } });
}

/** Softimage's camera / spotlight rigs: <name>_Root (at the rig position) > <name> (constrained) + <name>_Interest.
 *  Positions verified against the application: Spot_Root (3,3,3) interest (-3,-3,-3); Camera_Root (0,2,20) interest (0,-2,-20). */
export function makeAimRig(app: App, kind: 'Spot' | 'Camera', name: string, parent?: X3DObject | null): { root: Null; obj: X3DObject; interest: Null } {
  const base = app.scene.uniqueName(name || kind);
  const root = new Null(base + '_Root'); (root as any).type = kind === 'Spot' ? 'SpotRoot' : 'CameraRoot';
  const obj = kind === 'Spot' ? new Light(base, 'spot') : new Camera(base);
  const interest = new Null(base + '_Interest'); (interest as any).type = kind === 'Spot' ? 'SpotInterest' : 'CameraInterest';
  const rp = kind === 'Spot' ? [3, 3, 3] : [0, 2, 20]; root.kinematics.local.set('posx', rp[0]); root.kinematics.local.set('posy', rp[1]); root.kinematics.local.set('posz', rp[2]);
  interest.kinematics.local.set('posx', -rp[0]); interest.kinematics.local.set('posy', -rp[1]); interest.kinematics.local.set('posz', -rp[2]);
  root.addChild(obj); root.addChild(interest);
  const cns = new Constraint('Direction Cns', 'dircns', CNS_PRESETS.Direction.defs(), [interest]); obj.addProperty(cns);
  const p = parent ?? app.scene.root; app.record(`Get ${kind}`, () => p.addChild(root), () => p.removeChild(root));
  return { root, obj, interest };
}
