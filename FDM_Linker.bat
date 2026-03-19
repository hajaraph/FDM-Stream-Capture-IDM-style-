@echo off
setlocal
title FDM Auto-Linker for Stream Catcher

echo =======================================================
echo          Stream Catcher for FDM - Auto-Linker
echo =======================================================
echo.

set "EXTENSION_ID=stream_catcher_fdm@freedownloadmanager.org"

echo [1/1] Searching and Patching FDM manifests...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$extId='%EXTENSION_ID%'; $rPaths=@('HKCU:\Software\Mozilla\NativeMessagingHosts\org.freedownloadmanager.fdm5.cnh','HKLM:\Software\Mozilla\NativeMessagingHosts\org.freedownloadmanager.fdm5.cnh'); $fFiles=@(); foreach($rp in $rPaths){ if(Test-Path $rp){ $p=(GP $rp).'(default)'; if($p -and (Test-Path $p)){ $fFiles+=$p } } }; $cPaths=@(\"$env:LOCALAPPDATA\Softdeluxe\Free Download Manager\Mozilla\org.freedownloadmanager.fdm5.cnh.json\", \"$env:LOCALAPPDATA\Softdeluxe\Free Download Manager\org.freedownloadmanager.fdm5.cnh.json\", \"C:\Program Files\FreeDownloadManager\mozilla_ext\org.freedownloadmanager.fdm5.cnh.json\"); foreach($cp in $cPaths){ if(Test-Path $cp){ $fFiles+=$cp } }; $fFiles=$fFiles|Select -Unique; if($fFiles.Count -eq 0){ Write-Host '[ERROR] FDM manifest not found.' -F Red; exit 1 }; foreach($mf in $fFiles){ Write-Host \"[V] Patching: $mf\"; try { $j=GC $mf -Raw|ConvertFrom-Json; if($extId -notin $j.allowed_extensions){ $j.allowed_extensions+=$extId; $j|ConvertTo-Json -Depth 10|Set-Content $mf; Write-Host '[OK] Added.' -F Green }else{ Write-Host '[OK] Already Linked.' -F Yellow } } catch { Write-Host '[!] Error: Run as ADMIN.' -F Red } }"

if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Impossible de completer la liaison. 
    echo Assurez-vous d'avoir FDM installe et lancez ce script en tant qu'administrateur.
) else (
    echo.
    echo [BRAVO] Liaison magique reussie !
    echo Veuillez redemarrer completement Firefox pour appliquer.
)

echo.
pause
