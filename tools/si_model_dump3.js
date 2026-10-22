
function enc(v){ if(v===null||v===undefined) return "null"; var t=typeof v;
 if(t=="number") return isFinite(v)?String(v):"null"; if(t=="boolean") return v?"true":"false";
 if(t=="string"){ return '"'+v.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\r/g,"").replace(/\n/g,"\\n").replace(/\t/g,"\\t")+'"'; }
 if(v instanceof Array){ var a=[]; for(var i=0;i<v.length;i++) a.push(enc(v[i])); return "["+a.join(",")+"]"; }
 var o=[]; for(var k in v) o.push(enc(k)+":"+enc(v[k])); return "{"+o.join(",")+"}"; }
function val(p){ try{ var v=p.Value; if(typeof v=="object"&&v!==null){ try{ return String(v); }catch(e){ return "<obj>"; } } return v; }catch(e){ return "<err>"; } }
function num(x){ try{ var n=Number(x); return isFinite(n)?n:null; }catch(e){ return null; } }
function dumpParams(ps){ var r=[]; try{ var e=new Enumerator(ps); for(;!e.atEnd();e.moveNext()){ var p=e.item(); var d={sn:p.ScriptName,n:p.Name,v:val(p)};
  try{ d.t=p.ValueType; }catch(e1){} try{ d.min=num(p.Min); d.max=num(p.Max); }catch(e2){} try{ d.smin=num(p.SuggestedMin); d.smax=num(p.SuggestedMax); }catch(e3){}
  try{ d.anim=p.Animatable; d.ro=p.ReadOnly; }catch(e4){} try{ if(p.Parameters && p.Parameters.Count>0) d.sub=dumpParams(p.Parameters); }catch(e5){} r.push(d);} }catch(e){} return r; }
function dumpOp(op){ var d={name:op.Name,type:op.Type,full:op.FullName}; try{ d.params=dumpParams(op.Parameters); }catch(e){}
  try{ var ins=[]; var e=new Enumerator(op.InputPorts); for(;!e.atEnd();e.moveNext()){ var pt=e.item(); ins.push(pt.Name+"<-"+(pt.Target2?pt.Target2.FullName:"")); } d.inputs=ins; }catch(e){} return d; }
function dumpObj(o){ var d={name:o.Name,type:o.Type,full:o.FullName}; try{ var pr=o.ActivePrimitive; d.prim=pr.Type; try{ d.primParams=dumpParams(pr.Parameters); }catch(e9){} var ops=[]; var e=new Enumerator(pr.ConstructionHistory); for(;!e.atEnd();e.moveNext()) ops.push(dumpOp(e.item())); d.ops=ops;
  try{ var g=pr.Geometry; d.points=g.Points.Count; try{ d.facets=g.Facets.Count; }catch(e2){} try{ d.polys=g.Polygons.Count; d.edges=g.Edges.Count; }catch(e3){} }catch(e4){} }catch(e){}
  try{ var props=[]; var e=new Enumerator(o.Properties); for(;!e.atEnd();e.moveNext()){ var p=e.item(); props.push({name:p.Name,type:p.Type,params:dumpParams(p.Parameters)}); } d.props=props; }catch(e){}
  try{ var cls=[]; var e=new Enumerator(o.ActivePrimitive.Geometry.Clusters); for(;!e.atEnd();e.moveNext()){ var c=e.item(); var cp=[]; var e2=new Enumerator(c.Properties); for(;!e2.atEnd();e2.moveNext()){ var p=e2.item(); cp.push({name:p.Name,type:p.Type,params:dumpParams(p.Parameters)}); } cls.push({name:c.Name,type:c.Type,count:c.Elements.Count,props:cp}); } d.clusters=cls; }catch(e){}
  try{ if(o.Material) d.material={name:o.Material.Name, shaders:(function(){ var s=[]; var e=new Enumerator(o.Material.Shaders); for(;!e.atEnd();e.moveNext()){ var sh=e.item(); s.push({name:sh.Name,progid:sh.ProgID,params:dumpParams(sh.Parameters)}); } return s; })()}; }catch(e){}
  return d; }
