@echo off
rem DOUBLE-CLICK THIS TO READ THE BUG LIST.
rem
rem Ruth, 18 October 2026: the bug list "needs reviewing daily at this stage".
rem Her standing rule is that a hand-run step gets a double-click and a browser
rem page, never a terminal she has to type into - so this is the double-click,
rem and scripts/bug-list.mjs writes the page and opens it.
cd /d "%~dp0"
node "scripts\bug-list.mjs"
if errorlevel 1 (
  echo.
  echo Something went wrong. The message above says what.
  pause
)
