// Softimage 2015 SP2 - Animation / Mixer / FCurve headless dump
// Safe for: XSIBATCH -processing  (no Desktop / no computer-use)
//
// Writes under Documents\softimage_dump_factory\anim\:
//   si_anim_commands.json
//   si_anim_fcurve_golden.json
//   si_anim_mixer_snapshot.json
//   si_anim_prefs.json
//
// Usage:
//   call "%SIROOT%\Application\bin\XSIBATCH.bat" -processing -script si_anim_dump.js -lang JScript

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

function safe(fn, def) {
  try { return fn(); } catch (e) { return def; }
}

function outDir() {
  var shell = new ActiveXObject("WScript.Shell");
  var docs = shell.SpecialFolders("MyDocuments");
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = docs + "\\softimage_dump_factory";
  if (!fso.FolderExists(root)) fso.CreateFolder(root);
  var anim = root + "\\anim";
  if (!fso.FolderExists(anim)) fso.CreateFolder(anim);
  return anim;
}

function writeJson(name, obj) {
  var path = outDir() + "\\" + name;
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var f = fso.CreateTextFile(path, true);
  f.Write(enc(obj));
  f.Close();
  LogMessage("wrote " + path);
  return path;
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

function catMatches(cat) {
  var s = String(cat || "").toLowerCase();
  // Softimage categories for Animate surface (not Model module prefix)
  var keys = [
    "animation", "action", "mixer", "fcurve", "f-curve", "key", "envelope",
    "shape", "character", "skeleton", "constraint", "plot", "dop", "playback",
    "transport", "marking", "motor", "device", "path", "deformation"
  ];
  for (var i = 0; i < keys.length; i++) {
    if (s.indexOf(keys[i]) >= 0) return true;
  }
  return false;
}

function dumpAnimCommands() {
  var byCat = {};
  var all = [];
  var e = new Enumerator(Application.Commands);
  for (; !e.atEnd(); e.moveNext()) {
    var c = e.item();
    var d = dumpCommand(c);
    if (!catMatches(d.category) && !catMatches(d.name) && !catMatches(d.scripting)) continue;
    var cat = d.category || "(none)";
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(d);
    all.push(d);
  }
  var cats = [];
  for (var k in byCat) cats.push(k);
  cats.sort();
  return {
    meta: {
      softimage: Application.Version(),
      script: "si_anim_dump.js",
      mode: "XSIBATCH -processing",
      note: "Commands whose Category/Name/ScriptingName match anim/mixer/fcurve/key/envelope/shape/action/etc."
    },
    category_count: cats.length,
    command_count: all.length,
    categories: cats,
    by_category: byCat
  };
}

function dumpPrefCategory(fullName) {
  var out = { name: fullName, params: {}, error: null };
  try {
    var cat = Application.Preferences.Categories(fullName);
    var e = new Enumerator(cat.Parameters);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      var sn = safe(function () { return p.ScriptName || p.Name; }, null);
      var v = safe(function () {
        var val = p.Value;
        if (typeof val == "object" && val !== null) return String(val);
        return val;
      }, null);
      if (sn) out.params[String(sn)] = v;
    }
  } catch (e) {
    out.error = safe(function () { return e.description; }, String(e));
  }
  return out;
}

function dumpAnimPrefs() {
  var names = [
    "preferences.animation_editor",
    "preferences.animation_mixer",
    "preferences.fcurve_editor",
    "preferences.dopesheet",
    "preferences.keying_panel",
    "preferences.layercontrol",
    "preferences.camera_sequencer"
  ];
  var cats = [];
  for (var i = 0; i < names.length; i++) cats.push(dumpPrefCategory(names[i]));
  return {
    meta: { softimage: Application.Version(), script: "si_anim_dump.js" },
    categories: cats
  };
}

function dumpFCurveKeys(fc) {
  var keys = [];
  try {
    var n = fc.Keys.Count;
    for (var i = 0; i < n; i++) {
      var k = fc.Keys(i);
      keys.push({
        time: safe(function () { return Number(k.Time); }, null),
        value: safe(function () { return Number(k.Value); }, null),
        left: safe(function () { return Number(k.Left); }, null),
        right: safe(function () { return Number(k.Right); }, null),
        constr: safe(function () { return k.Constraint; }, null),
        interp: safe(function () { return k.Interpolation; }, null)
      });
    }
  } catch (e) {}
  return {
    name: safe(function () { return fc.Name; }, null),
    extrap: safe(function () { return fc.Extrapolation; }, null),
    key_count: keys.length,
    keys: keys
  };
}