function names(){ var r={}; try{ var e=new Enumerator(Application.ActiveSceneRoot.FindChildren()); for(;!e.atEnd();e.moveNext()) r[e.item().FullName]=1; }catch(e){} return r; }
function cube(){ var o=CreatePrim("Cube","MeshSurface",null,null); SetValue(o+".polymsh.geom.subdivu",3); SetValue(o+".polymsh.geom.subdivv",3); SetValue(o+".polymsh.geom.subdivbase",3); return o.Name; }
function circle(){ var o=CreatePrim("Circle","NurbsCurve",null,null); return o.Name; }
function chain(){ Create2DSkeleton(0,0,0,5,0,0,0,0,1); return Dictionary.GetObject("root"); }
function bone(){ chain(); return "bone"; }
function topoSets(){ return [[function(){var c=cube();return c+".poly[0,1,2]";}],[function(){var k=CreatePrim("Spiral","NurbsCurve",null,null);return k.Name+".knot[3]";}],[function(){var k=CreatePrim("Arc","NurbsCurve",null,null);return k.Name+".knot[1]";}],[function(){var a=circle();var b=circle();Translate(b,0,4,0,"siRelative","siGlobal","siObj","siXYZ");return a+";"+b;}],[function(){var a=CreatePrim("Sphere","NurbsSurface",null,null);var b=CreatePrim("Sphere","NurbsSurface",null,null);Translate(b,10,0,0,"siRelative","siGlobal","siObj","siXYZ");return a.Name+";"+b.Name;}],[function(){var k=CreatePrim("Spiral","NurbsCurve",null,null);return k.Name+".knot[2,3]";}],[function(){var c=cube();return c+".edge[0,1,2,3]";}],[function(){var c=cube();return c+".pnt[0,1,2,3]";}],[function(){return cube();}],[function(){var c=cube();var s=CreatePrim("Sphere","MeshSurface",null,null);Translate(s,2,2,2,"siRelative","siGlobal","siObj","siXYZ");return c+";"+s.Name;}],[function(){return circle();}],[function(){var k=circle();return k+".knot[2]";}],[function(){var k=circle();return k+".pnt[1,2]";}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name;}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name+".isoline[0.5]";}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name+".pnt[0,1]";}]]; }
function genSets(){ return [[function(){var a=circle();var b=CreatePrim("Arc","NurbsCurve",null,null);Translate(b,0,4,0,"siRelative","siGlobal","siObj","siXYZ");return a+","+b.Name;}],[function(){return circle();}],[function(){var k=circle();return k+".knot[1,3]";}],[function(){var c=cube();return c;}],[function(){var c=cube();return c+".edge[0,1,2]";}],[function(){var c=cube();return c+".poly[0,1]";}],[function(){var c=cube();var s=CreatePrim("Sphere","MeshSurface",null,null);return c+";"+s.Name;}],[function(){var a=circle();var b=circle();Translate(b,0,4,0,"siRelative","siGlobal","siObj","siXYZ");var c=circle();Translate(c,0,8,0,"siRelative","siGlobal","siObj","siXYZ");var d=circle();Translate(d,0,12,0,"siRelative","siGlobal","siObj","siXYZ");return a+","+b+","+c+","+d;}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name;}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);var t=CreatePrim("Sphere","NurbsSurface",null,null);Translate(t,10,0,0,"siRelative","siGlobal","siObj","siXYZ");return s.Name+","+t.Name;}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name+".isoline[0.5]";}],[function(){var g=CreatePrim("Grid","NurbsSurface",null,null);var k=circle();return g.Name+";"+k;}],[function(){var c=cube();var k=circle();return c+";"+k;}]]; }
function opSets(){ return [[function(){return cube();}],[function(){var c=cube();var w=GetPrimWave("Wave",c,null,null,null);return c+";"+w.Name;}],[function(){var c=cube();var g=CreatePrim("Grid","NurbsSurface",null,null);return c+";"+g.Name;}],[function(){var c=cube();var k=CreatePrim("Spiral","NurbsCurve",null,null);return c+";"+k.Name;}],[function(){var c=cube();var l=GetPrimLattice("Lattice",c,null,null,null);return c+";"+l.Name;}],[function(){var c=cube();var k=circle();return c+";"+k;}],[function(){var c=cube();return c+".pnt[0,1,2]";}],[function(){var c=cube();return c+".edge[0,1]";}],[function(){var c=cube();var n=GetPrim("Null");return c+";"+n.Name;}],[function(){return circle();}],[function(){var c=cube();var s=CreatePrim("Sphere","MeshSurface",null,null);return c+";"+s.Name;}],[function(){var ch=chain();return ch.FullName+".bone1";}],[function(){var ch=chain();var n=GetPrim("Null");return ch.FullName+";"+n.Name;}],[function(){var c=cube();var g=CreatePrim("Grid","MeshSurface",null,null);return c+";"+g.Name;}]]; }
var CUR=null;
function X(cmd,args){ return Application.ExecuteCommand(cmd,args); }
function tryEach(cmd, preset, sets, gen){ var errs=[]; for(var i=0;i<sets.length;i++){ NewScene(null,false); var cs; try{ cs=sets[i][0](); }catch(e0){ errs.push("setup:"+e0.description); continue; }
  try{ var r=Application.ExecuteCommand(cmd, gen?[preset,null,cs]:[preset,cs]); CUR.used=cs; return r; }catch(e){ errs.push(cs+" => "+e.description); } }
  CUR.errors=errs; throw new Error("all connection sets failed"); }
