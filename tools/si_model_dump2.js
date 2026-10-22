
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
function dumpObj(o){ var d={name:o.Name,type:o.Type,full:o.FullName}; try{ var pr=o.ActivePrimitive; d.prim=pr.Type; var ops=[]; var e=new Enumerator(pr.ConstructionHistory); for(;!e.atEnd();e.moveNext()) ops.push(dumpOp(e.item())); d.ops=ops;
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
var RESULTS=[]; var ITEMS=[]; var SUFFIX="2";

ITEMS.push({l:"Get/Property/Texture Projection/Create New Projection...",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtPlanarXY:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Projection/Constrain Support to Bounding Box",cmd:"ApplyOp",f:function(){ tryEach("ApplyOp", "BBoxCns", opSets()); }});
ITEMS.push({l:"Get/Property/Texture Map/UV",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtUV:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Map/XY",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtPlanarXY:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Map/YZ",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtPlanarYZ:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Map/XZ",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtPlanarXZ:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Map/Cylindrical",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtCylindrical:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Map/Spherical",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtSpherical:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Map/Camera",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtCamera:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Map/Cubic",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtCubic:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/Texture Map/Spatial",cmd:"Create2DMapWithProjection",f:function(){ var c = cube(); Create2DMapWithProjection(c, "Texture_Map", ":siDefaultPropagation:siPropagationType", ":siTxtSpatial:siTxtCreationType", null, false); }});
ITEMS.push({l:"Get/Property/User Data Map/New Template",cmd:"AddProp",f:function(){ var c = cube(); AddProp(null, c, null, "CustomDataTemplate"); }});
ITEMS.push({l:"Get/Property/User Data Map/New Template Parameter",cmd:"AddProp",f:function(){ var c = cube(); AddProp(null, c, null, "CustomDataTemplate"); }});
ITEMS.push({l:"Get/Property/GATOR",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "Gator", genSets(), true); }});
ITEMS.push({l:"Get/Property/Polygon Cluster Visibility",cmd:"AddProp",f:function(){ var c = cube(); AddProp(null, c, null, null); }});
ITEMS.push({l:"Get/Property/Override",cmd:"AddProp",f:function(){ var c = cube(); AddProp(null, c, null, null); }});
ITEMS.push({l:"Create/Curve/Extract Segment",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "CrvExtractSeg", genSets(), true); }});
ITEMS.push({l:"Create/Curve/Extract from Edges",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "ExtractEdgeLoopOp", genSets(), true); }});
ITEMS.push({l:"Create/Curve/Extract from Surface",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "BlendCrv", genSets(), true); }});
ITEMS.push({l:"Create/Curve/Extract from Subcurves",cmd:"ExtractFromComponents",f:function(){ var k = CreatePrim("Spiral", "NurbsCurve", null, null); X("ExtractFromComponents", ["ExtractSubCrvOp", k.Name + ".knot[2,3]", null, false]); }});
ITEMS.push({l:"Create/Curve/Fit on Curve",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "CrvFit", genSets(), true); }});
ITEMS.push({l:"Create/Curve/Blend",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "BlendCrv", genSets(), true); }});
ITEMS.push({l:"Create/Curve/Fillet Intersection",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "CrvFillet", genSets(), true); }});
ITEMS.push({l:"Create/Curve/Intersect Surfaces",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "SrfIntersect", genSets(), true); }});
ITEMS.push({l:"Create/Curve/Merge",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "CrvMerge", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Birail",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "Birail", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Curve Net",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "CrvNet", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Extrusion Along Axis",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "ExtrusionAlongAxis", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Extrusion Along Curve",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "BlendCrv", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Extrusion - 2 Profiles",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "ExtrusionTwoProfiles", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Four-Sided",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "FourSided", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Loft",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "Loft", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Revolution Around Axis",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "RevolutionAroundAxis", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Revolution Around Curve",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "BlendCrv", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Blend",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "MeshBlend", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Fit",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "SrfFit", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Fillet Intersection",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "SrfFillet", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Merge",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "MeshMerge", genSets(), true); }});
ITEMS.push({l:"Create/Surf. Mesh/Continuity Manager",cmd:"ApplyOp",f:function(){ tryEach("ApplyOp", "SCMFixer2", opSets()); }});
ITEMS.push({l:"Create/Poly. Mesh/Birail",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "Birail", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Curve Net",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "CrvNet", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Extrusion Along Axis",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "ExtrusionAlongAxis", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Extrusion Along Curve",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "BlendCrv", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Extrusion - 2 Profiles",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "ExtrusionTwoProfiles", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Four-Sided",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "FourSided", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Loft",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "Loft", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Revolution Around Axis",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "RevolutionAroundAxis", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Revolution Around Curve",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "BlendCrv", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Blend",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "MeshBlend", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Boolean/Intersect",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "BooleanIntersection", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Extract Polygons (delete)",cmd:"ExtractPolygons",f:function(){ var c = cube(); X("ExtractFromComponents", ["ExtractPolygonsOp", c + ".poly[0,1]", "polymsh_extracted", true]); }});
ITEMS.push({l:"Create/Poly. Mesh/Extract Polygons (keep)",cmd:"ExtractPolygons",f:function(){ var c = cube(); X("ExtractFromComponents", ["ExtractPolygonsOp", c + ".poly[0,1]", "polymsh_extracted", false]); }});
ITEMS.push({l:"Create/Poly. Mesh/Merge",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "MeshMerge", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Curves To Mesh",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "CurveListToMesh", genSets(), true); }});
ITEMS.push({l:"Create/Poly. Mesh/Nurbs To Mesh",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "NurbsToMesh", genSets(), true); }});
ITEMS.push({l:"Create/Skeleton/Chain Up-Vector",cmd:"ApplyOp",f:function(){ tryEach("ApplyOp", "SkeletonUpVector", opSets()); }});
ITEMS.push({l:"Create/Skeleton/Chain Preferred Axis",cmd:"ApplyOp",f:function(){ tryEach("ApplyOp", "SkeletonPrefAxis", opSets()); }});
ITEMS.push({l:"Create/Skeleton/Add Bone to Chain",cmd:"AddBoneToEnd",f:function(){ X("AddBoneToEnd", [bone()]); }});
ITEMS.push({l:"Create/Skeleton/Break Chain at Bone",cmd:"BreakChainAtBone",f:function(){ Create2DSkeleton(0,0,0,5,0,0,0,0,1); X("AddBoneToEnd", ["bone"]); X("BreakChainAtBone", ["bone1"]); }});
ITEMS.push({l:"Create/Skeleton/Move Joint/Branch",cmd:"MoveJoint",f:function(){ X("MoveJoint", [bone(), 1, 1, 0, false, true]); }});
ITEMS.push({l:"Create/Skeleton/Set Minimum Rotation Limit",cmd:"SetBoneMinRotLimit",f:function(){ X("SetBoneMinRotLimit", [bone(), true]); }});
ITEMS.push({l:"Create/Skeleton/Set Maximum Rotation Limit",cmd:"SetBoneMaxRotLimit",f:function(){ X("SetBoneMaxRotLimit", [bone(), false]); }});
ITEMS.push({l:"Create/Skeleton/Reset Bone to Preferred Rotation",cmd:"SetBoneRotationToPrefRotation",f:function(){ X("SetBoneRotationToPrefRotation", [bone()]); }});
ITEMS.push({l:"Create/Skeleton/Key All Bone Rotations",cmd:"KeyAllBoneRotations",f:function(){ X("KeyAllBoneRotations", [bone()]); }});
ITEMS.push({l:"Create/Skeleton/Create Tail",cmd:"MakeTail",f:function(){ var ch = chain(); MakeTail(ch.FullName + ".eff", 5, 1, false); }});
ITEMS.push({l:"Create/Skeleton/Create Control Splines",cmd:"MakeControlSplines",f:function(){ var ch = chain(); MakeControlSplines(ch, null, null, null); }});
ITEMS.push({l:"Create/Skeleton/Duplicate Symmetry",cmd:"DuplicateSymmetry",f:function(){ var ch = chain(); DuplicateSymmetry(ch, true, "siX", "siWorld", "", "", "", "L_", "R_", false, false, false); }});
ITEMS.push({l:"Modify/Component/Proportional Setup...",cmd:"SetProportionalRadius",f:function(){ SetProportionalRadius(5); }});
ITEMS.push({l:"Modify/Component/Attach/Detach Volume Deform",cmd:"ApplyPropVolumeOp",f:function(){ var c = cube(); var v = GetPrimVolumeDeform("SphereVolume", c, null, null, null); X("ApplyPropVolumeOp", ["PropVolume", c + ";" + v.Name]); }});
ITEMS.push({l:"Modify/Component/Inspect Volume Deform...",cmd:"ApplyPropVolumeOp",f:function(){ var c = cube(); var v = GetPrimVolumeDeform("SphereVolume", c, null, null, null); X("ApplyPropVolumeOp", ["PropVolume", c + ";" + v.Name]); }});
ITEMS.push({l:"Modify/Component/Volume Deform Setup...",cmd:"ApplyPropVolumeOp",f:function(){ var c = cube(); var v = GetPrimVolumeDeform("SphereVolume", c, null, null, null); X("ApplyPropVolumeOp", ["PropVolume", c + ";" + v.Name]); }});
ITEMS.push({l:"Modify/Curve/Align Bezier Handles",cmd:"AlignBezierKnotsTangents",f:function(){ var k = CreatePrim("Spiral", "NurbsCurve", null, null); X("ApplyTopoOp", ["CrvMakeBezier", k.Name + ".knot[3]"]); X("AlignBezierKnotsTangents", [k.Name + ".knot[3]"]); }});
ITEMS.push({l:"Modify/Curve/Align Bezier Handles Back to Forward",cmd:"AlignBezierKnotsTangents",f:function(){ var k = CreatePrim("Spiral", "NurbsCurve", null, null); X("ApplyTopoOp", ["CrvMakeBezier", k.Name + ".knot[3]"]); X("AlignBezierKnotsTangents", [k.Name + ".knot[3]"]); }});
ITEMS.push({l:"Modify/Curve/Align Bezier Handles Forward to Back",cmd:"AlignBezierKnotsTangents",f:function(){ var k = CreatePrim("Spiral", "NurbsCurve", null, null); X("ApplyTopoOp", ["CrvMakeBezier", k.Name + ".knot[3]"]); X("AlignBezierKnotsTangents", [k.Name + ".knot[3]"]); }});
ITEMS.push({l:"Modify/Curve/Make Knots Bezier",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", null, topoSets()); }});
ITEMS.push({l:"Modify/Curve/Make Bezier-Knots Corners",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", null, topoSets()); }});
ITEMS.push({l:"Modify/Curve/Make Knot Segments Linear",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", null, topoSets()); }});
ITEMS.push({l:"Modify/Curve/Make Knots Non-Bezier",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", null, topoSets()); }});
ITEMS.push({l:"Modify/Curve/Stitch",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "CrvStitch", topoSets()); }});
ITEMS.push({l:"Modify/Surf. Mesh/Insert Knot Curve",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "InsertSrfKnot", topoSets()); }});
ITEMS.push({l:"Modify/Surf. Mesh/Remove Knot",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "RemoveSrfKnot", topoSets()); }});
ITEMS.push({l:"Modify/Surf. Mesh/Shift UV",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "SrfShift", topoSets()); }});
ITEMS.push({l:"Modify/Surf. Mesh/Extend to Curve",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "CrvExtendTo", topoSets()); }});
ITEMS.push({l:"Modify/Surf. Mesh/Stitch",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "SrfStitch", topoSets()); }});
ITEMS.push({l:"Modify/Surf. Mesh/Snip",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "Snip", topoSets()); }});
ITEMS.push({l:"Modify/Surf. Mesh/Trim by Projection",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "TrimByProjection", topoSets()); }});
ITEMS.push({l:"Modify/Surf. Mesh/Delete Trim",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "DeleteTrim", topoSets()); }});
ITEMS.push({l:"Modify/Poly. Mesh/Delete Components",cmd:"DeleteComponent",f:function(){ var c = cube(); DeleteObj(c + ".poly[0,1]"); }});
ITEMS.push({l:"Modify/Poly. Mesh/Duplicate Polygons",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "DuplicatePolygonsAlongCurve", topoSets()); }});
ITEMS.push({l:"Modify/Poly. Mesh/Duplicate Polygons Along Curve",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "DuplicatePolygonsAlongCurve", topoSets()); }});
ITEMS.push({l:"Modify/Poly. Mesh/Extrude Along Axis",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "ExtrusionAlongAxis", genSets(), true); }});
ITEMS.push({l:"Modify/Poly. Mesh/Extrude Along Curve",cmd:"ApplyTopoOp",f:function(){ tryEach("ApplyTopoOp", "ExtrudeComponent", topoSets()); }});
ITEMS.push({l:"Modify/Poly. Mesh/Apply Thickness",cmd:"ApplyThickness",f:function(){ var c = cube(); X("ApplyThickness", [c]); }});
ITEMS.push({l:"Modify/Poly. Mesh/Apply Slice Between Two Vertices",cmd:"ApplySliceBetweenTwoVertices",f:function(){ var c = cube(); X("ApplySliceBetweenTwoVertices", [c + ".pnt[0,5]"]); }});
ITEMS.push({l:"Modify/Poly. Mesh/Cap Hole",cmd:"CapHole",f:function(){ var c = cube(); DeleteObj(c + ".poly[0]"); X("CapHole", [c + ".edge[0]"]); }});
ITEMS.push({l:"Modify/Poly. Mesh/Invert Polygons",cmd:"InvertPolygons",f:function(){ tryEach("ApplyTopoOp", "Inverse", topoSets()); }});
ITEMS.push({l:"Modify/Poly. Mesh/Spin Edges",cmd:"SpinEdgeForward",f:function(){ var c = cube(); X("SpinEdgeForward", [c + ".edge[0,1]"]); }});
ITEMS.push({l:"Modify/Poly. Mesh/Turn Polygon Internal Edges",cmd:"ApplyOp",f:function(){ tryEach("ApplyOp", "TurnEdgeOp", opSets()); }});
ITEMS.push({l:"Modify/Poly. Mesh/Boolean/Intersect",cmd:"ApplyGenOp",f:function(){ tryEach("ApplyGenOp", "BooleanIntersection", genSets(), true); }});
ITEMS.push({l:"Modify/Poly. Mesh/Triangulate",cmd:"TriangulatePolygons",f:function(){ var c = cube(); var r = X("ApplyTopoOp", ["SubdividePolygon", c]); CUR.note = "Triangulate = SubdividePolygon with mode=triangles (no ppg)"; }});
ITEMS.push({l:"Modify/Deform/by Cage",cmd:"ApplyDeformByCage",f:function(){ var c = cube(); var g = CreatePrim("Cube", "MeshSurface", null, null); Scale(g, 2, 2, 2, "siRelative", "siLocal", "siObj", "siXYZ"); X("ApplyDeformByCage", [c + ";" + g.Name]); }});
ITEMS.push({l:"Modify/Deform/by Spine",cmd:"SIApplyDeformBySpine",f:function(){ var c = cube(); var k = CreatePrim("Spiral", "NurbsCurve", null, null); X("SIApplyDeformBySpine", [c + ";" + k.Name, false]); }});
ITEMS.push({l:"Modify/Deform/by Surface",cmd:"ApplyOp",f:function(){ tryEach("ApplyOp", "SrfDeform", opSets()); }});
ITEMS.push({l:"Modify/Deform/by Volume",cmd:"ApplyPropVolumeOp",f:function(){ var c = cube(); var v = GetPrimVolumeDeform("SphereVolume", c, null, null, null); X("ApplyPropVolumeOp", ["PropVolume", c + ";" + v.Name]); }});
ITEMS.push({l:"Modify/Deform/Quick Stretch",cmd:"ApplyKinematicOp",f:function(){ var c = cube(); X("ApplyKinematicOp", ["QStretch", c]); }});
ITEMS.push({l:"Modify/Deform/Wave",cmd:"ApplyOp",f:function(){ tryEach("ApplyOp", "Wave", opSets()); }});

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
