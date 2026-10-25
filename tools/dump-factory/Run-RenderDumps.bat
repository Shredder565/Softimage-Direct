@echo off
REM Softimage 2015 SP2 Render goldens via XSIBATCH (headless preferred).
REM Output: %USERPROFILE%\Documents\softimage_dump_factory\render\*.json
REM Copy finished JSON into Project store internal/softimage-pc-dumps/render/
setlocal
set SIROOT=C:\Program Files\Autodesk\Softimage 2015 SP2
set XSI="%SIROOT%\Application\bin\XSIBATCH.bat"
set HERE=%~dp0
set OUT=%USERPROFILE%\Documents\softimage_dump_factory\render
if not exist "%OUT%" mkdir "%OUT%"

if not exist %XSI% (
  echo XSIBATCH not found at %XSI%
  exit /b 1
)

if exist "%HERE%si_render_fidelity_dump.js" (
  echo === si_render_fidelity_dump.js ===
  call %XSI% -processing -script "%HERE%si_render_fidelity_dump.js" -lang JScript
) else if exist "%HERE%si_render_goldens_dump.js" (
  echo === si_render_goldens_dump.js ===
  call %XSI% -processing -script "%HERE%si_render_goldens_dump.js" -lang JScript
) else (
  echo No render dump script found in %HERE%
  exit /b 2
)
echo.
echo Render dumps under: %OUT%
dir /b "%OUT%\si_render_*.json" 2>nul
exit /b 0
