# CMD-B17d: remaining operator-applying script commands in `operators.vbs`, registry-level only

Row: **CMD-B17d**. Status: **LOCK** for all 16 commands below.
Run: 2026-11-20, si-analyst worker, unattended, batch 17
**No XSIBATCH golden**: nothing here was executed. No script text is reproduced.

Binary: none (script commands, handler CLSID `5c0cf8b6-c81e-11d2-80c3-00a0c9ac19a9`).

| File | Bytes | sha256 (prefix) | Read | Commands |
|---|---|---|---|---|
| `Application\DSScripts\operators.vbs` | 258262 | `4d0741a9` | **no** | 16 |
| `Application\Dictionary\en\XSISCRIPTS.dict` | 22212 | `b942f52f` | whole | candidate texts (section 3) |

LOCK reason for every command: **file > 64 KB, REA raw load refused; install folder not connected.** (`6502` raw
needs the file to fit 64 KB; `arm` raw opens but no Windows provider reads it.) `cmd-b6d-operators-scripts.md`
read other procedures of the same file when the folder was connected; its shared helpers (`FApplyTopoOp`,
`FApplyGenOp`, `FApplyOp`, `FApplySelectedOp`, operation-mode handling, `SIMsgBox`) are the most likely building
blocks here *(inferred)*.

## 1. Handler table

| Command | file | procedure(s) | Status |
|---|---|---|---|
| `AlignBezierKnotsTangents` (8 entries) | operators.vbs | `AlignBezierKnotsTangentsFunc`, `AlignBezierKnotsTangentsProc` | LOCK |
| `ApplyDeformByCage` (2) | operators.vbs | `ApplyDeformByCageFunc`, `ApplyDeformByCageProc` | LOCK |
| `ApplyICETemplate` | operators.vbs | `ApplyMDTemplateProc` | LOCK |
| `ApplyKinematicOp` (3) | operators.vbs | `ApplyKinematicOpFunc`, `ApplyKinematicOpProc`, `ApplyMotionDerivatorProc` | LOCK |
| `ApplyPropVolumeOp` | operators.vbs | `ApplyPropVolumeOpProc` | LOCK |
| `ApplySliceBetweenTwoVertices` | operators.vbs | `ApplySliceBetweenTwoVerticesProc` | LOCK |
| `ApplySnapFaceOp` (2) | operators.vbs | `ApplySnapFaceOpFunc`, `ApplySnapFaceOpProc` | LOCK |
| `ApplyThickness` | operators.vbs | `ApplyThicknessProc` | LOCK |
| `CreateMeshText` (3) | operators.vbs | `TextToCurveListToMeshFunc`, `TextToCurveListToMeshProc` | LOCK |
| `ExtractFromComponents` (4) | operators.vbs | `ApplyExtractFromPartClsFunc`, `ApplyExtractFromPartClsProc` | LOCK |
| `GeneratePointCloudWithICETemplate` | operators.vbs | `GeneratePointCloudWithTemplateProc` | LOCK |
| `GeneratePointCloudWithICETerminal` | operators.vbs | `GeneratePointCloudProc` | LOCK |
| `LocalAssignFlexEnv` (2) | operators.vbs | `LocalAssignFlexibleEnvelopeFunc`, `LocalAssignFlexibleEnvelopeProc` | LOCK |
| `SelectGeneratorInputs` | operators.vbs | `SelectGeneratorInputs` | LOCK |
| `SplitEdge` (2) | operators.vbs | `ApplySplitEdgeFunc`, `ApplySplitEdgeProc` | LOCK |
| `WeldPoints` (3) | operators.vbs | `ApplyWeldPointsFunc`, `ApplyWeldPointsProc` | LOCK |

General pattern (R + `cmd-b6d`): a `…Func` entry is the scripted form (arguments typed, handlers, returns a value);
a `…Proc` entry is the key-assignable UI form (string `ConnectionSet` with f 134 = prompted in/out,
`ImmediateMode` f 390 = prompted, usually a `_validatorCmd` argument). In `cmd-b6d` the UI forms ignore the passed
`ImmediateMode` and use the `OperationMode` user preference instead, writing the mode used back into the argument;
the same is likely here *(inferred)*.

## 2. Wire contract (registry level)

