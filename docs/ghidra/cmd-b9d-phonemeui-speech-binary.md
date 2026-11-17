# CMD-B9d: Face Robot speech / lip-sync commands read from `phonemeui.dll` (phoneme extraction, speech clip queries, playback range, 20 `SpeechOp*` editing commands)

Row: **CMD-B9d**. Status: **SPEC** (24 names), **SPEC-PARTIAL** (2 names); per command below.
Run: 2026-11-17, `si-analyst`, unattended, batch 9 (binary first, REA + Ghidra 12.1.4 on the PC plus local static reads of the same DLL with pefile / capstone).
**No XSIBATCH golden**: nothing here was executed. No decompiler output or disassembly is reproduced.

Binary: `Application\bin\phonemeui.dll`, image base `0x180000000`, sha256 `7f6f2729a296d1b9d084941c94cc90a1c71ad0f34a5cd0f0af67870fcc50a74f` (PDB name `PhonemeUI.pdb`, not available).
Method: `DllGetClassObject` (`0x180003dd0`) compares the requested CLSID inline against six
constants; each match builds a class factory whose slot 6 allocates and constructs the task.
Task methods and workers were decompiled in Ghidra (35 functions); vtables, thunks, GUID
constants, string and phoneme tables, and one function Ghidra could not decompile
(`0x180004fa0`) were read locally. All statements are behaviour read from the binary unless
marked `(inferred)`.

## 1. Handler table

| Command(s) | Handler CLSID | Creation function (ctor) | Task vtable | Do / worker | UnPackArg | RePackArg / Undo |
|---|---|---|---|---|---|---|
| `ExtractPhonemesToSpeechOp`, `ExtractPhonemesToSpeechOpJapanese`, `SIExtractPhonemes` | `508c8c1f-4f64-4dee-8a10-45e99d0f7516` | `0x180003b10` (ctor `0x18001d000`, 0xb0 bytes) | `0x180031a20` | Do `0x18001d290` -> guided recogniser `0x180004fa0` / unguided `0x180005530`; result array builder `0x18001d6a0` | `0x18001d840` | RePack `0x18001d5f0`; Undo / Redo `0x18001d580` (no-op, S_OK) |
| `PlaybackTimeRange` | `9ec070f3-b757-4d9d-bfd1-5ca2613c0c70` | `0x180003ad0` (ctor `0x18001c9a0`, 0x70 bytes) | `0x180031130` | Do `0x18001cb20` | `0x18001ceb0` | RePack imported base; Undo / Redo `0x18000e9b0` (E_NOTIMPL) |
| `SpeechOpDeleteWords`, `SpeechOpDeletePhonemes` | `78f069c0-5621-417f-9382-a6dcd9bf7557` | `0x180003b50` (ctor `0x18001e500`, 0xe8 bytes) | `0x180031cb0` | Do `0x18001e8c0` -> word remover `0x180004eb0` / phoneme remover `0x18001e740` | `0x18001eac0` | Undo `0x18001ea20`; Redo `0x180020e30` (= Do, not first run) |
| `SpeechOpInsertWord` | `2a14054a-510b-433f-b555-208f5b9e158f` | `0x180003bd0` (ctor `0x18001fba0`, 0xf0 bytes) | `0x180032680` | Do `0x180020370` -> `0x18001fdc0` | `0x180020590` | Undo `0x1800204a0`; Redo `0x180020e30` |
| 17 commands: `SpeechOpMoveWords`, `SpeechOpMovePhoneme`, `SpeechOpScaleWordStart`, `SpeechOpScaleWordEnd`, `SpeechOpScalePhonStart`, `SpeechOpScalePhonEnd`, `SpeechOpSplitPhonemes`, `SpeechOpSetPhonemesIPAValue`, `...Weight`, `...FalloffIn`, `...FalloffOut`, `...ShapeWeight`, `...ShapeFalloffIn`, `...ShapeFalloffOut`, `...BlendIn`, `...BlendOut`, `...Variation` | `1bdb1e5f-546a-4902-8d12-a0c049779d69` | `0x180003c10` (ctor `0x1800208f0`, 0x110 bytes) | `0x180032860` | Do `0x180020b30` -> move words `0x180006290`, move phoneme `0x180005fc0`, scale word `0x180006e30`, scale phoneme `0x180006920`, range rescale `0x180006be0`, split `0x1800210f0`, IPA `0x180020fe0`, numeric fields `0x180020e70`, variation `0x180021050` | `0x180021400` | Undo `0x18001ea20`; Redo `0x180020e30` |
| `GetPhonemesFromSpeechClip`, `GetPhonemeBlendFromSpeechClip` | `3335b7b3-8a64-436a-aad1-dd60969dac56` | `0x180003b90` (ctor `0x18001ee30`, 0xb0 bytes) | `0x1800324f0` | Do `0x18001f040` -> phoneme table `0x18001f4c0` / blend table `0x18001f290` | `0x18001f7d0` | RePack `0x18001f1a0`; Undo `0x18001d580` (no-op) |

