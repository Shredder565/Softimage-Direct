@echo off
REM Softimage dialog / PPG PE + SPDL scrape — NO Softimage Desktop GUI.
REM Prefers Project store internal\softimage-pc-dumps\dialogs\ when present.
setlocal
set SCRIPT_DIR=%~dp0
set PY=python
where py >nul 2>&1 && set PY=py -3

echo === Softimage dialog PE dump (headless) ===
%PY% "%SCRIPT_DIR%dump_dialogs_pe.py"
if errorlevel 1 (
  echo dump_dialogs_pe.py failed
  exit /b 1
)
echo DONE
endlocal