### `AlignBezierKnotsTangents` (category Modeling|Topology|Deformation)
Args (R): `SubComp` (Collection, f 0x10082), `ImmediateMode` (default `:siPersistentOperation:siOperationMode`; Func
f 262, Proc f 390), `Mode` (`siCurveKnotTangentAlignment`, f 258), `Value` (return). Func default mode
`siCurveKnotAlignFwdAndBwdTangentsTogether`; the 7 Proc entries fix `Mode` to
`siCurveKnotAlignFwdAndBwdTangentsTogether`, `siCurveKnotAlignFwdTangentWithBwd`, `siCurveKnotAlignBwdTangentWithFwd`,
`siCurveKnotLinearizeBothSegments`, `siCurveKnotLinearizePrevSegment`, `siCurveKnotLinearizeNextSegment`,
`siCurveKnotLinearizeInterSegments`, `siCurveKnotMakeCorner` (8 entries in all, one being the Func).

### `ApplyDeformByCage` (category Deformation)
Func: `ConnectionSet` (handler class `5de3259d-8c83-11d2-8093-00a0c955b335`, f 0x10002), `ConstructionMode`
(ConstructionMode handler, f 0x10082), `Value` (return). Description "Set both the CageAutoAssignOp and CageDeformOp
operators on selected objects". Proc: `ConnectionSet` string f 134, `ConstructionMode`, `_validatorCmd`
(`31063294-ed44-4a12-bf0d-d741bf76e998`), `Value`. *(inferred)*: wraps `SIApplyDeformByCage ConnectionSet,
<interactive>, ConstructionMode` (contract `cmd-b12c-optasks-envelope-weights-volumes-binary.md`); `cmd-b6d` notes the
deform-by-spine helper is shared with deform by cage.

### `LocalAssignFlexEnv` (category Deformation)
Func: `SubComp` (Collection), `ConnectionSet` (handler `5de3259d-…`), `NbDeformersPerPoint` (int, 2, f 130),
`_validatorCmd` (`19080ab0-ff50-11d2-99c2-00a0243f0e60`). Proc: `ConnectionSet` string f 134, `NbDeformersPerPoint`
f 2. *(inferred)*: wraps `SILocalAssignFlexEnv SubComp, ConnectionSet, <interactive>, NbDeformersPerPoint`
(`cmd-b12c`).

### `ApplyICETemplate` (category Edit)
Args (R): `File` (`""`), `Target` (Collection), `Inputs` (`""`, f 130), `ConnectType` (`:siUnspecified:siBranchFlag`),
`Operator` (return). Description "Applies an ICE template". Same argument shape as `ApplyICEOp` / `SIApplyICEOp`
(File, Target, Input, ConnectType[, Mode], Operator) *(inferred wrapper)*.

### `GeneratePointCloudWithICETemplate`, `GeneratePointCloudWithICETerminal` (category Edit)
Args (R): `File` (`""`), `Inputs` (`""`), `ConnectType` (`siUnspecified`), `Operator` (return). Descriptions "Creates
an empty point cloud generated by the specified ICE template" / "… ICE terminal operator". *(inferred)*: create an
empty point cloud, then the template / operator is applied to it as in `ApplyICETemplate`.

### `ApplyKinematicOp` (3 entries)
Func ("Kinematic Operator", Transform|Deformation): `PresetObj` (Preset handler), `ConnectionSet` (ConnectionSet
handler), `ConnectType` (`siUnspecified`), `Value` (return). Proc "Quick Stretch" (Deformation|Operator): `PresetObj`
= `QStretch`, `ConnectionSet` / `ConnectType` untyped, `_validatorCmd` `3e36b362-43a2-11d3-ac9e-0090275802bf`,
`Value`. `ApplyMotionDerivatorProc` "Motion Derivator" (Transform): `PresetObj` = `MotionDerivator`, same validator,
no return.

### `ApplyPropVolumeOp` ("Deform by Volume", Deformation|Operator)
Args (R): `PresetObj` (`PropVolume`), `ConnectionSet` (string, f 134), `ConnectType` (vt 19, default 3),
`DisableAutoInspect` (False, f 3), `ImmediateMode` (prompted, `siPersistentOperation`), `OutputObjs` (out),
`ConstructionMode` (handler `f626406e-3747-4fe6-aa46-eeb7fb296412`), `_validatorCmd` (`3e36b362-…`), `Value`.
Related: `InspectPropVolume`, `GetConnectedPropVolume` (`cmd-b12c`).

### `ExtractFromComponents` (category Modeling; UI entries Modeling|Operator)
Func "Components Extract": `PresetObj` (Preset), `ConnectionSet` (ConnectionSet handler), `Name` (`""`),
`DeleteInputComponents` (False), `ImmediateMode` (`siPersistentOperation`), `GenOpInputsDisposal`
(`:siKeepGenOpInputs:siGeneratorInputsDisposalMode`), `OutputObjs` (out), `_validatorCmd` (`3e36b362-…`).
Proc entries (prompted `ConnectionSet`, `ImmediateMode`, `GenOpInputsDisposal`; `Value` return):

