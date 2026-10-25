// Softimage 2015 SP2 - Render fidelity dump (XSIBATCH or Desktop). ASCII only.
// Writes Documents\softimage_dump_factory\render\si_render_*.json

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
function renderDir() {
  var shell = new ActiveXObject("WScript.Shell");
  var docs = shell.SpecialFolders("MyDocuments");
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var root = docs + "\\softimage_dump_factory"; if (!fso.FolderExists(root)) fso.CreateFolder(root);
  var ren = root + "\\render"; if (!fso.FolderExists(ren)) fso.CreateFolder(ren);
  return ren;
}
function writeJson(name, obj) {
  var path = renderDir() + "\\" + name;
  var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(path, true);
  f.Write(enc(obj)); f.Close(); LogMessage("wrote " + path); return path;
}
function dumpParams(o, depth) {
  if (depth === undefined) depth = 0;
  if (!o || depth > 6) return null;
  var item = {
    name: safe(function(){ return o.Name; }, null),
    full: safe(function(){ return o.FullName; }, null),
    classname: safe(function(){ return ClassName(o); }, null),
    type: safe(function(){ return o.Type; }, null),
    nested: []
  };
  try {
    var e = new Enumerator(o.Parameters);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      item.nested.push({
        name: safe(function(){ return p.Name; }, null),
        sn: safe(function(){ return p.ScriptName; }, null),
        classname: "Parameter",
        value: safe(function(){
          var v = p.Value;
          if (typeof v == "object" && v !== null) return String(v);
          return v;
        }, null),
        valuetype: safe(function(){ return p.ValueType; }, null)
      });
    }
  } catch (e1) {
    try {
      var e2 = new Enumerator(o);
      for (; !e2.atEnd(); e2.moveNext()) {
        item.nested.push(dumpParams(e2.item(), depth + 1));
      }
    } catch (e3) {}
  }
  return item;
}
function dumpParamsMap(o) {
  var m = {};
  try {
    var e = new Enumerator(o.Parameters);
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      var k = String(p.ScriptName || p.Name).toLowerCase();
      m[k] = safe(function(){
        var v = p.Value;
        if (typeof v == "object" && v !== null) return String(v);
        return v;
      }, null);
    }
  } catch (e) {}
  return m;
}
function tryGet(path) {
  try { return Dictionary.GetObject(path); } catch (e) { return null; }
}

LogMessage("=== si_render_fidelity_dump START ===");
var meta = {
  softimage: safe(function(){ return Application.Version(); }, null),
  script: "si_render_fidelity_dump.js",
  utc: safe(function(){ return new Date().toUTCString(); }, null)
};

try { NewScene(null, false); } catch (eNS) {}

// ========== 1 Render prefs / options ==========
var prefs = {
  meta: meta,
  purpose: "Render prefs / pass-related preference keys + RenderOptions",
  preference_keys: {},
  preference_objects: {},
  render_options_paths: [],
  errors: []
};
var prefKeys = [
  "rendering", "Rendering", "render", "Render",
  "rendering.mentalray", "rendering.hardware", "rendering.output",
  "rendering.region", "rendering.passes"
];
for (var pi = 0; pi < prefKeys.length; pi++) {
  var pk = prefKeys[pi];
  prefs.preference_keys[pk] = safe(function(){
    return String(Preferences.GetPreferenceValue(pk));
  }, null);
  try {
    var po = Preferences(pk);
    prefs.preference_objects[pk] = dumpParams(po, 0);
  } catch (eP) {
    prefs.preference_objects[pk] = { error: String(eP.description || eP.message) };
  }
}
// Walk Preferences categories for render*
try {
  var pe = new Enumerator(Preferences);
  for (; !pe.atEnd(); pe.moveNext()) {
    var cat = pe.item();
    var cn = String(cat.Name || "");
    if (cn.toLowerCase().indexOf("render") >= 0) {
      prefs.preference_objects["enum:" + cn] = dumpParams(cat, 0);
    }
  }
} catch (ePrefEnum) { prefs.errors.push("pref enum: " + (ePrefEnum.description || ePrefEnum.message)); }

var optPaths = [
  "Passes.RenderOptions", "Pass.RenderOptions", "RenderOptions",
  "Passes.Default_Pass.RenderOptions", "Default_Pass.RenderOptions",
  "Scene.RenderOptions"
];
for (var oi = 0; oi < optPaths.length; oi++) {
  var op = tryGet(optPaths[oi]);
  prefs.render_options_paths.push({
    path: optPaths[oi],
    found: !!op,
    dump: op ? dumpParams(op, 0) : null,
    params_map: op ? dumpParamsMap(op) : null
  });
}
writeJson("si_render_prefs.json", prefs);

