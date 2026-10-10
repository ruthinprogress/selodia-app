@echo off
REM Double-click this. It uploads the iPhone build to App Store Connect, which
REM is the Apple equivalent of dragging the .aab into Play yesterday. It changes
REM nothing on your computer.
REM
REM THE BUILD IS ALREADY MADE. This only sends it. Nothing is compiled here and
REM nothing is published to anybody: the build lands in App Store Connect, where
REM it then has to be put on TestFlight deliberately.
REM
REM YOU SIGN IN TO APPLE, NOT CLAUDE. Type the Apple ID and password for the
REM Selodia Ltd enrolment, then the six-digit code on your iPhone.
REM
REM WHAT TO ANSWER:
REM
REM   "Do you want to log in to your Apple account?"            -  Y
REM   Apple ID, password, then the 6-digit code
REM   "Generate an App Store Connect API Key?"                  -  Y
REM
REM WHAT THAT KEY IS, because saying yes to making a key deserves an
REM explanation: Apple will not accept an upload on a password alone. The key is
REM a credential created in YOUR developer account, stored on Expo, and used only
REM to upload builds. You can see it at any time under Users and Access, Integrations,
REM App Store Connect API, and you can revoke it there. It is not a password and
REM it cannot be used to sign in as you.
REM
REM THEN IT UPLOADS, and then Apple PROCESSES it, which takes a few minutes to
REM an hour. It will appear in App Store Connect under TestFlight when it is
REM ready, often with a warning email about something harmless - read it, do not
REM act on it until we have looked at it together.
cd /d "%~dp0mobile"
echo.
echo   Uploading Selodia to App Store Connect.
echo.
echo   The build is already made. This only sends it, and sends it to nobody:
echo   it lands in your account, not in front of any tester.
echo.
call npx eas-cli submit --platform ios --latest
echo.
echo   Press any key to close this window.
pause >nul
