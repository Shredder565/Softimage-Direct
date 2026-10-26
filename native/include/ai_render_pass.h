#pragma once
// Render pass stub — wires to Softimage-faithful still/movie path when dump lands.
// Attested facts (behavior only, not Softimage code):
//   still Format = pic → Render_Pictures/Default_Pass_Main.1.pic
//   movie default = mp4; never mov; 2K/4K product sizes
// Spec: behavioral/proof/render_command_chain.json + scene-image-render dumps.

#include <string>

class AiApp;

enum class AiRenderMode {
  StillPic,   // Softimage-attested still (.pic)
  MovieMp4,   // AfterImage product default movie (.mp4)
};

struct AiRenderRequest {
  std::wstring passes = L"Passes.Current";
  int start_frame = 1;
  int end_frame = 1;
  int step_frame = 1;
  AiRenderMode mode = AiRenderMode::StillPic;
  int width = 1920;
  int height = 1080;
};

struct AiRenderResult {
  bool ok = false;
  std::wstring output_path;
  std::wstring message;
};

class AiRenderPass {
 public:
  explicit AiRenderPass(AiApp& app);

  // Softimage-faithful still path stub (writes nothing until wire dump available).
  AiRenderResult RenderStill(const AiRenderRequest& req);

  // Movie path stub — default .mp4, never .mov.
  AiRenderResult RenderMovie(const AiRenderRequest& req);

  // Dispatch dump Names: RenderPass / RenderPasses / RenderCurrentFrame / …
  AiRenderResult ExecuteNamed(const std::string& command_name, const AiRenderRequest& req);

  // Resolved Softimage-attested still example path (for UI / logs).
  static std::wstring AttestedStillExamplePath();

 private:
  AiApp& app_;
  bool faithful_path_ready_ = false;  // set true when softimage-pc render dump wires in
};
