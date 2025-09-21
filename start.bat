@echo off
echo 🎵 Starting Raga-Mitra Classical Music Player...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
call npm run install:all

echo.
echo 🌱 Seeding database...
cd backend
call npm run seed
cd ..

echo.
echo 🚀 Starting development servers...
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:5000
echo.
echo 📱 Default credentials:
echo    Admin: +1234567890 / 1234
echo    User:  +1234567891 / 1234
echo.

call npm run dev
pause
