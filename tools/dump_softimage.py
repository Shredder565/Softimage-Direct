# Dumps Softimage's command registry, object-model layout of a sample scene, and
# UI toolbar/menu metadata to JSON files on your Desktop.
# Run with Run-Dump.bat (uses XSIBATCH, no UI), or paste into the Script Editor (Python).
import os, json, sys

try:
    app = Application
except NameError:
    from win32com.client import Dispatch
    app = Dispatch("XSI.Application")

OUT_DIR = os.path.join(os.path.expanduser("~"), "Desktop", "softimage_dump")
if not os.path.isdir(OUT_DIR):
    os.makedirs(OUT_DIR)

def log(msg):
    try:
        app.LogMessage(str(msg))
    except Exception:
        print(msg)

def safe(fn, default=None):
    try:
        return fn()
    except Exception:
        return default

def to_py(v):
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    try:
        if isinstance(v, (list, tuple)):
            return [to_py(x) for x in v]
    except Exception:
        pass
    try:
        return str(v)
    except Exception:
        return None

def write_json(name, data):
    text = json.dumps(data, indent=1, default=str)
    with open(os.path.join(OUT_DIR, name), "w") as f:
        f.write(text)

# ---------------------------------------------------------------- commands
def dump_commands():
    cmds = []
    for c in app.Commands:
        args = []
        for a in safe(lambda: list(c.Arguments), []):
            args.append({
                "name": to_py(safe(lambda: a.Name)),
                "default": to_py(safe(lambda: a.Value)),
                "flags": to_py(safe(lambda: a.Flags)),
                "handler": to_py(safe(lambda: a.Handler)),
            })
        cmds.append({
            "name": to_py(safe(lambda: c.Name)),
            "scripting_name": to_py(safe(lambda: c.ScriptingName)),
            "category": to_py(safe(lambda: c.Category)),
            "description": to_py(safe(lambda: c.Description)),
            "tooltip": to_py(safe(lambda: c.Tooltip)),
            "language": to_py(safe(lambda: c.Language)),
            "file": to_py(safe(lambda: c.FileName)),
            "handler": to_py(safe(lambda: c.Handler)),
            "return_value": to_py(safe(lambda: c.ReturnValue)),
            "flags": to_py(safe(lambda: c.Flags)),
            "enabled": to_py(safe(lambda: c.Enabled)),
            "key_assignable": to_py(safe(lambda: c.SupportsKeyAssignment)),
            "args": args,
        })
    write_json("commands.json", cmds)
    log("commands: %d" % len(cmds))

# ------------------------------------------------------- object model walk
def dump_params(obj, depth=0):
    out = []
    for p in safe(lambda: list(obj.Parameters), []):
        out.append({
            "name": to_py(safe(lambda: p.ScriptName)),
            "label": to_py(safe(lambda: p.Name)),
            "type": to_py(safe(lambda: p.ValueType)),
            "value": to_py(safe(lambda: p.Value)),
            "min": to_py(safe(lambda: p.Min)),
            "max": to_py(safe(lambda: p.Max)),
            "animatable": to_py(safe(lambda: p.Animatable)),
            "keyable": to_py(safe(lambda: p.Keyable)),
            "readonly": to_py(safe(lambda: p.ReadOnly)),
        })
    return out

def dump_node(obj, depth=0, max_depth=6):
    node = {
        "name": to_py(safe(lambda: obj.Name)),
        "fullname": to_py(safe(lambda: obj.FullName)),
        "type": to_py(safe(lambda: obj.Type)),
        "classname": to_py(safe(lambda: app.ClassName(obj))),
    }
    if depth >= max_depth:
        return node
    node["params"] = dump_params(obj)
    node["properties"] = [dump_node(p, depth + 1, max_depth) for p in safe(lambda: list(obj.Properties), [])]
    prim = safe(lambda: obj.ActivePrimitive)
    if prim is not None:
        node["primitive"] = dump_node(prim, depth + 1, max_depth)
        node["operators"] = [dump_node(o, depth + 1, 3) for o in safe(lambda: list(prim.ConstructionHistory), [])]
    kine = safe(lambda: obj.Kinematics)
    if kine is not None:
        node["kinematics"] = {
            "local": dump_params(kine.Local),
            "global": dump_params(kine.Global),
            "constraints": [safe(lambda: c.Type) for c in safe(lambda: list(kine.Constraints), [])],
        }
    mat = safe(lambda: obj.Material)
    if mat is not None:
        node["material"] = dump_node(mat, depth + 1, 3)
        node["shaders"] = [dump_node(s, depth + 1, 2) for s in safe(lambda: list(mat.Shaders), [])]
    node["clusters"] = [dump_node(c, depth + 1, 2) for c in safe(lambda: list(prim.Geometry.Clusters), [])] if prim is not None else []
    node["children"] = [dump_node(c, depth + 1, max_depth) for c in safe(lambda: list(obj.Children), [])]
    return node

def dump_sample_scene():
    # Build a small scene that exercises the Model and Animate toolsets.
    app.NewScene("", False)
    root = app.ActiveSceneRoot
    cube = root.AddGeometry("Cube", "MeshSurface", "Box")
    sph = root.AddGeometry("Sphere", "NurbsSurface", "Ball")
    null = root.AddNull("Ctrl")
    model = root.AddModel([cube], "SampleModel")
    safe(lambda: app.ApplyOp("Twist", cube, 3, 0, 0, 0))
    safe(lambda: app.CreateSkeleton(0, 2))
    safe(lambda: app.SetKey("Box.kine.local.posx", 1, 0))
    safe(lambda: app.SetKey("Box.kine.local.posx", 20, 5))
    safe(lambda: app.StoreAction("", "Box.kine.local.pos", 1, "walk", True, 1, 20))
    safe(lambda: app.ApplyShaderToCnxPoint("Phong", "Box"))
    safe(lambda: app.CreateLayer("", "Layer2", [sph]))
    safe(lambda: app.CreatePass("", "Beauty"))
    scene = {
        "root": dump_node(root),
        "scene_params": dump_params(app.ActiveProject.ActiveScene),
        "layers": [safe(lambda: l.Name) for l in safe(lambda: list(app.ActiveProject.ActiveScene.Layers), [])],
        "passes": [safe(lambda: p.Name) for p in safe(lambda: list(app.ActiveProject.ActiveScene.Passes), [])],
        "mixer": dump_node(root.Mixer) if safe(lambda: root.Mixer) else None,
        "sources": [dump_node(s, 0, 2) for s in safe(lambda: list(root.Sources), [])],
    }
    write_json("sample_scene.json", scene)
    log("sample scene dumped")

# -------------------------------------------------------------- UI metadata
def dump_ui():
    info = {
        "toolbars": [safe(lambda: t.Name) for t in safe(lambda: list(app.Desktop.ActiveLayout.Views), [])],
        "layouts": [safe(lambda: l.Name) for l in safe(lambda: list(app.Desktop.Layouts), [])],
        "filters": [{"name": safe(lambda: f.Name), "type": safe(lambda: f.Type)} for f in safe(lambda: list(app.Filters), [])],
        "preferences": [safe(lambda: p.FullName) for p in safe(lambda: list(app.Preferences.Categories), [])],
        "version": safe(lambda: app.Version()),
    }
    write_json("ui_info.json", info)
    log("ui info dumped")

def main():
    for stage in (dump_commands, dump_ui, dump_sample_scene):
        try:
            stage()
        except Exception as e:
            log("stage %s failed: %s" % (stage.__name__, e))
    log("Done. Files are in: " + OUT_DIR)

main()
