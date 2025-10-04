#!/bin/bash
# Buck Euchre Setup Script

set -e  # Exit on error

echo "🎮 Buck Euchre Setup"
echo "===================="
echo ""

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

echo "✅ Node version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo ""

# 1. Start PostgreSQL in Docker
echo "📦 Starting PostgreSQL..."
docker run --name buckeuchre-postgres \
  -e POSTGRES_DB=buckeuchre \
  -e POSTGRES_USER=buckeuchre \
  -e POSTGRES_PASSWORD=dev_password_123 \
  -p 5432:5432 \
  -d postgres:16-alpine || echo "PostgreSQL container already exists"

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

echo ""

# 2. Install dependencies
echo "📥 Installing dependencies..."

echo "  → Installing shared dependencies..."
cd shared && npm install && cd ..

echo "  → Installing backend dependencies..."
cd backend && npm install && cd ..

echo "  → Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo ""

# 3. Set up backend environment
echo "🔧 Setting up backend environment..."
if [ ! -f backend/.env ]; then
  cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://buckeuchre:dev_password_123@localhost:5432/buckeuchre"
JWT_SECRET="dev_jwt_secret_for_buck_euchre_do_not_use_in_production_12345678"
JWT_EXPIRES_IN="24h"
NODE_ENV="development"
PORT="3000"
CORS_ORIGIN="http://localhost:5173"
EOF
  echo "✅ Created backend/.env"
else
  echo "✅ backend/.env already exists"
fi

echo ""

# 4. Set up frontend environment
echo "🔧 Setting up frontend environment..."
if [ ! -f frontend/.env ]; then
  cat > frontend/.env << 'EOF'
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="http://localhost:3000"
EOF
  echo "✅ Created frontend/.env"
else
  echo "✅ frontend/.env already exists"
fi

echo ""

# 5. Generate Prisma client and run migrations
echo "🗄️  Setting up database..."
cd backend
npm run prisma:generate || true
npm run prisma:migrate || npx prisma migrate dev --name init
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the application:"
echo ""
echo "   Terminal 1 (Backend):"
echo "   cd backend && npm run dev"
echo ""
echo "   Terminal 2 (Frontend):"
echo "   cd frontend && npm run dev"
echo ""
echo "   Then open: http://localhost:5173"
echo ""

