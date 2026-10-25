// Lock Softimage Animate Actions/Tools command arg defaults vs PC dump fixture.
// Usage: node tools/anim_actions_tools_defaults_check.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../data/dump/si_anim_actions_tools_defaults.json');
if (!fs.existsSync(FIXTURE)) { console.error('missing', FIXTURE); process.exit(2); }
const fix = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

// Lightweight: parse registered defaults from source (no browser). Softimage-faithful Name/Mode locks.
const modelTs = fs.readFileSync(path.resolve(__dirname, '../src/commands/model.ts'), 'utf8');
const animTs = fs.readFileSync(path.resolve(__dirname, '../src/commands/anim.ts'), 'utf8');
const src = modelTs + '\n' + animTs;

const diffs = [];
const expect = {
  StoreAction: { Mode: 1, Name: 'StoredAction' },
  AddTransition: { Name: 'Transition' },
};
for (const [cmd, args] of Object.entries(expect)) {
  const block = src.match(new RegExp(`name:\\s*'${cmd}'[\\s\\S]*?execute`));
  if (!block) { diffs.push(`${cmd}: registration missing`); continue; }
  for (const [arg, val] of Object.entries(args)) {
    const re = new RegExp(`name:\\s*'${arg}'\\s*,\\s*default:\\s*(${typeof val === 'string' ? `'${val}'` : val})`);
    if (!re.test(block[0])) diffs.push(`${cmd}.${arg}: expected default ${JSON.stringify(val)}`);
  }
}

// Fixture presence for Softimage PC dump commands
for (const sn of ['StoreAction', 'ApplyAction', 'SaveKey', 'ApplyFlexEnv', 'AddTransition', 'InspectDevices']) {
  if (!fix.commands[sn]) diffs.push(`fixture missing ${sn}`);
}

console.log(diffs.length ? 'DIFF' : 'OK', 'anim Actions/Tools Softimage defaults');
for (const d of diffs) console.log(' ', d);
process.exit(diffs.length ? 1 : 0);
