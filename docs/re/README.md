# Full-clone loop: analyst → wire

Two agents (`.claude/agents/`) work the same ledger until every row is `WIRED` or `LOCK`.

| Agent | Sees | Writes |
|-------|------|--------|
| `si-analyst` | Softimage install, REA / Ghidra, XSIBATCH dumps, public docs | `docs/ghidra/*.md`, goldens in `data/dump/`, ledger |
| `afterimage-wire` | specs, goldens, public docs – never binaries or decomp | `src/**`, `native/src/**`, `tools/compare_*.mjs`, ledger |

The split is the project's clean-room rule (`native/docs/POLICY.md`) made structural:
the agent that looks inside Softimage never writes product code, and the agent that
writes product code never looks inside Softimage. Because AfterImage code is original
from the first commit, there is no later "rewrite to original" phase.

## One cycle

1. `si-analyst`: take the top `TODO` row → note + goldens → row becomes `SPEC`.
2. `afterimage-wire`: take the top `SPEC` row → code + compare harness → row becomes `WIRED`.
3. Either agent adds rows for anything new it discovers. Append to `RUN_LOG.md`.

Status values: `TODO` · `SPEC-PARTIAL` · `SPEC` · `WIRE-PARTIAL` · `WIRED` · `LOCK` (attested blocker; say which).

## Machine prerequisites

- Softimage 2015 SP2 installed (default `C:\Program Files\Autodesk\Softimage 2015 SP2`).
- REA MCP server running; Ghidra headless per `docs/ghidra/ghidra-pc-install.md`.
- A local clone of this repository with `npm ci` done, and `gh` authenticated for PRs.
