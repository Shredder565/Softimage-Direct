@echo off
REM Softimage 2015 SP2 - Model extras dumps. XSIBATCH -processing ONLY.
setlocal
set SIROOT=C:\Program Files\Autodesk\Softimage 2015 SP2
set OUT=%USERPROFILE%\Documents\softimage_dump_factory\model
if not exist "%OUT%" mkdir "%OUT%"
if not exist "%OUT%\ref" mkdir "%OUT%\ref"
cd /d "%~dp0"

echo === si_text_curves_detail_dump.js ===
call "%SIROOT%\Application\bin\XSIBATCH.bat" -processing -script "%~dp0si_text_curves_detail_dump.js" -lang JScript
if errorlevel 1 echo TEXT_DUMP_FAILED

echo === si_boolean_mesh_dump.js ===
call "%SIROOT%\Application\bin\XSIBATCH.bat" -processing -script "%~dp0si_boolean_mesh_dump.js" -lang JScript
if errorlevel 1 echo BOOLEAN_DUMP_FAILED

echo === si_emdl_delta_bytes_dump.js ===
call "%SIROOT%\Application\bin\XSIBATCH.bat" -processing -script "%~dp0si_emdl_delta_bytes_dump.js" -lang JScript
if errorlevel 1 echo EMDL_DUMP_FAILED

echo.
echo Expected under %OUT%:
dir /b "%OUT%\si_text_curves_detail.json" "%OUT%\si_boolean_mesh_golden.json" "%OUT%\si_emdl_delta_bytes.json" 2>nul
dir /b "%OUT%\ref\DumpModel.emdl" "%OUT%\ref\DumpModel.delta" 2>nul
endlocal