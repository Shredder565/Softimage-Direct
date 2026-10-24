@echo off
REM Softimage 2015 SP2 dump factory — headless via XSIBATCH (no desktop handoff).
REM Writes JSON under %%USERPROFILE%%\Documents\softimage_dump_factory\
REM
REM Usage:
REM   Run-DumpFactory.bat              — topo params + menus + mcp
REM   Run-DumpFactory.bat topo         — topology params only
REM   Run-DumpFactory.bat menus        — command/menu dump only
REM   Run-DumpFactory.bat mcp          — MCP/state dump only
REM   Run-DumpFactory.bat anim         — Animation: fcurve eval + mixer deep + envelope/shape
REM   Run-DumpFactory.bat model        — Model goldens (prims/topo-extra/deform/props) + follow-up scripts
REM   Run-DumpFactory.bat pe           — PE file scrape only (no XSIBATCH)
setlocal
set SIROOT=C:\Program Files\Autodesk\Softimage 2015 SP2
set XSI="%SIROOT%\Application\bin\XSIBATCH.bat"
set HERE=%~dp0
set OUT=%USERPROFILE%\Documents\softimage_dump_factory
if not exist "%OUT%" mkdir "%OUT%"
if not exist "%OUT%\anim" mkdir "%OUT%\anim"
if not exist "%OUT%\model" mkdir "%OUT%\model"

set WHAT=%~1
if "%WHAT%"=="" set WHAT=all

if /I "%WHAT%"=="pe" goto do_pe
if /I "%WHAT%"=="all" goto check_xsi
if /I "%WHAT%"=="topo" goto check_xsi
if /I "%WHAT%"=="menus" goto check_xsi
if /I "%WHAT%"=="mcp" goto check_xsi
if /I "%WHAT%"=="anim" goto check_xsi
if /I "%WHAT%"=="model" goto check_xsi
echo Unknown target: %WHAT%
echo Use: all ^| topo ^| menus ^| mcp ^| anim ^| model ^| pe
exit /b 2

:check_xsi
if not exist %XSI% (
  echo XSIBATCH not found at %XSI%
  echo Install Softimage 2015 SP2 or edit SIROOT in this bat.
  exit /b 1
)
goto run_%WHAT%

:run_all
call :run_topo
call :run_menus
call :run_mcp
goto finish

:run_topo
echo === si_topo_params_dump.js ===
%XSI% -processing -script "%HERE%si_topo_params_dump.js" -lang JScript
goto :eof

:run_menus
echo === si_dump_menus.js ===
%XSI% -processing -script "%HERE%si_dump_menus.js" -lang JScript
goto :eof

:run_mcp
echo === si_mcp_state_dump.js ===
%XSI% -processing -script "%HERE%si_mcp_state_dump.js" -lang JScript
goto :eof

:run_anim
echo === Animation dumps (fcurve eval / mixer / envelope+shape) ===
if exist "%HERE%si_anim_dump.js" (
  echo --- si_anim_dump.js ---
  %XSI% -processing -script "%HERE%si_anim_dump.js" -lang JScript
)
echo --- si_anim_fcurve_eval_dump.js ---
%XSI% -processing -script "%HERE%si_anim_fcurve_eval_dump.js" -lang JScript
echo --- si_anim_mixer_deep_dump.js ---
%XSI% -processing -script "%HERE%si_anim_mixer_deep_dump.js" -lang JScript
echo --- si_anim_envelope_shape_dump.js ---
%XSI% -processing -script "%HERE%si_anim_envelope_shape_dump.js" -lang JScript
echo.
echo Anim dumps under: %OUT%\anim\
echo   si_anim_fcurve_eval_golden.json
echo   si_anim_mixer_deep.json
echo   si_anim_envelope_shape.json
echo Copy into Softimage-Direct data\dump\ and Project store internal\softimage-pc-dumps\anim\
goto finish

:run_model
echo === Model goldens (XSIBATCH -processing, no Desktop) ===
REM Prefer dedicated Model bat when present (matches softimage-pc-model-dumps.md).
if exist "%HERE%Run-DumpFactory-Model.bat" (
  call "%HERE%Run-DumpFactory-Model.bat"
  goto finish
)
echo --- si_topo_params_dump.js ---
call %XSI% -processing -script "%HERE%si_topo_params_dump.js" -lang JScript
if exist "%OUT%\si_topo_ref_params.json" copy /Y "%OUT%\si_topo_ref_params.json" "%OUT%\model\si_topo_ref_params.json" >nul
echo --- si_model_goldens_dump.js ---
call %XSI% -processing -script "%HERE%si_model_goldens_dump.js" -lang JScript
echo --- si_text_dump.js ---
call %XSI% -processing -script "%HERE%si_text_dump.js" -lang JScript
echo --- si_generators_dump.js ---
call %XSI% -processing -script "%HERE%si_generators_dump.js" -lang JScript
if exist "%HERE%si_model_get_prop_dump.js" (
  echo --- si_model_get_prop_dump.js ---
  call %XSI% -processing -script "%HERE%si_model_get_prop_dump.js" -lang JScript
)
if exist "%HERE%si_model_ref_dump.js" (
  echo --- si_model_ref_dump.js ---
  call %XSI% -processing -script "%HERE%si_model_ref_dump.js" -lang JScript
)
echo.
echo Model dumps under: %OUT%\model\
echo Copy into Softimage-Direct data\dump\ and Project store internal\softimage-pc-dumps\model\
goto finish

:do_pe
call "%HERE%pe_scrape_module_menus.bat"
goto finish

:finish
echo.
echo Finished. Look in:
echo   %OUT%
echo Expected:
echo   si_topo_ref_params.json
echo   si_commands_by_category.json / si_module_commands_gap.json / si_menus_live.json
echo   si_mcp_state.json
echo   pe_module_menus.json  ^(if pe scrape ran^)
echo   anim\*.json           ^(if anim ran^)
echo   model\*.json          ^(if model ran^)
echo.
echo Drop those files into Softimage-Direct data\dump\ or the Project store.
endlocal
