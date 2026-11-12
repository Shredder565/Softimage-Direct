#!/usr/bin/env python3
"""Seed / refresh docs/re/coverage_commands.json and the generated section of
docs/re/COVERAGE_LEDGER.md from the Softimage command registry dump
(data/commands_full.json) and a static scan of names registered in src/.

Static scan only: a command counted as "registered" still needs a golden
compare before its ledger row may be called WIRED."""
import json, re, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
cmds = json.loads((ROOT / "data/commands_full.json").read_text(encoding="utf-8"))

registered = set()
pat = re.compile(r"""(?:\bname:\s*|\breg\(\s*|\bregister\(\s*)['"]([A-Za-z0-9_]+)['"]""")
for p in (ROOT / "src").rglob("*.ts"):
    registered.update(pat.findall(p.read_text(encoding="utf-8", errors="ignore")))
# names that only appear as strings in data-driven command tables
blob = "\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in (ROOT / "src").rglob("*.ts"))

by_cat = collections.defaultdict(lambda: {"total": 0, "registered": 0, "missing": []})
for c in cmds:
    name = c.get("scripting_name") or c.get("name")
    cat = (c.get("category") or "(uncategorised)").split("|")[0].strip() or "(uncategorised)"
    row = by_cat[cat]
    row["total"] += 1
    if name in registered or re.search(r"['\"]%s['\"]" % re.escape(name), blob):
        row["registered"] += 1
    else:
        row["missing"].append(name)

out = {k: {"total": v["total"], "registered": v["registered"], "missing": sorted(v["missing"])}
       for k, v in sorted(by_cat.items())}
(ROOT / "docs/re").mkdir(parents=True, exist_ok=True)
(ROOT / "docs/re/coverage_commands.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")

lines = ["| Row | Area (command category) | Softimage commands | Named in `src/` | Not yet named | Status |",
         "|-----|-------------------------|-------------------:|----------------:|--------------:|--------|"]
order = sorted(out.items(), key=lambda kv: -len(kv[1]["missing"]))
for i, (cat, v) in enumerate(order, 1):
    status = "TODO" if v["missing"] else "AUDIT"
    lines.append(f"| CMD-{i:02d} | {cat} | {v['total']} | {v['registered']} | {len(v['missing'])} | {status} |")
tot = sum(v["total"] for v in out.values()); reg = sum(v["registered"] for v in out.values())
lines.append(f"| | **Total** | **{tot}** | **{reg}** | **{tot - reg}** | |")

led = ROOT / "docs/re/COVERAGE_LEDGER.md"
text = led.read_text(encoding="utf-8")
a, b = "<!-- BEGIN GENERATED: commands -->", "<!-- END GENERATED: commands -->"
text = text[: text.index(a) + len(a)] + "\n" + "\n".join(lines) + "\n" + text[text.index(b):]
led.write_text(text, encoding="utf-8")
print(f"{tot} commands, {reg} named in src, {tot - reg} missing, {len(out)} categories")
