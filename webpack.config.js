const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const path = require("path");

const config = {
  entry: "./src/index.ts",
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
  },
};

const plugins = [new CleanWebpackPlugin()];

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
            redirect_uri("http%3A%2F%2Flocalhost%3A5500%2Fdocs%2Fredirect")
          ),
          "process.env.GITHUB_PAT": JSON.stringify(""),
        }),
      ],
      watch: true,
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
