// Softimage 2015 SP2 - Boolean Difference/Union/Intersect mesh goldens.
// Cube + Sphere (sphere Translate X=1.5). Headless XSIBATCH -processing. ASCII-only.
// Output: Documents\softimage_dump_factory\model\si_boolean_mesh_golden.json
// Recipes from si_model_dump / dump1: ApplyTopoOp BooleanDifference/Union; Intersect via
// ApplyGenOp BooleanIntersection (dump2) and ApplyTopoOp BooleanIntersection fallback.

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
  var m = root + "\\model";
  if (!fso.FolderExists(m)) fso.CreateFolder(m);
  return m;
}

function safe(fn, def) { try { return fn(); } catch (e) { return def; } }

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

function resolveObj(rtn) {
  if (rtn === null || rtn === undefined) return null;
  try { if (typeof rtn == "object" && rtn.Name) return Dictionary.GetObject(rtn.Name); } catch (e) {}
  try { return Dictionary.GetObject(String(rtn)); } catch (e2) {}
  try { if (Selection.Count > 0) return Selection(0); } catch (e3) {}
  return null;
}

function lastOp(obj) {
  try {
    var hist = obj.ActivePrimitive.ConstructionHistory;
    var e = new Enumerator(hist);
    for (; !e.atEnd(); e.moveNext()) {
      var op = e.item();
      var t = String(op.Type || "").toLowerCase();
      if (t === "geom" || t.indexOf("marker") >= 0) continue;
      return op;
    }
  } catch (e) {}
  return null;
}

function meshDump(obj, truncateAt) {
  if (truncateAt === undefined || truncateAt === null) truncateAt = 400;
  var out = {
    name: safe(function () { return obj.Name; }, null),
    type: safe(function () { return obj.Type; }, null),
    pts: [],
    polys: [],
    npts: 0,
    npolys: 0,
    error: null
  };
  try {
    var g = obj.ActivePrimitive.Geometry;
    var e = new Enumerator(g.Points);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item().Position;
      out.pts.push([p.X, p.Y, p.Z]);
    }
    var f = new Enumerator(g.Polygons);
    for (; !f.atEnd(); f.moveNext()) {
      var ix = [];
      var e2 = new Enumerator(f.item().Points);
      for (; !e2.atEnd(); e2.moveNext()) ix.push(e2.item().Index);
      out.polys.push(ix);
    }
    out.npts = out.pts.length;
    out.npolys = out.polys.length;
    if (out.pts.length > truncateAt) {
      out.pts_truncated = true;
      out.pts_sample = out.pts.slice(0, 64);
      out.polys_sample = out.polys.slice(0, 64);
      out.pts = [];
      out.polys = [];
    }
  } catch (e) {
    out.error = String(e.description || e);
  }
  return out;
}

function translateSphere(sphere, x) {
  try {
    Translate(sphere, x, 0, 0, "siRelative", "siGlobal", "siObj", "siXYZ");
    return "Translate_siRelative";
  } catch (e1) {
    try {
      Translate(sphere.Name, x, 0, 0);
      return "Translate_name";
    } catch (e2) {
      try {
        SetValue(sphere.Name + ".kine.local.posx", x);
        return "SetValue_posx";
      } catch (e3) {
        throw e3;
      }
    }
  }
}

function makeCubeSphere() {
  var c = CreatePrim("Cube", "MeshSurface", null, null);
  var cube = Dictionary.GetObject(c.Name || String(c));
  var s = CreatePrim("Sphere", "MeshSurface", null, null);
  var sphere = Dictionary.GetObject(s.Name || String(s));
  var how = translateSphere(sphere, 1.5);
  return { cube: cube, sphere: sphere, connection: cube.Name + ";" + sphere.Name, translate: how };
}

function tryApply(cmd, presets, connection) {
  var attempts = [];
  for (var i = 0; i < presets.length; i++) {
    var preset = presets[i];
    try {
      var rtn = Application.ExecuteCommand(cmd, [preset, connection]);
      return { ok: true, cmd: cmd, preset: preset, rtn: rtn, attempts: attempts };
    } catch (e1) {
      attempts.push({ cmd: cmd, preset: preset, error: String(e1.description || e1) });
      try {
        if (cmd === "ApplyGenOp") {
          var rtn2 = Application.ApplyGenOp(preset, "", connection, 3);
          return { ok: true, cmd: "ApplyGenOp_direct", preset: preset, rtn: rtn2, attempts: attempts };
        }
      } catch (e2) {
        attempts.push({ cmd: "ApplyGenOp_direct", preset: preset, error: String(e2.description || e2) });
      }
      try {
        if (cmd === "ApplyTopoOp") {
          var rtn3 = Application.ApplyTopoOp(preset, connection);
          return { ok: true, cmd: "ApplyTopoOp_direct", preset: preset, rtn: rtn3, attempts: attempts };
        }
      } catch (e3) {
        attempts.push({ cmd: "ApplyTopoOp_direct", preset: preset, error: String(e3.description || e3) });
      }
    }
  }
  return { ok: false, attempts: attempts };
}

