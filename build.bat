@echo off
REM FDM Stream Capture - Build Script (Firefox XPI)
REM Usage: build.bat

setlocal enabledelayedexpansion

REM --- Lecture version depuis manifest.json ---
set "VERSION="
for /f "tokens=2 delims=:, " %%A in ('findstr /i "\"version\"" manifest.json') do (
    if not defined VERSION set "VERSION=%%~A"
)
set "XPI_NAME=fdm-stream-capture-v%VERSION%.xpi"

echo Building Firefox XPI v%VERSION%...

REM --- Nettoyage ---
if exist "dist\firefox" rmdir /s /q "dist\firefox"
mkdir "dist\firefox"

REM --- Copie des fichiers ---
xcopy /E /I /Y /Q "icons" "dist\firefox\icons" >nul
xcopy /E /I /Y /Q "_locales" "dist\firefox\_locales" >nul
copy "manifest.json"      "dist\firefox\manifest.json"      >nul
copy "constants.js"       "dist\firefox\constants.js"       >nul
copy "config.js"          "dist\firefox\config.js"          >nul
copy "utils.js"           "dist\firefox\utils.js"           >nul
copy "browser-compat.js"  "dist\firefox\browser-compat.js"  >nul
copy "background.js"      "dist\firefox\background.js"      >nul
copy "content.js"         "dist\firefox\content.js"         >nul
copy "content-loader.js"  "dist\firefox\content-loader.js"  >nul
copy "popup.js"           "dist\firefox\popup.js"           >nul
copy "popup.html"         "dist\firefox\popup.html"         >nul
copy "theme.css"          "dist\firefox\theme.css"          >nul
copy "sidebar.js"         "dist\firefox\sidebar.js"         >nul
copy "sidebar.html"       "dist\firefox\sidebar.html"       >nul
copy "options.js"         "dist\firefox\options.js"         >nul
copy "options.html"       "dist\firefox\options.html"       >nul
copy "onboarding.js"      "dist\firefox\onboarding.js"      >nul
copy "onboarding.html"    "dist\firefox\onboarding.html"    >nul

REM --- Création du XPI avec chemins forward-slash (requis Firefox) ---
if exist "dist\%XPI_NAME%" del /q "dist\%XPI_NAME%"

powershell -NoProfile -Command ^
    "Add-Type -Assembly System.IO.Compression.FileSystem; $src = Resolve-Path 'dist\firefox'; $out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath('dist\%XPI_NAME%'); $zip = [IO.Compression.ZipFile]::Open($out, 'Create'); Get-ChildItem -Path $src -Recurse -File | ForEach-Object { $entry = $_.FullName.Substring($src.Path.Length + 1) -replace '\\','/'; [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry, 'Optimal') | Out-Null }; $zip.Dispose()"

echo XPI cree : dist\%XPI_NAME%

echo.
echo Done!