function runFCurveGolden() {
  var report = {
    meta: {
      softimage: Application.Version(),
      script: "si_anim_dump.js",
      note: "Headless-safe: CreatePrim Null, key local.kine.local.posx at frames 1/10/20, dump FCurve keys + StoreAction snapshot."
    },
    steps: [],
    errors: []
  };

  var step = function (name, fn) {
    try {
      var r = fn();
      report.steps.push({ name: name, ok: true, result: r });
      return r;
    } catch (e) {
      var msg = safe(function () { return e.description; }, String(e));
      report.steps.push({ name: name, ok: false, error: msg });
      report.errors.push(name + ": " + msg);
      return null;
    }
  };

  // Fresh scene-ish: create null
  var nullObj = step("CreatePrim_Null", function () {
    return Application.CreatePrim("Null", "NurbsCurve");
  });
  // CreatePrim signature varies; fallback
  if (!nullObj) {
    nullObj = step("GetPrim_Null", function () {
      return Application.GetPrim("Null");
    });
  }

  var target = null;
  step("Resolve_Null", function () {
    // Prefer selection
    if (Selection.Count > 0) {
      target = Selection(0);
      return { name: target.FullName, via: "selection" };
    }
    // Find last null-like
    var e = new Enumerator(Application.ActiveSceneRoot.Children);
    var last = null;
    for (; !e.atEnd(); e.moveNext()) last = e.item();
    target = last;
    return { name: target ? target.FullName : null, via: "scene_root_last" };
  });

  if (!target) {
    report.errors.push("no target object for keying");
    return report;
  }

  var posx = step("Find_posx", function () {
    return target.Kinematics.Local.Parameters("posx");
  });
  if (!posx) {
    report.errors.push("no posx");
    return report;
  }

  step("Set_playrange", function () {
    Application.SetValue("PlayControl.In", 1);
    Application.SetValue("PlayControl.Out", 30);
    Application.SetValue("PlayControl.Current", 1);
    return { play_in: 1, play_out: 30 };
  });

  var keyAt = function (frame, value) {
    return step("Key_frame_" + frame, function () {
      Application.SetValue("PlayControl.Current", frame);
      posx.Value = value;
      // SaveKey on parameter
      try {
        Application.SaveKey(posx);
      } catch (e1) {
        // Alternate: SaveKey with string path
        Application.SaveKey(posx.FullName);
      }
      return { frame: frame, value: value, full: posx.FullName };
    });
  };

  keyAt(1, 0);
  keyAt(10, 5);
  keyAt(20, 0);

  step("Dump_FCurve", function () {
    var src = posx.Source;
    report.param = {
      full: posx.FullName,
      value: Number(posx.Value),
      source_classname: safe(function () { return Application.ClassName(src); }, null),
      is_animated: safe(function () { return posx.IsAnimated(); }, null)
    };
    var fc = null;
    try { fc = src; } catch (e) {}
    // If source is an FCurve
    var dumped = null;
    try {
      dumped = dumpFCurveKeys(src);
    } catch (e2) {
      // Try .FCurve property
      try { dumped = dumpFCurveKeys(src.FCurve); } catch (e3) {
        dumped = { error: safe(function () { return e3.description; }, String(e3)) };
      }
    }
    report.fcurve = dumped;
    return dumped;
  });

  step("StoreAction", function () {
    // StoreAction on marked/animated params of target
    var act = null;
    try {
      act = Application.StoreAction(target, "", 2, false, false, false, true);
    } catch (e1) {
      try {
        act = Application.StoreAction(target);
      } catch (e2) {
        throw e2;
      }
    }
    report.action = {
      name: safe(function () { return act.Name; }, null),
      full: safe(function () { return act.FullName; }, null),
      classname: safe(function () { return Application.ClassName(act); }, null)
    };
    return report.action;
  });

  step("Mixer_probe", function () {
    // Mixer exists on model; ActiveSceneRoot often has Mixer
    var mixer = null;
    try { mixer = target.Model.Mixer; } catch (e1) {}
    if (!mixer) {
      try { mixer = Application.ActiveSceneRoot.Mixer; } catch (e2) {}
    }
    report.mixer = {
      present: !!mixer,
      name: safe(function () { return mixer.Name; }, null),
      full: safe(function () { return mixer.FullName; }, null),
      classname: safe(function () { return Application.ClassName(mixer); }, null),
      nested: safe(function () {
        var kids = [];
        var e = new Enumerator(mixer.NestedObjects);
        for (; !e.atEnd(); e.moveNext()) {
          var o = e.item();
          kids.push({
            name: safe(function () { return o.Name; }, null),
            classname: safe(function () { return Application.ClassName(o); }, null)
          });
        }
        return kids;
      }, [])
    };
    return report.mixer;
  });

  return report;
}

LogMessage("si_anim_dump: start");
writeJson("si_anim_commands.json", dumpAnimCommands());
writeJson("si_anim_prefs.json", dumpAnimPrefs());
writeJson("si_anim_fcurve_golden.json", runFCurveGolden());
// Mixer snapshot is embedded in fcurve golden; also emit slim prefs+command index
writeJson("si_anim_mixer_snapshot.json", {
  meta: {
    softimage: Application.Version(),
    script: "si_anim_dump.js",
    note: "Mixer nested probe lives in si_anim_fcurve_golden.json; this file indexes mixer-related command categories + prefs."
  },
  prefs_file: "si_anim_prefs.json",
  fcurve_file: "si_anim_fcurve_golden.json",
  command_categories_hint: [
    "Animation Mixer",
    "Animation Mixer|Deformation",
    "Animation mixer",
    "Action"
  ]
});
LogMessage("si_anim_dump: DONE");
