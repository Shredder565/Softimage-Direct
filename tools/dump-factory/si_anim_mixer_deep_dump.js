// Softimage 2015 SP2 — Animation Mixer nested dump (XSIBATCH -processing).
// Writes: Documents\softimage_dump_factory\anim\si_anim_mixer_deep.json
// Stores two actions, AddClip, AddTransition if available, dumps Mixer children/params.
//
// Usage: Run-DumpFactory.bat anim   OR XSIBATCH -processing -script this file -lang JScript

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
function dumpNested(o, depth) {
  if (depth === undefined) depth = 0;
  if (!o || depth > 4) return null;
  var item = {
    name: safe(function () { return o.Name; }, null),
    full: safe(function () { return o.FullName; }, null),
    classname: safe(function () { return ClassName(o); }, null),
    nested: []
  };
  try {
    var e = new Enumerator(o);
    for (; !e.atEnd(); e.moveNext()) {
      var c = e.item();
      item.nested.push(dumpNested(c, depth + 1));
    }
  } catch (e1) {
    try {
      var e2 = new Enumerator(o.Parameters);
      for (; !e2.atEnd(); e2.moveNext()) {
        var p = e2.item();
        item.nested.push({
          name: safe(function () { return p.Name; }, null),
          classname: "Parameter",
          value: safe(function () { return p.Value; }, null)
        });
      }
    } catch (e3) {}
  }
  return item;
}

LogMessage("=== si_anim_mixer_deep_dump ===");
var report = { meta: { script: "si_anim_mixer_deep_dump.js", softimage: safe(function () { return Application.Version(); }, null) }, steps: [], mixer: null, errors: [] };

try { NewScene(null, false); } catch (e) { report.errors.push("NewScene: " + e.message); }
try {
  GetPrim("Null");
  var n = Selection(0);
  var px = n.Parameters("kine.local.posx");
  SetValue(px.FullName, 0); SaveKey(px.FullName, 1);
  SetValue(px.FullName, 4); SaveKey(px.FullName, 20);
  report.steps.push({ name: "key_null", ok: true });
} catch (e) { report.errors.push("key: " + e.message); }

try {
  var a1 = StoreAction(null, null, 1, "ActionA", true, 1, 20, false, false, true, 1, false);
  report.steps.push({ name: "StoreAction_A_AddClip", ok: true, result: safe(function () { return String(a1); }, null) });
} catch (e) { report.errors.push("StoreAction A: " + e.message); }

try {
  SetValue("null.kine.local.posx", 8); SaveKey("null.kine.local.posx", 30);
  var a2 = StoreAction(null, null, 1, "ActionB", true, 1, 40, false, false, true, 25, false);
  report.steps.push({ name: "StoreAction_B_AddClip", ok: true, result: safe(function () { return String(a2); }, null) });
} catch (e) { report.errors.push("StoreAction B: " + e.message); }

// Best-effort Softimage mixer transition / compound commands (names vary by SP)
var cmds = ["AddTransition", "AddBridgeTransition", "CreateCompound", "EqualizeClips"];
for (var i = 0; i < cmds.length; i++) {
  var cn = cmds[i];
  try {
    var r = Application.Commands(cn).Execute();
    report.steps.push({ name: cn, ok: true, result: safe(function () { return String(r); }, null) });
  } catch (e) {
    try {
      // some builds expose helpers without Commands collection Execute
      eval(cn + "()");
      report.steps.push({ name: cn, ok: true, via: "eval" });
    } catch (e2) {
      report.steps.push({ name: cn, ok: false, error: e.message });
    }
  }
}

try {
  var mix = Dictionary.GetObject("Mixer");
  if (!mix) mix = ActiveSceneRoot.Mixer;
  report.mixer = dumpNested(mix, 0);
  report.steps.push({ name: "Mixer_probe", ok: !!mix });
} catch (e) { report.errors.push("Mixer: " + e.message); }

writeJson("si_anim_mixer_deep.json", report);
LogMessage("done");
