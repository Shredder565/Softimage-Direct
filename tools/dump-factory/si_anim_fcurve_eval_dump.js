// Softimage 2015 SP2 — FCurve eval / tangent golden (XSIBATCH -processing, no desktop).
// Writes: Documents\softimage_dump_factory\anim\si_anim_fcurve_eval_golden.json
//
// Usage:
//   call "%SIROOT%\Application\bin\XSIBATCH.bat" -processing -script si_anim_fcurve_eval_dump.js -lang JScript
//   OR: Run-DumpFactory.bat anim

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

function dumpKey(k) {
  return {
    time: safe(function () { return k.Time; }, null),
    value: safe(function () { return k.Value; }, null),
    left: safe(function () { return k.Left; }, null),
    right: safe(function () { return k.Right; }, null),
    interp: safe(function () { return k.Interpolation; }, null),
    constr: safe(function () { return k.Constraint; }, null)
  };
}

function sampleParam(p, frames) {
  var out = [];
  for (var i = 0; i < frames.length; i++) {
    var f = frames[i];
    safe(function () { Dictionary.SetObject("PlayControl.Current", f); }, null);
    safe(function () { SetValue("PlayControl.Current", f); }, null);
    out.push({ frame: f, value: safe(function () { return p.Value; }, null) });
  }
  return out;
}

LogMessage("=== si_anim_fcurve_eval_dump ===");
var report = { meta: { softimage: safe(function () { return Application.Version(); }, null), script: "si_anim_fcurve_eval_dump.js" }, cases: [], errors: [] };

try {
  NewScene(null, false);
} catch (e) { report.errors.push("NewScene: " + e.message); }

// Case A: default flat-tangent spline (matches prior key golden)
var nullA = null;
try {
  try { CreatePrim("Null", "NurbsCurve"); } catch (e1) { GetPrim("Null"); }
  nullA = Selection(0);
  var px = nullA.Parameters("kine.local.posx");
  SetValue(px.FullName, 0); SaveKey(px.FullName, 1);
  SetValue(px.FullName, 5); SaveKey(px.FullName, 10);
  SetValue(px.FullName, 0); SaveKey(px.FullName, 20);
  var fc = px.Source;
  var frames = []; for (var f = 1; f <= 20; f++) frames.push(f);
  report.cases.push({
    name: "flat_spline_posx",
    param: px.FullName,
    fcurve: {
      extrap: safe(function () { return fc.Extrapolation; }, null),
      key_count: safe(function () { return fc.Keys.Count; }, null),
      keys: (function () {
        var ks = []; var e = new Enumerator(fc.Keys); for (; !e.atEnd(); e.moveNext()) ks.push(dumpKey(e.item())); return ks;
      })()
    },
    samples: sampleParam(px, frames),
    mid_frames: sampleParam(px, [1, 5, 10, 15, 20])
  });
} catch (e) { report.errors.push("case A: " + e.message); }

// Case B: non-default Left/Right handles if OM allows
try {
  NewScene(null, false);
  try { GetPrim("Null"); } catch (e2) { CreatePrim("Null", "NurbsCurve"); }
  var n2 = Selection(0);
  var py = n2.Parameters("kine.local.posy");
  SetValue(py.FullName, 0); SaveKey(py.FullName, 1);
  SetValue(py.FullName, 10); SaveKey(py.FullName, 20);
  var fc2 = py.Source;
  try {
    var k0 = fc2.Keys(0); k0.Right = 4;
    var k1 = fc2.Keys(1); k1.Left = 6;
  } catch (e3) { report.errors.push("set handles: " + e3.message); }
  report.cases.push({
    name: "handled_spline_posy",
    param: py.FullName,
    fcurve: {
      extrap: safe(function () { return fc2.Extrapolation; }, null),
      key_count: safe(function () { return fc2.Keys.Count; }, null),
      keys: (function () {
        var ks = []; var e = new Enumerator(fc2.Keys); for (; !e.atEnd(); e.moveNext()) ks.push(dumpKey(e.item())); return ks;
      })()
    },
    samples: sampleParam(py, [1, 5, 10, 15, 20])
  });
} catch (e) { report.errors.push("case B: " + e.message); }

writeJson("si_anim_fcurve_eval_golden.json", report);
LogMessage("done errors=" + report.errors.length);
