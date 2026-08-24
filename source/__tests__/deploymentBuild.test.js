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
  const originalContext = process.env.CONTEXT;
  const originalFirebaseDatabaseUrl = process.env.FIREBASE_DATABASE_URL;

  it("declares dependencies imported from threshold compiler sources", () => {
    const compilerPackage = require("../../package.json");
    const declaredDependencies = {
      ...compilerPackage.dependencies,
      ...compilerPackage.devDependencies,
    };

    // webpack compiles ../threshold/preprocess/xlsxExport.ts as part of the
    // parent compiler bundle, so clean CI installs must provide this package.
    expect(declaredDependencies).toHaveProperty("exceljs");
  });

  afterEach(() => {
    if (originalDeployId === undefined) {
      delete process.env.DEPLOY_ID;
    } else {
      process.env.DEPLOY_ID = originalDeployId;
    }
    if (originalContext === undefined) {
      delete process.env.CONTEXT;
    } else {
      process.env.CONTEXT = originalContext;
    }
    if (originalFirebaseDatabaseUrl === undefined) {
      delete process.env.FIREBASE_DATABASE_URL;
    } else {
      process.env.FIREBASE_DATABASE_URL = originalFirebaseDatabaseUrl;
    }
  });

  it("rejects a production build without DEPLOY_ID", () => {
    delete process.env.DEPLOY_ID;

    expect(() => createWebpackConfig({ production: true })).toThrow(
      "DEPLOY_ID is required for production compiler builds",
    );
  });

  it.each([
    " deploy-123",
    "deploy-123 ",
    '<script>alert("deployment input")</script>',
    "deploy/../../production",
    "x".repeat(129),
  ])("rejects unsafe deployment input %#", (deploymentId) => {
    process.env.DEPLOY_ID = deploymentId;

    expect(() => createWebpackConfig({ production: true })).toThrow(
      "DEPLOY_ID must be 1-128 characters",
    );
  });

  it("emits matching deployment identity and a content-hashed bundle", async () => {
    process.env.DEPLOY_ID = "deploy-test-123";
    process.env.FIREBASE_DATABASE_URL =
      "https://test-staging-default-rtdb.firebaseio.com";
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

  it.each(["production", "deploy-preview"])(
    "embeds FIREBASE_DATABASE_URL in the %s bundle",
    async (context) => {
      process.env.DEPLOY_ID = `deploy-${context}`;
      process.env.CONTEXT = context;
      process.env.FIREBASE_DATABASE_URL =
        "https://test-staging-default-rtdb.firebaseio.com";
      const outputPath = fs.mkdtempSync(
        path.join(os.tmpdir(), "compiler-firebase-build-"),
      );
      const entryPath = path.join(outputPath, "entry.js");
      fs.writeFileSync(
        entryPath,
        "console.log(process.env.FIREBASE_DATABASE_URL);",
      );
      const config = createWebpackConfig({ production: true });
      config.entry = entryPath;
      config.module = { rules: [] };
      config.optimization = { minimize: false };
      config.output = { ...config.output, path: outputPath };

      await compile(config);

      const bundleName = fs
        .readdirSync(outputPath)
        .find((file) => /^main\.[a-f0-9]+\.js$/.test(file));
      const bundle = fs.readFileSync(path.join(outputPath, bundleName), "utf8");

      expect(bundle).toContain(process.env.FIREBASE_DATABASE_URL);
    },
  );

  it("rejects a production build without FIREBASE_DATABASE_URL", () => {
    process.env.DEPLOY_ID = "deploy-test-123";
    delete process.env.FIREBASE_DATABASE_URL;

    expect(() => createWebpackConfig({ production: true })).toThrow(
      "FIREBASE_DATABASE_URL is required for compiler builds",
    );
  });

  it("keeps development independent from DEPLOY_ID with a fixed bundle name", () => {
    delete process.env.DEPLOY_ID;
    process.env.FIREBASE_DATABASE_URL =
      "https://test-local-default-rtdb.firebaseio.com";

    const config = createWebpackConfig({ development: true });

    expect(config.output.filename).toBe("main.js");
  });
});
