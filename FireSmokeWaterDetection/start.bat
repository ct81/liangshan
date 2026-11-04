@echo off
cd /d "%~dp0"
echo Starting Fire Detection server...
python app.py %*
echo.
echo Server stopped. See any error above.
pause
