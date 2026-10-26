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
constexpr int kModuleStripH = 32;
constexpr int kStatusH = 22;
constexpr int kLeftTrayW = 220;
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

  hwnd_ = CreateWindowExW(
      0, kClassName, L"AfterImage — Softimage Layout (native Phase 1)",
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
  std::wstring text = L"Module: ";
  text += app_.ActiveModuleLabel();
  text += L"  |  Commands: ";
  text += std::to_wstring(app_.Commands().Count());
  text += L"  |  Still: ";
  text += L"Render_Pictures\\Default_Pass_Main.1.pic";
  SendMessageW(status_, SB_SETTEXTW, 0, reinterpret_cast<LPARAM>(text.c_str()));
  InvalidateRect(hwnd_, nullptr, TRUE);
}

void AiMainFrame::Paint(HDC hdc) {
  RECT rc{};
  GetClientRect(hwnd_, &rc);
  const int bottom = rc.bottom - kStatusH;

  // Softimage Layout stub chrome — original AfterImage paint, dump-attested labels.
  HBRUSH bg = CreateSolidBrush(RGB(45, 45, 48));
  HBRUSH tray = CreateSolidBrush(RGB(62, 62, 66));
  HBRUSH viewport = CreateSolidBrush(RGB(30, 30, 30));
  HBRUSH accent = CreateSolidBrush(RGB(0, 122, 204));

  RECT module_strip{0, 0, rc.right, kModuleStripH};
  FillRect(hdc, &module_strip, tray);

  SetBkMode(hdc, TRANSPARENT);
  SetTextColor(hdc, RGB(220, 220, 220));
  HFONT font = CreateFontW(16, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                           OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                           DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
  HFONT old = static_cast<HFONT>(SelectObject(hdc, font));

  int x = 8;
  for (const auto& m : app_.Modules()) {
    RECT chip{x, 4, x + 72, kModuleStripH - 4};
    if (m.target == app_.ActiveModuleTarget()) {
      FillRect(hdc, &chip, accent);
      SetTextColor(hdc, RGB(255, 255, 255));
    } else {
      SetTextColor(hdc, RGB(200, 200, 200));
    }
    DrawTextW(hdc, m.label, -1, &chip, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    x += 80;
  }

  RECT left{0, kModuleStripH, kLeftTrayW, bottom};
  FillRect(hdc, &left, tray);
  SetTextColor(hdc, RGB(180, 180, 180));
  RECT tray_label{8, kModuleStripH + 8, kLeftTrayW - 8, kModuleStripH + 28};
  DrawTextW(hdc, L"Module Menu / Toolbar Panel", -1, &tray_label, DT_LEFT | DT_SINGLELINE);

  RECT mcp{8, kModuleStripH + 40, kLeftTrayW - 8, kModuleStripH + 160};
  FillRect(hdc, &mcp, bg);
  SetTextColor(hdc, RGB(160, 160, 160));
  RECT mcp_label = mcp;
  InflateRect(&mcp_label, -6, -6);
  DrawTextW(hdc, L"MCP (stub)\nGet / Create / Modify\n(dump PE tops)", -1, &mcp_label,
            DT_LEFT | DT_WORDBREAK);

  RECT view{kLeftTrayW, kModuleStripH, rc.right, bottom};
  FillRect(hdc, &view, viewport);
  SetTextColor(hdc, RGB(140, 140, 140));
  RECT view_label = view;
  InflateRect(&view_label, -12, -12);
  std::wstring body = L"View Manager / Viewport (stub)\nSoftimage Layout chrome — Phase 1\nActive: ";
  body += app_.ActiveModuleLabel();
  body += L"\n\nRender pass stub → Softimage-faithful .pic / .mp4 path (wire when dump ready)";
  DrawTextW(hdc, body.c_str(), -1, &view_label, DT_LEFT | DT_WORDBREAK);

  // Log strip
  RECT log_rc{kLeftTrayW + 8, bottom - 120, rc.right - 8, bottom - 8};
  FillRect(hdc, &log_rc, bg);
  SetTextColor(hdc, RGB(180, 220, 180));
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

  SelectObject(hdc, old);
  DeleteObject(font);
  DeleteObject(bg);
  DeleteObject(tray);
  DeleteObject(viewport);
  DeleteObject(accent);
}

void AiMainFrame::OnCommand(WORD id) {
  if (id == kCmdFileExit) {
    PostMessageW(hwnd_, WM_CLOSE, 0, 0);
    return;
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
