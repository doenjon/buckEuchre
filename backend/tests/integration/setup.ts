/**
 * Setup file for integration tests
 */

// Increase timeout for all tests
jest.setTimeout(30000);

// Setup globals
beforeAll(() => {
  console.log('🚀 Starting integration test suite');
  console.log('📡 Backend URL: http://localhost:3000');
  console.log('⏰ Make sure backend is running!');
  console.log('');
});

afterAll(() => {
  console.log('');
  console.log('✅ Integration test suite complete');
});

