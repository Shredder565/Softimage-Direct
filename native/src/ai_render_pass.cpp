#include "ai_render_pass.h"

#include "ai_app.h"

AiRenderPass::AiRenderPass(AiApp& app) : app_(app) {}

std::wstring AiRenderPass::AttestedStillExamplePath() {
  // Softimage Desktop dump-attested still resolution example (behavior path only).
  return L"Render_Pictures\\Default_Pass_Main.1.pic";
}

AiRenderResult AiRenderPass::RenderStill(const AiRenderRequest& req) {
  AiRenderResult r;
  r.output_path = AttestedStillExamplePath();
  if (!faithful_path_ready_) {
    r.ok = false;
    r.message =
        L"RenderStill stub: Softimage-faithful .pic path pending softimage-pc dump wire → " +
        r.output_path + L" (Passes=" + req.passes + L", frames " +
        std::to_wstring(req.start_frame) + L"-" + std::to_wstring(req.end_frame) + L")";
    return r;
  }
  // Future: write Softimage-attested still bytes (Format=pic) — original AfterImage path.
  r.ok = true;
  r.message = L"RenderStill wrote " + r.output_path;
  return r;
}

AiRenderResult AiRenderPass::RenderMovie(const AiRenderRequest& req) {
  AiRenderResult r;
  // Product default .mp4; never .mov (SR-179 / render-mp4-2k4k).
  r.output_path = L"Render_Pictures\\Default_Pass_Main.mp4";
  if (!faithful_path_ready_) {
    r.ok = false;
    r.message = L"RenderMovie stub: Softimage-faithful movie path pending dump wire → " +
                r.output_path + L" (mp4 default; mov refused; " + std::to_wstring(req.width) +
                L"x" + std::to_wstring(req.height) + L")";
    return r;
  }
  r.ok = true;
  r.message = L"RenderMovie wrote " + r.output_path;
  return r;
}

AiRenderResult AiRenderPass::ExecuteNamed(const std::string& command_name,
                                          const AiRenderRequest& req) {
  // Dump-attested chain (render_command_chain.json):
  // UI → RenderPass / RenderPasses → still/movie framebuffer path.
  AiRenderRequest local = req;
  if (command_name == "RenderPreview") {
    local.mode = AiRenderMode::StillPic;
    local.end_frame = local.start_frame;
  } else if (command_name == "RenderCurrentFrame" ||
             command_name == "RenderCurrentFrameAllPasses") {
    local.end_frame = local.start_frame;
    local.mode = AiRenderMode::StillPic;
  } else if (local.start_frame != local.end_frame) {
    local.mode = AiRenderMode::MovieMp4;
  }

  if (local.mode == AiRenderMode::MovieMp4) {
    return RenderMovie(local);
  }
  return RenderStill(local);
}
