# CMD-B11i: B10 confirmations read from `transformmanager.dll` (TranslateUVW, RotateUVW, ScaleUVW; MoveComponent and TranslatePivot not implemented here)

Row: **CMD-B11i** (confirmation of row CMD-B10, answers to `b10_questions.md` Q7 and Q12).
Status: **SPEC-PARTIAL** (3 names: `TranslateUVW`, `RotateUVW`, `ScaleUVW`; argument decoding read in full, the per-sample apply step could not be read); `MoveComponent` and `TranslatePivot`: **not implemented in this DLL** (no contract here).
Run: 2026-11-18, si-analyst worker, unattended, batch 11 (binary first, REA + Ghidra 12.1.4 on the PC)
No XSIBATCH golden: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\transformmanager.dll`, image base `0x180000000`, sha256 `6dc8dfd4b664cb2e4a557b089d7dd0366dc294d7d870e26b43e58e388c8d9166` (PDB `TransformManager.pdb`, not loaded).
Method: byte search for the CLSIDs, Ghidra decompilation of `DllGetClassObject`, three class-factory create slots, two constructors, the shared Do, the shared argument reader, the three per-command UnPackArg methods and the shared "begin transform" method; vtables read as raw bytes. The Ghidra session closed (request cancelled after a timeout) while the large per-element apply function `0x18002be30` was being analysed, so that function was not read. All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

`DllGetClassObject` (`0x180056340`) is a chain of 18 inline CLSID compares (two 8-byte compares each); each match allocates a 0x48-byte class factory and returns it through QueryInterface. Unknown CLSID -> `0x80040111` (CLASS_E_CLASSNOTAVAILABLE). Factory vtables are 7 slots; slot 6 allocates and constructs the task.

The three UVW tasks share one base class (constructor `0x18004a130`, which is also the task class of the sibling CLSID `b2f1ad2f-83bd-11d2-91cf-00a0c9612e3a`, which has no registry command). The object is a multiple-inheritance transform task: primary vtable at `+0x0`, a second interface at `+0x20`, and the transform-manager interface at `+0x38` (vtable `0x18006be10`, shared). Task vtable slot 5 Do, 6 Undo, 7 Redo, 8 UnPackArg, 9 RePackArg (imported thunk).

| Command | Handler CLSID (bytes in `.rdata`) | Factory vtable -> create (slot 6) -> constructor | Task vtable | Do / Undo / Redo | UnPackArg |
|---|---|---|---|---|---|
| `TranslateUVW` | `b2f1ad2e-83bd-11d2-91cf-00a0c9612e3a` (`0x18006c588`) | `0x18006df80` -> `0x1800561d0` (0x5b0 bytes) -> `0x180053d30` | `0x18006bd50` | shared `0x1800503c0` / `0x180050c90` / `0x180050440` | `0x180053e40` |
| `RotateUVW` | `b2f1ad2d-…` (`0x18006c578`) | `0x18006dfb8` -> `0x180056050` (0x5b0 bytes) -> `0x1800234b0` | `0x180067ca0` | same shared Do / Undo / Redo | `0x180023610` |
| `ScaleUVW` | `b2f1ad2c-…` (`0x18006c568`) | `0x18006dff0` -> (slot 6 not read) | (not read) | same shared Do / Undo / Redo (inferred) | `0x1800239f0` (bound by behaviour: state code 1, defaults 1.0, X/Y/Z gated by the axes bits; inferred binding) |
| (base, no command) | `b2f1ad2f-…` (`0x18006c558`) | `0x18006dea0` -> `0x180056190` (0x5a8 bytes) -> `0x18004a130` | - | - | - |
| `MoveComponent` | `da55a811-5f86-11d2-b11c-00a0c906811e` (`0x18006c2a8`) | **none**: not in `DllGetClassObject` | - | - | - |
| `TranslatePivot` | `8eee27b3-a9e4-4987-a355-92f0665be870` | **none**: not in `DllGetClassObject`; registry lists only `tasks.dll`, `viewinteraction.dll` | - | - | - |

Shared argument reader (called first by every UnPackArg): `0x180052d00`. Do calls the transform-manager interface slot 10 (`0x18004e310`, body at `0x18004cf60`, the "begin transform" method), then releases the input list. The per-element apply step is `0x18002be30` (not read; see Open questions). The 3D component-transform worker `0x180029750` (with the `TransformProperties.collapsepoints` preference) is shared with the object/component transform tools.

## 2. Shared facts

### 2.1 Shared argument reader (`0x180052d00`), UV mode

- `RefMode` (not a UVW argument; absent -> 6).
- `TextureProjection` is resolved to an object. When it resolves, the task is in **UV mode** (flag set to 1 and passed to the transform manager):
  - `Pivot` false (default): `SplitLocalComponents` is read (only `TranslateUVW` declares it; absent = false). Reference mode becomes 6 when `SplitLocalComponents` is true and `0x16` (6 plus bit `0x10`) when it is false.
  - `Pivot` true: `PivotU`, `PivotV`, `PivotW` are read (errors propagate) and become the translation of the reference (pivot) frame; reference mode becomes 3. (`TranslateUVW` declares no `Pivot`, so it never uses an explicit pivot.)
- When `TextureProjection` does not resolve, the same reader takes the object path (`Pivot` -> `PivotX/Y/Z`).
- `Delta` is read **as a boolean** (absent -> 0). With the registry default `siRelative` it is non-zero; `siAbsolute` reads as 0.
- `Center` boolean (not declared by the UVW commands; absent -> 0).
- `AxesFilter` is read as an integer; **absent -> 7**.
- `InputObjs` resolved to a list (failure aborts with that HRESULT). `PropTagOnly`, `SlideComponents`, `ConstructionMode` are also read (not declared by the UVW commands).

### 2.2 Begin transform (`0x18004cf60`)

On first use it reads two scene-defaults objects (GUIDs `389e27dd-5fb0-11d2-b11c-00a0c906811e` and `3aa9962e-7a18-4355-9a29-dabf736fb02b`) and caches one value from each. It builds a list of the input objects and, in UV mode, a second list for the texture projection, then records one per-element transform state per input element (via `0x180050100`). Results are kept on the task so Undo / Redo can restore them (shared Undo `0x180050c90`, Redo `0x180050440`).

### 2.3 Enum values established

- `siDeltaMode`: `siAbsolute` = 0, `siRelative` = 1 (read as a boolean; `siRelative` 1 also in `cmd-12a`).
- `siUVWAxesFilter`: bit field, `siU` = 1, `siV` = 2, `siW` = 4; therefore `siUV` = 3, `siUW` = 5, `siVW` = 6, `siUVW` = 7 (bits read in `ScaleUVW`'s reader; 7 is the absent default; the names of the combined values are inferred from the bit layout).

## 3. Contracts

### `TranslateUVW`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs` (components / objects), `TextureProjection` (UV property), `X`, `Y`, `Z` (doubles, default 0), `Delta` (siDeltaMode, default `siRelative` 1), `AxesFilter` (siUVWAxesFilter, default `siUVW` 7), `SplitLocalComponents` (bool, default false).
- Errors: null exec context -> `0x80004003`; failure reading `X`, `Y` or `Z` returns that HRESULT.
- `X`, `Y`, `Z` are the U, V, W offsets; they become the translation of the transform. If all three are 0 the transform keeps its "identity" mark (no change, inferred).
- No explicit pivot (`Pivot` not declared); reference mode 6 / `0x16` from `SplitLocalComponents` (2.1).
- `SplitLocalComponents` true: reference mode without bit `0x10` (inferred: the moved samples are split from neighbouring samples that share the same vertex instead of dragging them along).
- Optional undeclared arguments `Snap`, `SnapFilter`, `SnapReference` are read (only the interactive tool passes them; absent = no snapping). `Delta` is used there: relative -> increment snapping, absolute -> snap to a target.
- AxesFilter is not applied in the reader (stored for the apply step; inferred: unselected axes keep their value).
- Absolute semantics: not read (apply step not reached). (inferred) `siAbsolute` places the selection at the given UVW rather than offsetting it.
- Do: begin transform (2.2) then the shared apply; Undo / Redo restore / reapply.

