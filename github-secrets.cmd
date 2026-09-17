@echo off
rem Double-click to open a page with copy buttons for the monthly job's GitHub secrets.
cd /d "%~dp0"
node scripts\github-secrets-helper.mjs
pause
