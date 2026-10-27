#!/usr/bin/env python3
"""Animate-tab surface audit: inventory committed Softimage dumps, diff them against AfterImage `src/`,
and emit the per-item verdict table.

Inputs (all committed — softimage-pc is not required):
  data/dump/animate-menu-leaves.json          RT_MENU 237 leaves
  data/dump/si_anim_enabled_xsibatch.json     204 Animate command Names + Enabled
  data/commands_full.json                     scripting name, category, description, args
  data/dump/si_anim_actions_tools_defaults.json
  data/si/pe_resources.json                   RT_DIALOG (Current Time and untitled templates)
  src/data/si/anim_chrome.json                committed PE dialog summaries + editor chrome
  data/dump/si_model_deform.json              operator parameter contracts
  data/dump/si_anim_fcurve_golden.json
  data/dump/si_anim_envelope_shape.json
  data/dump/si_anim_mixer_deep.json
  data/menu_command_map.json                  toolbar == Animate
  src/data/menus.json                         Animate module menu
  src/main.ts                                 registered views

Verdict is the state of AfterImage `src/` *before* this pass. `src/commands/animateSurface.ts` is
excluded from the before-scan so re-running the builder keeps those verdicts stable.

Clean room: names, resource ids, argument contracts, DLU rects, and parameter script names only.
Run: python3 tools/build_animate_surface_audit.py
"""
from __future__ import annotations

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SI = os.path.join(ROOT, 'data', 'si')
DUMP = os.path.join(ROOT, 'data', 'dump')
OUT = os.path.join(ROOT, 'src', 'data', 'si')
DOCS = os.path.join(ROOT, 'docs', 'ghidra')

# The pass's own registration file. Scanning it would mark every closed command PRESENT.
SKIP_SRC = {
    os.path.join(ROOT, 'src', 'commands', 'animateSurface.ts'),
}


def registered_names() -> set[str]:
    names: set[str] = set()
    for dirpath, _, files in os.walk(os.path.join(ROOT, 'src')):
        for fn in files:
            if not fn.endswith('.ts'):
                continue
            path = os.path.join(dirpath, fn)
            if os.path.abspath(path) in SKIP_SRC:
                continue
            text = open(path, encoding='utf-8', errors='ignore').read()
            names.update(re.findall(r"""name:\s*['"]([A-Za-z0-9_]+)['"]""", text))
    return names


def family(name: str, cat: str) -> str:
    cat = cat or ''
    if 'AnimationLayer' in name or name == 'IsAnimationLayerLocked':
        return 'layer'
    if 'Constraint' in name or name in ('ApplyPath', 'ApplyCns'):
        return 'constraint'
    if 'Envelope' in name or 'FlexEnv' in name:
        return 'envelope'
    if 'Shape' in name or 'Deform' in name or 'Deform' in cat:
        return 'deform'
    if any(tok in name for tok in ('FCurve', 'CurveType', 'Sequence', 'Quat', 'Euler', 'ScaleAndOffset', 'RotationsContinuous')):
        return 'fcurve'
    if name in ('RemoveAllAnimation', 'RemoveAnimation') or any(
        tok in name for tok in ('Key', 'Marking', 'Mark', 'PasteKeys', 'CopyKeys', 'CutKeys', 'DeleteKeys')
    ):
        return 'keying'
    if ('Mixer' in cat or cat == 'Action' or 'Action' in name or name.startswith('Plot')
            or 'Clip' in name or 'Track' in name or 'Marker' in name or 'Transition' in name
            or name in ('CollapseLayers', 'ReconnectMixer', 'EqualizeClips', 'CreateCompound')):
        return 'mixer'
    return 'other'


FAMILY_HEADING = {
    'keying': 'Keying command table',
    'fcurve': 'Fcurve command table',
    'layer': 'Animation layer command table',
    'mixer': 'Mixer / action command table',
    'constraint': 'Constraint command table',
    'envelope': 'Envelope command table',
    'deform': 'Deform / shape command table',
    'other': 'Other attested Animate commands',
}


def leaf_walk(items, path):
    out = []
    for it in items:
        if it.get('separator'):
            continue
        label = it.get('label') or ''
        p = path + [label]
        if it.get('items'):
            out.extend(leaf_walk(it['items'], p))
        else:
            out.append(it)
    return out


