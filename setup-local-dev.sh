#!/bin/bash

# Setup script for local development with online databases
# This script helps you set up environment files for local development

set -e

echo "🔧 Setting up local development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.integrated exists
if [ -f ".env.integrated" ]; then
    echo -e "${YELLOW}⚠️  .env.integrated already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping .env.integrated setup"
    else
        cp env.integrated.local.example .env.integrated
        echo -e "${GREEN}✅ Created .env.integrated from example${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env.integrated with your actual database credentials${NC}"
    fi
else
    cp env.integrated.local.example .env.integrated
    echo -e "${GREEN}✅ Created .env.integrated from example${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env.integrated with your actual database credentials${NC}"
fi

# Check if frontend/.env.local exists
if [ -f "frontend/.env.local" ]; then
    echo -e "${YELLOW}⚠️  frontend/.env.local already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping frontend/.env.local setup"
    else
        cp frontend/env.local.example frontend/.env.local
        echo -e "${GREEN}✅ Created frontend/.env.local from example${NC}"
    fi
else
    cp frontend/env.local.example frontend/.env.local
    echo -e "${GREEN}✅ Created frontend/.env.local from example${NC}"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env.integrated with your online database credentials"
echo "2. Edit frontend/.env.local if needed (defaults should work)"
echo "3. Run 'npm run dev' to start development servers"
echo ""
echo "For detailed instructions, see: LOCAL-DEV-WITH-ONLINE-DB.md"
