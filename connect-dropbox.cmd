@echo off
rem Double-click to connect the Selodia Library Sync Dropbox app. Opens a page in the browser.
cd /d "%~dp0"
node scripts\dropbox-connect.mjs
pause