Class-factory vtables (slot 6 = create): `0x1800287e8`, `0x180028820`, `0x180028858`,
`0x180028890`, `0x1800288c8`, `0x180028900` in the row order above. The CLSID constants
compared in `DllGetClassObject` are at `0x18002b8b0`, `0x18002b8c0`, `0x18002b8d0`,
`0x18002b900`, `0x18002b920`, `0x18002ba70`.

All six tasks derive from the imported `sitaskcore.dll!C3DCoreBaseTask` (not the iterator
task). Slot 5 = Do, 6 = Undo, 7 = Redo, 8 = UnPackArg, 9 = RePackArg, 11 / 12 = resolve
reference for undo / redo, 13 = release working data.

## 2. Shared facts

### 2.1 Where the speech data lives

- The commands do not own the data. They obtain a **speech data interface**, IID
  `bffe85f4-f600-45de-8c87-148b44f5c527`, from the `InputObj` argument and edit the data
  block it exposes in place. The interface is implemented outside `phonemeui.dll` (the
  speech operator / speech clip source; not read). Methods used: slot 3 returns a pointer to
  the data block; slot 4 is called after every edit and after undo ("data changed"
  notification, takes no arguments) `(inferred from call placement)`.
- `InputObj` is fetched with `sicommands.dll!F3DGetArgPtrValueFromName2(ctx, L"InputObj", 872903d0-3ef3-11d0-8463-00a024c7919c, ...)`.
  - Editing commands (Delete*, InsertWord, the 17-command class): the object is asked
    directly for IID `bffe85f4-...` through its interface-by-IID method (vtable offset
    `0x158`). So `InputObj` must be the object that carries the speech data (the speech
    operator); failure of either step is returned as the command's error.
  - Extract-to-SpeechOp and the two Get commands accept a **clip or a source**: first the
    object is asked for the clip interface `2320122c-d1b9-11d2-b34b-00105a1e6ce9`; if that
    works the clip is asked (slot 4) for its source `12a3ef98-e543-11d2-b352-00105a1e6ce9`;
    otherwise the object itself is asked for the source interface. If the source reports a
    non-zero count (slot 7), its item 0 is asked (slot 5) for IID `bffe85f4-...`.
- The command GUID is read from the exec context (interface
  `26444edd-799f-11d2-8733-00a0c906816c`, slot 15, index 0) and compared with constants to
  pick the mode inside a shared handler class.

### 2.2 Speech data model (layout read from the copy, insert, split and table-building code)

Data block:

| Offset | Field |
|---|---|
| `+0x00` / `+0x08` | word array pointer / word count (int) |
| `+0x18` / `+0x20` | phoneme array pointer / phoneme count (int) |
| `+0x30` | language flag (int): 0 = US English phoneme names, 1 = Japanese |
| `+0x38` | double, set to 1.0 by the extraction task (use not read) |
| `+0x40` | time offset in seconds added to every recognised time (from `FrameOffset`) |

Word record, 0x30 bytes, array ordered by time:

| Offset | Field |
|---|---|
| `+0x00` | start time, seconds (double) |
| `+0x08` | end time, seconds (double) |
| `+0x10` | name (`CSIString`) |
| `+0x20` | int taken from the recogniser's per-word result (meaning not read); 0 for inserted words |
| `+0x24` | int, always written 0 |
| `+0x28` | "selected" flag (int 0 / 1), used only by `SpeechOpMoveWords` |

Phoneme record, 0x78 bytes, array ordered by time and grouped by word:

