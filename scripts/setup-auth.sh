#!/bin/bash
# ============================================
# Setup Multi-Provider Authentication
# ============================================

set -e

echo "🔐 Setting up Multi-Provider Authentication System"
echo ""

# ============================================
# Frontend Setup
# ============================================

echo "📦 Installing frontend dependencies..."
cd web

# NextAuth.js and related packages
npm install next-auth@5 @auth/prisma-adapter prisma @prisma/client
npm install bcryptjs
npm install react-icons

# Dev dependencies
npm install -D @types/bcryptjs

echo "✅ Frontend dependencies installed"
echo ""

# ============================================
# Create .env.local from template
# ============================================

if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.local.example .env.local
    echo "⚠️  Please update .env.local with your OAuth credentials"
else
    echo "✅ .env.local already exists"
fi

echo ""

# ============================================
# Database Setup (Prisma)
# ============================================

echo "🗄️  Setting up database..."
npx prisma generate
npx prisma migrate dev --name init
echo "✅ Database initialized"

echo ""

# ============================================
# Backend Setup
# ============================================

echo "📦 Installing backend dependencies..."
cd ../

# Auth-related packages
pip install PyJWT python-dotenv

echo "✅ Backend dependencies installed"
echo ""

# ============================================
# Generate NEXTAUTH_SECRET
# ============================================

echo "🔑 Generating NEXTAUTH_SECRET..."
SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET=$SECRET" >> web/.env.local
echo "✅ NEXTAUTH_SECRET generated and added to .env.local"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env.local with OAuth credentials:"
echo "   - Google: https://console.cloud.google.com"
echo "   - GitHub: https://github.com/settings/developers"
echo "   - Microsoft: https://portal.azure.com"
echo ""
echo "2. Start the development server:"
echo "   npm run dev  # in /web directory"
echo "   python -m uvicorn src.api.main:app --reload  # in project root"
echo ""
echo "3. Visit http://localhost:3000/auth/signin to test"
echo ""
