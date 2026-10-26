#include "ai_command_registry.h"

#include "ai_app.h"
#include "ai_render_pass.h"

#include <fstream>
#include <sstream>

namespace {

bool IsLikelyCommandName(const std::string& name) {
  if (name.empty() || name.find(' ') != std::string::npos) return false;
  if (name == "Target" || name == "mp4" || name == "pic" || name == "mov" || name == "avi") {
    return false;
  }
  // Softimage scripting Names are typically PascalCase / camel identifiers.
  if (!((name[0] >= 'A' && name[0] <= 'Z') || (name[0] >= 'a' && name[0] <= 'z') || name[0] == '_')) {
    return false;
  }
  return true;
}

bool LoadNamesFromJson(const std::wstring& path, std::vector<AiCommandDesc>& out) {
  std::ifstream in(path);
  if (!in) return false;
  std::ostringstream ss;
  ss << in.rdbuf();
  const std::string text = ss.str();
  if (text.empty()) return false;

  // Read scripting_name only (command Name) — never arg "name" fields (Passes/StartFrame).
  size_t cursor = text.find("\"commands\"");
  if (cursor == std::string::npos) cursor = 0;

  while (true) {
    const size_t key = text.find("\"scripting_name\"", cursor);
    if (key == std::string::npos) break;
    const size_t colon = text.find(':', key);
    if (colon == std::string::npos) break;
    const size_t q1 = text.find('"', colon + 1);
    if (q1 == std::string::npos) break;
    const size_t q2 = text.find('"', q1 + 1);
    if (q2 == std::string::npos) break;
    const std::string name = text.substr(q1 + 1, q2 - q1 - 1);
    cursor = q2 + 1;

    if (!IsLikelyCommandName(name)) continue;

    bool dup = false;
    for (const auto& d : out) {
      if (d.name == name) {
        dup = true;
        break;
      }
    }
    if (dup) continue;

    AiCommandDesc desc;
    desc.name = name;
    out.push_back(desc);
  }
  return !out.empty();
}

// Fallback: dump-attested Names from wanted_commands.txt + SwitchToolbar (matrix).
void SeedDumpAttestedNames(std::vector<AiCommandDesc>& out) {
  static const char* kNames[] = {
      "RenderPass",
      "RenderPasses",
      "RenderSelectedPasses",
      "RenderAllPasses",
      "RenderCurrentFrame",
      "RenderCurrentFrameAllPasses",
      "RenderPreview",
      "ExportRenderArchive",
      "ExportRenderArchiveAllPasses",
      "ExportObjectRenderArchive",
      "RenderRegionTool",
      "EditUVProjectionTool",
      "HairTransferMap",
      "HairCopyStyle",
      "HairScalingTool",
      "HairBrushTool",
      "HairRotateRootTool",
      "HairClumpTool",
      "MultiAttachRigidBodiesTool",
      "GATOR",
      "PaintTool",
      "SetUserNormalsSettings",
      "TweakNormalsTool",
      "ProbeMaterialTool",
      "ApplySnapFaceOp",
      "ApplyICEOp",
      "SwitchToolbar",
  };
  for (const char* n : kNames) {
    bool dup = false;
    for (const auto& d : out) {
      if (d.name == n) {
        dup = true;
        break;
      }
    }
    if (!dup) {
      AiCommandDesc d;
      d.name = n;
      out.push_back(d);
    }
  }
}

std::wstring NarrowToWide(const std::string& s) {
  return std::wstring(s.begin(), s.end());
}

}  // namespace

AiCommandRegistry::AiCommandRegistry(AiApp& app) : app_(app) {}

bool AiCommandRegistry::LoadAttestedTable(const std::wstring& json_path) {
  descriptors_.clear();
  if (!LoadNamesFromJson(json_path, descriptors_)) {
    SeedDumpAttestedNames(descriptors_);
  } else {
    // Ensure SwitchToolbar present even if JSON parse skipped layout_modules noise.
    SeedDumpAttestedNames(descriptors_);
  }
  RegisterBuiltInHandlers();
  app_.Log(L"Command registry: " + std::to_wstring(descriptors_.size()) +
           L" dump-attested Name(s) registered");
  return true;
}

void AiCommandRegistry::RegisterHandler(const std::string& name, AiCommandHandler handler) {
  handlers_[name] = std::move(handler);
}

bool AiCommandRegistry::Has(const std::string& name) const {
  return handlers_.find(name) != handlers_.end();
}

bool AiCommandRegistry::Execute(const std::string& name, const std::vector<std::wstring>& args) {
  auto it = handlers_.find(name);
  if (it == handlers_.end()) {
    app_.Log(L"Command not registered: " + NarrowToWide(name));
    return false;
  }
  app_.Log(L"Execute " + NarrowToWide(name));
  return it->second(app_, args);
}

void AiCommandRegistry::RegisterBuiltInHandlers() {
  handlers_.clear();

  auto stub = [](AiApp& app, const std::string& name) {
    return [name](AiApp& a, const std::vector<std::wstring>&) -> bool {
      a.Log(L"stub: " + NarrowToWide(name) + L" (dump-attested Name; handler TBD)");
      return true;
    };
  };

  auto render_named = [](const std::string& name) {
    return [name](AiApp& a, const std::vector<std::wstring>&) -> bool {
      AiRenderRequest req;
      req.mode = AiRenderMode::StillPic;
      const AiRenderResult r = a.Render().ExecuteNamed(name, req);
      a.Log(r.message);
      return r.ok;
    };
  };

  for (const auto& d : descriptors_) {
    if (d.name == "RenderPass" || d.name == "RenderPasses" || d.name == "RenderSelectedPasses" ||
        d.name == "RenderAllPasses" || d.name == "RenderCurrentFrame" ||
        d.name == "RenderCurrentFrameAllPasses" || d.name == "RenderPreview") {
      RegisterHandler(d.name, render_named(d.name));
    } else if (d.name == "SwitchToolbar") {
      RegisterHandler(d.name, [](AiApp& a, const std::vector<std::wstring>& args) -> bool {
        int target = a.ActiveModuleTarget();
        if (!args.empty()) {
          try {
            target = std::stoi(args[0]);
          } catch (...) {
          }
        }
        a.SetActiveModuleTarget(target);
        return true;
      });
    } else {
      RegisterHandler(d.name, stub(app_, d.name));
    }
  }
}
