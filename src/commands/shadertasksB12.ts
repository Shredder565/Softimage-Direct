// Ledger rows CMD-B12f and CMD-B12g (shadertasks.dll): entry point of the 29 shader-connection, replace, instance-data
// and shader-compound / tree / definition commands. Briefs: docs/ghidra/cmd-b12f-shadertasks-shaders-cnx-arrays-binary.md
// and docs/ghidra/cmd-b12g-shadertasks-compounds-trees-binary.md.
import { App } from '../core/commands';
import { stateOf } from './shadertasksB12Shared';
import { registerShadertasksB12fCommands } from './shadertasksB12f';
import { registerShadertasksB12gCommands } from './shadertasksB12g';
import { ShaderCompound, CompoundPort } from '../core/shaderCompound';
import { hostFs } from '../core/sdkHelpersHostFs';

export function registerShadertasksB12Commands(app: App) {
  (stateOf(app) as any).classes = { ShaderCompound, CompoundPort, hostFs };   // for scripts and checks
  registerShadertasksB12fCommands(app);
  registerShadertasksB12gCommands(app);
}
