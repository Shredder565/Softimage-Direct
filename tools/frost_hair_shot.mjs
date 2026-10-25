import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = process.env.FROST_SHOT_DIR || '/cursor/stores/bc-0bd1d332-4e49-4056-9894-1b21507c9f95/media/frost-hair';
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
  frost.loadHairRecipe();
  const A = window.Application.anim;
  for (let f = 1; f <= 35; f++) A.frame = f;
});
await p.waitForTimeout(500);

await p.evaluate(() => window.__openView('FROST Hair Wizard'));
await p.waitForTimeout(700);

const audit = await p.evaluate(() => {
  const frost = window.__frost();
  return {
    module: window.Application.module,
    strands: frost?.state?.strands?.filter(s => s.alive).length ?? -1,
    strandLines: frost?.strandLines?.length ?? 0,
    frame: window.Application.anim.frame,
    graphNodes: frost?.graph?.nodes?.map(n => n.type) ?? [],
    hasWizard: !!document.querySelector('.frost-wiz'),
    hasFrostTb: !!document.querySelector('.frost-tb'),
    hairBtn: !!Array.from(document.querySelectorAll('.frost-tb .tb-btn')).find(b => b.textContent?.includes('Hair Wizard')),
  };
});
console.log('audit', JSON.stringify(audit, null, 2));

await p.screenshot({ path: path.join(OUT, 'frost-hair-wizard.png'), fullPage: false });
const wiz = await p.$('.frost-wiz');
if (wiz) await wiz.screenshot({ path: path.join(OUT, 'frost-hair-wizard-panel.png') });

// Advance to groom step + open graph
await p.evaluate(() => {
  const frost = window.__frost();
  if (frost.hair) frost.hair.step = 2;
  window.__openView('FROST Graph');
});
await p.waitForTimeout(600);
await p.screenshot({ path: path.join(OUT, 'frost-hair-graph.png'), fullPage: false });
const graph = await p.$('.frost-graph');
if (graph) await graph.screenshot({ path: path.join(OUT, 'frost-hair-graph-editor.png') });

console.log('errors', errs.length, errs.slice(0, 5));
console.log('wrote', OUT);
await b.close();
if (!smoke?.ok) process.exit(1);
if (audit.module !== 'FROST' || !audit.hasWizard) process.exit(2);
if (audit.strands < 1 || audit.strandLines < 1) process.exit(3);
