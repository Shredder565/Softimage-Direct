# Run log

| Date | Agent | Row | Result | PR |
|------|-------|-----|--------|----|
| 2026-11-12 | si-analyst | CMD-01a (FBX commands, 40) | SPEC-PARTIAL. PC, install and REA/Ghidra reachable; `FBXXSI.64.dll` read. Public docs not reachable (no local docs, online fetch unavailable); no XSIBATCH golden run | #160 |
| 2026-11-12 | si-analyst | CMD-01b (script-implemented SDK helper commands, 17) | SPEC-PARTIAL. PC, install and REA/Ghidra reachable; four script plug-ins read in full, `XSISCRIPTS.dict` and `xsi_decl.h` read, `xsiutils.dll` opened for `XSIUtils.Translate`. Online SDK docs not reachable (fetch not permitted unattended); no XSIBATCH golden run. New rows PROP-SIMPLE, CMD-01-ADDONDOC, TOOL-01 | #161 |
| 2026-11-12 | afterimage-wire | PROP-SIMPLE (`CustomColor`, `TextProp` properties + Get > Property anchor items) | WIRE-PARTIAL. Properties, one-control layouts, help topics, anchor items and their behaviour (message 1174 / add to first selected + inspect) implemented from the spec tables; `compare_simple_properties.mjs` OK. No XSIBATCH golden; menu draw position, new-property name, message box caption and colour widget sent back to the analyst (ledger row). Checks green before are still green; `compare_hair_module`, `compare_render_fidelity`, `walk_model_menu`, `walk_animate_menu` were already failing on main and are unchanged | PRNUM |
