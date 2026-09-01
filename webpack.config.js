/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
require("dotenv").config();
const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const requireFirebaseDatabaseUrl = () => {
  const value = process.env.FIREBASE_DATABASE_URL;
  if (!value) {
    throw new Error("FIREBASE_DATABASE_URL is required for compiler builds");
  }
  return value.replace(/\/+$/, "");
};

const validateDeploymentId = (value) => {
  if (typeof value !== "string" || !DEPLOYMENT_ID_PATTERN.test(value)) {
    throw new Error(
      "DEPLOY_ID must be 1-128 characters containing only letters, numbers, underscores, or hyphens",
    );
  }

  return value;
};

class CompilerDeploymentAssetsPlugin {
  constructor(deploymentId) {
    this.deploymentId = deploymentId;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(
      "CompilerDeploymentAssetsPlugin",
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: "CompilerDeploymentAssetsPlugin",
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
          },
          () => {
            const bundle = compilation.entrypoints
              .get("main")
              .getFiles()
              .find((file) => file.endsWith(".js"));
            const template = fs.readFileSync(
              path.resolve(__dirname, "index.html"),
              "utf8",
            );
            const html = template
              .replace(
                "</head>",
                `    <meta name="easyeyes-deployment-id" content="${this.deploymentId}">\n  </head>`,
              )
              .replace(
                '<script src="/compiler/dist/main.js"></script>',
                `<script src="/compiler/dist/${bundle}"></script>`,
              );

            compilation.emitAsset(
              "index.html",
              new webpack.sources.RawSource(html),
            );
            compilation.emitAsset(
              "deployment.json",
              new webpack.sources.RawSource(
                JSON.stringify({ deploymentId: this.deploymentId }),
              ),
            );
          },
        );
      },
    );
  }
}

const config = {
  entry: path.resolve(__dirname, "source/index.js"),
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: "asset/resource",
      },
      {
        test: /\.css$/i,
        exclude: /node_modules/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.scss$/i,
        exclude: /node_modules/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              importLoaders: true,
            },
          },
          // "postcss-loader",
          {
            loader: "sass-loader",
            options: {
              sassOptions: {
                silenceDeprecations: ["legacy-js-api", "import"],
              },
            },
          },
        ],
      },
      {
        test: /\.tsx?$/i,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "tsconfig.json"),
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.(js|jsx)$/i,
        loader: "babel-loader",
        exclude: [/node_modules/],
        options: { presets: ["@babel/env"] },
      },
      {
        test: /\.svg$/,
        use: "@svgr/webpack",
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    // harfbuzzjs and wawoff2 (used by the preprocessor's font shaping check)
    // ship emscripten glue that references node builtins behind runtime
    // environment guards; stub them out for the browser bundle.
    fallback: {
      fs: false,
      path: false,
      url: false,
      module: false,
    },
  },
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist/"),
    publicPath: "/compiler/dist/",
  },
};

// const plugins = [new CleanWebpackPlugin()];
const plugins = [];

const redirect_uri = (uri) =>
  `https://gitlab.pavlovia.org/oauth/authorize`.concat(
    `?client_id=63785db109412d3b2a6179ada78be8a3411936184b467f678c8251fda96d8c14`,
    `&scope=api&response_type=code`,
    `&redirect_uri=${uri}`,
  );

