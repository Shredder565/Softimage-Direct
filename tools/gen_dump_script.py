"""Generate a JScript that runs every Model-menu command inside Softimage and dumps the
resulting operators/parameters to C:\\Users\\<you>\\Documents\\si_model_dump.json.
Paste the generated script into Softimage's Script Editor (JScript) and run it."""
import json, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
menus = json.load(open(os.path.join(root, 'src/data/menus.json')))
cmds = json.load(open(os.path.join(root, 'src/data/menu_commands.json')))

items = []
def walk(nodes, path):
    for it in nodes:
        if it.get('separator'): continue
        if it.get('items') is not None: walk(it['items'], path + [it['label']])
        else: items.append(('/'.join(path + [it['label']]), it.get('id')))
walk(menus['Model'], [])

def js(v):
    if v is None or v == '': return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    return json.dumps(v)

SKIP_CMDS = {'GetPresetModel', 'InspectObj', 'PaintTool', 'PaintPushTool', 'PaintVertexColorTool', 'StoreAction', 'ApplyAction', 'SetUserPref',
             'RandomizeParameters', 'PropTransformTool', 'UIAssembleNurbsMesh', 'CreateRigFromGuide', 'GetProportionalGuide', 'CreateLightRigFromImage',
             'GenerateUniqueUVs', 'GenerateUVSetByContourStretching', 'InspectUserData', 'TweakTool', 'AddVertexTool', 'CVNURBSCurveTool', 'BezierCurveTool',
             'NURBSCurveTool', 'LinearCurveTool', 'SketchCurveTool', 'CreateMeshText', 'SetResolutionOfRefModels', 'DeleteOverride', 'AddImageClip',
             'OpenMaterialLibrary', 'SIStoreProp', 'CreateUserDataMapAndPickTemplate', 'PlotAndApplyAction', 'TagObject', 'StoreShapeKey', 'ApplySnapFaceOp'}

