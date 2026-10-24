// Softimage 2015 SP2 - Model golden dumps (XSIBATCH -processing, no Desktop).
// Output: Documents\softimage_dump_factory\model\si_model_goldens.json
// Also: si_model_prims.json, si_model_topo_extra.json, si_model_deform.json

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

function outDir() {
  var shell = new ActiveXObject("WScript.Shell");
  var docs = shell.SpecialFolders("MyDocuments");
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = docs + "\\softimage_dump_factory";
  if (!fso.FolderExists(root)) fso.CreateFolder(root);
  var p = root + "\\model";
  if (!fso.FolderExists(p)) fso.CreateFolder(p);
  return p;
}

function writeJson(name, obj) {
  var path = outDir() + "\\" + name;
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var f = fso.CreateTextFile(path, true);
  f.Write(enc(obj));
  f.Close();
  LogMessage("wrote " + path);
  return path;
}

function safe(fn, def) {
  try { return fn(); } catch (e) { return def; }
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
  return {
    pts: pts,
    polys: polys,
    npts: pts.length,
    npolys: polys.length,
    name: safe(function () { return obj.Name; }, null),
    type: safe(function () { return obj.Type; }, null)
  };
}

function lastOp(obj) {
  var hist = obj.ActivePrimitive.ConstructionHistory;
  var last = null;
  var e = new Enumerator(hist);
  for (; !e.atEnd(); e.moveNext()) last = e.item();
  return last;
}

function cube333() {
  var o = CreatePrim("Cube", "MeshSurface", null, null);
  SetValue(o + ".polymsh.geom.subdivu", 3);
  SetValue(o + ".polymsh.geom.subdivv", 3);
  SetValue(o + ".polymsh.geom.subdivbase", 3);
  return Dictionary.GetObject(o.Name || String(o));
}

function applyTopo(preset, conn) {
  return Application.ExecuteCommand("ApplyTopoOp", [preset, conn]);
}

function applyOp(preset, conn) {
  try { return Application.ExecuteCommand("ApplyOp", [preset, conn]); }
  catch (e1) {
    try { return Application.ExecuteCommand("ApplyGenOp", [preset, conn]); }
    catch (e2) { throw e2; }
  }
}

function caseAfterTopo(preset, conn, note) {
  NewScene(null, false);
  var obj = cube333();
  var c = conn.replace("{OBJ}", obj.Name);
  var err = null;
  try { applyTopo(preset, c); } catch (e) { err = String(e.description || e); }
  var op = lastOp(obj);
  var r = meshDump(obj);
  r.preset = preset;
  r.selection = c;
  r.note = note;
  r.error = err;
  if (op) {
    r.op_name = op.Name;
    r.op_type = op.Type;
    r.params = dumpParamsMap(op.Parameters);
    r.params_full = dumpParamsList(op.Parameters);
  } else {
    r.params = {};
    r.params_full = [];
  }
  return r;
}

function dumpPrim(kind, geom) {
  NewScene(null, false);
  var row = { kind: kind, geom: geom, ok: false, error: null };
  try {
    var o = CreatePrim(kind, geom, null, null);
    var obj = Dictionary.GetObject(o.Name || String(o));
    row.ok = true;
    row.name = obj.Name;
    row.type = obj.Type;
    try {
      var prim = obj.ActivePrimitive;
      row.primitive_type = prim.Type;
      row.params = dumpParamsMap(prim.Parameters);
      row.params_full = dumpParamsList(prim.Parameters);
      try {
        var geomP = prim.Geometry;
        // also dump geom params if nested
        try { row.geom_params = dumpParamsMap(prim.Parameters); } catch (eG) {}
      } catch (e2) {}
      try {
        // Softimage mesh subdivs live on polymsh.geom
        row.subdivu = GetValue(obj.Name + ".polymsh.geom.subdivu");
        row.subdivv = GetValue(obj.Name + ".polymsh.geom.subdivv");
        row.subdivbase = GetValue(obj.Name + ".polymsh.geom.subdivbase");
      } catch (e3) {}
      try { row.mesh = meshDump(obj); } catch (e4) { row.mesh_error = String(e4.description || e4); }
    } catch (e) { row.error = String(e.description || e); }
  } catch (e0) {
    row.error = String(e0.description || e0);
  }
  return row;
}

