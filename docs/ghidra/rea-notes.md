# REA-ish registration notes (Softimage ops)

## C3DPolygonReductionOp

- SPDL: `C3DPolygonReductionOp.spdl` — Reference `{752FCB3D-43A2-434b-AA4D-CCFA626B0F05}`
- Binary CLSID: `topologyop.dll` only
- Registration: `DllRegisterServer` → `SIRegisterOperatorEx` + UTF-16 SPDL name
- Runtime pin: CreateInstance → Update → mesh-eval chain (see Project store `polyreduce-impl.md`)

## C3DBevelComponentOp

- Same DLL registration pattern in `topologyop.dll`
- Geometry: `mohelper.dll` `C3DLineSegmentBeveler::*`

## Cap Hole (mesh)

- **Not** SPDL-registered topology op — CapHoleProc → ApplyICEOp("Cap Hole") — see [capholeproc-path.md](./capholeproc-path.md)

## MCP enable

- mcp imports UITk/USER32 enable APIs; command enable bit lives in sicoresdk CommandCore flag object — [getenabled-callpath.md](./getenabled-callpath.md)
