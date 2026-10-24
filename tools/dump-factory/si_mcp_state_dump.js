// Softimage 2015 SP2 — optional MCP / selection / filter / preference state dump.
// Run with Softimage UI open (Alt+4 → Run). Headless XSIBATCH will still get
// preferences + filters; MCP button enablement needs the interactive Desktop.
// Output: Documents\softimage_dump_factory\si_mcp_state.json

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

function docsRoot() {
  var shell = new ActiveXObject("WScript.Shell");
  var docs = shell.SpecialFolders("MyDocuments");
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = docs + "\\softimage_dump_factory";
  if (!fso.FolderExists(root)) fso.CreateFolder(root);
  return root;
}

function safe(fn, def) {
  try { return fn(); } catch (e) { return def; }
}

function dumpFilters() {
  var out = [];
  try {
    var e = new Enumerator(Application.Filters);
    for (; !e.atEnd(); e.moveNext()) {
      var f = e.item();
      out.push({
        name: safe(function () { return f.Name; }, null),
        type: safe(function () { return f.Type; }, null)
      });
    }
  } catch (e) {}
  return out;
}

function dumpSelection() {
  var sel = [];
  try {
    var e = new Enumerator(Selection);
    for (; !e.atEnd(); e.moveNext()) {
      var o = e.item();
      sel.push({
        name: safe(function () { return o.Name; }, null),
        full: safe(function () { return o.FullName; }, null),
        type: safe(function () { return o.Type; }, null),
        classname: safe(function () { return Application.ClassName(o); }, null)
      });
    }
  } catch (e) {}
  return sel;
}

function dumpPrefsSample() {
  // A few prefs that gate MCP / transform / selection behaviour.
  var keys = [
    "Interaction.autoinspect",
    "Interaction.clicktodeselect",
    "SceneColor.wireframe",
    "Transform.transformrefmode"
  ];
  var out = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    out[k] = safe(function () { return GetValue("Preferences." + k); },
      safe(function () { return Application.Preferences.GetPreferenceValue(k); }, null));
  }
  // Prefer reading Categories when GetValue paths differ by install.
  try {
    var cats = Application.Preferences.Categories;
    var e = new Enumerator(cats);
    var names = [];
    for (; !e.atEnd(); e.moveNext()) names.push(e.item().FullName || e.item().Name);
    out._categories = names;
  } catch (e) {}
  return out;
}

function dumpUiShell() {
  return {
    version: safe(function () { return Application.Version(); }, null),
    layouts: safe(function () {
      var a = []; var e = new Enumerator(Application.Desktop.Layouts);
      for (; !e.atEnd(); e.moveNext()) a.push(e.item().Name); return a;
    }, []),
    active_layout: safe(function () { return Application.Desktop.ActiveLayout.Name; }, null),
    views: safe(function () {
      var a = []; var e = new Enumerator(Application.Desktop.ActiveLayout.Views);
      for (; !e.atEnd(); e.moveNext()) {
        var v = e.item();
        a.push({ name: v.Name, type: safe(function () { return v.Type; }, null) });
      }
      return a;
    }, [])
  };
}

LogMessage("si_mcp_state_dump: start");
// Build a tiny scene so selection/filter state is non-empty.
NewScene(null, false);
var cube = CreatePrim("Cube", "MeshSurface", null, null);
SelectObj(cube);

var out = {
  meta: {
    softimage: Application.Version(),
    script: "si_mcp_state_dump.js",
    note: "MCP button enable/grey rules still need observation or Ghidra; this dump captures filters, selection, prefs, layout shell."
  },
  ui: dumpUiShell(),
  selection: dumpSelection(),
  filters: dumpFilters(),
  preferences_sample: dumpPrefsSample()
};

var path = docsRoot() + "\\si_mcp_state.json";
var fso = new ActiveXObject("Scripting.FileSystemObject");
var f = fso.CreateTextFile(path, true);
f.Write(enc(out));
f.Close();
LogMessage("DUMP DONE -> " + path);
