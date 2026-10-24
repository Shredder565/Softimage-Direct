// Softimage 2015 SP2 - .emdl / .delta binary fingerprints (size + first 64 bytes hex).
// Headless XSIBATCH -processing. ASCII-only.
// Output: Documents\softimage_dump_factory\model\si_emdl_delta_bytes.json
// Also writes ref\DumpModel.emdl and ref\DumpModel.delta when export succeeds.

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
  var root = docs + "\\softimage_dump_factory";
  if (!fso.FolderExists(root)) fso.CreateFolder(root);
  var model = root + "\\model";
  if (!fso.FolderExists(model)) fso.CreateFolder(model);
  var ref = model + "\\ref";
  if (!fso.FolderExists(ref)) fso.CreateFolder(ref);
  return { model: model, ref: ref };
}

function hexByte(b) {
  var h = "0123456789ABCDEF";
  return h.charAt((b >> 4) & 15) + h.charAt(b & 15);
}

function fingerprintFile(path, nbytes) {
  if (nbytes === undefined || nbytes === null) nbytes = 64;
  var fso = new ActiveXObject("Scripting.FileSystemObject");
  var entry = { path: path, exists: false, size: null, magic_hex: null, magic_ascii: null, read_via: null, error: null };
  try {
    entry.exists = fso.FileExists(path);
    if (!entry.exists) return entry;
    entry.size = fso.GetFile(path).Size;
    var n = Math.min(nbytes, entry.size);
    // Prefer ADODB.Stream binary read
    try {
      var stm = new ActiveXObject("ADODB.Stream");
      stm.Type = 1; // adTypeBinary
      stm.Open();
      stm.LoadFromFile(path);
      stm.Position = 0;
      var chunk = stm.Read(n);
      stm.Close();
      // Convert VT_ARRAY|UI1 via Scripting / mid-bytes
      var hex = [];
      var ascii = [];
      // ADODB returns a byte array variant; iterate via VBArray if available
      try {
        var arr = new VBArray(chunk).toArray();
        for (var i = 0; i < arr.length; i++) {
          var b = arr[i] & 255;
          hex.push(hexByte(b));
          ascii.push((b >= 32 && b < 127) ? String.fromCharCode(b) : ".");
        }
        entry.magic_hex = hex.join("");
        entry.magic_ascii = ascii.join("");
        entry.read_via = "ADODB.Stream+VBArray";
        return entry;
      } catch (eVb) {
        // Fallback: write temp and re-read as text with Charset (lossy) - avoid.
        // Use MSXML DOM hex binary instead.
        try {
          var xml = new ActiveXObject("MSXML2.DOMDocument.6.0");
          var node = xml.createElement("b");
          node.dataType = "bin.hex";
          node.nodeTypedValue = chunk;
          var hx = String(node.text || "");
          entry.magic_hex = hx.substring(0, n * 2).toUpperCase();
          entry.read_via = "ADODB.Stream+MSXML_bin.hex";
          var asc = [];
          for (var j = 0; j + 1 < entry.magic_hex.length; j += 2) {
            var bv = parseInt(entry.magic_hex.substring(j, j + 2), 16);
            asc.push((bv >= 32 && bv < 127) ? String.fromCharCode(bv) : ".");
          }
          entry.magic_ascii = asc.join("");
          return entry;
        } catch (eXml) {
          entry.error = "binary convert failed: " + String(eVb.description || eVb) + " / " + String(eXml.description || eXml);
        }
      }
    } catch (eAdo) {
      entry.error = "ADODB.Stream failed: " + String(eAdo.description || eAdo);
    }
    // Last resort: OpenTextFile may corrupt binary but still yield size; sample first chars if text-ish
    try {
      var ts = fso.OpenTextFile(path, 1);
      var head = ts.Read(Math.min(n, entry.size));
      ts.Close();
      var hex2 = [];
      var ascii2 = [];
      for (var k = 0; k < head.length; k++) {
        var c = head.charCodeAt(k) & 255;
        hex2.push(hexByte(c));
        ascii2.push((c >= 32 && c < 127) ? String.fromCharCode(c) : ".");
      }
      entry.magic_hex = hex2.join("");
      entry.magic_ascii = ascii2.join("");
      entry.read_via = "OpenTextFile_lossy";
      entry.note = "text read may corrupt binary; prefer ADODB path";
    } catch (eTxt) {
      if (!entry.error) entry.error = String(eTxt.description || eTxt);
    }
  } catch (e) {
    entry.error = String(e.description || e);
  }
  return entry;
}

function listChildren(m) {
  var r = [];
  try {
    var e = new Enumerator(m.Children);
    for (; !e.atEnd(); e.moveNext()) {
      var c = e.item();
      r.push({ name: c.Name, type: c.Type });
    }
  } catch (e) {}
  return r;
}

