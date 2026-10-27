#include "ai_main_frame.h"

#include "ai_app.h"
#include "ai_command_registry.h"

#include <commctrl.h>
#include <windowsx.h>
#include <string>

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")

namespace {
constexpr wchar_t kClassName[] = L"AfterImageMainFrame";
// Softimage Layout HWND harvest (softimage-pc 2026-10-26): ModuleMenu≈71, MCP≈88,
// status msctls_statusbar32 h=13, module Button 68×19, timeline 17 / timerange 15.
constexpr int kModuleStripH = 19;
constexpr int kStatusH = 13;
constexpr int kLeftTrayW = 71;
constexpr int kMcpW = 88;
constexpr int kModuleBtnW = 68;
constexpr int kModuleBtnH = 19;
constexpr int kTimelineH = 17;
constexpr int kTimerangeH = 15;
constexpr int kBottomRowH = 32;
}  // namespace

AiMainFrame::AiMainFrame(AiApp& app) : app_(app) {}

bool AiMainFrame::RegisterClass(HINSTANCE instance) {
  WNDCLASSEXW wc{};
  wc.cbSize = sizeof(wc);
  wc.style = CS_HREDRAW | CS_VREDRAW;
  wc.lpfnWndProc = AiMainFrame::WndProc;
  wc.hInstance = instance;
  wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
  wc.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1);
  wc.lpszClassName = kClassName;
  wc.hIcon = LoadIcon(nullptr, IDI_APPLICATION);
  wc.hIconSm = wc.hIcon;
  return RegisterClassExW(&wc) != 0;
}