// ========== 2 Material Phong nested OM ==========
var mat = {
  meta: meta,
  purpose: "Phong (or attested default) material nested Parameter schema",
  steps: [],
  material: null,
  shader: null,
  errors: []
};
var mesh = null;
try {
  CreatePrim("Cube", "MeshSurface");
  mesh = Selection(0);
  mat.steps.push({ name: "CreatePrim_Cube", ok: true, obj: mesh.Name });
} catch (eM) { mat.errors.push("cube: " + (eM.description || eM.message)); }

var phongOk = false;
var phongAttempts = [];
if (mesh) {
  var attempts = [
    function(){ SelectObj(mesh); return ApplyShader("Phong", "", mesh, "", siUnspecified); },
    function(){ SelectObj(mesh); return SIApplyShader("Phong", mesh); },
    function(){ return CreateShaderFromPreset("Phong", mesh); },
    function(){ SelectObj(mesh); return Application.ExecuteCommand("ApplyShader", ["Phong", "", mesh.FullName]); },
    function(){ SelectObj(mesh); return BlendInPresets("Phong", null, true); },
    function(){ return AssignMaterial("Sources.Materials.DefaultLib.Scene_Material", mesh); }
  ];
  for (var ai = 0; ai < attempts.length; ai++) {
    try {
      var ar = attempts[ai]();
      phongAttempts.push({ i: ai, ok: true, result: safe(function(){ return String(ar); }, null) });
      phongOk = true; break;
    } catch (eA) {
      phongAttempts.push({ i: ai, ok: false, error: String(eA.description || eA.message) });
    }
  }
}
mat.steps.push({ name: "ApplyPhong", ok: phongOk, attempts: phongAttempts });

try {
  var matProp = null;
  try { matProp = mesh.Material; } catch (e1) {}
  if (!matProp) {
    try {
      var e = new Enumerator(mesh.Properties);
      for (; !e.atEnd(); e.moveNext()) {
        var p = e.item();
        if (String(ClassName(p)).toLowerCase().indexOf("material") >= 0 || String(p.Name).toLowerCase().indexOf("material") >= 0) {
          matProp = p; break;
        }
      }
    } catch (e2) {}
  }
  mat.material = {
    full: safe(function(){ return matProp ? matProp.FullName : null; }, null),
    classname: safe(function(){ return matProp ? ClassName(matProp) : null; }, null),
    name: safe(function(){ return matProp ? matProp.Name : null; }, null),
    nested: matProp ? dumpParams(matProp, 0) : null,
    params_map: matProp ? dumpParamsMap(matProp) : null,
    shaders: safe(function(){
      var out = [];
      var se = new Enumerator(matProp.Shaders);
      for (; !se.atEnd(); se.moveNext()) {
        var sh = se.item();
        out.push({
          name: sh.Name, full: sh.FullName, classname: ClassName(sh), type: safe(function(){return sh.Type;},null),
          nested: dumpParams(sh, 0),
          params_map: dumpParamsMap(sh)
        });
      }
      return out;
    }, []),
    all_properties: safe(function(){
      var names = []; var e = new Enumerator(mesh.Properties);
      for (; !e.atEnd(); e.moveNext()) names.push(e.item().Name + ":" + ClassName(e.item()));
      return names;
    }, [])
  };
  // Also dump Scene_Material library default
  mat.scene_material = safe(function(){
    var sm = tryGet("Sources.Materials.DefaultLib.Scene_Material");
    if (!sm) sm = tryGet("Sources.Materials.DefaultLib.Material");
    return sm ? { full: sm.FullName, classname: ClassName(sm), nested: dumpParams(sm, 0), params_map: dumpParamsMap(sm), shaders: (function(){
      var out=[]; try{ var se=new Enumerator(sm.Shaders); for(;!se.atEnd();se.moveNext()){ var sh=se.item(); out.push({name:sh.Name,full:sh.FullName,classname:ClassName(sh),nested:dumpParams(sh,0),params_map:dumpParamsMap(sh)});}}catch(e){} return out;
    })() } : null;
  }, null);
} catch (eMat) { mat.errors.push("material probe: " + (eMat.description || eMat.message)); }
writeJson("si_render_material_phong.json", mat);