### `RotateUVW`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs`, `TextureProjection`, `X`, `Y`, `Z` (doubles, default 0, **degrees**), `Delta`, `AxesFilter`, `Pivot` (bool, false), `PivotU/V/W` (0), `AspectRatio` (double, 1.0).
- Errors as `TranslateUVW`; failure reading `AspectRatio` (when the projection resolved) returns that HRESULT.
- The three angles are converted to radians (×π/180) and set as one Euler rotation, rotation order 0 (XYZ, inferred from the order value). `X` = rotation about U, `Y` = about V, `Z` = about W. **The in-plane UV rotation is `Z`.** `X` / `Y` are real out-of-plane rotations of the UVW coordinates (they change W and tilt U/V); they are not ignored.
- If the transform already holds an earlier rotation (state bit 0), that rotation is factorized before the new one is stored (inferred: repeated calls compose).
- `AspectRatio` is read **only when `TextureProjection` resolves**; otherwise the stored ratio is 1.0. It is consumed in the apply step (not read). (inferred) Rotation happens in aspect-corrected space (U scaled by the image aspect before rotating, back after), so a rotation looks rigid on a non-square image.
- `Pivot` true -> rotate about (`PivotU`, `PivotV`, `PivotW`); false -> about the default reference of mode 6 / `0x16` (inferred: the centre of the selected samples).
- AxesFilter not applied in the reader.