LogMessage("=== si_emdl_delta_bytes_dump ===");
var dirs = outRoot();
var report = {
  meta: {
    softimage: safe(function () { return Application.Version(); }, null),
    script: "si_emdl_delta_bytes_dump.js",
    purpose: "ExportModel .emdl + ExportDelta .delta size and first-64-byte hex magic",
    mode: "XSIBATCH -processing",
    out: "%USERPROFILE%\\Documents\\softimage_dump_factory\\model\\si_emdl_delta_bytes.json",
    ref_dir: dirs.ref
  },
  cases: {},
  emdl: null,
  delta: null,
  errors: []
};

NewScene(null, false);

report.cases.create_model = (function () {
  var entry = { ok: false };
  try {
    var c = CreatePrim("Cube", "MeshSurface", null, null);
    var cube = Dictionary.GetObject(c.Name || String(c));
    var m = CreateModel(cube, "DumpModel", null, null);
    var model = Dictionary.GetObject(m.Name || String(m));
    entry.ok = true;
    entry.model = model.Name;
    entry.children = listChildren(model);
  } catch (e) {
    entry.error = String(e.description || e);
  }
  return entry;
})();

var modelName = report.cases.create_model.model || "DumpModel";
var emdlPath = dirs.ref + "\\DumpModel.emdl";

report.cases.export_model = (function () {
  var entry = { path: emdlPath, ok: false };
  try {
    SelectObj(modelName);
    try { ExportModel(modelName, emdlPath, true); }
    catch (e1) {
      try { Application.ExecuteCommand("ExportModel", [modelName, emdlPath, true]); }
      catch (e2) { Application.ExecuteCommand("ExportModel", [modelName, emdlPath]); }
    }
    entry.ok = true;
  } catch (e) {
    entry.error = String(e.description || e);
  }
  return entry;
})();

report.emdl = fingerprintFile(emdlPath, 64);

report.cases.convert_to_ref = (function () {
  var entry = { ok: false };
  try {
    SelectObj(modelName);
    try { ConvertToRefModel(modelName, emdlPath, 65535); }
    catch (e1) { Application.ExecuteCommand("ConvertToRefModel", [modelName, emdlPath, 65535]); }
    entry.ok = true;
    entry.children = listChildren(Dictionary.GetObject(modelName));
  } catch (e) {
    entry.error = String(e.description || e);
  }
  return entry;
})();

report.cases.add_delta = (function () {
  var entry = { ok: false };
  try {
    SelectObj(modelName);
    try { AddDelta(modelName); }
    catch (e1) { Application.ExecuteCommand("AddDelta", [modelName]); }
    entry.ok = true;
  } catch (e) {
    entry.error = String(e.description || e);
  }
  return entry;
})();

// Mutate something so delta is non-empty if possible
report.cases.mutate_for_delta = (function () {
  var entry = { ok: false };
  try {
    var kids = listChildren(Dictionary.GetObject(modelName));
    if (kids.length) {
      try {
        Translate(kids[0].name, 0.5, 0, 0, "siRelative", "siGlobal", "siObj", "siXYZ");
        entry.translated = kids[0].name;
      } catch (eT) {
        try { SetValue(kids[0].name + ".kine.local.posx", 0.5); entry.setpos = kids[0].name; }
        catch (e2) { entry.mutate_error = String(e2.description || e2); }
      }
    }
    entry.ok = true;
  } catch (e) {
    entry.error = String(e.description || e);
  }
  return entry;
})();

var deltaPath = dirs.ref + "\\DumpModel.delta";
report.cases.export_delta = (function () {
  var entry = { path: deltaPath, ok: false, attempts: [] };
  try {
    SelectObj(modelName);
    var tries = [
      function () { ExportDelta(null, deltaPath); },
      function () { ExportDelta(modelName, deltaPath); },
      function () { Application.ExecuteCommand("ExportDelta", [null, deltaPath]); },
      function () { Application.ExecuteCommand("ExportDelta", [modelName, deltaPath]); },
      function () { Application.ExecuteCommand("ExportDelta", [deltaPath]); }
    ];
    var lastErr = null;
    for (var i = 0; i < tries.length; i++) {
      try {
        tries[i]();
        entry.ok = true;
        entry.via = i;
        break;
      } catch (e) {
        lastErr = String(e.description || e);
        entry.attempts.push({ i: i, error: lastErr });
      }
    }
    if (!entry.ok) entry.error = lastErr || "ExportDelta failed";
  } catch (e) {
    entry.error = String(e.description || e);
  }
  return entry;
})();

report.delta = fingerprintFile(deltaPath, 64);

var outPath = dirs.model + "\\si_emdl_delta_bytes.json";
var f = new ActiveXObject("Scripting.FileSystemObject").CreateTextFile(outPath, true);
f.Write(enc(report));
f.Close();
LogMessage("DUMP DONE -> " + outPath);
NewScene(null, false);
