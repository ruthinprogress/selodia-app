@echo off
REM ============================================================================
REM  PASTE THE VERCEL TOKEN INTO A TEXT EDITOR, NOT INTO A BLACK WINDOW
REM
REM  23 October 2026. fix-vercel-login.cmd asks for the token at a `set /p`
REM  prompt, and on this machine the paste did not register: .env.local was
REM  untouched and no temp file was left, so the script took its "nothing was
REM  pasted" branch and exited. Ruth reasonably believed it had worked.
REM
REM  A console window does not echo what you paste, so an empty paste and a
REM  successful one look exactly the same. That is a terrible place to put a
REM  secret you are only shown once.
REM
REM  So this does not ask. It puts a VERCEL_TOKEN= line in .env.local, opens
REM  the file in Notepad with the cursor work already done, and waits. Paste
REM  after the equals sign, save, close. Then it checks.
REM ============================================================================
setlocal EnableDelayedExpansion
cd /d "C:\Users\ruthi\unflump-app"

echo.
echo   SELODIA - paste the Vercel token
echo   ================================
echo.

findstr /b /c:"VERCEL_TOKEN=" .env.local >nul 2>&1
if errorlevel 1 (
  echo.>>.env.local
  echo VERCEL_TOKEN=>>.env.local
  echo   Added an empty VERCEL_TOKEN line to .env.local.
) else (
  echo   There is already a VERCEL_TOKEN line - replace what is after the = sign.
)

echo.
echo   Notepad is opening now.
echo.
echo     1. Find the line that says   VERCEL_TOKEN=
echo     2. Click at the END of that line, after the = sign
echo     3. Paste the token  (Ctrl+V)
echo     4. Save  (Ctrl+S), then close Notepad
echo.
echo   Nothing else in that file should be changed.
echo.
echo   If you no longer have the token, Vercel only shows it once - make a
echo   new one at https://vercel.com/account/settings/tokens with scope
echo   "Full Account" and expiration "No Expiration", then come back.
echo.

start /wait notepad .env.local

echo.
echo   Checking what that gave us...
echo.
call node scripts\headless-readiness.mjs
echo.
call node scripts\check-live-deployment.mjs
echo.
pause