function dumpDeform(preset) {
  NewScene(null, false);
  var obj = cube333();
  SelectObj(obj.Name);
  var row = { preset: preset, ok: false, error: null };
  try {
    applyOp(preset, obj.Name);
    row.ok = true;
  } catch (e) {
    try {
      Application.ExecuteCommand("ApplyFlexEnv", []);
      row.error = "ApplyOp failed: " + String(e.description || e);
    } catch (e2) {
      row.error = String(e.description || e);
    }
  }
  var op = lastOp(obj);
  row.mesh = meshDump(obj);
  if (op) {
    row.op_name = op.Name;
    row.op_type = op.Type;
    row.params = dumpParamsMap(op.Parameters);
    row.params_full = dumpParamsList(op.Parameters);
  }
  return row;
}

function dumpPropertyPresets() {
  // Inventory Softimage property / custom prop factory names exposed via Commands + Prefs categories.
  var props = [];
  var cats = ["Property", "Modeling", "Primitive", "Deformation"];
  try {
    var e = new Enumerator(Application.Commands);
    for (; !e.atEnd(); e.moveNext()) {
      var c = e.item();
      var cat = safe(function () { return String(c.Category); }, "");
      var name = safe(function () { return c.Name; }, "");
      var scr = safe(function () { return c.ScriptingName; }, "");
      var low = (cat + " " + name).toLowerCase();
      if (low.indexOf("property") >= 0 || low.indexOf("get property") >= 0 ||
          scr === "SIAddProp" || scr === "AddProp" || name.indexOf("Property") >= 0) {
        props.push({ name: name, scripting: scr, category: cat });
      }
    }
  } catch (e) {}
  return { count: props.length, commands: props };
}

LogMessage("si_model_goldens_dump: start");

var meta = {
  softimage: safe(function () { return Application.Version(); }, null),
  script: "si_model_goldens_dump.js",
  mode: "XSIBATCH -processing",
  note: "Model mesh goldens + prim defaults + deform attempt + property command inventory. No Desktop."
};

// ---- Primitives (Get) ----
var primKinds = [
  ["Cube", "MeshSurface"],
  ["Sphere", "MeshSurface"],
  ["Grid", "MeshSurface"],
  ["Cone", "MeshSurface"],
  ["Cylinder", "MeshSurface"],
  ["Torus", "MeshSurface"],
  ["Disc", "MeshSurface"],
  ["Circle", "NurbsCurve"],
  ["Square", "NurbsCurve"],
  ["Arc", "NurbsCurve"],
  ["Null", "Null"]
];
var prims = [];
for (var i = 0; i < primKinds.length; i++) {
  LogMessage("prim " + primKinds[i][0]);
  prims.push(dumpPrim(primKinds[i][0], primKinds[i][1]));
}
writeJson("si_model_prims.json", { meta: meta, primitives: prims });

// ---- Extra topology goldens (beyond si_topo_params_dump) ----
var topoCases = [
  ["Extrude Component Along Axis", "{OBJ}.poly[0]", "extrude_axis_poly0"],
  ["Extrude Component Along Normal", "{OBJ}.poly[0]", "extrude_normal_poly0"],
  ["Inset Polygons", "{OBJ}.poly[0]", "inset_poly0"],
  ["Subdivide Polygons", "{OBJ}.poly[0,1]", "subdivide_poly01"],
  ["Dissolve Component", "{OBJ}.edge[0]", "dissolve_edge0"],
  ["Collapse Component", "{OBJ}.edge[0]", "collapse_edge0"],
  ["Weld Points", "{OBJ}.pnt[0,1]", "weld_pnt01"],
  ["Symmetrize Polygons", "{OBJ}.poly[0,1,2]", "symmetrize_poly012"],
  ["Invert Polygons", "{OBJ}.poly[*]", "invert_all"],
  ["Local Subdivision", "{OBJ}.poly[0]", "local_subdiv_poly0"],
  ["Add Edge", "{OBJ}.pnt[0,1]", "add_edge_pnt01"],
  ["Split Edge", "{OBJ}.edge[0]", "split_edge0"],
  ["Bridge Edges", "{OBJ}.edge[0,2]", "bridge_edge02"],
  ["Offset Component", "{OBJ}.poly[0]", "offset_poly0"],
  ["Clean", "{OBJ}", "clean_object"],
  ["Filter Points", "{OBJ}", "filter_points"],
  ["Quadrangulate", "{OBJ}", "quadrangulate"],
  ["Triangulate Polygons", "{OBJ}.poly[*]", "triangulate"],
  ["Thickness", "{OBJ}.poly[*]", "thickness"]
];

