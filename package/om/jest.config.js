module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleDirectories: ['node_modules', 'src'],
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setupTests.ts'],
}