| Offset | Field | Default on creation | Set by |
|---|---|---|---|
| `+0x00` | start time, seconds | | move / scale / split |
| `+0x08` | end time, seconds | | move / scale / split |
| `+0x10` | int from the recogniser's per-phoneme result (meaning not read) | 0 | |
| `+0x14` | IPA value (int) | | `SpeechOpSetPhonemesIPAValue` |
| `+0x18` | index of the owning word (int) | | insert / delete |
| `+0x20` | weight | 1.0 | `...Weight` |
| `+0x28` | falloff in | 0.0 | `...FalloffIn` |
| `+0x30` | falloff out | 0.0 | `...FalloffOut` |
| `+0x38` | shape weight | 1.0 | `...ShapeWeight` |
| `+0x40` | shape falloff in | 0.0 | `...ShapeFalloffIn` |
| `+0x48` | shape falloff out | 0.0 | `...ShapeFalloffOut` |
| `+0x50` | blend in | 1.0 | `...BlendIn` |
| `+0x58` | blend out | 1.0 | `...BlendOut` |
| `+0x60` | variation (`CSIString`) | empty | `...Variation` |
| `+0x70` | selected flag (int) | 0 | (UI only) |
| `+0x74` | byte flag (meaning not read) | 0 | |

Units and invariants:

- All times are **seconds** (doubles). The recogniser returns integer times in units of
  10 ms; each is multiplied by 0.01 and the block's time offset is added. `Delta`,
  `StartTime`, `EndTime` arguments are stored and applied raw, so they are seconds too.
- A phoneme belongs to exactly one word (`+0x18`); the phonemes of a word are contiguous in
  the array; word indices are renumbered when a word is inserted or deleted.
- **Minimum phoneme length 0.02 s** is the constant behind every clamp; a word may not
  become shorter than `0.02 * (number of its phonemes)`.
- Words do not overlap: without `Ripple` a word edge may not pass the neighbouring word's
  edge; with `Ripple` everything later in time is shifted instead.
- The lower bound for the first word / phoneme is the smallest positive double
  (`2.2250738585072014e-308`), i.e. effectively time 0; the upper bound for the last one is
  the largest double (no limit).
- A move / scale with `|Delta| <= 0.02` is ignored (the data is left untouched).

### 2.3 IPA value and phoneme names

The IPA value is a Unicode code point, or two code points packed as `(second << 16) | first`
for diphthongs. Value 0 is silence and is named `~`. Name lookup (`0x1800066a0`): search the
table of the block's language; the Japanese table falls back to the English table; an
unknown value is formatted as `0x%x`.

English table (`0x18003e020`; value, name, example word):
`0xe6 a pat`, `0x251 ah ah`, `0x65 ay say`, `0x62 b boy`, `0x6b c call`, `0x2a7 ch child`,
`0x64 d dig`, `0x25b e egg`, `0x69 ee see`, `0x25d er her`, `0x66 f flower`, `0x261 g give`,
`0x68 h house`, `0x26a i it`, `0x26a0061 I "I am"`, `0x2a4 j join`, `0x6c l let`,
`0x6d m main`, `0x6e n name`, `0x14b ng sing`, `0x6f oh oh`, `0x28a oo book`, `0x75 ou you`,
`0x28a0061 ow how`, `0x26a0254 oy boy`, `0x70 p pen`, `0x72 r rise`, `0x73 s small`,
`0x283 sh shall`, `0x74 t team`, `0xf0 th the`, `0x3b8 tH think`, `0x27e tt butter`,
`0x28c u but`, `0x76 v very`, `0x77 w win`, `0x6a y yes`, `0x7a z zoo`.

Japanese table (`0x18003e3d0`):
`0x251 a aka`, `0x62 b bin`, `0x2a7 ch chich`, `0x64 d daidaiiro`, `0x7a ts tsuzuki`,
`0x2a4 j jikan`, `0x25b e eki`, `0x278 f fuji`, `0x261 g gakko`, `0x68 h haha`,
`0x69 i ika`, `0x6b k kami`, `0x6d m mae`, `0x6e n natsu`, `0x6f o oto`, `0x70 p pan`,
`0x27e r raka`, `0x73 s saka`, `0x283 sh shiai`, `0x74 t tabi`, `0x75 u ushi`,
`0x77 w wata`, `0x6a y yuka`.

### 2.4 `Index` argument (Delete* and the 17-command class)

