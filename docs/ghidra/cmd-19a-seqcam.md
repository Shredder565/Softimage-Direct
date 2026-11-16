# CMD-19a: Camera Sequencer plot commands (`SeqCam.dll`)

Row: **CMD-19a** (uncategorised in the registry; belongs with CMD-19 Camera Sequencer).
Status: **SPEC** for the command layer; two plotting helpers are described by
their inputs and outputs only (Q1, Q2).
Run: 2026-11-16, `si-analyst`, unattended.

| Command | Implemented in | Handler (image address) |
|---------|----------------|-------------------------|
| `PlotSequencerCamera` | `Application\Plugins\SeqCam.dll` | `PlotSequencerCamera_Execute` `0x180009ae0` |
| `PlotCamSeqForCachedObjects` | same | `PlotCamSeqForCachedObjects_Execute` `0x180008f10` |
| `ApplyCamSeqFileCacheSources` | same | `ApplyCamSeqFileCacheSources_Execute` `0x180008880` |

## How it was attested

| Mark | Source | What it gave |
|------|--------|--------------|
| (R) | `data/commands_full.json` | names, arguments, defaults, return flag, descriptions |
| (B) | REA + Ghidra 12.1.4 on `SeqCam.dll` (sha256 `12e72b90f40c1d2d…`, file version 13.2.163.0), the three `_Execute` exports | the contract below |
| (T) | string table of the same DLL | names of registered items, parameter names, format strings |
| - | XSIBATCH goldens, SDK reference | not used |

No decompiler output or disassembly is reproduced here.

## Shared facts

### What the plug-in registers (T)

Plug-in `SequencerCameraOp Plugin`, author `Autodesk`: two custom operators
`XSISequencerCameraKineOp` and `XSISequencerCameraPrimOp` (they drive the
transform and the primitive of the sequencer camera; ports `TargetKine`,
`TargetPrim`, `Source`; parameter `alwaysevaluate`), three events
`XSISeqCamNewScene`, `XSISeqCamOpenScene`, `XSISeqCamStartup`, and the three
commands. The sequencer camera is addressed in the four viewports as
`Views.ViewA.SequencerCamera.camera` … `Views.ViewD.SequencerCamera.camera`.
The operators and events are not part of this row (new row OP-SEQCAM).

Camera primitive parameters the plug-in handles by name (T): `near`, `far`,
`proj`, `orthoheight`, `projplane`, `projplanedist`, `projplanewidth`,
`projplaneheight`, `projplaneoffx`, `projplaneoffy`, `interestdist`,
`aspect`, `pixelratio`, plus `fov` family names shared with the camera
primitive.

All three commands are enabled, key-assignable and uncategorised (R).

### Status codes

| Value | Meaning here |
|-------|--------------|
| `0` | OK |
| `1` | OK, nothing to do |
| `0x80004004` | aborted |
| `0x80070057` | invalid argument |
| `0x8000ffff` | unexpected (list lengths differ) |

"Sequencer time" below is the timeline of the Camera Sequencer: the frames
`SequenceIn`..`SequenceOut` as cut together from camera clips, each of which
shows some source-frame range of some camera.

## Wire contract

### `PlotSequencerCamera`

Bakes the camera sequencer's cut into one new camera.

| # | Argument | Type | Default |
|---|----------|------|---------|
| 0 | `SequenceIn` | integer | 1 |
| 1 | `SequenceOut` | integer | 100 |
| 2 | `ActionName` | string | `SequencerCamera_Plot_Action` |
| 3 | `CameraName` | string | `SequencerCamera_Plot` |
| 4 | `PlotWithoutGaps` | bool | false |
| 5 | `ApplyToCamera` | bool | true |

Returns an object list: the new camera, and when `ApplyToCamera` is false
also the new clip.

1. Validate: `SequenceOut` must be greater than `SequenceIn`, and both names
   must be non-empty. Otherwise `0x80070057`.
2. Create the target camera with `GetPrimCameraWithoutInterest`, passing
   `CameraName` as the name; the created camera comes back through that
   command's last (output) argument. From here on the camera is addressed by
   its full name. If no camera results, stop and return that command's status.
3. Plot the sequencer camera over `SequenceIn`..`SequenceOut` into a new
   action source named `ActionName`; `PlotWithoutGaps` selects whether gaps
   between sequencer clips are skipped so the result is continuous. The plot
   also yields a set of camera parameter values that do not need curves.
   If the plot produces nothing (it clears the action name to say so), a
   notice is shown and the command ends with `0x80004004`.
4. Write each of the constant parameter values from step 3 onto the new
   camera.
