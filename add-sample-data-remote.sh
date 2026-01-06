#!/bin/bash
# Script to add sample data via API endpoint (if available) or via direct database connection

echo "═══════════════════════════════════════════════════════════"
echo "📝 Adding Sample Past Visit Data for +919881255701"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Option 1: If there's an API endpoint for seeding (currently not available)
# We'll need to run the script directly with proper database credentials

echo "⚠️  Note: This script requires direct database access."
echo "   The script will connect to Cloud SQL to add sample data."
echo ""
echo "📋 Prerequisites:"
echo "   1. Cloud SQL Proxy running OR"
echo "   2. Direct database access configured"
echo "   3. User +919881255701 must exist in platforms_99 database"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

cd backend

# Check if .env.integrated exists
if [ ! -f ".env.integrated" ]; then
    echo "❌ .env.integrated file not found!"
    echo "   Please create it with database credentials."
    exit 1
fi

# Run the script
npm run db:sample:past-visits