module.exports = (env) => {
  if (env.development) {
    const developmentConfig = Object.assign({}, config, {
      entry: env.e2e
        ? path.resolve(__dirname, "tests/e2e/fixtures/compilerHarness.jsx")
        : config.entry,
      mode: "development",
      optimization: {
        minimize: false,
      },
      plugins: [
        ...plugins,
        new webpack.ProgressPlugin(),
        new webpack.DefinePlugin({
          "process.env.debug": true,
          "process.env.REDIRECT_URL": JSON.stringify(
            redirect_uri("http%3A%2F%2Flocalhost%3A5500%2Fredirect"),
          ),
          "process.env.GITHUB_PAT": JSON.stringify(""),
          "process.env.FIREBASE_API_KEY": JSON.stringify(
            process.env.FIREBASE_API_KEY || "",
          ),
          "process.env.FIREBASE_API_KEY_SOUND": JSON.stringify(
            process.env.FIREBASE_API_KEY_SOUND || "",
          ),
          "process.env.FIREBASE_DATABASE_URL": JSON.stringify(
            requireFirebaseDatabaseUrl(),
          ),
          "process.env.SENTRY_DSN": JSON.stringify(
            process.env.SENTRY_DSN || "",
          ),
          "process.env.SENTRY_ENVIRONMENT": JSON.stringify(
            process.env.SENTRY_ENVIRONMENT || "development",
          ),
        }),
      ],
      // watch: true,
      devtool: "source-map",
      devServer: {
        port: 5500,
        static: {
          directory: path.join(__dirname, "../"),
          publicPath: "/",
          watch: false,
        },
        open: true,
        hot: true,
        liveReload: true,
        historyApiFallback: {
          rewrites: [
            {
              from: /^\/compiler(\/|$)/,
              to: (context) =>
                context.parsedUrl.pathname.replace(
                  /^\/compiler(\/|$)/,
                  "/experiment$1",
                ),
            },
          ],
        },
        // devMiddleware: {
        //   writeToDisk: true,
        // },
        watchFiles: {
          paths: [
            path.join(__dirname, "source/**/*"),
            path.join(__dirname, "experiment/**/*"),
          ],
          options: {
            ignored: /dist/,
          },
        },
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      },
      output: {
        filename: "main.js",
        path: path.resolve(__dirname, "dist/"),
        publicPath: "/compiler/dist/",
      },
    });
    if (env.e2e) {
      developmentConfig.resolve = {
        ...config.resolve,
        alias: {
          "../threshold/preprocess/gitlabUtils": path.resolve(
            __dirname,
            "tests/e2e/fixtures/gitlabBoundary.js",
          ),
          "./components/firebase": path.resolve(
            __dirname,
            "tests/e2e/fixtures/firebaseBoundary.js",
          ),
        },
      };
      developmentConfig.devServer.open = false;
      developmentConfig.devServer.port = 5510;
    }
    return developmentConfig;
  } else if (env.production) {
    const deploymentIdInput = process.env.DEPLOY_ID;
    if (!deploymentIdInput) {
      throw new Error("DEPLOY_ID is required for production compiler builds");
    }
    const deploymentId = validateDeploymentId(deploymentIdInput);

    return Object.assign({}, config, {
      mode: "production",
      optimization: {
        minimize: true,
      },
      plugins: [
        ...plugins,
        new CompilerDeploymentAssetsPlugin(deploymentId),
        new webpack.DefinePlugin({
          "process.env.debug": false,
          "process.env.REDIRECT_URL": JSON.stringify(
            redirect_uri("https%3A%2F%2Feasyeyes.app%2Fredirect"),
          ),
          "process.env.GITHUB_PAT": JSON.stringify(""),
          "process.env.FIREBASE_API_KEY": JSON.stringify(
            process.env.FIREBASE_API_KEY || "",
          ),
          "process.env.FIREBASE_API_KEY_SOUND": JSON.stringify(
            process.env.FIREBASE_API_KEY_SOUND || "",
          ),
          "process.env.FIREBASE_DATABASE_URL": JSON.stringify(
            requireFirebaseDatabaseUrl(),
          ),
          "process.env.SENTRY_DSN": JSON.stringify(
            process.env.SENTRY_DSN || "",
          ),
          "process.env.SENTRY_ENVIRONMENT": JSON.stringify(
            process.env.SENTRY_ENVIRONMENT || "production",
          ),
          "process.env.DEPLOY_ID": JSON.stringify(deploymentId),
        }),
      ],
      output: {
        filename: "main.[contenthash].js",
        path: path.resolve(__dirname, "dist/"),
        publicPath: "/compiler/dist/",
      },
    });
  }
};
