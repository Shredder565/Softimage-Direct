// Softimage CrowdFX ICE menubar submenu flyouts — closer95 DUMP_READY + PE MENU 303.
// Desktop LIVE hover attempt + menu_candidates attested; PE leaf = Anchor-to-Delete insertion marker;
// factory RegisterMenu Names DUMP_READY (softimage-anchor-compounds-ghidra-tour).
// data/dump/si_crowdfx_submenu_flyouts.json → src/data/si/crowdfx_submenu_flyouts.json.
import flyouts from '../data/si/crowdfx_submenu_flyouts.json';
import menus from '../data/menus.json';

type MenuItem = { label?: string; id?: number; items?: MenuItem[]; separator?: boolean };
type FlyMeta = {
  section: string;
  button: string;
  pe_menu_id: number;
  item_count: number;
  items: { label: string; id?: number }[];
  compound_leaves: string;
  factory_menu_names?: string[];
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

/** Compact audit — PE Anchor-to-Delete insertion marker + nested factory_menu_names DUMP_READY. */
export function crowdFxSubmenuFlyoutsAudit(): Record<string, unknown> {
  const mismatches: string[] = [];
  const checked: { key: string; pe: number; wired: number; leaf: string | null }[] = [];
  for (const [key, meta] of Object.entries(FLY.flyouts)) {
    const node = findCrowdFxButton(meta.button);
    const kids = node?.items ?? [];
    const anchor = kids.find(k => (k.label ?? '') === 'Anchor-to-Delete') ?? kids[0];
    const fillLabels = (anchor?.items ?? []).map(c => c.label ?? '').filter(Boolean);
    const wantFills = meta.factory_menu_names
      ?? (meta.items ?? []).map(i => i.label).filter(l => l !== 'Anchor-to-Delete');
    const leaf = anchor?.label ?? null;
    const peId = anchor?.id;
    checked.push({ key, pe: meta.pe_menu_id, wired: fillLabels.length, leaf });
    if (!node) mismatches.push(`${key}:missing`);
    else if (kids.length !== 1 || leaf !== 'Anchor-to-Delete') {
      mismatches.push(`${key}:leaf want=Anchor-to-Delete nest got=${kids.map(k => k.label).join('|')}`);
    } else if (peId !== meta.pe_menu_id) mismatches.push(`${key}:id want=${meta.pe_menu_id} got=${peId}`);
    else if (JSON.stringify(fillLabels) !== JSON.stringify(wantFills)) {
      mismatches.push(`${key}:fills want=${wantFills.length} got=${fillLabels.length}`);
    } else if (meta.compound_leaves !== 'DUMP_READY') mismatches.push(`${key}:compounds want DUMP_READY`);
  }
  const ok = mismatches.length === 0
    && FLY.status === 'DUMP_READY'
    && FLY.desktop.board === 'DUMP_READY'
    && FLY.summary.compound_leaves === 'DUMP_READY'
    && FLY.summary.submenu_live_compounds === true;
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
