/**
 * @module backend
 * @description Main entry point for Buck Euchre backend server
 */

import dotenv from 'dotenv';
import path from 'path';
import { createAppServer } from './server';
import { connectDatabase, disconnectDatabase } from './db/client';
import { loadActiveGamesFromDatabase, persistAllActiveGames } from './services/state.service';
import { validateEnv } from './config/env';
import { setupAIProviders } from './ai';
import { initializeArenaConfigs } from './arena/arena.service';

// Load environment variables from backend/.env explicitly (not from parent directory)
dotenv.config({ path: path.join(process.cwd(), '.env') });

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
