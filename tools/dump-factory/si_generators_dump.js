// Softimage 2015 SP2 - Model generators goldens (Extrusion / Loft / Revolution). Headless.
// ASCII-only. Output: Documents\softimage_dump_factory\model\si_generators_golden.json

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

function meshSummary(obj) {
  var out = { pts: 0, polys: 0, edges: 0 };
  try {
    var g = obj.ActivePrimitive.Geometry;
    try { out.pts = g.Points.Count; } catch (e1) {}
    try { out.polys = g.Polygons.Count; } catch (e2) {}
    try { out.edges = g.Edges.Count; } catch (e3) {}
    try { if (g.Surfaces) out.surfaces = g.Surfaces.Count; } catch (e4) {}
    try { if (g.Curves) out.nbcurves = g.Curves.Count; } catch (e5) {}
  } catch (e) { out.error = String(e.description || e); }
  return out;
}

function meshDumpLite(obj) {
  var out = { summary: meshSummary(obj), pts: [], polys: [] };
  try {
    var g = obj.ActivePrimitive.Geometry;
    var e = new Enumerator(g.Points);
    var n = 0;
    for (; !e.atEnd() && n < 128; e.moveNext(), n++) {
      var p = e.item().Position;
      out.pts.push([p.X, p.Y, p.Z]);
    }
    var f = new Enumerator(g.Polygons);
    n = 0;
    for (; !f.atEnd() && n < 64; f.moveNext(), n++) {
      var ix = [];
      var e2 = new Enumerator(f.item().Points);
      for (; !e2.atEnd(); e2.moveNext()) ix.push(e2.item().Index);
      out.polys.push(ix);
    }
  } catch (e) {}
  return out;
}

function lastOp(obj) {
  try {
    var hist = obj.ActivePrimitive.ConstructionHistory;
    var last = null;
    var e = new Enumerator(hist);
    for (; !e.atEnd(); e.moveNext()) last = e.item();
    return last;
  } catch (e) { return null; }
}

function resolveObj(rtn) {
  if (rtn === null || rtn === undefined) return null;
  try { if (typeof rtn == "object" && rtn.Name) return Dictionary.GetObject(rtn.Name); } catch (e) {}
  try { return Dictionary.GetObject(String(rtn)); } catch (e2) {}
  try { if (Selection.Count > 0) return Selection(0); } catch (e3) {}
  return null;
}

function makeCircle(name) {
  var rtn = Application.CreatePrim("Circle", "NurbsCurve", name || null, null);
  return resolveObj(rtn);
}

function makeLinePath() {
  var rtn = Application.CreatePrim("Arc", "NurbsCurve", null, null);
  return resolveObj(rtn);
}

function applyGen(presetNames, connection) {
  var lastErr = null;
  for (var i = 0; i < presetNames.length; i++) {
    try {
      var rtn = Application.ApplyGenOp(presetNames[i], "", connection, 3);
      return { ok: true, preset: presetNames[i], rtn: rtn };
    } catch (e1) {
      try {
        var rtn2 = Application.ExecuteCommand("ApplyGenOp", [presetNames[i], "", connection]);
        return { ok: true, preset: presetNames[i], rtn: rtn2 };
      } catch (e2) {
        lastErr = String(e2.description || e2);
      }
    }
  }
  return { ok: false, error: lastErr || "ApplyGenOp failed" };
}

