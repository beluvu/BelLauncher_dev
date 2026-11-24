@echo off
chcp 65001 >nul
echo === Beluvu Launcher: build exe ===
python --version || (echo Python not found. Install Python 3.12+ from python.org, tick "Add Python to PATH", then run again. & pause & exit /b 1)
python -m pip install --upgrade pip || (echo pip failed & pause & exit /b 1)
python -m pip install -r requirements.txt || (echo Dependencies failed to install & pause & exit /b 1)
python -m unittest discover -s test || (echo Tests failed, build stopped & pause & exit /b 1)
python -m PyInstaller --noconfirm --clean --onefile --windowed --name "BeluvuLauncher" --icon "assets\icon.ico" --add-data "web;web" --exclude-module tkinter --exclude-module unittest --exclude-module pydoc --collect-all webview --collect-all PyQt6 main.py || (echo Build failed & pause & exit /b 1)
echo.
echo Done! File: dist\BeluvuLauncher.exe
echo Distribute only this .exe. Source code is closed (see LICENSE).
pause
