const NodeCache = require('node-cache');
const CACHE_TTL_ONE_MINUTE = 1 * 60;
const cache = new NodeCache({ stdTTL: CACHE_TTL_ONE_MINUTE });

const createCacheKey = req => {
  return req.originalUrl;
};

const createClearKey = req => {
  const cacheKey = [
    req.params.version,
    req.params.baseId,
    req.params.tableIdOrName
  ].join('/');
  return cacheKey;
};

const get = req => {
  const url = createCacheKey(req);
  return cache.get(url);
};

const set = (req, data) => {
  const url = createCacheKey(req);
  cache.set(url, data);
};

const clear = req => {
  let urlKey = createClearKey(req);
  cache.del(cache.keys().filter(k => k.includes(urlKey)));
};

module.exports = {
  get: get,
  set: set,
  clear: clear
};
