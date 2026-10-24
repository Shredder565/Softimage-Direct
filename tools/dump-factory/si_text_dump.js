// Softimage 2015 SP2 - Create Text goldens (Curves / Planar / Solid). Headless XSIBATCH.
// ASCII-only. Output: Documents\softimage_dump_factory\model\si_text_golden.json

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

function meshDump(obj) {
  var out = { pts: [], polys: [], edges: [], summary: {} };
  try {
    var g = obj.ActivePrimitive.Geometry;
    try {
      var e = new Enumerator(g.Points);
      for (; !e.atEnd(); e.moveNext()) {
        var p = e.item().Position;
        out.pts.push([p.X, p.Y, p.Z]);
      }
    } catch (e1) {}
    try {
      var f = new Enumerator(g.Polygons);
      for (; !f.atEnd(); f.moveNext()) {
        var ix = [];
        var e2 = new Enumerator(f.item().Points);
        for (; !e2.atEnd(); e2.moveNext()) ix.push(e2.item().Index);
        out.polys.push(ix);
      }
    } catch (e2) {}
    try {
      var ed = new Enumerator(g.Edges);
      for (; !ed.atEnd(); ed.moveNext()) {
        var edge = ed.item();
        out.edges.push([edge.Points(0).Index, edge.Points(1).Index]);
      }
    } catch (e3) {}
    out.summary = { pts: out.pts.length, polys: out.polys.length, edges: out.edges.length };
    try { if (g.Curves) out.summary.nbcurves = g.Curves.Count; } catch (e4) {}
  } catch (e) { out.error = String(e.description || e); }
  if (out.pts.length > 400) {
    out.pts_truncated = true;
    out.pts_sample = out.pts.slice(0, 64);
    out.polys_sample = out.polys.slice(0, 64);
    out.pts = []; out.polys = []; out.edges = [];
  }
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

function caseFromObj(obj, note) {
  var r = { ok: true, note: note };
  r.name = obj.Name;
  try { r.type = obj.Type; r.prim_type = obj.ActivePrimitive.Type; } catch (e) {}
  var op = lastOp(obj);
  if (op) {
    r.op_name = op.Name; r.op_type = op.Type; r.op_full = op.FullName;
    r.params = dumpParamsMap(op.Parameters);
    r.params_full = dumpParamsList(op.Parameters);
  } else {
    try {
      r.params = dumpParamsMap(obj.ActivePrimitive.Parameters);
      r.params_full = dumpParamsList(obj.ActivePrimitive.Parameters);
      r.param_source = "ActivePrimitive";
    } catch (e2) { r.params = {}; r.params_full = []; }
  }
  try {
    var nest = [];
    var e = new Enumerator(obj.ActivePrimitive.NestedObjects);
    for (; !e.atEnd(); e.moveNext()) {
      var n = e.item();
      var sn = String(n.Name || "") + " " + String(n.Type || "");
      if (sn.toLowerCase().indexOf("text") >= 0) {
        nest.push({
          name: n.Name, type: n.Type, full: n.FullName,
          params: dumpParamsMap(n.Parameters),
          params_full: dumpParamsList(n.Parameters)
        });
      }
    }
    if (nest.length) r.text_ops = nest;
  } catch (e3) {}
  r.mesh = meshDump(obj);
  return r;
}

function runCurveText() {
  NewScene(null, false);
  var r = { variant: "Curves", method: "CreatePrim Text NurbsCurve" };
  try {
    var rtn = Application.CreatePrim("Text", "NurbsCurve", null, null);
    var obj = resolveObj(rtn);
    if (!obj) { rtn = Application.CreatePrim("Text", "NurbsCurve"); obj = resolveObj(rtn); }
    if (!obj) { r.ok = false; r.error = "no object"; return r; }
    var base = caseFromObj(obj, "Create Text Curves defaults");
    for (var k in base) r[k] = base[k];
  } catch (e) { r.ok = false; r.error = String(e.description || e); }
  return r;
}

function runMeshText(preset, label) {
  NewScene(null, false);
  var r = { variant: label, method: "CreateMeshText", preset: preset };
  try {
    var rtn = null;
    try { rtn = Application.CreateMeshText(preset); } catch (e1) {
      try { rtn = Application.ExecuteCommand("CreateMeshText", [preset]); } catch (e2) {
        r.ok = false; r.error = String(e2.description || e2); return r;
      }
    }
    var obj = resolveObj(rtn);
    if (!obj) { r.ok = false; r.error = "no object after CreateMeshText"; return r; }
    var base = caseFromObj(obj, "Create Text " + label + " defaults");
    for (var k in base) r[k] = base[k];
  } catch (e) { r.ok = false; r.error = String(e.description || e); }
  return r;
}

LogMessage("si_text_dump: start");
var out = {
  meta: {
    softimage: Application.Version(),
    script: "si_text_dump.js",
    purpose: "Create Text Curves / Planar Mesh / Solid Mesh goldens",
    mode: "XSIBATCH -processing",
    note: "Interactive font PPG / glyph picking skipped under -processing"
  }
};
LogMessage("... Curves");
out.Curves = runCurveText();
LogMessage("... Planar Mesh");
out.Planar = runMeshText("CurveListToPlanarMeshForText", "Planar Mesh");
LogMessage("... Solid Mesh");
out.Solid = runMeshText("CurveListToSolidMeshForText", "Solid Mesh");
NewScene(null, false);
var path = outDir() + "\\si_text_golden.json";
var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(path, true);
f.Write(enc(out));
f.Close();
LogMessage("DUMP DONE -> " + path);
