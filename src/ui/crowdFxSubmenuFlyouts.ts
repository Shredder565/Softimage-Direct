// Softimage CrowdFX ICE menubar submenu flyouts — closer95 DUMP_READY + PE MENU 303.
// Desktop LIVE hover attempt + menu_candidates attested; PE leaf = Anchor-to-Delete only (no invent compounds).
// data/dump/si_crowdfx_submenu_flyouts.json → src/data/si/crowdfx_submenu_flyouts.json.
import flyouts from '../data/si/crowdfx_submenu_flyouts.json';
import menus from '../data/menus.json';

type MenuItem = { label?: string; id?: number; items?: MenuItem[]; separator?: boolean };
type FlyMeta = {
  section: string;
  button: string;
  pe_menu_id: number;
  item_count: number;
  items: { label: string; id: number }[];
  compound_leaves: string;
};

const FLY = flyouts as {
  softimage: string;
  lock_id: string;
  status: string;
  utc: string;
  desktop: {
    board: string;
    details: string;
    screenshot: string;
    path: string[];
    buttons: string[];
    menubar_dx_attested: number;
  };
  pe: { menu_id: number; module: string; group: string };
  flyouts: Record<string, FlyMeta>;
  summary: {
    flyout_count: number;
    leaf_labels: string[];
    compound_leaves: string;
    submenu_live_compounds: boolean;
  };
};
const MENUS = menus as Record<string, MenuItem[]>;

function findCrowdFxButton(button: string): MenuItem | undefined {
  for (const top of MENUS.ICE ?? []) {
    if (top.label !== 'CrowdFX') continue;
    for (const sub of top.items ?? []) {
      if (sub.label === button) return sub;
    }
  }
  return undefined;
}

/** Compact audit — PE Anchor-to-Delete flyouts match menus.json ICE CrowdFX; compounds LOCK. */
export function crowdFxSubmenuFlyoutsAudit(): Record<string, unknown> {
  const mismatches: string[] = [];
  const checked: { key: string; pe: number; wired: number; leaf: string | null }[] = [];
  for (const [key, meta] of Object.entries(FLY.flyouts)) {
    const node = findCrowdFxButton(meta.button);
    const kids = node?.items ?? [];
    const wired = kids.length;
    const leaf = kids[0]?.label ?? null;
    const peId = kids[0]?.id;
    checked.push({ key, pe: meta.item_count, wired, leaf });
    if (!node) mismatches.push(`${key}:missing`);
    else if (wired !== meta.item_count) mismatches.push(`${key}:pe=${meta.item_count}/wired=${wired}`);
    else if (leaf !== 'Anchor-to-Delete') mismatches.push(`${key}:leaf=${leaf}`);
    else if (peId !== meta.pe_menu_id) mismatches.push(`${key}:id want=${meta.pe_menu_id} got=${peId}`);
    else if (meta.compound_leaves !== 'LOCK') mismatches.push(`${key}:compounds must LOCK`);
  }
  const ok = mismatches.length === 0
    && FLY.status === 'DUMP_READY'
    && FLY.desktop.board === 'DUMP_READY'
    && FLY.summary.compound_leaves === 'LOCK'
    && FLY.summary.submenu_live_compounds === false;
  return {
    lockId: FLY.lock_id,
    status: ok ? 'WIRED' : 'MISMATCH',
    dumpStatus: FLY.status,
    desktopBoard: FLY.desktop.board,
    desktopDetails: FLY.desktop.details,
    softimage: FLY.softimage,
    peMenuId: FLY.pe.menu_id,
    path: FLY.desktop.path,
    buttons: FLY.desktop.buttons,
    screenshot: FLY.desktop.screenshot,
    menubarDx: FLY.desktop.menubar_dx_attested,
    flyoutCount: checked.length,
    leafLabels: FLY.summary.leaf_labels,
    compoundLeaves: FLY.summary.compound_leaves,
    submenuLiveCompounds: FLY.summary.submenu_live_compounds,
    mismatches,
    checked,
  };
}