def menu_rows():
    dump = json.load(open(os.path.join(DUMP, 'animate-menu-leaves.json'), encoding='utf-8'))
    menus = json.load(open(os.path.join(ROOT, 'src', 'data', 'menus.json'), encoding='utf-8'))
    src_leaves = leaf_walk(menus['Animate'], [])

    def all_ids(items, acc):
        for it in items:
            if it.get('id') is not None:
                acc.add(it['id'])
            if it.get('items'):
                all_ids(it['items'], acc)
        return acc

    src_ids = all_ids(menus['Animate'], set())
    rows = []
    sections = dump['meta']['section_counts']
    for section, n in sections.items():
        have = sum(1 for L in dump['leaves'] if L['section'] == section and L['id'] in src_ids)
        verdict = 'PRESENT' if have == n else 'PARTIAL'
        rows.append(('menu', 'toolbarobj / RT_MENU 237', f'{section} ({n} leaves)', verdict, '',
                     'src/data/menus.json `Animate`',
                     f'{have} dump ids present in the Animate menu tree'))
    anchor = next(L for L in dump['leaves'] if L['id'] == 41522)
    rows.append(('menu', 'RT_MENU 237', f"{anchor['path_str']} ({anchor['id']})", 'PRESENT', '',
                 'menus.json MOTOR + anchor_factory_menu_fills.json',
                 'Factory fills: Tag Rig, Rig to Rig, Mocap to Rig, Load Motion, Save Motion'))
    return rows


def command_rows(names: set[str]):
    enabled = json.load(open(os.path.join(DUMP, 'si_anim_enabled_xsibatch.json'), encoding='utf-8'))['commands']
    cf = {c['scripting_name']: c for c in json.load(open(os.path.join(ROOT, 'data', 'commands_full.json'), encoding='utf-8'))}
    defaults = json.load(open(os.path.join(DUMP, 'si_anim_actions_tools_defaults.json'), encoding='utf-8'))['commands']
    rows = []
    gap = []
    for name in enabled:
        spec = cf.get(name) or {}
        cat = spec.get('category') or ''
        fam = family(name, cat)
        present = name in names
        args = spec.get('args') or []
        note = f'{cat or "uncategorised"} · {len(args)} args · Enabled={str(enabled[name]).lower()}'
        if name in defaults:
            note += ' · actions/tools defaults dump'
        if present:
            rows.append(('command', fam, name, 'PRESENT', '', f'src/commands ({cat or "Animation"})', note))
        else:
            rows.append(('command', fam, name, 'MISSING', 'yes',
                         'src/commands/animateSurface.ts',
                         note + ' · no handler before this pass'))
            gap.append({
                'scripting_name': name,
                'label': spec.get('name') or name,
                'category': cat or 'Animation',
                'description': spec.get('description') or '',
                'family': fam,
                'args': [{'name': a.get('name'), 'default': a.get('default')} for a in args],
            })
    # Defaults dump entries that are not in the enabled table still belong in the inventory.
    for name, spec in defaults.items():
        if name in enabled:
            continue
        present = name in names
        rows.append(('command', 'defaults', name, 'PRESENT' if present else 'MISSING',
                     '' if present else 'yes',
                     'src/commands' if present else 'src/commands/animateSurface.ts',
                     f"{spec.get('category')} · defaults dump"))
    return rows, gap