def body(c):
    cmd, args = c['cmd'], dict((a[0], a[1]) for a in c['args'])
    p = args.get('PresetObj')
    if cmd == 'CreatePrim': return f'CreatePrim({js(p)}, {js(args.get("GeometryType"))}, null, null);'
    if cmd == 'GetPrim': return f'GetPrim({js(p)}, null, null, null);'
    if cmd == 'GetPrimLight': return f'GetPrimLight({js(p)}, null, null, null, null, null);'
    if cmd == 'GetPrimCamera': return f'GetPrimCamera({js(p)}, null, null, null, null, null);'
    if cmd == 'CreateModel': return 'var c = cube(); CreateModel(c, "Model", null, null);'
    if cmd == 'ApplyTopoOp': return f'tryEach("ApplyTopoOp", {js(p)}, topoSets());'
    if cmd == 'ApplyGenOp': return f'tryEach("ApplyGenOp", {js(p)}, genSets());'
    if cmd == 'ApplyOp': return f'tryEach("ApplyOp", {js(p)}, opSets());'
    if cmd == 'ApplyPropVolumeOp': return f'tryEach("ApplyPropVolumeOp", {js(p)}, [["cube;vol"]]);'
    if cmd == 'ApplyShader': return f'var c = cube(); ApplyShader({js(p)}, c, null, {js(args.get("PropagationType"))}, {js(args.get("ActionWhenLocalMaterialsOverlap"))});'
    if cmd == 'AddProp': return f'var c = cube(); AddProp({js(p)}, c, {js(args.get("Propagation"))}, {js(args.get("PropertyName"))});'
    if cmd in ('GetPrimLattice', 'GetPrimWave', 'GetPrimVolumeDeform'): return f'var c = cube(); {cmd}({js(p)}, c, null, null, null);'
    if cmd == 'CreateProjection': return f'var c = cube(); CreateProjection(c, {js(args.get("Type"))}, {js(args.get("UVDefaultType"))}, {js(args.get("SupportName"))}, {js(args.get("PropertyName"))}, {js(args.get("Parenting"))}, {js(args.get("Fitting"))}, null);'
    if cmd == 'Create2DMapWithProjection': return f'var c = cube(); Create2DMapWithProjection(c, {js(args.get("PropertyName"))}, {js(args.get("PropagationType"))}, {js(args.get("Type"))}, null, false);'
    if cmd == 'Create2DMap': return 'var c = cube(); Create2DMap(c, null, null);'
    if cmd == 'CreateWeightMap': return f'var c = cube(); CreateWeightMap({js(p)}, c, {js(args.get("PropertyName"))}, {js(args.get("PropPresetObj"))}, false);'
    if cmd == 'CreateSymmetryMap': return f'var c = cube(); CreateSymmetryMap({js(p)}, c, {js(args.get("Name"))}, {js(args.get("PropPresetObj"))});'
    if cmd == 'CreateSymmetryMappingTemplate': return 'var c = cube(); CreateSymmetryMappingTemplate(c, true, 0, true);'
    if cmd == 'CreateVertexColorSupport': return f'var c = cube(); CreateVertexColorSupport({js(p)}, {js(args.get("PropertyName"))}, c, null);'
    if cmd == 'ConnectToProjection': return 'var c = cube(); CreateProjection(c, "siTxtPlanarXY", "siTxtDefaultPlanarXY", "Texture_Support", "Texture_Projection", null, null, null); ConnectToProjection(c, null, c + ".polymsh.cls.Texture_Coordinates_AUTO.Texture_Projection");'
    if cmd == 'ConnectToSupport': return 'var c = cube(); CreateProjection(c, "siTxtPlanarXY", "siTxtDefaultPlanarXY", "Texture_Support", "Texture_Projection", null, null, null); ConnectToSupport(c, null, "Texture_Support");'
    if cmd == 'AssignMaterial': return 'var c = cube(); var m = SICreateMaterial("Phong"); AssignMaterial(c, null);'
    if cmd == 'UnAssignMaterial': return 'var c = cube(); ApplyShader("Phong", c); UnAssignMaterial(c);'
    if cmd == 'MakeLocalMaterialsForHierarchy': return 'var c = cube(); MakeLocalMaterialsForHierarchy(c);'
    if cmd == 'LightAssociate': return 'var c = cube(); var l = GetPrimLight("Point.Preset", null, null, null, null, null); SelectObj(l); LightAssociate(c);'
    if cmd == 'CreateForce': return f'CreateForce({js(args.get("Name"))}, null);'
    if cmd == 'ExtractPolygons': return 'var c = cube(); ExtractPolygons(c + ".poly[0,1]", true);'
    if cmd == 'ExtractFromComponents': return f'var k = circle(); ExtractFromComponents({js(p)}, k + ".knot[2,3]", null, false, null, null, null);'
    if cmd == 'ApplyCns': return f'var c = cube(); var k = circle(); ApplyCns({js(p)}, c, k, null);'
    if cmd == 'SaveKeyOnPath': return f'var c = cube(); var k = circle(); ApplyCns("Path", c, k, null); SaveKeyOnPath(c, 10, null, null, null, false);'
    if cmd in ('InspectChainProperties',): return 'var ch = chain(); InspectChainProperties(ch);'
    if cmd == 'AddBoneToEnd': return 'var ch = chain(); AddBoneToEnd(ch.FullName + ".bone1");'
    if cmd == 'BreakChainAtBone': return 'var ch = chain(); BreakChainAtBone(ch.FullName + ".bone1");'
    if cmd == 'AlignRootToFirstBone': return 'var ch = chain(); AlignRootToFirstBone(ch);'
    if cmd == 'MoveJoint': return 'var ch = chain(); MoveJoint(ch.FullName + ".bone1", 1, 1, 0, false, true);'
    if cmd in ('SetBoneMinRotLimit', 'SetBoneMaxRotLimit'): return f'var ch = chain(); {cmd}(ch.FullName + ".bone1", {js(args.get("DoMin"))});'
    if cmd in ('SetBoneRotationToPrefRotation', 'KeyAllBoneRotations'): return f'var ch = chain(); {cmd}(ch.FullName + ".bone1");'
    if cmd == 'SetNeutralPose': return f'var c = cube(); SetNeutralPose(c, {js(args.get("Type"))}, {js(args.get("Reset"))});'
    if cmd == 'CreateChainfromCurve': return 'var k = circle(); CreateChainfromCurve(k, 4, false);'
    if cmd == 'CreateSpine': return 'var a = GetPrim("Null"); var b = GetPrim("Null"); Translate(b, 0, 10, 0, "siRelative", "siGlobal", "siObj", "siXYZ"); CreateSpine(a, b, 5, true, false);'
    if cmd == 'AssociateEnvelopeBoundingVolume': return f'var c = cube(); var ch = chain(); ApplyFlexEnv(c + ";" + ch.FullName, false, 2); AssociateEnvelopeBoundingVolume(ch, {js(args.get("BndVolType"))});'
    if cmd == 'LockEnvelopePointWeights': return f'var c = cube(); var ch = chain(); ApplyFlexEnv(c + ";" + ch.FullName, false, 2); LockEnvelopePointWeights(c + ".polymsh.cls.EnvelopWeightCls.Envelope_Weights", c + ".pnt[0,1]", {js(args.get("Locked"))});'
    if cmd == 'ResetUserNormals': return 'var c = cube(); ResetUserNormals(c, false);'
    if cmd == 'AlignBezierKnotsTangents': return f'var k = CreatePrim("Arc", "NurbsCurve", null, null); AlignBezierKnotsTangents(k + ".knot[1]", null, {js(args.get("Mode"))});'
    if cmd == 'DeleteComponent': return 'var c = cube(); DeleteComponent(c + ".poly[0,1]");'
    if cmd == 'InvertPolygons': return 'var c = cube(); InvertPolygons(c);'
    if cmd == 'TriangulatePolygons': return 'var c = cube(); TriangulatePolygons(c);'
    if cmd == 'Create2DSkeleton': return 'Create2DSkeleton(0,0,0,5,0,0,0,0,1);'
    if cmd == 'Create3DSkeleton': return 'Create3DSkeleton(0,0,0,5,2,0,0,0,1);'
    if cmd == 'MakeTail': return 'var ch = chain(); MakeTail(ch.FullName + ".eff", 5, 1, false);'
    if cmd == 'MakeControlSplines': return 'var ch = chain(); MakeControlSplines(ch, null, null, null);'
    if cmd == 'DuplicateSymmetry': return 'var ch = chain(); DuplicateSymmetry(ch, true, "siX", "siWorld", "", "", "", "L_", "R_", false, false, false);'
    if cmd == 'AverageUserNormals': return 'var c = cube(); AverageUserNormals(c + ".sample[0,1,2]", false);'
    if cmd == 'InvertUserNormals': return 'var c = cube(); InvertUserNormals(c + ".sample[0,1,2]", false);'
    if cmd == 'NormalizeUserNormals': return 'var c = cube(); NormalizeUserNormals(c + ".sample[0,1,2]", false);'
    if cmd == 'SetCurveKnotMultiplicity': return 'var k = circle(); SetCurveKnotMultiplicity(k + ".knot[2]", 2);'
    if cmd == 'ApplyThickness': return 'var c = cube(); ApplyThickness(c, 1.0, null, null, null);'
    if cmd == 'ApplySliceBetweenTwoVertices': return 'var c = cube(); ApplySliceBetweenTwoVertices(c + ".pnt[0,5]", null, null);'
    if cmd == 'CapHole': return 'var c = cube(); DeleteComponent(c + ".poly[0]"); CapHole(c + ".edge[0,1]", null);'
    if cmd == 'SplitEdge': return 'var c = cube(); SplitEdge(c + ".edge[0,1,2]", 0.5, null, null);'
    if cmd == 'SpinEdgeForward': return 'var c = cube(); SpinEdgeForward(c + ".edge[0,1]", null);'
    if cmd == 'SpinEdgeBackward': return 'var c = cube(); SpinEdgeBackward(c + ".edge[0,1]", null);'
    if cmd == 'ApplyDeformByCage': return 'var c = cube(); var g = CreatePrim("Cube", "MeshSurface", null, null); Scale(g, 2, 2, 2, "siRelative", "siLocal", "siObj", "siXYZ"); ApplyDeformByCage(c + ";" + g.Name, null, null, null);'
    if cmd == 'SIApplyDeformBySpine': return 'var c = cube(); var k = circle(); SIApplyDeformBySpine(c + ";" + k, null, null, null);'
    if cmd == 'ApplyKinematicOp': return f'var c = cube(); ApplyKinematicOp({js(p)}, c, null, null, null);'
    if cmd == 'ApplyICEOp': return f'var c = cube(); ApplyICEOp({js(p)}, c, null, null);'
    if cmd == 'SetProportionalRadius': return 'SetProportionalRadius(5);'
    return None

