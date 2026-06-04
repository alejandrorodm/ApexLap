@echo off
REM Lanzador para Windows del subidor de ApexLap.
REM Doble clic para arrancar (necesita Python 3 instalado y config.json hecho).
cd /d "%~dp0"
python cm_uploader.py
echo.
echo (El subidor se ha detenido.)
pause