var RESULTS=[]; var ITEMS=[]; var SUFFIX="3";

ITEMS.push({l:"Get/Primitive/Null",cmd:"GetPrim",f:function(){ GetPrim("Null", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Curve/Arc",cmd:"CreatePrim",f:function(){ CreatePrim("Arc", "NurbsCurve", null, null); }});
ITEMS.push({l:"Get/Primitive/Curve/Circle",cmd:"CreatePrim",f:function(){ CreatePrim("Circle", "NurbsCurve", null, null); }});
ITEMS.push({l:"Get/Primitive/Curve/Spiral",cmd:"CreatePrim",f:function(){ CreatePrim("Spiral", "NurbsCurve", null, null); }});
ITEMS.push({l:"Get/Primitive/Curve/Square",cmd:"CreatePrim",f:function(){ CreatePrim("Square", "NurbsCurve", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Cone",cmd:"CreatePrim",f:function(){ CreatePrim("Cone", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Cube",cmd:"CreatePrim",f:function(){ CreatePrim("Cube", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Cylinder",cmd:"CreatePrim",f:function(){ CreatePrim("Cylinder", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Disc",cmd:"CreatePrim",f:function(){ CreatePrim("Disc", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Grid",cmd:"CreatePrim",f:function(){ CreatePrim("Grid", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Sphere",cmd:"CreatePrim",f:function(){ CreatePrim("Sphere", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Torus",cmd:"CreatePrim",f:function(){ CreatePrim("Torus", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Dodecahedron",cmd:"CreatePrim",f:function(){ CreatePrim("Dodecahedron", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Icosahedron",cmd:"CreatePrim",f:function(){ CreatePrim("Icosahedron", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Octahedron",cmd:"CreatePrim",f:function(){ CreatePrim("Octahedron", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Tetrahedron",cmd:"CreatePrim",f:function(){ CreatePrim("Tetrahedron", "MeshSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Rhombicosidodecahedron",cmd:"GetPrim",f:function(){ GetPrim("Rhombicosidodecahedron", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Soccer Ball",cmd:"GetPrim",f:function(){ GetPrim("SoccerBall", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Polygon Mesh/Empty",cmd:"GetPrim",f:function(){ GetPrim("EmptyPolygonMesh", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Surface/Cone",cmd:"CreatePrim",f:function(){ CreatePrim("Cone", "NurbsSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Surface/Cube",cmd:"CreatePrim",f:function(){ CreatePrim("Cube", "NurbsSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Surface/Cylinder",cmd:"CreatePrim",f:function(){ CreatePrim("Cylinder", "NurbsSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Surface/Disc",cmd:"CreatePrim",f:function(){ CreatePrim("Disc", "NurbsSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Surface/Grid",cmd:"CreatePrim",f:function(){ CreatePrim("Grid", "NurbsSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Surface/Sphere",cmd:"CreatePrim",f:function(){ CreatePrim("Sphere", "NurbsSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Surface/Torus",cmd:"CreatePrim",f:function(){ CreatePrim("Torus", "NurbsSurface", null, null); }});
ITEMS.push({l:"Get/Primitive/Point Cloud/Cone",cmd:"CreatePrim",f:function(){ CreatePrim("Cone", "PointCloud", null, null); }});
ITEMS.push({l:"Get/Primitive/Point Cloud/Cube",cmd:"CreatePrim",f:function(){ CreatePrim("Cube", "PointCloud", null, null); }});
ITEMS.push({l:"Get/Primitive/Point Cloud/Cylinder",cmd:"CreatePrim",f:function(){ CreatePrim("Cylinder", "PointCloud", null, null); }});
ITEMS.push({l:"Get/Primitive/Point Cloud/Disc",cmd:"CreatePrim",f:function(){ CreatePrim("Disc", "PointCloud", null, null); }});
ITEMS.push({l:"Get/Primitive/Point Cloud/Grid",cmd:"CreatePrim",f:function(){ CreatePrim("Grid", "PointCloud", null, null); }});
ITEMS.push({l:"Get/Primitive/Point Cloud/Sphere",cmd:"CreatePrim",f:function(){ CreatePrim("Sphere", "PointCloud", null, null); }});
ITEMS.push({l:"Get/Primitive/Point Cloud/Torus",cmd:"CreatePrim",f:function(){ CreatePrim("Torus", "PointCloud", null, null); }});
ITEMS.push({l:"Get/Primitive/Point Cloud/Empty",cmd:"GetPrim",f:function(){ GetPrim("PointCloud", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Arc",cmd:"GetPrim",f:function(){ GetPrim("Arc", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Circle",cmd:"GetPrim",f:function(){ GetPrim("Circle", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Spiral",cmd:"GetPrim",f:function(){ GetPrim("Spiral", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Square",cmd:"GetPrim",f:function(){ GetPrim("Square", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Bone",cmd:"GetPrim",f:function(){ GetPrim("Bone", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Cone",cmd:"GetPrim",f:function(){ GetPrim("Cone", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Cube",cmd:"GetPrim",f:function(){ GetPrim("Cube", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Cylinder",cmd:"GetPrim",f:function(){ GetPrim("Cylinder", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Disc",cmd:"GetPrim",f:function(){ GetPrim("Disc", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Grid",cmd:"GetPrim",f:function(){ GetPrim("Grid", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Sphere",cmd:"GetPrim",f:function(){ GetPrim("Sphere", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Implicit/Torus",cmd:"GetPrim",f:function(){ GetPrim("Torus", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Wave",cmd:"GetPrimWave",f:function(){ var c = cube(); GetPrimWave("Wave", c, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Volume Deform",cmd:"GetPrimVolumeDeform",f:function(){ var c = cube(); GetPrimVolumeDeform("SphereVolume", c, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Attractor",cmd:"CreateForce",f:function(){ CreateForce("Attractor", null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Drag",cmd:"CreateForce",f:function(){ CreateForce("Drag", null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Eddy",cmd:"CreateForce",f:function(){ CreateForce("Eddy", null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Fan",cmd:"CreateForce",f:function(){ CreateForce("Fan", null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Gravity",cmd:"CreateForce",f:function(){ CreateForce("Gravity", null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Toric",cmd:"CreateForce",f:function(){ CreateForce("ToricForce", null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Turbulence",cmd:"CreateForce",f:function(){ CreateForce("Turbulence", null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Vortex",cmd:"CreateForce",f:function(){ CreateForce("Vortex", null); }});
ITEMS.push({l:"Get/Primitive/Control Object/Wind",cmd:"CreateForce",f:function(){ CreateForce("Wind", null); }});
ITEMS.push({l:"Get/Primitive/Lattice",cmd:"GetPrimLattice",f:function(){ var c = cube(); GetPrimLattice("Lattice", c, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Stand-in",cmd:"GetPrim",f:function(){ GetPrim("Stand-in", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Geometry Shader Primitive",cmd:"GetPrim",f:function(){ GetPrim("GeoShader", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Annotation",cmd:"GetPrim",f:function(){ GetPrim("AnnotationObject", null, null, null); }});
ITEMS.push({l:"Get/Primitive/Camera/Perspective",cmd:"GetPrimCamera",f:function(){ GetPrimCamera("Camera", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Camera/Telephoto",cmd:"GetPrimCamera",f:function(){ GetPrimCamera("Telephoto.Preset", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Camera/Wide Angle",cmd:"GetPrimCamera",f:function(){ GetPrimCamera("Wide_Angle.Preset", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Camera/Orthographic",cmd:"GetPrimCamera",f:function(){ GetPrimCamera("Orthographic.Preset", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Camera/More...",cmd:"GetPrimCamera",f:function(){ GetPrimCamera(null, null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Light/Infinite",cmd:"GetPrimLight",f:function(){ GetPrimLight("Infinite", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Light/Light Box",cmd:"GetPrimLight",f:function(){ GetPrimLight("Light_Box", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Light/Neon",cmd:"GetPrimLight",f:function(){ GetPrimLight("Neon", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Light/Point",cmd:"GetPrimLight",f:function(){ GetPrimLight("Point", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Light/Spot",cmd:"GetPrimLight",f:function(){ GetPrimLight("Spot", null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Light/Flat",cmd:"GetPrimLight",f:function(){ GetPrimLight(null, null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Light/More...",cmd:"GetPrimLight",f:function(){ GetPrimLight(null, null, null, null, null, null); }});
ITEMS.push({l:"Get/Primitive/Light/Associate Light",cmd:"LightAssociate",f:function(){ var c = cube(); var l = GetPrimLight("Point.Preset", null, null, null, null, null); SelectObj(l); LightAssociate(c); }});
ITEMS.push({l:"Get/Primitive/Light/Light Rig from Image",cmd:"CreateLightRigFromImage",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Skeleton - Man - Basic",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Skeleton - Man - Complete",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Skeleton - Woman - Basic",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Skeleton - Woman - Complete",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Biped - Box",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Biped - SI|3D Skeleton",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Biped - Skeleton",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Biped - Rig",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Quadruped - Rig",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Body - Man",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Body - Woman",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Face - Man",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Face - Woman",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Character - Man",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Mesh - Bull",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Mesh - Car",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Mesh - Fish",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Mesh - Horse",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Mesh - Lizard",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Mesh - Male",cmd:"GetPresetModel",skip:"interactive/skipped"});
ITEMS.push({l:"Get/Primitive/Model/Mesh - T.rex",cmd:"GetPresetModel",skip:"interactive/skipped"});

var fso=new ActiveXObject("Scripting.FileSystemObject");
var outPath="C:\\Users\\neil\\Documents\\si_model_dump"+SUFFIX+".json";
var f=fso.CreateTextFile(outPath,true); f.Write("[");
var first=true;
for(var i=0;i<ITEMS.length;i++){ var it=ITEMS[i]; var rec={l:it.l,cmd:it.cmd}; CUR=rec; LogMessage("dump "+i+"/"+ITEMS.length+" "+it.l);
  if(it.skip){ rec.skip=it.skip; } else { try{ NewScene(null,false); var before=names(); it.f(); var after=names(); var objs=[]; for(var k in after) if(!before[k]) objs.push(dumpObj(Dictionary.GetObject(k)));
     // also dump objects that existed in a tryEach context (they were created after NewScene inside tryEach, so they're new anyway)
     rec.objects=objs; rec.ok=true; }catch(e){ rec.ok=false; rec.error=e.description||String(e); } }
  f.Write((first?"":",\n")+enc(rec)); first=false; }
f.Write("]"); f.Close(); NewScene(null,false); LogMessage("DUMP DONE -> "+outPath);
