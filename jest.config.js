module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/__tests__/**/*.test.js"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "public/app.js",
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
