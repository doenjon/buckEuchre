module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@buck-euchre/shared$': '<rootDir>/../../../shared/src/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  // Force Jest to exit after tests complete
  forceExit: true,
  // Detect open handles to help debug hanging issues
  detectOpenHandles: true,
};

