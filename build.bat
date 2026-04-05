@echo off
REM FDM Helper - Build Script for Firefox and Chrome
REM Usage: build.bat [firefox|chrome]

setlocal enabledelayedexpansion

if "%1"=="" goto :help
if "%1"=="firefox" goto :build_firefox
if "%1"=="chrome" goto :build_chrome

:help
echo Usage: build.bat [firefox^|chrome]
echo   firefox  - Build Firefox package
echo   chrome   - Build Chrome/Edge package
goto :end

:build_firefox
echo Building Firefox package...
if exist "dist\firefox" rmdir /s /q "dist\firefox"
mkdir "dist\firefox"
xcopy /E /I /Y /Q "icons" "dist\firefox\icons"
xcopy /E /I /Y /Q "_locales" "dist\firefox\_locales"
copy "manifest.json" "dist\firefox\manifest.json" >nul
copy "constants.js" "dist\firefox\constants.js" >nul
copy "config.js" "dist\firefox\config.js" >nul
copy "utils.js" "dist\firefox\utils.js" >nul
copy "browser-compat.js" "dist\firefox\browser-compat.js" >nul
copy "background.js" "dist\firefox\background.js" >nul
copy "content.js" "dist\firefox\content.js" >nul
copy "popup.js" "dist\firefox\popup.js" >nul
copy "popup.html" "dist\firefox\popup.html" >nul
copy "options.js" "dist\firefox\options.js" >nul
copy "options.html" "dist\firefox\options.html" >nul
echo Firefox package built successfully in dist\firefox\
goto :end

:build_chrome
echo Building Chrome package...
if exist "dist\chrome" rmdir /s /q "dist\chrome"
mkdir "dist\chrome"
xcopy /E /I /Y /Q "icons" "dist\chrome\icons"
xcopy /E /I /Y /Q "_locales" "dist\chrome\_locales"
copy "manifest-chrome.json" "dist\chrome\manifest.json" >nul
copy "constants.js" "dist\chrome\constants.js" >nul
copy "config.js" "dist\chrome\config.js" >nul
copy "utils.js" "dist\chrome\utils.js" >nul
copy "browser-compat.js" "dist\chrome\browser-compat.js" >nul
copy "background.js" "dist\chrome\background.js" >nul
copy "content.js" "dist\chrome\content.js" >nul
copy "popup.js" "dist\chrome\popup.js" >nul
copy "popup.html" "dist\chrome\popup.html" >nul
copy "options.js" "dist\chrome\options.js" >nul
copy "options.html" "dist\chrome\options.html" >nul
echo Chrome package built successfully in dist\chrome\
goto :end

:end
echo.
echo Done!
