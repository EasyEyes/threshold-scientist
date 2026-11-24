// Jest configuration for mutation testing (stryker.conf.json): the full unit
// suite except the webpack build test, which exercises the bundler rather than
// the mutated sources and needs the whole project tree in the sandbox.
const base = require("./jest.config.js");

module.exports = {
  ...base,
  testPathIgnorePatterns: [
    ...base.testPathIgnorePatterns,
    "deploymentBuild\\.test\\.js$",
  ],
};
