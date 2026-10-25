// Softimage Render MCP press-hold flyout item lists — PE toolbarobj.dll menu 234.
// Desktop tour press-hold did not open menus; PE trees already live in menus.json.
// data/dump/si_render_mcp_flyouts.json → src/data/si/render_mcp_flyouts.json.
import flyouts from '../data/si/render_mcp_flyouts.json';
import menus from '../data/menus.json';

type MenuItem = { label?: string; id?: number; items?: MenuItem[]; separator?: boolean };
type FlyMeta = { section: string; button: string; item_count: number; leaf: boolean };

const FLY = flyouts as {
  meta: { lock_id: string; status: string; pe: string; note: string };
  flyouts: Record<string, FlyMeta>;
  summary: Record<string, { item_count: number; leaf: boolean }>;
};
const MENUS = menus as Record<string, MenuItem[]>;

function findButton(section: string, button: string): MenuItem | undefined {
  for (const top of MENUS.Render ?? []) {
    if (top.label !== section) continue;
    for (const sub of top.items ?? []) {
      if (sub.label === button) return sub;
    }
  }
  return undefined;
}

/** Compact audit — PE flyout item counts match menus.json Render module. */
export function renderMcpFlyoutsAudit(): Record<string, unknown> {
  const mismatches: string[] = [];
  const checked: { key: string; pe: number; wired: number }[] = [];
  for (const [key, meta] of Object.entries(FLY.flyouts)) {
    const [section, button] = key.split('/');
    const node = findButton(section, button);
    const wired = node?.items?.length ?? 0;
    const pe = meta.item_count;
    checked.push({ key, pe, wired });
    if (!node) mismatches.push(`${key}:missing`);
    else if (wired !== pe) mismatches.push(`${key}:pe=${pe}/wired=${wired}`);
    else if (meta.leaf && wired !== 0) mismatches.push(`${key}:expectedLeaf`);
  }
  return {
    lockId: FLY.meta.lock_id,
    status: mismatches.length === 0 ? 'DONE' : 'MISMATCH',
    pe: FLY.meta.pe,
    note: FLY.meta.note,
    flyoutCount: checked.length,
    mismatches,
    checked,
  };
}