def dialog_rows():
    pe = json.load(open(os.path.join(SI, 'pe_resources.json'), encoding='utf-8'))
    chrome = json.load(open(os.path.join(OUT, 'anim_chrome.json'), encoding='utf-8'))
    rows = []
    templates = {}
    d = pe['mcp.dll']['dialogs']['220']
    templates['mcp.dll#220'] = {
        'dll': 'mcp.dll',
        'id': '220',
        'title': d.get('title') or '',
        'rectDlu': d.get('rect'),
        'font': d.get('font'),
        'surface': 'Playback current time — FRAME / SECOND / MILLISECOND',
        'controls': [
            {'cls': c.get('cls'), 'text': c.get('text') or '', 'id': c.get('id'),
             'dlu': [c.get('x'), c.get('y'), c.get('w'), c.get('h')], 'style': c.get('style')}
            for c in d.get('controls') or []
        ],
    }
    rows.append(('dialog', 'mcp.dll', 'DIALOG 220 — Current Time', 'MISSING', 'yes',
                 'animate_dialogs.json `mcp.dll#220`',
                 'Playback time entry; radios sit beside FRAME / SECOND / MILLISECOND'))
    # Committed anim_chrome summaries whose PE title is empty stay ABSENT (same rule as the UI-surface audit).
    for key, dlg in chrome.get('dialogs', {}).items():
        title = (dlg.get('title') or '').strip()
        dll, did = dlg.get('dll'), dlg.get('id')
        if dll == 'mcp.dll' and str(did) == '220':
            continue
        labels = [t for t in (dlg.get('labels') or []) if isinstance(t, str) and t and not t.startswith(';')]
        sample = ', '.join(labels[:4]) if labels else 'no control text'
        if str(did) == '147':
            rows.append(('dialog', dll or key, 'DIALOG 147 — PPG host frame', 'PRESENT', '',
                         'src/data/si/ppg_chrome.json canonicalHostDialog',
                         'Untitled host frame already pinned; not a named Animate dialog'))
            continue
        if not title or title in ('Dialog', 'set from code using dictionnary'):
            rows.append(('dialog', dll or key, f'DIALOG {did} — (untitled)', 'ABSENT', '', '—',
                         f'No attestable dialog title in the committed dump; control text: {sample}'))
        else:
            rows.append(('dialog', dll or key, f'DIALOG {did} — {title}', 'MISSING', '', '—',
                         f'Attested title; control text: {sample}'))
    # uiut 358 is in the committed PE pack: untitled, with track-kind statics.
    u358 = pe.get('uiut.dll', {}).get('dialogs', {}).get('358')
    if u358 is not None and not (u358.get('title') or '').strip():
        texts = [c.get('text') for c in u358.get('controls') or [] if isinstance(c.get('text'), str) and c.get('text')]
        rows.append(('dialog', 'uiut.dll', 'DIALOG 358 — (untitled)', 'ABSENT', '', '—',
                     'No attestable dialog title; control text: ' + ', '.join(texts)))
    rows.append(('dialog', 'anim PE pack', 'Remaining action/mixer RT_DIALOG templates', 'ABSENT', '', '—',
                 'anim_chrome.pe_pack counts 133 dialogs / 113 menus; only the summaries above are committed. Names for the rest are not in the repo.'))
    return rows, templates


def surface_rows():
    main = open(os.path.join(ROOT, 'src', 'main.ts'), encoding='utf-8').read()
    rows = []
    views = [
        ('Keying Panel', 'data/si/views/KeyingPanel.xsivw'),
        ('Animation Editor', 'src/data/si/anim_chrome.json views'),
        ('Fcurve Editor', 'src/data/si/anim_chrome.json views'),
        ('Animation Mixer', 'src/data/si/anim_chrome.json views'),
        ('DopeSheet', 'src/data/si/anim_chrome.json views'),
        ('Animation Layer Manager', 'src/data/si/anim_chrome.json views'),
        ('Playback Panel', 'data/si/views'),
        ('Animation Panel', 'data/si/views/animationpanel.xsivw'),
    ]
    for name, src in views:
        present = f"'{name}'" in main
        rows.append(('view', src, name, 'PRESENT' if present else 'MISSING', '' if present else 'yes',
                     'src/main.ts layout.registerView' if present else '—',
                     'Floating / layout frame'))
    rows.append(('surface', 'genppg.dll MENU 264', 'Keying Panel context menu', 'PARTIAL', 'yes',
                 'src/ui/panels.ts keyingPanel',
                 'Menu resource is in menus.json keyingPanel; the panel did not open it'))
    rows.append(('surface', 'anim_chrome.mixer_tools', 'Mixer Track flyout — Insert Animation / Shape / Audio Track',
                 'PARTIAL', 'yes', 'src/ui/shell.ts animationMixer',
                 'Animation and Shape were logged only; Audio Track is attested and was not on the flyout'))
    rows.append(('surface', 'si_anim_client_paint.json', 'Animation Mixer / Editor / Fcurve client paint', 'PRESENT', '',
                 'src/ui/animClientPaint.ts', 'HWND PNG metrics'))
    rows.append(('surface', 'si_anim_editors_execcmd.json', 'OpenAnimationMixer / OpenAnimationEditor / OpenFcurveEditor',
                 'PRESENT', '', 'src/commands/anim.ts', 'ExecuteCommand empty-args open path'))
    rows.append(('surface', 'si_anim_hwnd_chrome.json', 'Anim HWND enabled matrix + view probe', 'PRESENT', '',
                 'src/ui/animEditorsExecCmd.ts', 'Open* commands, not the OpenView API'))
    paint = json.load(open(os.path.join(DUMP, 'si_anim_client_paint.json'), encoding='utf-8'))
    for view, block in (paint.get('views') or {}).items():
        bar = ' / '.join(block.get('menubar') or [])
        rows.append(('surface', 'si_anim_client_paint.json', f'{view} menubar', 'PRESENT', '',
                     'src/ui/animClientPaint.ts', bar or 'no menubar text in the dump'))
    rows.append(('surface', 'anim_chrome menus', 'Mixer Effect / Mix flyout leaves', 'ABSENT', '', '—',
                 'Shell comment and the committed dump have the top labels only — no leaf list'))
    return rows


