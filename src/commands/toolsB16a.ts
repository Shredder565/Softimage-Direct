// Row CMD-B16a: the 72 tool-activation commands of toolmanager.dll, wired to the wire contract of
// docs/ghidra/cmd-b16a-tool-activation-commands.md and items 1–12 of docs/re/WIRE_CORRECTIONS_B16.md.
//
//   handler 0461b2c6 (68 commands): activate the tool class named by the `Clsid` argument through the tool manager
//     (src/core/toolManager.ts): GUID_NULL = the last auxiliary tool; already current = nothing unless
//     Interaction.stickytoggle (toggle off) or the restart modifier; key-down / key-up paths; last-auxiliary recorder.
//   handler 0461b2bd (`Delete Components`, `Paint Tool` {CF80CBC2-…}, `Add Surface Point Tool`): command-tool session
//     dispatcher, start on key-down, end otherwise; the `CmdID` argument is ignored (the command's own GUID is used).
//   handler 0461b2c7 (`XYZ Transform `): command-state notification relay; unknown `Property` = E_INVALIDARG.
// All 72: not undoable, no log line, no return value, no error for an uncreatable class (correction 11); not disabled by
// the registry flags (correction 12). Argument names / defaults: data/commands_full.json (registry `handler_clsid` of a
// VT_CLSID argument is its default, correction 1).
//
// What a tool class does in the viewport is outside the note. Each class's body is this build's existing viewport tool,
// taken from the registration that held the command name before this module replaced it (src/commands/model.ts,
// model2.ts, moduleToolbar.ts, inferredB10Views.ts …): those registrations are now only the class bodies. Classes this
// build has no tool for log "not yet attested" and still become the current tool.
// The exec-context words A / B (key / key-down / restart flags) come from `app.toolExecContext` when a caller sets it
// (no key handler does yet); a script or menu call has A = B = 0 (inferred, open question Q2 of the note).
import { App, type CommandDef } from '../core/commands';
import { ToolManager, type ToolClass, type ToolExecContext, CLS, GUID_NULL, E_INVALIDARG, normGuid, braceGuid } from '../core/toolManager';
import { fail } from './inferredB10Shared';

const NOTE = 'CMD-B16a';
type Handler = 'A' | 'S' | 'N';
type Row = [busName: string, registryName: string, cmdGuid: string, handler: Handler, args: [string, any][], category: string, description: string];
/** The 72 commands (data/command_registry.json handlers 0461b2c6 / 0461b2bd / 0461b2c7; defaults from commands_full.json).
 *  The second `Paint Tool` entry (command {CF80CBC2-…}) shares its name with two others; it is on the bus under its
 *  command GUID (inferred bus key, see the analyst questions of the PR). */
