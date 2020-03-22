module.exports = (config, env, helpers) => {
  config.node.process = true;
  config.node.Buffer = true;

  let css = helpers.getLoadersByName(config, 'css-loader')[0];
  css.loader.options.modules = false;
}