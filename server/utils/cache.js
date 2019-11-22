const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1 * 60 });

const parseUrl = req => {
  return req.originalUrl;
};

const get = req => {
  const url = parseUrl(req);
  return cache.get(url);
};

const set = (req, data) => {
  const url = parseUrl(req);
  cache.set(url, data);
};

const clear = req => {
  cache.keys((err, keys) => {
    if (!err) {
      let baseUrl = req.baseUrl;
      const cacheKeys = keys.filter(k => k.includes(baseUrl));
      cache.del(cacheKeys);
    }
  });
};

module.exports = {
  get: get,
  set: set,
  clear: clear
};