export const B16A_COMMANDS: Row[] = [
  ['XYZ Transform ', 'XYZ Transform ', 'b4238eb0-1d86-11d1-806d-00a024c78ee3', 'N', [['Property', 'SI3D_COMMAND_EXECUTED']], '', 'Todo: XYZ transform'],
  ['TranslateTool', 'Translate Tool', 'a05af491-aa05-11d0-b6da-00aa0068bf56', 'A', [['Clsid', '{3A711FF0-8798-11D1-84B1-00AA00135F7B}']], 'Manipulation', 'Activate the Translate tool'],
  ['RotationTool', 'Rotation Tool', 'a05af492-aa05-11d0-b6da-00aa0068bf56', 'A', [['Clsid', '{ECBAD3A0-974B-11D1-84BF-00AA00135F7B}']], 'Manipulation', 'Activate the Rotation tool'],
  ['ScalingTool', 'Scaling Tool', 'a05af493-aa05-11d0-b6da-00aa0068bf56', 'A', [['Clsid', '{F500BD80-974B-11D1-84BF-00AA00135F7B}']], 'Manipulation', 'Activate the Scaling tool'],
  ['LastTool', 'Last Auxiliary Tool', 'edb85710-b30c-4cbb-b336-0756dcfed597', 'A', [['Clsid', '{00000000-0000-0000-0000-000000000000}']], 'Manipulation', 'Activate the last auxiliary (non-Selection/SRT/Navigate) tool'],
  ['DirectManipTool', 'Direct Manip Tool', '5c960195-d24c-4855-80a4-6b15b6369bfb', 'A', [['Clsid', '{907A713D-ED09-46CD-8960-D58345E95A02}']], 'Manipulation', 'Activate the Direct Manip tool'],
  ['HairScalingTool', 'Hair Scaling Tool', '5e413414-10cb-4947-ae6f-9f30eafbadc0', 'A', [['Clsid', '{B3672C3B-31D5-4A34-A6D1-3B5D019D405F}']], 'Manipulation', 'Activate the Hair Scaling tool'],
  ['HairClumpTool', 'Hair Clump Tool', '33946083-0f3a-48cc-bf3e-b32b2fad1c04', 'A', [['Clsid', '{AA0B2DFF-4B7E-42DE-AB2E-2F77F084D99B}']], 'Manipulation', 'Activate the Hair Clump tool'],
  ['HairStandOnEndTool', 'Hair Stand On End Tool', 'cff668a4-1156-49d8-b8a7-bd4be5a5ffe8', 'A', [['Clsid', '{9F91CAC4-0CFF-420A-881D-2C68F99FAB7C}']], 'Manipulation', 'Activate the Hair Stand On End tool'],
  ['HairPuffRootsTool', 'Hair Puff Roots', '31d3e298-e2cf-11d5-a2dd-08003658d403', 'A', [['Clsid', '{481ADB88-E2CF-11D5-A2DD-08003658D403}']], 'Manipulation', 'Activate the Hair Puff Roots tool'],
  ['HairRotateRootTool', 'Hair Rotate Root Tool', '27d6baef-5c4e-4783-8db8-8139fc659ce6', 'A', [['Clsid', '{825FCD04-4E50-4938-8DE1-258DB92CF19E}']], 'Manipulation', 'Activate the Hair Rotate Root tool'],
  ['HairRotateTipTool', 'Hair Rotate Tip Tool', '254095e4-eb17-11d5-a2e0-08003658d403', 'A', [['Clsid', '{B962F218-EB16-11D5-A2E0-08003658D403}']], 'Manipulation', 'Activate the Hair Rotate Tip tool'],
  ['HairRotateCursorTool', 'Hair Rotate Cursor Tool', '1bcae6cc-e2cf-11d5-a2dd-08003658d403', 'A', [['Clsid', '{657CF6B6-E2CF-11D5-A2DD-08003658D403}']], 'Manipulation', 'Activate the Hair Rotate Cursor tool'],
  ['AddParticleTool', 'Add Particle Tool', '1a941426-878f-48d8-8c18-61ac27ef4670', 'A', [['Clsid', '{CC06852C-3D4D-4226-B85C-C8A7B4C2C7A0}']], 'Drawing', ''],
  ['SketchCurveTool', 'Sketch Curve Tool', '126fcf21-a7cb-11d1-a8fe-00a024190119', 'A', [['Clsid', '{218A3C00-A7CE-11D1-A8FE-00A024190119}']], 'Drawing', ''],
  ['AddPointOnCurveToolByKnotPoints', 'Add Point on Curve Tool by Knot Points', '46353acd-408a-4f3f-a0bb-0244a6cc9af5', 'A', [['Clsid', '{76CFF041-A941-4EE6-B011-A46005468130}']], 'Modeling|Drawing', ''],
  ['AddPointOnCurveToolByCVs', 'Add Point on Curve Tool by CVs', '2bb0233a-293a-44df-8a83-feea941bce9b', 'A', [['Clsid', '{23D2D99E-020C-4CBC-AE16-968164C1126E}']], 'Modeling|Drawing', ''],
  ['AddPointOnCurveToolByBezierKnotPoints', 'Add Point on Curve Tool by Bezier-Knot Points', 'e5ab5b29-a386-4cc5-a040-34956cd44199', 'A', [['Clsid', '{6EB05159-5482-4508-8DA3-28694066C816}']], 'Modeling|Drawing', ''],
  ['Add Polygon Tool', 'Add Polygon Tool', 'efc008c0-3317-11d4-8c24-009027bc3a0e', 'A', [['Clsid', '{B1F9EF80-2B54-11D4-8C23-009027BC3A0E}']], 'Modeling|Drawing', ''],
  ['Slice Polygons Tool', 'Slice Polygons Tool', '6ca134e9-64ea-494b-a7ee-e47bf8d16931', 'A', [['Clsid', '{BA9E4840-F301-40DF-B935-4E34B2DA853B}']], 'Modeling|Drawing', ''],
  ['Add Edge Tool', 'Add Edge Tool', '87f68420-4782-11d4-8c27-009027bc3a0e', 'A', [['Clsid', '{33CCA460-4782-11D4-8C27-009027BC3A0E}']], 'Modeling|Drawing', ''],
  ['AddVertexTool', 'Add Vertex Tool', '64578190-b32e-11d4-8c47-009027bc3a0e', 'A', [['Clsid', '{64578190-B32E-11D4-8C47-009027BC3A0E}']], 'Modeling|Drawing', ''],
  ['SplitEdgeTool', 'Split Edge Tool', 'cb7d9160-46b2-11d4-8c28-009027bc3a0e', 'A', [['Clsid', '{DBC628E0-46B2-11D4-8C28-009027BC3A0E}']], 'Modeling|Drawing', ''],
  ['Split Polygon Tool', 'Split Polygon Tool', 'c6737510-67ea-11d4-8c2d-009027bc3a0e', 'A', [['Clsid', '{3500A6F0-67DD-11D4-8C2D-009027BC3A0E}']], 'Modeling|Drawing', ''],
  ['DelPointOnCurveTool', 'Delete Point on Curve Tool', '56f7ecf0-cd24-11d3-a9ba-009027bc65d7', 'A', [['Clsid', '{56F7ECF1-CD24-11D3-A9BA-009027BC65D7}']], 'Modeling|Drawing', ''],
  ['CVNURBSCurveTool', 'CV NURBS Curve Tool', '218a18dd-d349-11d2-91ef-00a0c9612e3a', 'A', [['Clsid', '{7CFE3E5B-D182-11D2-91ED-00A0C9612E3A}']], 'Drawing', ''],
  ['NURBSCurveTool', 'Interpolating NURBS Curve Tool', '24c6539c-e239-11d2-9205-00a0c9612e3a', 'A', [['Clsid', '{24C6539B-E239-11D2-9205-00A0C9612E3A}']], 'Drawing', ''],
  ['BezierCurveTool', 'Bezier Curve Tool', '784a7f35-70cf-4ebf-a3f9-e5b9d05881db', 'A', [['Clsid', '{CC5C427C-0A50-411D-BDA5-E03F3DCD0F25}']], 'Drawing', ''],
  ['LinearCurveTool', 'Linear Curve Tool', 'd8c56033-e2e0-11d2-9205-00a0c9612e3a', 'A', [['Clsid', '{BF47DBF9-E2E0-11D2-9205-00A0C9612E3A}']], 'Drawing', ''],
  ['Activate Current Select Tool using Filter', 'Activate Current Select Tool using Filter', '9b419340-0aa8-11d2-84cb-00aa00135f7b', 'A', [['Clsid', '{11778840-8C5C-11D1-84B5-00AA00135F7B}']], 'Selection', 'Activates the current Select tool without changing the current filter'],
  ['CamPanZoomTool', 'Pan and Zoom Tool', '5d11c410-9975-11d1-84bf-00aa00135f7b', 'A', [['Clsid', '{BF330862-9693-11D1-84BF-00AA00135F7B}']], 'Navigation|Viewing', 'Activate the camera Pan and Zoom tool'],
  ['CamZoomTool', 'Zoom Tool', '2ca3dde2-e365-4a58-b8c6-cb9ae2796437', 'A', [['Clsid', '{7CCED755-7501-4BBA-BAA8-38A58284FAEA}']], 'Navigation|Viewing', 'Activate the camera Zoom tool'],
  ['CamMayaZoomTool', 'Maya Zoom Tool', 'b6bd7115-c77b-4220-ac14-29f3b2beeaaa', 'A', [['Clsid', '{462D51A8-DC72-46E9-AD70-AFBF3CF87835}']], 'Navigation|Viewing', 'Activate the Maya-style camera zoom tool'],
  ['CamRectZoomTool', 'Rectangular Zoom Tool', '29c0eff0-9981-11d1-84bf-00aa00135f7b', 'A', [['Clsid', '{880441F1-570C-11D2-817F-00A0248F9397}']], 'Navigation|Viewing', 'Activate the camera Rectangular Zoom tool'],
  ['CamOrbitTool', 'Orbit Tool', '212e0191-9027-11d0-b6cc-00aa0068bf56', 'A', [['Clsid', '{1CEB5700-7881-11D1-84B0-00AA00135F7B}']], 'Navigation|Viewing', 'Activate the camera Orbit tool'],
  ['CamDollyTool', 'Dolly Tool', '04a30561-9a50-11d0-b6d5-00aa0068bf56', 'A', [['Clsid', '{BF330860-9693-11D1-84BF-00AA00135F7B}']], 'Navigation|Viewing', 'Activate the camera Dolly tool'],
  ['CamTrackTool', 'Track Tool', 'f6da35be-bae1-419f-afbc-1f2159af07f3', 'A', [['Clsid', '{B10A6117-AB64-4601-8795-E157BF485674}']], 'Navigation|Viewing', 'Activate the camera Track tool'],
  ['CamPivotTool', 'Pivot Tool', '0eb9ea14-bc2f-49b4-a743-75ef4b2476ec', 'A', [['Clsid', '{4AD8FA2B-1FFE-4934-A0E8-0EC2DCBA6720}']], 'Navigation|Viewing', 'Activate the camera pivot tool'],
  ['CamWalkTool', 'Walk Tool', '1bf8a181-58df-4e78-a65a-c5c52e1baa57', 'A', [['Clsid', '{0F77EFE5-07A5-40D9-9D62-F6FA0FFBEA92}']], 'Navigation|Viewing', 'Activate the camera walk tool'],
  ['CamFlyTool', 'Fly Tool', '39109d08-0bf0-4209-a216-16dbc466e946', 'A', [['Clsid', '{856B0CB2-C291-4D0A-88D6-ABA1160C240A}']], 'Navigation|Viewing', 'Activate the camera fly tool'],
  ['CamDriveTool', 'Drive Tool', '1f7426d4-4bb7-11d6-a2e8-08003658d403', 'A', [['Clsid', '{14EE0590-4BB7-11D6-A2E8-08003658D403}']], 'Navigation|Viewing', 'Activate the camera drive tool'],
  ['CamRollTool', 'Roll Tool', '9a0c5f90-6740-11d1-84ab-00aa00135f7b', 'A', [['Clsid', '{BF330861-9693-11D1-84BF-00AA00135F7B}']], 'Navigation|Viewing', 'Activate the camera Roll tool'],
  ['CamNavigTool', 'Navigation Tool', '55b52481-0a27-11d3-bfe4-00a0248f9397', 'A', [['Clsid', '{988E8C81-0A1F-11D3-BFE4-00A0248F9397}']], 'Navigation|Viewing', 'Activate the multi-purpose camera navigation tool '],
  ['Cam3dsMaxNavigTool', 'Navigation Tool', 'fe621e60-85df-4b78-a38e-9ea5e81ffe52', 'A', [['Clsid', '{A31F01DB-E282-4D0A-8A62-3D36A544DA7A}']], 'Navigation|Viewing', 'Activate the 3ds Max-style multi-purpose camera navigation tool '],
  ['Delete Components', 'Delete Components', '56aa96f5-7ae3-11d1-8036-00a0243e2717', 'S', [['Clsid', '{DAC73700-99C8-11D1-84BF-00AA00135F7B}'], ['CmdID', '{56AA96F5-7AE3-11D1-8036-00A0243E2717}']], 'Modeling', ''],
  ['ManipulateTool', 'Manipulate Tool', '57bd0990-98dc-11d1-84bf-00aa00135f7b', 'A', [['Clsid', '{36AD0600-98DC-11D1-84BF-00AA00135F7B}']], 'Manipulation', 'Activate the tool that displays 3D manipulators on selected objects'],
  ['DoNothing', 'DoNothing', '2b2ffb2d-5987-11d2-8411-00a0c961747d', 'A', [['Clsid', '{2B2FFB2E-5987-11D2-8411-00A0C961747D}']], '', 'DoNothing'],
  ['TimeSliderTool', 'Time Slider Tool', 'd84a017c-4908-4fec-ad99-33756a2676e1', 'A', [['Clsid', '{C68CF93C-FD82-4166-8B73-EEEE95EADB9C}']], 'Manipulation', 'Activate the time slider tool'],
  ['VirtualSliderTool', 'Virtual Slider Tool', '282446f8-7002-466f-b8d4-ea7d5e8a36e5', 'A', [['Clsid', '{B3E7200C-2273-4D19-8428-C206EC058D0D}']], 'Manipulation', 'Activate the virtual sliding tool'],
  ['PaintTool', 'Paint Tool', '0b553b32-8f88-11d2-85d6-00c04f8edf15', 'A', [['Clsid', '{BABE02C7-A8B6-11D1-9306-0060970A2BC8}'], ['CmdID', '{0B553B32-8F88-11D2-85D6-00C04F8EDF15}'], ['KeyboardProcess', true]], 'Paint', 'Activate the paint tool'],
  ['PaintVertexColorTool', 'Paint Vertex Color Tool', '77120620-addb-11d4-b91c-0800690c8bd0', 'A', [['Clsid', '{D9066020-ADD5-11D4-B91C-0800690C8BD0}'], ['CmdID', '{77120620-ADDB-11D4-B91C-0800690C8BD0}'], ['KeyboardProcess', true]], 'Paint', 'Activate the paint vertex color tool'],
  ['PaintTextureTool', 'Paint Texture Tool', 'ef59c982-e6d2-4182-a07d-01eb9a60d01a', 'A', [['Clsid', '{CA6011F0-AA0D-48F6-9935-E7F9A4174240}'], ['CmdID', '{EF59C982-E6D2-4182-A07D-01EB9A60D01A}'], ['KeyboardProcess', true]], 'Paint', 'Activate the paint texture tool'],
  ['ProbeMaterialTool', 'Probe Material Tool', '5a5f547a-c9fa-427b-85db-d123b1d9d46d', 'A', [['Clsid', '{8536FC0B-F58D-4BBF-92B8-9F139AA21F26}'], ['CmdID', '{5A5F547A-C9FA-427B-85DB-D123B1D9D46D}'], ['KeyboardProcess', true]], 'Rendering|Paint', 'Activate the Probe Material Tool'],
  ['PaintSelectTool', 'Paint Select Tool', '68073608-2078-11d3-864f-00c04f8edf15', 'A', [['Clsid', '{BCB4B0FF-AEAA-11D4-B804-0008C7A011A6}'], ['CmdID', '{68073608-2078-11D3-864F-00C04F8EDF15}'], ['KeyboardProcess', true]], 'Paint', 'Activate the paint selection tool'],
  ['Paint Tool', 'Paint Tool', '9d9b5d4a-8fb8-11d2-85d6-00c04f8edf15', 'A', [['Clsid', '{BABE02C7-A8B6-11D1-9306-0060970A2BC8}']], 'Paint', 'Painter status'],
  ['{CF80CBC2-984E-11D1-96E7-00A024191BAC}', 'Paint Tool', 'cf80cbc2-984e-11d1-96e7-00a024191bac', 'S', [['Clsid', '{CF80CBC3-984E-11D1-96E7-00A024191BAC}'], ['CmdID', '{CF80CBC2-984E-11D1-96E7-00A024191BAC}']], 'Paint', ''],
  ['Delete Objects Tool', 'Delete Objects Tool', '56aa96f3-7ae3-11d1-8036-00a0243e2717', 'A', [['Clsid', '{DAC73700-99C8-11D1-84BF-00AA00135F7B}']], 'Edit', 'Activate the Delete tool which allows to interactively delete picked objects'],
  ['RenderRegionTool', 'Render Region Tool', 'a281d992-5a0f-473b-843a-bae619ae0b09', 'A', [['Clsid', '{70F24601-A6F1-11D1-9C1A-00A0243F0F55}'], ['KeyboardProcess', true]], 'Rendering', 'Create a region for interactive rendering'],
  ['Add Surface Point Tool', 'Add Surface Point Tool', 'dccb8090-b82c-11d1-a900-00a024190119', 'S', [['Clsid', '{DCCB8091-B82C-11D1-A900-00A024190119}'], ['CmdID', '{DCCB8090-B82C-11D1-A900-00A024190119}']], 'Modeling', 'Add Surface Point Tool'],
  ['PickDeformerByVertexTool', 'Pick Deformer By Vertex Tool', '4d0ab010-d108-4b8d-a83c-33efb70096a5', 'A', [['Clsid', '{F0AFDDD4-BC35-4798-A944-CF35ED6C2937}']], 'Selection', 'Activate the Pick Deformer By Vertex tool'],
  ['MoveComponent Tool', 'MoveComponent Tool', 'da55a813-5f86-11d2-b11c-00a0c906811e', 'A', [['Clsid', '{DA55A810-5F86-11D2-B11C-00A0C906811E}']], 'Modeling|Deformation', 'MoveComponent Tool Active'],
  ['MovePointTool', 'Move Point Tool', 'ec9ec01e-b5c4-4335-9625-5f32f16875c6', 'A', [['Clsid', '{F500BD81-974B-11D1-84BF-00AA00135F7B}']], 'Modeling|Deformation', 'Activate the Move Point tool'],
  ['TweakTool', 'Tweak Tool', '0d41ff0c-8af4-4e18-9c1b-83277acf12ef', 'A', [['Clsid', '{9EEBC290-E6B8-437A-B3E4-84E9A4FFF3A3}']], 'Modeling|Deformation', 'Activate the Tweak components tool'],
  ['TweakNormalsTool', 'Tweak Normals Tool', '612ed5cc-9426-4459-a3c4-92a8983fdd27', 'A', [['Clsid', '{D0DDA3E5-A9BE-449F-AB49-5EDB120DE5A4}']], 'Modeling|Deformation', 'Activate the Tweak Normals tool'],
  ['WeldPointTool', 'Weld Point Tool', '45ba55db-1280-46fc-96f2-d8385916d61f', 'A', [['Clsid', '{43E49832-44FA-475E-86DF-E224CC51CA54}']], 'Modeling|Deformation', 'Activate the Weld Point tool'],
  ['CursorTransformTool', 'Cursor Transform Tool', '401c5b7b-3ca8-4675-ac2f-6383b855f747', 'A', [['Clsid', '{BAAA041A-D204-45DF-8D4F-E2C524678315}']], 'Modeling|Deformation', 'Activate the Cursor transform tool'],
  ['PropTransformTool', 'Proportional Transform Tool', 'fa9493c0-0a22-41f4-8980-6e63ad875e0b', 'A', [['Clsid', '{BB67E5D2-1B1F-4336-87C7-19B43EE1A9A1}']], 'Modeling|Deformation', 'Activate the Proportional transform tool'],
  ['2D Chain Tool', '2D Chain Tool', '4a6a5d55-c1d6-11d2-8437-00a0c961747d', 'A', [['Clsid', '{4A6A5D56-C1D6-11D2-8437-00A0C961747D}']], 'Drawing', ''],
  ['3D Chain Tool', '3D Chain Tool', '907cbba1-24dc-11d3-8454-00a0c961747d', 'A', [['Clsid', '{907CBBA2-24DC-11D3-8454-00A0C961747D}']], 'Drawing', ''],
  ['ToggleProjectionTool', 'Modify Projection', 'cb349f32-365c-11d4-b4c4-00d0b7142c4c', 'A', [['Clsid', '{0BF11154-359A-11D4-B4C4-00D0B7142C4C}']], 'Rendering', ''],
  ['Pick Session Tool', 'Pick Session Tool', 'cf80cbc1-984e-11d1-96e7-00a024191bac', 'A', [['Clsid', '{CF80CBC3-984E-11D1-96E7-00A024191BAC}']], '', ''],
  ['Move Joint Tool', 'Move Joint Tool', 'abae8f7a-a858-4fff-985d-19f1db8b5e0d', 'A', [['Clsid', '{00D8E0BD-6010-4821-9DFF-01CA4776BBD8}']], 'Drawing', ''],
];