- Read from argument position 1. A non-array value is converted to a 32-bit integer and
  becomes a one-element list. An array has each element converted to integer, the list is
  then sorted `(inferred: ascending; sort helper 0x18001e220 not opened)` and adjacent
  duplicates are removed in a single pass (a value repeated three or more times can leave
  one duplicate behind).
- Conversion failure returns the conversion HRESULT.
- The 17-command class rejects an empty list with `0x80070057`; the Delete class does not.
- Indices outside `0 .. count-1` are silently skipped everywhere.

### 2.5 Undo model of the editing classes

- On the first Do the task stores a soft reference to the speech object
  (`mohelper.dll!F3DCreateObjectReference`) and takes a **full snapshot** of the data
  (all word records, all phoneme records, language flag).
- Undo copies the snapshot back over the live data (resizing both arrays) and sends the
  data-changed notification. Redo re-runs Do without retaking the snapshot.
- Before undo / redo the soft reference is resolved again
  (`mohelper.dll!F3DResolveObjectReference` with IID `bffe85f4-...`); release-working-data
  drops the interface pointer.
- The move / scale workers first restore the live data from the snapshot and then apply the
  delta, so a redo (or a repeated Do) is not cumulative.

### 2.6 Recogniser (Fonix) set-up shared by the three extraction commands

- Engine: imported `FonixCore42.dll`. Shared data path = install path (type 3) +
  `\Application\Fonix\fre\fd01\USEnglish\asr\`, or `...\japanese\asr\` when the dictionary
  name starts with `J` / `j`. Then the neural net file and the ASR dictionary file are set;
  a failure of either logs `Could not find file %s` (severity 2) and processing continues.
- Audio: opened with `dssdk10.dll!DSOpenMediaFile`, converted to one mono 16-bit stream
  `(inferred from the error strings)`; the sample rate must be exactly **16000 Hz**,
  otherwise `Problem with audio file %s, has %d samples, a sample rate of %d` is logged and
  the worker returns `0x80004005`. Other log strings: `Error opening audio file %s`,
  `Error getting stream for audio file %s`, `Out of memory for audio file %s`,
  `Error splitting stereo channels for audio file %s`,
  `bad number of channels %d for audio file %s`, `Error converting audio samples for %s`,
  `Obscure error in wave format for %s`.

## 3. Contracts

### `ExtractPhonemesToSpeechOp` / `ExtractPhonemesToSpeechOpJapanese`: SPEC

- Purpose: run speech recognition on an audio file and **replace** the word and phoneme
  lists of a speech clip / speech operator with the result.
- Arguments (by position): 0 `InputObj` (clip, source or speech object, see 2.1);
  1 `FileName` (string); 2 `GuideText` (string, default empty); 3 `FrameOffset` (double,
  frames, default 0; converted with `SIFramesToSeconds`); 4 `SilenceDuration` (integer,
  default 10); 5 `NeuralNet` (string, default `usgp16FN3108`, Japanese variant
  `jagp16FN5031`); 6 `ASRDict` (string, default `USEnglish.pdc`, Japanese variant
  `Japanese.pdc`). The two commands share all code; only the registry defaults differ.
- Type checks: `FileName`, `GuideText`, `NeuralNet`, `ASRDict` must arrive as strings,
  `FrameOffset` as double, `SilenceDuration` as VT_INT; anything else returns `0x80070057`.
  No speech data interface on `InputObj` returns `0x80020003`.
- Steps:
  1. `GuideText` empty: unguided recognition (`FnxCoreGeneratePhonemes`). The result is one
     word with an empty name whose start / end are taken from the **last** phoneme's start /
     end entries, plus all phonemes assigned to word 0. No phonemes returns an error.
  2. `GuideText` not empty: the text is split on any of `: ; , . tab newline return \ / + - { } [ ] < > ! @ # $ % ^ & * ( )` and space,
     the tokens are joined with single spaces after the prefix `$grammar=`, the grammar is
     logged (severity 8) and used to create a grammar node. Node settings: raw audio input;
     maximum record = `samples / 16000 + 0.9` seconds truncated to integer; leading silence
     10000; trailing silence `SilenceDuration * 1000`; rejection disabled. The node is run
     and all phonetic results are fetched. Engine status `-1036` logs
     `Error scanning phonemes -- this error is often to due to having longer text than the sound file has. Truncate input text as necessary`
     and fails with `0x80004005`; zero words also fails with `0x80004005`.
     Each recognised word becomes a word record (name, start, end) and each of its phonemes
     a phoneme record with the defaults of 2.2.
  3. In both paths a phoneme's end is replaced by the next phoneme's start when the gap
     between them is exactly one recogniser tick (10 ms); not applied to the last phoneme
     of a word.
  4. Times = tick * 0.01 + `FrameOffset` in seconds.
  5. Shape falloff presets by IPA value: `b f m p v` (0x62, 0x66, 0x6d, 0x70, 0x76) get
     shape falloff in = shape falloff out = **+0.5**; `oh r ou w er sh oo j ch oy ow`
     (0x6f, 0x72, 0x75, 0x77, 0x25d, 0x283, 0x28a, 0x2a4, 0x2a7, 0x26a0254, 0x28a0061) get
     **-0.5**; all others stay 0.
  6. The speech object's phoneme array and word array are overwritten with the result and
     its language flag is set to 1 when `ASRDict` starts with `J` / `j`, else 0.
