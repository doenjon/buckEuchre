import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Instance
 * 
 * This is a singleton instance that manages database connections.
 * For development, we log queries and errors. For production, only errors are logged.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  // Increase connection pool timeout and limit to handle concurrent requests
  // Default is 10s timeout and connection_limit is set via DATABASE_URL
  // We'll rely on DATABASE_URL connection_limit parameter for pool size
});

/**
 * Connect to the database
 * 
 * Should be called when the server starts up.
 * Prisma will handle connection pooling automatically.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Disconnect from the database
 * 
 * Should be called during graceful shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Failed to disconnect from database:', error);
    throw error;
  }
}

/**
 * Check if database connection is healthy
 * 
 * Useful for health check endpoints
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