/** Labels of this build's navigation tools (src/ui/viewExtras.ts) per camera tool class. */
const NAV_LABEL: Record<string, [busBody: string, label: string]> = {
  'bf330862-9693-11d1-84bf-00aa00135f7b': ['CamPanZoomTool', 'Pan & Zoom Tool'],
  '7cced755-7501-4bba-baa8-38a58284faea': ['CamZoomTool', 'Zoom Tool'],
  [CLS.mayaZoom]: ['CamMayaZoomTool', 'Zoom Tool'],
  '880441f1-570c-11d2-817f-00a0248f9397': ['CamRectZoomTool', 'Rectangular Zoom Tool'],
  '1ceb5700-7881-11d1-84b0-00aa00135f7b': ['CamOrbitTool', 'Orbit Tool'],
  'bf330860-9693-11d1-84bf-00aa00135f7b': ['CamDollyTool', 'Dolly Tool'],
  'b10a6117-ab64-4601-8795-e157bf485674': ['CamTrackTool', 'Track Tool'],
  '4ad8fa2b-1ffe-4934-a0e8-0ec2dcba6720': ['CamPivotTool', 'Pivot Tool'],
  '0f77efe5-07a5-40d9-9d62-f6fa0ffbea92': ['CamWalkTool', 'Walk Tool'],
  '856b0cb2-c291-4d0a-88d6-aba1160c240a': ['CamFlyTool', 'Fly Tool'],
  '14ee0590-4bb7-11d6-a2e8-08003658d403': ['CamDriveTool', 'Drive Tool'],
  'bf330861-9693-11d1-84bf-00aa00135f7b': ['CamRollTool', 'Roll Tool'],
  [CLS.navigation]: ['CamNavigTool', 'Navigation Tool'],
  [CLS.navigation3dsMax]: ['Cam3dsMaxNavigTool', 'Navigation Tool'],
};
/** Viewport tool bodies by class: the bus name whose earlier registration implements the class in this build. */
const BODY: Record<string, string> = {
  '907a713d-ed09-46cd-8960-d58345e95a02': 'DirectManipTool',
  'b3672c3b-31d5-4a34-a6d1-3b5d019d405f': 'HairScalingTool', 'aa0b2dff-4b7e-42de-ab2e-2f77f084d99b': 'HairClumpTool',
  '9f91cac4-0cff-420a-881d-2c68f99fab7c': 'HairStandOnEndTool', '481adb88-e2cf-11d5-a2dd-08003658d403': 'HairPuffRootsTool',
  '825fcd04-4e50-4938-8de1-258db92cf19e': 'HairRotateRootTool', 'b962f218-eb16-11d5-a2e0-08003658d403': 'HairRotateTipTool',
  '657cf6b6-e2cf-11d5-a2dd-08003658d403': 'HairRotateCursorTool',
  'cc06852c-3d4d-4226-b85c-c8a7b4c2c7a0': 'AddParticleTool',
  '218a3c00-a7ce-11d1-a8fe-00a024190119': 'SketchCurveTool',
  '76cff041-a941-4ee6-b011-a46005468130': 'AddPointOnCurveToolByKnotPoints', '23d2d99e-020c-4cbc-ae16-968164c1126e': 'AddPointOnCurveToolByCVs',
  '6eb05159-5482-4508-8da3-28694066c816': 'AddPointOnCurveToolByBezierKnotPoints',
  'b1f9ef80-2b54-11d4-8c23-009027bc3a0e': 'AddPolygonTool', 'ba9e4840-f301-40df-b935-4e34b2da853b': 'Slice Polygons Tool',
  '33cca460-4782-11d4-8c27-009027bc3a0e': 'AddEdgeTool', '64578190-b32e-11d4-8c47-009027bc3a0e': 'AddVertexTool',
  'dbc628e0-46b2-11d4-8c28-009027bc3a0e': 'SplitEdgeTool', '3500a6f0-67dd-11d4-8c2d-009027bc3a0e': 'SplitPolygonTool',
  '56f7ecf1-cd24-11d3-a9ba-009027bc65d7': 'DelPointOnCurveTool',
  '7cfe3e5b-d182-11d2-91ed-00a0c9612e3a': 'CVNURBSCurveTool', '24c6539b-e239-11d2-9205-00a0c9612e3a': 'NURBSCurveTool',
  'cc5c427c-0a50-411d-bda5-e03f3dcd0f25': 'BezierCurveTool', 'bf47dbf9-e2e0-11d2-9205-00a0c9612e3a': 'LinearCurveTool',
  [CLS.manipulate]: 'ManipulateTool',
  'c68cf93c-fd82-4166-8b73-eeee95eadb9c': 'TimeSliderTool', 'b3e7200c-2273-4d19-8428-c206ec058d0d': 'VirtualSliderTool',
  'babe02c7-a8b6-11d1-9306-0060970a2bc8': 'PaintTool', 'd9066020-add5-11d4-b91c-0800690c8bd0': 'PaintVertexColorTool',
  'ca6011f0-aa0d-48f6-9935-e7f9a4174240': 'PaintTextureTool', '8536fc0b-f58d-4bbf-92b8-9f139aa21f26': 'ProbeMaterialTool',
  'bcb4b0ff-aeaa-11d4-b804-0008c7a011a6': 'PaintSelectTool',
  '70f24601-a6f1-11d1-9c1a-00a0243f0f55': 'RenderRegionTool',
  'f0afddd4-bc35-4798-a944-cf35ed6c2937': 'PickDeformerByVertexTool',
  '9eebc290-e6b8-437a-b3e4-84e9a4fff3a3': 'TweakTool', 'd0dda3e5-a9be-449f-ab49-5edb120de5a4': 'TweakNormalsTool',
  '43e49832-44fa-475e-86df-e224cc51ca54': 'WeldPointTool',
  '4a6a5d56-c1d6-11d2-8437-00a0c961747d': '2D Chain Tool', '907cbba2-24dc-11d3-8454-00a0c961747d': '3D Chain Tool',
  '00d8e0bd-6010-4821-9dff-01ca4776bbd8': 'MoveJoint',
};
/** Classes with no viewport tool in this build: activation is wired, the tool itself is not. */
const NO_TOOL: Record<string, string> = {
  'dac73700-99c8-11d1-84bf-00aa00135f7b': 'Delete tool (interactively deletes picked objects / components)',
  'dccb8091-b82c-11d1-a900-00a024190119': 'Add Surface Point tool',
  'baaa041a-d204-45df-8d4f-e2c524678315': 'Cursor Transform tool',
  '0bf11154-359a-11d4-b4c4-00d0b7142c4c': 'Modify Projection tool (texture projection manipulation)',
};
const SRT_MODE: Record<string, 'select' | 'translate' | 'rotate' | 'scale'> = {
  [CLS.select]: 'select', [CLS.translate]: 'translate', [CLS.rotate]: 'rotate', [CLS.scale]: 'scale',
};