var topoExtra = {};
for (var t = 0; t < topoCases.length; t++) {
  var tc = topoCases[t];
  LogMessage("topo " + tc[2]);
  // try alternate preset names on failure inside caseAfterTopo already records error
  var r = caseAfterTopo(tc[0], tc[1], tc[2]);
  if (r.error) {
    // common alternate names
    var alts = [];
    if (tc[0].indexOf("Extrude") >= 0) alts.push("ExtrudeComponent", "Extrude Along Axis", "Extrude");
    if (tc[0].indexOf("Inset") >= 0) alts.push("Inset", "InsetPolygons");
    if (tc[0].indexOf("Subdivide") >= 0) alts.push("SubdividePolygons", "Subdivide");
    if (tc[0].indexOf("Dissolve") >= 0) alts.push("DissolveComponent", "Dissolve");
    if (tc[0].indexOf("Collapse") >= 0) alts.push("CollapseComponent", "Collapse");
    if (tc[0].indexOf("Weld") >= 0) alts.push("WeldPoints", "Weld");
    if (tc[0].indexOf("Symmetrize") >= 0) alts.push("Symmetrize", "SymmetrizePolygons");
    if (tc[0].indexOf("Invert") >= 0) alts.push("InvertPolygons", "Invert");
    if (tc[0].indexOf("Quadrangulate") >= 0) alts.push("QuadrangulatePolygons");
    if (tc[0].indexOf("Triangulate") >= 0) alts.push("Triangulate");
    if (tc[0].indexOf("Thickness") >= 0) alts.push("Solidify", "Push");
    if (tc[0].indexOf("Clean") >= 0) alts.push("Cleanup", "MeshCleanup");
    for (var a = 0; a < alts.length; a++) {
      var r2 = caseAfterTopo(alts[a], tc[1], tc[2] + "_alt_" + alts[a]);
      if (!r2.error || (r2.op_name && r2.params && r2.npts !== undefined)) {
        r = r2;
        r.tried_alt = alts[a];
        break;
      }
    }
  }
  topoExtra[tc[2]] = r;
}
writeJson("si_model_topo_extra.json", { meta: meta, cases: topoExtra });

// ---- Deformers (Model Deform) ----
var deformPresets = [
  "Twist", "Bend", "Taper", "Bulge", "Shear", "Push", "Smooth", "Relax", "Fold",
  "Lattice", "Wave", "Deform by Curve", "Deform by Spine"
];
var deforms = {};
for (var d = 0; d < deformPresets.length; d++) {
  LogMessage("deform " + deformPresets[d]);
  deforms[deformPresets[d]] = dumpDeform(deformPresets[d]);
}
writeJson("si_model_deform.json", { meta: meta, cases: deforms });

// ---- Property command inventory ----
LogMessage("property inventory");
var propInv = dumpPropertyPresets();
writeJson("si_model_property_commands.json", { meta: meta, properties: propInv });

// ---- Master pack ----
var master = {
  meta: meta,
  files: [
    "si_model_prims.json",
    "si_model_topo_extra.json",
    "si_model_deform.json",
    "si_model_property_commands.json",
    "si_topo_ref_params.json"
  ],
  summary: {
    prim_ok: 0,
    prim_fail: 0,
    topo_cases: 0,
    topo_with_op: 0,
    deform_ok: 0,
    property_cmds: propInv.count
  }
};
for (var pi = 0; pi < prims.length; pi++) {
  if (prims[pi].ok) master.summary.prim_ok++; else master.summary.prim_fail++;
}
for (var k in topoExtra) {
  master.summary.topo_cases++;
  if (topoExtra[k].op_name) master.summary.topo_with_op++;
}
for (var dk in deforms) {
  if (deforms[dk].ok) master.summary.deform_ok++;
}

writeJson("si_model_goldens.json", master);
NewScene(null, false);
LogMessage("si_model_goldens_dump DONE");