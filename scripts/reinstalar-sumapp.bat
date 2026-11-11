@echo off
setlocal
title Reinstalar SumApp (v1.1.46)

echo ============================================
echo   Reinstalacion manual de SumApp (v1.1.46)
echo ============================================
echo.
echo Usar solo si la app se queda colgada al intentar
echo actualizarse sola (pantalla de actualizacion que no avanza).
echo.
pause

echo.
echo [1/3] Cerrando SumApp si esta abierto...
taskkill /IM "SumApp.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

set "INSTALLER_URL=https://github.com/GabrielOrcoapaza/electron-Restaurante/releases/download/v1.1.46/SumApp.exe"
set "INSTALLER_PATH=%TEMP%\SumApp-1.1.46-Setup.exe"

echo.
echo [2/3] Descargando el instalador de la version 1.1.46...
echo       (esto puede tardar unos minutos segun tu internet)
curl -L -o "%INSTALLER_PATH%" "%INSTALLER_URL%"

if not exist "%INSTALLER_PATH%" (
    echo.
    echo ERROR: No se pudo descargar el instalador.
    echo Verifica tu conexion a internet e intenta de nuevo.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Ejecutando el instalador...
start "" "%INSTALLER_PATH%"

echo.
echo Listo. Sigue los pasos del instalador que se abrio.
echo Puedes cerrar esta ventana cuando termine la instalacion.
echo.
pause
endlocal
