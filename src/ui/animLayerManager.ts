// Softimage Animation Layer Manager — dump-backed chrome (PE views + Mixer OM).
// Not a scene-layer panel: surfaces mixer tracks / clips / additive layers.
import { App } from '../core/commands';
import { mixerOf, syncMixer } from '../core/scene';
import { animChrome } from './animChrome';

const el = (tag: string, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const btn = (label: string, title: string, fn: () => void) => {
  const b = el('button', 'xp-btn', label) as HTMLButtonElement;
  b.title = title;
  b.onclick = fn;
  return b;
};

export function animationLayerManager(app: App, host: HTMLElement) {
  const root = el('div', 'anim-layer-mgr');
  host.appendChild(root);
  const L = animChrome.layout;

  const render = () => {
    root.innerHTML = '';
    const hd = el('div', 'alm-head');
    hd.append(
      el('div', 'mcp-title', 'Animation Layer Manager'),
      btn('Mixer…', 'Open Animation Mixer', () => window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'Animation Mixer' } }))),
      btn('Store', 'Store Action as layer source', () => {
        app.run('StoreAction', { Name: prompt('Layer / action name:', 'Layer') || 'Layer', AddClip: true });
        render();
      }),
      btn('Refresh', 'Refresh layers', render),
    );
    root.appendChild(hd);

    const hostModel = app.selectedObjects[0]?.model ?? app.scene.root;
    const mix = mixerOf(hostModel as any);
    syncMixer(mix);
    const tracks: any[] = JSON.parse(mix.val('tracks') || '[]');
    const clips: any[] = (mix as any).clips ?? [];
    const compounds: any[] = (mix as any).compounds ?? [];

    const body = el('div', 'alm-body');
    body.appendChild(el('div', 'alm-hint', `Mixer Active=${!!mix.val('Active')} · tracks ${tracks.length || new Set(clips.map((c: any) => c.track ?? 0)).size} · clips ${clips.length}`));

    if (!clips.length) {
      body.appendChild(el('div', 'alm-hint', 'No animation layer clips. Store Action (AddClip) or open Animation Mixer.'));
    } else {
      const byTrack = new Map<number, any[]>();
      for (const c of clips) {
        const t = c.track ?? 0;
        if (!byTrack.has(t)) byTrack.set(t, []);
        byTrack.get(t)!.push(c);
      }
      for (const [ti, list] of [...byTrack.entries()].sort((a, b) => a[0] - b[0])) {
        const trackRow = el('div', 'alm-track');
        trackRow.appendChild(el('div', 'alm-track-title', `Animation Track ${ti}`));
        for (const c of list) {
          const row = el('div', 'alm-clip' + (c.mute ? ' muted' : '') + (c.additive ? ' additive' : ''));
          const mute = el('input') as HTMLInputElement;
          mute.type = 'checkbox';
          mute.checked = !c.mute;
          mute.title = 'Active';
          mute.onchange = () => {
            app.run('MuteClip', { Clip: c.name, Mute: !mute.checked });
            render();
          };
          const nm = el('span', 'nm', `${c.name} · ${c.source ?? ''} @${c.start} (${c.duration}f)`);
          nm.onclick = () => app.run('SelectObj', { InputObjs: c.source });
          const w = el('input') as HTMLInputElement;
          w.type = 'number';
          w.step = '0.05';
          w.min = '0';
          w.max = '1';
          w.value = String(c.weight ?? 1);
          w.title = 'Layer weight';
          w.style.width = `${L.kp_num_w}px`;
          w.onchange = () => {
            app.run('SetClipWeight', { Clip: c.name, Weight: Number(w.value) });
            render();
          };
          row.append(mute, nm, w);
          trackRow.appendChild(row);
        }
        body.appendChild(trackRow);
      }
    }

    if (compounds.length) {
      body.appendChild(el('div', 'alm-hint', `Compounds: ${compounds.map((c: any) => c.name).join(', ')}`));
    }

    const actions = el('div', 'alm-actions');
    actions.append(
      btn('Add Transition', 'Standard transition between last two clips', () => { app.run('AddTransition'); render(); }),
      btn('Equalize', 'Pack clips end-to-end', () => { app.run('EqualizeClips'); render(); }),
      btn('Evaluate', 'Evaluate mixer at current frame', () => { app.run('EvaluateMixer', { Frame: app.anim.frame, Apply: true }); }),
    );
    body.appendChild(actions);
    root.appendChild(body);
  };

  render();
  app.events.on('scene', render);
  app.events.on('params', render);
  app.events.on('selection', render);
}
