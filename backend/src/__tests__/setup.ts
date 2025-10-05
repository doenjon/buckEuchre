/**
 * Test Setup
 * Sets up environment variables and global configuration for all tests
 */

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local_dev_secret_not_for_production_use_only_12345';
process.env.JWT_EXPIRES_IN = '24h';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgresql://buckeuchre:dev_password_123@localhost:5432/buckeuchre';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
// Deterministic shuffle for tests
process.env.SHUFFLE_SEED = process.env.SHUFFLE_SEED || 'buckeuchre-test-seed';
