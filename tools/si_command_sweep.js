// Softimage 2015 SP2 command sweep (JScript) — the Softimage half of tools/sweep_all_commands.mjs.
// Runs EVERY command in Application.Commands with its default arguments on the same starter scene that AfterImage
// builds for ?demo (cube, sphere with a Twist and three keys, null "root_null"; cube selected), one fresh scene per
// command, and appends one JSON line per command to %USERPROFILE%\Desktop\softimage_dump\si_command_sweep.jsonl.
//
// Run headless (recommended — no modal dialogs):
//   "C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\XSIBATCH.bat" -script si_command_sweep.js -main main
// or paste into the Script Editor (JScript) and run.
// The output file is resumable: commands already in it are skipped, so if Softimage dies on one command just run
// again (that command is then written as {"cls":"crashed_softimage"}). Then on the AfterImage side:
//   python3 tools/diff_command_sweep.py si_command_sweep.jsonl docs/re/sweep_afterimage.json
//
// Original code: drives Softimage only through its public scripting API (Application.Commands / ExecuteCommand).

// Commands never run: they end the session, crash on purpose, or wait for an interactive pick forever.
var SKIP = { CrashXSI: 1, Quit: 1, Exit: 1, ExitXSI: 1, PickElement: 1, PickObject: 1, PickPosition: 1, PickElementAndMark: 1 };

var fso = new ActiveXObject("Scripting.FileSystemObject");
var shell = new ActiveXObject("WScript.Shell");
var OUT_DIR = shell.ExpandEnvironmentStrings("%USERPROFILE%") + "\\Desktop\\softimage_dump";
var OUT = OUT_DIR + "\\si_command_sweep.jsonl";
var PENDING = OUT_DIR + "\\si_command_sweep.pending";

function enc(v){ if(v===null||v===undefined) return "null"; var t=typeof v;
 if(t=="number") return isFinite(v)?String(v):"null"; if(t=="boolean") return v?"true":"false";
 if(t=="string"){ return '"'+v.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\r/g,"").replace(/\n/g,"\\n").replace(/\t/g,"\\t")+'"'; }
 if(v instanceof Array){ var a=[]; for(var i=0;i<v.length;i++) a.push(enc(v[i])); return "["+a.join(",")+"]"; }
 var o=[]; for(var k in v) o.push(enc(k)+":"+enc(v[k])); return "{"+o.join(",")+"}"; }

function readDone(){ var done={}; if(!fso.FileExists(OUT)) return done; var f=fso.OpenTextFile(OUT,1);
  while(!f.AtEndOfStream){ var l=f.ReadLine(); var m=/^\{"name":"((?:[^"\\]|\\.)*)"/.exec(l); if(m) done[m[1].replace(/\\(.)/g,"$1")]=1; } f.Close(); return done; }
function append(o){ var f=fso.OpenTextFile(OUT,8,true); f.WriteLine(enc(o)); f.Close(); }
function setPending(n){ var f=fso.CreateTextFile(PENDING,true); if(n!==null) f.Write(n); f.Close(); }
function getPending(){ if(!fso.FileExists(PENDING)) return null; var f=fso.OpenTextFile(PENDING,1); var s=f.AtEndOfStream?"":f.ReadAll(); f.Close(); return s||null; }

function countObjs(){ try{ return Application.ActiveSceneRoot.FindChildren().Count; }catch(e){ return -1; } }
function selNames(){ var r=[]; try{ var e=new Enumerator(Application.Selection); for(;!e.atEnd();e.moveNext()) r.push(e.item().Name); }catch(e){} return r.join(","); }
function retType(v){ if(v===undefined||v===null) return null; try{ if(typeof v=="object"){ try{ return String(v.Type||v.Name||"object"); }catch(e1){ return "object"; } } return typeof v; }catch(e){ return "?"; } }

function demoScene(){
  NewScene(null,false);
  var c=CreatePrim("Cube","MeshSurface",null,null); Translate(c,-8,4,0,"siRelative","siGlobal","siObj","siXYZ");
  var s=CreatePrim("Sphere","MeshSurface",null,null); Translate(s,6,4,0,"siRelative","siGlobal","siObj","siXYZ");
  ApplyOp("Twist",s,3,"siPersistentOperation",null,0);
  SelectObj(s,null,null); SaveKey(s+".kine.local.posx,"+s+".kine.local.posy,"+s+".kine.local.posz",1,null,null,null,null);
  Translate(s,0,8,0,"siRelative","siGlobal","siObj","siXYZ"); SaveKey(s+".kine.local.posx,"+s+".kine.local.posy,"+s+".kine.local.posz",50,null,null,null,null);
  Translate(s,0,-8,0,"siRelative","siGlobal","siObj","siXYZ"); SaveKey(s+".kine.local.posx,"+s+".kine.local.posy,"+s+".kine.local.posz",100,null,null,null,null);
  SetValue("PlayControl.Current",1,null);
  GetPrim("Null","root_null",null,null);
  SelectObj("cube",null,null);
}

function main(){
  if(!fso.FolderExists(OUT_DIR)) fso.CreateFolder(OUT_DIR);
  var done=readDone();
  var crashed=getPending(); if(crashed && !done[crashed]){ append({name:crashed,cls:"crashed_softimage"}); done[crashed]=1; }
  var names=[]; var e=new Enumerator(Application.Commands);
  for(;!e.atEnd();e.moveNext()){ var cmd=e.item(); var n=cmd.ScriptingName||cmd.Name; if(n && !done[n]) names.push({n:n,cat:String(cmd.Category||""),args:cmd.Arguments.Count}); }
  LogMessage("si_command_sweep: "+names.length+" commands to run");
  for(var i=0;i<names.length;i++){
    var n=names[i].n; var rec={name:n,category:names[i].cat,nargs:names[i].args};
    if(SKIP[n]){ rec.cls="skipped"; append(rec); continue; }
    try{ demoScene(); }catch(e0){ rec.cls="setup_failed"; rec.err=String(e0.description||e0); append(rec); continue; }
    var o0=countObjs(), s0=selNames(); var t0=new Date().getTime();
    setPending(n);
    try{ var v=Application.ExecuteCommand(n,[]); rec.ret=retType(v); rec.cls="ran"; }
    catch(e1){ rec.cls="error"; rec.err=String(e1.description||e1.message||e1); rec.code=(e1.number!==undefined)?((e1.number<0?e1.number+0x100000000:e1.number).toString(16)):null; }
    setPending(null);
    rec.ms=new Date().getTime()-t0; rec.objs=countObjs()-o0; rec.selAfter=selNames(); rec.sel=(rec.selAfter!=s0);
    append(rec);
    if(i%100==0) LogMessage("si_command_sweep: "+i+"/"+names.length);
  }
  NewScene(null,false);
  LogMessage("si_command_sweep: done -> "+OUT);
}
// When pasted into the Script Editor there is no -main entry point: run directly.
if(typeof XSIBATCH_MAIN==="undefined") { try{ if(Application.Interactive) main(); }catch(e){} }
