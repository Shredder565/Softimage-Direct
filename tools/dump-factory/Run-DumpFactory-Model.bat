@echo off
REM Model golden dumps only - XSIBATCH -processing, no Softimage Desktop.
setlocal
set SIROOT=C:\Program Files\Autodesk\Softimage 2015 SP2
set XSI="%SIROOT%\Application\bin\XSIBATCH.bat"
set HERE=%~dp0
set OUT=%USERPROFILE%\Documents\softimage_dump_factory\model
if not exist "%OUT%" mkdir "%OUT%"

echo === si_topo_params_dump.js ===
call %XSI% -processing -script "%HERE%si_topo_params_dump.js" -lang JScript
if exist "%USERPROFILE%\Documents\softimage_dump_factory\si_topo_ref_params.json" copy /Y "%USERPROFILE%\Documents\softimage_dump_factory\si_topo_ref_params.json" "%OUT%\si_topo_ref_params.json" >nul

echo === si_model_goldens_dump.js ===
call %XSI% -processing -script "%HERE%si_model_goldens_dump.js" -lang JScript

echo === si_text_dump.js ===
call %XSI% -processing -script "%HERE%si_text_dump.js" -lang JScript

echo === si_generators_dump.js ===
call %XSI% -processing -script "%HERE%si_generators_dump.js" -lang JScript

if exist "%HERE%si_model_get_prop_dump.js" (
  echo === si_model_get_prop_dump.js ===
  call %XSI% -processing -script "%HERE%si_model_get_prop_dump.js" -lang JScript
)
if exist "%HERE%si_model_ref_dump.js" (
  echo === si_model_ref_dump.js ===
  call %XSI% -processing -script "%HERE%si_model_ref_dump.js" -lang JScript
)

if exist "%HERE%pack_model_dumps.py" (
  echo === pack into Project store ===
  python "%HERE%pack_model_dumps.py"
)

echo Done: %OUT%
endlocal
