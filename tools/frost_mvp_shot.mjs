import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = process.env.FROST_SHOT_DIR || '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/media/frost-mvp';
fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', process.env.PW_CHROME].find(p => p && fs.existsSync(p));
const b = await chromium.launch({
  executablePath: CHROME,
  args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e.message || e)));
await p.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(1200);

const smoke = await p.evaluate(() => window.__frostSmoke?.());
console.log('smoke', JSON.stringify(smoke));

await p.evaluate(() => {
  window.__switchModule('FROST');
  const frost = window.__frost();
  frost.loadRecipe();
  const A = window.Application.anim;
  A.frame = 1;
  for (let f = 1; f <= 40; f++) {
    A.frame = f;
  }
});
await p.waitForTimeout(400);

await p.evaluate(() => window.__openView('FROST Graph'));
await p.waitForTimeout(600);

const audit = await p.evaluate(() => {
  const sel = document.querySelector('.module-select');
  const frost = window.__frost();
  return {
    module: window.Application.module,
    options: sel ? Array.from(sel.options).map(o => o.value) : [],
    particles: frost?.state ? frost.state.particles.filter(x => x.alive).length : -1,
    frame: window.Application.anim.frame,
    graphNodes: frost?.graph?.nodes?.map(n => n.type) ?? [],
    hasFrostGraph: !!document.querySelector('.frost-graph'),
    hasFrostTb: !!document.querySelector('.frost-tb'),
  };
});
console.log('audit', JSON.stringify(audit, null, 2));

await p.screenshot({ path: path.join(OUT, 'frost-tab-graph.png'), fullPage: false });
// tighter crop of graph floating window if present
const graph = await p.$('.frost-graph');
if (graph) await graph.screenshot({ path: path.join(OUT, 'frost-graph-editor.png') });

console.log('errors', errs.length, errs.slice(0, 5));
console.log('wrote', OUT);
await b.close();
if (!smoke?.ok) process.exit(1);
if (audit.module !== 'FROST' || !audit.options.includes('FROST')) process.exit(2);
if (audit.particles < 1) process.exit(3);
