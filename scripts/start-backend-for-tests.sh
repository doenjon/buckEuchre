#!/bin/bash
# Start backend for integration tests

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

cd "$(dirname "$0")/backend"

echo "Installing dependencies..."
npm install

echo "Starting backend..."
npm run dev

