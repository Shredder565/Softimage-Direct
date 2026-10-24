// Softimage 2015 SP2 — Envelope + Shape key dump (XSIBATCH -processing, no desktop).
// Writes: Documents\softimage_dump_factory\anim\si_anim_envelope_shape.json
//
// Creates a mesh + 2-bone chain, ApplyFlexEnv, dumps weights summary;
// StoreShapeKey / shape cluster if available.
// Usage: Run-DumpFactory.bat anim

function enc(v) {
  if (v === null || v === undefined) return "null";
  var t = typeof v;
  if (t == "number") return isFinite(v) ? String(v) : "null";
  if (t == "boolean") return v ? "true" : "false";
  if (t == "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n") + '"';
  if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(enc(v[i])); return "[" + a.join(",") + "]"; }
  var o = []; for (var k in v) o.push(enc(k) + ":" + enc(v[k])); return "{" + o.join(",") + "}";
}
function safe(fn, def) { try { return fn(); } catch (e) { return def; } }
function outDir() {
  var shell = new ActiveXObject("WScript.Shell");
  var docs = shell.SpecialFolders("MyDocuments");
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = docs + "\\softimage_dump_factory"; if (!fso.FolderExists(root)) fso.CreateFolder(root);
  var anim = root + "\\anim"; if (!fso.FolderExists(anim)) fso.CreateFolder(anim);
  return anim;
}
function writeJson(name, obj) {
  var path = outDir() + "\\" + name;
  var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(path, true);
  f.Write(enc(obj)); f.Close(); LogMessage("wrote " + path); return path;
}

LogMessage("=== si_anim_envelope_shape_dump ===");
var report = {
  meta: { script: "si_anim_envelope_shape_dump.js", softimage: safe(function () { return Application.Version(); }, null), note: "Headless envelope + shape probe for Softimage Direct goldens." },
  steps: [], envelope: null, shape: null, errors: []
};

try { NewScene(null, false); } catch (e) { report.errors.push("NewScene: " + e.message); }

var mesh = null, root = null;
try {
  CreatePrim("Cube", "MeshSurface");
  mesh = Selection(0);
  try { SetValue(mesh.FullName + ".polymsh.geom.subdivu", 3); SetValue(mesh.FullName + ".polymsh.geom.subdivv", 3); } catch (e0) {}
  report.steps.push({ name: "CreatePrim_Cube", ok: true, name_obj: mesh.Name });
} catch (e) { report.errors.push("mesh: " + e.message); }

try {
  // 2-bone chain along +Y
  Create2DSkeleton(0, 0, 0, 0, 2, 0, 0, 1, 0, 4);
  root = Selection(0);
  report.steps.push({ name: "Create2DSkeleton", ok: true, root: safe(function () { return root.Name; }, null) });
} catch (e) {
  try {
    GetPrim("Null", "boneA"); GetPrim("Null", "boneB");
    report.steps.push({ name: "Null_deformers_fallback", ok: true });
  } catch (e2) { report.errors.push("skeleton: " + e.message); }
}

try {
  SelectObj(mesh.FullName + "," + (root ? root.FullName : "boneA,boneB"));
  ApplyFlexEnv(null, false, null);
  report.steps.push({ name: "ApplyFlexEnv", ok: true });
} catch (e) { report.errors.push("ApplyFlexEnv: " + e.message); }

try {
  var envProp = null;
  try { envProp = mesh.Properties("Envelope_Weights"); } catch (e3) {}
  if (!envProp) {
    var e = new Enumerator(mesh.Properties);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      if (/envelope/i.test(String(p.Name)) || /envelope/i.test(String(ClassName(p)))) { envProp = p; break; }
    }
  }
  report.envelope = {
    property: safe(function () { return envProp ? envProp.FullName : null; }, null),
    classname: safe(function () { return envProp ? ClassName(envProp) : null; }, null),
    deformers: safe(function () {
      var d = []; var en = new Enumerator(envProp.Deformers); for (; !en.atEnd(); en.moveNext()) d.push(en.item().Name); return d;
    }, []),
    // sample a few point weights if API allows
    weight_samples: safe(function () {
      var samples = [];
      for (var i = 0; i < 5; i++) {
        samples.push({ point: i, weights: safe(function () { return String(envProp.Elements(i)); }, null) });
      }
      return samples;
    }, [])
  };
  report.steps.push({ name: "Envelope_probe", ok: !!envProp });
} catch (e) { report.errors.push("envelope probe: " + e.message); }

try {
  SelectObj(mesh.FullName);
  // Softimage StoreShapeKey scripting name / args vary; try a few
  var sk = null;
  try { sk = StoreShapeKey(mesh, null, 1, null, 0, 0, 0, false); }
  catch (e4) {
    try { sk = Application.Commands("StoreShapeKey").Execute(); } catch (e5) { throw e4; }
  }
  report.shape = {
    result: safe(function () { return String(sk); }, null),
    shapes: safe(function () {
      var out = []; var e = new Enumerator(mesh.ActivePrimitive.Geometry.Clusters);
      for (; !e.atEnd(); e.moveNext()) {
        var c = e.item();
        if (/shape/i.test(String(c.Name)) || /shape/i.test(String(ClassName(c)))) out.push({ name: c.Name, classname: ClassName(c) });
      }
      return out;
    }, [])
  };
  report.steps.push({ name: "StoreShapeKey", ok: true });
} catch (e) { report.errors.push("StoreShapeKey: " + e.message); report.steps.push({ name: "StoreShapeKey", ok: false, error: e.message }); }

writeJson("si_anim_envelope_shape.json", report);
LogMessage("done errors=" + report.errors.length);
