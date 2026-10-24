// Softimage 2015 SP2 — Modify/Create Model (referenced models + deltas) dump (XSIBATCH).
// Writes: Documents\softimage_dump_factory\model\si_model_ref_golden.json
//
// Headless-safe: creates a model, exports .emdl via ExportModel where possible, converts to
// referenced model, resolution offload/reload, empty delta, export/import delta shapes.
// Does NOT require Softimage GUI. File paths under Documents\softimage_dump_factory\model\ref\
//
// Usage:
//   XSIBATCH.bat -processing -script si_model_ref_dump.js -lang JScript
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
function outRoot() {
  var shell = new ActiveXObject("WScript.Shell");
  var docs = shell.SpecialFolders("MyDocuments");
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = docs + "\\softimage_dump_factory"; if (!fso.FolderExists(root)) fso.CreateFolder(root);
  var model = root + "\\model"; if (!fso.FolderExists(model)) fso.CreateFolder(model);
  var ref = model + "\\ref"; if (!fso.FolderExists(ref)) fso.CreateFolder(ref);
  return { model: model, ref: ref };
}
function writeJson(name, obj) {
  var dirs = outRoot();
  var path = dirs.model + "\\" + name;
  var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(path, true);
  f.Write(enc(obj)); f.Close(); LogMessage("wrote " + path); return path;
}
function meshSummary(obj) {
  try {
    var g = obj.ActivePrimitive.Geometry;
    return { name: obj.Name, type: obj.Type, points: g.Points.Count, polys: safe(function () { return g.Polygons.Count; }, null) };
  } catch (e) { return { name: safe(function () { return obj.Name; }, null), type: safe(function () { return obj.Type; }, null) }; }
}
function listChildren(m) {
  var r = [];
  try {
    var e = new Enumerator(m.Children);
    for (; !e.atEnd(); e.moveNext()) r.push(meshSummary(e.item()));
  } catch (e) {}
  return r;
}
function listProps(m) {
  var r = [];
  try {
    var e = new Enumerator(m.Properties);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      r.push({ name: p.Name, type: p.Type, full: p.FullName });
    }
  } catch (e) {}
  return r;
}

LogMessage("=== si_model_ref_dump ===");
var dirs = outRoot();
var report = {
  meta: {
    softimage: safe(function () { return Application.Version(); }, null),
    script: "si_model_ref_dump.js",
    purpose: "Create/Modify Model referenced-model + delta semantics (headless)",
    out: "%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\si_model_ref_golden.json",
    ref_dir: dirs.ref
  },
  cases: {},
  errors: []
};

NewScene(null, false);

