// Ledger row CMD-B13e: entry point of the 22 small self-installing plug-in commands (PointOven MDD / LWO / scene /
// baker, CrowdFX FBX plotting, Ultimapper, ShapeWeight, HWParsers, DirectX .x, BoneCreateTool, polymatricks,
// FR ICE import). Brief: docs/ghidra/cmd-b13e-small-plugins-binary.md and docs/re/WIRE_CORRECTIONS_B13.md.
import { App } from '../core/commands';
import { stateOf, hostFs } from './pluginsB13eShared';
import { registerPluginsB13eMddCommands } from './pluginsB13eMdd';
import { registerPluginsB13eCrowdCommands } from './pluginsB13eCrowd';
import { registerPluginsB13eLwoCommands } from './pluginsB13eLwo';
import { registerPluginsB13eDxCommands } from './pluginsB13eDx';
import { registerPluginsB13eMiscCommands } from './pluginsB13eMisc';

export function registerPluginsB13eCommands(app: App) {
  stateOf(app);
  if (!(app as any).hostFs) (app as any).hostFs = hostFs;   // the virtual host file system the commands read and write
  registerPluginsB13eMddCommands(app);
  registerPluginsB13eCrowdCommands(app);
  registerPluginsB13eLwoCommands(app);
  registerPluginsB13eDxCommands(app);
  registerPluginsB13eMiscCommands(app);
}
