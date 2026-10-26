# AfterImage native Win32 shell (Phase 1 scaffold)
# Original AfterImage code. Dump-attested Names are behavior specs only.
# Softimage binaries / source / decompiles must never be pasted here.
cmake_minimum_required(VERSION 3.20)
project(AfterImageNative LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT WIN32)
  message(WARNING "AfterImageNative targets Windows (Win32). Configure on softimage-pc or windows-latest CI.")
endif()

add_executable(AfterImageNative WIN32
  src/WinMain.cpp
  src/ai_app.cpp
  src/ai_command_registry.cpp
  src/ai_main_frame.cpp
  src/ai_render_pass.cpp
)

target_include_directories(AfterImageNative PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_definitions(AfterImageNative PRIVATE
  UNICODE
  _UNICODE
  WIN32_LEAN_AND_MEAN
  NOMINMAX
)

if(MSVC)
  target_compile_options(AfterImageNative PRIVATE /W4 /permissive- /EHsc)
  # Embed UTF-16 path to attested command table next to the exe at build time copy.
  set_target_properties(AfterImageNative PROPERTIES
    VS_DEBUGGER_WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  )
endif()

# Ship dump-attested Name tables beside the binary (spec JSON, not Softimage code).
add_custom_command(TARGET AfterImageNative POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:AfterImageNative>/data"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
          "${CMAKE_CURRENT_SOURCE_DIR}/data/commands_attested.json"
          "$<TARGET_FILE_DIR:AfterImageNative>/data/commands_attested.json"
  COMMENT "Copy dump-attested command Name table next to AfterImageNative"
)

install(TARGETS AfterImageNative RUNTIME DESTINATION bin)
install(FILES data/commands_attested.json DESTINATION bin/data)
