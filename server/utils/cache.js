const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1 * 60 });

parseUrl = req => {
  return req.originalUrl;
};

get = req => {
  const url = parseUrl(req);
  return cache.get(url);
};

set = (req, data) => {
  const url = parseUrl(req);
  cache.set(url, data);
};

module.exports = {
  get: get,
  set: set,
};