export function b16aNya(app: App, command: string, what: string) { app.logMsg('info', `${command}: not yet attested: ${what} (${NOTE})`); }
const unset = (v: any) => v === undefined || v === null || v === '';

/** Interaction.<name> preference: `app.prefValues` (SetValue path), else the Preferences page, else the SPDL default (true). */
function interactionPref(app: App, name: string): boolean {
  const bag = (app as any).prefValues ?? {};
  const key = Object.keys(bag).find(k => k.toLowerCase() === `preferences.interaction.${name}`);
  let v: any = key !== undefined ? bag[key] : undefined;
  if (v === undefined) v = (window as any).__prefSets?.get?.('C3DPrefsInteraction')?.val?.(name);
  if (v === undefined || v === null) return true; // C3DPrefsInteraction.spdl: stickytoggle / stickykeys default true
  return typeof v === 'string' ? /^(true|1|-1|yes)$/i.test(v.trim()) : !!v;
}

export function toolManagerOf(app: App): ToolManager {
  const A = app as any;
  if (A.toolManager instanceof ToolManager) return A.toolManager;
  const tm = new ToolManager({
    pref: (n) => interactionPref(app, n),
    // inferred: with no live tool the channel shows the UI's base tool (the transform mode of the MCP)
    idle: () => { const m = (window as any).__tool?.mode; return m === 'translate' ? CLS.translate : m === 'rotate' ? CLS.rotate : m === 'scale' ? CLS.scale : m === 'select' ? CLS.select : null; },
    notify: (event, args) => app.events.emit('commandstate', { event, args }),
    nya: (what) => b16aNya(app, A.toolCommand ?? 'tool manager', what),
  });
  A.toolManager = tm;
  return tm;
}

