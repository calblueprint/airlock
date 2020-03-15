const NodeCache = require('node-cache');
const tokenStore = new NodeCache();

const get = key => {
  tokenStore.get(key);
};
const set = (key, value) => {
  tokenStore.set(token, value);
};

const flush = () => {
  tokenStore.flushAll();
};

module.exports = {
  get: get,
  set: set,
  flush: flush,
};
