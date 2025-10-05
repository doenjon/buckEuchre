/**
 * Test Setup
 * Sets up environment variables and global configuration for all tests
 */

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-for-jwt-security';
process.env.JWT_EXPIRES_IN = '24h';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
