# Run log

| Date | Agent | Row | Result | PR |
|------|-------|-----|--------|----|
| 2026-11-12 | si-analyst | CMD-01a (FBX commands, 40) | SPEC-PARTIAL. PC, install and REA/Ghidra reachable; `FBXXSI.64.dll` read. Public docs not reachable (no local docs, online fetch unavailable); no XSIBATCH golden run | #160 |
| 2026-11-12 | si-analyst | CMD-01b (script-implemented SDK helper commands, 17) | SPEC-PARTIAL. PC, install and REA/Ghidra reachable; four script plug-ins read in full, `XSISCRIPTS.dict` and `xsi_decl.h` read, `xsiutils.dll` opened for `XSIUtils.Translate`. Online SDK docs not reachable (fetch not permitted unattended); no XSIBATCH golden run. New rows PROP-SIMPLE, CMD-01-ADDONDOC, TOOL-01 | #161 |
| 2026-11-12 | si-analyst | CMD-01c (texture layer and shader blend-in commands, 27) | SPEC-PARTIAL. PC, install and REA/Ghidra reachable; `Rendering.vbs` procedures read in full, `xsi_decl.h` and five dictionaries read, `shadertasks.dll` and `shaderhelper.dll` opened for the four layer tasks. Six connection / pop-up commands specified from registry and call shape only. Online SDK docs not reachable (fetch not permitted unattended); no XSIBATCH golden run. New rows CMD-01c-CNX, GOLD-TEXLAYER | #163 |
