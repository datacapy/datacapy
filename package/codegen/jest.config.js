module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setupTests.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { types: ['node', 'jest'] } }],
  },
}
