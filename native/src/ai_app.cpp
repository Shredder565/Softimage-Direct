#include "ai_app.h"

#include "ai_command_registry.h"
#include "ai_render_pass.h"

AiApp::AiApp() {
  // Dump-attested SwitchToolbar Target map (afterimage-tab-feature-matrix / render_toolbar_om).
  modules_ = {
      {1, L"Model"},
      {2, L"Animate"},
      {3, L"Render"},
      {4, L"ICE"},
      {5, L"Simulate"},
      {6, L"Hair"},
  };
}

AiApp::~AiApp() { Shutdown(); }

bool AiApp::Init(const std::wstring& data_dir) {
  commands_ = new AiCommandRegistry(*this);
  render_ = new AiRenderPass(*this);

  const std::wstring table = data_dir + L"\\commands_attested.json";
  if (!commands_->LoadAttestedTable(table)) {
    Log(L"WARN: could not load commands_attested.json — registering Names from built-in dump list");
  }
  Log(L"AfterImage native shell ready (Phase 1). Softimage Layout chrome stub + command registry.");
  Log(L"Active module: " + std::wstring(ActiveModuleLabel()));
  return true;
}

void AiApp::Shutdown() {
  delete commands_;
  commands_ = nullptr;
  delete render_;
  render_ = nullptr;
}

const wchar_t* AiApp::ActiveModuleLabel() const {
  for (const auto& m : modules_) {
    if (m.target == active_module_target_) return m.label;
  }
  return L"(unknown)";
}

void AiApp::SetActiveModuleTarget(int target) {
  for (const auto& m : modules_) {
    if (m.target == target) {
      active_module_target_ = target;
      Log(std::wstring(L"SwitchToolbar Target=") + std::to_wstring(target) + L" → " + m.label);
      return;
    }
  }
  Log(L"SwitchToolbar: unknown Target " + std::to_wstring(target));
}

void AiApp::Log(const std::wstring& line) {
  log_.push_back(line);
  if (log_.size() > 200) log_.erase(log_.begin(), log_.begin() + 50);
}
