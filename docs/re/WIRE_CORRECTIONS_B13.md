# Wire corrections from analyst batch 13 (2026-11-19)

Read from the binaries with REA + Ghidra; no XSIBATCH golden. Details and evidence are in the notes named per item.

## Answers to wire PR #185 that change existing wiring

1. **`UpdateConnectOnOp` mode is a bit mask** (cmd-b12d addendum): `0x1` connect, `0x2` disconnect the existing input, so `3` = replace. A port with a new input is disconnected, then connected. A null input keeps its connection unless `ForceDisconnect` is set and the port is optional (inferred). Disconnected object sources are deleted through a Delete Objects child task with flag `0x10`. Connect commands that add port-group instances also run a `CycleChecking` child task.
2. **`MoveOperator` class GUIDs were mis-decoded in B12d.** Marker class (logs `0x407`): `{dba00978-85be-4d94-aec5-422ecb4ee4bd}` (Post Simulation / Secondary Shape marker). Silent refusal: `{4ed3b713-1abd-11d4-b83a-009027bc6587}` (`C3DSCMFixerOp2`). Both tests run only for an explicit MoveAction `2`; MoveAction `0` skips them.
3. **`TransferICETree`** (cmd-b12b addendum): Mode `0` = move; Mode `1` = copy (operator duplicated with Low Level Duplicate, original stays, duplicate goes to the target). Refusals are silent no-ops: locked target, target resolving to `Scene_Root`, or target kind code not 2 or 8; kind 8 forces Branch on. In Mode 1 the returned `Value` is the **original** operator, not the copy.
4. **`RemovePortFromICENode`**: on a compound's exposed port it runs the `RemoveExposedParamFromICECompoundNode` task as a child; on a non-removable port (inferred: output port) it logs `0x417` and returns `0x80004005`; connected ports of the instance are disconnected first (Disconnect Node Port child tasks).
5. **`RemoveAttributeFromSetDataICENode`**: unknown attribute name logs warning XSIOPTASKS `0x415` (severity 2), changes nothing, succeeds.
6. **`GetICECompoundPortProperties`** OutputArgs: 8-element array in this order: Name, Min, Max, Picking, Description, ExposeType (I4), Enum, PPGLayoutGroup. Enum text is `first,second;` per item.
7. **`EditExposedParamInICECompoundNode`**: only an empty Name means "unchanged"; every other field is applied when it differs (an empty string is a value). When the run is not undoable every field counts as changed. ExposeType is an opaque integer passed through.
8. **`HideAllPortValues`**: hides every port the node marks value-displayable (connectedness not tested), recursing into compounds. A node in a referenced model logs `0x425` and returns `0x80070005`. Undo shows all listed ports, including ones hidden before.
9. **`GetGeneratorInputsForDisposal`**: `1` = delete, `2` = hide; anything else (including 0) → `E_INVALIDARG`. The B12e contract stands; fix `operatorsScripts.ts` numbering to match.

## Catalogue mismatches found in the new plug-in batch (CMD-B13a–e)

- Return values: `RemoveAllMotorPropsAndOps`, `FindUltimapperDistance`, `GenerateUltimapper`, `DXExport`, `BoneCreateTool_UpdateBone`, `Applypolymatricks` do not enable a return value although `data/commands_full.json` says they do; `CrowdFBXPlot_ExportEnd` / `CrowdFBXPlot_ExportMode` do enable one although the catalogue says not. All `Bvr*` commands return nothing and report errors only through message boxes.
- `DXExport` feeds `DX_OptionsExportHiddenObjects` into the property's `chains` parameter and `DX_OptionsChains` into `ExportHidden` (swapped in the binary), and looks up `Triangulate` although the parameter is `triangulate`. Reproduce as read, or flag; do not silently fix.
- `RemoveMOTOROperators` deletes an operator named `RetargetOperator`, while the registered operator is `RetargetOp`.
- `fr_ApplyShapeWeightOp` never reads its `Method` argument; `LoadMotorFile` never uses `start`.
- `BvrAddFloor` shows its "root node" error but continues.
