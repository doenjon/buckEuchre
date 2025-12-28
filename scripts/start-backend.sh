#!/bin/bash
# Start Backend Server

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

cd "$(dirname "$0")/backend"
npm run dev

