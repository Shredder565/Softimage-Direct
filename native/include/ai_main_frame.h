#pragma once
// Softimage Layout–like main frame chrome stub (original AfterImage Win32 UI).
// Labels and module targets from dump-attested SwitchToolbar / menubar tables.
// Layout topology inspired by data/si/layouts.json Default (Module Menu, View Manager).

#include <windows.h>

class AiApp;

class AiMainFrame {
 public:
  explicit AiMainFrame(AiApp& app);

  bool Create(HINSTANCE instance, int show_cmd);
  HWND Hwnd() const { return hwnd_; }

  static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam);

 private:
  bool RegisterClass(HINSTANCE instance);
  void BuildMenus();
  void LayoutChildren();
  void Paint(HDC hdc);
  void OnCommand(WORD id);
  void InvalidateChrome();

  AiApp& app_;
  HWND hwnd_ = nullptr;
  HWND status_ = nullptr;
  HINSTANCE instance_ = nullptr;

  enum : WORD {
    kCmdFileExit = 1001,
    kCmdModuleBase = 1100,   // + SwitchToolbar Target
    kCmdRenderPass = 1201,
    kCmdRenderPasses = 1202,
    kCmdRenderCurrentFrame = 1203,
    kCmdRenderPreview = 1204,
    kCmdSoftimageLayout = 1301,
    kCmdHelpAbout = 1401,
    // 1601+ — Model pass owns 1501–1509.
    kCmdAnimEditor = 1601,
    kCmdAnimMixer = 1602,
    kCmdAnimFcurve = 1603,
    kCmdAnimKeying = 1604,
    kCmdAnimGet = 1610,
    kCmdAnimCreate = 1611,
    kCmdAnimDeform = 1612,
    kCmdAnimActions = 1613,
    kCmdAnimTools = 1614,
  };
};
