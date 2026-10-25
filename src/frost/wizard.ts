/** FROST Character Hair Wizard UI — scalp → maps → groom → collide → sim → look. */

import type { App } from '../core/commands';
import type { X3DObject } from '../core/scene';
import { frostOf } from './session';
import {
  HAIR_STEPS,
  applyLengthPreset,
  applySimLook,
  applyWindPreset,
  type HairLengthPreset,
  type SimLookName,
  type WindPresetName,
  type ColliderQuality,
} from './hair';
import type { StyleLayer } from './strands';

const el = (tag: string, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

function meshObjects(app: App): X3DObject[] {
  const out: X3DObject[] = [];
  for (const o of app.scene.allObjects()) {
    if (o.primitive?.mesh?.()) out.push(o);
  }
  return out;
}

function selectField(
  label: string,
  value: string,
  options: { value: string; label: string }[],
  onChange: (v: string) => void,
) {
  const row = el('div', 'frost-wiz-row');
  row.appendChild(el('label', '', label));
  const sel = document.createElement('select');
  sel.className = 'frost-wiz-select';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.onchange = () => onChange(sel.value);
  row.appendChild(sel);
  return row;
}

function sliderField(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (v: number) => void,
) {
  const row = el('div', 'frost-wiz-row');
  const lab = el('label', '', label);
  const val = el('span', 'frost-wiz-val', String(Math.round(value * 100) / 100));
  lab.appendChild(val);
  row.appendChild(lab);
  const inp = document.createElement('input');
  inp.type = 'range';
  inp.min = String(min);
  inp.max = String(max);
  inp.step = String(step);
  inp.value = String(value);
  inp.className = 'frost-wiz-range';
  inp.oninput = () => {
    const n = Number(inp.value);
    val.textContent = String(Math.round(n * 100) / 100);
    onChange(n);
  };
  row.appendChild(inp);
  return row;
}

function chipGroup<T extends string>(
  label: string,
  current: T,
  chips: { id: T; label: string }[],
  onPick: (id: T) => void,
) {
  const wrap = el('div', 'frost-wiz-chips-wrap');
  wrap.appendChild(el('div', 'frost-wiz-label', label));
  const row = el('div', 'frost-wiz-chips');
  for (const c of chips) {
    const b = el('button', 'frost-wiz-chip' + (c.id === current ? ' active' : ''), c.label) as HTMLButtonElement;
    b.type = 'button';
    b.onclick = () => onPick(c.id);
    row.appendChild(b);
  }
  wrap.appendChild(row);
  return wrap;
}

/** Mount the Character Hair Wizard into a host (floating view or toolbar expand). */
export function frostHairWizardView(app: App, host: HTMLElement) {
  const frost = frostOf(app);
  const wiz = frost.ensureHairWizard();
  // Ensure graph matches wizard on open
  if (!frost.isHairGraph()) frost.loadHairRecipe(wiz);

  const root = el('div', 'frost-wiz');
  host.appendChild(root);

  const apply = (opts?: { resetSim?: boolean }) => {
    frost.hair = wiz;
    frost.applyHairWizard();
    if (opts?.resetSim) {
      frost.reset();
      frost.tick(app.anim.frame);
      app.events.emit('scene');
    }
    app.logMsg('info', `FROST Hair: step ${HAIR_STEPS[wiz.step].title}`);
    render();
  };

  const render = () => {
    root.innerHTML = '';
    const head = el('div', 'frost-wiz-head');
    head.appendChild(el('div', 'frost-wiz-title', 'Character Hair'));
    head.appendChild(el('div', 'frost-wiz-sub', 'groom → sim → style · average-user path'));
    root.appendChild(head);

    const steps = el('div', 'frost-wiz-steps');
    HAIR_STEPS.forEach((s, i) => {
      const b = el('button', 'frost-wiz-step' + (i === wiz.step ? ' active' : '') + (i < wiz.step ? ' done' : ''), `${i + 1}. ${s.title}`) as HTMLButtonElement;
      b.type = 'button';
      b.onclick = () => { wiz.step = i; render(); };
      steps.appendChild(b);
    });
    root.appendChild(steps);

    const body = el('div', 'frost-wiz-body');
    const step = HAIR_STEPS[wiz.step];
    body.appendChild(el('h3', 'frost-wiz-h', step.title));
    body.appendChild(el('p', 'frost-wiz-blurb', step.blurb));

    if (wiz.step === 0) {
      const meshes = meshObjects(app);
      body.appendChild(selectField(
        'Scalp mesh',
        wiz.scalpObject,
        [{ value: '', label: '(default crown)' }, ...meshes.map(m => ({ value: m.name, label: m.name }))],
        v => { wiz.scalpObject = v; apply({ resetSim: true }); },
      ));
      body.appendChild(el('p', 'frost-wiz-hint',
        wiz.scalpObject
          ? `Using scene mesh “${wiz.scalpObject}”. Density softens at the border.`
          : 'No scalp picked — strands grow from a procedural crown. Select a head mesh in the scene, then choose it here.'));
      const pickSel = el('button', 'xp-btn frost-wiz-action', 'Use current selection') as HTMLButtonElement;
      pickSel.onclick = () => {
        const o = app.selectedObjects.find(x => x.primitive?.mesh?.());
        if (!o) { app.logMsg('info', 'FROST Hair: select a polygon mesh first'); return; }
        wiz.scalpObject = o.name;
        apply({ resetSim: true });
      };
      body.appendChild(pickSel);
      body.appendChild(chipGroup<HairLengthPreset>(
        'Length preset',
        wiz.lengthPreset,
        [{ id: 'short', label: 'Short' }, { id: 'medium', label: 'Medium' }, { id: 'long', label: 'Long' }],
        id => { applyLengthPreset(wiz, id); apply({ resetSim: true }); },
      ));
    } else if (wiz.step === 1) {
      body.appendChild(sliderField('Density map', wiz.densityMap, 0.2, 1.5, 0.05, v => { wiz.densityMap = v; apply({ resetSim: true }); }));
      body.appendChild(sliderField('Length map', wiz.lengthMap, 0.2, 1.5, 0.05, v => { wiz.lengthMap = v; apply({ resetSim: true }); }));
      body.appendChild(sliderField('Thickness', wiz.thickness, 0.005, 0.06, 0.005, v => { wiz.thickness = v; apply({ resetSim: true }); }));
      body.appendChild(el('p', 'frost-wiz-hint', 'Soft hairline defaults — paint/import maps land later; these scalars stand in for map intensity.'));
    } else if (wiz.step === 2) {
      body.appendChild(el('p', 'frost-wiz-hint', 'Layers stack non-destructively onto rest pose. Mute to compare.'));
      for (const layer of wiz.layers) {
        body.appendChild(layerRow(layer, () => apply({ resetSim: true })));
      }
      const add = el('button', 'xp-btn frost-wiz-action', '+ Add clump layer') as HTMLButtonElement;
      add.onclick = () => {
        wiz.layers.push({
          id: `clump${wiz.layers.length}`,
          name: 'Clump',
          kind: 'clump',
          strength: 0.4,
          muted: false,
        });
        apply({ resetSim: true });
      };
      body.appendChild(add);
    } else if (wiz.step === 3) {
      const meshes = meshObjects(app);
      body.appendChild(selectField(
        'Body collider',
        wiz.bodyObject,
        [{ value: '', label: '(default torso sphere)' }, ...meshes.map(m => ({ value: m.name, label: m.name }))],
        v => { wiz.bodyObject = v; apply(); },
      ));
      const pickSel = el('button', 'xp-btn frost-wiz-action', 'Bind selected mesh') as HTMLButtonElement;
      pickSel.onclick = () => {
        const o = app.selectedObjects.find(x => x.primitive?.mesh?.());
        if (!o) { app.logMsg('info', 'FROST Hair: select a body mesh first'); return; }
        wiz.bodyObject = o.name;
        apply();
      };
      body.appendChild(pickSel);
      body.appendChild(chipGroup<ColliderQuality>(
        'Collider quality',
        wiz.colliderQuality,
        [{ id: 'Preview', label: 'Preview (mesh)' }, { id: 'Playblast', label: 'Playblast (sphere)' }],
        id => { wiz.colliderQuality = id; apply(); },
      ));
    } else if (wiz.step === 4) {
      body.appendChild(chipGroup<WindPresetName>(
        'Wind',
        wiz.windPreset,
        [{ id: 'Calm', label: 'Calm' }, { id: 'Breeze', label: 'Breeze' }, { id: 'Gale', label: 'Gale' }],
        id => { applyWindPreset(wiz, id); apply(); },
      ));
      body.appendChild(chipGroup<SimLookName>(
        'Material look',
        wiz.simLook,
        [{ id: 'Silky', label: 'Silky' }, { id: 'Thick', label: 'Thick' }, { id: 'Wet', label: 'Wet' }],
        id => { applySimLook(wiz, id); apply(); },
      ));
      const mute = el('label', 'frost-wiz-check');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = wiz.simMuted;
      cb.onchange = () => { wiz.simMuted = cb.checked; apply(); };
      mute.append(cb, document.createTextNode(' Mute dynamics (style only)'));
      body.appendChild(mute);
      body.appendChild(el('p', 'frost-wiz-hint', 'Mild wind + body collision on; stretch limit stays enabled.'));
    } else if (wiz.step === 5) {
      body.appendChild(chipGroup<'lines' | 'points'>(
        'Viewport display',
        wiz.displayMode,
        [{ id: 'lines', label: 'Lines (strands)' }, { id: 'points', label: 'Points (tips)' }],
        id => { wiz.displayMode = id; apply(); },
      ));
      body.appendChild(sliderField('Taper', wiz.taper, 0, 1, 0.05, v => { wiz.taper = v; apply(); }));
      body.appendChild(sliderField('Noise', wiz.noise, 0, 1, 0.05, v => { wiz.noise = v; apply(); }));
      body.appendChild(el('p', 'frost-wiz-hint', 'Play the timeline to sim. Reveal Graph ejects this recipe into the FROST Graph editor.'));
    }

    root.appendChild(body);

    // Advanced drawer
    const adv = el('details', 'frost-wiz-adv') as HTMLDetailsElement;
    adv.open = wiz.advancedOpen;
    const sum = el('summary', '', 'Advanced parameters');
    adv.appendChild(sum);
    adv.ontoggle = () => { wiz.advancedOpen = adv.open; };
    const advBody = el('div', 'frost-wiz-adv-body');
    advBody.appendChild(sliderField('Guides', wiz.guideCount, 16, 200, 1, v => { wiz.guideCount = v | 0; apply({ resetSim: true }); }));
    advBody.appendChild(sliderField('Segments', wiz.segments, 3, 16, 1, v => { wiz.segments = v | 0; apply({ resetSim: true }); }));
    advBody.appendChild(sliderField('Length', wiz.length, 0.1, 2.5, 0.05, v => { wiz.length = v; apply({ resetSim: true }); }));
    advBody.appendChild(sliderField('Stiffness', wiz.stiffness, 0.05, 1, 0.01, v => { wiz.stiffness = v; apply(); }));
    advBody.appendChild(sliderField('Damping', wiz.damping, 0.01, 0.5, 0.01, v => { wiz.damping = v; apply(); }));
    advBody.appendChild(sliderField('Stretch limit', wiz.stretchLimit, 1, 1.3, 0.01, v => { wiz.stretchLimit = v; apply(); }));
    advBody.appendChild(sliderField('Iterations', wiz.iterations, 1, 12, 1, v => { wiz.iterations = v | 0; apply(); }));
    advBody.appendChild(sliderField('Gravity Y', wiz.gravity[1], -12, 0, 0.1, v => { wiz.gravity = [wiz.gravity[0], v, wiz.gravity[2]]; apply(); }));
    adv.appendChild(advBody);
    root.appendChild(adv);

    const foot = el('div', 'frost-wiz-foot');
    const back = el('button', 'xp-btn', 'Back') as HTMLButtonElement;
    back.disabled = wiz.step === 0;
    back.onclick = () => { wiz.step = Math.max(0, wiz.step - 1); render(); };
    const next = el('button', 'xp-btn frost-wiz-primary', wiz.step === HAIR_STEPS.length - 1 ? 'Apply & Play' : 'Next') as HTMLButtonElement;
    next.onclick = () => {
      if (wiz.step < HAIR_STEPS.length - 1) { wiz.step++; apply(); }
      else {
        apply();
        try { app.run('PlayForwards'); } catch { app.anim.play(); }
        app.logMsg('info', 'FROST Hair: recipe applied — playing timeline');
      }
    };
    const reveal = el('button', 'xp-btn', 'Reveal Graph') as HTMLButtonElement;
    reveal.title = 'Eject recipe into FROST Graph editor';
    reveal.onclick = () => {
      apply();
      window.dispatchEvent(new CustomEvent('openview', { detail: { name: 'FROST Graph' } }));
    };
    const reset = el('button', 'xp-btn', 'Reset Sim') as HTMLButtonElement;
    reset.onclick = () => {
      frost.reset();
      frost.tick(app.anim.frame);
      app.events.emit('scene');
      render();
    };
    foot.append(back, next, reveal, reset);
    root.appendChild(foot);

    const stats = el('div', 'frost-wiz-stats', frost.status());
    root.appendChild(stats);
  };

  render();
  app.events.on('frame', () => {
    const s = root.querySelector('.frost-wiz-stats');
    if (s) s.textContent = frost.status();
  });
  app.events.on('selection', () => {
    // refresh mesh lists when on scalp/collide steps
    if (wiz.step === 0 || wiz.step === 3) render();
  });
}

function layerRow(layer: StyleLayer, onChange: () => void) {
  const row = el('div', 'frost-wiz-layer');
  const top = el('div', 'frost-wiz-layer-top');
  top.appendChild(el('strong', '', layer.name));
  top.appendChild(el('span', 'frost-wiz-muted', layer.kind));
  const mute = document.createElement('input');
  mute.type = 'checkbox';
  mute.title = 'Mute layer';
  mute.checked = layer.muted;
  mute.onchange = () => { layer.muted = mute.checked; onChange(); };
  top.appendChild(mute);
  row.appendChild(top);
  const inp = document.createElement('input');
  inp.type = 'range';
  inp.min = '0'; inp.max = '1'; inp.step = '0.05';
  inp.value = String(layer.strength);
  inp.className = 'frost-wiz-range';
  inp.oninput = () => { layer.strength = Number(inp.value); onChange(); };
  row.appendChild(inp);
  return row;
}
