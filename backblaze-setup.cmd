@echo off
rem Double-click to set up the library's new home on Backblaze B2.
rem Opens a page on this laptop with the steps, the boxes to paste into,
rem and a connection test. Nothing typed there leaves the machine.
cd /d "%~dp0"
node scripts/backblaze-setup-helper.mjs
pause