void AiMainFrame::BuildMenus() {
  HMENU menubar = CreateMenu();
  HMENU file_m = CreatePopupMenu();
  AppendMenuW(file_m, MF_STRING, kCmdFileExit, L"E&xit");
  AppendMenuW(menubar, MF_POPUP, reinterpret_cast<UINT_PTR>(file_m), L"&File");

  // Softimage Desktop menubar tops (dump / PE MENU resources) — File/Edit/View/Display/Window/Help.
  AppendMenuW(menubar, MF_STRING, 0, L"&Edit");
  AppendMenuW(menubar, MF_STRING, 0, L"&View");
  AppendMenuW(menubar, MF_STRING, 0, L"&Display");

  HMENU window_m = CreatePopupMenu();
  AppendMenuW(window_m, MF_STRING, kCmdSoftimageLayout, L"Softimage Layout");
  AppendMenuW(menubar, MF_POPUP, reinterpret_cast<UINT_PTR>(window_m), L"&Window");

  HMENU render_m = CreatePopupMenu();
  AppendMenuW(render_m, MF_STRING, kCmdRenderPass, L"RenderPass");
  AppendMenuW(render_m, MF_STRING, kCmdRenderPasses, L"RenderPasses / Render Current Pass");
  AppendMenuW(render_m, MF_STRING, kCmdRenderCurrentFrame, L"RenderCurrentFrame");
  AppendMenuW(render_m, MF_STRING, kCmdRenderPreview, L"RenderPreview");
  AppendMenuW(menubar, MF_POPUP, reinterpret_cast<UINT_PTR>(render_m), L"&Render");

  // Model tab (MENU 204 Get / Create / Modify). Item strings are attested command Names.
  HMENU model_m = CreatePopupMenu();
  HMENU model_get = CreatePopupMenu();
  AppendMenuW(model_get, MF_STRING, kCmdModelGetPrim, L"GetPrim");
  AppendMenuW(model_m, MF_POPUP, reinterpret_cast<UINT_PTR>(model_get), L"&Get");
  HMENU model_create = CreatePopupMenu();
  AppendMenuW(model_create, MF_STRING, kCmdModelCreatePrim, L"CreatePrim");
  AppendMenuW(model_create, MF_STRING, kCmdModelApplyGenOp, L"ApplyGenOp");
  AppendMenuW(model_create, MF_STRING, kCmdModelAssemble, L"UIAssembleNurbsMesh");
  AppendMenuW(model_m, MF_POPUP, reinterpret_cast<UINT_PTR>(model_create), L"&Create");
  HMENU model_modify = CreatePopupMenu();
  AppendMenuW(model_modify, MF_STRING, kCmdModelApplyTopoOp, L"ApplyTopoOp");
  AppendMenuW(model_modify, MF_STRING, kCmdModelApplyOp, L"ApplyOp");
  AppendMenuW(model_modify, MF_STRING, kCmdModelSelectGeneratorInputs, L"SelectGeneratorInputs");
  AppendMenuW(model_modify, MF_STRING, kCmdModelSelectGeneratorOutputs, L"SelectGeneratorOutputs");
  AppendMenuW(model_modify, MF_STRING, kCmdModelAddPolygonTool, L"AddPolygonTool");
  AppendMenuW(model_m, MF_POPUP, reinterpret_cast<UINT_PTR>(model_modify), L"&Modify");
  AppendMenuW(menubar, MF_POPUP, reinterpret_cast<UINT_PTR>(model_m), L"&Model");

  // Animate tab views and RT_MENU 237 section names. Native has no animation engine:
  // the items log the attested name and switch to SwitchToolbar target 2.
  HMENU animate_m = CreatePopupMenu();
  AppendMenuW(animate_m, MF_STRING, kCmdAnimEditor, L"Animation Editor");
  AppendMenuW(animate_m, MF_STRING, kCmdAnimMixer, L"Animation Mixer");
  AppendMenuW(animate_m, MF_STRING, kCmdAnimFcurve, L"Fcurve Editor");
  AppendMenuW(animate_m, MF_STRING, kCmdAnimKeying, L"Keying Panel");
  AppendMenuW(animate_m, MF_SEPARATOR, 0, nullptr);
  AppendMenuW(animate_m, MF_STRING, kCmdAnimGet, L"Get");
  AppendMenuW(animate_m, MF_STRING, kCmdAnimCreate, L"Create");
  AppendMenuW(animate_m, MF_STRING, kCmdAnimDeform, L"Deform");
  AppendMenuW(animate_m, MF_STRING, kCmdAnimActions, L"Actions");
  AppendMenuW(animate_m, MF_STRING, kCmdAnimTools, L"Tools");
  AppendMenuW(menubar, MF_POPUP, reinterpret_cast<UINT_PTR>(animate_m), L"&Animate");

  HMENU help_m = CreatePopupMenu();
  AppendMenuW(help_m, MF_STRING, kCmdHelpAbout, L"About AfterImage Native…");
  AppendMenuW(menubar, MF_POPUP, reinterpret_cast<UINT_PTR>(help_m), L"&Help");

  SetMenu(hwnd_, menubar);
}

bool AiMainFrame::Create(HINSTANCE instance, int show_cmd) {
  instance_ = instance;
  INITCOMMONCONTROLSEX icc{sizeof(icc), ICC_BAR_CLASSES | ICC_STANDARD_CLASSES};
  InitCommonControlsEx(&icc);

  if (!RegisterClass(instance)) return false;

  // Softimage Desktop caption density (HWND title: five-space Project/Scene clusters).
  hwnd_ = CreateWindowExW(
      0, kClassName,
      L"AfterImage     Project: Softimage-Direct     Scene: Untitled",
      WS_OVERLAPPEDWINDOW | WS_VISIBLE, CW_USEDEFAULT, CW_USEDEFAULT, 1280, 800, nullptr,
      nullptr, instance, this);
  if (!hwnd_) return false;

  BuildMenus();

  status_ = CreateWindowExW(0, STATUSCLASSNAMEW, L"", WS_CHILD | WS_VISIBLE | SBARS_SIZEGRIP, 0, 0,
                            0, 0, hwnd_, nullptr, instance, nullptr);

  ShowWindow(hwnd_, show_cmd);
  UpdateWindow(hwnd_);
  LayoutChildren();
  InvalidateChrome();
  return true;
}

void AiMainFrame::LayoutChildren() {
  if (!hwnd_) return;
  RECT rc{};
  GetClientRect(hwnd_, &rc);
  if (status_) {
    SendMessageW(status_, WM_SIZE, 0, 0);
  }
  InvalidateRect(hwnd_, nullptr, TRUE);
}

