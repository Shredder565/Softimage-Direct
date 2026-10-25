# Softimage full-tab interaction audit

**Host:** softimage-pc  
**Build:** Softimage 2015 SP2 (`13.2.163.0`)  
**When:** Sun, 25 Oct 2026 22:54:41 UTC  
**Policy:** Dump-attested only (HWND/pixel/PE + ExecuteCommand empty `[]`). No invented Softimage behavior.  
**Script:** `docs/dump-factory/si_full_tab_interaction_harvest.js` + `Run-Full-Tab-Interaction-Harvest.ps1`  
**JSON:** `internal/softimage-pc-dumps/full-tab-audit/` (+ `docs/dump-factory/` copies)  
**Screenshots:** `media/softimage-tab-audit/`  
**Harvest source:** `C:/Users/neil/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/files/internal/softimage-pc-dumps/full-tab-audit/full_tab_harvest.json`  

## Exit tour (coverage)

| Metric | Value |
|--------|------:|
| Options probed (ExecuteCommand / find) | 107 |
| ACTIVE (invoke ok with `[]`) | 102 |
| PARTIAL (found/enabled or invoke err / selection prereq) | 2 |
| FAIL (not found and no successful invoke) | 3 |
| Coverage ACTIVE / total | **95.3%** |
| Coverage (ACTIVE+PARTIAL) / total | 97.2% |
| Desktop screenshots indexed | 11 |
| HWND inventory | 28 HWND lines |

### Boot opener (attested)

```
try { Preferences.SetPreferenceValue("data_management.workgroup_appl_path", ""); } catch(e0) {}
try { Application.ExecuteCommand("Disable Face Robot", []); } catch(e1) {}
try { Application.ExecuteCommand("Softimage Layout", []); } catch(e2) {}
```

| Step | Result |
|------|--------|
| clear workgroup path | `ok` |
| Disable Face Robot `[]` | ok=True err= |
| Softimage Layout `[]` | ok=True err= |

### PE MCP tops (file-attested, toolbarobj/mcp/uiut)

| Tab | PE menu | Tops |
|-----|---------|------|
| UI MCP chrome | ['201', '203', '204'] | Select, CONTEXT, Edit, Transformation, Snap |
| Module strip (uiut) | 211 | Modeling, Animation, Rendering, Property, Simulate |
| Model | 204 | Get, Create, Modify |
| Animate | 237 | Get, Create, Deform, Actions, Tools |
| Render | 234 | Get, Modify, Render, Pass |
| ICE (+CrowdFX top) | 303 | Get, Particles, Deform, Kinematics, CrowdFX |
| Hair | 297 | Create, Modify, Display |

## Master matrix (Tab ? Option ? Softimage behavior)

Status legend: **ACTIVE** = ExecuteCommand(`[]`) succeeded; **PARTIAL** = command found/enabled and/or invoke failed with attested error / selection prerequisite; **FAIL** = not in Commands and invoke did not succeed.

### UI

Shared MCP chrome + Panel toolbar (no dedicated Switch to UI Toolbar; Softimage Layout MCP Select/Transform/Snap/Edit)

- Switch commands: `Softimage Layout`, `Switch to Panel Toolbar`
- PE MCP tops: Select, CONTEXT, Edit, Transformation, Snap
- Command sweep hits (needle match): **289**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Softimage Layout` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Switch to Panel Toolbar` | **ACTIVE** | True | Views / SwitchToViewByType | no_scene_delta | no | - |
| `SelectTool` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Translate` | **ACTIVE** | True | Manipulation\|Transform / Translate | no_scene_delta | no | - |
| `Rotate` | **ACTIVE** | True | Manipulation\|Transform / Rotate | no_scene_delta | no | - |
| `Scale` | **ACTIVE** | True | Manipulation\|Transform / Scale | no_scene_delta | no | - |
| `ToggleSnap` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `ToggleProportional` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `ToggleSymmetry` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `ToggleCOG` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Parent` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `CreateGroup` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `FreezeObj` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Duplicate` | **ACTIVE** | True | Edit / Duplicate | no_scene_delta | no | - |
| `DeselectAll` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Explorer` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Script Editor` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Property Page` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Preferences` | **ACTIVE** |  |  | no_scene_delta | no | - |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Explorer` | False | OpenView failed |
| `Explorer_cmd` | True |  |
| `Schematic` | False | OpenView failed |
| `Schematic_cmd` | True |  |
| `Script Editor` | False | OpenView failed |
| `Script Editor_cmd` | True |  |

