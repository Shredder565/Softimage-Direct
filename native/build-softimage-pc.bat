@echo off
REM Build AfterImageNative on softimage-pc (MSVC + CMake).
REM Run from a "x64 Native Tools Command Prompt for VS" or after vcvars64.bat.
setlocal
cd /d "%~dp0"

where cmake >nul 2>&1
if errorlevel 1 (
  echo ERROR: cmake not on PATH. Install CMake 3.20+ or use "Open Folder" in Visual Studio.
  exit /b 1
)

if not defined VisualStudioVersion (
  echo NOTE: If cl.exe is missing, run this from an MSVC developer command prompt.
)

cmake -S . -B build -G "Visual Studio 17 2022" -A x64
if errorlevel 1 (
  echo VS 2022 generator failed — trying VS 2019...
  cmake -S . -B build -G "Visual Studio 16 2019" -A x64
  if errorlevel 1 exit /b 1
)

cmake --build build --config Release
if errorlevel 1 exit /b 1

echo.
echo Built: %cd%\build\Release\AfterImageNative.exe
echo Data:  %cd%\build\Release\data\commands_attested.json
endlocal
