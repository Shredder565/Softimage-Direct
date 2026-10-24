@echo off
REM File-based PE scrape of Softimage 2015 SP2 menus — no Softimage UI, no computer-use.
REM Prefer this when softimage-pc worker can read the install path.
setlocal
set SI=C:\Program Files\Autodesk\Softimage 2015 SP2
set OUT=%USERPROFILE%\Documents\softimage_dump_factory
if not exist "%OUT%" mkdir "%OUT%"

REM Prefer Softimage-Direct tools\pe_resources.py if this repo is checked out next to dump-factory.
set SCRIPT=%~dp0pe_scrape_module_menus.py
set PY=python
where python >nul 2>&1 || set PY=py

echo Scraping PE menus from:
echo   %SI%\Application\bin
echo Output:
echo   %OUT%\pe_module_menus.json
echo.

%PY% "%SCRIPT%" --si "%SI%" -o "%OUT%\pe_module_menus.json"
if errorlevel 1 (
  echo.
  echo FAILED. Ensure Python 3 is on PATH and pe_resources.py is importable
  echo ^(Softimage-Direct tools\pe_resources.py or copy next to this script^).
  exit /b 1
)
echo.
echo Done. Drop pe_module_menus.json into the Project store / Softimage-Direct PR.
endlocal
