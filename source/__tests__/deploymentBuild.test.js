/** @jest-environment node */

const fs = require("fs");
const os = require("os");
const path = require("path");
const webpack = require("webpack");

const createWebpackConfig = require("../../webpack.config");

global.setImmediate =
  global.setImmediate ||
  ((callback, ...args) => setTimeout(callback, 0, ...args));
jest.setTimeout(30000);

const compile = (config) =>
  new Promise((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }

      if (stats.hasErrors()) {
        reject(new Error(stats.toString({ all: false, errors: true })));
        return;
      }

      resolve(stats);
    });
  });

describe("compiler deployment build", () => {
  const originalDeployId = process.env.DEPLOY_ID;

  afterEach(() => {
    if (originalDeployId === undefined) {
      delete process.env.DEPLOY_ID;
    } else {
      process.env.DEPLOY_ID = originalDeployId;
    }
  });

  it("rejects a production build without DEPLOY_ID", () => {
    delete process.env.DEPLOY_ID;

    expect(() => createWebpackConfig({ production: true })).toThrow(
      "DEPLOY_ID is required for production compiler builds",
    );
  });

  it("emits matching deployment identity and a content-hashed bundle", async () => {
    process.env.DEPLOY_ID = "deploy-test-123";
    const outputPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "compiler-deployment-build-"),
    );
    const entryPath = path.join(outputPath, "entry.js");
    fs.writeFileSync(entryPath, 'console.log("compiler build fixture");');
    const config = createWebpackConfig({ production: true });
    config.entry = entryPath;
    config.module = { rules: [] };
    config.optimization = { minimize: false };
    config.output = { ...config.output, path: outputPath };

    await compile(config);

    const html = fs.readFileSync(path.join(outputPath, "index.html"), "utf8");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputPath, "deployment.json"), "utf8"),
    );
    const scriptMatch = html.match(
      /<script src="(\/compiler\/dist\/main\.[a-f0-9]+\.js)"><\/script>/,
    );

    expect(scriptMatch).not.toBeNull();
    expect(
      fs.existsSync(path.join(outputPath, path.basename(scriptMatch[1]))),
    ).toBe(true);
    expect(manifest).toEqual({ deploymentId: "deploy-test-123" });
    expect(html).toContain(
      '<meta name="easyeyes-deployment-id" content="deploy-test-123">',
    );
  });

  it("keeps development independent from DEPLOY_ID with a fixed bundle name", () => {
    delete process.env.DEPLOY_ID;

    const config = createWebpackConfig({ development: true });

    expect(config.output.filename).toBe("main.js");
  });
});
