/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const path = require("path");

const config = {
  entry: path.resolve(__dirname, "source/index.js"),
  module: {
    rules: [
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
          "sass-loader",
        ],
      },
      {
        test: /\.tsx?$/i,
        use: "ts-loader",
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
    publicPath: "/experiment/dist/",
  },
};

// const plugins = [new CleanWebpackPlugin()];
const plugins = [];

const redirect_uri = (uri) =>
  `https://gitlab.pavlovia.org//oauth/authorize`.concat(
    `?client_id=63785db109412d3b2a6179ada78be8a3411936184b467f678c8251fda96d8c14`,
    `&scope=api&response_type=token&response_mode=query`,
    `&redirect_uri=${uri}`
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
            redirect_uri("http%3A%2F%2Flocalhost%3A5500%2Fredirect")
          ),
          "process.env.GITHUB_PAT": JSON.stringify(""),
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
      },
      // output: {
      //   filename: "main.js",
      //   path: path.resolve(__dirname, "dist/"),
      //   publicPath: "/experiment/dist/",
      // },
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
            redirect_uri("https%3A%2F%2Feasyeyes.app%2Fredirect")
          ),
          "process.env.GITHUB_PAT": JSON.stringify(""),
        }),
      ],
    });
  }
};