### Model

- Switch commands: `Switch to Model Toolbar`
- PE MCP tops: Get, Create, Modify
- Command sweep hits (needle match): **187**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Switch to Model Toolbar` | **ACTIVE** | True | Toolbar / SwitchToolbar | no_scene_delta | no | - |
| `Get Prim` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `CreatePrim` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Create Prim` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Apply GeoAttr` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Freeze Modeling` | **ACTIVE** | True | Edit / FreezeModeling | no_scene_delta | no | - |
| `FreezeModeling` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Extrude Component` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Bevel Component` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `ApplyOp` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Boolean` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Cap Hole` | **ACTIVE** | True | Modeling\|Topology / CapHole | no_scene_delta | no | - |
| `CapHole` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Polygon Reduction` | **ACTIVE** | True | Modeling\|Topology\|Operator / ApplyTopoOp | no_scene_delta | no | - |
| `PolyReduce` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `InspectObj` | **ACTIVE** |  |  | no_scene_delta | no | - |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Explorer` | False | OpenView failed |
| `Explorer_cmd` | True |  |
| `Property Page` | False | OpenView failed |
| `Property Page_cmd` | True |  |

### Animate

- Switch commands: `Switch to Animate Toolbar`
- PE MCP tops: Get, Create, Deform, Actions, Tools
- Command sweep hits (needle match): **409**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Switch to Animate Toolbar` | **ACTIVE** | True | Toolbar / SwitchToolbar | no_scene_delta | no | - |
| `SetKey` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `RemoveKey` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `SaveKey` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Open Animation Mixer` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Open Animation Editor` | **ACTIVE** | True | Viewing / OpenAnimationEditor | no_scene_delta | no | - |
| `Open Fcurve Editor` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Apply FlexEnv` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Envelope` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Create Constraint` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Plot` | **FAIL** |  |  | - | no | skipped_invoke_safe_policy |
| `Store Action` | **ACTIVE** | True | Animation Mixer / StoreAction | no_scene_delta | no | - |
| `Apply Action` | **ACTIVE** | True | Animation Mixer / ApplyAction | no_scene_delta | no | - |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Animation Editor` | False | OpenView failed |
| `Animation Editor_cmd` | True |  |
| `Animation Mixer` | False | OpenView failed |
| `Animation Mixer_cmd` | True |  |
| `Fcurve` | False | OpenView failed |
| `Fcurve_cmd` | True |  |

### Render

- Switch commands: `Switch to Render Toolbar`
- PE MCP tops: Get, Modify, Render, Pass
- Command sweep hits (needle match): **213**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Switch to Render Toolbar` | **ACTIVE** | True | Toolbar / SwitchToolbar | no_scene_delta | no | - |
| `Render Manager` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Render Options` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `CreateRenderPass` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Create Render Pass` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Render Region Tool` | **ACTIVE** | True | Rendering / RenderRegionTool | no_scene_delta | no | - |
| `CreateRenderRegion` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `ToggleRenderRegion` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Get Material` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Assign Material` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Render Tree` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Render Pass` | **PARTIAL** | True | Rendering / RenderPass | - | no | skipped_invoke_safe_policy |
| `Render Current Pass` | **PARTIAL** | True | Rendering / RenderPasses | - | no | skipped_invoke_safe_policy |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Material Manager` | False | OpenView failed |
| `Material Manager_cmd` | True |  |
| `Render Manager` | False | OpenView failed |
| `Render Manager_cmd` | True |  |
| `Render Tree` | False | OpenView failed |
| `Render Tree_cmd` | True |  |

### ICE

- Switch commands: `Switch to ICE Toolbar`
- PE MCP tops: Get, Particles, Deform, Kinematics, CrowdFX
- Command sweep hits (needle match): **136**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Switch to ICE Toolbar` | **ACTIVE** | True | Toolbar / SwitchToolbar | no_scene_delta | no | - |
| `ICE Tree` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Open ICE Tree View` | **ACTIVE** | True | Property\|Edit / OpenICETreeView | no_scene_delta | no | - |
| `Apply ICE Operator` | **ACTIVE** | True | Edit / ApplyICEOp | no_scene_delta | no | - |
| `Apply ICE Template` | **ACTIVE** | True | Edit / ApplyICETemplate | no_scene_delta | no | - |
| `Add ICE Node` | **ACTIVE** | True | Edit / AddICENode | no_scene_delta | no | - |
| `Add ICE Compound Node` | **ACTIVE** | True | Edit / AddICECompoundNode | no_scene_delta | no | - |
| `Generate Point Cloud with ICE Template` | **ACTIVE** | True | Edit / GeneratePointCloudWithICETemplate | no_scene_delta | no | - |
| `CreateICENodeWizard` | **ACTIVE** |  |  | no_scene_delta | no | - |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Explorer` | False | OpenView failed |
| `Explorer_cmd` | True |  |
| `ICE Tree` | False | OpenView failed |
| `ICE Tree_cmd` | True |  |