5. `ApplyToCamera` true: run `ApplyAction` with the new source on the new
   camera (remaining arguments: false, 0, 0, false), then dispose of the
   temporary source (*inferred*: the plug-in holds `DeleteObj`). The camera is
   left with plain function curves.
   `ApplyToCamera` false: run `AddTrack` on the scene root (track type 0,
   track name = `ActionName`), then `AddClip` on the scene root with the new
   source on that track, starting at frame `SequenceIn`, clip name =
   `ActionName`. The camera is then driven through the mixer.
6. Return the list; the command status is the status of the last command run.

### `PlotCamSeqForCachedObjects`

Writes point caches for every object that has a file cache clip, resampled in
sequencer time (description: "Plot objects with file cache clips in sequencer
time").

| # | Argument | Type | Default |
|---|----------|------|---------|
| 0 | `Path` | string | none |
| 1 | `SequenceIn` | integer | 1 |
| 2 | `SequenceOut` | integer | 100 |
| 3 | `PlotWithoutGaps` | bool | false |
| 4 | `Attributes` | string | none |
| 5 | `UseGlobalKine` | bool | true |

Returns an array of three values: the objects (as one text list), the cache
file path pattern that was written, and the list of the file cache clips that
were found.

1. Validate: `SequenceOut` greater than `SequenceIn`; `Path` non-empty;
   `Path` must contain the frame placeholder `_#`. Otherwise `0x80070057`.
2. Ask the active scene for all cache clips and the objects they drive
   (`Scene.GetAllCacheClipsAndObjects`). No objects: status `1`, nothing
   written, no return value.
3. Build the list of source frames to sample for the sequencer range, one
   entry per output frame, in the "with gaps" or "without gaps" variant per
   `PlotWithoutGaps`. An empty list logs message 463 of `XSIMSGCAT` and ends
   with `0x80004004`.
4. Run `CacheObjectsIntoFile_Private` with 13 arguments: the objects; `5`;
   `SequenceIn`; `-1`; `1`; true; true; `Attributes`; the text `CamSeq_Plot`;
   `Path`; `UseGlobalKine`; `1`; the frame list from step 3. A failure is
   returned as the command status.
5. In the path that command reports, replace the single-frame suffix
   `_<SequenceIn>` by the range suffix `_[<SequenceIn>..<SequenceIn + count − 1>]`
   (`count` = number of frames written), and return the three values.

The fixed arguments of step 4 are those of `CacheObjectsIntoFile` in the same
positions (cache type 5, start frame, end "−1" meaning "driven by the frame
list", step 1, …); see that command's row when it is specified (Q3).

### `ApplyCamSeqFileCacheSources`

Swaps the old file cache clips for the caches written by the command above
(description: "Delete previous file cache clips and apply plotted file caches
to objects").

| # | Argument | Type | Default |
|---|----------|------|---------|
| 0 | `ObjectsToApply` | string, comma-separated object names | none |
| 1 | `CacheFilePaths` | string, comma-separated file paths | none |
| 2 | `ClipsToDelete` | object list | none |

The registry flags a return value but the command sets none.

1. Split both strings on `,`. If either list is empty: `0x80070057`.
   If the two lists differ in length: `0x8000ffff`.
2. Delete the clips in `ClipsToDelete`. A failure here is returned and
   nothing else is done.
3. For each index in order run `AddFileCacheSource <object>, <path>`. Stop at
   the first failure and return its status.

The three arguments match, in order, the three values returned by
`PlotCamSeqForCachedObjects`, except that the caller has to supply one path
per object.

### Enable conditions

None in the registry. `PlotSequencerCamera` step 3 may show a notice, so it
is interactive in the failure case only.

## Open questions

| # | Question | How to close |
|---|----------|--------------|
| Q1 | The plot of `PlotSequencerCamera` (`0x180006770`): which parameters get curves, which are returned as constants, fcurve type, and the exact rule of "without gaps" | read that function and the two frame-list builders `0x180005420` (with gaps) / `0x1800059c0` (without gaps) |
| Q2 | The notice shown when the plot is empty (`0x180006300`, called with 2, 2) and the text of `XSIMSGCAT` 463 | read the helper; dictionary `Application\Dictionary\en\XSIMSGCAT.dict` |
| Q3 | Names of the 13 arguments of `CacheObjectsIntoFile_Private` | `DSScripts\simulation.vbs` (`CacheObjectsIntoFile` is a TODO script command there) |
| Q4 | How the clip deletion helper (`0x180004d50`) deletes: `DeleteObj` per clip or once for the list; what the cleanup after `ApplyAction` (`0x180004e40`) does | read both |
| Q5 | Output-argument position of `GetPrimCameraWithoutInterest` and its other arguments | `DSScripts\primitives.vbs` (in this run's script batch) |
| Q6 | No golden | XSIBATCH: two cameras, two sequencer clips, run `PlotSequencerCamera` both ways and dump the result |
