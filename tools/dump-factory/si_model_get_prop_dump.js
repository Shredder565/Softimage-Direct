// Softimage 2015 SP2 — Get > Property golden dump (XSIBATCH -processing, no desktop).
// Writes: Documents\softimage_dump_factory\model\si_model_get_prop_golden.json
//
// Covers Model toolbar Get/Property leaves: texture projections/maps, CAV, weight/symmetry maps,
// RenderMap, Attribute Display, GeomApprox, Static KineState, Synoptic, Transform Setup, Override,
// Annotation. Params + host/cluster placement for Softimage Direct fidelity.
//
// Usage:
//   XSIBATCH.bat -processing -script si_model_get_prop_dump.js -lang JScript
//   OR: Run-DumpFactory.bat model

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
      try { d.anim = p.Animatable; d.ro = p.ReadOnly; } catch (e3) {}
      r.push(d);
    }
  } catch (e) {}
  return r;
}
function cube() {
  var o = CreatePrim("Cube", "MeshSurface", null, null);
  return Dictionary.GetObject(o.Name || String(o));
}
function dumpPropObj(p) {
  if (!p) return null;
  var d = {
    name: safe(function () { return p.Name; }, null),
    type: safe(function () { return p.Type; }, null),
    full: safe(function () { return p.FullName; }, null),
    params: safe(function () { return dumpParamsMap(p.Parameters); }, {}),
    params_full: safe(function () { return dumpParamsList(p.Parameters); }, [])
  };
  try { d.parent = p.Parent.FullName; } catch (e) {}
  try { d.owner = p.Parent3DObject ? p.Parent3DObject.FullName : null; } catch (e2) {}
  return d;
}
function listPropsOn(obj) {
  var out = [];
  try {
    var e = new Enumerator(obj.Properties);
    for (; !e.atEnd(); e.moveNext()) out.push(dumpPropObj(e.item()));
  } catch (e) {}
  try {
    var g = obj.ActivePrimitive.Geometry;
    var ce = new Enumerator(g.Clusters);
    for (; !ce.atEnd(); ce.moveNext()) {
      var c = ce.item();
      var pe = new Enumerator(c.Properties);
      for (; !pe.atEnd(); pe.moveNext()) {
        var dp = dumpPropObj(pe.item());
        if (dp) { dp.cluster = c.Name; dp.cluster_type = c.Type; out.push(dp); }
      }
    }
  } catch (e3) {}
  return out;
}
function caseOk(key, leaf, fn) {
  LogMessage("… " + key);
  NewScene(null, false);
  var entry = { leaf: leaf, key: key };
  try {
    var r = fn();
    entry.ok = true;
    if (r && typeof r == "object") for (var k in r) entry[k] = r[k];
  } catch (e) {
    entry.ok = false;
    entry.error = e.description || String(e);
  }
  return entry;
}

LogMessage("=== si_model_get_prop_dump ===");
var report = {
  meta: {
    softimage: safe(function () { return Application.Version(); }, null),
    script: "si_model_get_prop_dump.js",
    purpose: "Get > Property presets: params + cluster/object placement",
    out: "%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\si_model_get_prop_golden.json"
  },
  cases: {},
  errors: []
};

// ---- Texture projections ----
var PROJ = [
  ["proj_uv", "Get/Property/Texture Projection/UV", ":siTxtUV:siTxtCreationType", ":siTxtDefaultPlanarXY:siTxtDefaultCreationType"],
  ["proj_planar_xy", "Get/Property/Texture Projection/Planar XY", ":siTxtPlanarXY:siTxtCreationType", ":siTxtDefaultPlanarXY:siTxtDefaultCreationType"],
  ["proj_planar_yz", "Get/Property/Texture Projection/Planar YZ", ":siTxtPlanarYZ:siTxtCreationType", ":siTxtDefaultPlanarYZ:siTxtDefaultCreationType"],
  ["proj_planar_xz", "Get/Property/Texture Projection/Planar XZ", ":siTxtPlanarXZ:siTxtCreationType", ":siTxtDefaultPlanarXZ:siTxtDefaultCreationType"],
  ["proj_cylindrical", "Get/Property/Texture Projection/Cylindrical", ":siTxtCylindrical:siTxtCreationType", ":siTxtDefaultCylindrical:siTxtDefaultCreationType"],
  ["proj_spherical", "Get/Property/Texture Projection/Spherical", ":siTxtSpherical:siTxtCreationType", ":siTxtDefaultSpherical:siTxtDefaultCreationType"],
  ["proj_spatial", "Get/Property/Texture Projection/Spatial", ":siTxtSpatial:siTxtCreationType", ":siTxtDefaultPlanarXY:siTxtDefaultCreationType"],
  ["proj_cubic", "Get/Property/Texture Projection/Cubic", ":siTxtCubic:siTxtCreationType", ":siTxtDefaultCubic:siTxtDefaultCreationType"],
  ["proj_camera", "Get/Property/Texture Projection/Camera Projection", ":siTxtCamera:siTxtCreationType", ":siTxtDefaultPlanarXY:siTxtDefaultCreationType"]
];
for (var i = 0; i < PROJ.length; i++) {
  (function (key, leaf, typ, def) {
    report.cases[key] = caseOk(key, leaf, function () {
      var c = cube();
      CreateProjection(c, typ, def, null, null, true, ":siRelDefault:siTxtProjFitMethod", null);
      return { host: c.FullName, props: listPropsOn(c), children: safe(function () {
        var ch = []; var e = new Enumerator(c.Children); for (; !e.atEnd(); e.moveNext()) ch.push({ name: e.item().Name, type: e.item().Type }); return ch;
      }, []) };
    });
  })(PROJ[i][0], PROJ[i][1], PROJ[i][2], PROJ[i][3]);
}

