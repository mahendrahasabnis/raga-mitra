#!/bin/bash

echo "🎵 Starting Raga-Mitra Classical Music Player..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm run install:all

echo ""
echo "🌱 Seeding database..."
cd backend
npm run seed
cd ..

echo ""
echo "🚀 Starting development servers..."
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:5000"
echo ""
echo "📱 Default credentials:"
echo "   Admin: +1234567890 / 1234"
echo "   User:  +1234567891 / 1234"
echo ""

npm run dev
