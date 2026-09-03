module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
  setupFilesAfterEnv: ["./src/tests/setup.ts"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
};