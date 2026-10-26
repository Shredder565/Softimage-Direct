#pragma once
// Command registry driven by dump-attested Softimage command Names.
// Spec source: behavioral/proof/softimage_command_registry_slice.json + wanted_commands.txt
// Handlers are original AfterImage stubs — never Softimage code.

#include <functional>
#include <string>
#include <unordered_map>
#include <vector>

class AiApp;

struct AiCommandArg {
  std::string name;
  std::string default_value;
};

struct AiCommandDesc {
  std::string name;            // dump scripting_name / Name
  std::string category;
  std::string description;
  std::vector<AiCommandArg> args;
};

using AiCommandHandler = std::function<bool(AiApp& app, const std::vector<std::wstring>& args)>;

class AiCommandRegistry {
 public:
  explicit AiCommandRegistry(AiApp& app);

  // Load Name / arg tables from commands_attested.json (behavior table only).
  bool LoadAttestedTable(const std::wstring& json_path);

  void RegisterHandler(const std::string& name, AiCommandHandler handler);
  bool Execute(const std::string& name, const std::vector<std::wstring>& args = {});
  bool Has(const std::string& name) const;

  const std::vector<AiCommandDesc>& Descriptors() const { return descriptors_; }
  size_t Count() const { return descriptors_.size(); }

 private:
  void RegisterBuiltInHandlers();

  AiApp& app_;
  std::vector<AiCommandDesc> descriptors_;
  std::unordered_map<std::string, AiCommandHandler> handlers_;
};
