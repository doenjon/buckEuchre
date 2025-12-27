/**
 * @module backend
 * @description Main entry point for Buck Euchre backend server
 */

import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { createAppServer } from './server.js';
import { connectDatabase, disconnectDatabase } from './db/client.js';
import { loadActiveGamesFromDatabase, persistAllActiveGames } from './services/state.service.js';
import { validateEnv } from './config/env.js';
import { setupAIProviders } from './ai/index.js';
import { initializeArenaConfigs } from './arena/arena.service.js';

// Load environment variables from backend/.env explicitly (not from parent directory)
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Setup file logging for debugging (only if ENABLE_FILE_LOGGING env var is set)
// DISABLED BY DEFAULT: File logging causes massive performance issues in dev
// - 985MB log files
// - Synchronous I/O blocks event loop
// - tsx watch restarts break active games
// Enable only when debugging specific issues
const ENABLE_FILE_LOGGING = process.env.ENABLE_FILE_LOGGING === 'true';
if (ENABLE_FILE_LOGGING) {
  const LOG_FILE = path.join(process.cwd(), 'backend-debug.log');
  const originalLog = console.log;
  const originalError = console.error;
  
  // Use async logging to avoid blocking
  const writeLog = (level: string, ...args: any[]) => {
    const message = `[${new Date().toISOString()}] ${level}: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
    fs.appendFile(LOG_FILE, message, (err) => {
      if (err) {
        // Silently ignore file write errors
      }
    });
  };
  
  console.log = (...args: any[]) => {
    originalLog(...args);
    writeLog('LOG', ...args);
  };
  console.error = (...args: any[]) => {
    originalError(...args);
    writeLog('ERROR', ...args);
  };
  
  console.log('⚠️  File logging ENABLED (performance impact expected)');
} else {
  console.log('ℹ️  File logging disabled (set ENABLE_FILE_LOGGING=true to enable)');
}

// Debug: Log DATABASE_URL (without password)
console.log('🔍 DATABASE_URL loaded:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || 'NOT SET');
console.log('🔍 Current working directory:', process.cwd());
console.log('🔍 .env file path:', path.join(process.cwd(), '.env'));

// Validate environment variables before starting server
const env = validateEnv();

async function main(): Promise<void> {
  console.log('Buck Euchre Backend Server');
  console.log('==========================\n');

  // Connect to database
  console.log('Connecting to database...');
  await connectDatabase();
  console.log('✓ Database connected\n');

  // Setup AI providers
  console.log('Setting up AI providers...');
  setupAIProviders();
  console.log('✓ AI providers registered\n');

  // Initialize arena configs
  console.log('Initializing AI arena configs...');
  await initializeArenaConfigs();
  console.log('✓ Arena configs initialized\n');

  // Load active games from database into memory
  console.log('Loading active games from database...');
  const gamesLoaded = await loadActiveGamesFromDatabase();
  console.log(`✓ Loaded ${gamesLoaded} active game(s) into memory\n`);

  // Create server
  const { httpServer, io } = createAppServer();

  // Start listening
  httpServer.listen(env.PORT, () => {
    console.log(`✓ Server running on port ${env.PORT}`);
    console.log(`  - REST API: http://localhost:${env.PORT}`);
    console.log(`  - WebSocket: ws://localhost:${env.PORT}`);
    console.log(`  - Environment: ${env.NODE_ENV}\n`);
    console.log('Server ready to accept connections!\n');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    // Stop accepting new connections
    httpServer.close(() => {
      console.log('✓ HTTP server closed');
    });

    // Close all socket connections
    io.close(() => {
      console.log('✓ WebSocket server closed');
    });

    // Persist all active games to database
    console.log('Persisting active games to database...');
    const gamesPersisted = await persistAllActiveGames();
    console.log(`✓ Persisted ${gamesPersisted} game(s) to database`);

    // Disconnect from database
    await disconnectDatabase();
    console.log('✓ Database disconnected');

    console.log('\nShutdown complete. Goodbye!');
    process.exit(0);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
