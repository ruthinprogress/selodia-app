@echo off
REM Double-click this. It builds Selodia for iPhone, on Expo's machines, and
REM asks you some questions along the way. It changes nothing on your computer.
REM
REM YOU WILL BE ASKED TO SIGN IN TO APPLE. That is expected, and it has to be
REM you: type the Apple ID and password you used for the Selodia Ltd enrolment,
REM then the six-digit code that appears on your iPhone. Claude never types that
REM password and it is never written down anywhere.
REM
REM WHAT TO ANSWER:
REM
REM   "Do you want to log in to your Apple account?"        -  Y
REM   Apple ID                                              -  the enrolment one
REM   Password, then the 6-digit code from your iPhone
REM   "Generate a new Apple Distribution Certificate?"      -  Y
REM   "Generate a new Apple Provisioning Profile?"          -  Y
REM
REM Anything it offers to create, say yes to. It is making the signing
REM credentials this app has never had, because Selodia has never been built for
REM iPhone before. They are stored on Expo, not on this machine.
REM
REM THEN IT QUEUES. The build runs on Expo's Mac machines and takes a while -
REM on the free tier the iPhone queue can be long. You can close the window once
REM it prints a link; the build carries on without it, and the link shows you
REM how it is getting on.
cd /d "%~dp0mobile"
echo.
echo   Building Selodia for iPhone.
echo.
echo   This is the first iPhone build there has ever been, so it will ask to
echo   make signing credentials. Say yes to each one.
echo.
call npx eas-cli build --platform ios --profile production
echo.
echo   Press any key to close this window.
pause >nul
