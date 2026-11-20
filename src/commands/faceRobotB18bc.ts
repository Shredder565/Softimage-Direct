// Ledger rows CMD-B18b / CMD-B18c: registration entry for the Face Robot preparation / eyelid (faceRobotB18b.ts) and
// lip-sync / tongue (faceRobotB18c.ts) script commands. `app.register` overwrites, so these replace the argument-less
// shells of src/commands/faceRobotModule.ts `frHostShells` / `frPrepShells`.
// Check script: tools/compare_fr_b18bc_commands.mjs. Original code; see the two row files for the briefs.
import { App } from '../core/commands';
import { Property, Cluster, Operator, Group, Model } from '../core/scene';
import { EnvelopeOperator } from '../core/envelope';
import { hostFs } from '../core/sdkHelpersHostFs';
import { registerFaceRobotB18bCommands, clipWeights, MouthInteriorOp, EyeSocketOp, evalTangentFCurve } from './faceRobotB18b';
import { registerFaceRobotB18cCommands, parseLanguage, phonemeLabel } from './faceRobotB18c';
import { b18 } from './faceRobotB18bcShared';
import { getPolymesh } from './faceRobotB18bPoly';
import { buildSampleFace, frState, meshObject, newNull, ensureGroup, addObject } from './faceRobotB14Shared';

export function registerFaceRobotB18bcCommands(app: App) {
  registerFaceRobotB18bCommands(app);
  registerFaceRobotB18cCommands(app);
  // test hooks for tools/compare_fr_b18bc_commands.mjs
  (app as any).frB18bc = {
    state: () => b18(app), fr: () => frState(app), buildSampleFace: () => buildSampleFace(app), meshObject: (n: string, v: number[][], f: number[][]) => meshObject(app, n, v, f),
    addObject: (o: any, p?: any) => addObject(app, o, p), newNull: (n: string, p?: any) => newNull(app, n, p), ensureGroup: (n: string) => ensureGroup(app, n),
    polymesh: (o: any, ov?: any) => getPolymesh(app, o, ov), clipWeights, evalTangentFCurve, parseLanguage: (f: string) => parseLanguage(app, f), phonemeLabel,
    hostFs, Property, Cluster, Operator, Group, Model, EnvelopeOperator, MouthInteriorOp, EyeSocketOp,
  };
}
