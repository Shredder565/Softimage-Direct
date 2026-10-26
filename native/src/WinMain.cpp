// AfterImage native entry — original Win32 C++17.
// Softimage dumps = behavior / Name specs only. Never paste Softimage IP into this tree.

#include "ai_app.h"
#include "ai_main_frame.h"

#include <windows.h>
#include <string>

namespace {

std::wstring ExeDirectory() {
  wchar_t buf[MAX_PATH]{};
  GetModuleFileNameW(nullptr, buf, MAX_PATH);
  std::wstring path(buf);
  const size_t slash = path.find_last_of(L"\\/");
  if (slash == std::wstring::npos) return L".";
  return path.substr(0, slash);
}

std::wstring ResolveDataDir() {
  // Prefer <exe>/data (POST_BUILD copy), then <exe>/../data, then cwd/data.
  const std::wstring exe_dir = ExeDirectory();
  const std::wstring candidates[] = {
      exe_dir + L"\\data",
      exe_dir + L"\\..\\data",
      exe_dir + L"\\..\\..\\data",
      L"data",
      L"..\\data",
  };
  for (const auto& c : candidates) {
    const std::wstring probe = c + L"\\commands_attested.json";
    const DWORD attrs = GetFileAttributesW(probe.c_str());
    if (attrs != INVALID_FILE_ATTRIBUTES && !(attrs & FILE_ATTRIBUTE_DIRECTORY)) {
      return c;
    }
  }
  return exe_dir + L"\\data";
}

}  // namespace

int APIENTRY wWinMain(HINSTANCE instance, HINSTANCE /*prev*/, PWSTR /*cmd*/, int show_cmd) {
  AiApp app;
  const std::wstring data_dir = ResolveDataDir();
  if (!app.Init(data_dir)) {
    MessageBoxW(nullptr, L"Failed to initialize AfterImage native app.", L"AfterImage",
                MB_OK | MB_ICONERROR);
    return 1;
  }

  AiMainFrame frame(app);
  if (!frame.Create(instance, show_cmd)) {
    MessageBoxW(nullptr, L"Failed to create Softimage Layout main frame.", L"AfterImage",
                MB_OK | MB_ICONERROR);
    return 2;
  }

  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
  app.Shutdown();
  return static_cast<int>(msg.wParam);
}
