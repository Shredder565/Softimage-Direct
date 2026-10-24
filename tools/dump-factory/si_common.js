// Shared helpers for Softimage 2015 SP2 dump-factory JScript.
// Softimage Script Editor loads one file at a time — each dump script inlines
// a copy of these helpers (or paste this first). Kept here as the canonical source.

function DF_docsDir() {
  var shell = new ActiveXObject("WScript.Shell");
  return shell.SpecialFolders("MyDocuments");
}

function DF_outDir(subdir) {
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = DF_docsDir() + "\\softimage_dump_factory";
  if (!fso.FolderExists(root)) fso.CreateFolder(root);
  if (subdir) {
    var p = root + "\\" + subdir;
    if (!fso.FolderExists(p)) fso.CreateFolder(p);
    return p;
  }
  return root;
}

function DF_enc(v) {
  if (v === null || v === undefined) return "null";
  var t = typeof v;
  if (t == "number") return isFinite(v) ? String(v) : "null";
  if (t == "boolean") return v ? "true" : "false";
  if (t == "string") {
    return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
  }
  if (v instanceof Array) {
    var a = [];
    for (var i = 0; i < v.length; i++) a.push(DF_enc(v[i]));
    return "[" + a.join(",") + "]";
  }
  var o = [];
  for (var k in v) o.push(DF_enc(k) + ":" + DF_enc(v[k]));
  return "{" + o.join(",") + "}";
}

function DF_writeJson(path, obj) {
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var f = fso.CreateTextFile(path, true);
  f.Write(DF_enc(obj));
  f.Close();
  return path;
}

function DF_paramVal(p) {
  try {
    var v = p.Value;
    if (typeof v == "object" && v !== null) {
      try { return String(v); } catch (e) { return "<obj>"; }
    }
    return v;
  } catch (e) { return "<err>"; }
}

function DF_dumpParamsMap(ps) {
  var r = {};
  try {
    var e = new Enumerator(ps);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      var sn = p.ScriptName || p.Name;
      r[String(sn).toLowerCase()] = DF_paramVal(p);
    }
  } catch (e) {}
  return r;
}

function DF_dumpParamsList(ps) {
  var r = [];
  try {
    var e = new Enumerator(ps);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      var d = { sn: p.ScriptName, n: p.Name, v: DF_paramVal(p) };
      try { d.t = p.ValueType; } catch (e1) {}
      try { d.min = Number(p.Min); d.max = Number(p.Max); } catch (e2) {}
      try { d.anim = p.Animatable; d.ro = p.ReadOnly; } catch (e3) {}
      r.push(d);
    }
  } catch (e) {}
  return r;
}

function DF_setParams(op, map) {
  for (var k in map) {
    try {
      var p = op.Parameters(k);
      if (p) p.Value = map[k];
    } catch (e1) {
      try { SetValue(op.FullName + "." + k, map[k]); } catch (e2) {}
    }
  }
}

function DF_cube333() {
  var o = CreatePrim("Cube", "MeshSurface", null, null);
  SetValue(o + ".polymsh.geom.subdivu", 3);
  SetValue(o + ".polymsh.geom.subdivv", 3);
  SetValue(o + ".polymsh.geom.subdivbase", 3);
  return Dictionary.GetObject(o.Name || o);
}

function DF_meshDump(obj) {
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
      var a = edge.Points(0).Index, b = edge.Points(1).Index;
      edges.push([a, b]);
    }
  } catch (e3) {}
  return { pts: pts, polys: polys, edges: edges };
}

function DF_lastTopoOp(obj) {
  var hist = obj.ActivePrimitive.ConstructionHistory;
  var last = null;
  var e = new Enumerator(hist);
  for (; !e.atEnd(); e.moveNext()) last = e.item();
  return last;
}

function DF_applyTopo(preset, conn) {
  return Application.ExecuteCommand("ApplyTopoOp", [preset, conn]);
}
