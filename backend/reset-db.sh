#!/bin/bash
# Reset database for development

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

cd "$(dirname "$0")"

echo "🗑️  Resetting database..."
echo ""
echo "This will delete all games and players."
echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
sleep 3

npx prisma migrate reset --force

echo ""
echo "✅ Database reset complete!"
echo ""
echo "You can now start fresh with:"
echo "  ./start-backend.sh"