// Create local model with a cube
report.cases.create_model = (function () {
  var entry = { leaf: "Create/Model/New Model" };
  try {
    var c = CreatePrim("Cube", "MeshSurface", null, null);
    var cube = Dictionary.GetObject(c.Name || String(c));
    var m = CreateModel(cube, "DumpModel", null, null);
    var model = Dictionary.GetObject(m.Name || String(m));
    entry.ok = true;
    entry.model = model.Name;
    entry.children = listChildren(model);
    entry.props = listProps(model);
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

var modelName = report.cases.create_model.model || "DumpModel";
var emdlPath = dirs.ref + "\\DumpModel.emdl";

report.cases.export_model = (function () {
  var entry = { leaf: "File/Export Model (support)", path: emdlPath };
  try {
    SelectObj(modelName);
    try {
      ExportModel(modelName, emdlPath, true);
    } catch (e1) {
      // Some builds want different arity
      Application.ExecuteCommand("ExportModel", [modelName, emdlPath, true]);
    }
    entry.ok = true;
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    entry.exists = fso.FileExists(emdlPath);
    if (entry.exists) entry.size = fso.GetFile(emdlPath).Size;
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

report.cases.convert_to_ref = (function () {
  var entry = { leaf: "Modify/Model/Convert To Reference..." };
  try {
    SelectObj(modelName);
    try {
      ConvertToRefModel(modelName, emdlPath, 65535);
    } catch (e1) {
      Application.ExecuteCommand("ConvertToRefModel", [modelName, emdlPath, 65535]);
    }
    var model = Dictionary.GetObject(modelName);
    entry.ok = true;
    entry.model = modelName;
    entry.children_after = listChildren(model);
    entry.props = listProps(model);
    // Softimage referenced model often exposes Resolutions / ExternalFiles parameters
    entry.model_params = safe(function () {
      var r = {};
      try {
        var e = new Enumerator(model.Parameters);
        for (; !e.atEnd(); e.moveNext()) {
          var p = e.item();
          r[String(p.ScriptName || p.Name)] = safe(function () { return String(p.Value); }, null);
        }
      } catch (e2) {}
      return r;
    }, {});
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

report.cases.set_resolution_offloaded = (function () {
  var entry = { leaf: "Modify/Model/Set Resolution/OffLoaded" };
  try {
    SelectObj(modelName);
    try { SetResolutionOfRefModels(modelName, 0); }
    catch (e1) { Application.ExecuteCommand("SetResolutionOfRefModels", [modelName, 0]); }
    var model = Dictionary.GetObject(modelName);
    entry.ok = true;
    entry.children = listChildren(model);
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

report.cases.set_resolution_first = (function () {
  var entry = { leaf: "Modify/Model/Set Resolution/First Resolution" };
  try {
    SelectObj(modelName);
    try { SetResolutionOfRefModels(modelName, 1); }
    catch (e1) { Application.ExecuteCommand("SetResolutionOfRefModels", [modelName, 1]); }
    var model = Dictionary.GetObject(modelName);
    entry.ok = true;
    entry.children = listChildren(model);
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

report.cases.update_ref = (function () {
  var entry = { leaf: "Modify/Model/Update Referenced Model" };
  try {
    SelectObj(modelName);
    try { UpdateReferencedModel(modelName); }
    catch (e1) { Application.ExecuteCommand("UpdateReferencedModel", [modelName]); }
    entry.ok = true;
    entry.children = listChildren(Dictionary.GetObject(modelName));
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

report.cases.add_empty_delta = (function () {
  var entry = { leaf: "Modify/Model/Add Empty Delta" };
  try {
    SelectObj(modelName);
    try { AddDelta(modelName); }
    catch (e1) { Application.ExecuteCommand("AddDelta", [modelName]); }
    entry.ok = true;
    entry.props = listProps(Dictionary.GetObject(modelName));
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

var deltaPath = dirs.ref + "\\DumpModel.delta";
report.cases.export_delta = (function () {
  var entry = { leaf: "Modify/Model/Export Delta", path: deltaPath };
  try {
    SelectObj(modelName);
    // Softimage delta export — try common command signatures
    try { ExportDelta(null, deltaPath); }
    catch (e1) {
      try { ExportDelta(modelName, deltaPath); }
      catch (e2) { Application.ExecuteCommand("ExportDelta", [null, deltaPath]); }
    }
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    entry.ok = true;
    entry.exists = fso.FileExists(deltaPath);
    if (entry.exists) {
      entry.size = fso.GetFile(deltaPath).Size;
      // If text-ish, sample first bytes as string note
      try {
        var ts = fso.OpenTextFile(deltaPath, 1);
        entry.head = ts.Read(Math.min(400, entry.size));
        ts.Close();
      } catch (e3) { entry.binary = true; }
    }
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

report.cases.empty_ref_model = (function () {
  var entry = { leaf: "Create/Model/New Empty Referenced Model" };
  try {
    NewScene(null, false);
    var path = dirs.ref + "\\EmptyRef.emdl";
    try { CreateEmptyRefModel(path, "EmptyRef", "res1", null); }
    catch (e1) { Application.ExecuteCommand("CreateEmptyRefModel", [path, "EmptyRef", "res1", null]); }
    entry.ok = true;
    entry.selection = safe(function () { return Selection(0).Name; }, null);
    entry.props = safe(function () { return listProps(Selection(0)); }, []);
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

report.cases.make_local = (function () {
  var entry = { leaf: "Modify/Model/Make Referenced Model Local" };
  try {
    // Re-create a referenced model then make local
    NewScene(null, false);
    var c = CreatePrim("Cube", "MeshSurface", null, null);
    var cube = Dictionary.GetObject(c.Name || String(c));
    var m = CreateModel(cube, "LocalizeMe", null, null);
    var model = Dictionary.GetObject(m.Name || String(m));
    try { ConvertToRefModel(model.Name, emdlPath, 65535); } catch (e0) {}
    try { MakeModelLocal(model.Name); }
    catch (e1) { Application.ExecuteCommand("MakeModelLocal", [model.Name]); }
    entry.ok = true;
    entry.children = listChildren(Dictionary.GetObject(model.Name));
    entry.props = listProps(Dictionary.GetObject(model.Name));
  } catch (e) { entry.ok = false; entry.error = e.description || String(e); }
  return entry;
})();

writeJson("si_model_ref_golden.json", report);
NewScene(null, false);
LogMessage("DUMP DONE ref");
