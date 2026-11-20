# Wire questions, CMD-B15b (propertytasks.dll)

Open points where the note's contract is silent; the wire code logs "not yet attested" or uses the marked stand-in.

1. `SIAddCustomParam`: "bit 4 is always added" to Capabilities. Is that the value 4 (siPersistable, wired) or 0x10? What is the `ValidateNameSyntax` correction rule (wired: non-alphanumeric to `_`, leading digit prefixed)? Which HRESULT does the min <= max / sugg-min <= sugg-max validation (0x180014f30) raise (wired: 0x80070057)?
2. `SICreateMaterial(DD)`: use of `Initialize` (stored at +0x120). With no preset, is the material really shader-less (wired: yes, the previous inferred Phong default is gone)?
3. `SetClusterPropertyValues`: meaning of `Mode` values other than absolute and of `ClampValues` (merge rule of 0x18001c240). Wired: absolute only, the rest logged. Are `Offsets` positions in the ascending cluster element list (wired) or raw element indices?
4. User normals: gather / bleed expansion rules; the scene setting behind 0x180019140 (wired: `app.propertyTasksB15b.freezeAfterUserNormals`, default off); vertex-normal and polygon-normal formulas; sample numbering (wired: polygon-corner order). Return value of the "empty gather" path (status 1 only).
5. Overrides: entry-parameter naming; the capability attribute `5e373ed1` meaning for "connection entry"; what `PresetObj` / `Name` / `Path` of `SIAddShaderEntryToOverride` do; the HRESULT / message when `SIGetOriginalValueOfOverridden` target is not overridden (wired: 0x80004005); which objects an override on a pass / partition applies to.
6. `siCreateRetargetMapping`: which computed transform goes to which slot (7 = P2M_, 9 = S/R/T), identity of the model category and the mapping property, whether the first item is also processed as an item.
7. `siWriteRetargetComponentData`: the "excluded character" stripped from the string; behaviour on a malformed record; whether several records can be in one string.
