#!/usr/bin/env node
/**
 * Headless Model PPG layout fidelity check vs Softimage SPDL/opdefs.
 * Verifies high-traffic Model ops have layouts, healed LabelWidth opts,
 * and Softimage deform XYZ row opts (NoLabel / width %).
 *
 * Usage: node tools/model_ppg_layout_check.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opdefs = JSON.parse(fs.readFileSync(path.join(root, 'src/data/opdefs.json'), 'utf8'));
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'src/data/si/model_ppg_tokens.json'), 'utf8'));

const KEYS = [
  ['ops', 'bevelop'],
  ['ops', 'extrudenormalop'],
  ['ops', 'extrudecompaxisop'],
  ['ops', 'polygonreductionop'],
  ['ops', 'dicepolygonsop'],
  ['ops', 'shearop'],
  ['ops', 'taperop'],
  ['ops', 'bulgeop'],
  ['ops', 'twistop'],
  ['ops', 'bendop'],
  ['ops', 'TextToCurveList'],
  ['ops', 'prop:geomapprox'],
  ['ops', 'prop:display'],
  ['ops', 'loft'],
  ['ops', 'extrusion'],
  ['ops', 'birail'],
  ['ops', 'CurveListToMesh'],
  ['ops', 'booleansrftopoop'],
  ['ops', 'extrude2profs'],
  ['ops', 'revolution'],
  ['ops', 'filletcrv'],
  ['ops', 'extractcrvseg'],
  ['ops', 'blendcrv'],
  ['ops', 'mergecrv'],
  ['ops', 'mergemesh'],
  ['ops', 'loft'],
  ['ops', 'extrusion'],
  ['ops', 'birail'],
  ['prims', 'shape:Polygon Mesh/Torus'],
  ['prims', 'shape:Polygon Mesh/Disc'],
];

const SPDL_EXPECT = {
  shearop: 'C3DShearOp.spdl',
  taperop: 'taperop.spdl',
  bulgeop: 'C3DBulgeOp.spdl',
  bevelop: 'C3DBevelComponentOp.spdl',
  extrude2profs: 'ExtrusionTwoProfiles.spdl',
  revolution: 'revolutionAxisOp.spdl',
  filletcrv: 'filletcrv.spdl',
  extractcrvseg: 'extractcrvsegment.spdl',
  blendcrv: 'blendcrvop.spdl',
  mergecrv: 'mergecrv.spdl',
  mergemesh: 'C3DMergeMeshOp.spdl',
};

function walk(ns, fn) {
  for (const n of ns || []) {
    fn(n);
    if (n.items) walk(n.items, fn);
  }
}

function collectParams(lay) {
  const out = [];
  walk(lay, (n) => { if (n.param) out.push(String(n.param).toLowerCase()); });
  return out;
}

const ok = [];
const fail = [];

for (const [bucket, key] of KEYS) {
  const d = opdefs[bucket]?.[key];
  if (!d) { fail.push(`${key}: missing opdef`); continue; }
  if (!d.layout?.length) { fail.push(`${key}: no layout`); continue; }
  if (SPDL_EXPECT[key] && d.spdl !== SPDL_EXPECT[key]) {
    fail.push(`${key}: spdl ${d.spdl} ≠ ${SPDL_EXPECT[key]}`);
  } else {
    ok.push(`${key}: layout×${d.layout.length} spdl=${d.spdl}`);
  }
  let broken = 0;
  walk(d.layout, (n) => {
    for (const o of n.opts || []) {
      if ((o.match(/\(/g) || []).length !== (o.match(/\)/g) || []).length) broken++;
    }
  });
  if (broken) fail.push(`${key}: ${broken} unbalanced layout opts`);
}

// Deform XYZ Softimage row: defx AlignRight+%, defy/defz NoLabel
for (const key of ['shearop', 'taperop', 'bulgeop']) {
  const d = opdefs.ops[key];
  const by = {};
  walk(d.layout, (n) => { if (n.param) by[n.param.toLowerCase()] = n.opts || []; });
  const y = by.defy || []; const z = by.defz || [];
  if (!y.includes('NoLabel') || !z.includes('NoLabel')) fail.push(`${key}: defy/defz missing NoLabel (got y=${y} z=${z})`);
  else ok.push(`${key}: NoLabel on defy/defz`);
}

// Bevel LabelWidth healed
{
  const d = opdefs.ops.bevelop;
  let found = null;
  walk(d.layout, (n) => {
    if (n.param === 'minangleforjunctionhardedges') found = n.opts;
  });
  if (!found?.some((o) => /^LabelWidth\(.+\)$/i.test(o))) fail.push(`bevelop: LabelWidth not healed (${JSON.stringify(found)})`);
  else ok.push(`bevelop: LabelWidth healed ${found.find((o) => /LabelWidth/i.test(o))}`);
}

// Extract Segment synth (GenOp-inline dump → startpos/endpos/invert group)
{
  const d = opdefs.ops.extractcrvseg;
  const ps = collectParams(d.layout);
  for (const need of ['startpos', 'endpos', 'invert']) {
    if (!ps.includes(need)) fail.push(`extractcrvseg: missing ${need} in layout (${ps})`);
  }
  if (ps.includes('startpos') && ps.includes('endpos') && ps.includes('invert')) ok.push('extractcrvseg: Extract synth params');
}

// Merge Curves dump tabs Clean/Shape
{
  const d = opdefs.ops.mergecrv;
  const tabs = (d.layout || []).map((n) => n.tab).filter(Boolean);
  if (!tabs.includes('Clean') || !tabs.includes('Shape')) fail.push(`mergecrv: expected Clean/Shape tabs got ${JSON.stringify(tabs)}`);
  else ok.push('mergecrv: Clean/Shape tabs');
}

// Token map: wired_opdefs → opdef key (null = dump inventory only, e.g. generic ExtrudeComponent)
const wired = tokens.wired_opdefs || {};
for (const [f, key] of Object.entries(wired)) {
  if (key == null) { ok.push(`token spdl inventory-only: ${f}`); continue; }
  const d = opdefs.ops[key] || opdefs.prims[key];
  if (!d) fail.push(`token ${f} → missing opdef ${key}`);
  else if (!d.layout?.length) fail.push(`token ${f} → ${key} has no layout`);
  else ok.push(`token spdl wired: ${f} → ${key}`);
}

console.log(JSON.stringify({ ok: ok.length, fail: fail.length, failures: fail, sample_ok: ok.slice(0, 12) }, null, 2));
process.exit(fail.length ? 1 : 0);
