// Behavioural sweep of every Softimage command in data/commands_full.json against the AfterImage command bus.
// For each scripting name: is it registered at runtime, and what does it do when run with its default arguments
// on the ?demo scene (cube selected)? Each run is undone before the next one.
//
// Classes (first match wins):
//   unregistered   - name not on the bus at runtime (the static ledger scan may still count it if the string appears in src)
//   hang           - did not return within SWEEP_TIMEOUT ms (page reloaded)
//   crash          - threw TypeError / ReferenceError / RangeError ... or raised a page error — a bug
//   precondition   - threw a plain Error with a user message ("select components first" ...) — default args unusable
//   status_fail    - threw a Softimage-style status (SiStatusError / numeric .status) — often fine for default args
//   placeholder    - ran, but logged "not yet attested" / stand-in / not implemented / not available
//   silent         - ran, but no undo entry, no return value, no log line, no selection / DOM / module change
//   ok             - ran with an observable effect
//
// Usage: npm run build && npx vite preview --port 4190 &
//        SI_URL=http://localhost:4190/ node tools/sweep_all_commands.mjs [out.json]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'docs/re/sweep_afterimage.json');
const TIMEOUT = Number(process.env.SWEEP_TIMEOUT || 6000);
const CHROME = [
  process.env.PW_CHROME,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1243/real/chrome-linux64/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].filter(Boolean).find(p => fs.existsSync(p) && fs.statSync(p).isFile());

const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/commands_full.json'), 'utf8'));
const seen = new Map();
for (const c of full) {
  const n = c.scripting_name || c.name;
  if (!n || seen.has(n)) continue;
  seen.set(n, (c.category || '(uncategorised)').split('|')[0].trim() || '(uncategorised)');
}
const NAMES = [...seen.keys()];
const ONLY = process.env.SWEEP_ONLY ? new RegExp(process.env.SWEEP_ONLY) : null;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const URL0 = process.env.SI_URL || 'http://localhost:4173/';
let page, pageErrors = [];

async function openPage() {
  if (page) await page.close().catch(() => {});
  page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: false });
  page.on('pageerror', e => pageErrors.push(String(e?.message ?? e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(URL0.includes('?') ? URL0 : URL0 + '?demo');
  await page.waitForFunction(() => !!window.Application?.scene?.find('cube'), null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const A = window.Application;
    A.autoInspect = false; A.cmdLogSize = 1e9; A.Interactive = false;
    window.alert = () => {}; window.confirm = () => false; window.prompt = () => null; window.open = () => null;
    HTMLInputElement.prototype.click = function () {}; // no file pickers
    const PH = /not yet attested|stand-in|placeholder|not (yet )?implemented|not available|not supported/i;
    const ev = []; const emit0 = A.events.emit.bind(A.events);
    A.events.emit = (e, d) => { if (!['scene', 'log', 'undo', 'selection'].includes(e)) ev.push(e); return emit0(e, d); };
    const countObjs = () => { let n = 0; const walk = (x) => { for (const c of x?.children ?? []) { n++; walk(c); } }; walk(A.scene.root); return n; };
    window.__sweep = async (name) => {
      const def = A.commands.get(name);
      if (!def) return { cls: 'unregistered' };
      try { A.anim?.stop?.(); } catch {}
      try { A.setTool(null); } catch {}
      let cube = A.scene.find('cube');
      if (!cube) return { cls: 'reload' };
      try { A.compSel = null; A.setSelMode('object'); A.select([cube]); } catch {}
      const u0 = A.undoStack.length, l0 = A.log.length, sel0 = A.selection.map(n => n.name).join(','),
        dom0 = document.body.querySelectorAll('*').length, mod0 = A.module, nodes0 = A.scene.root?.children?.length, objs0 = countObjs();
      ev.length = 0;
      let v, err = null, status;
      try {
        v = A.run(name, {});
        if (v && typeof v.then === 'function') v = await Promise.race([v, new Promise(r => setTimeout(() => r('__pending__'), 1500))]);
      } catch (e) { err = `${e?.name ?? 'Error'}: ${e?.message ?? e}`; status = typeof e?.status === 'number' ? e.status : undefined; }
      const logs = A.log.slice(l0).filter(l => l.kind !== 'cmd').map(l => `${l.kind}: ${l.text}`);
      const undo = A.undoStack.length - u0;
      const sel1 = A.selection.map(n => n.name).join(',');
      const dom = document.body.querySelectorAll('*').length - dom0;
      const effect = { undo, ret: v === undefined ? null : (v?.name ?? v?.constructor?.name ?? typeof v), logs: logs.length,
        sel: sel0 !== sel1, dom, module: A.module !== mod0, nodes: (A.scene.root?.children?.length ?? 0) - (nodes0 ?? 0), objs: countObjs() - objs0, selAfter: sel1, events: [...new Set(ev)] };
      // roll back
      try { while (A.undoStack.length > u0) A.undo(); } catch {}
      try { if (A.module !== mod0) A.module = mod0; } catch {}
      let cls;
      if (err) cls = status !== undefined || /SiStatus/.test(err) ? 'status_fail' : /^(TypeError|ReferenceError|RangeError|SyntaxError|InternalError)/.test(err) ? 'crash' : 'precondition';
      else if (logs.some(l => PH.test(l))) cls = 'placeholder';
      else if (!undo && effect.ret === null && !logs.length && !effect.sel && !dom && !effect.module && !effect.nodes && !effect.objs && !effect.events.length) cls = 'silent';
      else cls = 'ok';
      return { cls, err, status, logs: logs.slice(0, 4).map(s => s.slice(0, 200)), effect, args: def.args.map(a => a.name) };
    };
  });
}

await openPage();
const results = {};
let i = 0;
for (const name of NAMES) {
  i++;
  if (ONLY && !ONLY.test(name)) continue;
  pageErrors = [];
  let r;
  try {
    r = await Promise.race([
      page.evaluate(n => window.__sweep(n), name),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT)),
    ]);
  } catch (e) {
    r = { cls: /timeout/.test(String(e)) ? 'hang' : 'crash', err: String(e?.message ?? e).slice(0, 300) };
  }
  if (r.cls === 'reload') { await openPage(); r = await page.evaluate(n => window.__sweep(n), name).catch(e => ({ cls: 'crash', err: String(e) })); }
  if (pageErrors.length && r.cls === 'ok') { r.cls = 'crash'; r.err = 'pageerror: ' + pageErrors[0].slice(0, 200); }
  r.category = seen.get(name);
  results[name] = r;
  if (r.cls === 'hang' || r.cls === 'reload' || (r.cls === 'crash' && /Target closed|crash|detached/i.test(r.err ?? ''))) await openPage();
  else {
    // the scene may have been replaced (NewScene, OpenScene ...): reload if the demo cube is gone or many views piled up
    const bad = await page.evaluate(() => !window.Application?.scene?.find('cube') || document.body.querySelectorAll('*').length > 40000).catch(() => true);
    if (bad || i % 400 === 0) await openPage();
  }
  if (i % 250 === 0) process.stderr.write(`${i}/${NAMES.length}\n`);
}
await browser.close();

const counts = {};
for (const r of Object.values(results)) counts[r.cls] = (counts[r.cls] ?? 0) + 1;
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), total: Object.keys(results).length, counts, results }, null, 1) + '\n');
console.log(JSON.stringify(counts));
console.log('wrote', path.relative(ROOT, OUT));
