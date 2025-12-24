#!/bin/bash

# Kill all processes on port 3000 (old backend instances)
echo "🔍 Finding processes on port 3000..."
PIDS=$(lsof -ti:3000)

if [ -z "$PIDS" ]; then
  echo "✓ No processes found on port 3000"
else
  echo "🛑 Killing processes: $PIDS"
  echo "$PIDS" | xargs kill -9
  sleep 1
  echo "✓ Processes killed"
fi

# Start backend
echo "🚀 Starting backend..."
cd /Users/Jon/dev/BuckEuchre/backend
export PATH="/Users/Jon/miniforge3/bin:$PATH"
npm run dev