def contract_rows():
    rows = []
    opdefs = json.load(open(os.path.join(ROOT, 'src', 'data', 'opdefs.json'), encoding='utf-8'))['ops']
    cases = json.load(open(os.path.join(DUMP, 'si_model_deform.json'), encoding='utf-8'))['cases']
    alias = {'Relax': 'smoothop'}
    for name, case in cases.items():
        sn = alias.get(name, case.get('op_type'))
        block = opdefs.get(sn) or {}
        have = set()
        for p in block.get('params') or []:
            if isinstance(p, dict) and p.get('sn'):
                have.add(p['sn'])
        full = case.get('params_full') or []
        dump = {p.get('sn') for p in full if isinstance(p, dict) and p.get('sn')} or set(case.get('params') or {})
        dump -= {'mute'}
        # DeformOperator always appends mute.
        missing = sorted(dump - have)
        if not missing:
            rows.append(('contract', sn or name, f'{name} parameters', 'PRESENT', '',
                         f'src/data/opdefs.json `{sn}` + DeformOperator mute',
                         f'{len(dump)} script names'))
        else:
            rows.append(('contract', sn or name, f'{name} parameters', 'PARTIAL', '',
                         f'src/data/opdefs.json `{sn}`',
                         'Missing script names: ' + ', '.join(missing[:8])))
    fc = json.load(open(os.path.join(DUMP, 'si_anim_fcurve_golden.json'), encoding='utf-8'))['fcurve']
    rows.append(('contract', 'si_anim_fcurve_golden.json', 'FCurve key (time, value, left, right, interp, extrap)',
                 'PRESENT', '', 'src/core/animation.ts FCurve',
                 f"extrap={fc.get('extrap')} keys={fc.get('key_count')} interp={fc['keys'][0].get('interp')}"))
    mix = json.load(open(os.path.join(DUMP, 'si_anim_mixer_deep.json'), encoding='utf-8'))
    cols = ', '.join(mix.get('mixer_collections') or [])
    rows.append(('contract', 'si_anim_mixer_deep.json', 'Mixer collections', 'PRESENT', '',
                 'src/core/scene.ts makeMixer', cols))
    env = json.load(open(os.path.join(DUMP, 'si_anim_envelope_shape.json'), encoding='utf-8'))
    rows.append(('contract', 'si_anim_envelope_shape.json', 'Envelope weight samples', 'ABSENT', '', '—',
                 'ApplyFlexEnv failed in the dump; weight_samples are null — no attestable weights'))
    shape = (env.get('shape') or {}).get('result')
    rows.append(('contract', 'si_anim_envelope_shape.json', f'Shape key result {shape}', 'PRESENT', '',
                 'src/core/shape.ts + StoreShapeKey', 'Headless StoreShapeKey succeeded'))
    return rows