// ========== 3 Pass / partition list ==========
var passes = {
  meta: meta,
  purpose: "Pass/partition list empty scene + after CreatePass",
  before: null,
  after_create: null,
  current_pass: null,
  errors: []
};
function listPasses() {
  var out = { passes: [], partitions: [], current: null };
  try {
    out.current = safe(function(){ return String(PassContainer.ActivePass || GetCurrentPass()); }, null);
  } catch (eC) {
    out.current = safe(function(){ return String(Dictionary.GetObject("Passes").Current); }, null);
  }
  try {
    var pc = Application.ActiveProject.ActiveScene.Passes;
    var e = new Enumerator(pc);
    for (; !e.atEnd(); e.moveNext()) {
      var pass = e.item();
      var prow = {
        name: safe(function(){ return pass.Name; }, null),
        full: safe(function(){ return pass.FullName; }, null),
        classname: safe(function(){ return ClassName(pass); }, null),
        type: safe(function(){ return pass.Type; }, null),
        nested: dumpParams(pass, 0),
        params_map: dumpParamsMap(pass),
        partitions: []
      };
      try {
        var pe = new Enumerator(pass.Partitions);
        for (; !pe.atEnd(); pe.moveNext()) {
          var part = pe.item();
          prow.partitions.push({
            name: part.Name, full: part.FullName, classname: ClassName(part),
            nested: dumpParams(part, 0), params_map: dumpParamsMap(part)
          });
        }
      } catch (ePart) {
        try {
          var pe2 = new Enumerator(pass);
          for (; !pe2.atEnd(); pe2.moveNext()) {
            var ch = pe2.item();
            if (String(ClassName(ch)).toLowerCase().indexOf("partition") >= 0) {
              prow.partitions.push({ name: ch.Name, full: ch.FullName, classname: ClassName(ch) });
            }
          }
        } catch (eP2) {}
      }
      out.passes.push(prow);
    }
  } catch (ePass) {
    out.error = String(ePass.description || ePass.message);
    // Fallback paths
    var paths = ["Passes", "Passes.Default_Pass", "Default_Pass"];
    for (var i = 0; i < paths.length; i++) {
      var o = tryGet(paths[i]);
      if (o) out.passes.push({ path: paths[i], name: o.Name, full: o.FullName, classname: ClassName(o), nested: dumpParams(o, 0) });
    }
  }
  return out;
}
passes.before = listPasses();
passes.current_pass = safe(function(){
  var cp = GetValue("Passes.Current");
  return String(cp);
}, null);

var createAttempts = [];
try {
  var np = CreatePass();
  createAttempts.push({ via: "CreatePass()", ok: true, result: String(np) });
} catch (e1) {
  createAttempts.push({ via: "CreatePass()", ok: false, error: String(e1.description || e1.message) });
  try {
    var np2 = Application.ExecuteCommand("CreatePass", []);
    createAttempts.push({ via: "ExecuteCommand CreatePass", ok: true, result: String(np2) });
  } catch (e2) {
    createAttempts.push({ via: "ExecuteCommand CreatePass", ok: false, error: String(e2.description || e2.message) });
    try {
      var np3 = SICreatePass(null, "Pass1");
      createAttempts.push({ via: "SICreatePass", ok: true, result: String(np3) });
    } catch (e3) {
      createAttempts.push({ via: "SICreatePass", ok: false, error: String(e3.description || e3.message) });
    }
  }
}
passes.create_attempts = createAttempts;
passes.after_create = listPasses();
writeJson("si_render_passes.json", passes);

// ========== 4 Render region ==========
var region = {
  meta: meta,
  purpose: "Render region size/channels if dumpable",
  probes: [],
  errors: []
};
var regionPaths = [
  "Camera.RenderRegion", "Camera.root.RenderRegion",
  "Passes.RenderOptions", "RenderOptionsRegion",
  "Preferences.rendering.region"
];
for (var ri = 0; ri < regionPaths.length; ri++) {
  var ro = tryGet(regionPaths[ri]);
  region.probes.push({
    path: regionPaths[ri],
    found: !!ro,
    dump: ro ? dumpParams(ro, 0) : null,
    params_map: ro ? dumpParamsMap(ro) : null
  });
}
// Commands related to region
var regionCmds = ["RenderRegion", "ToggleRenderRegion", "RefreshRenderRegion", "CreateRenderRegion", "RenderRegionOptions"];
region.commands = {};
for (var rci = 0; rci < regionCmds.length; rci++) {
  var rcn = regionCmds[rci];
  region.commands[rcn] = safe(function(){
    var c = Application.Commands(rcn);
    return { found: !!c, enabled: c ? c.Enabled : null, description: c ? c.Description : null };
  }, { found: false });
}
// Camera render options
try {
  var cam = Dictionary.GetObject("Camera");
  region.camera = {
    full: cam.FullName,
    classname: ClassName(cam),
    children: safe(function(){
      var a=[]; var e=new Enumerator(cam); for(;!e.atEnd();e.moveNext()) a.push(e.item().Name+":"+ClassName(e.item())); return a;
    }, []),
    params_map: dumpParamsMap(cam)
  };
} catch (eCam) { region.errors.push("camera: " + (eCam.description || eCam.message)); }
// ActiveCamera interest
try {
  var ac = Application.ActiveProject.ActiveScene.ActiveCamera;
  if (!ac) ac = Dictionary.GetObject("Camera");
  region.active_camera = { full: ac.FullName, classname: ClassName(ac) };
  try {
    var e = new Enumerator(ac.Properties);
    region.active_camera_properties = [];
    for (; !e.atEnd(); e.moveNext()) {
      var p = e.item();
      var pn = String(p.Name);
      if (pn.toLowerCase().indexOf("render") >= 0 || pn.toLowerCase().indexOf("region") >= 0) {
        region.active_camera_properties.push({ name: pn, full: p.FullName, classname: ClassName(p), nested: dumpParams(p, 0), params_map: dumpParamsMap(p) });
      }
    }
  } catch (eAP) {}
} catch (eAC) { region.errors.push("active camera: " + (eAC.description || eAC.message)); }
writeJson("si_render_region.json", region);