### Hair

- Switch commands: `Switch to Hair Toolbar`
- PE MCP tops: Create, Modify, Display
- Command sweep hits (needle match): **29**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Switch to Hair Toolbar` | **ACTIVE** | True | Toolbar / SwitchToolbar | no_scene_delta | no | - |
| `Hair` | **ACTIVE** | True | Viewing / ToggleValue | no_scene_delta | no | - |
| `Hair Panel` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Hair Generator` | **ACTIVE** | True | Modeling\|Generator / ApplyHairOp | no_scene_delta | no | - |
| `Hair Dynamics Simulator` | **ACTIVE** | True | Simulation / ApplyHairDynamicsOp | no_scene_delta | no | - |
| `Hair Comb Operator` | **ACTIVE** | True | Modeling / ApplyHairCombOp | no_scene_delta | no | - |
| `Hair Clump Operator` | **ACTIVE** | True | Modeling / ApplyHairClumpOp | no_scene_delta | no | - |
| `Create Hair From Selection` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Create Hair From Curves` | **ACTIVE** |  |  | no_scene_delta | no | - |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Explorer` | False | OpenView failed |
| `Explorer_cmd` | True |  |
| `Hair Panel` | False | OpenView failed |
| `Hair Panel_cmd` | True |  |

### Simulate

- Switch commands: `Switch to Simulate Toolbar`
- PE MCP tops: Get, Create, Modify
- Command sweep hits (needle match): **40**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Switch to Simulate Toolbar` | **ACTIVE** | True | Toolbar / SwitchToolbar | no_scene_delta | no | - |
| `Create Rigid Body` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Create Soft Body` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Create Cloth` | **ACTIVE** | True | Custom / SyCreateCloth | no_scene_delta | no | - |
| `SyCreateCloth` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Apply Rigid Body` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Apply Soft Body` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Apply Cloth` | **ACTIVE** | True | Simulation / ApplyCloth | no_scene_delta | no | - |
| `Get Force` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Create Force` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Simulate` | **FAIL** |  |  | - | no | skipped_invoke_safe_policy |
| `Plot Simulation` | **FAIL** |  |  | - | no | skipped_invoke_safe_policy |
| `Toggle Simulation` | **ACTIVE** |  |  | no_scene_delta | no | - |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Explorer` | False | OpenView failed |
| `Explorer_cmd` | True |  |
| `Property Page` | False | OpenView failed |
| `Property Page_cmd` | True |  |

### CrowdFX

Lives under ICE MCP/menu (Actors/Crowd/Simulation); PE menu 303 CrowdFX top

- Switch commands: `Switch to ICE Toolbar`
- PE MCP tops: Actors, Crowd, Simulation
- Command sweep hits (needle match): **36**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Switch to ICE Toolbar` | **ACTIVE** | True | Toolbar / SwitchToolbar | no_scene_delta | no | - |
| `CrowdFX` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Create Crowd` | **ACTIVE** | True | Custom / CreateCrowd | no_scene_delta | no | - |
| `Create Actor` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `CrowdFX Actors` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `CrowdFX Crowd` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `CrowdFX Simulation` | **ACTIVE** |  |  | no_scene_delta | no | - |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Explorer` | False | OpenView failed |
| `Explorer_cmd` | True |  |
| `ICE Tree` | False | OpenView failed |
| `ICE Tree_cmd` | True |  |

