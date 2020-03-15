const NodeCache = require('node-cache');
const tokenStore = new NodeCache();

module.exports = {
  tokenStore: tokenStore,
};
