module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleDirectories: ['node_modules', 'src'],
  modulePaths: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setupTests.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          baseUrl: './src',
          paths: { '*': ['*'] },
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test/**',
    '!src/test-utils/**',
  ],
}
