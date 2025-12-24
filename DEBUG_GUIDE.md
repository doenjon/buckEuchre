# 🐛 Debugging Guide

## Quick Start: Debugging with Breakpoints

### Option 1: VS Code Debugger (Recommended)

1. **Set breakpoints** in your code by clicking in the gutter (left of line numbers) in VS Code
2. **Press F5** or go to Run & Debug panel (Cmd+Shift+D on Mac, Ctrl+Shift+D on Windows/Linux)
3. **Select "Debug Backend (VS Code)"** from the dropdown
4. **Click the green play button** or press F5

The debugger will:
- Start the backend with debugging enabled
- Break at your breakpoints
- Allow you to step through code, inspect variables, and evaluate expressions

### Option 2: Attach to Running Process (tsx watch)

If you want to use `tsx watch` for hot reload AND debugging:

1. **Start backend in debug mode:**
   ```bash
   cd backend
   npm run dev:debug
   ```

2. **In VS Code:**
   - Set your breakpoints
   - Go to Run & Debug panel
   - Select "Attach to Backend (tsx watch)"
   - Click the green play button

This gives you:
- ✅ Hot reload (tsx watch)
- ✅ Breakpoints and debugging
- ✅ Step through code

### Option 3: Chrome DevTools

1. **Start backend with debug flag:**
   ```bash
   cd backend
   npm run debug
   ```

2. **Open Chrome** and go to: `chrome://inspect`

3. **Click "inspect"** under your Node.js process

4. **Set breakpoints** in Chrome DevTools Sources tab

## Setting Breakpoints

### In VS Code:
- Click in the **gutter** (left of line numbers) to set a breakpoint
- Red dot appears = breakpoint set
- Click again to remove

### Common Breakpoint Locations for Debugging Crashes:

1. **`backend/src/sockets/game.ts`** - `handleStartNextRound` function (line ~969)
2. **`backend/src/services/state.service.ts`** - `executeGameAction` function
3. **`backend/src/game/state.ts`** - `finishRound`, `startNextRound`, `dealNewRound` functions

## Debugging Tips

### Inspect Variables
- **Hover** over variables to see their values
- **Watch panel**: Add expressions to watch
- **Debug Console**: Type variable names to see values

### Step Controls
- **F10**: Step Over (execute current line)
- **F11**: Step Into (go into function calls)
- **Shift+F11**: Step Out (exit current function)
- **F5**: Continue (resume execution)

### Conditional Breakpoints
- **Right-click** on a breakpoint
- Select "Edit Breakpoint"
- Add a condition (e.g., `gameId === "some-id"`)

### Logpoints
- **Right-click** in gutter
- Select "Add Logpoint"
- Enter expression to log (e.g., `Game ID: ${gameId}, Phase: ${phase}`)
- Execution continues without stopping

## Example: Debugging the "Proceed to Next Round" Crash

1. **Set breakpoints:**
   - `backend/src/sockets/game.ts` line 969 (start of `handleStartNextRound`)
   - `backend/src/sockets/game.ts` line 1002 (inside `executeGameAction` callback)
   - `backend/src/services/state.service.ts` line with `executeGameAction` implementation

2. **Start debugging** (F5 in VS Code)

3. **Trigger the crash** by clicking "Proceed to Next Round" in the frontend

4. **When it breaks:**
   - Inspect `validated.gameId`
   - Check `currentState.phase`
   - Step through each line to see where it fails

5. **If it crashes before hitting breakpoints:**
   - Check the error handlers in `backend/src/index.ts`
   - Set breakpoints in `uncaughtException` and `unhandledRejection` handlers

## Troubleshooting

### "Cannot connect to debugger"
- Make sure port 9229 is not in use: `lsof -ti:9229`
- Kill any existing debug processes

### "Breakpoints not working"
- Ensure source maps are enabled (they are in the config)
- Try restarting the debugger
- Check that you're debugging the correct file (not a compiled version)

### "Debugger disconnects"
- This might be normal if the process crashes
- Check the Debug Console for error messages
- Look at the terminal output for uncaught exceptions

## Advanced: Debugging WebSocket Events

To debug WebSocket events specifically:

1. Set breakpoint in `backend/src/sockets/game.ts` in `registerGameHandlers`
2. When event is received, step into the handler
3. Inspect the `payload` to see what data was sent

## Quick Reference

| Action | Shortcut (Mac) | Shortcut (Windows/Linux) |
|--------|---------------|-------------------------|
| Start Debugging | F5 | F5 |
| Step Over | F10 | F10 |
| Step Into | F11 | F11 |
| Step Out | Shift+F11 | Shift+F11 |
| Continue | F5 | F5 |
| Toggle Breakpoint | F9 | F9 |
| Run & Debug Panel | Cmd+Shift+D | Ctrl+Shift+D |


