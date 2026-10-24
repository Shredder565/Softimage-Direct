// Softimage 2015 SP2 - Create Text per-curve CV dump + Planar/Solid mesh probe.
// Headless XSIBATCH -processing only. ASCII-only.
// Output: Documents\softimage_dump_factory\model\si_text_curves_detail.json

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

function xyzFromPos(p) {
  return [p.X, p.Y, p.Z];
}

function dumpPointCollection(coll) {
  var pts = [];
  var e = new Enumerator(coll);
  for (; !e.atEnd(); e.moveNext()) {
    var it = e.item();
    try { pts.push(xyzFromPos(it.Position)); }
    catch (e1) {
      try { pts.push([it.X, it.Y, it.Z]); } catch (e2) {}
    }
  }
  return pts;
}

function dumpOneCurve(cv, index) {
  var row = { index: index, ok: false };
  try {
    row.degree = safe(function () { return cv.Degree; }, null);
    row.closed = safe(function () {
      try { return cv.IsClosed(); } catch (e1) { return cv.Closed; }
    }, null);
    var cps = null;
    var src = null;
    try { cps = dumpPointCollection(cv.ControlPoints); src = "ControlPoints"; } catch (e2) { cps = null; }
    if (!cps || cps.length === 0) {
      try { cps = dumpPointCollection(cv.Points); src = "Points"; } catch (e3) { cps = null; }
    }
    if (!cps || cps.length === 0) {
      try {
        // Some builds expose .Count + indexed access
        var n = cv.ControlPoints.Count;
        cps = [];
        for (var i = 0; i < n; i++) {
          var p = cv.ControlPoints(i).Position;
          cps.push([p.X, p.Y, p.Z]);
        }
        src = "ControlPoints_index";
      } catch (e4) { cps = null; }
    }
    row.ok = !!(cps && cps.length);
    row.source = src;
    row.count = cps ? cps.length : 0;
    row.cvs = cps || [];
  } catch (e) {
    row.error = String(e.description || e);
  }
  return row;
}

function dumpCurvesDetail(obj) {
  var out = {
    name: safe(function () { return obj.Name; }, null),
    type: safe(function () { return obj.Type; }, null),
    prim_type: safe(function () { return obj.ActivePrimitive.Type; }, null),
    nbcurves: 0,
    curves: [],
    flat_points_count: null,
    per_curve_lengths_sum: 0,
    error: null
  };
  try {
    var g = null;
    try { g = obj.ActivePrimitive.Geometry; } catch (e0) {
      try { g = obj.ActivePrimitive.GetGeometry2(0); out.geom_via = "GetGeometry2"; } catch (e1) {
        throw e0;
      }
    }
    try { out.flat_points_count = g.Points.Count; } catch (e2) {}
    var curves = null;
    try { curves = g.Curves; } catch (e3) { curves = null; }
    if (!curves) {
      out.error = "Geometry.Curves unavailable";
      return out;
    }
    out.nbcurves = curves.Count;
    for (var i = 0; i < curves.Count; i++) {
      var cv = null;
      try { cv = curves(i); } catch (e4) {
        try { cv = curves.Item(i); } catch (e5) { cv = null; }
      }
      if (!cv) {
        out.curves.push({ index: i, ok: false, error: "curve index unresolved" });
        continue;
      }
      var row = dumpOneCurve(cv, i);
      out.curves.push(row);
      if (row.count) out.per_curve_lengths_sum += row.count;
    }
  } catch (e) {
    out.error = String(e.description || e);
  }
  return out;
}

