const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      (compiler) => {
        const TerserPlugin = require('terser-webpack-plugin');
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true, // 🔥 This removes console.* calls
              drop_debugger: true
            }
          }
        }).apply(compiler);
      }
    ]
  }
};
