#!/usr/bin/env node
/**
 * FROST evaluator smoke harness.
 * Prefers in-process Vite SSR of src/frost/smoke.ts; falls back to Playwright + preview.
 *
 *   node tools/frost_eval_check.mjs
 *   FROST_SMOKE_URL=http://localhost:4173 node tools/frost_eval_check.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function runViaVite() {
  const { createServer } = await import('vite');
  const server = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  try {
    const mod = await server.ssrLoadModule('/src/frost/smoke.ts');
    const result = mod.runFrostSmokeTests();
    return result;
  } finally {
    await server.close();
  }
}

async function runViaPlaywright() {
  const { chromium } = await import('playwright');
  const BASE_URL = process.env.FROST_SMOKE_URL ?? process.env.UI_SMOKE_URL ?? 'http://localhost:4173/';
  const CHROME_CANDIDATES = [
    process.env.PW_CHROME,
    '/opt/pw-browsers/chromium',
    '/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  const CHROME = CHROME_CANDIDATES.find(p => fs.existsSync(p));
  if (!CHROME) throw new Error('No Chromium for Playwright fallback; set PW_CHROME');
  const b = await chromium.launch({
    executablePath: CHROME,
    args: ['--headless=new', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const p = await b.newPage();
    await p.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(800);
    const result = await p.evaluate(() => window.__frostSmoke?.() ?? null);
    if (!result) throw new Error('__frostSmoke missing — is the app built with FROST hooks?');
    return result;
  } finally {
    await b.close();
  }
}

let result;
try {
  result = await runViaVite();
  console.log('frost_eval_check: vite-ssr');
} catch (e) {
  console.warn('frost_eval_check: vite-ssr failed, trying Playwright:', e?.message ?? e);
  result = await runViaPlaywright();
  console.log('frost_eval_check: playwright');
}

for (const c of result.checks ?? []) console.log('  ok  ', c);
for (const f of result.failures ?? []) console.log('  FAIL', f);
if (!result.ok) {
  console.error(`FROST smoke FAILED (${result.failures.length})`);
  process.exit(1);
}
console.log(`FROST smoke OK (${result.checks.length} checks)`);