out = []
for label, mid in items:
    c = cmds.get(str(mid)) if mid is not None else None
    if not c: out.append((label, None, 'no command')); continue
    if c['cmd'] in SKIP_CMDS: out.append((label, c['cmd'], 'interactive/skipped')); continue
    b = body(c)
    if b is None: out.append((label, c['cmd'], 'no recipe')); continue
    out.append((label, c['cmd'], b))

helpers = r'''
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
function chain(){ var r=Create2DSkeleton(0,0,0,5,0,0,0,0,1); return r; }
function topoSets(){ return [[function(){var c=cube();return c+".poly[0,1,2]";}],[function(){var c=cube();return c+".edge[0,1,2,3]";}],[function(){var c=cube();return c+".pnt[0,1,2,3]";}],[function(){return cube();}],[function(){var c=cube();var s=CreatePrim("Sphere","MeshSurface",null,null);Translate(s,2,2,2,"siRelative","siGlobal","siObj","siXYZ");return c+";"+s.Name;}],[function(){return circle();}],[function(){var k=circle();return k+".knot[2]";}],[function(){var k=circle();return k+".pnt[1,2]";}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name;}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name+".isoline[0.5]";}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name+".pnt[0,1]";}]]; }
function genSets(){ return [[function(){var a=circle();var b=CreatePrim("Arc","NurbsCurve",null,null);Translate(b,0,4,0,"siRelative","siGlobal","siObj","siXYZ");return a+","+b.Name;}],[function(){return circle();}],[function(){var k=circle();return k+".knot[1,3]";}],[function(){var c=cube();return c;}],[function(){var c=cube();return c+".edge[0,1,2]";}],[function(){var c=cube();return c+".poly[0,1]";}],[function(){var c=cube();var s=CreatePrim("Sphere","MeshSurface",null,null);return c+";"+s.Name;}],[function(){var a=circle();var b=circle();Translate(b,0,4,0,"siRelative","siGlobal","siObj","siXYZ");var c=circle();Translate(c,0,8,0,"siRelative","siGlobal","siObj","siXYZ");var d=circle();Translate(d,0,12,0,"siRelative","siGlobal","siObj","siXYZ");return a+","+b.Name+","+c.Name+","+d.Name;}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name;}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);var t=CreatePrim("Sphere","NurbsSurface",null,null);Translate(t,10,0,0,"siRelative","siGlobal","siObj","siXYZ");return s.Name+","+t.Name;}],[function(){var s=CreatePrim("Sphere","NurbsSurface",null,null);return s.Name+".isoline[0.5]";}],[function(){var g=CreatePrim("Grid","NurbsSurface",null,null);var k=circle();return g.Name+";"+k;}],[function(){var c=cube();var k=circle();return c+";"+k;}]]; }
function opSets(){ return [[function(){return cube();}],[function(){var c=cube();var l=GetPrimLattice("Lattice",c,null,null,null);return c+";"+l.Name;}],[function(){var c=cube();var k=circle();return c+";"+k;}],[function(){var c=cube();return c+".pnt[0,1,2]";}],[function(){var c=cube();return c+".edge[0,1]";}],[function(){var c=cube();var n=GetPrim("Null");return c+";"+n.Name;}],[function(){return circle();}],[function(){var c=cube();var s=CreatePrim("Sphere","MeshSurface",null,null);return c+";"+s.Name;}],[function(){var ch=chain();return ch.FullName+".bone1";}],[function(){var ch=chain();var n=GetPrim("Null");return ch.FullName+";"+n.Name;}],[function(){var c=cube();var g=CreatePrim("Grid","MeshSurface",null,null);return c+";"+g.Name;}]]; }
var CUR=null;
function tryEach(cmd, preset, sets){ var errs=[]; for(var i=0;i<sets.length;i++){ NewScene(null,false); var cs; try{ cs=sets[i][0](); }catch(e0){ errs.push("setup:"+e0.description); continue; }
  try{ var r=Application.ExecuteCommand(cmd,[preset,cs]); CUR.used=cs; return r; }catch(e){ errs.push(cs+" => "+e.description); } }
  CUR.errors=errs; throw new Error("all connection sets failed"); }
var RESULTS=[]; var ITEMS=[];
'''

