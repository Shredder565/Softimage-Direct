/** FROST Experimental Render view — Softimage-density chrome, clearly Experimental. */

import type { App } from '../core/commands';
import {
  FROST_AOV_CATALOG,
  type FrostAovId,
  type FrostExperimentalRenderSettings,
  type FrostRenderDevice,
  type FrostRenderMode,
  applyFrostResolution,
  defaultFrostExperimentalSettings,
  frostResolutionChoices,
  frostSamplesForMode,
  frostSettingsPresetLabel,
  runFrostExperimentalRender,
} from './experimentalRender';
import { frostOf } from './session';

const el = (tag: string, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

function row(label: string, ctl: HTMLElement) {
  const r = el('div', 'frost-xr-row');
  r.append(el('label', '', label), ctl);
  return r;
}

export function frostExperimentalRenderView(app: App, host: HTMLElement) {
  const frost = frostOf(app);
  if (!(frost as any).experimentalRender) {
    (frost as any).experimentalRender = defaultFrostExperimentalSettings(app);
  }
  let settings: FrostExperimentalRenderSettings = (frost as any).experimentalRender;

  const root = el('div', 'frost-xr');
  host.appendChild(root);

  const render = () => {
    (frost as any).experimentalRender = settings;
    root.innerHTML = '';

    const head = el('div', 'frost-xr-head');
    head.appendChild(el('div', 'frost-xr-title', 'Experimental Render'));
    head.appendChild(el('div', 'frost-xr-sub', 'FROST tab 7 · 2026 hybrid / path-trace inspired · not Softimage Render 1:1'));
    root.appendChild(head);

    const banner = el('div', 'frost-xr-banner', 'EXPERIMENTAL — Softimage Render Manager (.pic / .mp4) is unchanged. Flipbook capped ≤16 @ ≤480px.');
    root.appendChild(banner);

    const body = el('div', 'frost-xr-body');

    // Mode
    const modeSel = document.createElement('select');
    modeSel.className = 'frost-xr-select';
    for (const [v, lab] of [['hybrid', 'Hybrid Preview (lookdev)'], ['pathtrace', 'Path-Traced (progressive)']] as const) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = lab;
      if (settings.mode === v) o.selected = true;
      modeSel.appendChild(o);
    }
    modeSel.onchange = () => {
      settings = {
        ...settings,
        mode: modeSel.value as FrostRenderMode,
        samples: modeSel.value === 'hybrid' ? Math.min(settings.samples, 64) : Math.max(settings.samples, 64),
      };
      render();
    };
    body.appendChild(row('Integrator', modeSel));

    // Device
    const devSel = document.createElement('select');
    devSel.className = 'frost-xr-select';
    for (const [v, lab] of [['auto', 'Auto'], ['gpu', 'GPU (viewport capture)'], ['cpu', 'CPU (progressive software)']] as const) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = lab;
      if (settings.device === v) o.selected = true;
      devSel.appendChild(o);
    }
    devSel.onchange = () => {
      settings = { ...settings, device: devSel.value as FrostRenderDevice };
      render();
    };
    body.appendChild(row('Device', devSel));

    // Samples
    const sampWrap = el('div', 'frost-xr-samp');
    const samp = document.createElement('input');
    samp.type = 'range';
    samp.min = '4';
    samp.max = settings.mode === 'hybrid' ? '64' : '512';
    samp.step = '4';
    samp.value = String(frostSamplesForMode(settings.mode, settings.samples));
    samp.className = 'frost-xr-range';
    const sampVal = el('span', 'frost-xr-val', `${frostSamplesForMode(settings.mode, settings.samples)} spp`);
    samp.oninput = () => {
      settings = { ...settings, samples: Number(samp.value) };
      sampVal.textContent = `${settings.samples} spp`;
    };
    sampWrap.append(samp, sampVal);
    body.appendChild(row('Progressive Samples', sampWrap));

    // Denoise
    const denoiseLab = el('label', 'frost-xr-check');
    const denoiseCb = document.createElement('input');
    denoiseCb.type = 'checkbox';
    denoiseCb.checked = settings.denoise;
    denoiseCb.onchange = () => {
      settings = { ...settings, denoise: denoiseCb.checked };
      render();
    };
    denoiseLab.append(denoiseCb, document.createTextNode(' Denoise (OIDN/OptiX-inspired)'));
    body.appendChild(denoiseLab);

    const guidesLab = el('label', 'frost-xr-check');
    const guidesCb = document.createElement('input');
    guidesCb.type = 'checkbox';
    guidesCb.checked = settings.denoiseGuides;
    guidesCb.disabled = !settings.denoise;
    guidesCb.onchange = () => {
      settings = { ...settings, denoiseGuides: guidesCb.checked };
    };
    guidesLab.append(guidesCb, document.createTextNode(' Denoise guides (Albedo + Normal)'));
    body.appendChild(guidesLab);

    // AOVs
    body.appendChild(el('div', 'frost-xr-label', 'AOVs / Passes'));
    const aovGrid = el('div', 'frost-xr-aovs');
    for (const a of FROST_AOV_CATALOG) {
      const lab = el('label', 'frost-xr-aov');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = settings.aovs.includes(a.id);
      if (a.id === 'beauty') cb.disabled = true;
      cb.onchange = () => {
        const set = new Set(settings.aovs);
        if (cb.checked) set.add(a.id);
        else set.delete(a.id);
        set.add('beauty');
        settings = { ...settings, aovs: [...set] as FrostAovId[] };
      };
      lab.append(cb, document.createTextNode(` ${a.label}${a.utility ? ' *' : ''}`));
      aovGrid.appendChild(lab);
    }
    body.appendChild(aovGrid);
    body.appendChild(el('div', 'frost-xr-hint', '* utility passes also feed denoise guides when enabled'));

    // Resolution
    const resSel = document.createElement('select');
    resSel.className = 'frost-xr-select';
    for (const p of frostResolutionChoices()) {
      const o = document.createElement('option');
      o.value = String(p.value);
      o.textContent = p.label;
      resSel.appendChild(o);
    }
    const cur = frostSettingsPresetLabel(settings);
    const match = frostResolutionChoices().find(p => p.label === cur);
    resSel.value = String(match?.value ?? 18);
    resSel.onchange = () => {
      settings = applyFrostResolution(settings, Number(resSel.value));
      render();
    };
    body.appendChild(row('Output Size', resSel));
    body.appendChild(el('div', 'frost-xr-hint', `${settings.width}×${settings.height} · product 2K/4K available · no Softimage .pic mutation`));

    // Movie format (sidecar label only)
    const movSel = document.createElement('select');
    movSel.className = 'frost-xr-select';
    for (const [v, lab] of [['mp4', 'MP4 (.mp4) sidecar label'], ['avi', 'AVI (.avi) sidecar label'], ['none', 'Stills / Flipbook only']] as const) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = lab;
      if (settings.movieFormat === v) o.selected = true;
      movSel.appendChild(o);
    }
    movSel.onchange = () => {
      settings = { ...settings, movieFormat: movSel.value as any };
    };
    body.appendChild(row('Movie (label)', movSel));

    // Frame range
    const fs = document.createElement('input');
    fs.type = 'number';
    fs.className = 'frost-xr-num';
    fs.value = String(settings.frameStart);
    fs.onchange = () => { settings = { ...settings, frameStart: Number(fs.value) }; };
    const fe = document.createElement('input');
    fe.type = 'number';
    fe.className = 'frost-xr-num';
    fe.value = String(settings.frameEnd);
    fe.onchange = () => { settings = { ...settings, frameEnd: Number(fe.value) }; };
    const fr = el('div', 'frost-xr-frames');
    fr.append(fs, el('span', '', ' → '), fe);
    body.appendChild(row('Frame Range', fr));
    body.appendChild(el('div', 'frost-xr-hint', 'Sequence Flipbook capped at 16 frames (v1.0.23 freeze fix). Softimage Render path untouched.'));

    root.appendChild(body);

    const foot = el('div', 'frost-xr-foot');
    const goFrame = el('button', 'xp-btn frost-xr-primary', 'Render Current Frame') as HTMLButtonElement;
    goFrame.title = 'Progressive beauty (+ AOVs) for the playhead frame';
    goFrame.onclick = () => {
      (frost as any).experimentalRender = settings;
      runFrostExperimentalRender(app, settings, { currentFrameOnly: true, openFlipbook: true });
      status();
    };
    const goRange = el('button', 'xp-btn', 'Render Frame Range') as HTMLButtonElement;
    goRange.title = 'Flipbook-capped progressive sequence';
    goRange.onclick = () => {
      (frost as any).experimentalRender = settings;
      runFrostExperimentalRender(app, settings, { currentFrameOnly: false, openFlipbook: true });
      status();
    };
    const usdBtn = el('button', 'xp-btn', 'Export USD Stub') as HTMLButtonElement;
    usdBtn.title = 'Download minimal USDA describing settings + plate paths (Hydra-friendly stub)';
    usdBtn.onclick = () => {
      (frost as any).experimentalRender = settings;
      const res = runFrostExperimentalRender(app, settings, { currentFrameOnly: true, openFlipbook: false });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([res.usdStub], { type: 'text/plain' }));
      a.download = 'frost-experimental-render.usda';
      a.click();
      app.logMsg('info', 'FROST Experimental: USD stub downloaded');
      status();
    };
    foot.append(goFrame, goRange, usdBtn);
    root.appendChild(foot);

    const stats = el('div', 'frost-xr-stats');
    root.appendChild(stats);
    const status = () => {
      const last = (app as any).lastFrostExperimentalRender;
      const spp = frostSamplesForMode(settings.mode, settings.samples);
      stats.textContent = last?.ok
        ? `Last: ${last.plates.length} plates · ${last.flipbookFrames.length} Flipbook · ${last.settings.mode} ${last.settings.samples}spp · denoise=${last.settings.denoise}`
        : `Ready · ${settings.mode} · ${spp} spp · ${settings.aovs.join('+')} · device=${settings.device}`;
    };
    status();
  };

  render();
}