function dumpGenResult(label, presetNames, buildInputs) {
  NewScene(null, false);
  var r = { label: label, presets_tried: presetNames };
  try {
    var conn = buildInputs(r);
    if (!conn) { r.ok = false; r.error = "no connection set"; return r; }
    r.connection = conn;
    var ap = applyGen(presetNames, conn);
    r.apply = { ok: ap.ok, preset: ap.preset, error: ap.error || null };
    if (!ap.ok) { r.ok = false; r.error = ap.error; return r; }
    var obj = resolveObj(ap.rtn);
    if (!obj) {
      try { if (Selection.Count > 0) obj = Selection(0); } catch (e) {}
    }
    if (!obj) {
      try {
        var kids = new Enumerator(Application.ActiveSceneRoot.Children);
        for (; !kids.atEnd(); kids.moveNext()) obj = kids.item();
      } catch (e2) {}
    }
    if (!obj) { r.ok = false; r.error = "no output object"; return r; }
    r.ok = true;
    r.name = obj.Name;
    try { r.type = obj.Type; r.prim_type = obj.ActivePrimitive.Type; } catch (e3) {}
    var op = lastOp(obj);
    if (op) {
      r.op_name = op.Name; r.op_type = op.Type; r.op_full = op.FullName;
      r.params = dumpParamsMap(op.Parameters);
      r.params_full = dumpParamsList(op.Parameters);
    } else {
      r.params = {}; r.params_full = [];
      r.note = "no construction-history op found";
    }
    r.mesh = meshDumpLite(obj);
  } catch (e) {
    r.ok = false;
    r.error = String(e.description || e);
  }
  return r;
}

LogMessage("si_generators_dump: start");
var out = {
  meta: {
    softimage: Application.Version(),
    script: "si_generators_dump.js",
    purpose: "Mesh Extrusion / Loft / Revolution goldens via ApplyGenOp",
    mode: "XSIBATCH -processing",
    note: "Interactive picks / multi-curve UIs skipped; headless connection strings only"
  },
  cases: {}
};

LogMessage("... Mesh Extrusion Along Axis");
out.cases.Mesh_Extrusion_Along_Axis = dumpGenResult(
  "Mesh Extrusion Along Axis",
  ["Extrusion Along Axis", "Mesh Extrusion Along Axis", "ExtrusionAlongAxis"],
  function (r) {
    var c = makeCircle("profile");
    if (!c) return null;
    r.inputs = [c.Name];
    return c.Name;
  }
);

LogMessage("... Mesh Extrusion Along Curve");
out.cases.Mesh_Extrusion_Along_Curve = dumpGenResult(
  "Mesh Extrusion Along Curve",
  ["Extrusion", "Mesh Extrusion", "Extrusion Along Curve", "Mesh Extrusion Along Curve"],
  function (r) {
    var profile = makeCircle("profile");
    var path = makeLinePath();
    if (!profile || !path) return null;
    r.inputs = [profile.Name, path.Name];
    return profile.Name + ";" + path.Name;
  }
);

LogMessage("... Mesh Loft");
out.cases.Mesh_Loft = dumpGenResult(
  "Mesh Loft",
  ["Loft", "Mesh Loft"],
  function (r) {
    var a = makeCircle("c0");
    var b = makeCircle("c1");
    if (!a || !b) return null;
    try { Translate(b, 0, 4, 0, 1); } catch (e) {
      try { Translate(b.Name, 0, 4, 0); } catch (e2) {}
    }
    r.inputs = [a.Name, b.Name];
    return a.Name + ";" + b.Name;
  }
);

LogMessage("... Mesh Revolution Around Axis");
out.cases.Mesh_Revolution_Around_Axis = dumpGenResult(
  "Mesh Revolution Around Axis",
  ["Revolution Around Axis", "Mesh Revolution Around Axis", "RevolutionAlongAxis", "Revolution"],
  function (r) {
    var c = makeCircle("profile");
    if (!c) return null;
    try { Translate(c, 3, 0, 0, 1); } catch (e) {
      try { Translate(c.Name, 3, 0, 0); } catch (e2) {}
    }
    r.inputs = [c.Name];
    return c.Name;
  }
);

LogMessage("... NURBS Loft");
out.cases.NURBS_Loft = dumpGenResult(
  "NURBS Loft",
  ["NURBS Loft", "Loft"],
  function (r) {
    var a = makeCircle("c0");
    var b = makeCircle("c1");
    if (!a || !b) return null;
    try { Translate(b, 0, 4, 0, 1); } catch (e) {
      try { Translate(b.Name, 0, 4, 0); } catch (e2) {}
    }
    r.inputs = [a.Name, b.Name];
    return a.Name + ";" + b.Name;
  }
);

NewScene(null, false);
var path = outDir() + "\\si_generators_golden.json";
var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(path, true);
f.Write(enc(out));
f.Close();
LogMessage("DUMP DONE -> " + path);
