const config = require("./jest.config");

module.exports = {
  ...config,
  testPathIgnorePatterns: ["/node_modules/"],
};
