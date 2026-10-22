@echo off
REM Runs the Softimage dump script headless (no UI) and writes JSON to Desktop\softimage_dump
set XSI="C:\Program Files\Autodesk\Softimage 2015 SP2\Application\bin\XSIBATCH.bat"
%XSI% -processing -script "%~dp0dump_softimage.py" -lang Python
echo.
echo Finished. Look in %USERPROFILE%\Desktop\softimage_dump
pause