function meshDump(obj) {
  var out = { pts: [], polys: [], npts: 0, npolys: 0, via: null, error: null };
  function tryGeom(g, via) {
    var pts = [];
    var polys = [];
    var e = new Enumerator(g.Points);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item().Position;
      pts.push([p.X, p.Y, p.Z]);
    }
    try {
      var f = new Enumerator(g.Polygons);
      for (; !f.atEnd(); f.moveNext()) {
        var ix = [];
        var e2 = new Enumerator(f.item().Points);
        for (; !e2.atEnd(); e2.moveNext()) ix.push(e2.item().Index);
        polys.push(ix);
      }
    } catch (eP) {}
    out.pts = pts;
    out.polys = polys;
    out.npts = pts.length;
    out.npolys = polys.length;
    out.via = via;
    if (pts.length > 400) {
      out.pts_truncated = true;
      out.pts_sample = pts.slice(0, 64);
      out.polys_sample = polys.slice(0, 64);
      out.pts = [];
      out.polys = [];
    }
    return true;
  }
  try {
    try {
      if (tryGeom(obj.ActivePrimitive.Geometry, "ActivePrimitive.Geometry")) return out;
    } catch (e1) { out.error = String(e1.description || e1); }
    try {
      var o2 = Dictionary.GetObject(obj.Name);
      if (tryGeom(o2.ActivePrimitive.Geometry, "Dictionary.GetObject.Geometry")) return out;
    } catch (e2) {}
    try {
      FreezeObj(obj.Name);
      out.froze = true;
      if (tryGeom(obj.ActivePrimitive.Geometry, "FreezeObj.Geometry")) return out;
    } catch (e3) { out.freeze_error = String(e3.description || e3); }
    try {
      var g2 = obj.ActivePrimitive.GetGeometry2(0);
      if (tryGeom(g2, "GetGeometry2")) return out;
    } catch (e4) { out.getgeometry2_error = String(e4.description || e4); }
  } catch (e) {
    out.error = String(e.description || e);
  }
  return out;
}

function dumpTextOp(obj) {
  var r = { params: {}, params_full: [], op_name: null, op_type: null, op_full: null };
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
    } catch (e) {}
  }
  return r;
}

function runCurveText() {
  NewScene(null, false);
  var r = { variant: "Curves", method: "CreatePrim Text NurbsCurve", ok: false };
  try {
    var rtn = Application.CreatePrim("Text", "NurbsCurve", null, null);
    var obj = resolveObj(rtn);
    if (!obj) { rtn = Application.CreatePrim("Text", "NurbsCurve"); obj = resolveObj(rtn); }
    if (!obj) { r.error = "no object"; return r; }
    r.ok = true;
    r.name = obj.Name;
    var opInfo = dumpTextOp(obj);
    for (var k in opInfo) r[k] = opInfo[k];
    r.curves_detail = dumpCurvesDetail(obj);
    r.nbcurves = r.curves_detail.nbcurves;
    r.per_curve_lengths_sum = r.curves_detail.per_curve_lengths_sum;
    r.flat_points_count = r.curves_detail.flat_points_count;
  } catch (e) {
    r.ok = false;
    r.error = String(e.description || e);
  }
  return r;
}

function runMeshText(preset, label) {
  NewScene(null, false);
  var r = { variant: label, method: "CreateMeshText", preset: preset, ok: false };
  try {
    var rtn = null;
    try { rtn = Application.CreateMeshText(preset); }
    catch (e1) {
      try { rtn = Application.ExecuteCommand("CreateMeshText", [preset]); }
      catch (e2) { r.error = String(e2.description || e2); return r; }
    }
    var obj = resolveObj(rtn);
    if (!obj) {
      try {
        var kids = new Enumerator(Application.ActiveSceneRoot.Children);
        for (; !kids.atEnd(); kids.moveNext()) {
          var k = kids.item();
          if (String(k.Type || "") === "polymsh" || String(k.Name || "").toLowerCase().indexOf("curve") >= 0) {
            obj = k;
          }
        }
      } catch (e3) {}
    }
    if (!obj) { r.error = "no object after CreateMeshText"; return r; }
    r.ok = true;
    r.name = obj.Name;
    r.type = safe(function () { return obj.Type; }, null);
    var opInfo = dumpTextOp(obj);
    for (var k in opInfo) r[k] = opInfo[k];
    r.mesh = meshDump(obj);
  } catch (e) {
    r.ok = false;
    r.error = String(e.description || e);
  }
  return r;
}

LogMessage("si_text_curves_detail_dump: start");
var out = {
  meta: {
    softimage: safe(function () { return Application.Version(); }, null),
    script: "si_text_curves_detail_dump.js",
    purpose: "per-curve CV arrays for Create Text Curves; Planar/Solid mesh probe",
    mode: "XSIBATCH -processing",
    out: "%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\si_text_curves_detail.json"
  }
};
LogMessage("... Curves detail");
out.Curves = runCurveText();
LogMessage("... Planar Mesh");
out.Planar = runMeshText("CurveListToPlanarMeshForText", "Planar Mesh");
LogMessage("... Solid Mesh");
out.Solid = runMeshText("CurveListToSolidMeshForText", "Solid Mesh");
NewScene(null, false);
var path = outDir() + "\\si_text_curves_detail.json";
var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(path, true);
f.Write(enc(out));
f.Close();
LogMessage("DUMP DONE -> " + path);