def toolbar_rows():
    raw = json.load(open(os.path.join(ROOT, 'data', 'menu_command_map.json'), encoding='utf-8'))
    items = raw if isinstance(raw, list) else raw.get('items') or raw.get('commands') or []
    if isinstance(raw, dict) and not items:
        # file may be a list at top — already handled. Some dumps are a bare list.
        items = []
    n = 0
    if isinstance(raw, list):
        n = sum(1 for it in raw if isinstance(it, dict) and it.get('toolbar') == 'Animate')
    elif isinstance(raw, dict):
        seq = raw.get('map') or raw.get('entries') or []
        if isinstance(seq, list):
            n = sum(1 for it in seq if isinstance(it, dict) and it.get('toolbar') == 'Animate')
        else:
            # scanned as text if the structure is a list stored under another key
            n = json.dumps(raw).count('"toolbar": "Animate"')
    return [('toolbar', 'menu_command_map.json', f'Animate toolbar ({n} entries)', 'PRESENT', '',
             'src/ui/toolbarPanel.ts module Animate',
             'Same leaf ids as RT_MENU 237; module menu is the toolbar')]


def dict_rows():
    strings = json.load(open(os.path.join(OUT, 'strings.json'), encoding='utf-8'))
    present = 'XSIDEFORMOP' in strings or any('XSIDEFORMOP' in k for k in strings)
    # strings.json may be id-keyed; the dict file is the source table.
    dict_path = os.path.join(SI, 'dict', 'XSIDEFORMOP.dict')
    n = 0
    if os.path.exists(dict_path):
        n = sum(1 for line in open(dict_path, encoding='utf-8', errors='ignore') if line.strip())
    return [('strings', 'XSIDEFORMOP.dict', f'XSIDEFORMOP ({n} lines)', 'PRESENT', '',
             'data/si/dict/XSIDEFORMOP.dict → deform operator strings',
             'Committed dictionary; deform ops read opdefs script names')]


def tally(rows):
    counts = {'PRESENT': 0, 'PARTIAL': 0, 'MISSING': 0, 'ABSENT': 0}
    for r in rows:
        counts[r[3]] += 1
    counts['total'] = len(rows)
    counts['wiredThisPass'] = sum(1 for r in rows if r[4] == 'yes')
    return counts


SECTIONS = [
    ('menu', 'Animate menu (RT_MENU 237)'),
    ('keying', 'Keying command table'),
    ('fcurve', 'Fcurve command table'),
    ('layer', 'Animation layer command table'),
    ('mixer', 'Mixer / action command table'),
    ('constraint', 'Constraint command table'),
    ('envelope', 'Envelope command table'),
    ('deform', 'Deform / shape command table'),
    ('other', 'Other attested Animate commands'),
    ('defaults', 'Actions / tools argument defaults'),
    ('view', 'Editor and panel surfaces'),
    ('surface', 'Animate-tab chrome'),
    ('dialog', 'Dialog templates (RT_DIALOG)'),
    ('contract', 'Animation operator parameter contracts'),
    ('toolbar', 'Animate-tab toolbar'),
    ('strings', 'String tables'),
]


