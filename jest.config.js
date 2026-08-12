module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/source"],
  testMatch: ["**/__tests__/**/*.test.js", "**/?(*.)+(spec|test).js"],
  testPathIgnorePatterns: ["/node_modules/", "/databaseRules\\.test\\.js$"],
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json", "node"],
  collectCoverageFrom: [
    "source/**/*.{js,jsx,ts,tsx}",
    "!source/**/*.d.ts",
    "!source/**/index.js",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": [
      "babel-jest",
      {
        presets: [
          "@babel/preset-env",
          "@babel/preset-react",
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png)$": "<rootDir>/__mocks__/fileMock.js",
    // threshold/ has its own node_modules with duplicate copies of these
    // packages. Map them to a single copy so a jest.mock() in a test applies
    // to imports from source/ and threshold/ files alike.
    "^file-saver$": "<rootDir>/node_modules/file-saver",
    "^sweetalert2$": "<rootDir>/node_modules/sweetalert2",
  },
  transformIgnorePatterns: ["node_modules/(?!(sweetalert2)/)"],
};