// ========== 5 Framebuffer / output enums ==========
var fb = {
  meta: meta,
  purpose: "Framebuffer / output format enums + RenderFramebuffer OM",
  framebuffers: [],
  enums: {},
  errors: []
};
try {
  var passList = passes.after_create.passes.length ? passes.after_create.passes : passes.before.passes;
  for (var fi = 0; fi < passList.length; fi++) {
    var pf = passList[fi];
    var passObj = tryGet(pf.full || ("Passes." + pf.name));
    if (!passObj) continue;
    var frow = { pass: pf.full || pf.name, buffers: [] };
    try {
      var fe = new Enumerator(passObj.Framebuffers);
      for (; !fe.atEnd(); fe.moveNext()) {
        var buf = fe.item();
        frow.buffers.push({
          name: buf.Name, full: buf.FullName, classname: ClassName(buf),
          nested: dumpParams(buf, 0), params_map: dumpParamsMap(buf)
        });
      }
    } catch (eFB) {
      frow.framebuffer_error = String(eFB.description || eFB.message);
      // try children
      try {
        var ce = new Enumerator(passObj);
        for (; !ce.atEnd(); ce.moveNext()) {
          var ch = ce.item();
          if (String(ClassName(ch)).toLowerCase().indexOf("framebuffer") >= 0 || String(ch.Name).toLowerCase().indexOf("framebuffer") >= 0) {
            frow.buffers.push({ name: ch.Name, full: ch.FullName, classname: ClassName(ch), nested: dumpParams(ch, 0) });
          }
        }
      } catch (eCH) {}
    }
    fb.framebuffers.push(frow);
  }
} catch (eF) { fb.errors.push("fb walk: " + (eF.description || eF.message)); }

// Softimage enum probes via GetValue / si* constants if exposed
var enumNames = [
  "siRenderFieldType", "siRenderChannelType", "siImageFileType",
  "siRenderingType", "siRenderRegionDisplayMode"
];
for (var ei = 0; ei < enumNames.length; ei++) {
  var en = enumNames[ei];
  fb.enums[en] = safe(function(){ return String(eval(en)); }, null);
}
// Also dump RenderFramebuffer.spdl-related defaults from a created framebuffer if any
fb.spdl_hint = ["RenderFramebuffer.spdl", "RenderOptionsRegion.spdl", "RenderPass.spdl", "C3DPrefsRendering.spdl"];
writeJson("si_render_framebuffer_enums.json", fb);

// Summary index
var summary = {
  meta: meta,
  files: [
    "si_render_prefs.json",
    "si_render_material_phong.json",
    "si_render_passes.json",
    "si_render_region.json",
    "si_render_framebuffer_enums.json"
  ],
  material_apply_ok: phongOk,
  n_passes_before: safe(function(){ return passes.before.passes.length; }, 0),
  n_passes_after: safe(function(){ return passes.after_create.passes.length; }, 0),
  n_framebuffers: safe(function(){
    var n=0; for (var i=0;i<fb.framebuffers.length;i++) n += fb.framebuffers[i].buffers.length; return n;
  }, 0)
};
writeJson("si_render_dump_summary.json", summary);

var done = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(renderDir() + "\\render_dump_done.flag", true);
done.Write(enc(summary)); done.Close();
LogMessage("=== si_render_fidelity_dump DONE ===");
0;