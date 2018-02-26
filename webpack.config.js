const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const paths = (() => {
  const root = __dirname;
  return {
    root,
    src: path.join(root, 'src'),
    out: path.join(root, 'app', 'bundle'),
    nodeModules: path.join(root, 'node_modules')
  };
})();

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  target: 'electron',
  bail: true,
  entry: {
    bundle: ['babel-polyfill', path.join(paths.src, 'index.js')]
  },
  output: {
    path: paths.out,
    filename: '[name].js'
  },
  devtool: isProduction ? false : 'eval-source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      }
    ]
  }
};
