// Softimage 2015 SP2 - Bevel managecollisions HARD mesh diverge hunt. ASCII only.
function enc(v) {
  if (v === null || v === undefined) return "null";
  var t = typeof v;
  if (t == "number") return isFinite(v) ? String(v) : "null";
  if (t == "boolean") return v ? "true" : "false";
  if (t == "string") {
    return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
  }
  if (v instanceof Array) {
    var a = []; for (var i = 0; i < v.length; i++) a.push(enc(v[i])); return "[" + a.join(",") + "]";
  }
  var o = []; for (var k in v) o.push(enc(k) + ":" + enc(v[k])); return "{" + o.join(",") + "}";
}
function safe(fn, def) { try { return fn(); } catch (e) { return def; } }
function outDir() {
  var shell = new ActiveXObject("WScript.Shell");
  var docs = shell.SpecialFolders("MyDocuments");
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = docs + "\\softimage_dump_factory"; if (!fso.FolderExists(root)) fso.CreateFolder(root);
  var model = root + "\\model"; if (!fso.FolderExists(model)) fso.CreateFolder(model);
  return model;
}
function writeJson(name, obj) {
  var path = outDir() + "\\" + name;
  var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(path, true);
  f.Write(enc(obj)); f.Close(); LogMessage("wrote " + path); return path;
}
function paramVal(p) {
  try {
    var v = p.Value;
    if (typeof v == "object" && v !== null) { try { return String(v); } catch (e) { return "<obj>"; } }
    return v;
  } catch (e) { return "<err>"; }
}
function dumpParamsMap(ps) {
  var r = {};
  try {
    var e = new Enumerator(ps);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      r[String(p.ScriptName || p.Name).toLowerCase()] = paramVal(p);
    }
  } catch (e) {}
  return r;
}
function dumpParamsList(ps) {
  var r = [];
  try {
    var e = new Enumerator(ps);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      var d = { sn: p.ScriptName, n: p.Name, v: paramVal(p) };
      try { d.t = p.ValueType; } catch (e1) {}
      try { d.min = Number(p.Min); d.max = Number(p.Max); } catch (e2) {}
      r.push(d);
    }
  } catch (e) {}
  return r;
}
function setParams(op, map) {
  var results = {};
  for (var k in map) {
    try {
      var p = op.Parameters(k);
      if (p) { p.Value = map[k]; results[k] = "ok"; }
      else results[k] = "missing";
    } catch (e1) {
      try { SetValue(op.FullName + "." + k, map[k]); results[k] = "setvalue"; }
      catch (e2) { results[k] = "fail:" + (e2.description || e2.message); }
    }
  }
  return results;
}
function meshDump(obj) {
  var g = obj.ActivePrimitive.Geometry;
  var pts = [];
  var e = new Enumerator(g.Points);
  for (; !e.atEnd(); e.moveNext()) {
    var p = e.item().Position;
    pts.push([p.X, p.Y, p.Z]);
  }
  var polys = [];
  var f = new Enumerator(g.Polygons);
  for (; !f.atEnd(); f.moveNext()) {
    var ix = [];
    var e2 = new Enumerator(f.item().Points);
    for (; !e2.atEnd(); e2.moveNext()) ix.push(e2.item().Index);
    polys.push(ix);
  }
  var edges = [];
  try {
    var ed = new Enumerator(g.Edges);
    for (; !ed.atEnd(); ed.moveNext()) {
      var edge = ed.item();
      edges.push([edge.Points(0).Index, edge.Points(1).Index]);
    }
  } catch (e3) {}
  return { npts: pts.length, npolys: polys.length, nedges: edges.length, pts: pts, polys: polys, edges: edges };
}
function lastOp(obj) {
  var hist = obj.ActivePrimitive.ConstructionHistory;
  var e = new Enumerator(hist);
  for (; !e.atEnd(); e.moveNext()) {
    var op = e.item();
    var t = String(op.Type || "").toLowerCase();
    if (t === "geom" || t.indexOf("marker") >= 0) continue;
    return op;
  }
  return null;
}
function histNames(obj) {
  var all = [];
  try {
    var e = new Enumerator(obj.ActivePrimitive.ConstructionHistory);
    for (; !e.atEnd(); e.moveNext()) {
      var op = e.item();
      all.push(String(op.Name) + ":" + String(op.Type));
    }
  } catch (e) {}
  return all;
}
function applyTopo(preset, conn) {
  return Application.ExecuteCommand("ApplyTopoOp", [preset, conn]);
}
function edgeList(obj, maxN) {
  var g = obj.ActivePrimitive.Geometry;
  var ids = [];
  var ed = new Enumerator(g.Edges);
  for (; !ed.atEnd(); ed.moveNext()) {
    ids.push(ed.item().Index);
    if (maxN && ids.length >= maxN) break;
  }
  return ids;
}
function allEdges(obj) {
  return edgeList(obj, 0);
}
function makeCube(subdiv) {
  var o = CreatePrim("Cube", "MeshSurface", null, null);
  SetValue(o + ".polymsh.geom.subdivu", subdiv);
  SetValue(o + ".polymsh.geom.subdivv", subdiv);
  SetValue(o + ".polymsh.geom.subdivbase", subdiv);
  return Dictionary.GetObject(o.Name || String(o));
}
function makeThinBox() {
  var o = CreatePrim("Cube", "MeshSurface", null, null);
  SetValue(o + ".polymsh.geom.subdivu", 4);
  SetValue(o + ".polymsh.geom.subdivv", 4);
  SetValue(o + ".polymsh.geom.subdivbase", 4);
  var obj = Dictionary.GetObject(o.Name || String(o));
  try { Scale(obj, 1, 1, 0.08, siAbsolute, siLocal, siObj, siXYZ); } catch (e1) {
    try { Translate(null, null, null, null); } catch (e2) {}
    try { SetValue(obj.Name + ".kine.local.sclz", 0.08); } catch (e3) {
      try { obj.Kinematics.Local.Parameters("sclz").Value = 0.08; } catch (e4) {}
    }
  }
  return obj;
}
function makeGridDense() {
  var o = null;
  try { o = CreatePrim("Grid", "MeshSurface", null, null); } catch (e) {
    o = CreatePrim("Cube", "MeshSurface", null, null);
  }
  try { SetValue(o + ".polymsh.geom.subdivu", 8); } catch (e1) {}
  try { SetValue(o + ".polymsh.geom.subdivv", 8); } catch (e2) {}
  try { SetValue(o + ".grid.ulength", 4); SetValue(o + ".grid.vlength", 4); } catch (e3) {}
  try { SetValue(o + ".grid.usubdiv", 8); SetValue(o + ".grid.vsubdiv", 8); } catch (e4) {}
  return Dictionary.GetObject(o.Name || String(o));
}
function runCase(variantName, buildFn, edgeMode, overrides) {
  NewScene(null, false);
  var obj = buildFn();
  var ids;
  if (edgeMode === "all") ids = allEdges(obj);
  else if (edgeMode === "first12") ids = edgeList(obj, 12);
  else if (edgeMode === "border6") ids = edgeList(obj, 6);
  else ids = edgeList(obj, 24);
  var conn = obj.Name + ".edge[" + ids.join(",") + "]";
  var applied = null;
  try { applyTopo("Bevel", conn); applied = "Bevel"; }
  catch (e) {
    try { applyTopo("BevelComponent", conn); applied = "BevelComponent"; }
    catch (e2) { return { variant: variantName, error: e2.description || String(e2), selection: conn, hist: histNames(obj), nsel: ids.length }; }
  }
  var op = lastOp(obj);
  var setres = null;
  if (overrides && op) setres = setParams(op, overrides);
  try { Application.Refresh(); } catch (eR) {}
  try { var dummy = obj.ActivePrimitive.Geometry.Points.Count; } catch (eG) {}
  var r = meshDump(obj);
  r.variant = variantName;
  r.selection = conn;
  r.nsel = ids.length;
  r.applied_preset = applied;
  r.hist = histNames(obj);
  r.set_params = setres;
  r.params = op ? dumpParamsMap(op.Parameters) : {};
  r.params_full = op ? dumpParamsList(op.Parameters) : [];
  if (op) { r.op_name = op.Name; r.op_type = op.Type; r.op_full = op.FullName; }
  r.managecollisions = safe(function () { return r.params.managecollisions; }, null);
  r.ratio = safe(function () { return r.params.ratio; }, null);
  r.units = safe(function () { return r.params.units; }, null);
  return r;
}
function pairDiff(a, b, key) {
  if (!a || !b || !a.pts || !b.pts) return { key: key, error: "missing" };
  return {
    key: key,
    npts_off: a.npts, npts_on: b.npts,
    npolys_off: a.npolys, npolys_on: b.npolys,
    nedges_off: a.nedges, nedges_on: b.nedges,
    mesh_equal: (enc(a.pts) === enc(b.pts) && enc(a.polys) === enc(b.polys)),
    pts_equal: enc(a.pts) === enc(b.pts),
    polys_equal: enc(a.polys) === enc(b.polys),
    managecollisions_off: a.managecollisions, managecollisions_on: b.managecollisions,
    nsel: a.nsel
  };
}

