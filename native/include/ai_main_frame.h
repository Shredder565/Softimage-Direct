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
  // uiut.dll pane context (MENU 246) + splitter (MENU 163) — attested item names, TrackPopupMenu.
  void ShowPaneContextMenu(int x, int y);

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
    // uiut.dll MENU 163 / 246 item ids (resource command ids, used as menu command ids).
    kCmdPaneSplitH = 1923,
    kCmdPaneSplitV = 1924,
    kCmdPaneRemoveView = 1926,
    kCmdPaneDelete = 1976,
    kCmdPaneRelationships = 160,
    kCmdPaneNoSplit = 1970,
    kCmdPaneFixed = 1971,
    kCmdPaneMovable = 1972,
    // Model module menu (MENU 204 tops). Same dispatch as the Render popup: attested command Names.
    kCmdModelGetPrim = 1501,
    kCmdModelCreatePrim = 1502,
    kCmdModelApplyGenOp = 1503,
    kCmdModelAssemble = 1504,
    kCmdModelApplyTopoOp = 1505,
    kCmdModelApplyOp = 1506,
    kCmdModelSelectGeneratorInputs = 1507,
    kCmdModelSelectGeneratorOutputs = 1508,
    kCmdModelAddPolygonTool = 1509,
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