| Entry | PresetObj | Name | DeleteInputComponents |
|---|---|---|---|
| Subcurve Extract | `ExtractSubCrvOp` | `crvlist_extracted` | False |
| Polygon Extract | `ExtractPolygonsOp` | `polymsh_extracted` | False |
| Polygon Detach | `ExtractPolygonsOp` | `polymsh_detached` | True |

A generator-type operator (generator input disposal argument), so the generator apply helper of `cmd-b6d`
(`FApplyGenOp`) is the likely path *(inferred)*.

### `CreateMeshText` (category Primitive)
Func: `PresetObj` (Preset), `ImmediateMode` (`siPersistentOperation`), `Value`. Proc entries: "Create Planar Mesh
Text" `PresetObj` = `CurveListToPlanarMeshForText`, "Create Solid Mesh Text" = `CurveListToSolidMeshForText`
(`ImmediateMode` prompted).

### `ApplySnapFaceOp`
Func "Apply Snap Boundary" (no category): `ConnectionSet` (ConnectionSet, f 0x10082), `ConnectType`
(`siUnspecified`), `ImmediateMode`, `OutputObjs` (out), `Value`. Proc "Snap Boundary" (Operator): same with
`ConnectionSet` f 0x10086 (prompted).

### `SplitEdge` (Modeling|Topology)
Func: `ConnectionSet` (handler `5de3259d-…`), `Ratio` (50.0, f 34), `EdgeParallelLoop` (False, f 34), `EdgeConnect`
(True, f 34), `ImmediateMode`, `NewPointID` (int, out, 0), `Value`. Proc: `ConnectionSet` string f 134, same
parameters, `ImmediateMode` prompted, `DisableAutoInspect` (False, f 3), `Value`. Related C++ tool `SplitEdgeTool`.

### `WeldPoints` (Modeling|Topology)
Func: `ConnectionSet` (ConnectionSet, f 0x10002), `ImmediateMode`, `Value`. Proc "Weld Points": `ConnectionSet`
f 0x10086, `DisableAutoInspect` False, `ImmediateMode` (f 260, default `siPersistentOperation`), `Value`. Proc "Weld
Points to Target (No PPG)": same with `DisableAutoInspect` True and `ImmediateMode` default `""`. Related C++ tool
`WeldPointTool`.

### `ApplyThickness` (Modeling|Topology)
Arg (R): `InputObjs` (Collection, f 0x10082). Candidate texts ids 1517 `You need to select at least one PolygonMesh
object`, 1518 `Apply Thickness` *(inferred)*.

### `ApplySliceBetweenTwoVertices` (Modeling|Topology)
Args (R): `InputObjs` (Collection), `S3D_CMDARG_UPVECTOR` (string, `""`). Candidate texts (an interactive two-vertex
pick): 1519 `Select a polygon mesh`, 1520 `Command was cancelled`, 1521 `Select start vertex`, 1522 `Select end
vertex`, 1523 `You need to select two vertices on the same object`, 1524 `Select a border vertex`, 1525 `Invalid
object` *(inferred)*. Related C++ commands exist for the slice-polygons operator
(`ConnectPlaneReferenceToSlicePolygonsOp`, `SnapOffsetToPointForSlicePolygons`, …).

### `SelectGeneratorInputs` (Modeling)
Arg (R): `InputObjs` (Collection). Siblings in the same file: `DeleteGeneratorInputs`, `HideGeneratorInputs`
(script, no contract yet); C++ `GetGeneratorInputsForDisposal`. *(inferred)*: selects the input objects of the
generator operators of the given objects.

## 3. Dictionary texts (D)
`XSISCRIPTS.dict` (English) records 1517–1525 (0x5ED–0x5F5) as quoted above. Which procedure uses which id is not
attested.

## 4. Corrections for the wire agent
- `WeldPoints` has a "No PPG" entry whose `ImmediateMode` default is the empty string, not `siPersistentOperation`.
- `ExtractFromComponents` "Polygon Detach" is the same preset as "Polygon Extract" with `DeleteInputComponents` True
  and name `polymsh_detached`.

## 5. Open questions
| # | Question | Where to look |
|---|---|---|
| Q1 | Whole behaviour of all 16 commands | `operators.vbs` once the install folder is connected (or a raw loader for files > 64 KB) |
| Q2 | Operator preset names used by `SplitEdge`, `WeldPoints`, `ApplySnapFaceOp`, `AlignBezierKnotsTangents`, `ApplyThickness` | same |