report.cases.create_new_projection = caseOk("create_new_projection", "Get/Property/Texture Projection/Create New Projection...", function () {
  var c = cube();
  Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtPlanarXY:siTxtCreationType", null, false);
  return { host: c.FullName, props: listPropsOn(c) };
});

report.cases.unique_uvs = caseOk("unique_uvs", "Get/Property/Texture Projection/Unique UVs (polymesh)", function () {
  var c = cube();
  try { GenerateUniqueUVs(c); } catch (e1) { GenerateUniqueUVs(c, null); }
  return { host: c.FullName, props: listPropsOn(c) };
});

// ---- Texture maps ----
var MAPS = [
  ["map_texture", "Get/Property/Texture Map/Texture Map", null],
  ["map_xy", "Get/Property/Texture Map/XY", ":siTxtPlanarXY:siTxtCreationType"],
  ["map_cubic", "Get/Property/Texture Map/Cubic", ":siTxtCubic:siTxtCreationType"]
];
report.cases.map_texture = caseOk("map_texture", "Get/Property/Texture Map/Texture Map", function () {
  var c = cube(); Create2DMap(c, null, null); return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.map_xy = caseOk("map_xy", "Get/Property/Texture Map/XY", function () {
  var c = cube();
  Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtPlanarXY:siTxtCreationType", null, false);
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.map_cubic = caseOk("map_cubic", "Get/Property/Texture Map/Cubic", function () {
  var c = cube();
  Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtCubic:siTxtCreationType", null, false);
  return { host: c.FullName, props: listPropsOn(c) };
});

// ---- Maps / properties ----
report.cases.cav = caseOk("cav", "Get/Property/Color At Vertices Map", function () {
  var c = cube(); CreateVertexColorSupport("ColorAtVertices", "Vertex_Color", c, null);
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.rendermap = caseOk("rendermap", "Get/Property/Render Map", function () {
  var c = cube(); AddProp("RenderMap", c, null, null);
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.symmetry_map = caseOk("symmetry_map", "Get/Property/Symmetry Map", function () {
  var c = cube(); CreateSymmetryMap("SymmetryMap", c, "Symmetry Map", "Symmetry Map Property");
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.weight_map = caseOk("weight_map", "Get/Property/Weight Map", function () {
  var c = cube(); CreateWeightMap("WeightMap", c, "Weight_Map", "Weight Map Property", false);
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.user_data_template = caseOk("user_data_template", "Get/Property/User Data Map/New Template", function () {
  var c = cube(); AddProp(null, c, null, "CustomDataTemplate");
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.attribute_display = caseOk("attribute_display", "Get/Property/Attribute Display", function () {
  var c = cube(); AddProp("AttributeDisplay", c, null, null);
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.geomapprox = caseOk("geomapprox", "Get/Property/Geometry Approximation", function () {
  var c = cube(); AddProp("GeomApprox", c, null, null);
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.static_kinestate = caseOk("static_kinestate", "Get/Property/Static KineState", function () {
  var c = cube();
  try { AddProp("Static Kinematic State Property", c, null, null); }
  catch (e) { AddProp("Static Kine State Property", c, null, null); }
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.synoptic = caseOk("synoptic", "Get/Property/Synoptic", function () {
  var c = cube(); AddProp("Synoptic Property", c, null, null);
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.transform_setup = caseOk("transform_setup", "Get/Property/Transform Setup", function () {
  var c = cube(); AddProp("Transform Setup", c, null, null);
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.override = caseOk("override", "Get/Property/Override", function () {
  var c = cube();
  try { AddProp("Override", c, null, null); } catch (e) { AddProp(null, c, null, null); }
  return { host: c.FullName, props: listPropsOn(c) };
});
report.cases.annotation = caseOk("annotation", "Get/Property/Annotation", function () {
  GetPrim("AnnotationObject", null, null, null);
  var o = Selection(0);
  return { host: safe(function () { return o.FullName; }, null), props: listPropsOn(o), type: safe(function () { return o.Type; }, null) };
});
report.cases.cluster_visibility = caseOk("cluster_visibility", "Get/Property/Polygon Cluster Visibility", function () {
  var c = cube();
  try { AddProp("Polygon Cluster Visibility", c, null, null); }
  catch (e1) {
    try { CreateCluster(c + ".poly[0]"); AddProp(null, Selection(0), null, null); } catch (e2) { throw e1; }
  }
  return { host: c.FullName, props: listPropsOn(c) };
});

writeJson("si_model_get_prop_golden.json", report);
NewScene(null, false);
LogMessage("DUMP DONE get_prop");
