#!/usr/bin/env python3
"""Compare the Softimage command sweep (tools/si_command_sweep.js -> si_command_sweep.jsonl) with the AfterImage sweep
(tools/sweep_all_commands.mjs -> docs/re/sweep_afterimage.json) and write docs/re/SWEEP_DIFF.md.

Usage: python3 tools/diff_command_sweep.py [si_command_sweep.jsonl] [docs/re/sweep_afterimage.json]
Without a Softimage file it writes the AfterImage-only report (what is unregistered / placeholder / silent / crashing).
"""
import json, sys, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
si_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != '-' else None
ai_path = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'docs/re/sweep_afterimage.json'
ai = json.loads(ai_path.read_text())['results']
si = {}
if si_path and si_path.exists():
    for line in si_path.read_text(encoding='utf-8', errors='replace').splitlines():
        line = line.strip()
        if line:
            r = json.loads(line); si[r['name']] = r

AI_GAP = {'unregistered', 'crash', 'hang', 'placeholder', 'silent'}
rows = collections.defaultdict(list)
for name in sorted(set(ai) | set(si)):
    a, s = ai.get(name), si.get(name)
    ac = a['cls'] if a else 'not_in_dump'
    if not s:
        if si: rows['only in commands_full.json (not in this Softimage install\'s Application.Commands)'].append((name, ac, ''))
        elif ac in AI_GAP: rows[f'AfterImage: {ac}'].append((name, ac, (a.get('err') or '; '.join(a.get('logs', [])))[:140]))
        continue
    sc = s['cls']
    if not a:
        rows['in Softimage, absent from data/commands_full.json'].append((name, '-', sc)); continue
    if sc != 'ran':
        if ac in ('ok',): rows['Softimage fails with defaults, AfterImage succeeds (check)'].append((name, ac, s.get('err', sc)[:140]))
        continue
    # Softimage ran it
    if ac in AI_GAP or ac in ('precondition', 'status_fail'):
        rows[f'GAP: Softimage runs it, AfterImage {ac}'].append((name, ac, (a.get('err') or '; '.join(a.get('logs', [])))[:140]))
        continue
    e = a.get('effect', {})
    if (s.get('objs', 0) != 0) != (e.get('objs', 0) != 0):
        rows['effect differs: object count'].append((name, f"AI {e.get('objs', 0):+d}", f"SI {s.get('objs', 0):+d}"))
    elif s.get('selAfter', '') != e.get('selAfter', s.get('selAfter', '')):
        rows['effect differs: selection after'].append((name, f"AI [{e.get('selAfter', '')}]", f"SI [{s.get('selAfter', '')}]"))

out = ['# Command sweep diff', '',
       f'AfterImage sweep: `{ai_path.relative_to(ROOT) if ai_path.is_relative_to(ROOT) else ai_path}` ({len(ai)} commands). '
       + (f'Softimage sweep: `{si_path.name}` ({len(si)} commands).' if si else
          'No Softimage sweep yet: run `tools/si_command_sweep.js` in Softimage 2015 SP2 (XSIBATCH) and pass its .jsonl.'), '',
       'Every command is run with its default arguments on the ?demo starter scene (cube selected), then undone. '
       '"silent" means no undo entry, return value, log line, selection / DOM / module / scene change or UI event was seen; '
       'viewport-camera and preference changes are not observed, so a silent command is a lead, not proof of a gap.', '']
counts = collections.Counter(r['cls'] for r in ai.values())
out += ['| AfterImage class | Commands |', '|---|---:|'] + [f'| {k} | {v} |' for k, v in counts.most_common()] + ['']
for sec in sorted(rows, key=lambda k: (not k.startswith('GAP'), not k.startswith('AfterImage: unreg'), k)):
    items = rows[sec]
    out += [f'## {sec} ({len(items)})', '', '| Command | AfterImage | Detail |', '|---|---|---|']
    out += [f"| `{n}` | {a} | {d.replace('|', '/')} |" for n, a, d in items] + ['']
(ROOT / 'docs/re/SWEEP_DIFF.md').write_text('\n'.join(out) + '\n', encoding='utf-8')
print({k: len(v) for k, v in rows.items()})