LogMessage("si_bevel_collide_hard_dump v1: start");
var out = {
  meta: {
    softimage: safe(function () { return Application.Version(); }, null),
    script: "si_bevel_collide_hard_dump.js",
    purpose: "Hard-mesh Bevel managecollisions ON vs OFF diverge hunt",
    utc: safe(function () { return new Date().toUTCString(); }, null)
  },
  cases: {},
  errors: [],
  diff_summary: {}
};
try {
  out.cases.thin_off_r09 = runCase("thin_off_r09", makeThinBox, "all", { managecollisions: false, ratio: 0.9, units: 0 });
  out.cases.thin_on_r09 = runCase("thin_on_r09", makeThinBox, "all", { managecollisions: true, ratio: 0.9, units: 0 });
  out.cases.dense_off_r095 = runCase("dense_off_r095", function(){return makeCube(6);}, "all", { managecollisions: false, ratio: 0.95, units: 0 });
  out.cases.dense_on_r095 = runCase("dense_on_r095", function(){return makeCube(6);}, "all", { managecollisions: true, ratio: 0.95, units: 0 });
  out.cases.cube_off_abs2 = runCase("cube_off_abs2", function(){return makeCube(3);}, "all", { managecollisions: false, ratio: 2.0, units: 1 });
  out.cases.cube_on_abs2 = runCase("cube_on_abs2", function(){return makeCube(3);}, "all", { managecollisions: true, ratio: 2.0, units: 1 });
  out.cases.grid_off_r08 = runCase("grid_off_r08", makeGridDense, "all", { managecollisions: false, ratio: 0.8, units: 0 });
  out.cases.grid_on_r08 = runCase("grid_on_r08", makeGridDense, "all", { managecollisions: true, ratio: 0.8, units: 0 });
  out.cases.cube_off_r10 = runCase("cube_off_r10", function(){return makeCube(4);}, "all", { managecollisions: false, ratio: 1.0, units: 0 });
  out.cases.cube_on_r10 = runCase("cube_on_r10", function(){return makeCube(4);}, "all", { managecollisions: true, ratio: 1.0, units: 0 });
} catch (eMain) { out.errors.push(String(eMain.description || eMain.message || eMain)); }

try {
  out.diff_summary.thin_r09 = pairDiff(out.cases.thin_off_r09, out.cases.thin_on_r09, "thin_r09");
  out.diff_summary.dense_r095 = pairDiff(out.cases.dense_off_r095, out.cases.dense_on_r095, "dense_r095");
  out.diff_summary.cube_abs2 = pairDiff(out.cases.cube_off_abs2, out.cases.cube_on_abs2, "cube_abs2");
  out.diff_summary.grid_r08 = pairDiff(out.cases.grid_off_r08, out.cases.grid_on_r08, "grid_r08");
  out.diff_summary.cube_r10 = pairDiff(out.cases.cube_off_r10, out.cases.cube_on_r10, "cube_r10");
  var anyDiff = false;
  for (var k in out.diff_summary) {
    if (out.diff_summary[k] && out.diff_summary[k].mesh_equal === false) anyDiff = true;
  }
  out.any_mesh_diff = anyDiff;
} catch (eD) { out.errors.push("diff: " + (eD.description || eD.message)); }

writeJson("si_bevel_collide_hard.json", out);
LogMessage("si_bevel_collide_hard_dump v1: done any_diff=" + out.any_mesh_diff);
0;