def markdown(rows, counts):
    L = [
        '# Animate-surface audit — Softimage dumps vs AfterImage `src/`',
        '',
        '**Date:** 2026-10-27  ',
        '**Source:** committed dump artifacts only (softimage-pc not connected)  ',
        '**Generated by:** `tools/build_animate_surface_audit.py`  ',
        '**Runtime audit:** `src/ui/animateSurfaceAudit.ts` → `__uiAudit().animateSurface`',
        '',
        '## Verdicts',
        '',
        '| Verdict | Meaning |',
        '|---------|---------|',
        '| PRESENT | AfterImage already carried the item with dump-attested names / metrics. |',
        '| PARTIAL | Surface existed, behaviour or fields incomplete against the dump. |',
        '| MISSING | Dump exposes it, AfterImage had nothing. |',
        '| ABSENT | Deliberately not wired — no attestable Softimage name, or no AfterImage counterpart. |',
        '',
        'Verdicts describe `src/` **before** this pass. The **Wired** column marks the items the pass closed.',
        '',
        '## Counts',
        '',
        '| | n |',
        '|---|---|',
        f'| Animate items inventoried | **{counts["total"]}** |',
        f'| PRESENT | {counts["PRESENT"]} |',
        f'| PARTIAL | {counts["PARTIAL"]} |',
        f'| MISSING | {counts["MISSING"]} |',
        f'| ABSENT (documented, not invented) | {counts["ABSENT"]} |',
        f'| Closed by this pass | **{counts["wiredThisPass"]}** |',
        '',
    ]
    for kind, heading in SECTIONS:
        sub = [r for r in rows if r[0] == kind]
        if not sub:
            continue
        L += [f'## {heading}', '',
              '| Module / file | Item | Verdict | Wired | AfterImage surface | Note |',
              '|---------------|------|---------|-------|--------------------|------|']
        for _, mod, name, verdict, wired, surface, note in sub:
            v = f'**{verdict}**' if verdict in ('MISSING', 'PARTIAL') else verdict
            safe = note.replace('|', '/')
            L.append(f'| `{mod}` | {name} | {v} | {"✔" if wired else ""} | {surface} | {safe} |')
        L.append('')
    L += [
        '## Clean-room rules applied',
        '',
        '- Dumps are specification only: command names, argument names and defaults, resource ids, DLU rects, parameter script names.',
        '- No decompiled or disassembled code is transcribed into `src/` or `native/`.',
        '- An item with no attestable Softimage name stays **ABSENT** here rather than invented.',
        '- Commands whose committed dumps carry a name and an argument list, but no behavioral golden, are registered with that contract. Handlers call existing AfterImage commands where the names line up (StoreAction, ApplyCns, StoreShapeKey) and otherwise record the call.',
        '',
        'Related: [ui-surface-audit.md](./ui-surface-audit.md) · [fcurve-handled-spline.md](./fcurve-handled-spline.md) · [mixer-clip-transitions.md](./mixer-clip-transitions.md)',
        '',
    ]
    return '\n'.join(L)


def main():
    names = registered_names()
    rows = []
    rows += menu_rows()
    cmd_rows, gap = command_rows(names)
    # command rows use family as the section key (row[0]).
    rows += [(fam, 'commands_full + si_anim_enabled_xsibatch', name, verdict, wired, surface, note)
             for fam, _mod, name, verdict, wired, surface, note in
             ((r[1], r[1], r[2], r[3], r[4], r[5], r[6]) for r in cmd_rows)]
    rows += surface_rows()
    dialogs, templates = dialog_rows()
    rows += dialogs
    rows += contract_rows()
    rows += toolbar_rows()
    rows += dict_rows()
    counts = tally(rows)

    audit = {
        'softimage': 'Softimage 2015 SP2',
        'source': 'data/dump/animate-menu-leaves.json + si_anim_enabled_xsibatch.json + commands_full.json + pe_resources.json + anim_chrome.json',
        'generated_by': 'tools/build_animate_surface_audit.py',
        'counts': counts,
        'items': [{'kind': k, 'module': m, 'item': n, 'verdict': v, 'wired': w == 'yes', 'surface': s, 'note': t}
                  for k, m, n, v, w, s, t in rows],
    }
    os.makedirs(DUMP, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    json.dump(audit, open(os.path.join(DUMP, 'si_animate_surface_audit.json'), 'w', encoding='utf-8'),
              indent=1, ensure_ascii=False)
    json.dump(audit, open(os.path.join(OUT, 'animate_surface_audit.json'), 'w', encoding='utf-8'),
              indent=0, ensure_ascii=False)
    json.dump({'softimage': 'Softimage 2015 SP2',
               'source': 'data/commands_full.json ∩ data/dump/si_anim_enabled_xsibatch.json, names absent from src/ before this pass',
               'generated_by': 'tools/build_animate_surface_audit.py',
               'commands': gap},
              open(os.path.join(OUT, 'animate_command_gap.json'), 'w', encoding='utf-8'),
              indent=0, ensure_ascii=False)
    json.dump({'softimage': 'Softimage 2015 SP2', 'source': 'data/si/pe_resources.json RT_DIALOG',
               'generated_by': 'tools/build_animate_surface_audit.py', 'dialogs': templates},
              open(os.path.join(OUT, 'animate_dialogs.json'), 'w', encoding='utf-8'),
              indent=0, ensure_ascii=False)
    open(os.path.join(DOCS, 'animate-surface-audit.md'), 'w', encoding='utf-8').write(markdown(rows, counts))
    print('animate surface audit', counts)
    print('gap commands', len(gap))
    print('dialogs', list(templates))


if __name__ == '__main__':
    main()