### Face Robot

- Switch commands: `Face Robot Layout`, `Enable Face Robot`
- PE MCP tops: Assemble, Stage
- Command sweep hits (needle match): **1**

| Option | Status | Enabled | Category / ScriptingName | Opens / mutate | Selection prereq | Err / notes |
|--------|--------|---------|--------------------------|----------------|------------------|-------------|
| `Enable Face Robot` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Face Robot Layout` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Face Robot` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Face Robot Act Floating Panel` | **ACTIVE** | True | ShowFaceRobotActPanel | no_scene_delta | no | - |
| `Face Robot Help` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Face Robot Wiki` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Disable Face Robot` | **ACTIVE** |  |  | no_scene_delta | no | - |
| `Softimage Layout` | **ACTIVE** |  |  | no_scene_delta | no | - |

OpenView / view-command probes:

| View | ok | detail |
|------|----|--------|
| `Explorer` | False | OpenView failed |
| `Explorer_cmd` | True |  |
| `Face Robot` | False | OpenView failed |
| `Face Robot_cmd` | True |  |

## Screenshots

| File | Note |
|------|------|
| [`01-after-softimage-layout-boot.png`](../media/softimage-tab-audit/01-after-softimage-layout-boot.png) | Softimage Layout boot |
| [`10-model-tab.png`](../media/softimage-tab-audit/10-model-tab.png) | tab=model key=1 cmd=Switch to Model Toolbar |
| [`20-animate-tab.png`](../media/softimage-tab-audit/20-animate-tab.png) | tab=animate key=2 cmd=Switch to Animate Toolbar |
| [`30-render-tab.png`](../media/softimage-tab-audit/30-render-tab.png) | tab=render key=3 cmd=Switch to Render Toolbar |
| [`40-ice-tab.png`](../media/softimage-tab-audit/40-ice-tab.png) | tab=ice key=4 cmd=Switch to ICE Toolbar |
| [`50-hair-tab.png`](../media/softimage-tab-audit/50-hair-tab.png) | tab=hair key=^+2 cmd=Switch to Hair Toolbar |
| [`60-simulate-tab.png`](../media/softimage-tab-audit/60-simulate-tab.png) | tab=simulate key=^+4 cmd=Switch to Simulate Toolbar |
| [`70-crowdfx-tab.png`](../media/softimage-tab-audit/70-crowdfx-tab.png) | tab=crowdfx key=4 cmd=Switch to ICE Toolbar |
| [`80-facerobot-layout.png`](../media/softimage-tab-audit/80-facerobot-layout.png) | Face Robot Layout |
| [`90-ui-model-mcp.png`](../media/softimage-tab-audit/90-ui-model-mcp.png) | Softimage Layout Model MCP (UI chrome) |
| [`99-final-softimage-layout.png`](../media/softimage-tab-audit/99-final-softimage-layout.png) | final |

## LOCK / blocked

- MCP press-hold flyout **pixel leaf lists** remain LOCK without live press-hold HWND (same as modules tours).
- Face Robot Layout / Enable Face Robot often `Commands.found=false` but ExecuteCommand can still succeed (plugin path) ? attested in switch matrix.
- CrowdFX submenu live flyouts: prior harvest `submenu_live=false` unless HWND popup appears.
- OpenView under XSIBATCH `-processing` often fails; Desktop Script Editor OpenView is authoritative for views.

Per-option FAIL / missing dump:
- Animate / Plot: FAIL
- Simulate / Simulate: FAIL
- Simulate / Plot Simulation: FAIL

## Machine-readable dumps

- `internal/softimage-pc-dumps/full-tab-audit/full_tab_harvest.json`
- `internal/softimage-pc-dumps/full-tab-audit/tab_*.json`
- `docs/dump-factory/si_full_tab_interaction_harvest.js`
- `docs/dump-factory/Run-Full-Tab-Interaction-Harvest.ps1`