- Any recogniser failure raises the error (severity 2)
  `Error Scanning Phonemes -- Check history log for more information` and the data is left
  unchanged.
- Returns nothing. **Not undoable inside the task** (Undo and Redo are empty and return
  success); the data-changed notification of 2.1 is not sent by this command.

### `SIExtractPhonemes`: SPEC

- Same handler class, selected by command GUID `6caa1189-4eb1-4d07-8b42-b2703594479f`.
  Purpose: run the recogniser and return the phonemes as an array without touching any
  scene object.
- Arguments: 0 `Language` (string), 1 `FileName` (string), 2 `GuideText` (string),
  3 `Result` (output). Each input must arrive as a string or the command fails with
  `0x80070057`.
- `Language` equal to `jp` (case-insensitive) selects `jagp16FN5031` + `Japanese.pdc`;
  any other value selects `usgp16FN3108` + `USEnglish.pdc`. Frame offset is 0 and silence
  duration is the task default 10.
- Recognition is identical to steps 1 to 4 above (guided when `GuideText` is not empty).
- `Result` (written to argument position 3 in RePackArg): a two-dimensional variant array
  `[phoneme count][4]`, columns: 0 IPA value (integer), 1 start seconds (double), 2 end
  seconds (double), 3 phoneme name (string, language table of 2.3). With zero phonemes the
  array pointer is null.
- Errors as for the SpeechOp flavour.

### `GetPhonemesFromSpeechClip`: SPEC

