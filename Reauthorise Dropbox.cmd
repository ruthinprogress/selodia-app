@echo off
REM Double-click this. It opens Dropbox in your browser, you press Allow, and it
REM saves the new key for you. Nothing else on your computer is changed.
REM
REM DO THE PERMISSIONS FIRST, or this trip is wasted. At
REM dropbox.com/developers/apps, open the Selodia app, go to the Permissions tab,
REM tick the boxes, and press Submit THERE. Permissions added after a key is made
REM are not in that key.
cd /d "%~dp0"
echo.
echo   Reconnecting Dropbox for Selodia.
echo.
node "scripts\dropbox-reauthorise.mjs"
echo.
echo   Press any key to close this window.
pause >nul