void AiMainFrame::InvalidateChrome() {
  if (!hwnd_ || !status_) return;
  // Softimage status bar help (Select Objects + L/M/R NODE/BRANCH/TREE) — HWND h=13.
  std::wstring text = L"Select Objects     L NODE     M BRANCH     R TREE     |  ";
  text += app_.ActiveModuleLabel();
  text += L"  |  ";
  text += L"Render_Pictures\\Default_Pass_Main.1.pic";
  SendMessageW(status_, SB_SETTEXTW, 0, reinterpret_cast<LPARAM>(text.c_str()));
  InvalidateRect(hwnd_, nullptr, TRUE);
}

void AiMainFrame::Paint(HDC hdc) {
  RECT rc{};
  GetClientRect(hwnd_, &rc);
  const int bottom = rc.bottom - kStatusH;
  const int chrome_bottom = bottom - kBottomRowH;
  const int timeline_top = chrome_bottom - kTimelineH - kTimerangeH;
  const int mcp_left = kLeftTrayW;
  const int mcp_right = mcp_left + kMcpW;
  const int view_left = mcp_right;

  // Softimage 2015 light warm-gray Layout chrome (HWND dump + Electron --si-* tokens).
  HBRUSH bg = CreateSolidBrush(RGB(172, 168, 165));       // --bg
  HBRUSH panel = CreateSolidBrush(RGB(172, 168, 165));    // --panel
  HBRUSH strip = CreateSolidBrush(RGB(182, 178, 175));    // --bg2
  HBRUSH viewport = CreateSolidBrush(RGB(127, 127, 127)); // --vp-bg
  HBRUSH accent = CreateSolidBrush(RGB(232, 184, 74));    // Softimage gold --accent
  HBRUSH chip_face = CreateSolidBrush(RGB(201, 197, 194)); // --btn-top
  HBRUSH model_hdr = CreateSolidBrush(RGB(162, 138, 172)); // --model purple MCP header
  HBRUSH log_bg = CreateSolidBrush(RGB(246, 244, 242));   // Softimage log face

  RECT module_strip{0, 0, rc.right, kModuleStripH};
  FillRect(hdc, &module_strip, strip);

  SetBkMode(hdc, TRANSPARENT);
  SetTextColor(hdc, RGB(31, 29, 28)); // --text
  HFONT font = CreateFontW(12, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                           OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                           DEFAULT_PITCH | FF_SWISS, L"Tahoma");
  HFONT old = static_cast<HFONT>(SelectObject(hdc, font));

  int x = 2;
  for (const auto& m : app_.Modules()) {
    RECT chip{x, 0, x + kModuleBtnW, kModuleBtnH};
    if (m.target == app_.ActiveModuleTarget()) {
      FillRect(hdc, &chip, accent);
      SetTextColor(hdc, RGB(26, 26, 26));
    } else {
      FillRect(hdc, &chip, chip_face);
      SetTextColor(hdc, RGB(31, 29, 28));
    }
    FrameRect(hdc, &chip, (HBRUSH)GetStockObject(GRAY_BRUSH));
    DrawTextW(hdc, m.label, -1, &chip, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    x += kModuleBtnW + 2;
  }

  RECT left{0, kModuleStripH, kLeftTrayW, chrome_bottom};
  FillRect(hdc, &left, panel);
  SetTextColor(hdc, RGB(74, 70, 68)); // --muted
  RECT tray_label{2, kModuleStripH + 2, kLeftTrayW - 2, kModuleStripH + 18};
  DrawTextW(hdc, L"Module Menu", -1, &tray_label, DT_LEFT | DT_SINGLELINE);

  // Softimage MCP column (HWND mcp_w=88) with purple Model header bevel.
  RECT mcp{mcp_left, kModuleStripH, mcp_right, chrome_bottom};
  FillRect(hdc, &mcp, bg);
  RECT mcp_hdr{mcp_left, kModuleStripH, mcp_right, kModuleStripH + 15};
  FillRect(hdc, &mcp_hdr, model_hdr);
  FrameRect(hdc, &mcp, (HBRUSH)GetStockObject(GRAY_BRUSH));
  SetTextColor(hdc, RGB(31, 29, 28));
  RECT mcp_label{mcp_left + 2, kModuleStripH + 18, mcp_right - 2, chrome_bottom - 2};
  DrawTextW(hdc, L"MCP\nSelect\nTransform\nSnap", -1, &mcp_label, DT_LEFT | DT_WORDBREAK);

  RECT view{view_left, kModuleStripH, rc.right, timeline_top};
  FillRect(hdc, &view, viewport);
  SetTextColor(hdc, RGB(31, 29, 28));
  RECT view_label = view;
  InflateRect(&view_label, -8, -8);
  std::wstring body = L"View Manager / Viewport\nSoftimage Layout HWND chrome\nActive: ";
  body += app_.ActiveModuleLabel();
  body += L"\n\nRender → Softimage Render_Pictures\\….pic + .mp4 sidecar";
  DrawTextW(hdc, body.c_str(), -1, &view_label, DT_LEFT | DT_WORDBREAK);

  // Timeline 17 + Timerange 15 (DS_ChildTimeline / DS_ChildTimerange).
  RECT tl{view_left, timeline_top, rc.right, timeline_top + kTimelineH};
  FillRect(hdc, &tl, strip);
  FrameRect(hdc, &tl, (HBRUSH)GetStockObject(GRAY_BRUSH));
  RECT tr{view_left, timeline_top + kTimelineH, rc.right, chrome_bottom};
  FillRect(hdc, &tr, panel);
  FrameRect(hdc, &tr, (HBRUSH)GetStockObject(GRAY_BRUSH));

  // Command-line / playback row ~32px.
  RECT bottom_row{0, chrome_bottom, rc.right, bottom};
  FillRect(hdc, &bottom_row, strip);
  FrameRect(hdc, &bottom_row, (HBRUSH)GetStockObject(GRAY_BRUSH));
  SetTextColor(hdc, RGB(74, 70, 68));
  RECT cmd_label{4, chrome_bottom + 2, rc.right - 4, bottom - 2};
  DrawTextW(hdc, L"Command Line", -1, &cmd_label, DT_LEFT | DT_VCENTER | DT_SINGLELINE);

  // Log strip — Softimage script/log face (inside viewport area).
  RECT log_rc{view_left + 8, timeline_top - 100, rc.right - 8, timeline_top - 8};
  if (log_rc.top > kModuleStripH + 8) {
    FillRect(hdc, &log_rc, log_bg);
    FrameRect(hdc, &log_rc, (HBRUSH)GetStockObject(GRAY_BRUSH));
    SetTextColor(hdc, RGB(31, 29, 28));
    std::wstring log_text;
    const auto& lines = app_.LogLines();
    const size_t start = lines.size() > 6 ? lines.size() - 6 : 0;
    for (size_t i = start; i < lines.size(); ++i) {
      log_text += lines[i];
      log_text += L"\n";
    }
    if (log_text.empty()) log_text = L"(log)";
    RECT log_inner = log_rc;
    InflateRect(&log_inner, -6, -4);
    DrawTextW(hdc, log_text.c_str(), -1, &log_inner, DT_LEFT | DT_WORDBREAK);
  }

  SelectObject(hdc, old);
  DeleteObject(font);
  DeleteObject(bg);
  DeleteObject(panel);
  DeleteObject(strip);
  DeleteObject(viewport);
  DeleteObject(accent);
  DeleteObject(chip_face);
  DeleteObject(model_hdr);
  DeleteObject(log_bg);
}

void AiMainFrame::ShowPaneContextMenu(int x, int y) {
  // Names are the uiut.dll MENU 246 popups (Context / Relationship / Splitter Contextual)
  // and MENU 163 (Split Horizontally / Split Vertically). The shell logs the pick; it has no frame tree.
  HMENU menu = CreatePopupMenu();
  HMENU context = CreatePopupMenu();
  AppendMenuW(context, MF_STRING, kCmdPaneSplitH, L"Split Horizontally");
  AppendMenuW(context, MF_STRING, kCmdPaneSplitV, L"Split Vertically");
  AppendMenuW(context, MF_SEPARATOR, 0, nullptr);
  AppendMenuW(context, MF_STRING, kCmdPaneRemoveView, L"Remove View");
  AppendMenuW(context, MF_STRING, kCmdPaneDelete, L"Delete Pane");
  AppendMenuW(menu, MF_POPUP, reinterpret_cast<UINT_PTR>(context), L"Context");

  HMENU relationship = CreatePopupMenu();
  AppendMenuW(relationship, MF_STRING, kCmdPaneRelationships, L"Set Relationships...");
  AppendMenuW(menu, MF_POPUP, reinterpret_cast<UINT_PTR>(relationship), L"Relationship");

  HMENU splitter = CreatePopupMenu();
  AppendMenuW(splitter, MF_STRING, kCmdPaneNoSplit, L"No Splitter");
  AppendMenuW(splitter, MF_STRING, kCmdPaneFixed, L"Fixed Splitter");
  AppendMenuW(splitter, MF_STRING, kCmdPaneMovable, L"Movable Splitter");
  AppendMenuW(menu, MF_POPUP, reinterpret_cast<UINT_PTR>(splitter), L"Splitter Contextual");

  TrackPopupMenu(menu, TPM_LEFTALIGN | TPM_RIGHTBUTTON, x, y, 0, hwnd_, nullptr);
  DestroyMenu(menu);
}

void AiMainFrame::OnCommand(WORD id) {
  if (id == kCmdFileExit) {
    PostMessageW(hwnd_, WM_CLOSE, 0, 0);
    return;
  }
  switch (id) {
    case kCmdPaneSplitH: app_.Log(L"Pane: Split Horizontally"); InvalidateChrome(); return;
    case kCmdPaneSplitV: app_.Log(L"Pane: Split Vertically"); InvalidateChrome(); return;
    case kCmdPaneRemoveView: app_.Log(L"Pane: Remove View"); InvalidateChrome(); return;
    case kCmdPaneDelete: app_.Log(L"Pane: Delete Pane"); InvalidateChrome(); return;
    case kCmdPaneRelationships: app_.Log(L"Pane: Set Relationships..."); InvalidateChrome(); return;
    case kCmdPaneNoSplit: app_.Log(L"Pane: No Splitter"); InvalidateChrome(); return;
    case kCmdPaneFixed: app_.Log(L"Pane: Fixed Splitter"); InvalidateChrome(); return;
    case kCmdPaneMovable: app_.Log(L"Pane: Movable Splitter"); InvalidateChrome(); return;
    default: break;
  }
  if (id == kCmdHelpAbout) {
    MessageBoxW(hwnd_,
                L"AfterImage Native (Phase 1)\n\n"
                L"Original Win32 C++17 shell.\n"
                L"Command Names from Softimage dump tables (spec only).\n"
                L"No Softimage binary, source, or decompile in this tree.",
                L"About AfterImage", MB_OK | MB_ICONINFORMATION);
    return;
  }
  if (id == kCmdSoftimageLayout) {
    app_.SetActiveModuleTarget(1);
    app_.Log(L"Softimage Layout → Default (Model toolbar)");
    InvalidateChrome();
    return;
  }
  if (id >= kCmdModuleBase + 1 && id <= kCmdModuleBase + 6) {
    const int target = static_cast<int>(id - kCmdModuleBase);
    app_.Commands().Execute("SwitchToolbar", {std::to_wstring(target)});
    InvalidateChrome();
    return;
  }
  if (id == kCmdRenderPass) {
    app_.Commands().Execute("RenderPass");
    InvalidateChrome();
    return;
  }
  if (id == kCmdRenderPasses) {
    app_.Commands().Execute("RenderPasses");
    InvalidateChrome();
    return;
  }
  if (id == kCmdRenderCurrentFrame) {
    app_.Commands().Execute("RenderCurrentFrame");
    InvalidateChrome();
    return;
  }
  if (id == kCmdRenderPreview) {
    app_.Commands().Execute("RenderPreview");
    InvalidateChrome();
    return;
  }
  const char* model_cmd = nullptr;
  switch (id) {
    case kCmdModelGetPrim: model_cmd = "GetPrim"; break;
    case kCmdModelCreatePrim: model_cmd = "CreatePrim"; break;
    case kCmdModelApplyGenOp: model_cmd = "ApplyGenOp"; break;
    case kCmdModelAssemble: model_cmd = "UIAssembleNurbsMesh"; break;
    case kCmdModelApplyTopoOp: model_cmd = "ApplyTopoOp"; break;
    case kCmdModelApplyOp: model_cmd = "ApplyOp"; break;
    case kCmdModelSelectGeneratorInputs: model_cmd = "SelectGeneratorInputs"; break;
    case kCmdModelSelectGeneratorOutputs: model_cmd = "SelectGeneratorOutputs"; break;
    case kCmdModelAddPolygonTool: model_cmd = "AddPolygonTool"; break;
    default: break;
  }
  if (model_cmd) {
    app_.Commands().Execute(model_cmd);
    InvalidateChrome();
    return;
  }
  const wchar_t* anim = nullptr;
  switch (id) {
    case kCmdAnimEditor: anim = L"Animation Editor"; break;
    case kCmdAnimMixer: anim = L"Animation Mixer"; break;
    case kCmdAnimFcurve: anim = L"Fcurve Editor"; break;
    case kCmdAnimKeying: anim = L"Keying Panel"; break;
    case kCmdAnimGet: anim = L"Get"; break;
    case kCmdAnimCreate: anim = L"Create"; break;
    case kCmdAnimDeform: anim = L"Deform"; break;
    case kCmdAnimActions: anim = L"Actions"; break;
    case kCmdAnimTools: anim = L"Tools"; break;
    default: break;
  }
  if (anim) {
    app_.Log(std::wstring(L"Animate: ") + anim);
    app_.SetActiveModuleTarget(2);
    InvalidateChrome();
  }
}

LRESULT CALLBACK AiMainFrame::WndProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam) {
  AiMainFrame* self = nullptr;
  if (msg == WM_NCCREATE) {
    auto* cs = reinterpret_cast<CREATESTRUCTW*>(lparam);
    self = static_cast<AiMainFrame*>(cs->lpCreateParams);
    SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
    self->hwnd_ = hwnd;
  } else {
    self = reinterpret_cast<AiMainFrame*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
  }

  switch (msg) {
    case WM_CREATE:
      return 0;
    case WM_SIZE:
      if (self) self->LayoutChildren();
      return 0;
    case WM_PAINT: {
      PAINTSTRUCT ps{};
      HDC hdc = BeginPaint(hwnd, &ps);
      if (self) self->Paint(hdc);
      EndPaint(hwnd, &ps);
      return 0;
    }
    case WM_COMMAND:
      if (self) self->OnCommand(LOWORD(wparam));
      return 0;
    case WM_CONTEXTMENU:
      if (self) {
        int x = GET_X_LPARAM(lparam);
        int y = GET_Y_LPARAM(lparam);
        if (x == -1 && y == -1) {
          POINT pt{0, 0};
          ClientToScreen(hwnd, &pt);
          x = pt.x;
          y = pt.y;
        }
        self->ShowPaneContextMenu(x, y);
      }
      return 0;
    case WM_LBUTTONDOWN: {
      if (!self) return 0;
      const int x = GET_X_LPARAM(lparam);
      const int y = GET_Y_LPARAM(lparam);
      if (y >= 0 && y < kModuleStripH) {
        int chip_x = 8;
        for (const auto& m : self->app_.Modules()) {
          if (x >= chip_x && x < chip_x + 72) {
            self->app_.Commands().Execute("SwitchToolbar", {std::to_wstring(m.target)});
            self->InvalidateChrome();
            break;
          }
          chip_x += 80;
        }
      }
      return 0;
    }
    case WM_DESTROY:
      PostQuitMessage(0);
      return 0;
    default:
      break;
  }
  return DefWindowProcW(hwnd, msg, wparam, lparam);
}