export function registerToolsB16aCommands(app: App) {
  const tm = toolManagerOf(app);
  const A = app as any;
  const vt = () => (window as any).__tool as { mode: string; setMode(m: string): void } | undefined;
  const nav = () => (window as any).__navTool as { get(): string | null; set(t: string | null): any } | undefined;
  // capture the viewport tool bodies before the command names are replaced below
  const bodies = new Map<string, CommandDef>();
  for (const n of new Set([...Object.values(BODY), ...Object.values(NAV_LABEL).map(x => x[0])])) { const d = app.commands.get(n); if (d) bodies.set(n, d); }
  const runBody = (name: string, ctx: ToolExecContext) => {
    const d = bodies.get(name); if (!d) { b16aNya(app, A.toolCommand ?? name, `the viewport tool ${name} (not registered in this build)`); return; }
    const full: Record<string, any> = {}; for (const a of d.args) full[a.name] = ctx.args?.[a.name] !== undefined ? ctx.args[a.name] : a.default;
    try { d.execute(app, full); } catch (e: any) { app.logMsg('info', `${d.label ?? name}: ${e?.message ?? e}`); } // the tool could not start: no command error (correction 11)
  };
  /** A class whose body arms an interactive viewport tool: it stays live while that tool is the app's active tool. */
  const viewportClass = (clsid: string, label: string, start: (ctx: ToolExecContext) => void): ToolClass => {
    let armed: any = null;
    return {
      clsid, label,
      on(ctx) { const before = app.activeTool; armed = null; start(ctx); if (app.activeTool && app.activeTool !== before) armed = app.activeTool; },
      off() { if (armed && app.activeTool === armed) app.setTool(null); armed = null; },
      live: () => !armed || app.activeTool === armed,
    };
  };
  // ---- the selection and SRT tools: the MCP transform mode
  for (const [c, m] of Object.entries(SRT_MODE)) {
    tm.addClass({
      clsid: c, label: m, restorable: true,
      on() { if (app.activeTool) app.setTool(null); nav()?.set(null); vt()?.setMode(m); },
      off() { if (vt()?.mode === m && m !== 'select') vt()?.setMode('select'); }, // inferred: the channel falls back to selection
      live: () => !vt() || vt()!.mode === m,
    });
  }
  // ---- camera tools: the view manager's navigation tool of the same name
  for (const [c, [body, label]] of Object.entries(NAV_LABEL)) {
    tm.addClass({
      clsid: c, label, restorable: true,
      on(ctx) { runBody(body, ctx); },
      off() { if (nav()?.get() === label) nav()!.set(null); },
      live: () => !nav() || nav()!.get() === label,
    });
  }
  // ---- viewport tools of this build
  for (const [c, body] of Object.entries(BODY)) {
    if (c === CLS.manipulate) { tm.addClass({ clsid: c, label: 'Manipulate Tool', restorable: true, on: (ctx) => runBody(body, ctx), off() { /* manipulators stay as the MCP set them */ } }); continue; }
    tm.addClass(viewportClass(c, body, (ctx) => runBody(body, ctx)));
  }
  for (const [c, what] of Object.entries(NO_TOOL)) {
    tm.addClass(viewportClass(c, what, () => b16aNya(app, A.toolCommand ?? what, `the ${what} (class ${braceGuid(c)}): no such viewport tool in this build; the class is the current tool`)));
  }
  // MoveComponent Tool: class da55a810 is not the Tweak class; the Tweak tool body stands in (correction 2 / 6)
  tm.addClass(viewportClass('da55a810-5f86-11d2-b11c-00a0c906811e', 'MoveComponent', (ctx) => {
    b16aNya(app, A.toolCommand ?? 'MoveComponent Tool', 'the MoveComponent tool class {DA55A810-5F86-11D2-B11C-00A0C906811E}; the Tweak tool body stands in (it is not recorded as the Tweak tool)');
    runBody('TweakTool', ctx);
  }));
  // Move Point tool (f500bd81): point selection + the translate manipulator
  tm.addClass({
    clsid: 'f500bd81-974b-11d1-84bf-00aa00135f7b', label: 'Move Point Tool',
    on() { app.setSelMode('point'); vt()?.setMode('translate'); app.logMsg('info', 'Move Point: select points (T) and drag with the translate tool (V)'); },
    off() { /* inferred: point selection and the transform mode stay */ },
  });
  // Proportional transform tool (bb67e5d2): proportional modelling on while it is the current tool (inferred)
  tm.addClass({
    clsid: 'bb67e5d2-1b1f-4336-87c7-19b43ee1a9a1', label: 'Proportional Transform Tool',
    on() { app.proportional.on = true; app.logMsg('info', `Proportional modelling ON (radius ${app.proportional.radius})`); app.events.emit('selection'); },
    off() { app.proportional.on = false; app.events.emit('selection'); },
  });
  // DoNothing (2b2ffb2e): the inert tool; activating it ends the current tool (correction 5)
  tm.addClass({ clsid: CLS.doNothing, label: 'DoNothing', on() { if (app.activeTool) app.setTool(null); nav()?.set(null); }, off() { /* inert */ } });
  // Pick Session tool (cf80cbc3): exempt from the tool-state refusal; current even outside a pick session (correction 7)
  tm.addClass({
    clsid: CLS.pickSession, label: 'Pick Session Tool',
    on() { if (!A.miscDsScripts?.session?.active) b16aNya(app, A.toolCommand ?? 'Pick Session Tool', 'what the pick session tool does without a running pick session (it is the current tool)'); },
    off() { /* the pick session itself ends through its own commands */ },
  });

  // ---- the commands
  const takeCtx = (args: Record<string, any>): ToolExecContext => {
    const c = A.toolExecContext; A.toolExecContext = undefined; // one invocation only (nested runs are plain calls)
    return { A: Number(c?.A) || 0, B: Number(c?.B) || 0, args };
  };
  for (const [bus, regName, guid, h, args, category, description] of B16A_COMMANDS) {
    const def: CommandDef = {
      name: bus, label: regName, category, description, undoable: false, noLog: true,
      args: args.map(([name, d]) => ({ name, default: d })),
      execute(app2, a) {
        const ctx = takeCtx(a); const prevCmd = A.toolCommand; A.toolCommand = bus;
        try {
          if (h === 'A') tm.activateTool(unset(a.Clsid) ? GUID_NULL : a.Clsid, ctx);
          else if (h === 'S') tm.commandToolSession(guid, ctx.A, a.Clsid); // CmdID: the command's own GUID, not the argument
          else {
            const hr = tm.commandState(guid, GUID_NULL, a.Property);
            if (hr === E_INVALIDARG) throw fail(bus, E_INVALIDARG, `Property must be one of SI3D_SUPRA_COMMAND_ACTIVATED, SI3D_SUPRA_COMMAND_DEACTIVATED, SI3D_STICKY_COMMAND_ACTIVATED, SI3D_STICKY_COMMAND_DEACTIVATED, SI3D_COMMAND_EXECUTED (got ${JSON.stringify(a.Property ?? null)})`);
          }
        } finally { A.toolCommand = prevCmd; }
        void app2;
        return undefined;
      },
    };
    app.register(def);
  }
  A.toolsB16a = { commands: B16A_COMMANDS.map(r => r[0]), normGuid };
}
