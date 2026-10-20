@echo off
REM ============================================================================
REM  FIX THE VERCEL LOGIN, ONCE, SO IT STOPS EXPIRING
REM
REM  Ruth, 20 October 2026: "Its happened so many times, I go to fix it and you
REM  say its refreshed."
REM
REM  She is right, and the reason is not that anybody forgot to refresh it.
REM  `vercel login` creates an OAuth session with an expiry, so refreshing it
REM  only restarts the same clock. A token made on the Vercel dashboard does
REM  not expire unless you give it an expiry date.
REM
REM  Double-click this file. It opens the page, takes the token, and writes it
REM  into .env.local. Nothing is typed into a terminal and nothing is run again
REM  in eight days.
REM ============================================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0.."

echo.
echo   SELODIA - a Vercel token that does not expire
echo   =============================================
echo.
echo   The login on this computer keeps lapsing because "vercel login" makes a
echo   session with an expiry date. This replaces it with a token that has none.
echo.
echo   Opening the Vercel tokens page in your browser now.
echo.
echo   On that page:
echo     1. Click "Create Token"
echo     2. Name it:  selodia-build-checks
echo     3. Scope:    ruthinprogress' projects
echo     4. Expiration: choose "No Expiration"
echo     5. Click Create, then copy the token it shows you ONCE
echo.
start "" "https://vercel.com/account/settings/tokens"
timeout /t 3 /nobreak >nul

echo.
set /p VTOKEN=  Paste the token here and press Enter:

if "!VTOKEN!"=="" (
  echo.
  echo   Nothing was pasted, so nothing has been changed. Run this again when
  echo   you have the token.
  echo.
  pause
  exit /b 1
)

REM Keep every other line of .env.local exactly as it is, and replace only this
REM one key. A build file that rewrites a secrets file wholesale is a build file
REM that loses a secret.
set "ENVFILE=.env.local"
set "TMPFILE=.env.local.new"
if exist "%TMPFILE%" del "%TMPFILE%"

if exist "%ENVFILE%" (
  for /f "usebackq delims=" %%L in ("%ENVFILE%") do (
    set "LINE=%%L"
    echo !LINE! | findstr /b /c:"VERCEL_TOKEN=" >nul
    if errorlevel 1 (
      echo !LINE!>>"%TMPFILE%"
    )
  )
)
echo VERCEL_TOKEN=!VTOKEN!>>"%TMPFILE%"
move /y "%TMPFILE%" "%ENVFILE%" >nul

echo.
echo   Saved to .env.local. Checking it works...
echo.
call node scripts\check-live-deployment.mjs
echo.
if errorlevel 1 (
  echo   That did not come back clean. The token may have been pasted short, or
  echo   scoped to the wrong team. Try again, or tell Claude what it printed.
) else (
  echo   Done. This should not need doing again.
)
echo.
pause
