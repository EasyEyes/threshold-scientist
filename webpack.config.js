const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const path = require("path");

const config = {
  entry: "./src/index.ts",
  module: {
    rules: [
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

const plugins = [new webpack.ProgressPlugin(), new CleanWebpackPlugin()];

module.exports = (env) => {
  if (env.development) {
    return Object.assign({}, config, {
      mode: "development",
      optimization: {
        minimize: false,
      },
      plugins: [
        ...plugins,
        new webpack.DefinePlugin({
          "process.env.debug": true,
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
        }),
      ],
    });
  }
};
