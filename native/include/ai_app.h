#pragma once
// AfterImage native application state — original code.
// Softimage Layout module targets and chrome labels are dump-attested Names only.

#include <string>
#include <vector>

struct AiLayoutModule {
  int target = 0;          // SwitchToolbar Target (dump: 1..6)
  const wchar_t* label = L"";
};

class AiCommandRegistry;
class AiRenderPass;

class AiApp {
 public:
  AiApp();
  ~AiApp();

  bool Init(const std::wstring& data_dir);
  void Shutdown();

  AiCommandRegistry& Commands() { return *commands_; }
  AiRenderPass& Render() { return *render_; }

  int ActiveModuleTarget() const { return active_module_target_; }
  const wchar_t* ActiveModuleLabel() const;
  void SetActiveModuleTarget(int target);

  const std::vector<AiLayoutModule>& Modules() const { return modules_; }
  void Log(const std::wstring& line);
  const std::vector<std::wstring>& LogLines() const { return log_; }

 private:
  std::vector<AiLayoutModule> modules_;
  int active_module_target_ = 1;  // Model (SwitchToolbar Target 1)
  std::vector<std::wstring> log_;
  AiCommandRegistry* commands_ = nullptr;
  AiRenderPass* render_ = nullptr;
};