function histTypes(obj) {
  var r = [];
  try {
    var e = new Enumerator(obj.ActivePrimitive.ConstructionHistory);
    for (; !e.atEnd(); e.moveNext()) {
      var op = e.item();
      r.push(String(op.Name || "") + ":" + String(op.Type || ""));
    }
  } catch (e) {}
  return r;
}

function runBoolean(label, recipes) {
  NewScene(null, false);
  var r = { label: label, ok: false, recipes_tried: [] };
  try {
    var pair = makeCubeSphere();
    r.connection = pair.connection;
    r.translate = pair.translate;
    r.inputs = {
      cube: meshDump(pair.cube),
      sphere: meshDump(pair.sphere)
    };
    // strip heavy input arrays; keep counts
    r.inputs.cube.pts = []; r.inputs.cube.polys = [];
    r.inputs.sphere.pts = []; r.inputs.sphere.polys = [];

    var applied = null;
    for (var i = 0; i < recipes.length; i++) {
      var rec = recipes[i];
      var ap = tryApply(rec.cmd, rec.presets, pair.connection);
      r.recipes_tried.push({
        cmd: rec.cmd,
        presets: rec.presets,
        ok: ap.ok,
        preset: ap.preset || null,
        via: ap.cmd || null,
        attempts: ap.ok ? undefined : ap.attempts
      });
      if (ap.ok) { applied = ap; break; }
    }
    if (!applied) {
      r.error = "all recipes failed";
      return r;
    }
    r.apply = { ok: true, cmd: applied.cmd, preset: applied.preset };
    var cube = Dictionary.GetObject(pair.cube.Name);
    var sphere = Dictionary.GetObject(pair.sphere.Name);
    r.cube = meshDump(cube);
    r.sphere = meshDump(sphere);
    r.cube_hist = histTypes(cube);
    r.sphere_hist = histTypes(sphere);
    var op = lastOp(cube);
    if (op) {
      r.op_name = op.Name;
      r.op_type = op.Type;
      r.op_full = op.FullName;
      r.params = dumpParamsMap(op.Parameters);
    }
    // Prefer the object that gained a boolean op / changed counts
    r.result = {
      primary: "cube",
      npts: r.cube.npts,
      npolys: r.cube.npolys,
      sphere_npts: r.sphere.npts,
      sphere_npolys: r.sphere.npolys
    };
    r.ok = true;
  } catch (e) {
    r.ok = false;
    r.error = String(e.description || e);
  }
  return r;
}

LogMessage("si_boolean_mesh_dump: start");
var out = {
  meta: {
    softimage: safe(function () { return Application.Version(); }, null),
    script: "si_boolean_mesh_dump.js",
    purpose: "Boolean Diff/Union/Intersect cube+sphere mesh pts/polys goldens",
    mode: "XSIBATCH -processing",
    setup: "Cube + Sphere Translate X=1.5; connection cube;sphere",
    out: "%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\si_boolean_mesh_golden.json",
    prior_si_counts: {
      Difference: { cube: { points: 100, polys: 87 }, sphere: { points: 58, polys: 64 } },
      Union: { cube: { points: 113, polys: 101 }, sphere: { points: 58, polys: 64 } },
      Intersect: { note: "dump2 weak; re-measure" }
    }
  },
  cases: {}
};

LogMessage("... Difference");
out.cases.Difference = runBoolean("Boolean Difference", [
  { cmd: "ApplyTopoOp", presets: ["BooleanDifference", "Boolean Difference"] },
  { cmd: "ApplyGenOp", presets: ["BooleanGenDifference", "BooleanDifference", "Boolean Difference"] }
]);

LogMessage("... Union");
out.cases.Union = runBoolean("Boolean Union", [
  { cmd: "ApplyTopoOp", presets: ["BooleanUnion", "Boolean Union"] },
  { cmd: "ApplyGenOp", presets: ["BooleanGenUnion", "BooleanUnion", "Boolean Union"] }
]);

LogMessage("... Intersect");
out.cases.Intersect = runBoolean("Boolean Intersect", [
  { cmd: "ApplyGenOp", presets: ["BooleanIntersection", "Boolean Intersect", "BooleanGenIntersection", "SrfIntersect"] },
  { cmd: "ApplyTopoOp", presets: ["BooleanIntersection", "Boolean Intersection", "Boolean Intersect"] }
]);

NewScene(null, false);
var path = outDir() + "\\si_boolean_mesh_golden.json";
var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(path, true);
f.Write(enc(out));
f.Close();
LogMessage("DUMP DONE -> " + path);