- Arguments: 0 `InputObj` (clip, source or speech object), 1 `Result` (output).
- Reads the speech data and writes to argument position 1 a two-dimensional variant array
  `[phoneme count][13]`, one row per phoneme in array order. Columns: 0 IPA value (integer),
  1 start (seconds), 2 end (seconds), 3 phoneme name (string; language table chosen by the
  data's language flag), 4 weight, 5 falloff in, 6 falloff out, 7 shape weight, 8 shape
  falloff in, 9 shape falloff out, 10 blend in, 11 blend out (all doubles), 12 variation
  (string).
- Zero phonemes: the array pointer is null. Missing data block: Do returns `0x80004005`.
- Read only; no undo.

### `GetPhonemeBlendFromSpeechClip`: SPEC-PARTIAL

- Arguments: 0 `InputObj`, 1 `Channel` (integer, default 0; used only when it arrives as a
  32-bit integer), 2 `Time` (time argument handler `e9bae81a-9d13-11d3-8107-00a0c9ac19a9`;
  a double is converted to seconds through the current time object), 3 `Result` (output).
- The speech object is asked for the evaluation interface
  `915d0a04-daa0-40ce-9817-ff62cb5249b2`, whose slot 4 is called with (time in seconds,
  channel) and fills a list of entries {IPA value, weight (double), string}.
- `Result` (argument position 3): a two-dimensional variant array `[entry count][4]`,
  columns: 0 IPA value (integer), 1 phoneme name (always looked up in the English-first
  order with language flag 0), 2 weight (double), 3 the entry's string.
- **Missing**: the evaluation itself (which phonemes are active at a time, how weight,
  falloff and blend combine, what the channel selects and what the fourth column string
  is) lives in the speech operator, outside this DLL, and was not read. Behaviour when
  `Time` does not arrive as a double was not established.

### `PlaybackTimeRange`: SPEC-PARTIAL

- Arguments: 0 `StartFrame`, 1 `EndFrame`; both must arrive as doubles, otherwise
  `0x80070057`.
- Steps:
  1. Obtain the playback controller with `DSQueryGenericObject(3e57caba-2b4c-438b-89aa-eee5fe5bbf38, 975f8f60-6a21-11cf-af66-524153480001)`;
     if absent return `0x8000FFFF`.
  2. Save the current time, one integer playback setting (read through slot 33, then forced
     to 0 through slot 32) and two time spans (slots 23 and 21).
  3. Build a time span in the current time format from `StartFrame` to `EndFrame + 1` and
     set it as both spans (slots 20 and 22).
  4. Register the task as a playback listener (slot 15) if not yet registered, start
     playback (slot 4 with argument 1) and run a nested message loop until the listener is
     told playback stopped (the listener posts a private registered window message).
  5. Unregister the listener (slot 17), restore both spans, the saved integer setting and
     the saved current time.
- Blocks until playback of the range ends. Returns nothing. Undo / Redo return
  `0x80004001`.
- **Missing**: the playback controller is an external object; the meaning of the two spans
  (play range versus loop range `(inferred)`) and of the integer setting (loop mode
  `(inferred)`) was not confirmed by reading its implementation.

### `SpeechOpDeleteWords`: SPEC

- Arguments: 0 `InputObj` (speech object), 1 `Index` (word index or array, see 2.4).
- For the i-th entry of the sorted list (i from 0) the word `Index[i] - i` is removed, so
  the indices refer to the numbering before the command. Removing a word deletes its
  record, deletes every phoneme owned by it and decrements the word index of all phonemes
  of later words. Times of the remaining words are not changed.
- Snapshot / undo / notification as 2.5. Returns nothing; always succeeds once `InputObj`
  resolved.

### `SpeechOpDeletePhonemes`: SPEC

- Same class, selected by command GUID `d01e5c99-9531-403f-9a4d-fd739733e1d9`.
  Arguments as above with phoneme indices; phoneme `Index[i] - i` is processed.
- For each phoneme:
  - if it is the only phoneme of its word, the whole word is deleted (as DeleteWords);
  - if it is the first phoneme of its word, the word's start becomes the next phoneme's
    start (skipped when that value equals the word's end);
  - if it is the last, the word's end becomes the previous phoneme's end (skipped when
    that value equals the word's start);
  - otherwise the next phoneme's start is pulled back to the previous phoneme's end, so no
    gap is left;
  - then the phoneme record is removed.
- Snapshot / undo / notification as 2.5.

### `SpeechOpInsertWord`: SPEC

- Arguments: 0 `InputObj`, 1 `Name` (string), 2 `StartTime` (seconds), 3 `EndTime`
  (seconds), 4 `IPA` (integer), 5 `Ripple` (boolean). Conversion failures return the
  conversion HRESULT.
- Steps:
  1. Start and end are swapped if given in the wrong order.
  2. Insertion index k = number of leading words whose start is before the new start.
  3. If the word before the insertion point (k-1) has index greater than 0 and ends after
     the new start, its end is cut to the new start; among its phonemes, one that straddles
     the new start has its end cut to it, and from the first phoneme that starts after the
     new start onwards the rest of that word's phonemes are deleted. (As read, this
     trimming is not applied when the preceding word is word 0.)
  4. Without `Ripple`: if word k starts within 0.02 s of the new start it is deleted with
     its phonemes; then, if the word now at k starts before the new end, the new end is
     cut to that start.
  5. Phonemes of words at or after k get their word index incremented.
  6. A word record {start, end, `Name`} is inserted at k and one phoneme {start, end,
     IPA value = `IPA`, word = k, defaults of 2.2} is inserted before the first phoneme of
     the following words.
  7. With `Ripple`: every later word and every later phoneme is shifted by `end - start`.
- Snapshot / undo / notification as 2.5. Returns nothing.

### `SpeechOpMoveWords`: SPEC

- Arguments: 0 `InputObj`, 1 `Index`, 2 `Delta` (seconds), 3 `Ripple`.
- **Which words move (as read, flagged for a golden test):** Do clears every word and
  phoneme selected flag and then sets the flag on word *position i* for each in-range
  `Index[i]` (the position in the list, not the index value). The move worker then restores
  the live data from the snapshot, which also restores the word selected flags as they were
  before the command. The words that actually move are therefore the ones whose selected
  flag was already set in the speech data (speech editor selection); the `Index` values
  only need to be a non-empty list.
- Clamping of `Delta`, evaluated on runs of consecutive selected words:
  - negative: the first word of a run may not start before the end of the word preceding
    it (or time 0);
  - positive without `Ripple`: the last word of a run may not end after the start of the
    word following it (no limit for the last word);
  - positive with `Ripple`: no clamp.
- Apply: each selected word's start and end become snapshot value + delta and its phonemes
  shift by delta. With `Ripple`, at the first selected word every later word and every
  later phoneme is shifted by the same delta and the command ends.
- `|Delta| <= 0.02` does nothing. Undo as 2.5.

### `SpeechOpMovePhoneme`: SPEC

- Arguments: 0 `InputObj`, 1 `Index` (one phoneme index; only the first list entry is
  used), 2 `Delta`, 3 `Ripple`.
- Let first / last be the first and last phoneme of the same word.
- Clamp, positive delta: if the phoneme is the last of its word, with `Ripple` there is no
  limit, otherwise its end may not pass the start of the next phoneme (no limit at the end
  of the list); if it is not the last of its word, its end may not pass the next phoneme's
  end minus 0.02.
- Clamp, negative delta: if it is the first of its word, its start may not pass the
  previous phoneme's end (time 0 for phoneme 0); otherwise its start may not pass the
  previous phoneme's start plus 0.02.
- Apply: the phoneme's start and end shift by delta; the previous phoneme of the same word
  has its end shifted and the next phoneme of the same word its start shifted (neighbours
  stay attached). If the phoneme is the first of its word the word's start follows it; if
  the last, the word's end follows it, and with `Ripple` all later words and phonemes are
  shifted by delta.
- `|Delta| <= 0.02` or an out-of-range index does nothing.

### `SpeechOpScaleWordStart` / `SpeechOpScaleWordEnd`: SPEC

- Arguments: 0 `InputObj`, 1 `Index` (word index, first entry used), 2 `Delta`, 3 `Ripple`.
  n = number of phonemes of the word.
- Start: positive delta is limited so that start <= end - 0.02 n; negative delta so that
  start >= previous word's end (time 0 for word 0). `Ripple` has no effect.
- End: negative delta is limited so that end >= start + 0.02 n; positive delta without
  `Ripple` so that end <= next word's start (no limit for the last word); with `Ripple`
  unlimited.
- After moving the edge, the word's phonemes are rescaled linearly from their old overall
  span (first start to last end, at least 0.02) onto the word's new [start, end] (new span
  at least 0.02).
- End with `Ripple`: every phoneme of later words and every later word is shifted by the
  applied delta.
- `|Delta| <= 0.02` or an out-of-range index does nothing.

### `SpeechOpScalePhonStart` / `SpeechOpScalePhonEnd`: SPEC

- Arguments: 0 `InputObj`, 1 `Index` (phoneme index, first entry used), 2 `Delta`,
  3 `Ripple`.
- If the phoneme is the first of its word (Start) or the last of its word (End), the
  command behaves exactly as `SpeechOpScaleWordStart` / `SpeechOpScaleWordEnd` on the
  owning word, including `Ripple`.
- Otherwise (`Ripple` unused), with last = last phoneme of the word:
  - Start: new start = start + delta, limited above by word end - 0.02 * (last - index + 1)
    and below by previous phoneme's start + 0.02. If the previous phoneme's end was within
    0.02 of the old start it is moved by the same amount. The phonemes from this one to the
    last of the word are then rescaled linearly onto [new start, old end of the last
    phoneme].
  - End: new end = end + delta, limited above by word end - 0.02 * (last - index) and
    below by own start + 0.02. The phonemes after it up to the last of the word are
    rescaled linearly onto [next phoneme's start + applied change, old end of the last
    phoneme].
- `|Delta| <= 0.02` or an out-of-range index does nothing.

### `SpeechOpSplitPhonemes`: SPEC

- Arguments: 0 `InputObj`, 1 `Index` (phoneme indices).
- Indices refer to the numbering before the command (each later index is offset by the
  number of splits already done). A phoneme is split only when `start + end > 0.08`
  (as read: the sum, not the duration). The split point is `(start + end) / 2`: a copy of
  the record (all fields, same word) is inserted right after it, the original ends at the
  split point and the copy starts there.
- Undo as 2.5.

### `SpeechOpSetPhonemesIPAValue`: SPEC

- Arguments: 0 `InputObj`, 1 `Index`, 2 `IPA` (integer). Sets the IPA value of every
  listed in-range phoneme. No validation against the tables of 2.3. Undo as 2.5.

### `SpeechOpSetPhonemesWeight` / `SpeechOpSetPhonemesShapeWeight` / `SpeechOpSetPhonemesBlendIn` / `SpeechOpSetPhonemesBlendOut`: SPEC

- Arguments: 0 `InputObj`, 1 `Index`, 2 value (`Weight`, `Weight`, `Scale`, `Scale`).
- The value is clamped below at 0 (negative becomes 0, no upper limit) and written to the
  weight, shape weight, blend in or blend out field of every listed in-range phoneme.
  Undo as 2.5.

### `SpeechOpSetPhonemesFalloffIn` / `SpeechOpSetPhonemesFalloffOut` / `SpeechOpSetPhonemesShapeFalloffIn` / `SpeechOpSetPhonemesShapeFalloffOut`: SPEC

- Arguments: 0 `InputObj`, 1 `Index`, 2 `Falloff`.
- The value is clamped to [-1, 1] and written to the falloff in, falloff out, shape
  falloff in or shape falloff out field of every listed in-range phoneme. Undo as 2.5.

### `SpeechOpSetPhonemesVariation`: SPEC

- Arguments: 0 `InputObj`, 1 `Index`, 2 `Variation` (converted to string; registry default
  `"0"`). Writes the string to the variation field of every listed in-range phoneme.
  Undo as 2.5.

Mode numbers stored by the 17-command UnPackArg (command GUID -> mode): MoveWords 0,
MovePhoneme 1, ScaleWordStart 2, ScaleWordEnd 3, ScalePhonStart 4, ScalePhonEnd 5,
SplitPhonemes 6, IPAValue 7, Weight 8, FalloffIn 9, FalloffOut 10, ShapeWeight 11,
ShapeFalloffIn 12, ShapeFalloffOut 13, Variation 14, BlendIn 15, BlendOut 16. An
unresolvable `InputObj` returns the resolver's HRESULT; a null data block makes Do return
`0x80004005`. Do otherwise returns success even when nothing changed.

## Open questions

1. `SpeechOpMoveWords`: confirm on a live build that `Index` is ignored in favour of the
   stored word selection flags (2.5 restore order) and where those flags are set (speech
   editor view code in this DLL, not read).
2. Speech operator side: implementer of `bffe85f4-...` and of the evaluation interface
   `915d0a04-...` (blend computation, channel meaning, fourth column of the blend result).
3. Meaning of the word int at `+0x20`, the phoneme int at `+0x10` and byte at `+0x74`
   (recogniser outputs / UI state).
4. Unguided extraction: the single word takes its start from the last phoneme's start
   entry (as read); whether the engine's start array makes that the utterance start was not
   checked.
5. `PlaybackTimeRange`: identity of the two spans and the integer setting on the playback
   controller.
6. `InsertWord` step 3 skips trimming when the preceding word is word 0 (as read); golden
   needed.
7. Sort direction of the index list helper `0x18001e220`.

## New ledger rows

- Speech operator / speech clip source implementing `bffe85f4-f600-45de-8c87-148b44f5c527`
  (data block of 2.2) and `915d0a04-daa0-40ce-9817-ff62cb5249b2` (blend evaluation).
- Speech editor view in `phonemeui.dll` (class deriving from `CSIBaseViewImpl`, registered
  with `SIRegisterView`): selection flags, drag interaction that issues the `SpeechOp*`
  commands, playback through `PlaybackTimeRange`.
- `FonixCore42.dll` recogniser dependency and the `Application\Fonix\fre\fd01\{USEnglish,japanese}\asr` data
  (neural nets `usgp16FN3108`, `jagp16FN5031`; dictionaries `USEnglish.pdc`, `Japanese.pdc`).
- Playback controller generic object `3e57caba-2b4c-438b-89aa-eee5fe5bbf38`.
- Reference to `FR.dll` / `fr_GetFaceModelInternal` (string in this DLL, caller not read).
