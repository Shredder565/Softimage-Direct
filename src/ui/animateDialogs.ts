// mcp.dll RT_DIALOG 220 "Current Time" — DLU rects and control ids from the committed PE resource.
// Radios are untitled; each one is paired with the nearest FRAME / SECOND / MILLISECOND static.
import dialogs from '../data/si/animate_dialogs.json';
import { App } from '../core/commands';
import { animChrome } from './animChrome';
import { openFloating } from './floating';

export type TimeUnit = 'FRAME' | 'SECOND' | 'MILLISECOND';

type DialogControl = { cls?: string; text?: string; id?: number; dlu?: number[]; style?: number };
type CurrentTimeDialog = {
  title: string;
  rectDlu: number[];
  font: [number, string];
  controls: DialogControl[];
};

export const CURRENT_TIME_DIALOG = (dialogs as unknown as { dialogs: Record<string, CurrentTimeDialog> }).dialogs['mcp.dll#220'];

const UNITS: TimeUnit[] = ['FRAME', 'SECOND', 'MILLISECOND'];

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

function nearestUnit(y: number, statics: DialogControl[]): TimeUnit {
  let best: TimeUnit = 'FRAME';
  let dist = Infinity;
  for (const s of statics) {
    if (!UNITS.includes(s.text as TimeUnit)) continue;
    const dy = Math.abs((s.dlu?.[1] ?? 0) - y);
    if (dy < dist) { dist = dy; best = s.text as TimeUnit; }
  }
  return best;
}

/** Open the attested Current Time dialog. OK writes AnimationManager.timeUnit. */
export function openCurrentTimeDialog(app: App) {
  const d = CURRENT_TIME_DIALOG;
  if (!d) return;
  const sx = animChrome.scale.dlu_to_px_x;
  const sy = animChrome.scale.dlu_to_px_y;
  const [,, dw, dh] = d.rectDlu;
  openFloating(d.title, (body, win) => {
    body.style.position = 'relative';
    body.style.height = '100%';
    body.style.fontFamily = `"${d.font[1]}", Tahoma, sans-serif`;
    body.style.fontSize = `${d.font[0]}pt`;
    let picked: TimeUnit = app.anim.timeUnit;
    const statics = d.controls.filter(c => c.cls === 'static' && c.text);
    const place = (el: HTMLElement, box: number[] | undefined) => {
      if (!box) return;
      el.style.position = 'absolute';
      el.style.left = `${box[0] * sx}px`;
      el.style.top = `${box[1] * sy}px`;
      el.style.width = `${box[2] * sx}px`;
      el.style.height = `${box[3] * sy}px`;
    };
    for (const c of d.controls) {
      if (c.cls === 'static' && c.text) {
        const lab = document.createElement('div');
        lab.textContent = c.text;
        place(lab, c.dlu);
        body.appendChild(lab);
        continue;
      }
      if (c.cls !== 'button') continue;
      if (!c.text && (c.id === 282 || c.id === 283 || c.id === 284)) {
        const unit = nearestUnit(c.dlu?.[1] ?? 0, statics);
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'current-time-unit';
        radio.title = unit;
        radio.checked = unit === picked;
        radio.style.margin = '0';
        place(radio, c.dlu);
        radio.onchange = () => { picked = unit; };
        body.appendChild(radio);
        continue;
      }
      const b = document.createElement('button');
      b.textContent = c.text || '';
      place(b, c.dlu);
      b.onclick = () => {
        if (c.id === 1 || c.text === 'OK') {
          app.anim.timeUnit = picked;
          app.events.emit('frame');
        }
        win.close();
      };
      body.appendChild(b);
    }
  }, { w: dw * sx, h: dh * sy, key: 'mcp.dll#220' });
}
