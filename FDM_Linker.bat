@echo off
setlocal
title FDM Auto-Linker for Stream Catcher

echo =======================================================
echo          Stream Catcher for FDM - Auto-Linker
echo =======================================================
echo.

set "EXTENSION_ID=stream_catcher_fdm@freedownloadmanager.org"

echo [1/1] Searching and Patching FDM manifests...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$extId='%EXTENSION_ID%'; $rPaths=@('HKCU:\Software\Mozilla\NativeMessagingHosts\org.freedownloadmanager.fdm5.cnh','HKLM:\Software\Mozilla\NativeMessagingHosts\org.freedownloadmanager.fdm5.cnh'); $fFiles=@(); foreach($rp in $rPaths){ if(Test-Path $rp){ $p=(GP $rp).'(default)'; if($p -and (Test-Path $p)){ $fFiles+=$p } } }; $cPaths=@(\"$env:LOCALAPPDATA\Softdeluxe\Free Download Manager\Mozilla\org.freedownloadmanager.fdm5.cnh.json\", \"$env:LOCALAPPDATA\Softdeluxe\Free Download Manager\org.freedownloadmanager.fdm5.cnh.json\", \"C:\Program Files\FreeDownloadManager\mozilla_ext\org.freedownloadmanager.fdm5.cnh.json\"); foreach($cp in $cPaths){ if(Test-Path $cp){ $fFiles+=$cp } }; $fFiles=$fFiles|Select -Unique; if($fFiles.Count -eq 0){ Write-Host '[ERROR] FDM manifest JSON introuvable.' -F Red; exit 1 }; foreach($mf in $fFiles){ Write-Host \"[V] Modification de: $mf\"; try { $j=GC $mf -Raw|ConvertFrom-Json; if($extId -notin $j.allowed_extensions){ $j.allowed_extensions+=$extId; $j|ConvertTo-Json -Depth 10|Set-Content $mf; Write-Host '[OK] Extension ajoutee avec succes.' -F Green }else{ Write-Host '[OK] Extension deja liee.' -F Yellow } } catch { Write-Host \"[!] Erreur d'ecriture sur le fichier (Droit refuse ou fichier protege).\" -F Red } }"

if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Impossible de completer la liaison.
    echo Assurez-vous d'avoir FDM installe correctement.
) else (
    echo.
    echo [BRAVO] Liaison magique reussie !
    echo Veuillez redemarrer completement votre navigateur (Firefox/Chrome) pour appliquer.
)

echo.
pause
