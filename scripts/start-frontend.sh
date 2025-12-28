#!/bin/bash
# Start Frontend Server

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

cd "$(dirname "$0")/frontend"
npm run dev

