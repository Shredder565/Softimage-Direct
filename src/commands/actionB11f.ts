// Ledger row CMD-B11f: the 15 action.dll commands of docs/ghidra/cmd-b11f-action-speech-shape-effects-binary.md
// (viseme / speech / Evolver actions, lip-sync freeze, shape copy / groups, deform strip, clip effects / offsets, clip cut
// in space). Original code written from the note's Wire contracts only; no XSIBATCH golden exists for the row.
//
//   speech / viseme   StoreViseme SetupEvolverVisemes CreateVisemeAction CreateSpeechAction CreateEvolverSpeechAction
//                     FreezeLipSync                                                      (actionB11fSpeech.ts)
//   shape / deform    CopyShape CreateShapeGroup SetShapeGroup StripDeformOperators
//                     Open SE for Link With Deform                                        (actionB11fShape.ts)
//   clip effects      CreateOffsetEffect RemoveEffect ResetOffset CutClipInSpace          (actionB11fClips.ts)
//
// Argument names, order and defaults: data/command_registry.json (return-value arguments, flag 0x200, left out;
// defaults from data/commands_full.json where the registry has none). These registrations replace the generic
// Animate-surface ones of animateSurface.ts (registered earlier from animate_command_gap.json).
import { App, CommandDef } from '../core/commands';
import { SPEECH_HANDLERS } from './actionB11fSpeech';
import { SHAPE_HANDLERS } from './actionB11fShape';
import { CLIP_HANDLERS } from './actionB11fClips';
import { stateOf } from './actionB11fModel';

type Arg = { name: string; default: any };
const A = (name: string, def: any = null): Arg => ({ name, default: def });
interface Spec { args: Arg[]; category: string; description?: string; undoable?: boolean }
export const B11F_COMMANDS: Record<string, Spec> = {
  StoreViseme: { category: 'Animation Mixer', args: [A('Model'), A('InputObj'), A('Name', 'StoredAction'), A('PhonemeType', 0)] },
  SetupEvolverVisemes: { category: 'Animation Mixer', args: [A('Model'), A('ClipList'), A('FileName', ''), A('KeyList'), A('Action')] },
  CreateVisemeAction: { category: 'Animation Mixer', args: [A('Model'), A('Name', 'Viseme')] },
  CreateSpeechAction: { category: 'Animation Mixer', args: [A('Face'), A('Name', 'SpeechAction')] },
  CreateEvolverSpeechAction: { category: 'Animation Mixer', args: [A('Model'), A('Name', 'SpeechAction'), A('KeyList')] },
  FreezeLipSync: { category: 'Animation Mixer', args: [A('Model')] },
  CopyShape: { category: 'Animation|Deformation', description: 'CopyShape', args: [A('Source'), A('Target')] },
  CreateShapeGroup: { category: 'Animation|Deformation', args: [A('InputObj'), A('Name', '')] },
  SetShapeGroup: { category: 'Animation|Deformation', args: [A('InputObj'), A('Name', '')] },
  StripDeformOperators: { category: 'Animation|Deformation', args: [A('InputObj')] },
  'Open SE for Link With Deform': { category: 'Animation', description: 'Open SE for Link with Deform', args: [A('Cluster'), A('LinkWithOri', false)], undoable: false },
  RemoveEffect: { category: 'Animation mixer', description: 'Remove the effect of the selected clips', args: [A('Clip')] },
  ResetOffset: { category: 'Animation Mixer', description: 'Reset the offset effect for selected parameters', args: [A('InputObjs'), A('Time')] },
  CutClipInSpace: { category: 'Animation Mixer', description: 'Cuts a clip in space', args: [A('Model'), A('InputObjs'), A('Clip')] },
  CreateOffsetEffect: { category: 'Animation Mixer', description: 'Create an offset effect in the selected clips', args: [A('Clip')] },
};

export function registerActionB11fCommands(app: App) {
  stateOf(app);
  const handlers = { ...SPEECH_HANDLERS, ...SHAPE_HANDLERS, ...CLIP_HANDLERS };
  const registered: string[] = [];
  for (const [name, spec] of Object.entries(B11F_COMMANDS)) {
    const execute = handlers[name];
    if (!execute) throw new Error(`CMD-B11f: no handler for ${name}`);
    app.register({
      name, label: name, category: spec.category, description: spec.description,
      args: spec.args.map(x => ({ ...x })), undoable: spec.undoable ?? true, execute,
    } as CommandDef);
    registered.push(name);
  }
  (app as any).actionB11f.registered = registered;
}