### `ScaleUVW`: SPEC-PARTIAL

Wire contract:
- Args: `InputObjs`, `TextureProjection`, `X`, `Y`, `Z` (doubles, default 1), `Delta`, `AxesFilter`, `Pivot`, `PivotU/V/W`.
- Errors as `TranslateUVW`.
- Each of `X`, `Y`, `Z` is read **only if its `AxesFilter` bit is set** (U=1, V=2, W=4); a filtered-out axis keeps scale 1.0 regardless of the value passed.
- A factor with magnitude below 1e-12 is replaced by ±1e-12 (sign kept, 0 -> +1e-12), so scale 0 flattens without producing a singular transform.
- An existing transform is factorized first (state bit 0, as Rotate).
- Pivot: as `RotateUVW`.

### `MoveComponent`: not implemented in this DLL

The CLSID bytes exist at `0x18006c2a8` with one reference from `0x180051f05` (inside the task method area next to task vtable slot 10 `0x180051bc0`; a consumer, inferred: the transform tasks use it to find or invoke the Move Component operator / command when moving components), but `DllGetClassObject` has no compare for it. `tasks.dll` (b11d) also does not implement it. The remaining DLLs carrying the bytes are `imageclipeditor.dll` and `viewinteraction.dll`; the implementor is most likely `viewinteraction.dll` (inferred, the transform-tool host). Q12 is not answered by this binary.

### `TranslatePivot`: not implemented in this DLL

Its CLSID is not among the 18 in `DllGetClassObject` and the registry does not list this DLL. Not read.

## Open questions

- The per-element apply function `0x18002be30` (uses the aspect ratio at transform-block offset `+0x470`) was not read: exact `siAbsolute` behaviour for all three commands, how `AxesFilter` restricts translate and rotate, and the direction of the aspect correction remain inferred.
- Edge addressing: the UV path does not convert components in the reader (the component-conversion branch is only for reference mode 2). Edges are passed to the begin transform as components of the input list (inferred: their endpoint samples move). Not confirmed.
- `MoveComponent`: read `viewinteraction.dll` (and if absent, `imageclipeditor.dll`) `DllGetClassObject`.
