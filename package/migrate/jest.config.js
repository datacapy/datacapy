module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  moduleDirectories: ["node_modules", "src"],
  silent: true,
  setupFilesAfterEnv: ["<rootDir>/src/test-utils/setupTests.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          types: ["node", "jest"],
        },
      },
    ],
  },
};
