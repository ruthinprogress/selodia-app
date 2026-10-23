@echo off
REM ========================================================================
REM  PASTE THE EXPO TOKEN INTO A TEXT EDITOR, NOT INTO A BLACK WINDOW
REM
REM  23 October 2026. fix-expo-login.cmd asked for the token at a `set /p`
REM  prompt, exactly as the Vercel one did - and that cost two failed attempts
REM  on the Vercel token before anybody could tell it had failed, because a
REM  console window does not echo a pasted secret.
REM
REM  So the same fix is applied here BEFORE it bites rather than after: the
REM  trap was known, and walking her into it a third time would have been a
REM  choice.
REM
REM  So this does not ask. It puts a EXPO_TOKEN= line in .env.local, opens
REM  the file in Notepad with the cursor work already done, and waits. Paste
REM  after the equals sign, save, close. Then it checks.
REM ========================================================================
setlocal EnableDelayedExpansion
cd /d "C:\Users\ruthi\unflump-app"

echo.
echo   SELODIA - paste the Expo token
echo   ==============================
echo.

findstr /b /c:"EXPO_TOKEN=" .env.local >nul 2>&1
if errorlevel 1 (
  echo.>>.env.local
  echo EXPO_TOKEN=>>.env.local
  echo   Added an empty EXPO_TOKEN line to .env.local.
) else (
  echo   There is already a EXPO_TOKEN line - replace what is after the = sign.
)

echo.
echo   Notepad is opening now.
echo.
echo     1. Find the line that says   EXPO_TOKEN=
echo     2. Click at the END of that line, after the = sign
echo     3. Paste the token  (Ctrl+V)
echo     4. Save  (Ctrl+S), then close Notepad
echo.
echo   Nothing else in that file should be changed.
echo.
echo   If you no longer have the token, Vercel only shows it once - make a
echo   new one at https://expo.dev/settings/access-tokens - Expo tokens have
echo   no expiry, so there is nothing else to choose.
echo.

start /wait notepad .env.local

echo.
echo   Checking what that gave us...
echo.
call node scripts\headless-readiness.mjs
echo.
echo.
pause
