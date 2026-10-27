// mcp.dll RT_DIALOG 220 "Current Time" — the committed PE template (title, DLU, font, control ids).
// The dialog itself is opened from the playback frame by currentTimeDialog() in siDialogWire.ts,
// which renders this same template. This module keeps the inventory the animate audit checks,
// plus the frame/second/millisecond conversion the playback field and that dialog share.
import dialogs from '../data/si/animate_dialogs.json';

export type TimeUnit = 'FRAME' | 'SECOND' | 'MILLISECOND';

type DialogControl = { cls?: string; text?: string; id?: number; dlu?: number[]; style?: number };
type CurrentTimeDialog = {
  title: string;
  rectDlu: number[];
  font: [number, string];
  controls: DialogControl[];
};

export const CURRENT_TIME_DIALOG = (dialogs as unknown as { dialogs: Record<string, CurrentTimeDialog> }).dialogs['mcp.dll#220'];

export function formatCurrentTime(frame: number, fps: number, unit: TimeUnit): string {
  if (unit === 'SECOND') return (frame / fps).toFixed(3);
  if (unit === 'MILLISECOND') return String(Math.round((frame / fps) * 1000));
  return String(frame);
}

export function parseCurrentTime(text: string, fps: number, unit: TimeUnit): number {
  const n = Number(text);
  if (!Number.isFinite(n)) return NaN;
  if (unit === 'SECOND') return Math.round(n * fps);
  if (unit === 'MILLISECOND') return Math.round((n / 1000) * fps);
  return n;
}
