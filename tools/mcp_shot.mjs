import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new'] });
const p = await b.newPage({ viewport: { width: 1600, height: 760 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:4173/'); await p.waitForTimeout(800);
// create a cube via command and exercise MCP
await p.evaluate(() => (window).Application.run('CreatePrim', { PresetObj: 'Cube' }));
await p.waitForTimeout(200);
await p.click('.switcher[data-name=mcp] > .switcher-bar > button:first-child'); await p.waitForTimeout(100);
const mcp = await p.$('.mcp'); if (!mcp) { console.log('NO MCP'); } else {
  const box = await mcp.boundingBox(); console.log('mcp box', box);
  await mcp.screenshot({ path: 'docs/screenshots/mcp-clone.png' });
}
// click every button once and report errors
const labels = await p.$$eval('.mcp .mcp-btn', bs => bs.map(b => b.textContent));
console.log('buttons', labels.length, labels.join(' | '));
for (const [i] of labels.entries()) { const bs = await p.$$('.mcp .mcp-btn'); if (bs[i]) { await bs[i].click({ force: true }).catch(e => errs.push('click ' + labels[i] + ': ' + e.message)); await p.keyboard.press('Escape'); await p.click('.switcher[data-name=mcp] > .switcher-bar > button:first-child').catch(()=>{}); } }
await p.screenshot({ path: 'docs/screenshots/mcp-clone-full.png' });
console.log('errors', errs.length, errs.slice(0, 10));
await b.close();
