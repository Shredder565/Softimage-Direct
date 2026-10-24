// Softimage 2015 SP2 — dump module menus (Model/Animate/Render/Simulate/ICE/Hair)
// and main menubar leaves via the live OM when Softimage is open.
// Prefers file-based PE scrape when softimage-pc is online (see pe_scrape_module_menus.bat).
// This script fills gaps PE does not cover (toolbar module trees) by walking commands
// + any Desktop/layout menu collections Softimage exposes.
//
// Run: Alt+4 → Open → Edit > Run  (needs interactive Softimage for full Desktop menus)
// Output: Documents\softimage_dump_factory\si_menus_live.json
//         Documents\softimage_dump_factory\si_commands_by_category.json

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

function writeJson(name, obj) {
  var path = docsRoot() + "\\" + name;
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var f = fso.CreateTextFile(path, true);
  f.Write(enc(obj));
  f.Close();
  LogMessage("wrote " + path);
  return path;
}

function safe(fn, def) {
  try { return fn(); } catch (e) { return def; }
}

function dumpCommand(c) {
  var args = [];
  try {
    var e = new Enumerator(c.Arguments);
    for (; !e.atEnd(); e.moveNext()) {
      var a = e.item();
      args.push({
        name: safe(function () { return a.Name; }, null),
        value: safe(function () { return a.Value; }, null),
        flags: safe(function () { return a.Flags; }, null)
      });
    }
  } catch (e) {}
  return {
    name: safe(function () { return c.Name; }, null),
    scripting: safe(function () { return c.ScriptingName; }, null),
    category: safe(function () { return c.Category; }, null),
    description: safe(function () { return c.Description; }, null),
    tooltip: safe(function () { return c.Tooltip; }, null),
    enabled: safe(function () { return c.Enabled; }, null),
    args: args
  };
}

// Softimage module toolbar categories often appear as command Category prefixes.
var MODULES = ["Model", "Animate", "Render", "Simulate", "ICE", "Hair", "Hair|Fur", "FX"];

function categorizeCommands() {
  var byCat = {};
  var modules = {};
  for (var i = 0; i < MODULES.length; i++) modules[MODULES[i]] = [];
  var e = new Enumerator(Application.Commands);
  for (; !e.atEnd(); e.moveNext()) {
    var c = e.item();
    var d = dumpCommand(c);
    var cat = d.category || "(none)";
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(d);
    // Heuristic: Softimage stores module menu commands under categories like
    // "Model/Get/Primitive", "Render/Pass", "ICE/Create", "Hair/Create", …
    var top = String(cat).split("/")[0];
    if (modules[top]) modules[top].push(d);
  }
  return { by_category: byCat, by_module_prefix: modules };
}

function tryDumpDesktopMenus() {
  var info = {
    layouts: [],
    views: [],
    note: "Desktop menu trees vary by Softimage build; PE scrape is preferred for menubar leaves."
  };
  try {
    var layouts = Application.Desktop.Layouts;
    var e = new Enumerator(layouts);
    for (; !e.atEnd(); e.moveNext()) {
      info.layouts.push(safe(function () { return e.item().Name; }, null));
    }
  } catch (e) { info.layouts_error = e.description; }
  try {
    var views = Application.Desktop.ActiveLayout.Views;
    var e2 = new Enumerator(views);
    for (; !e2.atEnd(); e2.moveNext()) {
      var v = e2.item();
      info.views.push({
        name: safe(function () { return v.Name; }, null),
        type: safe(function () { return v.Type; }, null),
        classname: safe(function () { return Application.ClassName(v); }, null)
      });
    }
  } catch (e) { info.views_error = e.description; }
  return info;
}

function tryDumpPreferencesCategories() {
  var cats = [];
  try {
    var e = new Enumerator(Application.Preferences.Categories);
    for (; !e.atEnd(); e.moveNext()) cats.push(e.item().FullName || e.item().Name);
  } catch (e) {}
  return cats;
}

LogMessage("si_dump_menus: start");
var cmdDump = categorizeCommands();
writeJson("si_commands_by_category.json", {
  meta: { softimage: Application.Version(), script: "si_dump_menus.js" },
  module_prefixes: MODULES,
  counts: (function () {
    var c = {};
    for (var k in cmdDump.by_module_prefix) c[k] = cmdDump.by_module_prefix[k].length;
    return c;
  })(),
  by_module_prefix: cmdDump.by_module_prefix,
  categories: (function () {
    var keys = []; for (var k in cmdDump.by_category) keys.push(k); return keys.sort();
  })()
});

// Slimmer per-module file for Render/Simulate/ICE/Hair (the UI gap).
var gap = {};
var gapNames = ["Render", "Simulate", "ICE", "Hair", "Hair|Fur"];
for (var i = 0; i < gapNames.length; i++) {
  var n = gapNames[i];
  gap[n] = cmdDump.by_module_prefix[n] || [];
}
writeJson("si_module_commands_gap.json", {
  meta: {
    softimage: Application.Version(),
    note: "Commands whose Category top-level matches Render/Simulate/ICE/Hair. Merge with PE RT_MENU scrape of toolbar*.dll / XSI.exe for label trees + ids."
  },
  modules: gap
});

var live = {
  meta: { softimage: Application.Version(), script: "si_dump_menus.js" },
  desktop: tryDumpDesktopMenus(),
  preference_categories: tryDumpPreferencesCategories(),
  pe_scrape_hint: "Prefer pe_scrape_module_menus.bat against C:\\Program Files\\Autodesk\\Softimage 2015 SP2\\Application\\bin\\*.dll when softimage-pc is online."
};
writeJson("si_menus_live.json", live);
LogMessage("si_dump_menus: DONE");