lines = [helpers]
for label, cmd, b in out:
    if b in ('no command', 'interactive/skipped', 'no recipe'):
        lines.append(f'ITEMS.push({{l:{js(label)},cmd:{js(cmd)},skip:{js(b)}}});')
    else:
        lines.append(f'ITEMS.push({{l:{js(label)},cmd:{js(cmd)},f:function(){{ {b} }}}});')
lines.append(r'''
var fso=new ActiveXObject("Scripting.FileSystemObject");
var outPath="C:\\Users\\neil\\Documents\\si_model_dump.json";
var f=fso.CreateTextFile(outPath,true); f.Write("[");
var first=true;
for(var i=0;i<ITEMS.length;i++){ var it=ITEMS[i]; var rec={l:it.l,cmd:it.cmd}; CUR=rec; LogMessage("dump "+i+"/"+ITEMS.length+" "+it.l);
  if(it.skip){ rec.skip=it.skip; } else { try{ NewScene(null,false); var before=names(); it.f(); var after=names(); var objs=[]; for(var k in after) if(!before[k]) objs.push(dumpObj(Dictionary.GetObject(k)));
     // also dump objects that existed in a tryEach context (they were created after NewScene inside tryEach, so they're new anyway)
     rec.objects=objs; rec.ok=true; }catch(e){ rec.ok=false; rec.error=e.description||String(e); } }
  f.Write((first?"":",\n")+enc(rec)); first=false; }
f.Write("]"); f.Close(); NewScene(null,false); LogMessage("DUMP DONE -> "+outPath);
''')
open(os.path.join(root, 'tools', 'si_model_dump.js'), 'w').write('\n'.join(lines))
print(len(out), 'items;', sum(1 for o in out if o[2] in ('no command','interactive/skipped','no recipe')), 'skipped')
print([o for o in out if o[2]=='no recipe'][:40])
