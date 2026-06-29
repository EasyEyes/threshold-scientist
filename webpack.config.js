/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
require("dotenv").config();
const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const path = require("path");

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
    return Object.assign({}, config, {
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
  } else if (env.production) {
    return Object.assign({}, config, {
      mode: "production",
      optimization: {
        minimize: true,
      },
      plugins: [
        ...plugins,
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
          "process.env.SENTRY_DSN": JSON.stringify(
            process.env.SENTRY_DSN || "",
          ),
          "process.env.SENTRY_ENVIRONMENT": JSON.stringify(
            process.env.SENTRY_ENVIRONMENT || "production",
          ),
        }),
      ],
    });
  }
};
