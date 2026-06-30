@echo off
title PennyWise Financial App Launcher
echo ====================================================================
echo     PENNYWISE: PERSONAL FINANCE ^& EXPENSE TRACKER LAUNCHER
echo ====================================================================
echo.

echo [1/2] Launching Flask Backend Server (MySQL Connection)...
cd backend
start cmd /k "title PennyWise Backend ^&^& echo Booting Flask server with MySQL connection... ^&^& python app.py"
cd ..

echo [2/2] Launching React Frontend Server (Vite Development)...
cd frontend
start cmd /k "title PennyWise Frontend ^&^& echo Booting React development server... ^&^& npm run dev"
cd ..

echo.
echo Both servers are booting up in separate command windows.
echo Preparing browser launch...
timeout /t 6 /nobreak
start http://localhost:5173

echo.
echo Application initialized! Keep the server windows open while browsing.
echo Press any key to close this launcher.
pause > nul
