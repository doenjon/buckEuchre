# Dev Server Performance Issues Analysis

## Problems Identified

### 1. **tsx watch Restarting Server**
- **Issue**: `tsx watch` detects file changes and restarts the server
- **Impact**: Kills all active WebSocket connections and game state
- **Evidence**: Logs show `12:41:26 PM [tsx] change in ./src/ai/ismcts/rollout.ts Restarting...`
- **Why Production Works**: Production uses compiled `node dist/index.js` (no watch mode)

### 2. **985MB Log File**
- **Issue**: Every `console.log` and `console.error` is written to `backend-debug.log`
- **Impact**: Massive I/O overhead, blocking operations
- **Evidence**: `backend/backend-debug.log` is 985MB
- **Why Production Works**: Production likely has minimal logging or no file logging

### 3. **Synchronous File I/O**
- **Issue**: `fs.appendFileSync()` blocks the event loop
- **Impact**: Every log statement blocks, causing performance degradation
- **Evidence**: Code in `backend/src/index.ts` lines 23-38
- **Why Production Works**: Production doesn't have this file logging

## Root Cause

The dev server has **three performance killers**:
1. Constant restarts from `tsx watch`
2. Synchronous file I/O on every log
3. Massive log file (985MB) causing disk I/O issues

Production works because:
- No watch mode (compiled code)
- Minimal logging
- No file logging overhead

## Solutions

1. **Disable file logging in dev** (or make it async/conditional)
2. **Exclude log file from tsx watch** (add to ignore patterns)
3. **Use async logging** instead of `appendFileSync`
4. **Rotate/truncate log file** periodically
5. **Only enable file logging when needed** (debug mode)

