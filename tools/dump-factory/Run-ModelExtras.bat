@echo off
REM Softimage 2015 SP2 - Model extras dumps (Text per-curve / Boolean mesh / emdl+delta bytes).
REM Headless XSIBATCH -processing ONLY. No Softimage GUI / desktop automation.
REM
REM Usage:
REM   Run-ModelExtras.bat
REM   Run-ModelExtras.bat text
REM   Run-ModelExtras.bat boolean
REM   Run-ModelExtras.bat emdl
setlocal
set SIROOT=C:\Program Files\Autodesk\Softimage 2015 SP2
set XSI="%SIROOT%\Application\bin\XSIBATCH.bat"
set HERE=%~dp0
set OUT=%USERPROFILE%\Documents\softimage_dump_factory\model
if not exist "%OUT%" mkdir "%OUT%"
if not exist "%OUT%\ref" mkdir "%OUT%\ref"

if not exist %XSI% (
  echo XSIBATCH not found at %XSI%
  exit /b 1
)

set WHAT=%~1
if "%WHAT%"=="" set WHAT=all

if /I "%WHAT%"=="all" goto run_all
if /I "%WHAT%"=="text" goto run_text
if /I "%WHAT%"=="boolean" goto run_boolean
if /I "%WHAT%"=="emdl" goto run_emdl
echo Unknown target: %WHAT%
echo Use: all ^| text ^| boolean ^| emdl
exit /b 2

:run_all
call :run_text
call :run_boolean
call :run_emdl
goto finish

:run_text
echo === si_text_curves_detail_dump.js ===
%XSI% -processing -script "%HERE%si_text_curves_detail_dump.js" -lang JScript
if errorlevel 1 echo TEXT_DUMP_FAILED
goto :eof

:run_boolean
echo === si_boolean_mesh_dump.js ===
%XSI% -processing -script "%HERE%si_boolean_mesh_dump.js" -lang JScript
if errorlevel 1 echo BOOLEAN_DUMP_FAILED
goto :eof

:run_emdl
echo === si_emdl_delta_bytes_dump.js ===
%XSI% -processing -script "%HERE%si_emdl_delta_bytes_dump.js" -lang JScript
if errorlevel 1 echo EMDL_DUMP_FAILED
goto :eof

:finish
echo.
echo Expected under %OUT%:
echo   si_text_curves_detail.json
echo   si_boolean_mesh_golden.json
echo   si_emdl_delta_bytes.json
echo   ref\DumpModel.emdl
echo   ref\DumpModel.delta
echo.
dir /b "%OUT%\si_text_curves_detail.json" "%OUT%\si_boolean_mesh_golden.json" "%OUT%\si_emdl_delta_bytes.json" 2>nul
dir /b "%OUT%\ref\DumpModel.emdl" "%OUT%\ref\DumpModel.delta" 2>nul
endlocal
