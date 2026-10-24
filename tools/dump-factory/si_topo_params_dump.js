// Softimage 2015 SP2 — topology dump WITH operator parameters.
// Matches compare_topology.mjs / softimage-dump-requests.md:
//   base 3×3×3 cube; Bevel_edges variants A–D; PolyReduction ratio ladder; Dice defaults.
// Run: Alt+4 Script Editor → File > Open this file → Edit > Run
//   OR: tools/dump-factory/Run-DumpFactory.bat (XSIBATCH, no UI handoff)
// Output: %USERPROFILE%\Documents\softimage_dump_factory\si_topo_ref_params.json

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

function docsRoot() {
  var shell = new ActiveXObject("WScript.Shell");
  var docs = shell.SpecialFolders("MyDocuments");
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = docs + "\\softimage_dump_factory";
  if (!fso.FolderExists(root)) fso.CreateFolder(root);
  return root;
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
  for (var k in map) {
    try {
      var p = op.Parameters(k);
      if (p) p.Value = map[k];
    } catch (e1) {
      try { SetValue(op.FullName + "." + k, map[k]); } catch (e2) {
        LogMessage("setParam fail " + k + ": " + e2.description);
      }
    }
  }
}

function cube333() {
  var o = CreatePrim("Cube", "MeshSurface", null, null);
  SetValue(o + ".polymsh.geom.subdivu", 3);
  SetValue(o + ".polymsh.geom.subdivv", 3);
  SetValue(o + ".polymsh.geom.subdivbase", 3);
  return Dictionary.GetObject(o.Name || String(o));
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
  return { pts: pts, polys: polys, edges: edges };
}

function lastOp(obj) {
  var hist = obj.ActivePrimitive.ConstructionHistory;
  var last = null;
  var e = new Enumerator(hist);
  for (; !e.atEnd(); e.moveNext()) last = e.item();
  return last;
}

function applyTopo(preset, conn) {
  return Application.ExecuteCommand("ApplyTopoOp", [preset, conn]);
}

function caseMesh(obj, op, note) {
  var out = meshDump(obj);
  out.params = op ? dumpParamsMap(op.Parameters) : {};
  out.params_full = op ? dumpParamsList(op.Parameters) : [];
  if (op) { out.op_name = op.Name; out.op_type = op.Type; out.op_full = op.FullName; }
  if (note) out.note = note;
  return out;
}

function runBevelEdges(variantName, paramOverrides) {
  NewScene(null, false);
  var obj = cube333();
  var conn = obj.Name + ".edge[0,1,2]";
  try {
    applyTopo("Bevel", conn);
  } catch (e) {
    try { applyTopo("BevelComponent", conn); } catch (e2) {
      return { error: e2.description || String(e2), variant: variantName };
    }
  }
  var op = lastOp(obj);
  if (paramOverrides && op) setParams(op, paramOverrides);
  var r = caseMesh(obj, op, "Bevel_edges " + variantName + " edges[0,1,2]");
  r.variant = variantName;
  r.selection = conn;
  return r;
}

function runPolyReduction(ratioPct) {
  NewScene(null, false);
  var obj = cube333();
  SelectObj(obj.Name);
  try {
    applyTopo("Polygon Reduction", obj.Name);
  } catch (e) {
    try { applyTopo("PolygonReduction", obj.Name); } catch (e2) {
      return { error: e2.description || String(e2), ratio: ratioPct };
    }
  }
  var op = lastOp(obj);
  // Softimage ratio is typically 0–100 percent remaining (dump-requests: ratio 50).
  if (op && ratioPct !== null && ratioPct !== undefined) {
    setParams(op, { ratio: ratioPct });
  }
  var r = caseMesh(obj, op, "PolyReduction ratio=" + ratioPct + " object-selected");
  r.ratio_requested = ratioPct;
  r.selection = obj.Name;
  return r;
}

function runDiceDefaults() {
  NewScene(null, false);
  var obj = cube333();
  var conn = obj.Name + ".poly[0,1,2]";
  try {
    applyTopo("Dice Polygons", conn);
  } catch (e) {
    try { applyTopo("DicePolygons", conn); } catch (e2) {
      return { error: e2.description || String(e2) };
    }
  }
  var op = lastOp(obj);
  var r = caseMesh(obj, op, "Dice defaults polys[0,1,2]");
  r.selection = conn;
  // Highlight the PPG-relevant keys called out in dump-requests.
  if (r.params) {
    r.dice_defaults_note = {
      style: r.params.style,
      planeref: r.params.planeref,
      nbslicesu: r.params.nbslicesu || r.params.nbslicesx || r.params.nbslices,
      nbslicesv: r.params.nbslicesv || r.params.nbslicesy,
      nbslicesw: r.params.nbslicesw || r.params.nbslicesz,
      merge: r.params.merge
    };
  }
  return r;
}

function runBevelPolysDefault() {
  NewScene(null, false);
  var obj = cube333();
  var conn = obj.Name + ".poly[0,1,2]";
  try { applyTopo("Bevel", conn); } catch (e) {
    try { applyTopo("BevelComponent", conn); } catch (e2) {
      return { error: e2.description || String(e2) };
    }
  }
  var op = lastOp(obj);
  var r = caseMesh(obj, op, "Bevel polys[0,1,2] defaults");
  r.selection = conn;
  return r;
}

// ---- main ----
LogMessage("si_topo_params_dump: start");
var out = {
  meta: {
    softimage: Application.Version(),
    script: "si_topo_params_dump.js",
    purpose: "topology meshes + full operator params (Bevel_edges variants, PolyReduction ladder, Dice defaults)"
  }
};

NewScene(null, false);
var baseObj = cube333();
out.base = meshDump(baseObj);
out.base.note = "3x3x3 cube subdivu/v/base=3";

// Bevel on polys (control / compare with existing Bevel case)
LogMessage("… Bevel polys default");
out.Bevel = runBevelPolysDefault();

// Bevel_edges variants A–D (same three edges [0,1,2])
// A default: ratio 0.5, units Relative, nbsubdivs 0, miter off
LogMessage("… Bevel_edges A default");
out.Bevel_edges = runBevelEdges("A_default", null);
LogMessage("… Bevel_edges B ratio 0.25");
out.Bevel_edges_B = runBevelEdges("B_ratio_0.25", { ratio: 0.25 });
LogMessage("… Bevel_edges C miter on");
out.Bevel_edges_C = runBevelEdges("C_miter", { miter: true });
LogMessage("… Bevel_edges D nbsubdivs 1");
out.Bevel_edges_D = runBevelEdges("D_nbsubdivs_1", { nbsubdivs: 1 });

// Also keep a key that matches dump-requests nested shape for the default case
out.Bevel_edges_params_summary = out.Bevel_edges.params || {};

// PolyReduction ladder: 100, 75, 50, 25 (+ default = 50)
LogMessage("… PolyReduction ladder");
out.PolyReduction = runPolyReduction(50);
out.PolyReduction_100 = runPolyReduction(100);
out.PolyReduction_75 = runPolyReduction(75);
out.PolyReduction_50 = out.PolyReduction;
out.PolyReduction_25 = runPolyReduction(25);

// Dice defaults confirmation
LogMessage("… Dice defaults");
out.Dice = runDiceDefaults();

var path = docsRoot() + "\\si_topo_ref_params.json";
var fso = new ActiveXObject("Scripting.FileSystemObject");
var f = fso.CreateTextFile(path, true);
f.Write(enc(out));
f.Close();
NewScene(null, false);
LogMessage("DUMP DONE -> " + path);
