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
          "process.env.REDIRECT_URL": JSON.stringify(
            "https://gitlab.pavlovia.org//oauth/authorize?client_id=914cc931ddf67ab1b9ad8366e29c3a33a89348e09d80fe9c4bbacaa199fa2ce1&redirect_uri=http%3A%2F%2Flocalhost%3A63342%2Fwebsite%2Fdocs%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=0wo5oj2oubc"
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
            "https://gitlab.pavlovia.org//oauth/authorize?client_id=7ad8f608b1706c035a47c22e36e53f14e8f137a28d0b922c30b3bbd8496da190&redirect_uri=https%3A%2F%2Foauth--easyeyes.netlify.app%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=6og9rq7bn6u"
          ),
          "process.env.GITHUB_PAT": JSON.stringify(""),
        }),
      ],
    });
  }
};
