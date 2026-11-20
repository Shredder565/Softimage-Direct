// Build src/data/si/shader_spdl_index.json from the phenolib SPDL files in data/si/shaders (project data):
//   key (SPDL file name without .spdl, the same key as src/data/si/shaders.json) ->
//     clsid   the SPDL `Reference` GUID (the shader class id CreateShaderFromCLSID is given), lower case, no braces
//     name    the `Name` of the first MetaShader block (the shader's default name in the SPDL registry)
//     arrays  input parameters declared `type = array { Parameter "<item>" ... }`: { item, itemType, title }
// Used by src/commands/shadertasksB16b.ts (CMD-B16b). Usage: node tools/build_shader_spdl_index.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'si', 'shaders');
const out = {};
/** Body of the `{ ... }` block that opens at index `open` (a '{'), and the index after its '}'. */
function block(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (!depth) return [s.slice(open + 1, i), i + 1]; }
  }
  return [s.slice(open + 1), s.length];
}
for (const f of fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.spdl')).sort()) {
  const s = fs.readFileSync(path.join(dir, f), 'latin1').replace(/#[^\n]*/g, '');
  const key = f.replace(/\.spdl$/i, '');
  const ref = /^\s*Reference\s*=\s*"\{([0-9A-Fa-f-]{36})\}"/m.exec(s);
  const ms = /MetaShader\s+"[^"]*"\s*\{/.exec(s);
  let name = null;
  if (ms) { const [body] = block(s, ms.index + ms[0].length - 1); const n = /^\s*Name\s*=\s*"([^"]*)"/m.exec(body); name = n ? n[1] : null; }
  const arrays = {};
  const re = /Parameter\s+"([^"]+)"\s+input\s*\{/g; let m;
  while ((m = re.exec(s))) {
    const [body, end] = block(s, m.index + m[0].length - 1);
    const t = /type\s*=\s*array\s*\{/.exec(body);
    if (t) {
      const [inner] = block(body, t.index + t[0].length - 1);
      const item = /Parameter\s+"([^"]+)"/.exec(inner); const it = /type\s*=\s*(\w+)/.exec(inner);
      const title = /title\s*=\s*"([^"]*)"/.exec(body);
      arrays[m[1]] = { item: item ? item[1] : m[1], itemType: it ? it[1] : null, title: title ? title[1] : m[1] };
      re.lastIndex = end;
    }
  }
  out[key] = { clsid: ref ? ref[1].toLowerCase() : null, name, arrays };
}
const dest = path.join(root, 'src', 'data', 'si', 'shader_spdl_index.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log(`shader_spdl_index: ${Object.keys(out).length} SPDL files, ${Object.values(out).filter(v => v.clsid).length} with a class id, ${Object.values(out).filter(v => Object.keys(v.arrays).length).length} with array parameters -> ${path.relative(root, dest)}`);
