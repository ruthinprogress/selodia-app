@echo off
REM ============================================================================
REM  AN EXPO TOKEN, SO PUBLISHING TO THE PHONE NEVER NEEDS A SCREEN
REM
REM  Ruth, 23 October 2026, setting up a server she means never to sit in front
REM  of again: "how will this be managed on a headless server. The whole point
REM  is I remain remote forever, once its set up."
REM
REM  Right now eas-cli signs in the same way `vercel login` did: a browser
REM  session in C:\Users\<you>\.expo\state.json, with an expiry. That is the
REM  kind that lapsed three times in October. On a machine with no monitor its
REM  lapse is a locked door, and publishing to your phone is how code reaches
REM  you at all.
REM
REM  An access token has no expiry and lives in a file. Do this once, here, on
REM  a machine that still has a screen. The token then travels with .env.local
REM  and the server never asks again.
REM
REM  Same shape as fix-vercel-login.cmd, deliberately: one file to double-click,
REM  one page, one paste, and it checks itself before it claims anything.
REM ============================================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0.."

echo.
echo   SELODIA - an Expo token that does not expire
echo   ===========================================
echo.
echo   Publishing to your phone currently relies on a browser login that
echo   expires. This replaces it with a token that does not.
echo.
echo   Opening the Expo access tokens page in your browser now.
echo.
echo   On that page:
echo     1. Click "Create token"
echo     2. Name it:  selodia-publish
echo     3. Click Create, then copy the token it shows you ONCE
echo.
start "" "https://expo.dev/settings/access-tokens"
timeout /t 3 /nobreak >nul

echo.
set /p ETOKEN=  Paste the token here and press Enter:

if "!ETOKEN!"=="" (
  echo.
  echo   Nothing was pasted, so nothing has been changed. Run this again when
  echo   you have the token.
  echo.
  pause
  exit /b 1
)

REM Keep every other line of .env.local exactly as it is, and replace only this
REM one key. A file that rewrites a secrets file wholesale is a file that loses
REM a secret. Same reasoning as fix-vercel-login.cmd.
set "ENVFILE=.env.local"
set "TMPFILE=.env.local.new"
if exist "%TMPFILE%" del "%TMPFILE%"

if exist "%ENVFILE%" (
  for /f "usebackq delims=" %%L in ("%ENVFILE%") do (
    set "LINE=%%L"
    echo !LINE! | findstr /b /c:"EXPO_TOKEN=" >nul
    if errorlevel 1 (
      echo !LINE!>>"%TMPFILE%"
    )
  )
)
echo EXPO_TOKEN=!ETOKEN!>>"%TMPFILE%"
move /y "%TMPFILE%" "%ENVFILE%" >nul

echo.
echo   Saved to .env.local. Checking what this machine still needs...
echo.
call node scripts\headless-readiness.mjs
echo.
echo   If Expo now says TOKEN, publishing will work on a machine with no
echo   screen. If it still says SESSION, the paste did not land - run this
echo   again, or tell Claude what it printed.
echo.
pause
