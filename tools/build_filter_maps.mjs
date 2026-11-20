// Builds src/data/si/filter_maps.json from data/command_registry.json (+ data/commands_full.json for the catalogue
// argument list). CMD-B16d: the commands whose handler CLSID is the scnmgr pseudo-handler 48becc30 keep their
// selection-filter map in their own registry arguments: argument 0 is the input (InputObjs / InputObj), then groups of
// four (SelFilter, OnFilterCmdMapClient, OnFilterCmdID, InputObjsArgName). OnFilterCmdID is a registry command GUID
// stored as raw little-endian bytes; this script decodes it and copies the target command's scripting name, argument
// defaults and script procedure, so the runtime executor needs no 2 MB registry.
// Usage: node tools/build_filter_maps.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command_registry.json'), 'utf8')).commands;
const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'commands_full.json'), 'utf8'));
const FILTER_MAP_HANDLER = '48becc30-5e5e-11d4-8c2c-009027bc3a0e';

/** Raw 16 bytes (hex, GUID in memory order) -> canonical lower-case GUID text. */
function guidOfRaw(hex) {
  const b = hex.match(/../g);
  const le = (i, n) => b.slice(i, i + n).reverse().join('');
  return `${le(0, 4)}-${le(4, 2)}-${le(6, 2)}-${b.slice(8, 10).join('')}-${b.slice(10, 16).join('')}`.toLowerCase();
}
const byGuid = new Map(reg.map(c => [c.guid.toLowerCase(), c]));

const commands = [];
const targets = {};
for (const c of reg) {
  if (c.handler_clsid.toLowerCase() !== FILTER_MAP_HANDLER) continue;
  const groups = [];
  const rest = c.args.slice(1);
  const wellFormed = c.args.length >= 5 && rest.length % 4 === 0;
  for (let i = 0; wellFormed && i < rest.length; i += 4) {
    const [sf, mc, id, an] = rest.slice(i, i + 4);
    const names = [sf.name, mc.name, id.name, an.name].join(',');
    if (names !== 'SelFilter,OnFilterCmdMapClient,OnFilterCmdID,InputObjsArgName') throw new Error(`${c.name}: group ${i / 4} is ${names}`);
    const ref = typeof sf.default === 'string' ? sf.default : '';
    const cmdId = guidOfRaw(id.default_raw);
    groups.push({ filter: ref.includes(':') ? ref.slice(ref.indexOf(':') + 1) : ref, filterRef: ref, mapClient: guidOfRaw(mc.default_raw), cmdId, inputArgName: typeof an.default === 'string' ? an.default : '' });
    const t = byGuid.get(cmdId);
    if (t && !targets[cmdId]) targets[cmdId] = {
      name: t.name, scripting: t.scripting_name || '', handler: t.handler_clsid,
      args: t.args.map(a => [a.name, a.default ?? null]),
      script: t.script ? `${t.script.ScriptName}:${t.script.ScriptProcedure}` : '',
    };
  }
  // catalogue argument list as data/commands_full.json prints it (the entry with the same argument count)
  const cat = full.find(x => (x.scripting_name || x.name) === c.name && x.args.length === c.args.length);
  commands.push({
    name: c.name, guid: c.guid, category: c.category, description: c.description, tooltip: c.tooltip, flags: c.flags,
    inputArg: c.args[0]?.name ?? '', wellFormed, groups,
    args: (cat?.args ?? c.args).map(a => [a.name, a.default ?? null]),
  });
}
const out = { source: 'data/command_registry.json (handler 48becc30, CMD-B16d); built by tools/build_filter_maps.mjs', commands, targets };
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'si', 'filter_maps.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`filter_maps.json: ${commands.length} commands, ${Object.keys(targets).length} targets`);
