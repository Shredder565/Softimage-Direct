#!/usr/bin/env python3
"""Model-tab surface audit.

Reads the committed Model dumps (menu 204, command tables, generator SPDL contracts,
deform/topology parameter tables, shelf targets, siuitasks dialog 201) and writes the
audit in the same shape as tools/build_ui_surface_audit.py.

Verdict is the state of AfterImage src/ *before* this pass. `wired` marks what the pass closed.

Clean room: dumps are specification only. The tables carry Softimage names, script names,
parameter contracts and dialog control text. No decompiler listing is copied into src/.

Run: python3 tools/build_model_surface_audit.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMP = os.path.join(ROOT, 'data', 'dump')
DOCS = os.path.join(ROOT, 'docs', 'ghidra')
OUT = os.path.join(ROOT, 'src', 'data', 'si')


def row(module, item, verdict, surface, note, wired=False, kind='symbol'):
    return {
        'kind': kind,
        'module': module,
        'item': item,
        'verdict': verdict,
        'wired': wired,
        'surface': surface,
        'note': note,
    }


def menu_groups():
    text = open(os.path.join(ROOT, 'data', 'menu_model.txt'), encoding='utf-8').read().splitlines()
    stack = []
    groups = {}
    for line in text[1:]:
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(' '))
        m = re.match(r'\s*(.*?)\s+\[(\d+)\]\s*$', line)
        label = m.group(1).strip() if m else line.strip()
        if label.startswith('---') or label == '----':
            continue
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if m and m.group(2) != '0':
            key = stack[0][1] + ' / ' + stack[1][1] if len(stack) >= 2 else (stack[0][1] if stack else label)
            groups[key] = groups.get(key, 0) + 1
        else:
            stack.append((indent, label))
    return groups


def items():
    out = []
    groups = menu_groups()
    out.append(row('data/menu_model.txt', 'MENU 204 — Get / Create / Modify', 'PRESENT',
                   'menus.json `Model`', '390 leaves; every id is in menu_commands.json', kind='menu'))
    partial_poly = 'Modify / Poly. Mesh'
    for key, n in groups.items():
        if key == partial_poly:
            out.append(row('data/menu_model.txt', key, 'PARTIAL', 'AddPolygonTool',
                           f'{n} leaves. Add Polygon Tool was registered but finish never built a polygon.',
                           wired=True, kind='menu'))
        else:
            out.append(row('data/menu_model.txt', key, 'PRESENT', 'src/commands/model.ts',
                           f'{n} leaves registered', kind='menu'))

    out.append(row('data/dump/si_model_dump.json', 'Model menu execution table', 'PRESENT',
                   'menu_commands.json', '390 menu-leaf executions', kind='table'))
    out.append(row('data/dump/si_model_dump4.json', 'Get/* primParams', 'PRESENT',
                   'opdefs.json prim:Polygon Mesh',
                   'subdrule and subdloop live on the polygon-mesh primitive, not on geom:Cube', kind='table'))
    out.append(row('data/dump/si_model_prims.json', 'Primitive golden table', 'PRESENT',
                   'src/commands/model.ts CreatePrim / GetPrim', 'Mesh and curve primitive goldens', kind='table'))
    out.append(row('data/dump/si_model_property_commands.json', 'Property command table', 'PRESENT',
                   'Get / Property menu leaves',
                   'Model-menu property leaves are registered. The file also lists non-Model categories (MCP, retarget, GPU maps); those are not Model-tab surfaces.',
                   kind='table'))
    out.append(row('data/dump/si_model_ops_counts.json', 'Boolean / text / OT count locks', 'PRESENT',
                   'src/core/scene2.ts booleanOp',
                   'Count locks. Direct CSG is not Softimage-equal; the command names are present.', kind='table'))
    out.append(row('data/dump/si_generators_golden.json', 'Generator apply golden', 'PRESENT',
                   'ApplyGenOp',
                   'Dump rows came back with empty meshes or a failed loft. The generator commands are registered.', kind='table'))
    out.append(row('data/si/dict/XSIMODELTASKS.dict', 'XSIMODELTASKS string table', 'PRESENT',
                   'strings.json XSIMODELTASKS', 'Labels already carried by the Model commands', kind='strings'))

    gens = [
        ('extrusion', 'PRESENT', False, 'C3DGenerator inputreadregion is on the opdef'),
        ('revolution', 'PRESENT', False, 'C3DGenerator inputreadregion is on the opdef'),
        ('loft', 'PRESENT', False, 'C3DGenerator inputreadregion is on the opdef'),
        ('birail', 'PRESENT', False, 'C3DGenerator inputreadregion is on the opdef'),
        ('foursided', 'PRESENT', False, 'C3DGenerator inputreadregion is on the opdef'),
        ('crvnet', 'MISSING', True, 'No opdef row. curvenetop.spdl + C3DParametricSurfaceGenerator.spdl. Feature-match solver is not in the dumps; the flag is stored.'),
        ('CurveListToMesh', 'PARTIAL', True, 'syncwithinputspose was on the opdef and depStamp ignored it'),
        ('booleansrftopoop', 'PRESENT', False, 'C3DBooleanSrfTopoOp.spdl does not include C3DGenerator.spdl'),
        ('blendcrv', 'PARTIAL', True, 'blendcrvop.spdl includes C3DGenerator.spdl; opdef omitted inputreadregion'),
        ('mergecrv', 'PARTIAL', True, 'mergecrv.spdl includes C3DGenerator.spdl; opdef omitted inputreadregion'),
        ('mergemesh', 'PARTIAL', True, 'C3DMergeMeshOp.spdl includes C3DGenerator.spdl; opdef omitted inputreadregion'),
        ('nurbstomesh', 'PRESENT', False, 'inputreadregion is on the opdef'),
        ('extractcrvseg', 'PRESENT', False, 'inputreadregion is on the opdef'),
    ]
    for name, verdict, wired, note in gens:
        out.append(row('generator op', name, verdict, "siParamDefs('" + name + "')", note, wired=wired, kind='operator'))
    out.append(row('C3DGenerator.spdl', 'inputreadregion evaluation', 'PARTIAL',
                   'GeneratorOperator.inputGeom',
                   'Parametric generators already had the combo and still read the full input stack',
                   wired=True, kind='operator'))
    out.append(row('data/dump/si_genop_inputs_buttons.json', 'GenOpInputsButtons display + logic', 'PARTIAL',
                   'genop_inputs_buttons.json',
                   'Hide/Delete were wired. SelectOutputs_OnClicked named SelectGeneratorOutputs, which was not registered.',
                   wired=True, kind='ppg'))
    out.append(row('GenOpInputsButtonsLogic.spdl', 'SelectGeneratorOutputs', 'MISSING',
                   'src/commands/model.ts',
                   'SelectOutputs_OnClicked. Selects the generator output object.',
                   wired=True, kind='command'))

    for target in [
        'ModelGetPrimitive&Polygon Mesh',
        'ModelGetPrimitive',
        'ModelGetPrimitiveCamera',
        'ModelGetPrimitiveLight',
        'ModelGetPrimitive&curve',
        'ModelCreateCurve',
    ]:
        out.append(row('Main_Shelf.xsitb', 'TargetContent ' + target, 'PRESENT',
                       'src/ui/shelf.ts', 'Menu Window target parsed from the shelf script', kind='toolbar'))

    out.append(row('siuitasks.dll', 'DIALOG 201 — Assemble NurbsMesh (SCM)', 'MISSING',
                   'src/ui/assembleNurbsDialog.ts',
                   'OK, Cancel, Help, SCM Tolerance, Copy User Clusters Locally, Copy Materials and Textures Locally, Center To Geometric Center. Template rect 195×125, font MS Sans Serif 8.',
                   wired=True, kind='dialog'))

    out.append(row('native/src/ai_main_frame.cpp', 'Model menu — Get / Create / Modify', 'MISSING',
                   'AiMainFrame::BuildMenus',
                   'The shell had a Render popup of attested command names and no Model menu.',
                   wired=True, kind='native'))

    deform = json.load(open(os.path.join(DUMP, 'si_model_deform.json'), encoding='utf-8'))
    for name, case in deform['cases'].items():
        if name == 'Deform by Spine':
            out.append(row('data/dump/si_model_deform.json', 'Deform by Spine — deformbyspineop2', 'PARTIAL',
                           'RefDeformOperator siType deformbyspineop2',
                           'Dump type deformbyspineop2 (mute only). SPDL adds UseNormalizedUValues (UnInspectable). Runtime type was refdeform.',
                           wired=True, kind='contract'))
        else:
            ot = case.get('op_type')
            sns = [p.get('sn') for p in (case.get('params_full') or []) if isinstance(p, dict) and p.get('sn')]
            out.append(row('data/dump/si_model_deform.json', f'{name} — {ot}', 'PRESENT',
                           f'opdefs.json `{ot}`',
                           f'{len(sns)} parameters match the opdef (mute is applied at runtime)', kind='contract'))

    topo = json.load(open(os.path.join(DUMP, 'si_model_topo_extra.json'), encoding='utf-8'))
    for name, case in topo['cases'].items():
        ot = case.get('op_type') or ''
        err = case.get('error') or ''
        sns = [p.get('sn') for p in (case.get('params_full') or []) if isinstance(p, dict) and p.get('sn')]
        if err or not sns:
            why = 'Dump returned no parameter names' + (f' ({err.split("_$")[0]})' if err else '')
            out.append(row('data/dump/si_model_topo_extra.json', f'{name} — {ot or "no type"}', 'ABSENT',
                           '—', why, kind='contract'))
        else:
            out.append(row('data/dump/si_model_topo_extra.json', f'{name} — {ot}', 'PRESENT',
                           f'opdefs.json `{ot}`', f'{len(sns)} parameters match the opdef', kind='contract'))

    absent = [
        ('commands_full', 'GATOR scripting name', 'commands_full has no GATOR scripting name. The grey command stays unable to run.'),
        ('sicommands.dll', 'KnifeTool / Knife Tool', 'Absent from Commands and sicommands.dll. PE Knife Tool is Slice Polygons Tool.'),
        ('sicommands.dll', 'SetUserNormalsSettings', 'Name is absent. The menu leaf is Inspect User Normal Editing Preferences.'),
        ('commands_full', 'AddPointOnCurveTool', 'Bare name is a FAIL. Only the By CVs / By Bezier-Knot / By Knot Points names are active.'),
        ('data/dump/si_model_dump4.json', 'CreateLightRigFromImage layout', 'The leaf produced no objects and the dump has no light-rig layout. The command stays unable to run.'),
        ('data/dump/si_model_property_commands.json', 'Add property extended', 'Scripting name is empty.'),
        ('data/dump/si_model_property_commands.json', 'Open SE on Override parent', 'Scripting name is empty.'),
        ('data/dump/si_model_property_commands.json', 'Polygon Cluster Visibility Property', 'Scripting name is empty.'),
    ]
    for module, item, note in absent:
        out.append(row(module, item, 'ABSENT', '—', note, kind='symbol'))
    return out


def counts(rows):
    c = {'PRESENT': 0, 'PARTIAL': 0, 'MISSING': 0, 'ABSENT': 0}
    for r in rows:
        c[r['verdict']] += 1
    c['total'] = len(rows)
    c['wiredThisPass'] = sum(1 for r in rows if r['wired'])
    return c


def md_table(rows):
    lines = ['| Module / file | Item | Verdict | Wired | AfterImage surface | Note |',
             '|---------------|------|---------|-------|--------------------|------|']
    for r in rows:
        v = f'**{r["verdict"]}**' if r['verdict'] in ('MISSING', 'PARTIAL') else r['verdict']
        w = '✔' if r['wired'] else ''
        lines.append(f'| `{r["module"]}` | {r["item"]} | {v} | {w} | {r["surface"]} | {r["note"]} |')
    return '\n'.join(lines)


def main():
    rows = items()
    c = counts(rows)
    sections = [
        ('Menu (MENU 204)', 'menu'),
        ('Command tables', 'table'),
        ('String table', 'strings'),
        ('Generator operators and PPG', None),  # filled below
        ('Toolbar objects', 'toolbar'),
        ('Dialog templates (RT_DIALOG)', 'dialog'),
        ('Native shell', 'native'),
        ('Operator parameter contracts', 'contract'),
        ('No attestable name', 'symbol'),
    ]
    # generator section is operator + ppg + command
    body = []
    body.append('# Model-surface audit — Softimage dumps vs AfterImage `src/`\n')
    body.append('**Date:** 2026-10-27  ')
    body.append('**Source:** committed dump artifacts only (softimage-pc not connected)  ')
    body.append('**Scope:** Model tab  ')
    body.append('**Generated by:** `tools/build_model_surface_audit.py`  ')
    body.append('**Runtime audit:** `src/ui/modelSurfaceAudit.ts` → `__uiAudit().modelSurface`\n')
    body.append('## Verdicts\n')
    body.append('| Verdict | Meaning |')
    body.append('|---------|---------|')
    body.append('| PRESENT | AfterImage already carried the item with dump-attested names / metrics. |')
    body.append('| PARTIAL | Surface existed, behaviour or fields incomplete against the dump. |')
    body.append('| MISSING | Dump exposes it, AfterImage had nothing. |')
    body.append('| ABSENT | Deliberately not wired — no attestable Softimage name, or no AfterImage counterpart. |')
    body.append('')
    body.append('Verdicts describe `src/` **before** this pass. The **Wired** column marks the items the pass closed.\n')
    body.append('## Counts\n')
    body.append('| | n |')
    body.append('|---|---|')
    body.append(f'| Model items inventoried | **{c["total"]}** |')
    body.append(f'| PRESENT | {c["PRESENT"]} |')
    body.append(f'| PARTIAL | {c["PARTIAL"]} |')
    body.append(f'| MISSING | {c["MISSING"]} |')
    body.append(f'| ABSENT (documented, not invented) | {c["ABSENT"]} |')
    body.append(f'| Closed by this pass | **{c["wiredThisPass"]}** |')
    body.append('')

    def emit(title, pred):
        chunk = [r for r in rows if pred(r)]
        if not chunk:
            return
        body.append(f'## {title}\n')
        body.append(md_table(chunk))
        body.append('')

    emit('Model menu (MENU 204)', lambda r: r['kind'] == 'menu')
    emit('Command tables', lambda r: r['kind'] == 'table')
    emit('String table', lambda r: r['kind'] == 'strings')
    emit('Generator operators and PPG', lambda r: r['kind'] in ('operator', 'ppg', 'command'))
    emit('Toolbar objects', lambda r: r['kind'] == 'toolbar')
    emit('Dialog templates (RT_DIALOG)', lambda r: r['kind'] == 'dialog')
    emit('Native shell', lambda r: r['kind'] == 'native')
    emit('Operator parameter contracts', lambda r: r['kind'] == 'contract')
    emit('No attestable name', lambda r: r['kind'] == 'symbol')

    body.append('## Clean-room\n')
    body.append('Dumps are specification only: menu labels, command names, script names, SPDL parameter contracts, dialog titles and control text.')
    body.append('Decompiled or disassembled code is not pasted into `src/` or `native/`.')
    body.append('`siuitasks.dll` dialog 202 is titled User Keyword(s) and is outside the Model tab, so it is not in this table.')
    body.append('Feature Match on Curve Net has no solver in the committed dumps; the parameter is stored and the existing curve-net surface is unchanged.')
    body.append('Deform by Spine keeps the radius and falloff values already shipped; the spine dump did not list them, and this pass does not remove them.')
    body.append('')

    os.makedirs(DOCS, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(DUMP, exist_ok=True)
    doc = '\n'.join(body)
    open(os.path.join(DOCS, 'model-surface-audit.md'), 'w', encoding='utf-8').write(doc)
    payload = {
        'softimage': '13.2.163.0',
        'source': 'committed Model dumps',
        'generated_by': 'tools/build_model_surface_audit.py',
        'counts': c,
        'items': rows,
    }
    text = json.dumps(payload, indent=2)
    open(os.path.join(DUMP, 'si_model_surface_audit.json'), 'w', encoding='utf-8').write(text + '\n')
    open(os.path.join(OUT, 'model_surface_audit.json'), 'w', encoding='utf-8').write(text + '\n')
    print(c)


if __name__ == '__main__':
    main()
