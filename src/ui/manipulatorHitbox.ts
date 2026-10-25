// Softimage manipulator hit targets — PE-attested menus 530–532 + RT_BITMAP W/H only.
// Interactive 3D gizmo hover-only px stay LOCK (unlock dump note). Built from
// data/dump/si_manipulator_hitbox.json → src/data/si/manipulator_hitbox.json.
import hitbox from '../data/si/manipulator_hitbox.json';

export type ManipHitbox = typeof hitbox;

export const MANIP_HITBOX = hitbox as ManipHitbox;

/** Softimage XSI.exe toolbar-cell RT_BITMAP W/H (DELETE_/DOWN_ sample) — attested 24×24. */
export const MANIP_TOOLBAR_CELL_WH = MANIP_HITBOX.toolbarCellWh as { w: number; h: number };

/** Unit-space half-extent of the yellow centre square (matches viewManager PlaneGeometry). */
export const MANIP_CENTRE_UNIT_HALF = Number(MANIP_HITBOX.centreSquareUnitHalf ?? 0.09);

/** Clean-room plane/axis pick slop (LOCK — not Softimage PE hover px). */
export const MANIP_CLEAN_ROOM_PLANE_EDGE_PX = Number(
  (MANIP_HITBOX.interactiveHoverPx as { cleanRoomPlaneEdgePx?: number })?.cleanRoomPlaneEdgePx ?? 9,
);
export const MANIP_CLEAN_ROOM_AXIS_PX = Number(
  (MANIP_HITBOX.interactiveHoverPx as { cleanRoomAxisPx?: number })?.cleanRoomAxisPx ?? 7,
);

/** viewinteraction.dll RT_MENU ids wired to Direct tool* trees. */
export const MANIP_PE_MENUS = MANIP_HITBOX.menus as Record<
  string,
  { id: number; title: string; pe: string; rva: number; size: number; directTool: string }
>;

/** Compact audit for __uiAudit / ui_smoke — menus + bitmap W/H; hover LOCK explicit. */
export function manipulatorHitboxAudit(): Record<string, unknown> {
  const menus = Object.values(MANIP_PE_MENUS);
  const sample = MANIP_HITBOX.bitmapWhSample as { id: string | number; w: number; h: number }[];
  const toolbar = MANIP_HITBOX.toolbarCellBitmaps as string[];
  const hover = MANIP_HITBOX.interactiveHoverPx as { status: string; note: string };
  return {
    lockId: MANIP_HITBOX.lock_id,
    softimage: MANIP_HITBOX.softimage,
    menusOk:
      menus.length === 3 &&
      menus.every(m => [530, 531, 532].includes(m.id)) &&
      MANIP_PE_MENUS['530']?.size === 250 &&
      MANIP_PE_MENUS['531']?.size === 256 &&
      MANIP_PE_MENUS['532']?.size === 256,
    menus: menus.map(m => ({ id: m.id, title: m.title, size: m.size, tool: m.directTool })),
    bitmapWhCount: MANIP_HITBOX.bitmapWhCount,
    bitmapWhSampleCount: sample.length,
    toolbarCellWh: { ...MANIP_TOOLBAR_CELL_WH },
    toolbarCellBitmaps: toolbar,
    toolbarCellOk:
      MANIP_TOOLBAR_CELL_WH.w === 24 &&
      MANIP_TOOLBAR_CELL_WH.h === 24 &&
      toolbar.length >= 10 &&
      sample.filter(s => s.w === 24 && s.h === 24).length >= 10,
    centreSquareUnitHalf: MANIP_CENTRE_UNIT_HALF,
    interactiveHoverPx: hover.status,
    interactiveHoverNote: hover.note,
  };
}
