# CMD-B15d: image / model / file-cache sources and clips (`imageclip.dll`) and audio import / clips (`moaudio.dll`) (SIAddImageSourceOp, SIAddImageOp, SIAddWritableImageSource, SICreateImageClip2, SICreateDefaultImageClip, SetImageSource, SIAddModelSource, SICreateModelClip, SIAddModelClip, AddFileCacheSource, AddFileCacheSource2, SIAddImageSource, SIAddImageClip, AddAudioClip, ImportAudio)

Row: **CMD-B15d**. Status: **SPEC** (10 names), **SPEC-PARTIAL** (5 names: `SIAddImageOp`,
`SIAddWritableImageSource`, `SICreateImageClip2`, `SICreateDefaultImageClip`, `AddFileCacheSource` /
`AddFileCacheSource2` counted as one handler; see each section).
Run: 2026-11-19, si-analyst worker, unattended, batch 15 (binary first, REA + Ghidra)
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binaries (opened one at a time, both closed):
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\imageclip.dll`, image base `0x180000000`,
  sha256 `5664efdbff752a17de886baaca8250b3b23df4e10ccb2ce5abfe9c10a3d7b1b5`.
- `C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\moaudio.dll`, image base `0x180000000`,
  sha256 `a6c109f69c2cbdab038fa9084993981be9940a6b128c52f1e2e375cd1f07aec8` (exports carry C++ names:
  `C3DImportAudioTask`, `C3DAddAudioClipTask`, `C3DBaseAudioCoreTask`).

Method: Ghidra decompilation of `DllGetClassObject` (imageclip `0x180009610`, moaudio `0x18000d6b0`); `read_bytes`
of the factory vtables (slot 6 = create), task vtables (slot 5 = Do, slot 8 = UnPackArg) and worker vtables
(object +0x38, slot 9 / 10); decompilation of create, constructor, Do, UnPackArg and worker functions; GUID tables
(`0x180069d00…`, `0x18006a200…`, `0x18006aa50…`, `0x18006b360…` in imageclip, `0x18001b130…` in moaudio) decoded and
matched against `data/command_registry.json`. Every UnPackArg was checked against the registry argument names
of its command (it reads exactly those names), which confirms the vtable-to-command mapping.
All statements are behaviour read from the binary unless marked `(inferred)`.

## 1. Handler table

imageclip.dll (all factories 0x48 bytes, 7 slots):

| Command | CLSID | Factory vtable | Create (slot 6) | Constructor (size) | Do (slot 5) | Worker | UnPackArg |
|---|---|---|---|---|---|---|---|
| `SIAddImageSourceOp` | `041f67fd-53f8-43d7-95ec-69671c7925b4` | `0x180068308` | `0x180008ea0` | `0x180010330` (0xa8) | `0x180010bc0` | `0x180010590` (slot 9) | `0x180010d30` |
| `SIAddImageOp` | `327d6270-8007-4524-982c-e1775b1bbed6` | `0x180068340` | `0x180008e60` | `0x18000f770` (0xb8) | `0x1800100b0` | `0x18000fa00` (slot 9), `0x18000fdb0` (slot 10, not decoded) | `0x180010290` |
| `SIAddWritableImageSource` | `a7fdb2d1-73f0-486a-ac47-621f31517299` | `0x180068880` | `0x180008fe0` | `0x1800133d0` (0xd0, COM-object-first layout) | `0x1800140b0` | `0x180013a00` | `0x180014350` |
| `SICreateImageClip2`, `SICreateDefaultImageClip` (also `SICreateImageClip`) | `e2be2c7c-364b-11d3-b37b-00105a1e70de` | `0x180068298` | `0x180009060` | `0x180014940` (0x88) | `0x180015e60` | `0x180015010` (slot 10); slot 9 `0x180014ef0` is a single-clip wrapper | `0x180016140` |
| `SetImageSource` | `9ce3bb3a-388b-11d3-b37b-00105a1e70de` | `0x1800682d0` | `0x1800093e0` | `0x180019ed0` (0xb0) | `0x18001a7d0` (register stub, no Ghidra function) → worker slot 10 | `0x18001a2d0` (slot 10); slot 9 `0x18001a140` wraps one clip | `0x18001ab60` |
| `SIAddModelSource` | `be75f460-439c-11d4-b989-009027bc3e07` | `0x180068500` | `0x180008fa0` | `0x180012520` (0xc0) | `0x180013050` | `0x180012af0` | `0x180013330` |
| `SICreateModelClip` | `be75f461-439c-11d4-b989-009027bc3e07` | `0x180068490` | `0x1800090a0` | `0x1800163e0` (0xc8, base `0x180016350`) | `0x1800178e0` | core `0x180016730` | `0x180017d60` (shared) |
| `SIAddModelClip` | `be5455b0-45e2-11d4-b989-009027bc3e07` | `0x1800684c8` | `0x180008f60` | `0x1800162c0` (0xc8, base `0x180016350`) | `0x1800178b0` (fails, see 3) | (`0x180017830` → core `0x180016730`, unreachable from Do) | `0x180017d60` (shared) |
| `AddFileCacheSource`, `AddFileCacheSource2` | `5b3f5d9d-5c76-4c97-bd68-2e451d3b342e` | `0x180068928` | `0x180008de0` | `0x18000c200` (0x118) | `0x18000e4f0` | `0x18000cd00` | `0x18000e930` |
| `SIAddImageSource` | `0f42cf75-1de8-11d3-b37a-00105a1e70de` | `0x180068228` | `0x180008ee0` | `0x180010e40` (0xc0) | `0x1800121a0` | `0x180011460` | `0x1800124d0` |
| `SIAddImageClip` | `eef8d702-1ebe-11d3-b37a-00105a1e70de` | `0x180068260` | `0x180008e20` | `0x18000eb90` (0xf8) | `0x18000f310` | `0x18000ee50` | `0x18000f6a0` |

moaudio.dll:

| Command | CLSID | Factory ctor / vtable | Create (slot 6) | Constructor | Do | Worker (`Invoke`) | UnPackArg |
|---|---|---|---|---|---|---|---|
| `AddAudioClip` | `11b04f15-0353-11d3-b646-006094eb029c` | `0x180009130` / `0x18001a878` | `0x18000b380` (600 bytes) | `C3DAddAudioClipTask` `0x18000e370` | `0x18000ad90` (shared `BaseDo`) → `OnDo` `0x18000f610` | `0x18000eb80` | `0x18000fa20` |
| `ImportAudio` | `11b04f16-0353-11d3-b646-006094eb029c` | `0x180009190` / `0x18001a840` | `0x18000b440` (0x118) | `C3DImportAudioTask` `0x180010520` | `0x18000ad90` (shared) → `OnDo` `0x180011010` | `0x180010b70` | `0x180011510` |

## 2. Shared facts

- **Chain contents.** imageclip `DllGetClassObject` compares 28 CLSIDs inline; besides the 11 handlers above it
  serves the object classes the commands create: image clip `22c3e8f8-ccea-11d2-b35b-00105a1e70de` (iface
  `22c3e8f9-…`), image source `bb74aa1e-12c5-11d3-b37a-00105a1e70de` (iface `bb74aa1f-…`), writable image source
  `c38d4853-1911-42e2-8168-f9f758626e8f`, model source `beb79842-30cb-11d4-b982-009027bc3e07` (iface
  `b3edf760-365a-11d4-b986-009027bc3e07`), model clip `beb79843-30cb-11d4-b982-009027bc3e07`, file-cache source
  `c3911d76-93f9-4e06-802c-0fa9afc09ce8`, the image-source operator `756a0bc4-7905-48b3-8793-fa760aac3219`, an image
  op preset class `8cc08259-ade5-44a9-993c-c5306266acff`, and others (`f16da201/202-…`, `5faa89b0-…` = `Clip`,
  `509abd46-…`, `aa56dd04-…`, `61782e14-…`, `00f3ee76-…` = `CreateLibrary`, `adf52b4f-…` = `MoveToLibrary`,
  `e9e64654-…` = `SetCurrentMaterialLibrary`). moaudio serves 4 CLSIDs: `a8bf89ca-1025-11d2-…` (audio container,
  inferred), `a3068751-0482-11d3-…` (audio source, the class `ImportAudio` creates), `11b04f16` and `11b04f15`; any
  other CLSID goes to an ATL module fallback.
- **`SIAddImageSource` / `SIAddImageClip` are in `imageclip.dll`** (batch 15a found them absent from `modeltasks.dll`,
  batch 12 from `shadertasks.dll`; both are in this chain).
- **Object layout.** Task (`C3DCoreBaseTask`) at +0, `CDSCOMObject` at +0x20, worker vtable at +0x38 (Do forwards to
  worker slot 9 or 10). Exceptions: `SIAddWritableImageSource` is COM-object-first (task part at +0x18, worker at
  +0x38 of the object); the model-clip pair use a separate base (`0x180016350`, vtable `0x18006d980`) with the
  COM object at +0x98 and worker vtables at +0xb0 / +0xb8; moaudio tasks are `C3DBaseAudioCoreTask` subclasses.
- **Common steps** (used below as "the usual"): (a) *lock check*: the sources container (class
  `f16da200-13a2-11d3-b37a-00105a1e70de`) or clips container is tested with lock level 1; if locked the lock error
  is raised and nothing is created; (b) *naming*: a non-empty name is set through the namable interface
  `87de29ec`/`fed30601` slot 8; (c) *registration*: the new object is added to the scene through interface
  `86709280-71ff-11d3-b397-00105a1e70de` slot 3 (inferred: "connect to scene / container"); (d) *undo*: when the
  command runs with undo on, input strings and a soft reference (`F3DCreateObjectReference`) to the new object are
  kept; sub-tasks are recorded with `AddTask` only in that case.
- **Sub-task CLSIDs used:** `SIAddImageSource` (`0f42cf75`), `SIAddImageClip` (`eef8d702`), `SIAddImageSourceOp`
  (`041f67fd`), `SIAddImageOp` (`327d6270`), `SetImageSource` (`9ce3bb3a`), `ApplyOperator` (`46cee370`),
  `SetValue` (`c089b901`), `SIGetPrim` (`29668d60`), `AddTrack` (`67b8773c`), `AddClip` (`67b8773b`); moaudio uses
  `AddTrack` and `6d89e10a-ec1d-11d2-b353-00105a1e6ce9` (a "get / create the model's mixer container" task, not a
  registered command, inferred).
- **Return values.** Many workers return a register Ghidra could not track; where the binary does not establish a
  specific HRESULT the contract says "status of the last step" and the wire agent should return S_OK on success.

## 3. Contracts

### `SIAddImageSource`: SPEC

Args: `FileName` (string, FileName handler, in/out), `Name` (""), `Source` (out).
- UnPackArg: reads `FileName` (failure is returned) and `Name`.
- Do: worker with (FileName, Name, undo, out Source, "skip lock check" = 0).
- Behaviour, in order:
  1. Empty / null `FileName` → nothing happens.
  2. Lock check on the sources container (fails → lock error raised, no source).
  3. The file name is resolved to a full path (path object `efb641b1-75fe-11d3-b95d-00a024c78ee3`).
  4. **Reuse:** the existing image sources of the scene are walked; the first whose resolved path equals the new
     path (case-insensitive) is returned as `Source`; nothing new is created and nothing is undoable.
  5. Otherwise, if a registered file parser exists for the path, it must report the image-source class
     (`bb74aa1e`), else the command stops with no source; the new source is then initialised from that parser.
     Without a parser, a new image source (`bb74aa1e`) is created and its file name set to `FileName` (as given,
     not the resolved form).
  6. `Name` non-empty → set as the source name (otherwise the source keeps its default name, inferred: file based).
  7. Registered in the scene; `Source` = the new source; undo keeps FileName, Name and a reference.

**Wire contract:** `SIAddImageSource(FileName, Name="") → Source`; same path ⇒ same existing source (dedupe by
resolved path, case-insensitive); locked sources container ⇒ no-op with lock error.

### `SIAddImageClip`: SPEC

Args: `Source` (image source, SingleObj), `Name` (""), `Clip` (out).
- UnPackArg: null context → `0x80004003`; `Source` is required (its failure is returned); `Name`.
- Do: worker with (Source, Name, undo, out Clip, check = 1).
- Behaviour: if a source is given it must be an image source (exact S_OK on `bb74aa1f`), else nothing; the source
  is lock-checked (mask `0xffff`, raise on locked). A new image clip (`22c3e8f8`) is created and initialised. If a
  source is given, **`SIAddImageSourceOp(Clip, Source)`** runs as a sub-task (the clip gets its source operator).
  Clip name = `Name` if non-empty, else the source's name. Clip registered; `Clip` output; undo keeps Name and
  references to source and clip.

**Wire contract:** `SIAddImageClip(Source, Name="") → Clip` = new image clip named Name or the source name, wired
to the source through `SIAddImageSourceOp`.

### `SIAddImageSourceOp`: SPEC

Args (registry): `Clip`, `Source` (SingleObj each), return value `Operator`.
- UnPackArg: reads `Clip` and `Source` if present; always returns 0.
- Behaviour: `Clip` must be an image clip (else nothing). `Source`, if given, must be an image source (exact
  S_OK); if omitted, the clip's current source is used. Three connection ports are built in one group: the source,
  the clip's child component of type 1 and the clip's child component of type `0x27` (inferred: clip output and
  image-data ports). `ApplyOperator` (`46cee370`) is run with operator CLSID `756a0bc4-7905-48b3-8793-fa760aac3219`
  (the image-source operator), connection mode 3, flag 4; then `SetImageSource(Source, Clip)` runs as a sub-task.
  Both are recorded for undo. Output `Operator` = the new operator; undo keeps a reference to it.

**Wire contract:** creates one image-source operator on the clip reading the source, and sets the clip's source.

### `SIAddImageOp`: SPEC-PARTIAL

Args: `PresetObj` (Preset handler), `Clip` (SingleObj), return value `Operator`.
- UnPackArg: preset via `F3DCmdGetPreset`; `Clip`; returns 0.
- Do: preset object present → worker slot 9 (Clip, preset). No preset object: if the alternative 16-byte preset id
  stored at task +0x58/+0x60 is all zero → `0x80004005`; otherwise worker slot 10 (`0x18000fdb0`, not decoded).
- Worker slot 9: `Clip` must be an image clip (exact S_OK). If the preset's class is the image-source operator
  (`756a0bc4-…`) the call becomes `SIAddImageSourceOp(Clip, <clip's current source>)`. Otherwise `ApplyOperator`
  with the preset, one group with the clip connected twice (in and out), mode 3, flag 4. Recorded for undo;
  `Operator` = new operator.
- **Missing:** how the slot-10 path fills the preset id (never filled by this UnPackArg, so from scripting it is
  always the zero case → `0x80004005` when no preset object is supplied).

**Wire contract:** `SIAddImageOp(PresetObj, Clip) → Operator`; image-op presets are applied as in-place operators on
the clip; the image-source-op preset is routed to `SIAddImageSourceOp`; no preset ⇒ E_FAIL.

### `SIAddWritableImageSource`: SPEC-PARTIAL

Args: `FileName` ("", in/out), `Name` (""), `Width` (256), `Height` (256), `Type` (`siRenderChannelColorType`),
`UseExisting` (false), `Source` (out).
- UnPackArg: `FileName` / `Name` may be missing (`0x80020008` tolerated). `Width` and `Height` must be ≥ 1,
  `Type` must be 1…6 (mask `0x7e`), otherwise the command stops (HRESULT not established). If `FileName` is empty
  the FileName argument handler (`29fc632a-645a-11d2-a5d1-00a0c91412de`) is invoked (file browser, inferred) and,
  when it returns a string, that string is written back into `FileName`.
- Worker (`0x180013a00`): repeats the Width/Height/Type checks; lock check on the sources container. With
  `UseExisting` true, an existing source for that file is looked up first (`0x180014660`, not decoded) and returned
  if found. Otherwise: if a file parser exists for the path it must report class `c38d4853-…` and the source is
  loaded through it; without a parser a new writable image source (`c38d4853-…`) is created with parameter id 4 =
  `Type` (VT_UI4), file name = `FileName`, parameter id 8 = `Width`, id 9 = `Height` (VT_I4). Name set if non-empty;
  registered; undo keeps FileName, Name, Width, Height, Type and a reference; `Source` output.
- **Missing:** the existing-source lookup rule for `UseExisting`; the HRESULT for invalid Width/Height/Type.

### `SICreateImageClip2`, `SICreateDefaultImageClip` (and `SICreateImageClip`): SPEC-PARTIAL

One handler; UnPackArg picks a **mode** from the command definition GUID: `SICreateImageClip`
(`e2be2c7e-…`) → 0, `SICreateImageClip2` (`4d2a9d9f-…`) → 2, unregistered `381d22f4-0961-46de-b9fa-e239189ccb51` →
3, `SICreateDefaultImageClip` (`3060d96a-…`) → 4, anything else → `0x8000FFFF`. Mode 4 takes the file name from
the user preference default image (`SIGetUserPrefDefaultImage`) and no Name; other modes read `FileName` (failure
returned) and `Name`.
- Do: worker slot 10 (FileName, Name, mode, undo, out collection at +0x78).
- Behaviour:
  1. Lock check on the clips container.
  2. **Plain image file (no file parser):** run `SIAddImageSource(FileName)` (reuse rule as above). The number of
     clips is 1 in modes 0 and 4; in modes 2 and 3 it is the source's sub-image count (source vtable slot 12,
     inferred: layers / views of a multi-image file). For each sub-image *i*: name = `Name` when exactly one clip;
     with several clips the first is `<file name><ext>` (or `Name`, see open question 1) and later ones are
     `V<i>_<Name or file name>` (format `V%d_%s`); run `SIAddImageClip(source, name)`; with several clips also run
     `SetValue` on the clip's parameter (component kind `0x402`, id `0x2f`) = *i* (VT_UI4) at the current time
     (inferred: the clip's layer/view index). Each clip is appended to the output collection.
  3. **File with a registered parser** (flag `0x10`) whose class is the image source (`bb74aa1e`) or the image clip
     (`22c3e8f8`): the object is created and loaded through the parser. For a source: `SIAddImageClip(source,
     Name)`. For a clip: if it has no image-source operator, `SIAddImageSourceOp(clip)` runs; then
     `SIAddImageOp` with preset class `8cc08259-…`, and the clip's parameter `0x26` is copied into parameter
     `0x17` of that op (inferred meaning); the clip is registered. The clip is added to the output.
  4. Output: the collection of created clips. (Slot 9 wrapper returns only the first clip, `0x80004005` if none.)
- **Missing:** exact meaning of the sub-image count and of parameter `0x2f`; the naming guard (open question 1);
  how the single `Clip` out-argument of `SICreateDefaultImageClip` is filled from the collection (inferred: first
  clip).

**Wire contract:** `SICreateImageClip2(FileName, Name) → collection of clips` (one per sub-image, usually one);
`SICreateDefaultImageClip() → Clip` = same with FileName = user-preference default image, Name "".

### `SetImageSource`: SPEC

Args: `Source` (SingleObj), `InputObjs` (Collection).
- UnPackArg: null context → `0x80004003`; `Source` (failure returned) and `InputObjs` (failure returned).
- Do: stub that jumps to worker slot 10 with (Source, InputObjs, undo).
- Behaviour: `InputObjs` required. `Source` may be null (clears the source, inferred); if given it must be an
  image source (exact S_OK) else nothing. For each input object that is an image clip (others are skipped
  silently): with undo on, the clip's previous source and the clip are remembered; then the clip's source is set
  to `Source` (clip-source interface `e2a31590-3233-11d4-b982-009027bc3e07` slot 3). Undo keeps a reference to
  `Source`.

**Wire contract:** `SetImageSource(Source, InputObjs)`: set the source of every image clip in InputObjs; non-clips
ignored.

### `SIAddModelSource`: SPEC

Args: `FileName` (""), `Name` (""), `Source` (out), `Resolution` (2).
- UnPackArg: FileName (failure returned), Name, Resolution (missing → 2).
- Behaviour: if the application mode reports the restricted edition (inferred: Foundation), prints
  `Error: Creation of model source only available in Essentials and Advanced` to stdout and returns with no source.
  Otherwise creates a model source (`beb79842-…`), sets its file for the given resolution, names it `Name`, or
  `ModelSource_<file base name>` when Name is empty and FileName is not; registers it; sets its parameter id 5 to
  0 (VT_UI4); `Source` output; undo keeps FileName, Name, Resolution and a reference.

**Wire contract:** `SIAddModelSource(FileName, Name="", , Resolution=2) → Source`, default name
`ModelSource_<basename without extension>`.

### `SICreateModelClip`: SPEC

Args: `FileName` (in/out), `Name` (""), `Clip` (out). The shared UnPackArg also reads an optional `Source` (model
source) that this command's registry entry does not list; resolution is always 2 (constructor default, no
Resolution argument).
- UnPackArg: both FileName empty and no Source → `0x80070057`.
- Behaviour: creates a model clip (`beb79843-…`).
  - No source: creates a model source with FileName at resolution 2 and gives it to the clip.
  - With a source: the source's file for resolution 2 must exist, else log (severity 2) `The Model Source has an
    invalid file path for this resolution.` and `0x80070057`; if the source already has a clip for that resolution,
    log `The model source is already having a clip for this resolution.` and `0x80070057`; FileName becomes the
    source's path.
  - Names: with Name empty and a FileName → clip `ModelClip_<base>`, new source `ModelSource_<base>`; with Name
    given and no source → clip and new source both named Name; with an existing source the clip is named
    `ModelClip_<source name>`.
  - Clip parameter id `0x10` = resolution (VT_UI4); clip registered; `Clip` output; undo keeps FileName, Name and a
    reference.

**Wire contract:** `SICreateModelClip(FileName, Name="") → Clip` (+ new model source when none is given).

### `SIAddModelClip`: SPEC

Do (`0x1800178b0`) only logs, severity 2, `Obsolete command, to create a clip you have to change the model source
resolution.` and returns `0x80004005`. Nothing is created; `Clip` stays empty.

**Wire contract:** always E_FAIL with that message.

### `AddFileCacheSource`, `AddFileCacheSource2`: SPEC-PARTIAL

One handler. Args: `InputObj` (Collection), `FileName` (in/out), `DeployInMixer` (true), `SourceObject` ("",
`AddFileCacheSource2` only), `Source` (out). UnPackArg also reads an optional `Name`.
- UnPackArg: FileName failure returned. The first `InputObj` item exposing the 3D-object interface
  (`ab4dbd45-27d7-46f7-a0b4-4b59badfb01c`) or the X3DObject interface (`6b579d20-3dc5-11d0-9449-00aa006d3165`) is
  the target.
- Worker (`0x18000cd00`), observable steps:
  1. No FileName → `0x80004003`.
  2. Target resolution: given object, its owning model, or a model. With no target, the target is guessed from the
     file name using the preference template (`simulation.cachetemplatefilename`, tokens in `[...]`, `model` and
     `object` matched against `_`-separated parts of the file name, default model `Scene_Root`); failing that, an
     interactive pick session (prompt `XSIIMAGECLIP` id `0x24`) is started; running without UI → `0x80070057`;
     cancelled pick → `0x80004004`.
  3. If still no target object: `SIGetPrim` creates a `pointcloud` (preset `2194ffe3-a0b2-4cab-a3e8-fc8edc9f159a`)
     under the current scene model.
  4. Lock check on the sources container; FileName resolved to a full path; the model's mixer container is
     fetched / created (`F3DGetModelNLEContainer`), mixer-on-delta enabled for locked referenced models.
  5. A file-cache source (`c3911d76-…`) is created, its file set to the path, sub-step count loaded
     (`F3DLoadSubStepsCount`), parameter id 2 = relative name path of the target object (string), name = Name if
     given; added to the model's source list.
  6. `DeployInMixer` false → source registered and returned. True → `AddTrack` (track type
     `91ab66bc-cc1a-4be1-a039-8e1b9f846a00`) and `AddClip` at the source's start frame (parameter id 7) on the model,
     recorded for undo.
- **Missing:** the tail of step 6 (clip options, return of Source vs clip), how `SourceObject` changes target
  resolution (passed to the worker, use not traced), exact pointcloud prim arguments.

### `ImportAudio` (`moaudio.dll`): SPEC

Args: `Model` (SingleObj), `FileName`, `Name` (""), return value `AudioSource`.
- UnPackArg: `Model` required (X3DObject interface; null context `0x80004003`); FileName split into directory and
  file (`Get3xFileNameArg`; failure returned); Name.
- `Invoke` (`0x180010b70`): Model, directory, file and output must be present, else `0x80004003`. Runs the
  get-model-audio-container sub-task (`6d89e10a-…`) for Model (recorded for undo); stores the directory in the
  registry key `Nle\animmix\audio` (last audio folder); creates an audio source (`a3068751-…`) initialised with
  `<dir>\<file>`; sets its name to Name, or to the file name when Name is empty; adds it to the model's audio
  container (append, index −1); output source; undo keeps dir, file and a reference.

**Wire contract:** `ImportAudio(Model, FileName, Name="") → AudioSource` under the model's mixer audio.

### `AddAudioClip` (`moaudio.dll`): SPEC

Args: `Model`, `Source`, `Compound`, `Track` (SingleObj), `Time` (frames), `Name` (""), return value `Clip`.
- UnPackArg: Model required; `Source` required (failure returned); `Compound` and `Track` optional (action-container
  interface `fe2c4320-c53d-11d2-b34a-00105a1e6ce9`); `Time` required, converted frames → seconds; Name. When Source is
  an audio source and a Track is given (and the track check slot 7 returns 0), the insertion range is computed from
  Time and the source length minus one frame (`GetInsertedClipBounds`); if it does not fit, logs `XSIMOAUDIO` id
  `0x6f` (severity 2) and returns `0x80004005`; else Time becomes the adjusted start.
- `Invoke` (`0x18000eb80`): Model, Source, output required (`0x80004003`). Track locked → lock error,
  `0x80070005`. If Source is not an audio source, no clip is made (only time/name stored). Otherwise:
  1. a clip (class `d39d0046-ed33-11d2-b353-00105a1e6ce9`) is created; name = Name, else the source's name;
  2. the model's audio container is fetched / created (sub-task `6d89e10a-…`), clip source = Source;
  3. **sample rate:** if the source rate differs from the content property `Project Audio Sample Rate` and the
     scene property (`a8bf89cc-…`, slot 20) reports a fixed rate, logs `XSIMOAUDIO` id `0x70` (severity 2) and stops
     with no clip; otherwise the property is set to the source rate (restored on failure);
  4. no Track → `AddTrack` on Model / Compound with track type `d39d004a-ed33-11d2-b353-00105a1e6ce9` (recorded);
  5. clip start = Time; clip appended to the track (index −1); output Clip; undo keeps Model, Source, Compound,
     Track and the clip.

**Wire contract:** `AddAudioClip(Model, Source, [Compound], [Track], Time, Name="") → Clip` on a new audio track when
none is given; collides with existing clips ⇒ E_FAIL + message.

## 4. Open questions

1. `SICreateImageClip2` multi-clip naming: the first clip uses `<file><ext>` when Name is null **or longer than one
   character**, and Name only when Name is exactly one character. This reads like an inverted guard in the binary;
   confirm with a golden before copying it.
2. `SIAddImageOp` worker slot 10 (`0x18000fdb0`) and `SIAddWritableImageSource` `UseExisting` lookup
   (`0x180014660`) not decoded.
3. `AddFileCacheSource*`: tail of the deploy-in-mixer branch and the use of `SourceObject`.
4. Identity of command definition `381d22f4-0961-46de-b9fa-e239189ccb51` (mode 3 of the image-clip handler; not in
   the registry dump).
