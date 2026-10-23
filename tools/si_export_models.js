// Exports Softimage's Get > Primitive > Model presets (XSI_SAMPLES/Models/*.emdl) to JSON for the clone.
// Run from the Softimage Script Editor (JScript). Output: C:\Users\Neil\Documents\si_models\<preset>.json
function enc(v){ if(v===null||v===undefined) return "null"; var t=typeof v; if(t=="number") return isFinite(v)?String(Math.round(v*10000)/10000):"0"; if(t=="boolean") return v?"true":"false"; if(t=="string") return '"'+v.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"'; if(v instanceof Array){ var a=[]; for(var i=0;i<v.length;i++) a.push(enc(v[i])); return "["+a.join(",")+"]"; } var o=[]; for(var k in v) o.push(enc(k)+":"+enc(v[k])); return "{"+o.join(",")+"}"; }
var fso = new ActiveXObject("Scripting.FileSystemObject");
var outDir = "C:\\Users\\Neil\\Documents\\si_models"; if (!fso.FolderExists(outDir)) fso.CreateFolder(outDir);
var base = Application.InstallationPath(siFactoryPath) + "\\Data\\XSI_SAMPLES\\Models\\";
var presets = [
  ["Skeleton - Man - Basic","ManSkeleton_Basic"],["Skeleton - Man - Complete","ManSkeleton_Complete"],["Skeleton - Woman - Basic","WomanSkeleton_Basic"],["Skeleton - Woman - Complete","WomanSkeleton_Complete"],
  ["Biped - Box","Biped_Box"],["Biped - SI|3D Skeleton","Biped_XSISkeleton"],["Biped - Skeleton","Biped_Skeleton"],["Biped - Rig","Biped_Rig"],["Quadruped - Rig","Quadruped_Rig"],
  ["Body - Man","Man"],["Body - Woman","Woman"],["Face - Man","Man_Face"],["Face - Woman","Woman_Face"],["Character - Man","Man_Character"],
  ["Mesh - Bull","Bull"],["Mesh - Car","Car"],["Mesh - Fish","Fish"],["Mesh - Horse","Horse"],["Mesh - Lizard","Lizard"],["Mesh - Male","Male"],["Mesh - T.rex","Trex"]];
function vec(t){ return [t.X, t.Y, t.Z]; }
function xf(o){ var l = o.Kinematics.Local; var p = l.Parameters; return { pos:[l.posx.Value,l.posy.Value,l.posz.Value], rot:[l.rotx.Value,l.roty.Value,l.rotz.Value], scl:[l.sclx.Value,l.scly.Value,l.sclz.Value], rotorder:l.rotorder.Value }; }
function meshData(o){
  var g = o.ActivePrimitive.Geometry; var pts=[]; var e=new Enumerator(g.Points); for(;!e.atEnd();e.moveNext()){ var p=e.item().Position; pts.push(p.X,p.Y,p.Z); }
  var polys=[]; var f=new Enumerator(g.Facets); for(;!f.atEnd();f.moveNext()){ var ix=[]; var e2=new Enumerator(f.item().Points); for(;!e2.atEnd();e2.moveNext()) ix.push(e2.item().Index); polys.push(ix); }
  return { points: pts, polys: polys };
}
function matOf(o){ try { var m = o.Material; var sh = m.Shaders(0); if (!sh) return null; var d = sh.Parameters("diffuse"); var c = d ? d.Value : null; return { shader: sh.ProgID, diffuse: c ? [c.Red, c.Green, c.Blue] : null, name: m.Name }; } catch(e) { return null; } }
function walk(o, out, parentName){
  var type = o.Type; var n = { name:o.Name, type:type, parent:parentName, xf:xf(o) };
  try {
    if (type == "polymsh") { n.mesh = meshData(o); n.material = matOf(o); }
    else if (type == "bone") { n.length = o.Parameters("length").Value; }
    else if (type == "surfmsh") { var g=o.ActivePrimitive.Geometry; var s=g.Surfaces(0); n.nurbs = { ucount:s.UCount, vcount:s.VCount, udeg:s.UDegree, vdeg:s.VDegree, uclosed:s.UClosed, vclosed:s.VClosed }; var cps=[]; var e=new Enumerator(s.ControlPoints); for(;!e.atEnd();e.moveNext()){ var p=e.item().Position; cps.push(p.X,p.Y,p.Z); } n.nurbs.cps=cps; }
    else if (type == "crvlist") { var cg=o.ActivePrimitive.Geometry; var cv=cg.Curves(0); var cps2=[]; var e3=new Enumerator(cv.ControlPoints); for(;!e3.atEnd();e3.moveNext()){ var p=e3.item().Position; cps2.push(p.X,p.Y,p.Z); } n.curve = { degree: cv.Degree, closed: cv.IsClosed(), cps: cps2 }; }
    else if (type == "null" || type == "root" || type == "eff" || type == "#model" || type == "light" || type == "camera") { if (type == "null") { try { n.size = o.Parameters("size").Value; n.shape = o.Parameters("primary_icon").Value; } catch(e) {} } }
  } catch(err) { n.error = err.description; }
  out.push(n);
  var c = new Enumerator(o.Children); for(;!c.atEnd();c.moveNext()) walk(c.item(), out, o.Name);
}
var done = [];
for (var i = 0; i < presets.length; i++) {
  var label = presets[i][0], file = presets[i][1];
  try {
    NewScene(null, false);
    var m = ImportModel(base + file + ".emdl", null, true, null, null, null, null);
    var model = Dictionary.GetObject(file.replace(/[^A-Za-z0-9_]/g, "_"), false) || Application.ActiveSceneRoot.Models(0);
    var nodes = []; walk(model, nodes, null);
    var f = fso.CreateTextFile(outDir + "\\" + file + ".json", true);
    f.Write(enc({ preset: label, file: file + ".emdl", model: model.Name, nodes: nodes })); f.Close();
    done.push(file + ":" + nodes.length);
  } catch (e) { done.push(file + ":ERROR " + e.description); }
}
NewScene(null, false);
LogMessage("MODEL EXPORT DONE " + done.join(", "));
